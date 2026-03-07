import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyAuth } from "@/lib/api-auth";

/**
 * POST /api/onboarding/notify
 * Requires authenticated user session.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { team_id } = body;

    if (!team_id) {
      return NextResponse.json(
        { error: "team_id is required" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    // Fetch team brand name for email signature
    const { data: teamRow } = await supabase
      .from("teams")
      .select("brand_name, name")
      .eq("id", team_id)
      .single();
    const teamBrandName = teamRow?.brand_name || teamRow?.name || "Recruiting";

    // Fetch incomplete onboarding entries that are due today or overdue
    // Join to get task details, candidate info, and assigned user info
    const { data: entries, error: fetchError } = await supabase
      .from("candidate_onboarding")
      .select(
        `
        id,
        due_date,
        assigned_user_id,
        task:onboarding_tasks!inner(title, team_id),
        candidate:candidates!inner(first_name, last_name)
      `
      )
      .eq("task.team_id", team_id)
      .is("completed_at", null)
      .not("due_date", "is", null)
      .not("assigned_user_id", "is", null)
      .lte("due_date", today);

    if (fetchError) {
      return NextResponse.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({
        success: true,
        emails_sent: 0,
        message: "No overdue or due-today tasks found",
      });
    }

    // Group entries by assigned_user_id
    const byUser = new Map<
      string,
      {
        tasks: {
          candidateName: string;
          taskTitle: string;
          dueDate: string;
          isOverdue: boolean;
        }[];
      }
    >();

    for (const entry of entries) {
      const userId = entry.assigned_user_id as string;
      const task = entry.task as unknown as { title: string; team_id: string };
      const candidate = entry.candidate as unknown as {
        first_name: string;
        last_name: string;
      };

      if (!byUser.has(userId)) {
        byUser.set(userId, { tasks: [] });
      }

      byUser.get(userId)!.tasks.push({
        candidateName: `${candidate.first_name} ${candidate.last_name}`,
        taskTitle: task.title,
        dueDate: entry.due_date as string,
        isOverdue: entry.due_date! < today,
      });
    }

    // Fetch user emails for all assigned users
    const userIds = Array.from(byUser.keys());
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id, name, email")
      .in("id", userIds);

    if (usersError) {
      return NextResponse.json(
        { error: usersError.message },
        { status: 500 }
      );
    }

    const userMap = new Map(
      (users ?? []).map((u) => [u.id, { name: u.name, email: u.email }])
    );

    // Send one email per user
    let emailsSent = 0;
    const errors: string[] = [];

    for (const [userId, { tasks }] of byUser) {
      const user = userMap.get(userId);
      if (!user?.email) continue;

      // Sort: overdue first, then by date
      tasks.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return a.dueDate.localeCompare(b.dueDate);
      });

      const overdueCount = tasks.filter((t) => t.isOverdue).length;
      const dueTodayCount = tasks.length - overdueCount;

      const subject = overdueCount > 0
        ? `Onboarding Reminder: ${overdueCount} overdue task${overdueCount !== 1 ? "s" : ""}${dueTodayCount > 0 ? ` + ${dueTodayCount} due today` : ""}`
        : `Onboarding Reminder: ${dueTodayCount} task${dueTodayCount !== 1 ? "s" : ""} due today`;

      // Build plain-text email body
      const lines = [
        `Hi ${user.name},`,
        "",
        "Here are your outstanding onboarding tasks:",
        "",
      ];

      for (const t of tasks) {
        const dateFormatted = new Date(t.dueDate + "T00:00:00").toLocaleDateString(
          "en-US",
          { month: "short", day: "numeric" }
        );
        const label = t.isOverdue ? "OVERDUE" : "Due Today";
        lines.push(
          `  [${label}] ${t.taskTitle} — ${t.candidateName} (${dateFormatted})`
        );
      }

      lines.push(
        "",
        "Please log in to the dashboard to complete these tasks.",
        "",
        `— ${teamBrandName} Recruiting`
      );

      try {
        const res = await fetch(
          new URL("/api/send-email", req.url).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: user.email,
              subject,
              body: lines.join("\n"),
            }),
          }
        );

        const result = await res.json();
        if (result.error) {
          errors.push(`Failed to send to ${user.email}: ${result.error}`);
        } else {
          emailsSent++;
        }
      } catch (err) {
        errors.push(
          `Failed to send to ${user.email}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      emails_sent: emailsSent,
      total_tasks: entries.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
