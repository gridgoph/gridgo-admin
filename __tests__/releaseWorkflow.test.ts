import { readFileSync } from "fs";
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
    const verify = find("scripts/verify-release-apk.sh");
    expect(hasPublicEnv(apkSteps[verify])).toBe(true);
    expect(verify).toBeGreaterThan(find("gradlew assembleRelease"));
    expect(find("upload-apk admin")).toBeGreaterThan(verify);
    expect(find("gh release create")).toBeGreaterThan(find("upload-apk admin"));
    expect(find("upload-artifact")).toBeGreaterThan(find("gh release create"));
  });

  it("uploads under this app's own name, only from a merge to main, with a pinned host", () => {
    const publish = apkSteps[find("upload-apk admin")];
    expect(publish).toMatch(/'upload-apk admin' < "\$apk"/);
    expect(publish).toMatch(/if:\s*github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
    expect(publish).toContain("StrictHostKeyChecking=yes");
    expect(release).not.toContain("upload-apk rider");
  });

  it("destroys every credential however the job ends", () => {
    const cleanup = apkSteps.find((step) => step.includes("rm -f") && step.includes("release.jks"));
    expect(cleanup).toMatch(/if:\s*always\(\)/);
    expect(cleanup).toContain("deploy_key");
  });

  it("needs no Firebase or map secret: the Admin App has neither", () => {
    expect(release).not.toMatch(/secrets\.(GOOGLE_SERVICES_JSON_BASE64|EXPO_PUBLIC_CARTO_API_KEY)/);
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
