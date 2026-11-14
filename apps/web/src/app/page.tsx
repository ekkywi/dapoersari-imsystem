import { redirect } from "next/navigation";

/**
 * The old landing page is folded into /login (service status, date and clock live in its left
 * panel). Signed-in visitors are bounced on to /app by the login page itself, because the session
 * lives in localStorage and the server cannot see it.
 */
export default function HomePage() {
  redirect("/login");
}
