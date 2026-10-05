# Project agent memory

**GRIDGO Admin App** — the invite-only internal staff app (gridgoph/gridgo-api#125, hub claims #124). Expo SDK 57, Expo Router, NativeWind, Zustand, Clerk. Read the versioned Expo docs (https://docs.expo.dev/versions/v57.0.0/) before writing code. Built from gridgo-rider's conventions; when a shared rule changes (design tokens, `lib/api.ts` request/401 retry, release workflow), check gridgo-rider and gridgo-supplier first and keep them in step.

- **Contract:** gridgo-api `docs/HUB_HANDOVER_API.md` is authoritative for every route, payload and error code. Read it before changing a call site. All calls go through `lib/api.ts`.
- **Access is the API's, never Clerk's.** Same Clerk instance as every GRIDGO app (no separate sign-in application). `lib/access.ts` turns `/auth/me` memberships + `/staff/me` into `none | paused | granted{staff, adminRole}`; `app/_layout.tsx` guards routes with `Stack.Protected` and `app/(tabs)/_layout.tsx` hides tabs with `Tabs.Protected`. Signed in without access → only `app/invite.tsx` (redeem `POST /auth/staff/redeem`). Staff routes send `X-GRIDGO-Role: staff`; Admin feeds send the caller's `ops_admin`/`super_admin` membership — a role the account lacks is a 403.
- **A handover is only a 200 from `POST /staff/hub/claims`.** The app never compares QR and code itself. Every refusal blocks (`lib/handover.ts` `classifyClaimError`); mismatch/lock offer escalation via the API's `escalatePath` with the scanned `qrToken`. QR token and code live in memory only (`store/scan.ts`), never in storage or a URL.
- **Scanner:** `components/QrScanner.tsx` (expo-camera). The typed fallback on the Scan screen is required — for a failed camera and for browser testing.
- **Design system:** tokens in `global.css` + `constants/theme.ts` (copied from gridgo-rider; change both together). One yellow primary action per screen; status = icon + label + colour; Light and Dark identical. Copy uses typographic apostrophes (`’`) in JSX text — `react/no-unescaped-entities` rejects `'`.
- **Commands:** `npx tsc --noEmit`, `npm run lint`, `npm test -- --maxWorkers=2`. Tests `await` both `render` and `fireEvent` (RNTL 14). CI: `.github/workflows/test.yml`; release: `.github/workflows/android-release.yml` (secrets listed in README → Release; guarded by `__tests__/releaseWorkflow.test.ts`).
- **Browser testing:** `npx expo start --web --port <free>` (never 8081–8083). The dev bundle bounces loopback hosts to `admin.localhost` (`lib/devWebHost.ts`). The shared dev API must list that web origin in `CORS_ALLOWED_ORIGINS` *and* `CLERK_AUTHORIZED_PARTIES`, or every call is refused. On a loaded host Metro's watcher can miss edits: restart with `--clear` before trusting a screenshot.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
