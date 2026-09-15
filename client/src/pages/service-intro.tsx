import { GlobalNav } from "@/components/global-nav";
import { SiteLogoBadge } from "@/components/site-logo";

export default function ServiceIntroPage() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans" data-testid="page-service-intro">
      <GlobalNav />

      {/* [섹션 1] 메인 히어로 */}
      <header className="text-white py-20 sm:py-28 border-b border-white/5" style={{ background: "linear-gradient(135deg, #021105 0%, #041f0b 50%, #072911 100%)" }}>
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* 왼쪽 카피라이팅 */}
            <div className="lg:col-span-8 space-y-6 text-left">
              <div className="space-y-4">
                <div className="inline-block bg-[#eefdf4] text-[#15a859] text-xs sm:text-sm font-bold px-4 py-1.5 rounded-full shadow-[0_2px_10px_rgba(0,199,60,0.1)]">
                  Only for Private Syndicate &amp; Professional Investors
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-tight text-white">
                  오직 조합투자자만을 위한<br className="hidden sm:block" /> <span className="text-[#00c73c]">차별화된 인프라</span>
                </h1>
              </div>
              <div className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 space-y-2">
                <p>단주 거래 위주의 일반 시장에서 벗어나,</p>
                <p>대형 자금 운용에 최적화된 비공개 1:1 프리미엄 매칭 솔루션을 선사합니다.</p>
                <p>
                  증권사 계좌 연동으로 비상장 주식 대형 블록딜을 가장{" "}
                  <span className="whitespace-nowrap">안전하게 거래해 보세요.</span>
                </p>
              </div>
              <div className="pt-2 flex justify-center lg:justify-start items-center gap-3">
                <div className="flex items-center gap-2 bg-black/30 px-3 py-1.5 rounded-lg border border-white/10 text-xs sm:text-sm">
                  <SiteLogoBadge size={22} />
                  <span className="font-bold"><span className="text-[#00c73c]">누보리치</span> 플랫폼</span>
                </div>
              </div>
            </div>
            {/* 오른쪽 앱 아이콘 */}
            <div className="lg:col-span-4 flex justify-center items-center relative h-[220px]">
              <div className="absolute w-64 h-64 rounded-full blur-[60px]" style={{ background: "rgba(9,172,255,0.22)" }}></div>
              <div className="relative bg-black/90 rounded-[32px] border border-white/10 p-6 w-56 h-48 flex flex-col justify-center items-center shadow-2xl">
                <SiteLogoBadge size={56} />
                <span className="mt-3 text-[#00c73c] font-bold text-sm tracking-wide">비상장 투자 플랫폼</span>
                <div className="absolute bottom-6 right-4 translate-x-3 translate-y-3 drop-shadow-lg">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M4 2L20 12L12.5 14L16.5 22L13.5 23.5L9.5 15.5L4 18.5V2Z" fill="white" stroke="#000" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* [섹션 2] 약 1,200개 이상 비상장 종목 */}
      <section className="py-12 sm:py-24 bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* 스마트폰 UI 모형 */}
            <div className="lg:col-span-5 flex justify-center">
              <div className="w-full max-w-[310px] bg-slate-900 p-2.5 rounded-[42px] border-4 border-slate-700 shadow-xl">
                <div className="bg-white rounded-[34px] overflow-hidden p-5 flex flex-col justify-between" style={{ minHeight: 460 }}>
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-base font-bold text-slate-900">종목 순위</h3>
                      <span className="text-xs text-slate-400">더보기</span>
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-4 text-[11px] font-medium">
                      <span className="bg-slate-900 text-white px-3 py-1 rounded-full shrink-0">거래많은</span>
                      <span className="bg-white text-slate-500 border border-slate-200 px-3 py-1 rounded-full shrink-0">상승률 높은</span>
                      <span className="bg-white text-slate-500 border border-slate-200 px-3 py-1 rounded-full shrink-0">상장준비 시작</span>
                    </div>
                    <div className="space-y-3.5">
                      {[
                        { rank: 1, bg: "#1e4b93", abbr: "두나무", name: "두나무", price: "202,000원", change: "+6.32%", up: true },
                        { rank: 2, bg: "#5f2671", abbr: "Kurly", name: "컬리", price: "10,000원", change: "+8.7%", up: true },
                        { rank: 3, bg: "#63a233", abbr: "OASIS", name: "오아시스", price: "11,100", change: "-0.82%", up: false },
                        { rank: 4, bg: "#00004c", abbr: "Kbank", name: "케이뱅크", price: "7,900원", change: "+1.28%", up: true },
                        { rank: 5, bg: "#de2e5f", abbr: "ya", name: "야놀자", price: "39,700원", change: "-1.79%", up: false },
                      ].map((item) => (
                        <div key={item.rank} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-3">
                            <span className="italic font-bold text-slate-900 w-3">{item.rank}</span>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: item.bg }}>
                              {item.abbr}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{item.name}</p>
                              <p className="text-[10px] text-slate-400">일반 {item.price}</p>
                            </div>
                          </div>
                          <span className={`font-bold ${item.up ? "text-rose-500" : "text-blue-500"}`}>{item.change}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-[#00c73c] text-white text-center py-2.5 rounded-xl text-xs font-bold shadow-sm mt-5">변화에 참여하기</div>
                </div>
              </div>
            </div>
            {/* 오른쪽 설명 */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2 text-left">
                <span className="text-xs font-bold text-[#00c73c] uppercase tracking-wider block">종목 수급</span>
                <h2 className="text-3xl font-extrabold text-[#081d33] tracking-tight">
                  약 1,200개 이상 다양한 비상장 주식 종목
                </h2>
              </div>
              <div className="space-y-4 text-slate-600 text-sm sm:text-base leading-relaxed text-left">
                <p className="font-bold text-slate-900">우량 스타트업부터 상장 임박 유니콘 기업까지,</p>
                <p>시장을 선도할 유망 기업의 가치를 누구보다 먼저 안전하게 선점하십시오. 공모주 청약의 바늘구멍 같은 비례 배정 방식에 머무르지 않고, 대형 물량을 합리적으로 공급받아 차별화된 포트폴리오를 구성할 수 있습니다.</p>
                <p>특히 <span className="text-slate-900 font-bold">개인투자조합원 및 전문투자자 전용 파이프라인</span>을 통해 장내 시장에서 구하기 힘들었던 대형 구주(Block Deal) 거래를 실시간으로 조율해 드립니다.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-2xl font-black text-[#081d33]">1,200+</div>
                  <div className="text-xs text-slate-400 mt-1">등록 완료 비상장 종목 수</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="text-2xl font-black text-emerald-600">Zero</div>
                  <div className="text-xs text-slate-400 mt-1">허위 매물 리스크 제로</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* [섹션 3] 대형 자금 매칭을 위한 핵심 인프라 */}
      <section className="py-12 sm:py-24 bg-white border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto space-y-3 mb-8 sm:mb-16">
            <h2 className="text-3xl font-extrabold text-[#081d33] tracking-tight">
              대형 자금 매칭을 위한 핵심 인프라
            </h2>
            <p className="text-slate-500 text-sm">
              구주 매각 및 조합 물량 교환 등 프라이빗 자산 거래의 모든 프로세스를 완벽히 서포트합니다.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />,
                title: "VC·기관 회수 물량 독점 매칭",
                desc: "벤처캐피탈(VC) 및 금융기관이 보유한 보호예수 해제 지분이나 Pre-IPO 엑싯(Exit) 대량 지분을 단독 매치하여 매입 단가 경쟁력을 혁신적으로 낮춰 드립니다.",
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 009 11.5V10m0 0V4a3 3 0 116 0v6m-6 0h6m-6 0a6 6 0 0112 0v1.5m0 4.44h-2.105a3 3 0 00-2.013.767l-1.087.93a3 3 0 01-2.013.767H11" />,
                title: "개인투자조합 간 자유로운 이동",
                desc: "서로 다른 조합(Syndicate)에서 운용 중인 비상장 포트폴리오를 1:1 프리미엄 협의 매칭 엔진을 통해 조율합니다. 비공개 거래 방식으로 양수도 프로세스를 정교하게 지원합니다.",
              },
              {
                icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h.01M15 17h.01M9 17l6-10m-3 5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
                title: "세제 혜택 가이드 밀착 지원",
                desc: "벤처투자법에 부합하는 소득공제 대상 여부 판단 및 투자조합 양도 소득세 특별 비과세 적용 기준을 세무 연계 인프라를 통해 투명하게 점검해 드립니다.",
              },
            ].map((card, i) => (
              <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200/60 shadow-sm flex flex-col justify-between">
                <div className="space-y-5">
                  <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#15a859]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      {card.icon}
                    </svg>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-base font-bold text-[#081d33]">{card.title}</h3>
                    <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">{card.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* [섹션 4] 실 증권계좌 연동 에스크로 */}
      <section className="py-12 sm:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* 왼쪽 본문 */}
            <div className="lg:col-span-6 space-y-5 text-left">
              <span className="text-xs font-bold text-[#00c73c] uppercase tracking-wider block">안전 이행 시스템</span>
              <h2 className="text-3xl font-extrabold text-[#081d33] tracking-tight leading-snug">
                실 증권계좌 연동 기반의<br />100% 실매물 안전 결제 보장
              </h2>
              <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                누보리치는 불명확한 매물 검증, 결제 불이행 및 계약 인도 지연 등 <strong>기존 장외거래 시장의 불투명성과 비대칭적 리스크를 완전히 상쇄</strong>했습니다.
                제휴 금융사 시스템과의 양방향 API 연동을 통해 판매자의 실제 주식 보유 여부를 실시간 검증하고, 계약 체결과 대금 지급이 동시 처리되는 주식 대금 동시 이행(Escrow) 시스템을 구축했습니다.
              </p>
              <ul className="space-y-2 text-xs sm:text-sm font-semibold text-slate-700 inline-block text-left">
                <li className="flex items-center gap-2">
                  <span className="text-[#00c73c]">✔</span> 거래 완료 시 증권사 계좌 실시간 즉시 대체 처리
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#00c73c]">✔</span> 거래 상대방 비공개 및 비율유지 보안 거래 완벽 보장
                </li>
              </ul>
            </div>
            {/* 오른쪽 에스크로 타임라인 */}
            <div className="lg:col-span-6 bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-400">보안 에스크로 이행 상태</span>
                <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2.5 py-0.5 rounded-full border border-emerald-200 font-bold">Active</span>
              </div>
              <div className="space-y-4 relative">
                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-800">
                    <span>🔒</span>
                    <span>판매자 조합 (주식 소유 원부 완료)</span>
                  </div>
                  <span className="text-emerald-500 text-xs">🛡️</span>
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-emerald-100" style={{ background: "rgba(236,253,245,0.5)" }}>
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-800">
                    <span>🟢</span>
                    <span>안전 에스크로 (대금 일시 락업)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">실시간 동시</span>
                </div>
                <div className="flex items-center justify-between bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-800">
                    <span>👤</span>
                    <span>구매자 계좌 (이체 즉시 소유권 이전)</span>
                  </div>
                  <span className="text-emerald-500 text-xs">✔</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* [섹션 5] 엔딩 CTA */}
      <section className="py-12 sm:py-24 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a 0%, #081d33 50%, #020617 100%)" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at top, rgba(9,172,255,0.1), transparent 50%)" }}></div>
        <div className="max-w-4xl mx-auto px-6 text-center space-y-6 relative z-10">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            투명하고 합리적인 비상장 자산 운용의 표준
          </h2>
          <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
            <span className="text-[#00c73c] font-bold">개인투자조합</span> 및 <span className="text-[#00c73c] font-bold">벤처캐피탈(VC)</span> 지분 유동화 프로세스는 고도화된 자산 검증 인프라를 통해{" "}
            <span className="whitespace-nowrap">안전하게 관리됩니다.</span><br className="hidden sm:block" />
            리스크 없는 깨끗한 거래 환경 속에서 핵심 자산의 미래 가치를 완벽하게 관리하고 실현해 보십시오.
          </p>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-slate-950 text-slate-600 text-[11px] py-10 border-t border-slate-900">
        <div className="max-w-5xl mx-auto px-6 space-y-4">
          <div className="flex flex-wrap gap-4 text-slate-500 font-medium border-b border-slate-900 pb-4">
            <span>누보리치 | 개인투자조합 프리미엄 가이드</span>
            <span className="ml-auto">이용약관</span>
            <span>개인정보처리방침</span>
            <span>투자유의사항</span>
          </div>
          <div className="space-y-1 text-slate-600 leading-relaxed">
            <p>법적고지: 비상장주식 투자는 고위험 자산군에 속하며 시장 상황에 따라 환금성에 상당한 제약이 따를 수 있습니다. 본 안내 페이지는 정보 제공을 목적으로 하며 거래의 최종 책임은 투자자 본인에게 귀속됩니다.</p>
            <p>© NOUVEAU RICHE. All Rights Reserved. 본 가이드의 저작권은 (주)누보리치가 소유하며, 무단 전재 및 배포를 금합니다.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
