import { createClient } from "@/lib/supabase/server";
import TemplateEditor from "./template-editor";
import type { EmailTemplate } from "@/lib/types";

const TEAM_ID = "9bdd061b-8f89-4d08-bf19-bed29d129210";

export default async function TemplatesPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("email_templates")
    .select("*")
    .eq("team_id", TEAM_ID)
    .order("name");

  const templates: EmailTemplate[] = data ?? [];

  return <TemplateEditor templates={templates} teamId={TEAM_ID} />;
}
