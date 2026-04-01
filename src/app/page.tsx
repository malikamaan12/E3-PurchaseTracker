import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Root Router
 * Handles initial entry and redirects to the appropriate experience.
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token");

  if (token) {
    // Authenticated - move to the request dashboard
    return redirect("/dashboard/requests");
  }

  // Not authenticated - go to the custom auth hub
  return redirect("/auth");
}
