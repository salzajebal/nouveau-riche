import { GlobalNav } from "@/components/global-nav";

export default function NoticesPage() {
  return (
    <div className="min-h-screen bg-white" data-testid="page-notices">
      <GlobalNav />

      <div className="max-w-[800px] mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-[#14181B] mb-6" data-testid="text-notices-title">공지사항</h1>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-[#F3F5F6] flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-[#9D9FA0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
          <p className="text-[#9D9FA0] text-[15px]">등록된 공지사항이 없어요.</p>
        </div>
      </div>
    </div>
  );
}
