"use client";

import { useState } from "react";

/* ── Help sections ──────────────────────────────────────────────── */
const SECTIONS = [
  {
    id: "overview",
    title: "Platform Overview",
    icon: "🏠",
    content: [
      {
        heading: "What is VW Recruiting?",
        body: "VW Recruiting is the internal talent acquisition platform for Vantage West Real Estate. It helps your team manage the entire recruiting pipeline — from first lead to fully onboarded agent — in one centralized dashboard.",
      },
      {
        heading: "Dashboard Home",
        body: "The main Dashboard shows high-level stats at a glance: total candidates, interviews scheduled, offers pending, and agents onboarding. Use this as your daily snapshot of recruiting health.",
      },
      {
        heading: "Navigation",
        body: "Use the sidebar on the left to navigate between sections: Dashboard (stats overview), Candidates (pipeline board), Interviews (schedule & track), Onboarding (task checklists), Settings (team config), and this Help page.",
      },
    ],
  },
  {
    id: "candidates",
    title: "Candidates & Pipeline",
    icon: "👥",
    content: [
      {
        heading: "Kanban Board",
        body: "The Candidates page displays a drag-and-drop Kanban board. Each column represents a pipeline stage (e.g. New Lead, Application Sent, Under Review, Group Interview, Offer, Not a Fit). Drag candidate cards between columns to advance them through your pipeline.",
      },
      {
        heading: "Adding a Candidate",
        body: 'Click the "Add Candidate" button at the top of the Kanban board. Fill in the candidate\'s name, email, phone, and role applied. New candidates start in the first pipeline stage automatically.',
      },
      {
        heading: "Candidate Profile",
        body: "Click any candidate card to open their full profile. Here you can see all their details: contact info, application data, DISC assessment results, AQ score, composite score, interview history, notes, and stage history timeline.",
      },
      {
        heading: "Moving Stages",
        body: 'You can move candidates between pipeline stages in two ways: (1) Drag and drop on the Kanban board, or (2) Use the "Move Stage" dropdown on a candidate\'s profile page. Both methods record the change in the stage history.',
      },
      {
        heading: "Search & Filter",
        body: "Use the search bar at the top of the Kanban board to find candidates by name. Use the stage filter dropdown to show only candidates in a specific pipeline stage.",
      },
    ],
  },
  {
    id: "assessments",
    title: "Assessments & Scoring",
    icon: "📊",
    content: [
      {
        heading: "DISC Assessment",
        body: "Each candidate can have DISC personality scores (D, I, S, C ranging 0–100). The system identifies primary and secondary DISC types and checks if the candidate meets the configured threshold. DISC results appear as color-coded badges on candidate cards.",
      },
      {
        heading: "AQ Score (Attraction Quotient)",
        body: "The AQ score measures a candidate's market presence and attractiveness as a recruit. Raw scores are normalized to a 0–100 scale and categorized into tiers: Elite (90+), Strong (70–89), Developing (50–69), or Emerging (below 50).",
      },
      {
        heading: "Composite Score",
        body: "The composite score is a weighted combination of all scoring criteria configured in Settings. Each criterion has a weight percentage and optional minimum threshold. Candidates receive a verdict based on their composite: Strong Hire, Hire, Borderline, or No Hire.",
      },
      {
        heading: "Interview Scores",
        body: "During interviews, evaluators can score candidates on each configured criterion (1–10 scale). Multiple evaluators can score the same candidate. Average scores per criterion are displayed on the candidate profile.",
      },
    ],
  },
  {
    id: "interviews",
    title: "Interviews",
    icon: "📅",
    content: [
      {
        heading: "Scheduling Interviews",
        body: 'Navigate to the Interviews page to see all scheduled, completed, and cancelled interviews. Use the "Schedule Interview" button to create a new interview for a candidate. Select the interview type, date/time, and any notes.',
      },
      {
        heading: "Interview Types",
        body: "The system supports multiple interview types: Phone Screen, Video Call, In-Person, Group Interview, and Panel Interview. The Group Interview type ties into the group interview settings configured under Settings → Team.",
      },
      {
        heading: "Group Interviews",
        body: "Group interviews are configured in Settings → Team tab. Set a recurring Zoom link and a scheduled date. When you send the Group Interview Invite email template, it automatically includes the Zoom link and date.",
      },
      {
        heading: "Interview Status",
        body: 'Each interview has a status: Scheduled, Completed, Cancelled, or No Show. Update the status as interviews happen to keep your records accurate. Mark interviews as "Completed" to unlock scoring.',
      },
    ],
  },
  {
    id: "emails",
    title: "Email System",
    icon: "✉️",
    content: [
      {
        heading: "Sending Emails",
        body: 'From any candidate\'s profile, click "Send Email" to open the email composer. Select a template or start from scratch. The system uses merge tags to personalize messages automatically.',
      },
      {
        heading: "Merge Tags",
        body: "Available merge tags: {{first_name}} — candidate's first name, {{last_name}} — last name, {{team_name}} — your team name, {{sender_name}} — your name. Tags are automatically replaced when the email is sent.",
      },
      {
        heading: "Email Templates",
        body: "Manage templates in Settings → Email Templates. The system comes with 7 pre-built templates: Application Received, Interview Invitation, Group Interview Invite, Offer Extended, Rejection Notice, Onboarding Welcome, and Follow-Up Check-In.",
      },
      {
        heading: "From Address & BCC",
        body: "Each team member can set their own \"From Email\" in Settings → Team Members. The team admin email (Settings → Team) can be BCC'd on all outgoing emails when the BCC toggle is enabled.",
      },
    ],
  },
  {
    id: "onboarding",
    title: "Onboarding",
    icon: "✅",
    content: [
      {
        heading: "Onboarding Checklist",
        body: "When a candidate is hired, navigate to the Onboarding page to see and manage their onboarding tasks. Each task has an owner role, optional assignee, due date, and completion status.",
      },
      {
        heading: "Task Templates",
        body: "Onboarding tasks are configured as templates in the database. When a candidate enters the onboarding stage, tasks are automatically generated from the template. Tasks cover areas like paperwork, systems setup, training, and introductions.",
      },
      {
        heading: "Tracking Progress",
        body: "Check off tasks as they're completed. Add notes to individual tasks to record important details. Filter the onboarding view by candidate to see a specific person's progress.",
      },
    ],
  },
  {
    id: "settings",
    title: "Settings & Configuration",
    icon: "⚙️",
    content: [
      {
        heading: "Team Settings",
        body: "The Team tab in Settings lets you configure your team name, admin email, BCC preferences, and group interview details (Zoom link + scheduled date). Changes save automatically when you click Save.",
      },
      {
        heading: "Team Members",
        body: "The Team Members tab shows all users on your team. You can edit each member's display name, from email address, phone number, Calendly URL, and Google Booking URL. These details are used in email templates and scheduling.",
      },
      {
        heading: "Pipeline Stages",
        body: "The Pipeline Stages tab shows your recruiting funnel stages in order. Stages are color-coded and determine the columns on the Kanban board. Contact your administrator to add or reorder stages.",
      },
      {
        heading: "Email Templates",
        body: "The Email Templates tab lets you create and edit email templates. Each template has a name, trigger condition, subject line, and body with merge tag support. Toggle templates active/inactive as needed.",
      },
      {
        heading: "Scoring Criteria",
        body: "The Scoring Criteria tab shows the weighted criteria used to evaluate candidates. Criteria are grouped into categories (DISC, AQ, Experience, Interview, Market Presence) with configurable weights and minimum thresholds.",
      },
    ],
  },
];

/* ── Component ──────────────────────────────────────────────────── */
export default function HelpPage() {
  const [activeSection, setActiveSection] = useState("overview");

  const section = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#272727]">Help &amp; Manual</h1>
        <p className="text-[#a59494] mt-1">
          Everything you need to know about using VW Recruiting
        </p>
      </div>

      <div className="flex gap-8">
        {/* Section nav */}
        <nav className="w-56 shrink-0">
          <div className="bg-white rounded-xl border border-[#a59494]/20 p-3 sticky top-8">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  activeSection === s.id
                    ? "bg-[#1c759e]/10 text-[#1c759e]"
                    : "text-[#272727] hover:bg-[#f5f0f0]"
                }`}
              >
                <span className="text-base">{s.icon}</span>
                {s.title}
              </button>
            ))}
          </div>
        </nav>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-[#a59494]/20 p-8">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">{section.icon}</span>
              <h2 className="text-xl font-bold text-[#272727]">{section.title}</h2>
            </div>

            <div className="space-y-8">
              {section.content.map((item, i) => (
                <div key={i}>
                  <h3 className="text-base font-semibold text-[#272727] mb-2">
                    {item.heading}
                  </h3>
                  <p className="text-sm text-[#272727]/70 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick tips card */}
          <div className="bg-[#1c759e]/5 border border-[#1c759e]/20 rounded-xl p-6 mt-6">
            <h3 className="text-sm font-semibold text-[#1c759e] mb-3">💡 Quick Tips</h3>
            <ul className="space-y-2 text-sm text-[#272727]/70">
              <li className="flex items-start gap-2">
                <span className="text-[#1c759e] mt-0.5">•</span>
                <span>
                  <strong>Drag &amp; drop</strong> candidates between Kanban columns to move them
                  through the pipeline quickly.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1c759e] mt-0.5">•</span>
                <span>
                  <strong>Merge tags</strong> in email templates auto-fill candidate and team
                  information — no manual edits needed.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1c759e] mt-0.5">•</span>
                <span>
                  <strong>Composite scores</strong> are calculated automatically from your scoring
                  criteria weights. Configure them in Settings → Scoring Criteria.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#1c759e] mt-0.5">•</span>
                <span>
                  Need help? Contact your team admin or reach out to support at{" "}
                  <span className="text-[#1c759e] font-medium">support@vantagewestrealestate.com</span>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
