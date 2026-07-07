import { redirect } from "next/navigation";
import { getOptionalCurrentUser } from "@/server/auth/current-user";
import { Landing } from "@/features/auth/landing";

/**
 * Purpose: Render public landing or redirect authenticated users to dashboard.
 * Inputs: Supabase SSR cookies.
 * Output: Landing page for guests.
 * Side effects: Redirects authenticated users.
 */
export default async function HomePage() {
  const user = await getOptionalCurrentUser();
  if (user) redirect("/dashboard");
  return <Landing />;
}
