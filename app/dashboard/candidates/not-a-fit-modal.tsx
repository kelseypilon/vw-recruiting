"use client";

interface Props {
  candidateName: string;
  candidateEmail: string | null;
  targetStage: string;
  onSendEmail: () => void;
  onMoveWithout: () => void;
  onCancel: () => void;
}

export default function NotAFitModal({
  candidateName,
  candidateEmail,
  targetStage,
  onSendEmail,
  onMoveWithout,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#DC2626" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>

        <h3 className="text-lg font-bold text-[#272727] text-center mb-1">
          Moving to {targetStage}
        </h3>
        <p className="text-sm text-[#a59494] text-center mb-6">
          <span className="font-medium text-[#272727]">{candidateName}</span> will be moved to{" "}
          <span className="font-medium text-red-600">{targetStage}</span>.
          {candidateEmail
            ? " Would you like to send a let-down email?"
            : " This candidate has no email on file."}
        </p>

        <div className="flex flex-col gap-2">
          {candidateEmail && (
            <button
              onClick={onSendEmail}
              className="w-full px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark active:bg-brand-dark text-white text-sm font-semibold transition"
            >
              Send Let-Down Email
            </button>
          )}
          <button
            onClick={onMoveWithout}
            className="w-full px-4 py-2.5 rounded-lg border border-[#a59494]/40 text-sm font-medium text-[#272727] hover:bg-[#f5f0f0] transition"
          >
            Move Without Sending
          </button>
          <button
            onClick={onCancel}
            className="w-full px-4 py-2 text-sm font-medium text-[#a59494] hover:text-[#272727] transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
