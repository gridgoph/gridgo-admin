#!/usr/bin/env bash
#
# Verify a release APK before anyone sideloads it, or a release Android App
# Bundle (.aab) before it goes to a Google Play testing track.
#
# Two things can be wrong with a build that looks perfectly green in CI, and
# both of them only show up on a staff member's phone:
#
#   1. It is signed with the debug key. Expo's generated `android/app/build.gradle`
#      points the release build type at `signingConfigs.debug`, so a plain
#      `assembleRelease` produces a debug-signed APK that installs happily and
#      can never be upgraded by a real release.
#   2. It points at localhost, or Clerk is missing. `EXPO_PUBLIC_*` values are
#      inlined by Babel when the JS bundle is built, not read at runtime. The
#      Clerk value reaches Expo extra at prebuild and also has a static env read
#      that Babel can inline at Gradle time.
#
# Neither is visible from the build log, so both are asserted here against the
# actual artifact. Nothing this script prints contains a password, a key, or
# the API URL — a certificate fingerprint is public (it ships inside the APK).
#
# An AAB is checked the same way. It is jar-signed rather than APK-signed, so
# its certificate is read with `jarsigner`/`keytool -printcert -jarfile`
# instead of `apksigner`, and its bundle sits under the `base/` module. Google
# Play re-signs what it serves with the app signing key; the upload key checked
# here is what Play Console accepts the upload with.
#
# Usage:
#   ANDROID_KEYSTORE_PATH=… ANDROID_KEYSTORE_PASSWORD=… ANDROID_KEY_ALIAS=… \
#   EXPO_PUBLIC_API_URL=… EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=… \
#   scripts/verify-release-apk.sh path/to/app-release.apk|path/to/app-release.aab

set -euo pipefail

apk="${1:-}"
[ -n "$apk" ] || { echo "usage: $0 <apk|aab>" >&2; exit 2; }
[ -f "$apk" ] || { echo "FAIL: no APK or AAB at $apk" >&2; exit 1; }

case "$apk" in
  *.aab) kind="AAB"; bundle="base/assets/index.android.bundle" ;;
  *) kind="APK"; bundle="assets/index.android.bundle" ;;
esac

fail() { echo "FAIL: $*" >&2; exit 1; }

require_env() {
  local name="$1"
  [ -n "${!name:-}" ] || fail "$name is not set"
}

require_env ANDROID_KEYSTORE_PATH
require_env ANDROID_KEYSTORE_PASSWORD
require_env ANDROID_KEY_ALIAS
require_env EXPO_PUBLIC_API_URL
require_env EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

case "$EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" in
  pk_live_*) ;;
  *) fail "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY is not a production pk_live_ key" ;;
esac

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

# --- 1. signed with the release key, not the debug key ----------------------

find_apksigner() {
  local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}" candidate
  if [ -n "$sdk" ] && [ -d "$sdk/build-tools" ]; then
    candidate="$(find "$sdk/build-tools" -maxdepth 2 -name apksigner -type f |
      sort -V | tail -1)"
    [ -n "$candidate" ] && { echo "$candidate"; return; }
  fi
  command -v apksigner || return 1
}

if [ "$kind" = "AAB" ]; then
  command -v jarsigner >/dev/null || fail "jarsigner not found (need a JDK)"
  # An unsigned bundle still exits 0 here ("jar is unsigned."), so the verdict
  # line is what counts.
  jarsigner -verify "$apk" >"$work/verify.out" 2>&1 ||
    fail "jarsigner could not verify the AAB signature: $(cat "$work/verify.out")"
  grep -qF 'jar verified.' "$work/verify.out" ||
    fail "the AAB is not signed: $(cat "$work/verify.out")"

  keytool -printcert -jarfile "$apk" >"$work/certs.txt" </dev/null 2>&1 ||
    fail "keytool could not read the AAB certificate"

  if grep -qi 'CN=Android Debug' "$work/certs.txt"; then
    fail "AAB is signed with the Android debug key"
  fi

  apk_digest="$(grep -im1 'SHA256:' "$work/certs.txt" |
    awk '{print $2}' | tr -d ':' | tr 'A-F' 'a-f')"
  [ -n "$apk_digest" ] || fail "keytool printed no SHA-256 certificate fingerprint for the AAB"
else
  apksigner="$(find_apksigner)" || fail "apksigner not found (need the Android SDK build-tools)"

  "$apksigner" verify "$apk" >/dev/null 2>"$work/verify.err" ||
    fail "apksigner could not verify the APK signature: $(cat "$work/verify.err")"

  "$apksigner" verify --print-certs "$apk" >"$work/certs.txt"

  if grep -qi 'CN=Android Debug' "$work/certs.txt"; then
    fail "APK is signed with the Android debug key"
  fi

  apk_digest="$(grep -im1 'certificate SHA-256 digest' "$work/certs.txt" |
    awk '{print $NF}' | tr 'A-F' 'a-f')"
  [ -n "$apk_digest" ] || fail "apksigner printed no SHA-256 certificate digest"
fi

# keytool reads the store password from stdin, keeping it out of the process list.
printf '%s\n' "$ANDROID_KEYSTORE_PASSWORD" |
  keytool -list -v -keystore "$ANDROID_KEYSTORE_PATH" -alias "$ANDROID_KEY_ALIAS" \
    >"$work/keystore.txt" 2>"$work/keystore.err" ||
  fail "keytool could not read alias '$ANDROID_KEY_ALIAS' from the keystore"

key_digest="$(grep -im1 'SHA256:' "$work/keystore.txt" |
  awk '{print $2}' | tr -d ':' | tr 'A-F' 'a-f')"
[ -n "$key_digest" ] || fail "keytool printed no SHA-256 fingerprint"

[ "$apk_digest" = "$key_digest" ] ||
  fail "$kind is signed by a different certificate than alias '$ANDROID_KEY_ALIAS'"

echo "OK: signed by alias '$ANDROID_KEY_ALIAS' (cert SHA-256 $apk_digest)"

# --- 2. deployed API and Clerk config are baked into the bundle -------------

unzip -p "$apk" "$bundle" >"$work/bundle.bin" 2>/dev/null ||
  fail "$bundle is missing from the $kind"
[ -s "$work/bundle.bin" ] || fail "$bundle is empty"

grep -aqF -- "$EXPO_PUBLIC_API_URL" "$work/bundle.bin" ||
  fail "the deployed API URL is not in $bundle — EXPO_PUBLIC_API_URL was not set for the build step, so this $kind points at loopback"

if grep -aqF -- 'EXPO_PUBLIC_API_URL' "$work/bundle.bin"; then
  fail "the variable name survives in $bundle — the value was not inlined at bundle time"
fi

grep -aqF -- "$EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY" "$work/bundle.bin" ||
  fail "the production Clerk publishable key is not in $bundle"

echo "OK: the deployed API URL and Clerk production key are inlined in $bundle"
echo "OK: $(basename "$apk") is a real signed release build"
