import type { ApplicationFormField } from "./types";

/**
 * Default application form fields used when a team hasn't customized their form yet.
 */
export const DEFAULT_FORM_FIELDS: ApplicationFormField[] = [
  { id: "first_name", label: "First Name", type: "text", required: true, locked: true, order: 0 },
  { id: "last_name", label: "Last Name", type: "text", required: true, locked: true, order: 1 },
  { id: "email", label: "Email", type: "email", required: true, locked: true, order: 2 },
  { id: "phone", label: "Phone", type: "tel", required: true, locked: false, order: 3 },
  { id: "city", label: "City / Location", type: "text", required: true, locked: false, order: 4 },
  { id: "role_interested_in", label: "Role Interested In", type: "select", required: true, locked: false, order: 5, options: ["Outside Sales Agent", "Inside Sales Agent", "Showing Partner", "Intern", "Admin"] },
  { id: "info_night_date", label: "Date of Info Night Attended", type: "date", required: false, locked: false, order: 6 },
  { id: "currently_licensed", label: "Do you have a real estate license?", type: "boolean", required: false, locked: false, order: 7 },
  { id: "license_number", label: "License Number", type: "text", required: false, locked: false, order: 8, show_if: { field_id: "currently_licensed", value: true } },
  { id: "years_experience", label: "Years of Experience", type: "number", required: false, locked: false, order: 9, show_if: { field_id: "currently_licensed", value: true } },
  { id: "referral_source", label: "How did you hear about us?", type: "select", required: false, locked: false, order: 10, options: ["Referral", "Social Media", "Job Board", "Website", "Other"] },
  { id: "hours_per_week", label: "Hours per week you can commit?", type: "select", required: true, locked: false, order: 11, options: ["20-30", "30-40", "40-50", "50+"] },
  { id: "why_real_estate", label: "Why do you want to be in real estate?", type: "textarea", required: true, locked: false, order: 12 },
  { id: "why_vantage", label: "Why this company specifically?", type: "textarea", required: true, locked: false, order: 13 },
  { id: "biggest_achievement", label: "What is your biggest professional achievement?", type: "textarea", required: true, locked: false, order: 14 },
  { id: "one_year_goal", label: "Where do you want to be in 1 year?", type: "textarea", required: true, locked: false, order: 15 },
  { id: "interested_in", label: "Interested In", type: "interested_in", required: false, locked: false, order: 16 },
];

/** Known field IDs that map to real candidate columns (not custom_fields). */
export const KNOWN_CANDIDATE_COLUMNS = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "city",
  "role_interested_in",
  "info_night_date",
  "currently_licensed",
  "license_number",
  "years_experience",
  "referral_source",
  "hours_per_week",
  "why_real_estate",
  "why_vantage",
  "biggest_achievement",
  "one_year_goal",
  "interested_in",
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
