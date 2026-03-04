"use client";

interface Stats {
  totalCandidates: number;
  underReview: number;
  interviewsThisWeek: number;
  onboarding: number;
}

export default function DashboardShell({ stats }: { stats: Stats }) {
  const statCards = [
    {
      label: "Total Candidates",
      value: stats.totalCandidates,
      color: "bg-[#1c759e]",
    },
    {
      label: "Under Review",
      value: stats.underReview,
      color: "bg-[#8B5CF6]",
    },
    {
      label: "Interviews This Week",
      value: stats.interviewsThisWeek,
      color: "bg-[#F59E0B]",
    },
    {
      label: "Onboarding",
      value: stats.onboarding,
      color: "bg-[#10B981]",
    },
  ];

  return (
    <>
      <h2 className="text-2xl font-bold text-[#272727] mb-6">Dashboard</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-6"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-3 h-3 rounded-full ${card.color}`} />
              <span className="text-sm font-medium text-[#a59494]">
                {card.label}
              </span>
            </div>
            <p className="text-3xl font-bold text-[#272727]">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 bg-white rounded-xl shadow-sm border border-[#a59494]/10 p-8 text-center">
        <p className="text-[#a59494] text-sm">
          Select a section from the sidebar to get started.
        </p>
      </div>
    </>
  );
}
