import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import SuperAdminDashboard from "./super-admin-dashboard";

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Check is_super_admin column
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("is_super_admin")
    .eq("email", user.email ?? "")
    .eq("is_super_admin", true)
    .maybeSingle();

  if (!profile) {
    redirect("/dashboard");
  }

  return <SuperAdminDashboard />;
}
