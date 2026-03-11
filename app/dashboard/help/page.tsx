"use client";

import { useState } from "react";
import { useTeam } from "@/lib/team-context";

/* ── Component ──────────────────────────────────────────────────── */
export default function HelpPage() {
  const [activeSection, setActiveSection] = useState("getting-started");
  const { branding } = useTeam();
  const brandName = branding.name;

  /* ── Help sections (dynamic) ─────────────────────────────────── */
  const SECTIONS = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: "🚀",
      content: [
        {
          heading: `Welcome to ${brandName} Recruiting`,
          body: `This is the internal talent acquisition platform for ${brandName}. It manages your entire recruiting pipeline — from first lead to fully onboarded agent — in one centralized dashboard.`,
        },
        {
          heading: "Navigating the Dashboard",
          body: 'Use the sidebar on the left to navigate between sections: Dashboard (stats overview), Candidates (Kanban pipeline board), Interviews (schedule & track), Onboarding (task checklists), Settings (team configuration), and this Help page. On the Dashboard home page you\'ll see high-level stats: total candidates, interviews scheduled, offers pending, and agents onboarding.',
        },
        {
          heading: "Your First Steps",
          body: '1. Go to Settings → Team to verify your team name and admin email.\n2. Go to Settings → Team Members and update each member\'s name, from-email, phone, and Google Booking URL.\n3. Go to Candidates and click "Add Candidate" to add your first lead.\n4. Drag the candidate card through the pipeline stages as they progress.',
        },
      ],
    },
    {
      id: "google-account",
      title: "Connect Your Google Account",
      icon: "🔑",
      content: [
        {
          heading: "Why You Need to Connect",
          body: "Email sending in this app works through your own Google account. This means emails to candidates come from your email address — not a generic system address. Until you connect, no emails will be sent.",
        },
        {
          heading: "How to Connect",
          body: '1. Click your name or "Profile" in the left sidebar.\n2. Scroll to the Google Workspace section and click "Connect Google Account".\n3. Sign in with the Google account you want to send emails from.\n4. You\'ll be redirected back to the app — you\'re connected!',
        },
        {
          heading: "Things to Know",
          body: "You only need to do this once. Your connection stays active until you manually disconnect. If you ever switch Google accounts or need to reconnect, just visit your Profile page and repeat these steps.",
        },
        {
          heading: "⚠️ Important",
          body: "If you haven't connected your Google account, emails to candidates will not send. This is the most common reason for emails not going out. Check your Profile page to verify your connection status.",
        },
      ],
    },
    {
      id: "google-scheduling",
      title: "Google Appointment Scheduling",
      icon: "📅",
      content: [
        {
          heading: "What is Google Appointment Scheduling?",
          body: "Google Appointment Scheduling (part of Google Calendar) lets candidates book 1-on-1 interviews directly on a team leader's calendar. Each leader gets a unique booking URL that candidates click to choose an available time slot.",
        },
        {
          heading: "Step 1: Open Google Calendar",
          body: 'Go to calendar.google.com and sign in with your Google Workspace or personal Google account. Make sure you\'re on the account you use for work.',
        },
        {
          heading: "Step 2: Create an Appointment Schedule",
          body: 'Click the "+" button or click on a time slot on your calendar. In the dropdown that appears, select "Appointment schedule" (not a regular event). If you don\'t see this option, you may need Google Workspace or a Google One subscription.',
        },
        {
          heading: "Step 3: Configure Your Availability",
          body: 'Give your schedule a title (e.g. "1-on-1 Interview — [Your Name]"). Set your available hours for each day of the week. Set the appointment duration (we recommend 30 or 45 minutes for interviews). Add buffer time between appointments if you need a break (5–15 minutes is typical).',
        },
        {
          heading: "Step 4: Customize Booking Settings",
          body: 'Under "Booking page", you can customize the photo, description, and what information to collect from the candidate (name, email, phone). Enable "Require email verification" for security. Under "Reminders", enable email reminders to reduce no-shows.',
        },
        {
          heading: "Step 5: Get Your Booking URL",
          body: 'After saving your appointment schedule, open it from your calendar. Click "Open booking page" — this opens a preview. Copy the URL from your browser\'s address bar. It will look something like: https://calendar.google.com/calendar/appointments/XXXXXX',
        },
        {
          heading: "Step 6: Add Your URL to the Recruiting Portal",
          body: 'Go to Settings → Team Members in the recruiting portal. Click "Edit" next to your name. Paste the booking URL into the "Google Booking URL" field. Click Save. Now when anyone schedules a 1-on-1 interview and selects you as the leader, your booking URL will appear for the candidate to click.',
        },
        {
          heading: "Tips for a Great Setup",
          body: '• Block off lunch hours, team meetings, and personal time on your Google Calendar so those slots don\'t show as available.\n• Set a minimum scheduling notice (e.g. 24 hours) so candidates can\'t book last-minute.\n• Add a confirmation message that includes your Zoom/office address.\n• Test your booking page yourself by opening the URL in an incognito window.',
        },
      ],
    },
    {
      id: "group-interviews",
      title: "Group Interviews",
      icon: "👥",
      content: [
        {
          heading: "How Group Interviews Work",
          body: 'Group interviews are sessions where multiple candidates join a single Zoom call to learn about the team and culture. Each session is manually scheduled by creating a new group interview from the Group Interviews page. You can set a default Zoom link in the session settings panel, and it will be pre-filled when creating new sessions.',
        },
        {
          heading: "Setting Up Group Interviews",
          body: '1. Navigate to the Group Interviews page.\n2. Click the settings gear icon to open Session Settings.\n3. Paste your Zoom meeting link into the "Default Meeting Link" field.\n4. Optionally set the "Next Group Interview Date".\n5. Click Save Settings.\n\nWhen you create a new session, the default meeting link will be pre-filled. Each session can have its own date, link, and candidates.',
        },
        {
          heading: "Inviting Candidates",
          body: 'When a candidate is ready for the group interview stage:\n1. Move them to the "Group Interview" stage on the Kanban board.\n2. Open their profile and click "Send Email".\n3. Select the "Group Interview Invite" template.\n4. The template auto-fills with the candidate\'s name and your team\'s Zoom link.\n5. Review and send.',
        },
      ],
    },
    {
      id: "moving-candidates",
      title: "Moving Candidates Through the Pipeline",
      icon: "🔄",
      content: [
        {
          heading: "Pipeline Stages",
          body: 'Your recruiting pipeline has these stages by default: New Lead → Application Sent → Under Review → Group Interview → 1-on-1 Interview → Offer → Onboarding → Not a Fit. Each stage is a column on the Kanban board.',
        },
        {
          heading: "Drag and Drop",
          body: 'On the Candidates page, grab any candidate card and drag it to a different column to change their stage. The stage change is saved to the database immediately and recorded in the candidate\'s stage history timeline.',
        },
        {
          heading: "Move Stage Dropdown",
          body: 'On a candidate\'s profile page, click the "Move Stage" button to see a dropdown of all available stages. Select the target stage. Both the Kanban drag-and-drop and the dropdown record the change in the stage history.',
        },
        {
          heading: "Stage History",
          body: 'Every stage change is logged with a timestamp on the candidate\'s profile page under "Stage History". This creates an audit trail showing exactly when each candidate moved through your pipeline.',
        },
      ],
    },
    {
      id: "email-templates",
      title: "Email Templates",
      icon: "✉️",
      content: [
        {
          heading: "Using Email Templates",
          body: 'From any candidate\'s profile, click "Send Email" to open the email composer. Select a template from the dropdown to auto-fill the subject and body, or start from scratch. The system replaces merge tags with real data before sending.',
        },
        {
          heading: "Available Merge Tags",
          body: 'Templates support these merge tags:\n• {{first_name}} — candidate\'s first name\n• {{last_name}} — candidate\'s last name\n• {{team_name}} — your team\'s name\n• {{sender_name}} — your name (the logged-in user)\n• {{booking_link}} — the selected leader\'s Google Booking URL (for 1-on-1 interviews)',
        },
        {
          heading: "Managing Templates",
          body: 'Go to Settings → Email Templates to view and edit all templates. The system comes with 7 pre-built templates: Application Received, Interview Invitation, Group Interview Invite, Offer Extended, Rejection Notice, Onboarding Welcome, and Follow-Up Check-In. Click any template to edit its subject and body, then click Save.',
        },
        {
          heading: "CC Admin on All Emails",
          body: 'In Settings → Team, you can enable "CC admin on all candidate emails". When enabled, every outgoing email also copies the admin email address so leadership has visibility into all communications.',
        },
      ],
    },
    {
      id: "team-members",
      title: "Adding & Managing Team Members",
      icon: "🧑‍💼",
      content: [
        {
          heading: "Viewing Team Members",
          body: 'Go to Settings → Team Members to see everyone on your team. Each member shows their name, email, role (owner/leader), and sending email address.',
        },
        {
          heading: "Editing Member Profiles",
          body: 'Click "Edit" next to a team member to update their:\n• Display Name — shown in emails and notes\n• From Email — the email address used when sending candidate emails\n• Phone — displayed for reference\n• Calendly URL — alternative scheduling link\n• Google Booking URL — for 1-on-1 interview scheduling',
        },
        {
          heading: "Roles & Permissions",
          body: 'There are two roles:\n• Owner — full access: can edit settings, manage users, view all data, and delete records\n• Leader — limited access: can view all data but cannot edit team settings or manage users\n\nBoth roles can send emails, schedule interviews, score candidates, and manage the pipeline.',
        },
      ],
    },
    {
      id: "multi-team",
      title: "Multi-Team Support",
      icon: "🏢",
      content: [
        {
          heading: "Switching Teams",
          body: 'If you have access to multiple teams, you\'ll see a team switcher dropdown in the top header bar. Click your current team name to see a list of all available teams, then select the one you want to switch to. The page will reload with the selected team\'s data.',
        },
        {
          heading: "How Team Isolation Works",
          body: 'Each team has its own candidates, pipeline stages, email templates, scoring criteria, users, and onboarding tasks. When you switch teams, everything you see in the dashboard is scoped to that team. A candidate in one team is not visible to another team.',
        },
        {
          heading: "Your Team ID",
          body: 'Your active team is remembered via a browser cookie. If you clear your cookies, the system defaults to the primary team. The team ID is used in every database query to ensure data isolation.',
        },
      ],
    },
  ];

  const section = SECTIONS.find((s) => s.id === activeSection) ?? SECTIONS[0];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#272727]">Help &amp; Manual</h1>
        <p className="text-[#a59494] mt-1">
          Everything you need to know about using the recruiting portal
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
                    ? "bg-brand/10 text-brand"
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
              {section.content.map((item, i) => {
                const isWarning = item.heading.startsWith("⚠️");
                if (isWarning) {
                  return (
                    <div
                      key={i}
                      className="px-4 py-3 rounded-lg bg-amber-50 border border-amber-200"
                    >
                      <h3 className="text-sm font-semibold text-amber-800 mb-1">
                        {item.heading}
                      </h3>
                      <div className="text-sm text-amber-700 leading-relaxed whitespace-pre-line">
                        {item.body}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={i}>
                    <h3 className="text-base font-semibold text-[#272727] mb-2">
                      {item.heading}
                    </h3>
                    <div className="text-sm text-[#272727]/70 leading-relaxed whitespace-pre-line">
                      {item.body}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick tips card */}
          <div className="bg-brand/5 border border-brand/20 rounded-xl p-6 mt-6">
            <h3 className="text-sm font-semibold text-brand mb-3">Quick Tips</h3>
            <ul className="space-y-2 text-sm text-[#272727]/70">
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span>
                  <strong>Drag &amp; drop</strong> candidates between Kanban columns to move them
                  through the pipeline quickly.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span>
                  <strong>Merge tags</strong> in email templates auto-fill candidate and team
                  information — no manual edits needed.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span>
                  <strong>Google Booking URLs</strong> must be set per leader in Settings →
                  Team Members before 1-on-1 interview scheduling works.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-brand mt-0.5">•</span>
                <span>
                  <strong>Team switching</strong> — use the dropdown in the header to switch
                  between teams. All data is scoped to the active team.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
