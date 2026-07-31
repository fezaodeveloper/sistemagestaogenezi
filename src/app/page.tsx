import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/dal";
import { roleHome } from "@/lib/auth/roles";

export default async function RootPage() {
  const profile = await getCurrentProfile();

  if (!profile) {
    redirect("/login");
  }

  redirect(roleHome(profile.role));
}
