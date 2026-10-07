# GRIDGO Admin

The invite-only internal staff app for GRIDGO: hub pick-up claims, the staff handover log, the receipt-scan feed for Admin, and the hub duty checklist. Tracked in gridgoph/gridgo-api#125 (hub claims: #124).

## What staff can do

| Who | Gets |
|---|---|
| Signed in, no staff role | Only **Ask GRIDGO for an invite** and the invite-code field |
| Staff whose role can hand out orders (built-in `hub_staff`) | **Scan**, **My handovers**, **Hub duty**, Account |
| Staff with a role that cannot hand out | My handovers, Hub duty, Account |
| Operations / Super Admin | **Admin** (every staff member's handovers, receipt scans), Hub duty, Account |

Access always comes from GRIDGO memberships through the API, never from the app.

### Joining

1. Super Admin creates an invite for a staff role (`POST /admin/staff/invites`, dashboard) and sends the code — or the link `gridgoadmin://redeem?code=<code>` — privately to the person.
2. They sign in with their GRIDGO account (the same sign-in as every GRIDGO app; there is no separate account to make here).
3. They enter or paste the code. The code is single use and belongs to the first account that redeems it.

### A pick-up handover

1. **Scan** the QR on the client's GRIDGO app (or tap *Type the QR code instead* when the camera is unavailable).
2. Type the client's 6-digit code and tap **Confirm handover**.
3. GRIDGO checks the QR and the code together:
   - **Codes match** → hand the package over; it is logged under your name.
   - **Do not hand over** → the code is wrong. Keep the package. Retype it, or **Escalate to Operations** (Operations and Super Admin are alerted). Five wrong codes lock the QR for 15 minutes.
   - Other stops (not a pick-up QR, already collected, payment not confirmed, order on hold) say what to do.

## Development

```sh
npm install
cp .env.example .env.local   # then fill in the values (never commit .env.local)
npm start                     # Expo Go on port 8084
npx expo start --web --port 19xxx   # browser, any free port
```

`.env.local`:

| Variable | Value |
|---|---|
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | The GRIDGO Clerk instance's publishable key (same as the other GRIDGO apps) |
| `EXPO_PUBLIC_API_URL` | Optional. Defaults to the Expo host on port `8787` (see `resolveApiBase` in `lib/api.ts`) |

**Browser testing** opens on `admin.localhost:<port>` (Clerk's development cookie is per host, so each GRIDGO app gets its own). The API must allow that origin in both `CORS_ALLOWED_ORIGINS` and `CLERK_AUTHORIZED_PARTIES`. The camera usually is not available in a headless browser; use *Type the QR code instead*.

**Checks** (the same ones CI runs):

```sh
npx expo config --type public > /dev/null
npx tsc --noEmit
npm run lint
npm test -- --maxWorkers=2
```

## Release

Pull requests and pushes to `dev`/`main` run `.github/workflows/test.yml`. A merge to `main` (or a manual run) runs `.github/workflows/android-release.yml`, which mirrors the other GRIDGO apps: signed release APK → verified with `scripts/verify-release-apk.sh` → Actions artifact (retained for 7 days).

It needs these **repository secrets**; until they exist the release job fails at its first check, by design:

| Secret | Used for |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | The release keystore, base64-encoded |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore and key password |
| `ANDROID_KEY_ALIAS` | Key alias in that keystore |
| `EXPO_PUBLIC_API_URL` | The deployed API URL, inlined into the bundle |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | The GRIDGO Clerk **live** publishable key (`pk_live_…`) |
| `GOOGLE_SERVICES_JSON_BASE64` | Base64 Firebase config containing `ph.gridgo.admin` |

Admin APKs must never be published to the public GRIDGO download page. The public repository must not publish APKs through GitHub Releases either. The workflow keeps APKs only as seven-day Actions artifacts and has no server upload step or deploy credentials. Release signing credentials are supplied separately; no release key is stored in this repository.

For local builds, set `GOOGLE_SERVICES_JSON` to the Firebase JSON file path or place a gitignored `google-services.json` in the repository root. An explicit missing path fails; development checks without a file remain supported. CI requires the secret and validates the Android package before prebuild. Firebase configuration alone does not add device-token registration or notification handling to the app.

## Project notes

Agent and contributor notes: [AGENTS.md](AGENTS.md). Fonts: `assets/fonts/README.md`.
