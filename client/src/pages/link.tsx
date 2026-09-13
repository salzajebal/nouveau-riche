import { useQuery } from "@tanstack/react-query";
import type { DomainFallbackUrl } from "@shared/schema";
import { ExternalLink, Globe, RefreshCw } from "lucide-react";
import { SiteLogoBadge } from "@/components/site-logo";

export default function LinkPage() {
  const { data: urls = [], isLoading, refetch } = useQuery<{ urls: DomainFallbackUrl[] }>({
    queryKey: ["/api/domain-redirect"],
    refetchInterval: 30000,
  });

  const activeUrls = (urls as any)?.urls ?? urls;

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <SiteLogoBadge size={32} />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#03C75A]/10 flex items-center justify-center mx-auto mb-4">
              <Globe className="w-8 h-8 text-[#03C75A]" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">접속 안내</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              현재 이용 가능한 접속 주소입니다.<br />
              아래 버튼을 눌러 서비스에 접속하세요.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 rounded-xl bg-gray-200 animate-pulse" />
              ))}
            </div>
          ) : Array.isArray(activeUrls) && activeUrls.length > 0 ? (
            <div className="space-y-3">
              {[...activeUrls].sort((a, b) => a.priority - b.priority).map((item: DomainFallbackUrl, idx: number) => (
                <a
                  key={item.id}
                  href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full bg-white border border-gray-200 hover:border-[#03C75A] hover:shadow-sm rounded-xl px-5 py-4 transition-all group"
                  data-testid={`link-domain-${idx}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#03C75A]/10 flex items-center justify-center shrink-0">
                      <span className="text-[#03C75A] font-bold text-sm">{idx + 1}</span>
                    </div>
                    <div className="text-left">
                      {item.label && (
                        <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                      )}
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-[#03C75A] break-all">
                        {item.url.replace(/^https?:\/\//, "")}
                      </p>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-[#03C75A] shrink-0 ml-2" />
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <Globe className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 font-medium">현재 등록된 접속 주소가 없습니다</p>
              <p className="text-xs text-gray-400 mt-1">잠시 후 다시 확인해주세요</p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-center">
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              data-testid="button-refresh-links"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              새로고침
            </button>
          </div>

          <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-xs text-amber-700 leading-relaxed text-center">
              📌 이 페이지를 즐겨찾기에 추가해두시면<br />
              도메인이 변경되어도 항상 최신 주소를 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-gray-400">
        © NOUVEAU RICHE. All rights reserved.
      </footer>
    </div>
  );
}
