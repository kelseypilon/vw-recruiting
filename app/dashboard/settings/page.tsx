import { createAdminClient } from "@/lib/supabase/admin";
import { getTeamId } from "@/lib/get-team-id";
import SettingsDashboard from "./settings-dashboard";
import type {
  Team,
  TeamUser,
  PipelineStage,
  EmailTemplate,
  ScoringCriterion,
} from "@/lib/types";

export default async function SettingsPage() {
  const supabase = createAdminClient();
  const TEAM_ID = await getTeamId();

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
