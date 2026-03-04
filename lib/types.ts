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
  app_submitted_at: string | null;
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
}

export interface CandidateOnboarding {
  id: string;
  candidate_id: string;
  task_id: string;
  assigned_to: string | null;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  task?: OnboardingTask;
  assignee?: { name: string } | null;
}
