import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

/**
 * POST /api/invites
 *
 * Actions:
 *   - create_invite: Create an invite token and send email
 *   - list_invites:  List pending invites for a team
 *   - accept_invite: Accept an invite, create Supabase user & users row
 *   - revoke_invite: Delete an invite token
 *   - validate_token: Check if a token is valid (public, no auth needed)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    const supabase = createAdminClient();

    // ── Validate Token (public — no auth required) ──────────────

    if (action === "validate_token") {
      const { token } = body;
      if (!token) {
        return NextResponse.json({ error: "Token is required" }, { status: 400 });
      }

      const { data: invite, error } = await supabase
        .from("invite_tokens")
        .select("id, email, role, team_id, expires_at, accepted_at")
        .eq("token", token)
        .single();

      if (error || !invite) {
        return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
      }

      if (invite.accepted_at) {
        return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
      }

      // Get team branding for the setup page
      const { data: team } = await supabase
        .from("teams")
        .select("name, brand_name, branding_mode, brand_logo_url, brand_primary_color, brand_secondary_color")
        .eq("id", invite.team_id)
        .single();

      return NextResponse.json({
        valid: true,
        invite: {
          email: invite.email,
          role: invite.role,
          team_id: invite.team_id,
          team_name: team?.brand_name ?? team?.name ?? "Team",
          team_logo: team?.brand_logo_url,
          primary_color: team?.brand_primary_color ?? "#1c759e",
        },
      });
    }

    // ── Protected actions (require auth + team access) ──────────
    // create_invite, list_invites, revoke_invite require authenticated user
    // who belongs to the target team OR is a super admin

    let authContext: { userId: string; email: string; teamId: string } | null = null;
    let isSuperAdmin = false;

    if (["create_invite", "list_invites", "revoke_invite"].includes(action)) {
      authContext = await verifyAuth();
      if (!authContext) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      // Check super admin status
      const { data: authUser } = await supabase
        .from("users")
        .select("is_super_admin")
        .eq("id", authContext.userId)
        .single();
      isSuperAdmin = authUser?.is_super_admin === true;

      // Verify team access: must belong to the target team or be super admin
      const targetTeamId = body.team_id;
      if (targetTeamId && targetTeamId !== authContext.teamId && !isSuperAdmin) {
        return NextResponse.json({ error: "You don't have access to this team" }, { status: 403 });
      }
    }

    // ── Create Invite ───────────────────────────────────────────

    if (action === "create_invite") {
      const { team_id, email, role } = body;
      if (!team_id || !email || !role) {
        return NextResponse.json(
          { error: "team_id, email, and role are required" },
          { status: 400 }
        );
      }

      // Check for existing pending invite
      const { data: existing } = await supabase
        .from("invite_tokens")
        .select("id")
        .eq("team_id", team_id)
        .eq("email", email)
        .is("accepted_at", null)
        .gte("expires_at", new Date().toISOString())
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "An active invite already exists for this email" },
          { status: 400 }
        );
      }

      // Create the invite token
      const { data: invite, error } = await supabase
        .from("invite_tokens")
        .insert({
          team_id,
          email: email.toLowerCase().trim(),
          role,
          invited_by: authContext?.userId ?? null,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Get team name for email
      const { data: team } = await supabase
        .from("teams")
        .select("name, brand_name")
        .eq("id", team_id)
        .single();

      const teamName = team?.brand_name ?? team?.name ?? "Your Team";
      const setupUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/setup/${invite.token}`;

      // Send invite email via Resend (if configured)
      let emailSent = false;
      let emailError: string | null = null;

      if (!resend) {
        emailError = "RESEND_API_KEY is not configured — invite created but email not sent";
        console.warn("[Invites]", emailError);
      } else {
        try {
          await resend.emails.send({
            from: `VW Recruiting <onboarding@resend.dev>`,
            to: email,
            subject: `You've been invited to join ${teamName}`,
            html: `
              <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
                <h2 style="color: #272727;">You've been invited!</h2>
                <p style="color: #555; line-height: 1.6;">
                  You've been invited to join <strong>${teamName}</strong> on VW Recruiting as a <strong>${role}</strong>.
                </p>
                <p style="margin: 24px 0;">
                  <a href="${setupUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1c759e; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
                    Accept Invite &amp; Set Up Account
                  </a>
                </p>
                <p style="color: #999; font-size: 12px;">
                  This invite expires in 7 days. If you didn't expect this email, you can ignore it.
                </p>
              </div>
            `,
          });
          emailSent = true;
        } catch (err) {
          emailError = err instanceof Error ? err.message : "Unknown email error";
          console.error("[Invites] Failed to send invite email:", emailError);
        }
      }

      return NextResponse.json({
        success: true,
        invite: { id: invite.id, token: invite.token, email: invite.email },
        setup_url: setupUrl,
        email_sent: emailSent,
        ...(emailError ? { email_warning: emailError } : {}),
      });
    }

    // ── List Invites ────────────────────────────────────────────

    if (action === "list_invites") {
      const { team_id } = body;
      if (!team_id) {
        return NextResponse.json({ error: "team_id is required" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("invite_tokens")
        .select("id, email, role, created_at, expires_at, accepted_at, invited_by")
        .eq("team_id", team_id)
        .order("created_at", { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ data });
    }

    // ── Revoke Invite ───────────────────────────────────────────

    if (action === "revoke_invite") {
      const { invite_id } = body;
      if (!invite_id) {
        return NextResponse.json({ error: "invite_id is required" }, { status: 400 });
      }

      const { error } = await supabase
        .from("invite_tokens")
        .delete()
        .eq("id", invite_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // ── Accept Invite ───────────────────────────────────────────

    if (action === "accept_invite") {
      const { token, name, password } = body;
      if (!token || !name || !password) {
        return NextResponse.json(
          { error: "token, name, and password are required" },
          { status: 400 }
        );
      }

      if (password.length < 6) {
        return NextResponse.json(
          { error: "Password must be at least 6 characters" },
          { status: 400 }
        );
      }

      // Validate token
      const { data: invite, error: invErr } = await supabase
        .from("invite_tokens")
        .select("*")
        .eq("token", token)
        .single();

      if (invErr || !invite) {
        return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
      }

      if (invite.accepted_at) {
        return NextResponse.json({ error: "This invite has already been used" }, { status: 400 });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: "This invite has expired" }, { status: 400 });
      }

      // Create Supabase auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: invite.email,
        password,
        email_confirm: true,
      });

      if (authError) {
        // If user already exists, try to link them
        if (authError.message?.includes("already been registered")) {
          // Get existing auth user by email
          let existingUser = null;
          let page = 1;
          const maxPages = 20;
          while (!existingUser && page <= maxPages) {
            const { data: pageData } = await supabase.auth.admin.listUsers({
              page,
              perPage: 50,
            });
            if (!pageData?.users?.length) break;
            existingUser =
              pageData.users.find(
                (u) => u.email?.toLowerCase() === invite.email.toLowerCase()
              ) ?? null;
            if (pageData.users.length < 50) break;
            page++;
          }

          if (existingUser) {
            // Check if they already have a users row for this team
            const { data: existingRow } = await supabase
              .from("users")
              .select("id")
              .eq("auth_id", existingUser.id)
              .eq("team_id", invite.team_id)
              .maybeSingle();

            if (existingRow) {
              // Mark invite accepted
              const { error: acceptErr } = await supabase
                .from("invite_tokens")
                .update({ accepted_at: new Date().toISOString() })
                .eq("id", invite.id);
              if (acceptErr) {
                console.error("Failed to mark invite accepted:", acceptErr.message);
              }
              return NextResponse.json({ error: "You already have an account for this team. Please log in." }, { status: 400 });
            }

            // Create the users row for this team
            const { error: linkErr } = await supabase.from("users").insert({
              auth_id: existingUser.id,
              team_id: invite.team_id,
              name,
              email: invite.email,
              role: invite.role,
            });

            if (linkErr) {
              return NextResponse.json({ error: `Failed to link account: ${linkErr.message}` }, { status: 500 });
            }

            // Mark invite accepted
            const { error: acceptErr } = await supabase
              .from("invite_tokens")
              .update({ accepted_at: new Date().toISOString() })
              .eq("id", invite.id);

            if (acceptErr) {
              console.error("Failed to mark invite accepted:", acceptErr.message);
            }

            return NextResponse.json({ success: true, message: "Account linked to team" });
          }
        }
        return NextResponse.json({ error: authError.message }, { status: 500 });
      }

      // Create the users row
      if (authData.user) {
        const { error: userErr } = await supabase.from("users").insert({
          auth_id: authData.user.id,
          team_id: invite.team_id,
          name,
          email: invite.email,
          role: invite.role,
        });

        if (userErr) {
          return NextResponse.json({ error: `Account created but user profile failed: ${userErr.message}` }, { status: 500 });
        }
      }

      // Mark invite accepted
      const { error: acceptErr } = await supabase
        .from("invite_tokens")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      if (acceptErr) {
        console.error("Failed to mark invite accepted:", acceptErr.message);
      }

      return NextResponse.json({ success: true, message: "Account created successfully" });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
