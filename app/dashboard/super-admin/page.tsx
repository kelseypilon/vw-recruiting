import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SuperAdminDashboard from "./super-admin-dashboard";

export default async function SuperAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== "info@ajhazzi.com") {
    redirect("/dashboard");
  }

  return <SuperAdminDashboard />;
}
