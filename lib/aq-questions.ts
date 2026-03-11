/**
 * Stoltz Adversity Response Profile (ARP) — 20 Scenarios
 *
 * Each question has:
 *  - id: q1–q20
 *  - text: the scenario
 *  - category: C / O / R / E  (CORE dimension)
 *  - scaleLeft: label for value 1
 *  - scaleRight: label for value 5
 *
 * CORE Dimension Mapping:
 *   C (Control)    → q1, q7, q13, q15, q17
 *   O (Ownership)  → q2, q6, q11, q16, q18
 *   R (Reach)      → q3, q5, q9, q12, q20
 *   E (Endurance)  → q4, q8, q10, q14, q19
 *
 * ARP Score = (C + O + R + E) × 2  →  range 40–200, population avg ~147.5
 */

export interface AQQuestion {
  id: string;
  text: string;
  category: "C" | "O" | "R" | "E";
  scaleLeft: string;   // label for 1
  scaleRight: string;  // label for 5
}

export const AQ_QUESTIONS: AQQuestion[] = [
  { id: "q1",  text: "You suffer a financial setback.",                                                    category: "C", scaleLeft: "Not at all",              scaleRight: "Completely" },
  { id: "q2",  text: "You are overlooked for a promotion.",                                                category: "O", scaleLeft: "Not responsible at all",   scaleRight: "Completely responsible" },
  { id: "q3",  text: "You are criticized for a big project that you just completed.",                      category: "R", scaleLeft: "Affect all aspects of my life", scaleRight: "Be limited to this situation" },
  { id: "q4",  text: "You accidentally delete an important email.",                                        category: "E", scaleLeft: "Last forever",             scaleRight: "Quickly pass" },
  { id: "q5",  text: "The high-priority project you are working on gets canceled.",                        category: "R", scaleLeft: "Affect all aspects of my life", scaleRight: "Be limited to this situation" },
  { id: "q6",  text: "Someone you respect ignores your attempt to discuss an important issue.",            category: "O", scaleLeft: "Not responsible at all",   scaleRight: "Completely responsible" },
  { id: "q7",  text: "People respond unfavorably to your latest ideas.",                                   category: "C", scaleLeft: "Not at all",              scaleRight: "Completely" },
  { id: "q8",  text: "You are unable to take a much-needed vacation.",                                     category: "E", scaleLeft: "Last forever",             scaleRight: "Quickly pass" },
  { id: "q9",  text: "You hit every red light on your way to an important appointment.",                   category: "R", scaleLeft: "Affect all aspects of my life", scaleRight: "Be limited to this situation" },
  { id: "q10", text: "After extensive searching, you cannot find an important document.",                   category: "E", scaleLeft: "Last forever",             scaleRight: "Quickly pass" },
  { id: "q11", text: "Your workplace is understaffed.",                                                     category: "O", scaleLeft: "Not responsible at all",   scaleRight: "Completely responsible" },
  { id: "q12", text: "You miss an important appointment.",                                                  category: "R", scaleLeft: "Affect all aspects of my life", scaleRight: "Be limited to this situation" },
  { id: "q13", text: "Your personal and work obligations are out of balance.",                              category: "C", scaleLeft: "Not at all",              scaleRight: "Completely" },
  { id: "q14", text: "You never seem to have enough money.",                                                category: "E", scaleLeft: "Last forever",             scaleRight: "Quickly pass" },
  { id: "q15", text: "You are not exercising regularly though you know you should.",                        category: "C", scaleLeft: "Not at all",              scaleRight: "Completely" },
  { id: "q16", text: "Your organization is not meeting its goals.",                                         category: "O", scaleLeft: "Not responsible at all",   scaleRight: "Completely responsible" },
  { id: "q17", text: "Your computer crashed for the third time this week.",                                 category: "C", scaleLeft: "Not at all",              scaleRight: "Completely" },
  { id: "q18", text: "The meeting you are in is a total waste of time.",                                    category: "O", scaleLeft: "Not responsible at all",   scaleRight: "Completely responsible" },
  { id: "q19", text: "You lost something that is important to you.",                                        category: "E", scaleLeft: "Last forever",             scaleRight: "Quickly pass" },
  { id: "q20", text: "Your boss adamantly disagrees with your decision.",                                   category: "R", scaleLeft: "Affect all aspects of my life", scaleRight: "Be limited to this situation" },
];

export const AQ_CATEGORY_LABELS: Record<string, string> = {
  C: "Control",
  O: "Ownership",
  R: "Reach",
  E: "Endurance",
};

/**
 * Maps CORE dimensions to their question IDs for scoring.
 */
export const CORE_DIMENSION_QUESTIONS: Record<string, string[]> = {
  C: ["q1", "q7", "q13", "q15", "q17"],
  O: ["q2", "q6", "q11", "q16", "q18"],
  R: ["q3", "q5", "q9", "q12", "q20"],
  E: ["q4", "q8", "q10", "q14", "q19"],
};
