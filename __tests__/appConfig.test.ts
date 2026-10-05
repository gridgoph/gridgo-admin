import { existsSync, readFileSync } from "fs";
import { join } from "path";

import { buildVersion, clerkPublishableKey } from "../app.config";
import { clerkPublishableKey as runtimeClerkKey } from "@/lib/clerkAuth";

const root = join(__dirname, "..");
const appJson = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo;
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

describe("build identity", () => {
  it("keeps the app.json version locally and stamps the CI run number on release", () => {
    expect(buildVersion("1.0.0", undefined)).toEqual({ versionName: "1.0.0", versionCode: 1 });
    expect(buildVersion("1.0.0", "42")).toEqual({ versionName: "1.0.42", versionCode: 42 });
    expect(() => buildVersion("1.0.0", "4x")).toThrow();
    expect(() => buildVersion("one", "4")).toThrow();
  });

  it("is its own app, not a copy of the rider", () => {
    expect(appJson.name).toBe("GRIDGO Admin");
    expect(appJson.android.package).toBe("ph.gridgo.admin");
    expect(appJson.ios.bundleIdentifier).toBe("ph.gridgo.admin");
    expect(appJson.scheme).toBe("gridgoadmin");
  });
});

describe("Clerk", () => {
  it("accepts only publishable keys at the config boundary", () => {
    expect(clerkPublishableKey(" pk_test_abc ")).toBe("pk_test_abc");
    expect(clerkPublishableKey("")).toBeUndefined();
    expect(() => clerkPublishableKey("sk_test_secret")).toThrow(/never a secret key/);
  });

  it("requires a live key in a production bundle", () => {
    expect(runtimeClerkKey("pk_test_abc", true)).toBe("pk_test_abc");
    expect(() => runtimeClerkKey("pk_test_abc", false)).toThrow(/pk_live_/);
    expect(runtimeClerkKey("pk_live_abc", false)).toBe("pk_live_abc");
  });
});

describe("config plugins and assets", () => {
  it("names only installed packages as plugins (a stale one kills launch)", () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const plugin of appJson.plugins) {
      const name = Array.isArray(plugin) ? plugin[0] : plugin;
      expect(deps[name]).toBeDefined();
    }
  });

  it("asks for the camera, because scanning is the job", () => {
    const camera = appJson.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-camera");
    expect(camera?.[1].cameraPermission).toMatch(/scan/);
    expect(appJson.android.permissions).toContain("CAMERA");
  });

  it("ships every icon and font app.json points at", () => {
    const paths = [
      appJson.icon,
      appJson.web.favicon,
      ...Object.values(appJson.android.adaptiveIcon).filter((v) => typeof v === "string" && v.startsWith("./")),
      ...appJson.plugins.flatMap((plugin: unknown) =>
        Array.isArray(plugin) ? [...(plugin[1].fonts ?? []), plugin[1].image, plugin[1].dark?.image] : [],
      ),
    ].filter(Boolean) as string[];
    for (const path of paths) expect(existsSync(join(root, path))).toBe(true);
  });
});
