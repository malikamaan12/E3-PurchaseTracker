import { redirect } from "next/navigation";

/**
 * Default Dashboard Router
 * Redirects to the request management view.
 */
export default function DashboardIndex() {
  return redirect("/dashboard/requests");
}
