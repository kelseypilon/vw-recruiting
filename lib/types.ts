export interface Team {
  id: string;
  name: string;
  slug: string | null;
  admin_email: string | null;
  admin_cc: boolean;
  group_interview_zoom_link: string | null;
  group_interview_date: string | null;
  settings: Record<string, unknown>;
  branding_mode: "vantage" | "white_label" | "custom";
  brand_name: string | null;
  brand_logo_url: string | null;
  brand_primary_color: string;
  brand_secondary_color: string;
  brand_show_powered_by: boolean;
  created_at: string;
}

export interface TeamBranding {
  mode: "vantage" | "white_label" | "custom";
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  primaryDark: string;
  primaryLight: string;
  showPoweredBy: boolean;
  initials: string;
}

export interface TeamUser {
  id: string;
  team_id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
  from_email: string | null;
  google_booking_url: string | null;
  scorecard_visibility: string;
  photo_url: string | null;
  notification_preferences: {
    email_reminders: boolean;
    digest: boolean;
  };
}

export interface PipelineStage {
  id: string;
  team_id: string;
  name: string;
  order_index: number;
  ghl_tag: string | null;
  color: string | null;
  is_active: boolean;
}

export interface Candidate {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  role_applied: string | null;
  is_licensed: boolean | null;
  years_experience: number | null;
  transactions_2024: number | null;
  current_role: string | null;
  heard_about: string | null;
  stage: string;
  disc_d: number | null;
  disc_i: number | null;
  disc_s: number | null;
  disc_c: number | null;
  disc_primary: string | null;
  disc_secondary: string | null;
  disc_meets_threshold: boolean | null;
  aq_raw: number | null;
  aq_normalized: number | null;
  aq_tier: string | null;
  composite_score: number | null;
  composite_verdict: string | null;
  current_brokerage: string | null;
  active_listings: number | null;
  website_url: string | null;
  resume_url: string | null;
  app_submitted_at: string | null;
  hire_type: string | null;
  interview_score: number | null;
  start_date: string | null;
  created_at: string;
}

export interface CandidateCard extends Candidate {
  daysInStage: number;
}

export interface CandidateNote {
  id: string;
  candidate_id: string;
  author_id: string;
  note_text: string;
  created_at: string;
  author?: { name: string; email: string };
}

export interface StageHistoryEntry {
  id: string;
  candidate_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string | null;
  created_at: string;
  changer?: { name: string } | null;
}

export interface Interview {
  id: string;
  team_id: string;
  candidate_id: string;
  interview_type: string;
  scheduled_at: string | null;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  created_at: string;
  candidate?: { first_name: string; last_name: string; role_applied: string | null; stage: string };
}

export interface ScoringCriterion {
  id: string;
  team_id: string;
  name: string;
  weight_percent: number;
  min_threshold: number | null;
  order_index: number;
}

export interface InterviewScore {
  id: string;
  candidate_id: string;
  evaluator_id: string;
  criterion_id: string;
  interview_id: string | null;
  score: number;
  notes: string | null;
  created_at: string;
  evaluator?: { name: string };
  criterion?: { name: string; weight_percent: number };
}

export interface OnboardingTask {
  id: string;
  team_id: string;
  title: string;
  owner_role: string;
  applies_to: string | null;
  timing: string | null;
  order_index: number;
  is_active: boolean;
  hire_type: string;
  stage: string | null;
  done_by: string | null;
  action_type: string;
  action_url: string | null;
  email_template_key: string | null;
  notes: string | null;
  default_assignee_id: string | null;
  due_offset_days: number | null;
  due_offset_anchor: string;
  default_assignee?: { name: string } | null;
}

export interface EmailTemplate {
  id: string;
  team_id: string;
  name: string;
  trigger: string | null;
  subject: string;
  body: string;
  merge_tags: string[];
  is_active: boolean;
}

export interface CandidateOnboarding {
  id: string;
  candidate_id: string;
  task_id: string;
  assigned_to: string | null;
  assigned_user_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  task?: OnboardingTask;
  assignee?: { name: string } | null;
  assigned_user?: { name: string } | null;
}

/* ── Interview Scorecard System ──────────────────────────────────── */

export interface InterviewQuestion {
  id: string;
  team_id: string;
  question_text: string;
  category: string;
  user_id: string | null;
  is_active: boolean;
  order_index: number;
  interviewer_note: string | null;
  sort_order: number;
  created_at: string;
}

export interface InterviewerQuestionSelection {
  user_id: string;
  question_id: string;
  team_id: string;
  is_active: boolean;
  sort_order: number;
}

export interface ScorecardAnswer {
  question_id: string;
  question_text: string;
  category: string;
  score: number | null;
  notes: string;
}

export interface InterviewScorecard {
  id: string;
  interview_id: string;
  interviewer_user_id: string;
  candidate_id: string;
  team_id: string;
  answers: ScorecardAnswer[];
  category_scores: Record<string, number>;
  overall_score: number | null;
  recommendation: string | null;
  summary_notes: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  evaluator?: { name: string };
}

export interface GroupInterviewSession {
  id: string;
  team_id: string;
  title: string;
  session_date: string | null;
  zoom_link: string | null;
  summary: string | null;
  general_notes: string | null;
  status: "upcoming" | "in_progress" | "completed";
  created_by: string | null;
  created_at: string;
  candidates?: { id: string; first_name: string; last_name: string; stage: string }[];
  creator?: { name: string };
  _candidate_count?: number;
}

export interface CandidateGroupSession {
  session_id: string;
  session: {
    id: string;
    title: string;
    session_date: string | null;
    status: string;
    created_by: string | null;
    creator?: { name: string };
  };
}

export interface InterviewInterviewer {
  interview_id: string;
  user_id: string;
  role: string;
  created_at: string;
  user?: { name: string; email: string };
}

export interface GroupInterviewPrompt {
  id: string;
  team_id: string;
  prompt_text: string;
  order_index: number;
  is_active: boolean;
  created_at: string;
}

export interface GroupInterviewNote {
  id: string;
  session_id: string;
  candidate_id: string;
  author_user_id: string;
  team_id: string;
  note_text: string;
  mentioned_ids: string[];
  created_at: string;
  updated_at: string;
  author?: { name: string };
}
