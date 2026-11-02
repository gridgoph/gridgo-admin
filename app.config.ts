import { existsSync } from "node:fs";
import { resolve } from "node:path";

import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * app.json stays the whole configuration. This file only stamps the build
 * identity, Firebase config, Clerk publishable key and (for the Play upload
 * only) the EAS project link onto it — the same rules as gridgo-rider and
 * gridgo-supplier.
 *
 * A sideloaded APK has no store listing, so the version staff read in
 * Settings → Apps is the only handle anyone has on "which build is on this
 * phone", and Android refuses to install one release over another unless
 * `versionCode` has gone up. So app.json keeps MAJOR.MINOR as the release line,
 * CI appends its run number (`GRIDGO_BUILD_NUMBER`, set in
 * `.github/workflows/android-release.yml`), and `versionCode` is that same
 * number. With no build number — any local `expo start` — the app.json version
 * stands unchanged and nothing pretends to be a release.
 *
 * The rules live here rather than in `lib/`: @expo/config evaluates this file
 * with its own TypeScript loader, which does not resolve an extensionless
 * relative `.ts` import. `__tests__/appConfig.test.ts` calls these exports
 * directly, so the rules are tested where they run.
 *
 * Firebase config follows the same optional local file / required CI secret
 * convention as the client, rider and supplier apps.
 */

const RELEASE_LINE = /^(\d+)\.(\d+)(?:\.|$)/;

/**
 * Keep Clerk's frontend key explicit at the Expo config boundary. Everything
 * under `extra` is readable from the installed app, so a secret key is never
 * valid input here.
 */
export function clerkPublishableKey(
  value: string | null | undefined,
): string | undefined {
  const key = value?.trim();
  if (!key) return undefined;
  if (!key.startsWith("pk_")) {
    throw new Error("The Clerk publishable key must start with pk_, never a secret key.");
  }
  return key;
}

export type BuildVersion = {
  /** Human-visible version string, e.g. "1.0.42". */
  versionName: string;
  /** Android versionCode — must increase for an install to be an upgrade. */
  versionCode: number;
};

/**
 * @param baseVersion `expo.version` from app.json, e.g. "1.0.0".
 * @param buildNumber CI run number; blank or absent outside CI.
 */
export function buildVersion(
  baseVersion: string,
  buildNumber: string | null | undefined,
): BuildVersion {
  const line = RELEASE_LINE.exec(baseVersion.trim());
  if (!line) {
    throw new Error(
      `app.json expo.version must start with MAJOR.MINOR, got "${baseVersion}"`,
    );
  }

  const build = (buildNumber ?? "").trim();
  if (!build) return { versionName: baseVersion.trim(), versionCode: 1 };

  if (!/^\d+$/.test(build)) {
    throw new Error(`Build number must be a whole number, got "${build}"`);
  }

  const versionCode = Number(build);
  if (versionCode < 1) {
    throw new Error(`Build number must be 1 or greater, got "${build}"`);
  }

  return { versionName: `${line[1]}.${line[2]}.${versionCode}`, versionCode };
}

/** Resolve the private Firebase file; an explicitly broken path is an error. */
export function googleServicesFile(
  envPath: string | null | undefined,
  projectRoot: string,
  fileExists: (path: string) => boolean = existsSync,
): string | undefined {
  const named = (envPath ?? "").trim();
  if (named) {
    const path = resolve(projectRoot, named);
    if (!fileExists(path)) {
      throw new Error(
        `GOOGLE_SERVICES_JSON points at "${named}", which does not exist. ` +
          "A build with a broken Firebase path would install and never receive a notification.",
      );
    }
    return path;
  }

  const local = resolve(projectRoot, "google-services.json");
  return fileExists(local) ? local : undefined;
}

const EAS_PROJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EAS_OWNER = /^[a-z0-9][a-z0-9_-]*$/i;

export type EasProject = { owner: string; projectId: string };

/**
 * The EAS project this app is linked to, which only the Play upload needs
 * (`eas submit` in `.github/workflows/android-release.yml`). The captain has
 * not created it yet, so nothing is committed: the workflow passes the
 * repository variables `EAS_OWNER` and `EAS_PROJECT_ID`, and every other
 * build — APK, AAB, `expo start` — runs without them.
 *
 * Both or neither: a half-linked project would make `eas submit` prompt to
 * create one, which a non-interactive run cannot answer.
 */
export function easProject(
  owner: string | null | undefined,
  projectId: string | null | undefined,
): EasProject | undefined {
  const o = (owner ?? "").trim();
  const id = (projectId ?? "").trim();
  if (!o && !id) return undefined;
  if (!o || !id) {
    throw new Error("Set both EAS_OWNER and EAS_PROJECT_ID, or neither.");
  }
  if (!EAS_OWNER.test(o)) {
    throw new Error(`EAS_OWNER must be an Expo account name, got "${o}"`);
  }
  if (!EAS_PROJECT_ID.test(id)) {
    throw new Error("EAS_PROJECT_ID must be the EAS project's UUID");
  }
  return { owner: o, projectId: id };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const { name, slug, version } = config;
  if (!name || !slug || !version) {
    throw new Error("app.json must define expo.name, expo.slug and expo.version");
  }

  const { versionName, versionCode } = buildVersion(
    version,
    process.env.GRIDGO_BUILD_NUMBER,
  );
  const googleServices = googleServicesFile(process.env.GOOGLE_SERVICES_JSON, __dirname);
  const clerkKey = clerkPublishableKey(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const eas = easProject(process.env.EAS_OWNER, process.env.EAS_PROJECT_ID);

  return {
    ...config,
    name,
    slug,
    ...(eas ? { owner: eas.owner } : {}),
    version: versionName,
    extra: {
      ...config.extra,
      ...(clerkKey ? { clerkPublishableKey: clerkKey } : {}),
      ...(eas ? { eas: { ...config.extra?.eas, projectId: eas.projectId } } : {}),
    },
    android: {
      ...config.android,
      versionCode,
      ...(googleServices ? { googleServicesFile: googleServices } : {}),
    },
  };
};
