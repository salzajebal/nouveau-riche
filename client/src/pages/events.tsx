import { useState } from "react";
import { GlobalNav } from "@/components/global-nav";

type Tab = "ongoing" | "ended";

export default function EventsPage() {
  const [tab, setTab] = useState<Tab>("ongoing");

  return (
    <div className="min-h-screen bg-white" data-testid="page-events">
      <GlobalNav />

      <div className="max-w-[800px] mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#14181B] mb-6" data-testid="text-events-title">이벤트</h1>

        <div className="flex border-b border-[#E0E2E4] mb-8">
          <button
            onClick={() => setTab("ongoing")}
            className={`px-6 py-3 text-[15px] font-medium transition-colors border-b-2 -mb-px ${
              tab === "ongoing"
                ? "border-[#03C75A] text-[#03C75A]"
                : "border-transparent text-[#9D9FA0] hover:text-[#585B5E]"
            }`}
            data-testid="tab-ongoing"
          >
            진행중
          </button>
          <button
            onClick={() => setTab("ended")}
            className={`px-6 py-3 text-[15px] font-medium transition-colors border-b-2 -mb-px ${
              tab === "ended"
                ? "border-[#03C75A] text-[#03C75A]"
                : "border-transparent text-[#9D9FA0] hover:text-[#585B5E]"
            }`}
            data-testid="tab-ended"
          >
            종료
          </button>
        </div>

        {tab === "ongoing" && (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="section-ongoing-empty">
            <div className="w-16 h-16 rounded-full bg-[#F3F5F6] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#9D9FA0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-[#9D9FA0] text-[15px]" data-testid="text-no-events">진행중인 이벤트가 없어요.</p>
          </div>
        )}

        {tab === "ended" && (
          <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="section-ended-empty">
            <div className="w-16 h-16 rounded-full bg-[#F3F5F6] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[#9D9FA0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-[#9D9FA0] text-[15px]">종료된 이벤트가 없어요.</p>
          </div>
        )}
      </div>
    </div>
  );
}
