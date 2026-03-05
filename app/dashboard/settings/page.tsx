import { createClient } from "@/lib/supabase/server";
import SettingsDashboard from "./settings-dashboard";
import type {
  Team,
  TeamUser,
  PipelineStage,
  EmailTemplate,
  ScoringCriterion,
} from "@/lib/types";

const TEAM_ID = "9bdd061b-8f89-4d08-bf19-bed29d129210";

export default async function SettingsPage() {
  const supabase = await createClient();

  const [teamResult, usersResult, stagesResult, templatesResult, criteriaResult] =
    await Promise.all([
      supabase.from("teams").select("*").eq("id", TEAM_ID).single(),
      supabase.from("users").select("*").eq("team_id", TEAM_ID).order("name"),
      supabase
        .from("pipeline_stages")
        .select("*")
        .eq("team_id", TEAM_ID)
        .order("order_index"),
      supabase
        .from("email_templates")
        .select("*")
        .eq("team_id", TEAM_ID)
        .order("name"),
      supabase
        .from("scoring_criteria")
        .select("*")
        .eq("team_id", TEAM_ID)
        .order("order_index"),
    ]);

  return (
    <SettingsDashboard
      team={(teamResult.data as Team) ?? null}
      users={(usersResult.data as TeamUser[]) ?? []}
      stages={(stagesResult.data as PipelineStage[]) ?? []}
      templates={(templatesResult.data as EmailTemplate[]) ?? []}
      criteria={(criteriaResult.data as ScoringCriterion[]) ?? []}
      teamId={TEAM_ID}
    />
  );
}
