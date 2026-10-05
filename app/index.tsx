import { useAuth } from "@clerk/expo";
import { Redirect, type Href } from "expo-router";

import { accessTabs } from "@/lib/access";
import { useSession } from "@/store/session";

/**
 * `/` — where the app opens, and where an invite link hands off to. Each
 * destination is also guarded in `app/_layout.tsx`; this only picks one.
 */
export default function Index() {
  const { isSignedIn } = useAuth();
  const phase = useSession((state) => state.phase);
  const access = useSession((state) => state.access);

  if (!isSignedIn) return <Redirect href="/sign-in" />;
  if (phase !== "ready") return <Redirect href="/checking" />;
  if (access?.kind !== "granted") return <Redirect href="/invite" />;
  return <Redirect href={landingRoute(accessTabs(access))} />;
}

function landingRoute(tabs: ReturnType<typeof accessTabs>): Href {
  if (tabs.scan) return "/scan";
  if (tabs.handovers) return "/handovers";
  if (tabs.admin) return "/admin";
  return "/account";
}
