import type { ApplicationFormField } from "./types";

/**
 * Default application form fields used when a team hasn't customized their form yet.
 * 16 fields matching the production spec. Sub-questions use show_if to reference
 * their parent field and only appear when the parent equals a specific value.
 */
export const DEFAULT_FORM_FIELDS: ApplicationFormField[] = [
  { id: "first_name", label: "First Name", type: "text", required: true, locked: true, order: 0 },
  { id: "last_name", label: "Last Name", type: "text", required: true, locked: true, order: 1 },
  { id: "email", label: "Email", type: "email", required: true, locked: true, order: 2 },
  { id: "phone", label: "Phone", type: "tel", required: true, locked: false, order: 3 },
  { id: "role_interested_in", label: "Role Interested In", type: "select", required: true, locked: false, order: 4, options: ["Outside Sales Agent", "Inside Sales Agent", "Showing Partner", "Intern", "Admin"] },
  { id: "info_night_date", label: "Date of Info Night Attended", type: "date", required: true, locked: false, order: 5 },
  { id: "licensed", label: "Do you have a real estate license?", type: "select", required: true, locked: false, order: 6, options: ["Yes", "No", "In Course"] },
  { id: "years_experience", label: "Years of Experience", type: "number", required: false, locked: false, order: 7, show_if: { field_id: "licensed", value: "Yes" } },
  { id: "transactions_last_year", label: "Transactions Closed Last Year", type: "number", required: false, locked: false, order: 8, show_if: { field_id: "licensed", value: "Yes" } },
  { id: "current_employment", label: "Current Employment", type: "text", required: true, locked: false, order: 9 },
  { id: "how_did_you_hear", label: "How did you hear about us?", type: "textarea", required: true, locked: false, order: 10 },
  { id: "what_stood_out", label: "What stood out to you about our company?", type: "textarea", required: true, locked: false, order: 11 },
  { id: "why_great_addition", label: "Why would you be a great addition to the team?", type: "textarea", required: true, locked: false, order: 12 },
  { id: "most_important", label: "What is the most important thing you want in your next role?", type: "textarea", required: true, locked: false, order: 13 },
  { id: "questions_answered", label: "Were all your questions answered at the info night?", type: "select", required: true, locked: false, order: 14, options: ["Yes", "No"] },
  { id: "additional_questions", label: "What additional questions do you have?", type: "textarea", required: false, locked: false, order: 15, show_if: { field_id: "questions_answered", value: "No" } },
];

/** Known field IDs that map to real candidate columns (not custom_fields). */
export const KNOWN_CANDIDATE_COLUMNS = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "role_interested_in",
  "info_night_date",
  "licensed",
  "years_experience",
  "transactions_last_year",
  "current_employment",
  "how_did_you_hear",
  "what_stood_out",
  "why_great_addition",
  "most_important",
  "questions_answered",
  "additional_questions",
  "current_role",
]);

/** Type badge labels for the form builder UI. */
export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  email: "Email",
  tel: "Phone",
  number: "Number",
  boolean: "Toggle",
  select: "Dropdown",
  textarea: "Long Text",
  date: "Date",
  interested_in: "Interest Tags",
};
