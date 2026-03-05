import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = createAdminClient();
  const TEAM_ID = "9bdd061b-8f89-4d08-bf19-bed29d129210";

  const usersToSeed = [
    { team_id: TEAM_ID, name: "AJ Hazzi", role: "Team Lead", email: "aj@vantagewestrealty.com" },
    { team_id: TEAM_ID, name: "Nick Hazzi", role: "Leader", email: "nick@vantagewestrealty.com" },
    { team_id: TEAM_ID, name: "Krista Milligan", role: "Leader", email: "krista@vantagewestrealty.com" },
    { team_id: TEAM_ID, name: "Brooklyn", role: "Admin", email: "brooklyn@vantagewestrealty.com" },
  ];

  // Check existing users to avoid duplicates
  const { data: existing } = await supabase
    .from("users")
    .select("email")
    .eq("team_id", TEAM_ID);

  const existingEmails = new Set((existing ?? []).map((u: { email: string }) => u.email));
  const newUsers = usersToSeed.filter((u) => !existingEmails.has(u.email));

  if (newUsers.length === 0) {
    // All already exist — fetch and return them
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("team_id", TEAM_ID)
      .order("name");
    return NextResponse.json({ message: "All users already exist", users: data });
  }

  const { data, error } = await supabase.from("users").insert(newUsers).select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seeded: data, count: data.length });
}
