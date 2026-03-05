import { createClient } from "@/lib/supabase/server";
import { getTeamId } from "@/lib/get-team-id";
import TemplateEditor from "./template-editor";
import type { EmailTemplate } from "@/lib/types";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const TEAM_ID = await getTeamId();

  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .eq("team_id", TEAM_ID)
    .order("name");

  const templates: EmailTemplate[] = data ?? [];

  return <TemplateEditor templates={templates} teamId={TEAM_ID} />;
}
