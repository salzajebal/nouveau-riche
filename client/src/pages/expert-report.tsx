import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Share2 } from "lucide-react";

export default function ExpertReportPage() {
  const [, params] = useRoute("/expert-report/:id");
  const [, navigate] = useLocation();
  const reportId = params?.id;

  const { data, isLoading } = useQuery<{ report: any }>({
    queryKey: [`/api/market/expert-report/${reportId}`],
    staleTime: 5 * 60 * 1000,
    enabled: !!reportId,
  });

  const report = data?.report;

  const fmtDate = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch { return ""; }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert("링크가 복사되었습니다.");
    } catch {
      // fallback: noop
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* 상단 뒤로가기 */}
      <div className="border-b border-[#F3F5F6] bg-white sticky top-0 z-10">
        <div className="max-w-[720px] mx-auto px-4 h-12 flex items-center">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-sm text-[#585B5E] hover:text-[#14181B] transition-colors"
          >
            <ArrowLeft size={16} />
            <span>뒤로</span>
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-[720px] mx-auto px-4 py-10">
        {isLoading ? (
          <div className="space-y-4">
            <div className="h-7 bg-[#F3F5F6] rounded animate-pulse w-3/4" />
            <div className="h-4 bg-[#F3F5F6] rounded animate-pulse w-1/4" />
            <div className="flex gap-2 mt-6">
              <div className="h-8 w-28 bg-[#F3F5F6] rounded animate-pulse" />
              <div className="h-8 w-24 bg-[#F3F5F6] rounded animate-pulse" />
            </div>
            <div className="mt-8 space-y-3">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-4 bg-[#F3F5F6] rounded animate-pulse" style={{ width: `${60 + (i % 4) * 10}%` }} />
              ))}
            </div>
          </div>
        ) : report ? (
          <>
            {/* 제목 */}
            <h1 className="text-2xl font-bold text-[#14181B] leading-snug mb-3">
              {report.title}
            </h1>

            {/* 작성자 / 날짜 */}
            <p className="text-sm text-[#585B5E] mb-6">
              {report.reportCreator || report.sourceProvider}
              {(report.publishedAt || report.createdAt)
                ? <span className="ml-2">{fmtDate(report.publishedAt || report.createdAt)}</span>
                : null}
            </p>

            {/* 버튼 */}
            <div className="flex gap-2 mb-10">
              {report.urlPdf && (
                <a
                  href={report.urlPdf}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 border border-[#E0E2E4] rounded text-sm text-[#14181B] hover:bg-[#F3F5F6] transition-colors"
                >
                  <FileText size={14} />
                  리포트 원문보기
                </a>
              )}
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2 border border-[#E0E2E4] rounded text-sm text-[#14181B] hover:bg-[#F3F5F6] transition-colors"
              >
                <Share2 size={14} />
                공유하기
              </button>
            </div>

            {/* 본문 HTML */}
            {report.previewContent ? (
              <div
                className="text-[15px] text-[#14181B] leading-relaxed report-body"
                dangerouslySetInnerHTML={{ __html: report.previewContent }}
              />
            ) : (
              <p className="text-sm text-[#9D9FA0]">본문 내용이 없습니다.</p>
            )}

            {/* 면책 고지 */}
            {report.sourceProviderComment && (
              <div className="mt-12 pt-5 border-t border-[#F3F5F6]">
                <p className="text-[12px] text-[#9D9FA0] leading-relaxed whitespace-pre-wrap">
                  {report.sourceProviderComment}
                </p>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-[#9D9FA0] text-center py-16">리포트를 불러올 수 없습니다.</p>
        )}
      </div>
    </div>
  );
}
