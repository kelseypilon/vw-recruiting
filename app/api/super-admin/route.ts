import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

async function verifySuper(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Check is_super_admin column
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("is_super_admin")
    .eq("email", user.email ?? "")
    .eq("is_super_admin", true)
    .maybeSingle();

  if (!profile) return null;
  return user;
}

/**
 * GET /api/super-admin — list all teams with user counts
 */
export async function GET(req: NextRequest) {
  const user = await verifySuper(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: teams, error } = await admin
    .from("teams")
    .select("*")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch user counts per team
  const { data: userCounts } = await admin
    .from("users")
    .select("team_id");

  const countMap: Record<string, number> = {};
  for (const u of userCounts ?? []) {
    countMap[u.team_id] = (countMap[u.team_id] || 0) + 1;
  }

  const teamsWithCounts = (teams ?? []).map((t) => ({
    ...t,
    user_count: countMap[t.id] || 0,
  }));

  return NextResponse.json({ data: teamsWithCounts });
}

/**
 * PUT /api/super-admin — update team branding
 * Body: { team_id, branding_mode, brand_name, brand_logo_url, brand_primary_color, brand_secondary_color, brand_show_powered_by }
 */
export async function PUT(req: NextRequest) {
  const user = await verifySuper(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { team_id, ...fields } = body;

  if (!team_id) {
    return NextResponse.json(
      { error: "team_id is required" },
      { status: 400 }
    );
  }

  // Only allow known branding fields
  const allowed = [
    "branding_mode",
    "brand_name",
    "brand_logo_url",
    "brand_primary_color",
    "brand_secondary_color",
    "brand_show_powered_by",
    "slug",
    "name",
  ];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in fields) updates[key] = fields[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("teams")
    .update(updates)
    .eq("id", team_id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

/**
 * POST /api/super-admin — create a new team + first admin user
 * Body: { name, slug, admin_email, branding_mode }
 */
export async function POST(req: NextRequest) {
  const user = await verifySuper(req);
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { name, slug, admin_email, branding_mode } = body;

  if (!name || !admin_email) {
    return NextResponse.json(
      { error: "name and admin_email are required" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Create team
  const teamSlug =
    slug ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const { data: team, error: teamError } = await admin
    .from("teams")
    .insert({
      name,
      slug: teamSlug,
      admin_email,
      branding_mode: branding_mode || "custom",
      brand_name: name,
      brand_primary_color: body.brand_primary_color || "#1c759e",
      brand_secondary_color: body.brand_secondary_color || "#272727",
      brand_show_powered_by: true,
    })
    .select()
    .single();

  if (teamError) {
    return NextResponse.json({ error: teamError.message }, { status: 500 });
  }

  // Create first user (owner role)
  const { error: userError } = await admin.from("users").insert({
    team_id: team.id,
    name: admin_email.split("@")[0],
    email: admin_email,
    role: "owner",
  });

  if (userError) {
    return NextResponse.json(
      { error: `Team created but user creation failed: ${userError.message}` },
      { status: 500 }
    );
  }

  // Seed default pipeline stages
  const defaultStages = [
    { name: "New Lead",        order_index: 1, ghl_tag: "new-lead",        color: "#6B7280", is_active: true },
    { name: "Application Sent",order_index: 2, ghl_tag: "app-sent",        color: "#3B82F6", is_active: true },
    { name: "Under Review",    order_index: 3, ghl_tag: "under-review",    color: "#8B5CF6", is_active: true },
    { name: "Group Interview", order_index: 4, ghl_tag: "group-interview", color: "#F59E0B", is_active: true },
    { name: "1on1 Interview",  order_index: 5, ghl_tag: "1on1-interview",  color: "#EF4444", is_active: true },
    { name: "Offer",           order_index: 6, ghl_tag: "offer",           color: "#10B981", is_active: true },
    { name: "Onboarding",      order_index: 7, ghl_tag: "onboarding",      color: "#059669", is_active: true },
    { name: "Not a Fit",       order_index: 8, ghl_tag: "not-a-fit",       color: "#DC2626", is_active: true },
  ];

  await admin.from("pipeline_stages").insert(
    defaultStages.map((s) => ({ team_id: team.id, ...s }))
  );

  // Auto-add Kelsey's super admin accounts to every new team
  const superAdminEmails = ["kelsey@kelseypilon.com", "kelseylpilon@gmail.com"];
  for (const saEmail of superAdminEmails) {
    // Skip if this email is already the admin_email (already added above)
    if (saEmail.toLowerCase() === admin_email.toLowerCase()) continue;

    // Check if this user already exists in this team
    const { data: existingUser } = await admin
      .from("users")
      .select("id")
      .eq("team_id", team.id)
      .eq("email", saEmail)
      .maybeSingle();

    if (!existingUser) {
      await admin.from("users").insert({
        team_id: team.id,
        name: "Kelsey Pilon",
        email: saEmail,
        role: "Admin",
        is_super_admin: true,
      });
    }
  }

  return NextResponse.json({ data: team });
}
