const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Clerk's development `__clerk_db_jwt` cookie is host-scoped, not port-scoped,
 * so `localhost:8084` would share a session with the client, supplier and
 * rider apps on their own ports. Each Expo web app lives on its own
 * `*.localhost` host so the cookies stay apart (same rule as gridgo-rider).
 */
export const GRIDGO_DEV_WEB_HOST = "admin.localhost";

type DevWebLocation = {
  protocol: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
};

export function isolatedDevWebHref(location: DevWebLocation, isolatedHost: string): string | null {
  if (location.hostname === isolatedHost) return null;
  if (!LOOPBACK.has(location.hostname)) return null;
  const port = location.port ? `:${location.port}` : "";
  return `${location.protocol}//${isolatedHost}${port}${location.pathname}${location.search}${location.hash}`;
}

export function bounceToIsolatedDevWebHost(isolatedHost: string): boolean {
  if (typeof process !== "undefined" && process.env.JEST_WORKER_ID) return false;
  if (typeof __DEV__ !== "undefined" && !__DEV__) return false;
  if (typeof window === "undefined" || !window.location) return false;
  const href = isolatedDevWebHref(window.location, isolatedHost);
  if (!href) return false;
  window.location.replace(href);
  return true;
}
