import { cookies } from "next/headers";

const DEFAULT_TEAM_ID = "9bdd061b-8f89-4d08-bf19-bed29d129210";

export async function getTeamId(): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get("vw_team_id")?.value ?? DEFAULT_TEAM_ID;
}
