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
