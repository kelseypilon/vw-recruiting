import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Resend } from "resend";

/**
 * POST /api/notifications
 *
 * Automated notification processing endpoint.
 * Three triggers:
 * 1. No scorecard submitted after completed interview
 * 2. Hold follow-up date reached
 * 3. Candidate stuck in interview stage
 *
 * Each trigger has escalation levels. Duplicates are prevented via notifications_log.
 *
 * Auth: requires either a super-admin session or a CRON_SECRET header.
 */

async function verifyCaller(): Promise<boolean> {
  // Allow cron jobs via secret header
  // (checked at call site via req.headers)

  // Otherwise check for super-admin session
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("users")
      .select("is_super_admin")
      .eq("email", user.email ?? "")
      .eq("is_super_admin", true)
      .maybeSingle();

    return !!profile;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Auth: accept CRON_SECRET header or super-admin session
    const cronSecret = process.env.CRON_SECRET;
    const headerSecret = req.headers.get("x-cron-secret");
    const isCron = cronSecret && headerSecret === cronSecret;

    if (!isCron) {
      const isSuperAdmin = await verifyCaller();
      if (!isSuperAdmin) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await req.json().catch(() => ({}));
    const teamId = body.team_id;

    if (!teamId) {
      return NextResponse.json({ error: "team_id is required" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 500 });
    }
    const resend = new Resend(apiKey);

    // Fetch team settings
    const { data: team } = await supabase
      .from("teams")
      .select("id, name, threshold_stuck_days, threshold_scorecard_hours, threshold_escalation_hours, admin_email")
      .eq("id", teamId)
      .single();

    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Fetch escalation contact for the team
    const { data: escalationUsers } = await supabase
      .from("users")
      .select("id, name, email")
      .eq("team_id", teamId)
      .eq("is_escalation_contact", true)
      .eq("is_active", true);

    const escalationContact = escalationUsers?.[0] ?? null;

    const results: { trigger: string; sent: number; skipped: number }[] = [];

    // ── Trigger 1: No scorecard after completed interview ──
    const trigger1Result = await processNoScorecardTrigger(
      supabase, resend, team, escalationContact
    );
    results.push(trigger1Result);

    // ── Trigger 2: Hold follow-up date reached ──
    const trigger2Result = await processHoldFollowUpTrigger(
      supabase, resend, team, escalationContact
    );
    results.push(trigger2Result);

    // ── Trigger 3: Candidate stuck in interview stage ──
    const trigger3Result = await processStuckCandidateTrigger(
      supabase, resend, team, escalationContact
    );
    results.push(trigger3Result);

    return NextResponse.json({ success: true, results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Helpers ──

interface TeamData {
  id: string;
  name: string;
  threshold_stuck_days: number;
  threshold_scorecard_hours: number;
  threshold_escalation_hours: number;
  admin_email: string | null;
}

interface EscalationUser {
  id: string;
  name: string;
  email: string;
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

async function hasBeenNotified(
  supabase: SupabaseAdmin,
  teamId: string,
  type: string,
  interviewId: string | null,
  candidateId: string | null,
  escalationLevel: number
): Promise<boolean> {
  let query = supabase
    .from("notifications_log")
    .select("id")
    .eq("team_id", teamId)
    .eq("type", type)
    .eq("escalation_level", escalationLevel);

  if (interviewId) query = query.eq("interview_id", interviewId);
  if (candidateId) query = query.eq("candidate_id", candidateId);

  const { data } = await query.limit(1);
  return (data?.length ?? 0) > 0;
}

async function logNotification(
  supabase: SupabaseAdmin,
  teamId: string,
  type: string,
  sentToEmail: string,
  escalationLevel: number,
  candidateId?: string | null,
  interviewId?: string | null
) {
  await supabase.from("notifications_log").insert({
    team_id: teamId,
    type,
    candidate_id: candidateId ?? null,
    interview_id: interviewId ?? null,
    sent_to_email: sentToEmail,
    escalation_level: escalationLevel,
  });
}

async function sendEmail(
  resend: InstanceType<typeof Resend>,
  to: string,
  subject: string,
  body: string,
  cc?: string
): Promise<boolean> {
  const payload: { from: string; to: string[]; subject: string; text: string; cc?: string[] } = {
    from: "noreply@recruiting.app",
    to: [to],
    subject,
    text: body,
  };
  if (cc) payload.cc = [cc];

  const result = await resend.emails.send(payload as Parameters<typeof resend.emails.send>[0]);
  // Return false if the email failed to send so we don't log it as "sent"
  if (result.error) return false;
  return true;
}

// ── Trigger 1: No scorecard after completed interview ──

async function processNoScorecardTrigger(
  supabase: SupabaseAdmin,
  resend: InstanceType<typeof Resend>,
  team: TeamData,
  escalationContact: EscalationUser | null
) {
  let sent = 0;
  let skipped = 0;

  // Find completed interviews with no scorecard
  const { data: interviews } = await supabase
    .from("interviews")
    .select(`
      id, candidate_id, interview_type, status, scheduled_at, created_at,
      candidate:candidates!inner(first_name, last_name),
      interviewers:interview_interviewers(user_id, user:users(name, email))
    `)
    .eq("team_id", team.id)
    .eq("status", "completed");

  if (!interviews) return { trigger: "no_scorecard", sent, skipped };

  const now = new Date();

  for (const interview of interviews) {
    // Check if any scorecard exists for this interview
    const { data: scorecards } = await supabase
      .from("interview_scorecards")
      .select("id")
      .eq("interview_id", interview.id)
      .not("submitted_at", "is", null)
      .limit(1);

    if (scorecards && scorecards.length > 0) {
      skipped++;
      continue;
    }

    const completedAt = new Date(interview.scheduled_at || interview.created_at);
    const hoursSince = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
    const cand = interview.candidate as unknown as { first_name: string; last_name: string };
    const candidateName = `${cand.first_name} ${cand.last_name}`;

    // Get primary interviewer
    const interviewersList = interview.interviewers as unknown as Array<{
      user_id: string;
      user: { name: string; email: string };
    }>;
    const primaryInterviewer = interviewersList?.[0]?.user;

    // Level 1: After threshold_scorecard_hours → email interviewer
    if (hoursSince >= team.threshold_scorecard_hours) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "no_scorecard", interview.id, null, 1);
      if (!alreadySent && primaryInterviewer) {
        const emailSent = await sendEmail(
          resend,
          primaryInterviewer.email,
          `Scorecard reminder: ${candidateName}`,
          `Hi ${primaryInterviewer.name},\n\nA scorecard is needed for your interview with ${candidateName} (${interview.interview_type}). It has been ${Math.round(hoursSince)} hours since the interview.\n\nPlease submit your scorecard as soon as possible.\n\n— ${team.name} Recruiting`
        );
        if (emailSent) {
          await logNotification(supabase, team.id, "no_scorecard", primaryInterviewer.email, 1, interview.candidate_id, interview.id);
          sent++;
        } else { skipped++; }
      } else {
        skipped++;
      }
    }

    // Level 2: After threshold_escalation_hours → email escalation contact
    if (hoursSince >= team.threshold_escalation_hours && escalationContact) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "no_scorecard", interview.id, null, 2);
      if (!alreadySent) {
        const emailSent = await sendEmail(
          resend,
          escalationContact.email,
          `Escalation: Missing scorecard for ${candidateName}`,
          `Hi ${escalationContact.name},\n\nNo scorecard has been submitted for ${candidateName} after ${Math.round(hoursSince)} hours.\n\nInterviewer: ${primaryInterviewer?.name ?? "Unknown"}\nInterview type: ${interview.interview_type}\n\nPlease follow up with the interviewer.\n\n— ${team.name} Recruiting`
        );
        if (emailSent) {
          await logNotification(supabase, team.id, "no_scorecard", escalationContact.email, 2, interview.candidate_id, interview.id);
          sent++;
        } else { skipped++; }
      } else {
        skipped++;
      }
    }

    // Level 3: After 72 hours → final escalation
    if (hoursSince >= 72 && escalationContact) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "no_scorecard", interview.id, null, 3);
      if (!alreadySent) {
        const emailSent = await sendEmail(
          resend,
          escalationContact.email,
          `URGENT: Scorecard still missing for ${candidateName}`,
          `Hi ${escalationContact.name},\n\nThis is a final reminder. No scorecard has been submitted for ${candidateName} after ${Math.round(hoursSince)} hours.\n\nImmediate attention is required.\n\n— ${team.name} Recruiting`
        );
        if (emailSent) {
          await logNotification(supabase, team.id, "no_scorecard", escalationContact.email, 3, interview.candidate_id, interview.id);
          sent++;
        } else { skipped++; }
      } else {
        skipped++;
      }
    }
  }

  return { trigger: "no_scorecard", sent, skipped };
}

// ── Trigger 2: Hold follow-up date reached ──

async function processHoldFollowUpTrigger(
  supabase: SupabaseAdmin,
  resend: InstanceType<typeof Resend>,
  team: TeamData,
  escalationContact: EscalationUser | null
) {
  let sent = 0;
  let skipped = 0;

  const today = new Date().toISOString().split("T")[0];

  // Find interviews on hold with follow-up dates
  const { data: holdInterviews } = await supabase
    .from("interviews")
    .select(`
      id, candidate_id, hold_reason, hold_follow_up_date, hold_set_at, hold_escalation_level,
      candidate:candidates!inner(first_name, last_name),
      interviewers:interview_interviewers(user_id, user:users(name, email))
    `)
    .eq("team_id", team.id)
    .eq("status", "hold")
    .lte("hold_follow_up_date", today);

  if (!holdInterviews) return { trigger: "hold_followup", sent, skipped };

  const now = new Date();

  for (const interview of holdInterviews) {
    const followUpDate = new Date(interview.hold_follow_up_date + "T00:00:00");
    const daysSinceFollowUp = (now.getTime() - followUpDate.getTime()) / (1000 * 60 * 60 * 24);
    const cand = interview.candidate as unknown as { first_name: string; last_name: string };
    const candidateName = `${cand.first_name} ${cand.last_name}`;

    const interviewersList = interview.interviewers as unknown as Array<{
      user_id: string;
      user: { name: string; email: string };
    }>;
    const holder = interviewersList?.[0]?.user;

    // Level 1: Follow-up date reached → email holder
    if (daysSinceFollowUp >= 0) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "hold_followup", interview.id, null, 1);
      if (!alreadySent && holder) {
        const emailSent = await sendEmail(
          resend,
          holder.email,
          `Follow-up: ${candidateName} is on hold`,
          `Hi ${holder.name},\n\nThe follow-up date has arrived for ${candidateName} who was placed on hold.\n\nHold reason: ${interview.hold_reason}\n\nPlease take action on this candidate.\n\n— ${team.name} Recruiting`
        );
        if (emailSent) {
          await logNotification(supabase, team.id, "hold_followup", holder.email, 1, interview.candidate_id, interview.id);
          sent++;
        } else { skipped++; }
      } else {
        skipped++;
      }
    }

    // Level 2: +3 days → email holder + CC escalation
    if (daysSinceFollowUp >= 3 && holder) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "hold_followup", interview.id, null, 2);
      if (!alreadySent) {
        const emailSent = await sendEmail(
          resend,
          holder.email,
          `Reminder: ${candidateName} hold follow-up overdue`,
          `Hi ${holder.name},\n\n${candidateName} has been on hold past the follow-up date by ${Math.round(daysSinceFollowUp)} days.\n\nPlease resolve this hold.\n\n— ${team.name} Recruiting`,
          escalationContact?.email
        );
        if (emailSent) {
          await logNotification(supabase, team.id, "hold_followup", holder.email, 2, interview.candidate_id, interview.id);
          sent++;
        } else { skipped++; }
      } else {
        skipped++;
      }
    }

    // Level 3: +8 days → escalation contact only
    if (daysSinceFollowUp >= 8 && escalationContact) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "hold_followup", interview.id, null, 3);
      if (!alreadySent) {
        const emailSent = await sendEmail(
          resend,
          escalationContact.email,
          `URGENT: ${candidateName} hold unresolved for ${Math.round(daysSinceFollowUp)} days`,
          `Hi ${escalationContact.name},\n\n${candidateName} has been on hold for ${Math.round(daysSinceFollowUp)} days past the follow-up date.\n\nOriginal holder: ${holder?.name ?? "Unknown"}\nHold reason: ${interview.hold_reason}\n\nImmediate action required.\n\n— ${team.name} Recruiting`
        );
        if (emailSent) {
          await logNotification(supabase, team.id, "hold_followup", escalationContact.email, 3, interview.candidate_id, interview.id);
          await supabase.from("interviews").update({ hold_escalation_level: 3 }).eq("id", interview.id);
          sent++;
        } else { skipped++; }
      } else {
        skipped++;
      }
    }
  }

  return { trigger: "hold_followup", sent, skipped };
}

// ── Trigger 3: Candidate stuck in interview stage ──

async function processStuckCandidateTrigger(
  supabase: SupabaseAdmin,
  resend: InstanceType<typeof Resend>,
  team: TeamData,
  escalationContact: EscalationUser | null
) {
  let sent = 0;
  let skipped = 0;

  // Get interview stage names
  const { data: interviewStages } = await supabase
    .from("pipeline_stages")
    .select("name")
    .eq("team_id", team.id)
    .ilike("name", "%interview%");

  const stageNames = interviewStages?.map((s) => s.name) ?? [];
  if (stageNames.length === 0) return { trigger: "stuck_candidate", sent, skipped };

  // Find candidates in interview stages
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id, first_name, last_name, stage, created_at")
    .eq("team_id", team.id)
    .in("stage", stageNames);

  if (!candidates) return { trigger: "stuck_candidate", sent, skipped };

  const now = new Date();

  for (const candidate of candidates) {
    // Get latest stage history entry for current stage
    const { data: stageHistory } = await supabase
      .from("stage_history")
      .select("created_at")
      .eq("candidate_id", candidate.id)
      .eq("to_stage", candidate.stage)
      .order("created_at", { ascending: false })
      .limit(1);

    const enteredStageAt = stageHistory?.[0]?.created_at
      ? new Date(stageHistory[0].created_at)
      : new Date(candidate.created_at);

    const daysInStage = (now.getTime() - enteredStageAt.getTime()) / (1000 * 60 * 60 * 24);
    const candidateName = `${candidate.first_name} ${candidate.last_name}`;

    // Level 1: After threshold_stuck_days → yellow flag (log only, visual in kanban)
    if (daysInStage >= team.threshold_stuck_days) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "stuck_candidate", null, candidate.id, 1);
      if (!alreadySent) {
        await logNotification(supabase, team.id, "stuck_candidate", "system", 1, candidate.id, null);
        sent++;
      } else {
        skipped++;
      }
    }

    // Level 2: +3 days → email escalation contact
    if (daysInStage >= team.threshold_stuck_days + 3 && escalationContact) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "stuck_candidate", null, candidate.id, 2);
      if (!alreadySent) {
        const emailSent = await sendEmail(
          resend,
          escalationContact.email,
          `Stuck candidate: ${candidateName}`,
          `Hi ${escalationContact.name},\n\n${candidateName} has been in the "${candidate.stage}" stage for ${Math.round(daysInStage)} days (threshold: ${team.threshold_stuck_days} days).\n\nPlease review this candidate's status.\n\n— ${team.name} Recruiting`
        );
        if (emailSent) {
          await logNotification(supabase, team.id, "stuck_candidate", escalationContact.email, 2, candidate.id, null);
          sent++;
        } else { skipped++; }
      } else {
        skipped++;
      }
    }

    // Level 3: +7 days → urgent red flag
    if (daysInStage >= team.threshold_stuck_days + 7 && escalationContact) {
      const alreadySent = await hasBeenNotified(supabase, team.id, "stuck_candidate", null, candidate.id, 3);
      if (!alreadySent) {
        const emailSent = await sendEmail(
          resend,
          escalationContact.email,
          `URGENT: ${candidateName} stuck for ${Math.round(daysInStage)} days`,
          `Hi ${escalationContact.name},\n\n${candidateName} has been stuck in "${candidate.stage}" for ${Math.round(daysInStage)} days. This requires urgent attention.\n\n— ${team.name} Recruiting`
        );
        if (emailSent) {
          await logNotification(supabase, team.id, "stuck_candidate", escalationContact.email, 3, candidate.id, null);
          sent++;
        } else { skipped++; }
      } else {
        skipped++;
      }
    }
  }

  return { trigger: "stuck_candidate", sent, skipped };
}
