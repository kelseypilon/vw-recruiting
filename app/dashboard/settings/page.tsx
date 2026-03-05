import Link from "next/link";

const SETTINGS_SECTIONS = [
  {
    title: "Email Templates",
    description: "Manage email templates for candidate communications",
    href: "/dashboard/settings/templates",
    icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  },
  {
    title: "Team Settings",
    description: "Configure team name, admin email, and preferences",
    href: "/dashboard/settings",
    icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75",
    disabled: true,
  },
  {
    title: "Pipeline Stages",
    description: "Customize your recruiting pipeline stages",
    href: "/dashboard/settings",
    icon: "M3 3h18v18H3z M3 9h18 M3 15h18 M9 3v18",
    disabled: true,
  },
  {
    title: "Scoring Criteria",
    description: "Configure interview scoring criteria and weights",
    href: "/dashboard/settings",
    icon: "M12 20V10 M18 20V4 M6 20v-4",
    disabled: true,
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#272727]">Settings</h2>
        <p className="text-sm text-[#a59494] mt-0.5">
          Manage your team, pipeline, and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {SETTINGS_SECTIONS.map((section) => {
          const content = (
            <div
              className={`bg-white rounded-xl border border-[#a59494]/10 shadow-sm p-5 transition ${
                section.disabled
                  ? "opacity-50 cursor-not-allowed"
                  : "hover:border-[#1c759e]/30 hover:shadow-md"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-[#1c759e]/10 flex items-center justify-center shrink-0">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#1c759e"
                    strokeWidth="2"
                  >
                    <path d={section.icon} />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#272727]">
                    {section.title}
                  </h3>
                  <p className="text-xs text-[#a59494] mt-1">
                    {section.description}
                  </p>
                  {section.disabled && (
                    <span className="text-[10px] text-[#a59494] mt-2 inline-block">
                      Coming soon
                    </span>
                  )}
                </div>
              </div>
            </div>
          );

          if (section.disabled) {
            return <div key={section.title}>{content}</div>;
          }

          return (
            <Link key={section.title} href={section.href}>
              {content}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
