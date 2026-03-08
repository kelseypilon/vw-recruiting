import type { PipelineStage } from "./types";

/**
 * Well-known ghl_tag values used for programmatic stage identification.
 * These allow stage names to be customized while keeping behavior intact.
 */
export const STAGE_TAGS = {
  NEW_LEAD: "vw_new_lead",
  GROUP_INTERVIEW: "vw_group_interview",
  ONE_ON_ONE: "vw_1on1_interview",
  NOT_A_FIT: "vw_not_fit",
  OFFER: "vw_offer",
  ONBOARDING: "vw_onboarding",
  HIRED: "vw_hired",
} as const;

/** Returns the stage name for a given ghl_tag, or the fallback if not found. */
export function stageNameByTag(
  stages: PipelineStage[],
  tag: string,
  fallback = ""
): string {
  return stages.find((s) => s.ghl_tag === tag)?.name ?? fallback;
}

/** Returns stage names matching any of the given ghl_tags. */
export function stageNamesByTags(
  stages: PipelineStage[],
  tags: string[]
): string[] {
  const tagSet = new Set(tags);
  return stages.filter((s) => s.ghl_tag && tagSet.has(s.ghl_tag)).map((s) => s.name);
}

/** Check if a stage name matches a specific ghl_tag. */
export function isStageTag(
  stages: PipelineStage[],
  stageName: string,
  tag: string
): boolean {
  const stage = stages.find((s) => s.name === stageName);
  return stage?.ghl_tag === tag;
}

/** Get all interview stage names (group + 1on1). */
export function getInterviewStageNames(stages: PipelineStage[]): string[] {
  return stageNamesByTags(stages, [STAGE_TAGS.GROUP_INTERVIEW, STAGE_TAGS.ONE_ON_ONE]);
}

/** Check if a stage name is an interview stage. */
export function isInterviewStage(stages: PipelineStage[], stageName: string): boolean {
  return isStageTag(stages, stageName, STAGE_TAGS.GROUP_INTERVIEW) ||
    isStageTag(stages, stageName, STAGE_TAGS.ONE_ON_ONE);
}

/** Check if a stage name is the group interview stage. */
export function isGroupInterviewStage(stages: PipelineStage[], stageName: string): boolean {
  return isStageTag(stages, stageName, STAGE_TAGS.GROUP_INTERVIEW);
}
