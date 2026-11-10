import { execFileSync } from "child_process";
import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * The workflows' load-bearing properties, asserted because none of them shows
 * up in a green build log (same guard as gridgo-rider).
 *
 * `EXPO_PUBLIC_*` values are inlined by Babel while the JS bundle is built, so
 * the API URL and Clerk key must be in the environment of every command that
 * evaluates config or bundles JS. A pull request must never reach the signing
 * key. Parsed as text: the questions are about which step a line sits in.
 */

const root = join(__dirname, "..");
const release = readFileSync(join(root, ".github/workflows/android-release.yml"), "utf8");
const tests = readFileSync(join(root, ".github/workflows/test.yml"), "utf8");

function jobBody(workflow: string, name: string): string {
  const lines = workflow.split("\n");
  const start = lines.indexOf(`  ${name}:`);
  if (start === -1) throw new Error(`workflow has no job "${name}"`);
  const rest = lines.slice(start + 1);
  const next = rest.findIndex((line) => /^ {2}\S/.test(line));
  return (next === -1 ? rest : rest.slice(0, next)).join("\n");
}

/** Steps with comment lines dropped, so prose never satisfies an assertion. */
function steps(body: string): string[] {
  return body
    .split(/^ {6}- /m)
    .slice(1)
    .map((step) => step.split("\n").filter((line) => !/^\s*#/.test(line)).join("\n"));
}

const apk = jobBody(release, "apk");
const apkSteps = steps(apk);
const find = (text: string) => apkSteps.findIndex((step) => step.includes(text));

const apiEnv = /EXPO_PUBLIC_API_URL:\s*\$\{\{\s*secrets\.EXPO_PUBLIC_API_URL\s*\}\}/;
const clerkEnv = /EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:\s*\$\{\{\s*secrets\.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY\s*\}\}/;

function hasPublicEnv(step: string): boolean {
  const env = /\n\s+env:\n([\s\S]*?)\n\s+run:/.exec(step)?.[1] ?? "";
  return apiEnv.test(env) && clerkEnv.test(env);
}

describe("the release APK", () => {
  it("bakes the deployed API and the live Clerk key into config, prebuild and bundle", () => {
    for (const text of ["expo config --type public", "expo prebuild", "gradlew assembleRelease"]) {
      expect(hasPublicEnv(apkSteps[find(text)])).toBe(true);
    }
    expect(apkSteps[find("gradlew assembleRelease")]).toContain("pk_live_*");
  });

  it("verifies the signed APK before publishing it anywhere", () => {
    const verify = find("verify-release-apk.sh android/app/build/outputs/apk/");
    expect(hasPublicEnv(apkSteps[verify])).toBe(true);
    expect(verify).toBeGreaterThan(find("gradlew assembleRelease"));
    expect(find("upload-artifact")).toBeGreaterThan(verify);
    expect(apkSteps[find("upload-artifact")]).toContain("*.apk");
  });

  it("keeps Admin builds only as short-lived workflow artifacts", () => {
    expect(release).not.toMatch(/upload-apk|DEPLOY_|gridgo\.talasora\.com\/download|gh release|contents: write/);
    expect(apkSteps[find("upload-artifact")]).toContain("retention-days: 7");
    expect(apkSteps[find("upload-artifact")]).not.toContain("continue-on-error");
  });

  it("destroys every credential however the job ends", () => {
    const cleanup = apkSteps.find((step) => step.includes("rm -f") && step.includes("release.jks"));
    expect(cleanup).toMatch(/if:\s*always\(\)/);
    expect(cleanup).toContain("google-services.json");
    expect(cleanup).toContain("play-service-account.json");
    expect(cleanup).not.toMatch(/play_bundle/);
  });

  it("stages Firebase outside the workspace and validates Admin before config and prebuild", () => {
    const stage = find("name: Stage the Firebase config");
    expect(stage).toBeGreaterThan(-1);
    expect(stage).toBeLessThan(find("expo config --type public"));
    expect(stage).toBeLessThan(find("expo prebuild"));
    expect(apkSteps[stage]).toContain("secrets.GOOGLE_SERVICES_JSON_BASE64");
    expect(apkSteps[stage]).toContain('pkgs.includes("ph.gridgo.admin")');
    expect(apkSteps[stage]).toContain('GOOGLE_SERVICES_JSON=$RUNNER_TEMP/google-services.json');
    expect(apkSteps[stage]).toContain('>> "$GITHUB_ENV"');
    expect(readFileSync(join(root, ".gitignore"), "utf8")).toMatch(/^google-services\.json$/m);
    expect(release).not.toContain("secrets.EXPO_PUBLIC_CARTO_API_KEY");
  });
});

describe("pull requests", () => {
  it("never reach the signing job", () => {
    expect(release).not.toMatch(/^\s+pull_request:/m);
    expect(apk).toMatch(/if:\s*github\.event_name\s*!=\s*'pull_request'/);
    expect(jobBody(release, "check")).not.toMatch(/secrets\./);
  });

  it("run config, typecheck, lint and tests without any secret", () => {
    expect(tests).toMatch(/^\s+pull_request:/m);
    expect(tests).not.toMatch(/secrets\./);
    for (const command of ["expo config --type public", "tsc --noEmit", "npm run lint", "npm test"]) {
      expect(tests).toContain(command);
    }
  });
});

describe("a manual play_bundle run builds a Google Play bundle", () => {
  const isPlay = /if:\s*github\.event\.inputs\.play_bundle == 'true'/;
  const notPlay = /if:\s*github\.event\.inputs\.play_bundle != 'true'/;
  const bundleStep = () => apkSteps.find((step) => step.includes("gradlew bundleRelease")) as string;
  const aabVerify = () =>
    apkSteps.find((step) => step.includes("scripts/verify-release-apk.sh") && step.includes(".aab")) as string;
  const aabUpload = () =>
    apkSteps.find((step) => step.includes("upload-artifact") && step.includes("*.aab")) as string;

  it("is a manual dispatch input that defaults off", () => {
    expect(release).toMatch(/ {6}play_bundle:\n[\s\S]*?type: boolean\n\s+default: false/);
  });

  it("builds the AAB with the APK's public configuration", () => {
    const build = bundleStep();
    expect(build).toMatch(isPlay);
    expect(hasPublicEnv(build)).toBe(true);
    expect(build).toContain("pk_live_*");
    expect(build).toContain("./gradlew bundleRelease --no-daemon");
  });

  it("skips every APK step on a Play run", () => {
    for (const marker of [
      "gradlew assembleRelease",
      "apk/release/app-release.apk",
      "cp android/app/build/outputs/apk/release/app-release.apk",
    ]) {
      expect(apkSteps.find((s) => s.includes(marker))).toMatch(notPlay);
    }
    const apkUpload = apkSteps.find((step) => step.includes("upload-artifact") && step.includes("*.apk"));
    expect(apkUpload).toMatch(notPlay);
  });

  it("verifies the AAB's signer and bundle before keeping it", () => {
    const verify = aabVerify();
    expect(verify).toMatch(isPlay);
    expect(hasPublicEnv(verify)).toBe(true);
    expect(verify).toContain("android/app/build/outputs/bundle/release/app-release.aab");
    expect(verify).toMatch(/ANDROID_KEY_ALIAS:\s*\$\{\{\s*secrets\.ANDROID_KEY_ALIAS\s*\}\}/);
    expect(apkSteps.indexOf(verify)).toBeGreaterThan(apkSteps.indexOf(bundleStep()));
    expect(apkSteps.indexOf(aabUpload())).toBeGreaterThan(apkSteps.indexOf(verify));
  });

  it("keeps the AAB only as a short-lived artifact, and a failed upload fails the run", () => {
    const upload = aabUpload();
    expect(upload).toMatch(isPlay);
    expect(upload).not.toMatch(/continue-on-error/);
    expect(upload).toContain("if-no-files-found: error");
    expect(upload).toContain("retention-days: 7");
  });

  it("runs in its own concurrency group, so it never cancels a main release", () => {
    expect(release).toMatch(
      /group: android-apk-\$\{\{ github\.ref \}\}\$\{\{ github\.event\.inputs\.play_bundle == 'true' && '-play' \|\| '' \}\}/,
    );
  });

  it("verify-release-apk.sh reads an AAB's jar signature and base/ bundle", () => {
    const script = readFileSync(join(root, "scripts/verify-release-apk.sh"), "utf8");
    expect(script).toContain('*.aab) kind="AAB"; bundle="base/assets/index.android.bundle"');
    expect(script).toContain("jarsigner -verify");
    expect(script).toContain("'jar verified.'");
    expect(script).toContain("keytool -printcert -jarfile");
  });
});

describe("submit_to_play hands the verified AAB to a private testing track only", () => {
  const eas = JSON.parse(readFileSync(join(root, "eas.json"), "utf8"));
  const appJson = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo;
  const bothInputs =
    /if: github\.event\.inputs\.play_bundle == 'true' && github\.event\.inputs\.submit_to_play == 'true'\n/;
  const submitStep = apkSteps.find((step) => step.includes("eas-cli@")) as string;
  const selectStep = apkSteps.find((step) => step.includes("id: play-track")) as string;
  const preflight = apkSteps.find((step) => step.includes("Check the Play submission values")) as string;

  function runStep(step: string, env: Record<string, string>): string {
    const directory = mkdtempSync(join(tmpdir(), "gridgo-admin-play-"));
    const output = join(directory, "outputs");
    const script = step.split("run: |\n")[1].replace(/^ {10}/gm, "");
    try {
      execFileSync("bash", ["-c", script], {
        env: { ...process.env, EXPO_TOKEN: "", GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "", EAS_OWNER: "", EAS_PROJECT_ID: "", ...env, GITHUB_OUTPUT: output },
        stdio: "pipe",
      });
      try {
        return readFileSync(output, "utf8");
      } catch {
        return "";
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  function selectTrack(requested: string): Record<string, string> {
    return Object.fromEntries(
      runStep(selectStep, { REQUESTED_TRACK: requested })
        .trim()
        .split("\n")
        .map((line) => line.split("=")),
    );
  }

  it("offers only internal and closed, defaulting to internal", () => {
    expect(release).toMatch(
      / {6}play_track:\n[\s\S]*?type: choice\n\s+default: internal\n\s+options:\n\s+- internal\n\s+- closed\n\n/,
    );
    expect(selectTrack("")).toEqual(selectTrack("internal"));
    expect(selectTrack("internal")).toEqual({
      profile: "production", track: "internal", label: "internal testing",
    });
    expect(selectTrack("closed")).toEqual({
      profile: "closed", track: "alpha", label: "closed testing",
    });
    for (const requested of ["", "internal", "closed"]) {
      const selected = selectTrack(requested);
      expect(eas.submit[selected.profile].android.track).toBe(selected.track);
      expect(selected.track).not.toBe("production");
    }
  });

  it.each(["production", "alpha", "beta", "invalid", "closed; echo production"])(
    "rejects unsupported track input %s before submitting",
    (requested) => expect(() => selectTrack(requested)).toThrow(),
  );

  it("is a manual dispatch input that defaults off", () => {
    expect(release).toMatch(/ {6}submit_to_play:\n[\s\S]*?type: boolean\n\s+default: false/);
  });

  it("never names the production track or promotes a release", () => {
    expect(release).not.toMatch(/track[:=]\s*"?production|--track|promote|changesNotSentForReview/i);
    expect(JSON.stringify(eas)).not.toMatch(/"track":\s*"production"/);
  });

  it("runs only on a Play bundle run that asked for it", () => {
    for (const step of [submitStep, selectStep, preflight]) expect(step).toMatch(bothInputs);
    expect(selectStep).toContain("REQUESTED_TRACK: ${{ github.event.inputs.play_track }}");
    expect(apkSteps.filter((step) => /inputs\.play_track/.test(step))).toEqual([selectStep]);
    const named = apkSteps.find((step) => step.includes("Name the Play bundle"));
    const readers = apkSteps.filter((step) => /inputs\.submit_to_play/.test(step));
    expect(readers).toEqual([preflight, selectStep, named, submitStep]);
  });

  it("fails before the build, naming every missing Play/EAS value without printing one", () => {
    expect(apkSteps.indexOf(preflight)).toBeLessThan(find("expo prebuild"));
    for (const line of [
      "EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}",
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON }}",
      "EAS_OWNER: ${{ vars.EAS_OWNER }}",
      "EAS_PROJECT_ID: ${{ vars.EAS_PROJECT_ID }}",
    ]) {
      expect(preflight).toContain(line);
    }
    let message = "";
    try {
      runStep(preflight, { EXPO_TOKEN: "tok-secret" });
    } catch (error) {
      message = String((error as { stdout: Buffer }).stdout);
    }
    expect(message).toContain(
      "missing: secret:GOOGLE_PLAY_SERVICE_ACCOUNT_JSON variable:EAS_OWNER variable:EAS_PROJECT_ID",
    );
    expect(message).not.toContain("tok-secret");
    expect(() =>
      runStep(preflight, {
        EXPO_TOKEN: "t", GOOGLE_PLAY_SERVICE_ACCOUNT_JSON: "{}", EAS_OWNER: "o", EAS_PROJECT_ID: "p",
      }),
    ).not.toThrow();
  });

  it("submits the AAB after it is verified and kept as an artifact", () => {
    const verified = apkSteps.findIndex(
      (step) => step.includes("scripts/verify-release-apk.sh") && step.includes(".aab"),
    );
    const kept = apkSteps.findIndex((step) => step.includes("upload-artifact") && step.includes("*.aab"));
    const submitted = apkSteps.indexOf(submitStep);
    expect(submitted).toBeGreaterThan(verified);
    expect(submitted).toBeGreaterThan(kept);
    expect(submitted).toBeGreaterThan(apkSteps.indexOf(selectStep));
  });

  it("pins eas-cli and runs it non-interactive against that AAB, linked to the EAS project", () => {
    expect(submitStep).toMatch(/npx --yes eas-cli@\d+\.\d+\.\d+ submit/);
    expect(submitStep).toContain("--platform android");
    expect(submitStep).toContain('--profile "$SUBMIT_PROFILE"');
    expect(submitStep).toContain("SUBMIT_PROFILE: ${{ steps.play-track.outputs.profile }}");
    expect(submitStep).toContain('--path "$RUNNER_TEMP/play/$AAB"');
    expect(submitStep).toContain("--non-interactive");
    expect(submitStep).toMatch(/EXPO_TOKEN:\s*\$\{\{\s*secrets\.EXPO_TOKEN\s*\}\}/);
    expect(submitStep).toContain("EAS_OWNER: ${{ vars.EAS_OWNER }}");
    expect(submitStep).toContain("EAS_PROJECT_ID: ${{ vars.EAS_PROJECT_ID }}");
  });

  it("keeps the service-account key outside the workspace, private, and never echoed", () => {
    expect(submitStep).toContain('key="$RUNNER_TEMP/play-service-account.json"');
    expect(submitStep).toContain("umask 077");
    expect(submitStep).toContain('chmod 600 "$key"');
    expect(submitStep).toContain(`trap 'rm -f "$key"' EXIT`);
    const expansions = submitStep
      .split("\n")
      .filter((line) => line.includes("$GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"));
    expect(expansions.map((line) => line.trim())).toEqual([
      `printf '%s' "$GOOGLE_PLAY_SERVICE_ACCOUNT_JSON" > "$key"`,
    ]);
    expect(submitStep).not.toMatch(/--verbose|set -x/);
  });

  it("uses the selected testing track in the step name and summaries", () => {
    const named = apkSteps.find((s) => s.includes("Name the Play bundle")) as string;
    expect(submitStep).toContain("Submit the Play bundle to ${{ steps.play-track.outputs.label }}");
    for (const summary of [submitStep, named]) {
      expect(summary).toContain("TRACK_LABEL: ${{ steps.play-track.outputs.label }}");
      expect(summary).toContain("$TRACK_LABEL");
    }
    expect(submitStep).toContain("Google reviews closed releases");
  });

  it("has an internal (production profile) and a closed (alpha) profile, both completed", () => {
    expect(eas.cli.appVersionSource).toBe("remote");
    expect(eas.submit.production.android).toEqual({
      serviceAccountKeyPath: "$GOOGLE_PLAY_SERVICE_ACCOUNT_KEY_PATH",
      track: "internal",
      releaseStatus: "completed",
    });
    expect(eas.submit.closed.android).toEqual({ ...eas.submit.production.android, track: "alpha" });
    expect(Object.keys(eas.submit).sort()).toEqual(["closed", "production"]);
    // Android builds stay in this workflow with the upload key, never on EAS.
    expect(eas.build).toBeUndefined();
  });

  it("commits no EAS owner or project: both come from repository variables", () => {
    expect(appJson.owner).toBeUndefined();
    expect(appJson.extra?.eas).toBeUndefined();
  });
});
