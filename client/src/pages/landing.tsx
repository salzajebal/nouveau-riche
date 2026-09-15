import { useEffect, useState, useRef, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { GlobalNav } from "@/components/global-nav";
import {
  Search,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  MessageCircle,
  LogIn,
  LogOut,
  User,
  Menu,
  X,
  ExternalLink,
  Star,
  Bell,
  Plus,
  BarChart3,
  CalendarDays,
  FileText,
  Coins,
  TrendingUp,
} from "lucide-react";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { StockIcon } from "@/components/stock-icon";
import { SiteLogoBadge } from "@/components/site-logo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchStockPrices } from "@/lib/market-prices";
import { calculateHoldingLots } from "@/lib/holding-lots";
import type { User as UserType, StockTransaction, Watchlist } from "@shared/schema";

type StockRow = {
  name: string;
  category: "일반" | "전문";
  isIPO: boolean;
  price: number | null;
  change: number | null;
  orders: number | null;
  marketCapStr?: string;
  ipoDate?: string;
  reviewType?: string;
  fiscalYear?: string;
  revenueGrowthStr?: string;
};

import { ALL_SEARCH_STOCKS, searchStocks } from "@/lib/stocks";

const BANNER_SLIDES = [
  {
    accent: "#03C75A",
    tagBg: "#f0fdf6",
    tag: "NEW",
    title: "누보리치",
    subtitle: "누보리치 비상장 플랫폼으로!",
    icon: (
      <div className="flex flex-col gap-1.5 items-center">
        <div className="bg-gray-100 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
          <SiteLogoBadge size={16} />
          <span className="text-[11px] font-bold text-gray-800 leading-none whitespace-nowrap">비상장</span>
        </div>
        <div className="text-gray-400 text-sm leading-none">↓</div>
        <div className="bg-gray-100 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5">
          <SiteLogoBadge size={16} />
          <span className="text-[11px] font-bold text-gray-800 leading-none whitespace-nowrap">누보리치</span>
        </div>
      </div>
    ),
  },
  {
    accent: "#1976D2",
    tagBg: "#e8f0fc",
    tag: "IPO",
    title: "공모주 청약 일정",
    subtitle: "놓치지 마세요!",
    icon: <div className="p-3 rounded-xl" style={{ background: "#e8f0fc" }}><CalendarDays className="w-8 h-8" style={{ color: "#1976D2" }} /></div>,
  },
  {
    accent: "#43A047",
    tagBg: "#e8f5e9",
    tag: "이벤트",
    title: "주식모으기 수수료",
    subtitle: "무료 이벤트 진행 중",
    icon: <div className="p-3 rounded-xl" style={{ background: "#e8f5e9" }}><Coins className="w-8 h-8" style={{ color: "#43A047" }} /></div>,
  },
  {
    accent: "#7B1FA2",
    tagBg: "#f3e5f5",
    tag: "리포트",
    title: "전문가 리포트",
    subtitle: "비상장 투자 가이드",
    icon: <div className="p-3 rounded-xl" style={{ background: "#f3e5f5" }}><FileText className="w-8 h-8" style={{ color: "#7B1FA2" }} /></div>,
  },
];

const QUICK_CATEGORIES = [
  { label: "일반종목", icon: BarChart3, href: "#rankings" },
  { label: "공모주", icon: TrendingUp, href: "#rankings" },
  { label: "전문가리포트", icon: FileText, href: "#reports" },
  { label: "IPO캘린더", icon: CalendarDays, href: "/ipo-calendar" },
  { label: "테마", icon: Coins, href: "#themes" },
];

const RANKING_TABS = ["일반종목", "거래많은", "상승률 높은", "상장준비 시작", "예상시총 높은", "매출이 상승한"];

const NAV_LINKS = [
  { label: "공모주 IPO 캘린더", href: "/ipo-calendar" },
  { label: "서비스소개", href: "/service" },
  { label: "이벤트", href: "/events" },
  { label: "공지사항", href: "/notices" },
];

function useWatchlist(user: UserType | null) {
  const [localWatchlist, setLocalWatchlist] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("wl") || "[]"); } catch { return []; }
  });

  const { data: serverWatchlist, refetch } = useQuery<Watchlist[]>({
    queryKey: ["/api/watchlist"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: (stockName: string) => apiRequest("POST", "/api/watchlist", { stockName }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }); },
  });

  const removeMutation = useMutation({
    mutationFn: (stockName: string) => apiRequest("DELETE", `/api/watchlist/${encodeURIComponent(stockName)}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/watchlist"] }); },
  });

  const watchlistNames: string[] = user
    ? (serverWatchlist || []).map((w) => w.stockName)
    : localWatchlist;

  const toggleWatchlist = (stockName: string) => {
    if (user) {
      if (watchlistNames.includes(stockName)) {
        removeMutation.mutate(stockName);
      } else {
        addMutation.mutate(stockName);
      }
    } else {
      const next = localWatchlist.includes(stockName)
        ? localWatchlist.filter((n) => n !== stockName)
        : [...localWatchlist, stockName];
      setLocalWatchlist(next);
      localStorage.setItem("wl", JSON.stringify(next));
    }
  };

  return { watchlistNames, toggleWatchlist };
}

function BannerCarousel() {
  const [current, setCurrent] = useState(0);
  const total = BANNER_SLIDES.length;

  useEffect(() => {
    const t = setInterval(() => setCurrent((c) => (c + 1) % total), 3500);
    return () => clearInterval(t);
  }, [total]);

  const slide = BANNER_SLIDES[current];

  return (
    <div className="mb-4">
      <div
        className="relative rounded-2xl overflow-hidden h-28 flex items-center px-5 cursor-pointer select-none bg-white border border-[#eee] shadow-sm"
        onClick={() => setCurrent((c) => (c + 1) % total)}
        data-testid="banner-carousel"
      >
        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl" style={{ background: slide.accent }} />
        <div className="flex-1 pl-2">
          <span className="inline-block text-xs font-bold rounded-full px-2 py-0.5 mb-1" style={{ background: slide.tagBg, color: slide.accent }}>
            {slide.tag}
          </span>
          <div className="text-[#222] font-bold text-base leading-tight">{slide.title}</div>
          <div className="text-[#888] text-sm">{slide.subtitle}</div>
        </div>
        <div className="ml-4 shrink-0">{slide.icon}</div>
        <div className="absolute bottom-3 right-4 flex gap-1">
          {BANNER_SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); setCurrent(i); }}
              className={`h-1.5 rounded-full transition-all ${i === current ? "w-4" : "w-1.5 bg-gray-300"}`}
              style={i === current ? { background: slide.accent } : {}}
              data-testid={`banner-dot-${i}`}
            />
          ))}
        </div>
        <div className="absolute top-3 right-4 text-[#bbb] text-xs">{current + 1}/{total}</div>
      </div>

    </div>
  );
}

function WatchlistSection({
  user,
  watchlistNames,
  onToggleWatchlist,
}: {
  user: UserType | null;
  watchlistNames: string[];
  onToggleWatchlist: (name: string) => void;
}) {
  const [, setLocation] = useLocation();
  const [priceMap, setPriceMap] = useState<Record<string, { currentPrice: number; changePercent: number }>>({});
  const watchlistKey = JSON.stringify(watchlistNames);
  useEffect(() => {
    if (watchlistNames.length > 0) {
      fetchStockPrices(watchlistNames).then(setPriceMap);
    }
  }, [watchlistKey]);

  return (
    <div className="bg-white border border-[#E0E2E4] rounded-lg overflow-hidden" data-testid="watchlist-section">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F5F6]">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
          <span className="font-semibold text-sm text-[#14181B]">내 관심종목</span>
        </div>
        <span className="text-xs text-[#9D9FA0]">{watchlistNames.length}개</span>
      </div>

      {!user && (
        <div className="px-4 py-5 text-center">
          <Star className="w-8 h-8 text-[#E0E2E4] mx-auto mb-2" />
          <p className="text-sm text-[#585B5E] mb-3">로그인하면<br />관심종목을 확인할 수 있습니다</p>
          <button
            onClick={() => setLocation("/login")}
            className="text-xs text-[#03C75A] font-semibold border border-[#03C75A] rounded-full px-4 py-1.5 hover:bg-[#03C75A] hover:text-white transition-colors"
            data-testid="watchlist-login-btn"
          >
            로그인하기
          </button>
        </div>
      )}

      {user && watchlistNames.length === 0 && (
        <div className="px-4 py-5 text-center">
          <Star className="w-8 h-8 text-[#E0E2E4] mx-auto mb-2" />
          <p className="text-sm text-[#9D9FA0]">관심종목이 없습니다<br />종목 옆 ★를 눌러 추가하세요</p>
        </div>
      )}

      {user && watchlistNames.length > 0 && (
        <div className="divide-y divide-[#F3F5F6]">
          {watchlistNames.map((name) => {
            const p = priceMap[name];
            return (
              <div key={name} className="flex items-center gap-3 px-4 py-2.5" data-testid={`watchlist-item-${name}`}>
                <StockIcon name={name} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[#14181B] truncate">{name}</div>
                  <div className="text-xs text-[#9D9FA0]">{p ? `${p.currentPrice.toLocaleString()}원` : "미제공"}</div>
                </div>
                <div className={`text-xs font-semibold ${!p ? "text-[#9D9FA0]" : p.changePercent >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                  {!p ? "미제공" : `${p.changePercent >= 0 ? "+" : ""}${p.changePercent.toFixed(2)}%`}
                </div>
                <button
                  onClick={() => onToggleWatchlist(name)}
                  className="ml-1 text-yellow-400"
                  data-testid={`watchlist-remove-${name}`}
                >
                  <Star className="w-4 h-4 fill-yellow-400" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavDropdown({ label, items }: { label: string; items: { label: string; href: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button className="text-[13px] text-[#585B5E] px-2 py-1 whitespace-nowrap hover:text-[#14181B] transition-colors flex items-center gap-0.5">
        {label}
        <ChevronRight className="w-3 h-3 rotate-90 opacity-60" />
      </button>
      {open && (
        <div className="absolute top-full left-0 bg-white border border-[#E0E2E4] rounded-lg shadow-lg py-1 z-50 min-w-[120px]">
          {items.map((item) => (
            <a key={item.label} href={item.href} className="block px-4 py-2 text-[13px] text-[#585B5E] hover:bg-[#F3F5F6] hover:text-[#14181B] whitespace-nowrap">
              {item.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Header({ user, searchQuery, onSearchChange, onSearchFocus }: {
  user: UserType | null;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onSearchFocus: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await apiRequest("POST", "/api/auth/logout");
    queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
  };

  return (
    <header className="sticky top-0 z-[9999] bg-white border-b border-[#E0E2E4]" data-testid="header">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center justify-between gap-4 h-14">
          <Link href="/" data-testid="link-home">
            <div className="shrink-0 cursor-pointer">
              <SiteLogoBadge size={32} />
            </div>
          </Link>

          <div className="hidden md:flex flex-1 max-w-[360px] mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                onFocus={onSearchFocus}
                placeholder="종목명·초성·코드 검색"
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-[#F3F5F6] border-none text-sm text-[#14181B] placeholder-[#9D9FA0] outline-none focus:ring-1 focus:ring-[#03C75A]"
                data-testid="input-search"
              />
              {searchQuery.length > 0 && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  onClick={() => onSearchChange("")}
                  data-testid="button-search-clear"
                >
                  <X className="w-4 h-4 text-[#999]" />
                </button>
              )}
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[13px] text-[#585B5E] px-2 py-1 whitespace-nowrap hover:text-[#14181B] transition-colors"
                data-testid={`link-nav-${link.label}`}
              >
                {link.label}
              </a>
            ))}
            <Link href="/my-stocks">
              <span className="text-[13px] text-[#03C75A] font-bold px-3 py-1.5 ml-1 whitespace-nowrap border border-[#03C75A] rounded-full hover:bg-[#03C75A] hover:text-white transition-colors cursor-pointer" data-testid="link-nav-my-stocks">
                공모주 마이페이지
              </span>
            </Link>
          </nav>

          <div className="hidden md:flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <Link href="/dashboard">
                  <span className="flex items-center gap-1 text-sm text-[#585B5E] hover:text-[#14181B] cursor-pointer" data-testid="link-dashboard">
                    <User className="w-4 h-4" />
                    {user.fullName}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-[#585B5E] hover:text-[#F73631] transition-colors"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <span className="flex items-center gap-1 text-sm text-white bg-[#03C75A] px-3 py-1.5 rounded-md hover:bg-[#02b350] transition-colors cursor-pointer" data-testid="link-login">
                    <LogIn className="w-3.5 h-3.5" />
                    로그인
                  </span>
                </Link>
                <Link href="/register">
                  <span className="text-sm text-[#585B5E] hover:text-[#14181B] cursor-pointer" data-testid="link-register">
                    회원가입
                  </span>
                </Link>
              </>
            )}
          </div>

          <button
            className="lg:hidden flex items-center justify-center w-9 h-9"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="button-mobile-menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#222]" /> : <Menu className="w-5 h-5 text-[#222]" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-[#E0E2E4] px-4 py-3 space-y-2">
          <div className="md:hidden mb-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9D9FA0]" />
              <input
                type="text"
                placeholder="종목명·초성·코드 검색"
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-[#F3F5F6] border-none text-sm text-[#14181B] placeholder-[#9D9FA0] outline-none"
                data-testid="input-search-mobile"
              />
            </div>
          </div>
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="block text-sm text-[#585B5E] py-2 hover:text-[#14181B]"
              data-testid={`link-mobile-nav-${link.label}`}
            >
              {link.label}
            </a>
          ))}
          <Link href="/dashboard">
            <span className="block text-sm text-[#03C75A] font-bold py-2 cursor-pointer" data-testid="link-mobile-nav-member-transfer">
              주식 이전 신청
            </span>
          </Link>
          <Link href="/my-stocks">
            <span className="block text-sm text-[#03C75A] font-bold py-2 cursor-pointer" data-testid="link-mobile-nav-my-stocks">
              공모주 마이페이지
            </span>
          </Link>
          <Link href="/chat">
            <span className="block text-sm text-[#03C75A] font-bold py-2 cursor-pointer" data-testid="link-mobile-nav-chat">
              상담문의하기
            </span>
          </Link>
          <div className="border-t border-[#E0E2E4] pt-3 flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard">
                  <span className="text-sm text-[#14181B] font-medium cursor-pointer" data-testid="link-mobile-dashboard">{user.fullName}</span>
                </Link>
                <button onClick={handleLogout} className="text-sm text-[#03C75A]" data-testid="button-mobile-logout">로그아웃</button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <span className="text-sm text-white bg-[#03C75A] px-4 py-1.5 rounded-md cursor-pointer" data-testid="link-mobile-login">로그인</span>
                </Link>
                <Link href="/register">
                  <span className="text-sm text-[#585B5E] cursor-pointer" data-testid="link-mobile-register">회원가입</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function fmtPrice(price: number | null): string {
  if (price === null) return "미제공";
  return price.toLocaleString() + "원";
}

function fmtChange(change: number | null): { text: string; cls: string } {
  if (change === null) return { text: "미제공", cls: "text-[#9D9FA0]" };
  if (change === 0) return { text: "0%", cls: "text-[#9D9FA0]" };
  return {
    text: `${change > 0 ? "+" : ""}${change}%`,
    cls: change > 0 ? "text-[#F73631]" : "text-[#007EFF]",
  };
}

function fmtOrders(orders: number | null): string {
  if (orders === null) return "미제공";
  return orders + "건";
}

type ColDef = { label: string; right?: boolean; info?: boolean };

function getColDefs(tab: string): ColDef[] {
  switch (tab) {
    case "상승률 높은":
      return [
        { label: "상승률", right: true, info: true },
        { label: "전체주문", right: true },
        { label: "구분", right: true },
      ];
    case "상장준비 시작":
      return [
        { label: "기준일자", right: true },
        { label: "심사유형", right: true, info: true },
        { label: "구분", right: true },
      ];
    case "예상시총 높은":
      return [
        { label: "예상시총", right: true, info: true },
        { label: "전체주문", right: true },
        { label: "구분", right: true },
      ];
    case "매출이 상승한":
      return [
        { label: "결산연도", right: true },
        { label: "매출상승률", right: true, info: true },
        { label: "구분", right: true },
      ];
    default:
      return [
        { label: "체결평균가", right: true, info: true },
        { label: "등락률", right: true },
        { label: "전체주문", right: true },
        { label: "구분", right: true },
      ];
  }
}

function getCells(stock: StockRow, tab: string): ReactNode[] {
  switch (tab) {
    case "상승률 높은":
      return [
        <span className="text-[#9D9FA0]">미제공</span>,
        <span className="text-[#9D9FA0]">미제공</span>,
        <span className="text-[#585B5E]">{stock.category}</span>,
      ];
    case "상장준비 시작":
      return [
        <span className="text-[#9D9FA0] tabular-nums">{stock.ipoDate ?? "—"}</span>,
        <span className="text-[#9D9FA0]">{stock.reviewType ?? "—"}</span>,
        <span className="text-[#585B5E]">{stock.category}</span>,
      ];
    case "예상시총 높은": {
      const capStr = stock.marketCapStr ?? "미제공";
      const capCls = capStr === "미제공" ? "text-[#9D9FA0]" : "text-[#14181B] font-medium";
      return [
        <span className={`tabular-nums ${capCls}`}>{capStr}</span>,
        <span className={stock.orders !== null ? "text-[#585B5E] tabular-nums" : "text-[#9D9FA0]"}>{fmtOrders(stock.orders)}</span>,
        <span className="text-[#585B5E]">{stock.category}</span>,
      ];
    }
    case "매출이 상승한":
      return [
        <span className="text-[#9D9FA0] tabular-nums">{stock.fiscalYear ?? "—"}</span>,
        <span className="text-[#F73631] font-medium tabular-nums">{stock.revenueGrowthStr ?? "—"}</span>,
        <span className="text-[#585B5E]">{stock.category}</span>,
      ];
    default: {
      const ch = fmtChange(stock.change);
      return [
        <span className={stock.price !== null ? "text-[#14181B] font-medium tabular-nums" : "text-[#9D9FA0]"}>{fmtPrice(stock.price)}</span>,
        <span className={`tabular-nums font-medium ${ch.cls}`}>{ch.text}</span>,
        <span className={stock.orders !== null ? "text-[#585B5E] tabular-nums" : "text-[#9D9FA0]"}>{fmtOrders(stock.orders)}</span>,
        <span className="text-[#585B5E]">{stock.category}</span>,
      ];
    }
  }
}

function getMobileSub(stock: StockRow, tab: string): ReactNode {
  switch (tab) {
    case "상승률 높은":
      return <span className="text-[11px] text-[#9D9FA0]">상승률 미제공 · {stock.category}</span>;
    case "상장준비 시작":
      return <span className="text-[11px] text-[#9D9FA0]">{stock.ipoDate ?? "—"} · {stock.reviewType} · {stock.category}</span>;
    case "예상시총 높은":
      return <span className="text-[11px] text-[#9D9FA0]">{stock.marketCapStr ?? "미제공"} · {stock.category}</span>;
    case "매출이 상승한":
      return <span className="text-[11px] text-[#9D9FA0]">{stock.fiscalYear} · {stock.category}</span>;
    default:
      return <span className="text-[11px] text-[#9D9FA0]">{fmtOrders(stock.orders)} · {stock.category}</span>;
  }
}

function getMobileRight(stock: StockRow, tab: string): ReactNode {
  switch (tab) {
    case "상승률 높은":
      return <p className="text-sm text-[#9D9FA0]">미제공</p>;
    case "상장준비 시작":
      return null;
    case "예상시총 높은": {
      const capStr = stock.marketCapStr ?? "미제공";
      return <p className={`text-sm tabular-nums ${capStr === "미제공" ? "text-[#9D9FA0]" : "text-[#14181B] font-medium"}`}>{capStr}</p>;
    }
    case "매출이 상승한":
      return <p className="text-sm text-[#F73631] font-medium tabular-nums">{stock.revenueGrowthStr ?? "—"}</p>;
    default: {
      const ch = fmtChange(stock.change);
      return (
        <>
          <p className={`text-sm font-medium tabular-nums ${stock.price !== null ? "text-[#14181B]" : "text-[#9D9FA0]"}`}>{fmtPrice(stock.price)}</p>
          <p className={`text-xs tabular-nums font-medium ${ch.cls}`}>{ch.text}</p>
        </>
      );
    }
  }
}

function fmtMarketCap(cap: number | null | undefined): string {
  if (!cap || cap === 0) return "미제공";
  const jo = Math.floor(cap / 1_000_000_000_000);
  const eok = Math.floor((cap % 1_000_000_000_000) / 100_000_000);
  if (jo > 0 && eok > 0) return `${jo}조 ${eok.toLocaleString()}억`;
  if (jo > 0) return `${jo}조`;
  return `${eok.toLocaleString()}억`;
}

function rowToStockRow(row: any, tab: string): StockRow {
  const isIPO = tab === "상장준비 시작" || !!row.ipoDate || !!row.reviewType;
  const category: "일반" | "전문" = row.type === "UNIFIED" ? "일반" : "전문";
  const price = typeof row.currentPrice === "number" && row.currentPrice > 0 ? row.currentPrice : null;
  const change = typeof row.changeRate === "number" ? row.changeRate : null;
  const orders = typeof row.orderCount === "number" ? row.orderCount : null;
  let ipoDateStr: string | undefined;
  if (row.ipoDate) {
    try {
      const d = new Date(row.ipoDate);
      ipoDateStr = `${String(d.getFullYear()).slice(2)}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch { ipoDateStr = row.ipoDate; }
  }
  const revenueGrowthStr = typeof row.salesRevenueGrowthRate === "number"
    ? `${row.salesRevenueGrowthRate >= 0 ? "+" : ""}${row.salesRevenueGrowthRate.toFixed(2)}%`
    : undefined;
  const fiscalYear = row.fiscalYear ? `${row.fiscalYear}년` : undefined;
  const marketCapStr = fmtMarketCap(row.estimatedMarketCap);
  return { name: row.stockName, category, isIPO, price, change, orders, marketCapStr, ipoDate: ipoDateStr, reviewType: row.reviewType, fiscalYear, revenueGrowthStr };
}

function StockRankings({
  watchlistNames,
  onToggleWatchlist,
}: {
  watchlistNames: string[];
  onToggleWatchlist: (name: string) => void;
}) {
  const [activeTab, setActiveTab] = useState("일반종목");
  const [showAll, setShowAll] = useState(false);
  const [, navigate] = useLocation();

  const { data: rankingData, isLoading: rankingLoading } = useQuery<{ data: { type: string; name: string; rows: any[] }[]; lastUpdated?: string }>({
    queryKey: ["/api/market/rankings"],
    refetchInterval: 5 * 60 * 1000,
  });

  const rankGroups = rankingData?.data || [];
  const seenNames = new Set<string>();
  const uniqueGroups = rankGroups.filter(g => {
    if (seenNames.has(g.name)) return false;
    seenNames.add(g.name);
    return true;
  });
  const availableTabs = uniqueGroups.length > 0
    ? uniqueGroups.map(g => g.name)
    : RANKING_TABS;

  const activeGroup = uniqueGroups.find(g => g.name === activeTab);
  const allStocks: StockRow[] = (activeGroup?.rows || []).map(r => rowToStockRow(r, activeTab));
  const displayStocks = showAll ? allStocks : allStocks.slice(0, 10);

  const cols = getColDefs(activeTab);

  const tsDate = rankingData?.lastUpdated ? new Date(rankingData.lastUpdated) : new Date();
  const timeStr = `${String(tsDate.getFullYear()).slice(2)}.${String(tsDate.getMonth() + 1).padStart(2, "0")}.${String(tsDate.getDate()).padStart(2, "0")} ${String(tsDate.getHours()).padStart(2, "0")}:${String(tsDate.getMinutes()).padStart(2, "0")} 기준`;

  const gridCols = cols.length === 4
    ? "grid-cols-[40px_1fr_110px_80px_70px_44px_36px]"
    : "grid-cols-[40px_1fr_130px_80px_70px_36px]";

  return (
    <section id="rankings" data-testid="section-stock-rankings">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-[22px] font-semibold text-[#14181B]">종목 순위</h2>
          <span className="text-xs text-[#9D9FA0]">{timeStr}</span>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none">
        {availableTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setShowAll(false); }}
            className={`h-8 px-3 rounded-[44px] text-sm whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-[#2E343A] text-[#F9FAFB]"
                : "bg-[#F3F5F6] text-[#585B5E] hover:bg-[#E0E2E4]"
            }`}
            data-testid={`tab-ranking-${tab}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "상승률 높은" && (
        <div className="text-xs text-[#585B5E] mb-2 flex items-center gap-1">
          <span>3개월 전 대비</span>
          <ChevronRight className="w-3 h-3" />
        </div>
      )}

      {rankingLoading && (
        <div className="border border-[#E0E2E4] rounded-lg overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#F3F5F6] last:border-b-0">
              <div className="w-5 h-4 bg-[#F3F5F6] rounded animate-pulse" />
              <div className="w-8 h-8 bg-[#F3F5F6] rounded-full animate-pulse" />
              <div className="flex-1 h-4 bg-[#F3F5F6] rounded animate-pulse" />
              <div className="w-20 h-4 bg-[#F3F5F6] rounded animate-pulse" />
            </div>
          ))}
        </div>
      )}

      {!rankingLoading && <div className="border border-[#E0E2E4] rounded-lg overflow-hidden">
        {/* Desktop header */}
        <div className={`hidden sm:grid ${gridCols} gap-0 px-4 py-2.5 bg-[#F9FAFB] text-xs text-[#9D9FA0] border-b border-[#E0E2E4]`}>
          <span></span>
          <span className="font-medium">종목명</span>
          {cols.map((col, i) => (
            <span key={i} className={`${col.right ? "text-right" : ""} flex items-center ${col.right ? "justify-end" : ""} gap-0.5`}>
              {col.label}
              {col.info && <span className="text-[10px] ml-0.5">&#9660;</span>}
            </span>
          ))}
          <span></span>
        </div>

        {/* Desktop rows */}
        {displayStocks.map((stock, idx) => {
          const starred = watchlistNames.includes(stock.name);
          const cells = getCells(stock, activeTab);
          return (
            <div
              key={`d-${stock.name}-${idx}`}
              className={`hidden sm:grid ${gridCols} gap-0 px-4 py-3 border-b border-[#F3F5F6] last:border-b-0 hover:bg-[#F9FAFB] transition-colors items-center`}
              data-testid={`row-stock-${idx}`}
            >
              <span
                className="text-sm text-[#9D9FA0] font-medium cursor-pointer"
                onClick={() => navigate(`/stock/${encodeURIComponent(stock.name)}`)}
              >{idx + 1}</span>
              <div
                className="flex items-center gap-2.5 cursor-pointer"
                onClick={() => navigate(`/stock/${encodeURIComponent(stock.name)}`)}
              >
                <StockIcon name={stock.name} size={32} />
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-[#14181B]">{stock.name}</span>
                  {stock.isIPO && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-[#E0E2E4] text-[#9D9FA0] font-medium leading-none">IPO</span>
                  )}
                </div>
              </div>
              {cells.map((cell, ci) => (
                <div
                  key={ci}
                  className="text-sm text-right cursor-pointer"
                  onClick={() => navigate(`/stock/${encodeURIComponent(stock.name)}`)}
                >
                  {cell}
                </div>
              ))}
              <button
                onClick={(e) => { e.stopPropagation(); onToggleWatchlist(stock.name); }}
                className="flex items-center justify-end"
                data-testid={`btn-star-${idx}`}
                title={starred ? "관심종목 해제" : "관심종목 추가"}
              >
                <Star
                  className={`w-4 h-4 transition-colors ${starred ? "text-yellow-400 fill-yellow-400" : "text-[#E0E2E4] hover:text-yellow-300"}`}
                />
              </button>
            </div>
          );
        })}

        {/* Mobile rows */}
        {displayStocks.map((stock, idx) => {
          const starred = watchlistNames.includes(stock.name);
          return (
            <div
              key={`m-${stock.name}-${idx}`}
              className="sm:hidden flex items-center gap-3 px-3 py-3 border-b border-[#F3F5F6] last:border-b-0 hover:bg-[#F9FAFB] transition-colors"
              data-testid={`row-stock-mobile-${idx}`}
            >
              <span className="text-xs text-[#9D9FA0] font-medium w-5 shrink-0 text-center">{idx + 1}</span>
              <div
                className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                onClick={() => navigate(`/stock/${encodeURIComponent(stock.name)}`)}
              >
                <StockIcon name={stock.name} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-[#14181B] truncate">{stock.name}</span>
                    {stock.isIPO && (
                      <span className="text-[10px] px-1 py-0.5 rounded border border-[#E0E2E4] text-[#9D9FA0] font-medium leading-none shrink-0">IPO</span>
                    )}
                  </div>
                  {getMobileSub(stock, activeTab)}
                </div>
                <div className="text-right shrink-0">
                  {getMobileRight(stock, activeTab)}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onToggleWatchlist(stock.name); }}
                className="shrink-0 p-1"
                data-testid={`btn-star-mobile-${idx}`}
              >
                <Star
                  className={`w-4 h-4 transition-colors ${starred ? "text-yellow-400 fill-yellow-400" : "text-[#E0E2E4]"}`}
                />
              </button>
            </div>
          );
        })}
      </div>}
    </section>
  );
}

const PUBLISHER_DOMAINS: Record<string, string> = {
  "서울경제": "sedaily.com",
  "한국경제": "hankyung.com",
  "매일경제": "mk.co.kr",
  "조선비즈": "biz.chosun.com",
  "조선일보": "chosun.com",
  "머니투데이": "mt.co.kr",
  "네이트": "nate.com",
  "라이센스뉴스": "licensenews.kr",
  "중앙일보": "joongang.co.kr",
  "연합뉴스": "yna.co.kr",
  "연합인포맥스": "einfomax.co.kr",
  "시사저널": "sisajournal.com",
  "v.daum.net": "daum.net",
  "이데일리": "edaily.co.kr",
  "뉴스1": "news1.kr",
  "아시아경제": "asiae.co.kr",
  "파이낸셜뉴스": "fnnews.com",
  "헤럴드경제": "heraldcorp.com",
  "디지털데일리": "ddaily.co.kr",
  "블로터": "bloter.net",
};

function PublisherLogo({ publisher, size = 28 }: { publisher: string; size?: number }) {
  const domain = PUBLISHER_DOMAINS[publisher];
  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
    : null;

  if (faviconUrl) {
    return (
      <img
        src={faviconUrl}
        alt={publisher}
        className="rounded-full shrink-0 object-cover bg-white"
        style={{ width: size, height: size }}
        loading="lazy"
        decoding="async"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.style.display = "none";
          target.parentElement?.querySelector(".fallback")?.classList.remove("hidden");
        }}
      />
    );
  }

  const initial = publisher.charAt(0);
  return (
    <div
      className="rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 bg-[#888]"
      style={{ width: size, height: size }}
    >
      {initial}
    </div>
  );
}

function NewsItemIcon({ logoUrl, publisher, stockName }: { logoUrl?: string; publisher: string; stockName?: string }) {
  const [imgErr, setImgErr] = useState(false);
  if (logoUrl && !imgErr) {
    return (
      <img
        src={logoUrl}
        alt={stockName || publisher}
        className="w-7 h-7 rounded-full object-cover shrink-0 bg-[#f5f5f5]"
        onError={() => setImgErr(true)}
        loading="lazy"
      />
    );
  }
  return <PublisherLogo publisher={publisher} size={28} />;
}

function MajorNews() {
  const { data: newsData } = useQuery<{ title: string; publisher: string; link: string; logoUrl?: string; stockName?: string; publishedAt: string }[]>({
    queryKey: ["/api/stocks/news"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 5 * 60 * 1000,
  });

  const fallbackNews = [
    { title: "두나무, 폴리곤 스테이킹 글로벌 1위…국내 거래소 경쟁력 입증", publisher: "헤럴드경제", link: "#", publishedAt: "2026.06.24" },
    { title: "무신사 뷰티 협업 전략, 브랜드 성장으로", publisher: "뉴시스", link: "#", publishedAt: "2026.06.24" },
    { title: "레몬헬스케어, 공모가 상단 1만원 확정…24~25일 일반청약", publisher: "한국경제", link: "#", publishedAt: "2026.06.24" },
    { title: "'휴대용 엑스레이' 레메디, 최대 1571억 상장시총 도전", publisher: "이데일리", link: "#", publishedAt: "2026.06.24" },
    { title: "스트라드비젼, 글로벌 비전 AI 시장 공략 본격화..30일 코스닥 입성", publisher: "머니투데이", link: "#", publishedAt: "2026.06.24" },
  ];

  const news = (newsData && newsData.length > 0) ? newsData : fallbackNews;

  return (
    <section id="news" data-testid="section-major-news">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[22px] font-semibold text-[#14181B]">주요 뉴스</h2>
      </div>
      <div className="space-y-0 border border-[#E0E2E4] rounded-lg overflow-hidden">
        {(news as any[]).slice(0, 5).map((item: any, i: number) => (
          <a
            key={i}
            href={item.link || item.url || `https://search.naver.com/search.naver?query=${encodeURIComponent(item.title)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F3F5F6] last:border-b-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
            data-testid={`row-news-${i}`}
          >
            <div className="shrink-0">
              <NewsItemIcon logoUrl={item.logoUrl} publisher={item.publisher || item.source || ""} stockName={item.stockName} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#14181B] leading-snug line-clamp-2">{item.title}</p>
              <p className="text-xs text-[#9D9FA0] mt-0.5">{item.publisher || item.source} · {item.publishedAt || item.date}</p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-[#BFC0C1] shrink-0" />
          </a>
        ))}
      </div>
    </section>
  );
}

function ExpertReports() {
  const [showAll, setShowAll] = useState(false);
  const [, navigate] = useLocation();
  const { data: reportsData, isLoading } = useQuery<{ data: { expertReportId: number; sourceProvider: string; reportCreator: string; title: string; preview?: string; createdAt?: string }[] }>({
    queryKey: ["/api/market/expert-reports"],
    refetchInterval: 5 * 60 * 1000,
  });

  const fallbackReports: NonNullable<typeof reportsData>["data"] = [
    { expertReportId: 1, sourceProvider: "삼성증권", reportCreator: "삼성증권 이영진", title: "[앤스로픽] 3,500억 달러 기업 가치, AI 시장의 새로운 리더" },
    { expertReportId: 2, sourceProvider: "네이버페이", reportCreator: "네이버페이 이종욱", title: "[반도체·로봇] Korea Startup Scaleup Day" },
    { expertReportId: 3, sourceProvider: "네이버페이", reportCreator: "네이버페이 최민하", title: "[KT클라우드] 국내 대표 AI 인프라 기업" },
    { expertReportId: 4, sourceProvider: "네이버페이", reportCreator: "네이버페이 서근희", title: "[에임드바이오] 스크리닝 기술로 키운 ADC 파이프라인의 가치" },
  ];

  const reports = (reportsData?.data && reportsData.data.length > 0) ? reportsData.data : fallbackReports;

  const fmtDate = (iso?: string) => {
    if (!iso) return "";
    try { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`; }
    catch { return ""; }
  };

  return (
    <section id="reports" data-testid="section-expert-reports">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[22px] font-semibold text-[#14181B]">전문가 리포트</h2>
      </div>
      {isLoading ? (
        <div className="border border-[#E0E2E4] rounded-lg overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3.5 border-b border-[#F3F5F6] last:border-b-0">
              <div className="w-7 h-7 bg-[#F3F5F6] rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-[#F3F5F6] rounded animate-pulse w-3/4" />
                <div className="h-3 bg-[#F3F5F6] rounded animate-pulse w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-0 border border-[#E0E2E4] rounded-lg overflow-hidden">
          {(showAll ? reports : reports.slice(0, 5)).map((report, i) => (
            <div
              key={report.expertReportId || i}
              className="flex items-start gap-3 px-4 py-3.5 border-b border-[#F3F5F6] last:border-b-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              data-testid={`row-report-${i}`}
              onClick={() => report.expertReportId && navigate(`/expert-report/${report.expertReportId}`)}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#14181B] leading-snug line-clamp-2">{report.title}</p>
                <p className="text-xs text-[#9D9FA0] mt-1">
                  {report.reportCreator || report.sourceProvider}
                  {report.createdAt ? ` | ${fmtDate(report.createdAt)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

    </section>
  );
}

function ThemeStocks() {
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [showAllStocks, setShowAllStocks] = useState(false);

  const { data: themesData, isLoading } = useQuery<{ data: { keywordId: number; keywordName: string; description: string; includedStocks: any[] }[] }>({
    queryKey: ["/api/market/themes"],
    refetchInterval: 5 * 60 * 1000,
  });

  const themes = themesData?.data || [];
  const currentThemeName = activeTheme ?? themes[0]?.keywordName ?? "";
  const currentTheme = themes.find(t => t.keywordName === currentThemeName) || themes[0];

  const handleThemeChange = (name: string) => {
    setActiveTheme(name);
    setShowAllStocks(false);
  };

  return (
    <section id="themes" data-testid="section-theme-stocks">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[22px] font-semibold text-[#14181B]">테마별 종목</h2>
      </div>

      {isLoading ? (
        <div className="rounded-xl bg-[#F3F5F6] animate-pulse h-[140px]" />
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ background: "linear-gradient(135deg, #E8973F 0%, #D4761F 100%)" }}>
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-2">
              {themes.map((theme) => (
                <button
                  key={theme.keywordId}
                  onClick={() => handleThemeChange(theme.keywordName)}
                  className={`shrink-0 text-sm whitespace-nowrap px-0 mr-4 pb-1 transition-all ${
                    currentThemeName === theme.keywordName
                      ? "text-white font-bold border-b-2 border-white"
                      : "text-white/70 hover:text-white"
                  }`}
                  data-testid={`tab-theme-${theme.keywordName}`}
                >
                  #{theme.keywordName}
                </button>
              ))}
            </div>
            {currentTheme && (
              <p className="text-white/80 text-xs mt-1 mb-3 leading-relaxed">{currentTheme.description}</p>
            )}
          </div>
          {currentTheme && (
            <div className="bg-white/10 px-4 py-3 flex items-center flex-wrap gap-2">
              {(showAllStocks ? currentTheme.includedStocks || [] : (currentTheme.includedStocks || []).slice(0, 5)).map((stock: any) => (
                <span
                  key={stock.code || stock.name}
                  className="px-3 py-1 bg-white/20 rounded-full text-sm text-white"
                  data-testid={`tag-company-${stock.name}`}
                >
                  {stock.name}
                </span>
              ))}
              {!showAllStocks && (currentTheme.includedStocks || []).length > 5 && (
                <button
                  onClick={() => setShowAllStocks(true)}
                  className="text-sm text-white/80 font-medium hover:text-white"
                >
                  +{(currentTheme.includedStocks || []).length - 5}개 기업
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ExpertReportModal({ reportId, onClose }: { reportId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ report: any }>({
    queryKey: [`/api/market/expert-report/${reportId}`],
    staleTime: 5 * 60 * 1000,
  });

  const report = data?.report;

  const fmtDate = (iso?: string) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch { return ""; }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl w-full max-h-[85vh] flex flex-col p-0 gap-0">
        {/* 헤더 */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-[#F3F5F6] shrink-0">
          <DialogTitle className="text-[17px] font-bold text-[#14181B] leading-snug pr-6">
            {isLoading
              ? <div className="h-5 bg-[#F3F5F6] rounded animate-pulse w-3/4" />
              : (report?.title || "")}
          </DialogTitle>
          {!isLoading && report && (
            <p className="text-xs text-[#9D9FA0] mt-1.5">
              {report.reportCreator || report.sourceProvider}
              {report.publishedAt ? ` ${fmtDate(report.publishedAt)}` : (report.createdAt ? ` ${fmtDate(report.createdAt)}` : "")}
            </p>
          )}
        </DialogHeader>

        {/* 본문 */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-3 bg-[#F3F5F6] rounded animate-pulse" style={{ width: `${60 + (i % 3) * 15}%` }} />
              ))}
            </div>
          ) : report ? (
            <>
              {/* 버튼 영역 */}
              {report.urlPdf && (
                <div className="flex gap-2 mb-5">
                  <a
                    href={report.urlPdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E0E2E4] rounded text-xs text-[#14181B] hover:bg-[#F3F5F6] transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    리포트 원문보기
                  </a>
                </div>
              )}

              {/* 리포트 본문 HTML */}
              {report.previewContent ? (
                <div
                  className="text-sm text-[#14181B] leading-relaxed report-body"
                  dangerouslySetInnerHTML={{ __html: report.previewContent }}
                />
              ) : (
                <p className="text-sm text-[#9D9FA0]">본문 내용이 없습니다.</p>
              )}

              {/* 면책 고지 */}
              {report.sourceProviderComment && (
                <div className="mt-6 pt-4 border-t border-[#F3F5F6]">
                  <p className="text-[11px] text-[#9D9FA0] leading-relaxed whitespace-pre-wrap">
                    {report.sourceProviderComment}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[#9D9FA0] text-center py-8">내용을 불러올 수 없습니다.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DiscussionPostModal({ postId, onClose }: { postId: number; onClose: () => void }) {
  const { data, isLoading } = useQuery<{ post: any; comments: any[] }>({
    queryKey: [`/api/market/discuss/post/${postId}`],
    staleTime: 2 * 60 * 1000,
  });

  const post = data?.post;
  const comments = data?.comments || [];

  const formatDate = (iso: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 3600000);
    if (diff < 1) return "방금 전";
    if (diff < 24) return `${diff}시간 전`;
    return `${Math.floor(diff / 24)}일 전`;
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg w-full max-h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-[#F3F5F6] shrink-0">
          <DialogTitle className="text-base font-bold text-[#14181B] leading-snug pr-6">
            {isLoading ? <div className="h-5 bg-[#F3F5F6] rounded animate-pulse w-3/4" /> : (post?.subject || "")}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {isLoading ? (
            <div className="space-y-3">
              <div className="h-3 bg-[#F3F5F6] rounded animate-pulse w-1/4" />
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-3 bg-[#F3F5F6] rounded animate-pulse" style={{ width: `${70 + Math.random() * 30}%` }} />
                ))}
              </div>
            </div>
          ) : post ? (
            <>
              {/* 작성자 */}
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-[#E0E2E4] flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-semibold text-[#585B5E]">{(post.nickName || "익명").charAt(0)}</span>
                </div>
                <span className="text-xs font-medium text-[#585B5E]">{post.nickName || "익명"}</span>
                <span className="text-xs text-[#BFC0C1] ml-auto">{formatDate(post.createdAt)}</span>
              </div>

              {/* 본문 */}
              <p className="text-sm text-[#14181B] leading-relaxed whitespace-pre-wrap mb-4">{post.body || ""}</p>

              {/* 좋아요 / 댓글 수 */}
              <div className="flex items-center gap-4 py-3 border-t border-b border-[#F3F5F6] mb-4">
                <span className="flex items-center gap-1 text-xs text-[#585B5E]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>
                  {post.countLike ?? 0}
                </span>
                <span className="flex items-center gap-1 text-xs text-[#585B5E]">
                  <MessageCircle size={14} />
                  {post.countComment ?? 0}
                </span>
                {post.stockName && (
                  <span className="ml-auto text-xs px-2 py-0.5 bg-[#F3F5F6] rounded text-[#585B5E]">{post.stockName}</span>
                )}
              </div>

              {/* 댓글 */}
              {comments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#14181B] mb-3">댓글 {comments.length}</p>
                  <div className="space-y-4">
                    {comments.map((c: any) => (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#E0E2E4] flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-[10px] font-semibold text-[#585B5E]">{(c.nickName || "익명").charAt(0)}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-[#585B5E]">{c.nickName || "익명"}</span>
                            <span className="text-xs text-[#BFC0C1]">{formatDate(c.createdAt)}</span>
                          </div>
                          <p className="text-xs text-[#14181B] leading-relaxed">{c.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-[#9D9FA0] text-center py-8">내용을 불러올 수 없습니다.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PopularDiscussions() {
  const [showAll, setShowAll] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<number | null>(null);

  const { data: discussionsData, isLoading } = useQuery<{ data: { discussStocks: any[]; discussPosts: any[] } }>({
    queryKey: ["/api/market/discussions"],
    refetchInterval: 5 * 60 * 1000,
  });

  const posts = discussionsData?.data?.discussPosts || [];

  const fallbackPosts = [
    { id: 1, nickName: "투자마스터", body: "두나무 실적 발표 이후 거래량이 확 늘었네요. 긍정적인 흐름입니다.", stockName: "두나무" },
    { id: 2, nickName: "비상장전문가", body: "무신사 상장 준비 소식 들으셨나요? 패션 플랫폼 중에서는 독보적입니다.", stockName: "무신사" },
    { id: 3, nickName: "IPO분석가", body: "빗썸 거래량이 지속적으로 증가하고 있어요. 코인 시장 상승과 맞물려서 좋은 흐름입니다.", stockName: "빗썸" },
    { id: 4, nickName: "장기투자자", body: "야놀자 여행 수요 증가로 실적 기대됩니다. 장기 보유 전략이 유효할 것 같습니다.", stockName: "야놀자" },
    { id: 5, nickName: "에스엠랩팬", body: "에스엠랩 최근 실적 발표가 기대 이상이었네요. 비상장 중에서 주목해야 할 종목입니다.", stockName: "에스엠랩" },
  ];

  const displayPosts = posts.length > 0 ? posts : fallbackPosts;

  return (
    <section id="discussions" data-testid="section-popular-discussions">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[22px] font-semibold text-[#14181B]">인기 토론</h2>
      </div>
      {isLoading ? (
        <div className="space-y-0 border border-[#E0E2E4] rounded-lg overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-4 border-b border-[#F3F5F6] last:border-b-0">
              <div className="w-8 h-8 bg-[#F3F5F6] rounded-full animate-pulse shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-[#F3F5F6] rounded animate-pulse w-1/3" />
                <div className="h-4 bg-[#F3F5F6] rounded animate-pulse w-3/4" />
                <div className="h-3 bg-[#F3F5F6] rounded animate-pulse w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-0 border border-[#E0E2E4] rounded-lg overflow-hidden">
          {(showAll ? displayPosts : displayPosts.slice(0, 4)).map((post: any, idx: number) => (
            <div
              key={post.id || idx}
              className="px-4 py-4 border-b border-[#F3F5F6] last:border-b-0 hover:bg-[#F9FAFB] transition-colors cursor-pointer"
              data-testid={`card-discussion-${post.id || idx}`}
              onClick={() => post.id && typeof post.id === "number" && setSelectedPostId(post.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-[#E0E2E4] flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-semibold text-[#585B5E]">{(post.nickName || "익명").charAt(0)}</span>
                </div>
                <span className="text-xs font-medium text-[#585B5E]">{post.nickName || "익명"}</span>
                <span className="text-xs text-[#BFC0C1] ml-auto">{post.createdAt ? (() => { const d = new Date(post.createdAt); const diff = Math.floor((Date.now() - d.getTime()) / 86400000); return diff === 0 ? "오늘" : `${diff}일 전`; })() : "1일 전"}</span>
              </div>
              <p className="text-sm font-semibold text-[#14181B] leading-snug mb-1">{post.subject || post.title || (post.body || "").slice(0, 40)}</p>
              <p className="text-xs text-[#9D9FA0] leading-relaxed line-clamp-2 mb-2">{post.body || post.subject || ""}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#03C75A]">더보기</span>
                {post.stockName && (
                  <span className="text-xs px-2 py-0.5 bg-[#F3F5F6] rounded text-[#585B5E] ml-auto">{post.stockName}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedPostId !== null && (
        <DiscussionPostModal postId={selectedPostId} onClose={() => setSelectedPostId(null)} />
      )}
    </section>
  );
}

function IPOUpcomingSidebar() {
  const [activeTab, setActiveTab] = useState<"진행중" | "예정">("진행중");

  const { data: ipoCalendarData, isLoading } = useQuery<{ naverData?: { beingIPOList: any[]; toBeIPOList: any[] }; ipo38?: any[] }>({
    queryKey: ["/api/market/ipo-calendar"],
    refetchInterval: 5 * 60 * 1000,
  });

  const naverData = ipoCalendarData?.naverData;
  const ipo38 = ipoCalendarData?.ipo38 || [];
  const todayMs = new Date().setHours(0, 0, 0, 0);

  function parseLD(s: string) { const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2]-1, +m[3]).getTime() : NaN; }

  // 38.co.kr 기준: 진행중 (오늘이 청약시작~청약종료 사이)
  const ipo38Ongoing = ipo38.filter((x: any) => x.subscriptionStartDate && x.subscriptionEndDate && parseLD(x.subscriptionStartDate) <= todayMs && todayMs <= parseLD(x.subscriptionEndDate));
  // 38.co.kr 기준: 청약예정 (청약시작일이 오늘 이후)
  const ipo38Upcoming = ipo38.filter((x: any) => x.subscriptionStartDate && parseLD(x.subscriptionStartDate) > todayMs);

  const ipo38OngoingNames = new Set(ipo38Ongoing.map((x: any) => x.stockName));
  const ipo38UpcomingNames = new Set(ipo38Upcoming.map((x: any) => x.stockName));

  // 네이버 데이터만 사용 (네이버 비상장 원본과 동일하게)
  const ongoing = (naverData?.beingIPOList || []).map((item: any) => ({
    stockName: item.stockName,
    startDate: item.offeringStartAt || "",
    endDate: item.closedDate || "",
    priceMin: item.minExpectedOfferPrice || item.finalOfferPrice || 0,
    priceMax: item.maxExpectedOfferPrice || item.finalOfferPrice || 0,
    competitionRate: item.instCompetitiveness != null ? `${item.instCompetitiveness}:1` : null,
    logoUrl: item.logoUrl || null,
  }));

  const upcoming = (naverData?.toBeIPOList || []).map((item: any) => ({
    stockName: item.stockName,
    startDate: item.offeringStartAt || "",
    endDate: item.closedDate || "",
    priceMin: item.minExpectedOfferPrice || 0,
    priceMax: item.maxExpectedOfferPrice || 0,
    competitionRate: item.instCompetitiveness != null ? `${item.instCompetitiveness}:1` : null,
    logoUrl: item.logoUrl || null,
  }));

  const displayed = activeTab === "진행중" ? ongoing : upcoming;
  const now = new Date();

  function dday(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diff = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "D-Day";
    if (diff > 0) return `D-${diff}`;
    return `D+${Math.abs(diff)}`;
  }

  function fmtDate(s: string) {
    if (!s) return "";
    try {
      const d = new Date(s);
      return `${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch { return s; }
  }

  return (
    <div className="bg-white border border-[#E0E2E4] rounded-lg overflow-hidden" data-testid="sidebar-ipo-upcoming">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F5F6]">
        <span className="text-sm font-semibold text-[#14181B]">다가오는 청약 종목</span>
        <Link href="/ipo-calendar">
          <span className="text-xs text-[#9D9FA0] hover:text-[#585B5E] cursor-pointer flex items-center gap-0.5">
            IPO 캘린더 보기 <ChevronRight className="w-3 h-3" />
          </span>
        </Link>
      </div>

      <div className="flex border-b border-[#F3F5F6]">
        <button
          onClick={() => setActiveTab("진행중")}
          className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1 ${activeTab === "진행중" ? "border-[#03C75A] text-[#03C75A]" : "border-transparent text-[#9D9FA0]"}`}
          data-testid="sidebar-tab-ongoing"
        >
          청약진행중
          {ongoing.length > 0 && <span className="text-[10px] bg-[#03C75A] text-white rounded-full w-4 h-4 flex items-center justify-center">{ongoing.length}</span>}
        </button>
        <button
          onClick={() => setActiveTab("예정")}
          className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-1 ${activeTab === "예정" ? "border-[#03C75A] text-[#03C75A]" : "border-transparent text-[#9D9FA0]"}`}
          data-testid="sidebar-tab-upcoming"
        >
          청약예정
          {upcoming.length > 0 && <span className="text-[10px] bg-[#03C75A] text-white rounded-full w-4 h-4 flex items-center justify-center">{upcoming.length}</span>}
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-[#F3F5F6] animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-[#F3F5F6] rounded animate-pulse w-24" />
                <div className="h-3 bg-[#F3F5F6] rounded animate-pulse w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2">
          <div className="w-12 h-12 flex items-center justify-center text-[#C8CACC] text-3xl">🗒️</div>
          <p className="text-sm text-[#9D9FA0]">현재 {activeTab === "진행중" ? "진행중인" : "예정된"} 청약이 없어요</p>
        </div>
      ) : (
        <div className="divide-y divide-[#F3F5F6]">
          {displayed.slice(0, 3).map((ipo: any, i: number) => {
            const name = ipo.stockName || "";
            const ddayStr = dday(ipo.startDate);
            const dateLabel = fmtDate(ipo.startDate);
            const priceRange = ipo.priceMin && ipo.priceMax
              ? `공모가 ${ipo.priceMin.toLocaleString()} ~ ${ipo.priceMax.toLocaleString()}원`
              : "공모가 미정";
            const compRate = ipo.competitionRate || "-";
            return (
              <div key={i} className="px-4 pt-3 pb-2" data-testid={`sidebar-ipo-card-${i}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[13px] font-bold text-[#14181B]">{ddayStr}</span>
                  {dateLabel && <span className="text-[12px] text-[#9D9FA0]">{dateLabel} 예정</span>}
                </div>
                <div className="flex items-center justify-between bg-white border border-[#EAECEE] rounded-lg px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    {ipo.logoUrl ? (
                      <img
                        src={ipo.logoUrl}
                        alt={name}
                        className="w-9 h-9 rounded object-contain bg-[#F3F5F6] p-0.5 shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <StockIcon name={name} size={36} />
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[#14181B]">{name}</p>
                      <p className="text-[11px] text-[#585B5E]">{priceRange}</p>
                      <p className="text-[11px] text-[#9D9FA0]">기관경쟁률 {compRate}</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-3 border-t border-[#F3F5F6]">
        <Link href="/ipo-calendar">
          <span className="w-full flex items-center justify-center gap-1 text-sm text-[#585B5E] hover:text-[#14181B] cursor-pointer py-1">
            종목 더보기 <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}

function MyHoldings() {
  const { data: authData } = useQuery<{ user: UserType } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: transactions } = useQuery<StockTransaction[]>({
    queryKey: ["/api/transactions/my"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user,
  });

  const [priceData, setPriceData] = useState<Record<string, { currentPrice: number; changePercent: number }>>({});

  const txList = transactions || [];
  const holdingLots = calculateHoldingLots(txList);
  const holdingStockNames = Array.from(new Set(holdingLots.map((lot) => lot.name)));
  const holdingStockNamesKey = JSON.stringify(holdingStockNames);

  useEffect(() => {
    if (holdingStockNames.length > 0) {
      fetchStockPrices(holdingStockNames).then(setPriceData);
    }
  }, [holdingStockNamesKey]);

  const holdingsList = holdingLots.map((lot) => {
      const name = lot.name;
      const avgPrice = lot.pricePerShare;
      const totalCost = lot.qty * avgPrice;
      const market = priceData[name] || { currentPrice: avgPrice, changePercent: 0 };
      const currentPrice = market.currentPrice;
      const evalAmount = lot.qty * currentPrice;
      const profitLoss = evalAmount - totalCost;
      const profitPct = totalCost > 0 ? ((profitLoss / totalCost) * 100) : 0;
      return { id: lot.id, name, qty: lot.qty, avgPrice, currentPrice, evalAmount, totalCost, profitLoss, profitPct, changePercent: market.changePercent };
    });

  const totalEval = holdingsList.reduce((s, h) => s + h.evalAmount, 0);
  const totalCost = holdingsList.reduce((s, h) => s + h.totalCost, 0);
  const totalProfit = totalEval - totalCost;
  const totalProfitPct = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;

  if (!authData?.user) {
    return (
      <div data-testid="section-my-holdings">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[22px] font-semibold text-[#14181B]">내 보유종목</h2>
        </div>
        <div className="border border-[#E0E2E4] rounded-lg p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#F3F5F6] flex items-center justify-center mx-auto mb-3">
            <User className="w-6 h-6 text-[#BFC0C1]" />
          </div>
          <p className="text-sm text-[#9D9FA0] mb-3">로그인하면 보유종목을 확인할 수 있습니다</p>
          <a
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-white bg-[#03C75A] rounded-full px-5 py-2 hover:bg-[#02b350] transition-colors"
            data-testid="link-login-holdings"
          >
            <LogIn className="w-3.5 h-3.5" />
            로그인
          </a>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="section-my-holdings">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[22px] font-semibold text-[#14181B]">내 보유종목</h2>
        <a href="/my-stocks" className="text-xs text-[#03C75A] flex items-center gap-0.5 hover:underline" data-testid="link-my-dashboard">
          마이페이지 <ChevronRight className="w-3 h-3" />
        </a>
      </div>

      {holdingsList.length === 0 ? (
        <div className="border border-[#E0E2E4] rounded-lg p-6 text-center">
          <p className="text-sm text-[#9D9FA0] mb-1">보유 중인 종목이 없습니다</p>
          <p className="text-xs text-[#BFC0C1]">입고된 주식이 여기에 표시됩니다</p>
        </div>
      ) : (
        <>
          <div className="bg-[#F3F5F6] rounded-lg p-3.5 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#9D9FA0]">총 평가금액</span>
              <span className={`text-xs font-bold tabular-nums ${totalProfit > 0 ? "text-[#F73631]" : totalProfit < 0 ? "text-[#007EFF]" : "text-[#585B5E]"}`}>
                {totalProfit > 0 ? "+" : ""}{totalProfitPct.toFixed(2)}%
              </span>
            </div>
            <p className="text-lg font-bold text-[#14181B] tabular-nums">{totalEval.toLocaleString()}원</p>
            <p className={`text-xs tabular-nums ${totalProfit > 0 ? "text-[#F73631]" : totalProfit < 0 ? "text-[#007EFF]" : "text-[#9D9FA0]"}`}>
              {totalProfit > 0 ? "+" : ""}{totalProfit.toLocaleString()}원
            </p>
          </div>

          <div className="space-y-2.5">
            {holdingsList.map((h) => (
              <a
                key={h.id}
                href="/my-stocks"
                className="border border-[#E0E2E4] rounded-lg p-3 hover:border-[#BFC0C1] transition-colors cursor-pointer block"
                data-testid={`card-holding-${h.id}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <StockIcon name={h.name} size={36} />
                    <div>
                      <span className="text-sm font-bold text-[#14181B]">{h.name}</span>
                      <p className="text-xs text-[#9D9FA0]">{h.qty.toLocaleString()}주 · 매입단가 {h.avgPrice.toLocaleString()}원</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[#14181B] tabular-nums">{h.currentPrice.toLocaleString()}원</p>
                    <p className={`text-xs font-medium tabular-nums ${h.profitPct > 0 ? "text-[#F73631]" : h.profitPct < 0 ? "text-[#007EFF]" : "text-[#9D9FA0]"}`}>
                      {h.profitPct > 0 ? "+" : ""}{h.profitPct.toFixed(2)}%
                      <span className="ml-1 text-[10px]">({h.profitLoss > 0 ? "+" : ""}{h.profitLoss.toLocaleString()}원)</span>
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>

          <div className="mt-4 text-center">
            <a href="/my-stocks" className="inline-flex items-center gap-1 text-sm text-[#585B5E] border border-[#E0E2E4] rounded-full px-5 py-2 hover:bg-[#F9FAFB] transition-colors" data-testid="link-more-holdings">
              상세보기 <ChevronRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </>
      )}
    </div>
  );
}

function MobileHoldingsSection() {
  const { data: authData } = useQuery<{ user: UserType } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  const { data: transactions } = useQuery<StockTransaction[]>({
    queryKey: ["/api/transactions/my"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user,
  });

  const holdingsMap: Record<string, number> = {};
  (transactions || []).forEach((tx) => {
    if (!holdingsMap[tx.stockName]) holdingsMap[tx.stockName] = 0;
    holdingsMap[tx.stockName] += tx.type === "in" ? tx.quantity : -tx.quantity;
  });
  const holdingNames = Object.entries(holdingsMap).filter(([, q]) => q > 0).map(([name]) => name);

  return (
    <div className="lg:hidden border border-[#E0E2E4] rounded-lg overflow-hidden" data-testid="mobile-holdings-section">
      <div className="px-4 py-3 flex items-center justify-between border-b border-[#F3F5F6]">
        <span className="text-sm font-semibold text-[#14181B]">내 보유종목</span>
        {authData?.user && (
          <a href="/my-stocks" className="text-xs text-[#03C75A] flex items-center gap-0.5 hover:underline">
            전체보기 <ChevronRight className="w-3 h-3" />
          </a>
        )}
      </div>
      {!authData?.user ? (
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#F3F5F6] flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-[#BFC0C1]" />
          </div>
          <p className="text-sm text-[#9D9FA0] flex-1">로그인하면 보유종목을 확인할 수 있습니다</p>
          <a href="/login" className="text-xs text-white bg-[#03C75A] rounded-full px-3 py-1.5 shrink-0">로그인</a>
        </div>
      ) : holdingNames.length === 0 ? (
        <div className="px-4 py-4">
          <p className="text-sm text-[#9D9FA0]">보유 중인 종목이 없습니다</p>
        </div>
      ) : (
        <div className="flex gap-4 px-4 py-3 overflow-x-auto scrollbar-none">
          {holdingNames.slice(0, 6).map((name) => (
            <a key={name} href="/my-stocks" className="flex flex-col items-center gap-1 shrink-0">
              <StockIcon name={name} size={36} />
              <span className="text-[10px] text-[#585B5E] font-medium max-w-[44px] text-center truncate">{name}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Tips() {
  const [openTip, setOpenTip] = useState<number | null>(null);

  const tips = [
    {
      icon: <Search className="w-5 h-5 text-[#03C75A]" />,
      title: "이것만 따라하세요!",
      desc: "(주)누보리치 이용 가이드",
      content: [
        { step: "1. 회원가입", detail: "간편하게 회원가입을 진행합니다. 이름, 아이디, 비밀번호, 계좌정보, 추천코드를 입력하면 완료됩니다." },
        { step: "2. 내 주식 확인하기", detail: "조합을 통해 취득한 주식을 마이페이지에서 확인합니다." },
        { step: "3. 본인 계좌로 주식 출고", detail: "거래가 확정된 후 [주식 출고] 버튼을 통해 미리 신청해 두시면, 상장 5거래일 전부터 개인 증권 계좌로 주식 이전이 완료됩니다." },
        { step: "4. 회원간 거래", detail: "상장 전까지 플랫폼 내의 [개인 간 거래] 메뉴를 통해 보유 주식을 다른 회원에게 매도하거나 추가 매수할 수 있습니다." },
        { step: "5. 1:1 상담", detail: "거래 관련 문의사항은 1:1 상담을 통해 전문 상담사에게 문의하세요." },
      ],
    },
    {
      icon: <MessageCircle className="w-5 h-5 text-[#1976D2]" />,
      title: "거래방법, 궁금해요!",
      desc: "자주하는 질문",
      content: [
        { step: "출고 버튼은 언제 활성화되나요?", detail: "거래 상대방과의 매매 거래 및 대금 결제가 완료된 시점에 주식 출고 버튼이 활성화됩니다." },
        { step: "상장 전에는 개인 증권 계좌로 주식을 옮길 수 없나요?", detail: "네, 예탁결제원 및 증권사의 상장 주식 입고 절차에 맞춰 보통 상장 5거래일 전부터 증권 계좌로 주식 이전을 완료합니다." },
        { step: "개인 간 거래는 안전하게 처리되나요?", detail: "플랫폼이 매수금 및 수수료를 통해 별도의 복잡한 명의개서 절차 없이 거래 대금 지급 및 이전이 동시에 안전하게 처리됩니다." },
        { step: "출고 신청 시 준비해야 할 것은 무엇인가요?", detail: "가입 시 입력한 개인정보를 한 번 더 확인하신 후 출고를 신청해 주세요. 출고 가능 기간이 되면 회원님의 증권 계좌로 주식 이전이 완료됩니다." },
      ],
    },
    {
      icon: <span className="text-[11px] font-black text-white bg-[#2E343A] rounded px-1 py-0.5 leading-none">101</span>,
      title: "이용 전 꼭 확인하세요!",
      desc: "성공적인 투자를 위한 필수 기본상식",
      content: [
        { step: "조합투자의 특징", detail: "비상장 기업의 주식은 주주명부 관리의 복잡성 때문에 개인이 직접 매수하기보다는 투자조합을 결성하여 투자하는 경우가 많습니다. 플랫폼은 개별 조합원들의 명의로 명확히 구별하여 보관해 주는 디지털 장부 역할을 합니다." },
        { step: "에스크로 시스템이란?", detail: "개인 간 비상장 주식 거래의 가장 큰 위험은 돈을 보내고 주식을 못 받거나, 주식을 주고 돈을 못 받는 사기 위험입니다. 플랫폼 내부 거래는 신원 확인과 지분 소유권을 동시에 안전하게 교환하는 에스크로 체계를 바탕으로 하므로 사기 위험 없이 안전하게 거래할 수 있습니다." },
        { step: "공모주 투자와 다른 점", detail: "증권사 공모주 청약은 경쟁률이 너무 높아 수천만 원을 넣어도 겨우 몇 주밖에 받지 못합니다. 반면, 전문 투자자문사를 통해 조합 형태로 상장 전 기업의 주식을 원하는 수량만큼 확정적으로 미리 확보할 수 있습니다." },
      ],
    },
  ];

  return (
    <div id="tips" data-testid="section-tips">
      <h2 className="text-base font-semibold text-[#14181B] mb-3">비상장 꿀팁</h2>
      <div className="space-y-0 border border-[#E0E2E4] rounded-lg overflow-hidden">
        {tips.map((tip, i) => (
          <div key={i} className="border-b border-[#F3F5F6] last:border-b-0">
            <button
              onClick={() => setOpenTip(openTip === i ? null : i)}
              className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#F9FAFB] transition-colors cursor-pointer text-left"
              data-testid={`row-tip-${i}`}
            >
              <div className="w-9 h-9 rounded-lg bg-[#F3F5F6] flex items-center justify-center shrink-0">
                {tip.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#14181B]">{tip.title}</p>
                <p className="text-xs text-[#9D9FA0]">{tip.desc}</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-[#BFC0C1] shrink-0 transition-transform ${openTip === i ? "rotate-90" : ""}`} />
            </button>
            {openTip === i && (
              <div className="px-4 pb-4 pt-1 bg-[#F9FAFB]">
                <div className="space-y-3">
                  {tip.content.map((item, j) => (
                    <div key={j} className="pl-12">
                      <p className="text-sm font-medium text-[#2E343A] mb-0.5">{item.step}</p>
                      <p className="text-xs text-[#585B5E] leading-relaxed">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}


function HotDiscussionRooms() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [liveComments, setLiveComments] = useState<{ user: string; text: string; time: string }[]>([]);
  const commentsContainerRef = useRef<HTMLDivElement>(null);

  const { data: discussionsData } = useQuery<{ data: { discussStocks: any[]; discussPosts: any[] }; lastUpdated?: string }>({
    queryKey: ["/api/market/discussions"],
    refetchInterval: 5 * 60 * 1000,
  });

  const fallbackRooms = [
    { name: "카나프테라퓨틱스", totalPostCount: 3842 },
    { name: "빗썸", totalPostCount: 2913 },
    { name: "두나무", totalPostCount: 1762 },
    { name: "무신사", totalPostCount: 1144 },
    { name: "현대엔지니어링", totalPostCount: 987 },
  ];
  const rooms: any[] = (discussionsData?.data?.discussStocks && discussionsData.data.discussStocks.length > 0)
    ? discussionsData.data.discussStocks
    : fallbackRooms;

  const postsByStock: Record<string, any[]> = {};
  (discussionsData?.data?.discussPosts || []).forEach((p: any) => {
    if (p.stockName) {
      if (!postsByStock[p.stockName]) postsByStock[p.stockName] = [];
      postsByStock[p.stockName].push(p);
    }
  });

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
    }
  };

  useEffect(() => {
    if (!selectedRoom) return;
    const apiPosts = (postsByStock[selectedRoom] || []).map((p: any) => ({
      user: p.nickName || "익명",
      text: p.body || p.subject || "",
      time: "방금 전",
    }));
    setLiveComments(apiPosts.length > 0 ? apiPosts : [
      { user: "비상장투자자", text: `${selectedRoom} 종목 어떻게 보시나요?`, time: "방금 전" },
      { user: "시장분석가", text: "최근 거래량 추이가 긍정적입니다", time: "2분 전" },
    ]);

    const extraComments = [
      { user: "실시간유저1", text: "저도 이 종목 관심있게 보고 있습니다!" },
      { user: "투자고수", text: "장기적으로 좋은 종목이라고 생각해요" },
      { user: "초보투자자", text: "혹시 적정 매수가가 어느 정도일까요?" },
      { user: "분석전문가", text: "현재 가격이면 진입 타이밍 괜찮아 보입니다" },
      { user: "비상장팬", text: "비상장 투자는 인내심이 중요하죠" },
      { user: "시장관찰자", text: "최근 거래량이 늘어나고 있어서 주목할 만합니다" },
    ];
    let idx = 0;
    const interval = setInterval(() => {
      if (idx < extraComments.length) {
        setLiveComments(prev => [{ ...extraComments[idx], time: "방금 전" }, ...prev.map(c => ({
          ...c,
          time: c.time === "방금 전" ? "1분 전" : c.time
        }))]);
        idx++;
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [selectedRoom]);

  useEffect(() => {
    if (commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = commentsContainerRef.current.scrollHeight;
    }
  }, [liveComments]);

  const tsDate2 = discussionsData?.lastUpdated ? new Date(discussionsData.lastUpdated) : new Date();
  const hotTimeStr = `${String(tsDate2.getFullYear()).slice(2)}.${String(tsDate2.getMonth()+1).padStart(2,"0")}.${String(tsDate2.getDate()).padStart(2,"0")} ${String(tsDate2.getHours()).padStart(2,"0")}:${String(tsDate2.getMinutes()).padStart(2,"0")} 기준`;

  const stockHashtags: Record<string, string[]> = {
    "두나무": ["#핀테크", "#블록체인", "#일반종목"],
    "빗썸": ["#핀테크", "#암호화폐", "#일반종목"],
    "무신사": ["#이커머스", "#패션", "#일반종목"],
    "컬리": ["#이커머스", "#식품/딜리버리", "#일반종목"],
    "야놀자": ["#여행/숙박", "#일반종목"],
    "에스엠엡": ["#바이오", "#제약", "#일반종목"],
    "오아시스": ["#식품/딜리버리", "#유니콘", "#일반종목"],
    "카나프테라퓨틱스": ["#제약/바이오", "#의료기기"],
    "현대엔지니어링": ["#건설", "#대기업계열"],
  };

  return (
    <div id="hot-rooms" data-testid="section-hot-rooms">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <h2 className="text-base font-semibold text-[#14181B]">HOT 토론방</h2>
          <span className="text-xs text-[#9D9FA0]">{hotTimeStr}</span>
        </div>
        <button
          onClick={() => scroll("right")}
          className="w-7 h-7 rounded-full border border-[#E0E2E4] flex items-center justify-center hover:bg-[#F3F5F6] transition-colors"
          data-testid="button-hot-rooms-next"
        >
          <ChevronRight className="w-3.5 h-3.5 text-[#9D9FA0]" />
        </button>
      </div>

      <div ref={scrollRef} className="space-y-0 border border-[#E0E2E4] rounded-lg overflow-hidden">
        {rooms.slice(0, 5).map((room: any, i: number) => {
          const tags = stockHashtags[room.name] || ["#일반종목"];
          return (
            <div
              key={room.name || i}
              onClick={() => setSelectedRoom(selectedRoom === room.name ? null : room.name)}
              className={`px-4 py-3.5 border-b border-[#F3F5F6] last:border-b-0 cursor-pointer transition-colors ${
                selectedRoom === room.name ? "bg-[#f0fdf6]" : "hover:bg-[#F9FAFB]"
              }`}
              data-testid={`card-hot-room-${i}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <StockIcon name={room.name} size={26} />
                <span className="text-sm font-semibold text-[#14181B]">{room.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 flex-wrap">
                  {tags.map(tag => (
                    <span key={tag} className="text-[11px] text-[#9D9FA0]">{tag}</span>
                  ))}
                </div>
                <span className="text-[11px] text-[#9D9FA0] shrink-0">{(room.totalPostCount || 0).toLocaleString()}개 토론</span>
              </div>
            </div>
          );
        })}
      </div>

      {selectedRoom && (
        <div className="mt-3 border border-[#E0E2E4] rounded-lg overflow-hidden" data-testid="discussion-panel">
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#F9FAFB] border-b border-[#E0E2E4]">
            <div className="flex items-center gap-2">
              <StockIcon name={selectedRoom} size={22} />
              <span className="text-sm font-bold text-[#14181B]">{selectedRoom} 토론방</span>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#03C75A] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#03C75A]" />
              </span>
              <span className="text-[10px] text-[#03C75A]">LIVE</span>
            </div>
            <button
              onClick={() => setSelectedRoom(null)}
              className="text-xs text-[#9D9FA0] hover:text-[#585B5E]"
              data-testid="button-close-discussion"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div ref={commentsContainerRef} className="max-h-[280px] overflow-y-auto px-4 py-2 space-y-2">
            {liveComments.map((comment, i) => (
              <div
                key={`${comment.user}-${i}`}
                className={`flex items-start gap-2 py-1.5 ${i === 0 ? "animate-fade-in" : ""}`}
                data-testid={`comment-${i}`}
              >
                <div className="w-6 h-6 rounded-full bg-[#F3F5F6] flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3 h-3 text-[#9D9FA0]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-[#585B5E]">{comment.user}</span>
                    <span className="text-[10px] text-[#BFC0C1]">{comment.time}</span>
                  </div>
                  <p className="text-[13px] text-[#14181B] leading-snug">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2.5 border-t border-[#E0E2E4] bg-[#F9FAFB]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="토론에 참여하세요..."
                className="flex-1 h-8 px-3 rounded-lg bg-white border border-[#E0E2E4] text-xs outline-none focus:border-[#03C75A]"
                data-testid="input-discussion"
              />
              <button className="h-8 px-3 bg-[#03C75A] text-white text-xs rounded-lg hover:bg-[#02b350] transition-colors" data-testid="button-send-discussion">
                전송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FOOTER_MODALS: Record<string, { title: string; content: string[] }> = {
  terms: {
    title: "이용약관",
    content: [
      "제1조 (목적) 본 약관은 (주)누보리치(이하 '회사')가 제공하는 비상장주식 정보 및 중개 서비스(이하 '서비스')의 이용에 관한 제반 사항을 규정함을 목적으로 합니다.",
      "제2조 (용어의 정의) '이용자'란 회사의 서비스에 접속하여 본 약관에 따라 회사가 제공하는 서비스를 받는 회원 및 비회원을 말합니다.",
      "제3조 (약관의 효력 및 변경) 본 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용되며, 회사는 관련 법령에 위배되지 않는 범위 내에서 약관을 변경할 수 있습니다.",
      "제4조 (서비스의 제공) 회사는 비상장주식에 관한 시세 정보, 공모주 청약 정보, 투자 관련 리포트 등을 제공합니다.",
      "제5조 (이용자의 의무) 이용자는 관계 법령, 본 약관의 규정, 이용 안내 및 주의사항 등을 준수하여야 하며, 기타 회사의 업무에 방해되는 행위를 하여서는 안 됩니다.",
      "제6조 (면책조항) 회사는 제공하는 정보의 정확성 또는 완전성을 보장하지 않으며, 이를 이용한 투자 결과에 대한 책임을 지지 않습니다.",
      "제7조 (분쟁해결) 서비스 이용으로 발생한 분쟁에 대해 소송이 제기될 경우 회사의 본사 소재지를 관할하는 법원을 관할 법원으로 합니다.",
    ],
  },
  policy: {
    title: "서비스 운영정책",
    content: [
      "1. 서비스 운영 원칙: 누보리치는 공정하고 투명한 비상장주식 거래 정보를 제공합니다.",
      "2. 계정 관리: 회원은 하나의 계정만 운영할 수 있으며, 계정 양도 또는 공유는 금지됩니다.",
      "3. 금지 행위: 허위 정보 게시, 타인의 계정 도용, 스팸 행위, 서비스 방해 행위 등은 엄격히 금지됩니다.",
      "4. 게시물 관리: 불법적이거나 음란한 내용, 타인을 비방하는 내용이 포함된 게시물은 사전 예고 없이 삭제될 수 있습니다.",
      "5. 서비스 이용 제한: 운영정책을 위반한 회원의 서비스 이용을 일시적 또는 영구적으로 제한할 수 있습니다.",
      "6. 정보 보안: 회사는 이용자의 개인정보 보호를 위해 최선을 다합니다.",
      "7. 고객센터: 문의사항은 070-4571-8823로 연락해 주시기 바랍니다.",
    ],
  },
  privacy: {
    title: "개인정보처리방침",
    content: [
      "1. 개인정보의 수집 항목 및 방법: 회사는 회원가입 시 이름, 아이디, 비밀번호, 휴대폰번호, 증권사, 계좌번호, 예금주명 등의 정보를 수집합니다.",
      "2. 개인정보의 이용 목적: 수집된 개인정보는 서비스 제공, 계정 관리, 고객 지원, 법적 의무 이행 등에 활용됩니다.",
      "3. 개인정보의 보유 및 이용기간: 회원 탈퇴 시까지 보유하며, 관련 법령에 따라 일정 기간 보관이 필요한 경우에는 해당 기간 동안 보관합니다.",
      "4. 개인정보의 제3자 제공: 이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 법령에 의한 경우는 예외로 합니다.",
      "5. 개인정보의 파기: 목적이 달성된 경우 해당 개인정보를 지체 없이 파기합니다.",
      "6. 이용자의 권리: 이용자는 언제든지 자신의 개인정보를 조회·수정·삭제할 수 있으며, 처리 정지를 요구할 수 있습니다.",
      "7. 개인정보 보호 책임자: 개인정보 관련 문의는 고객센터(070-4571-8823)로 연락주시기 바랍니다.",
    ],
  },
  investment: {
    title: "투자 유의 안내",
    content: [
      "■ 비상장주식 투자 위험 안내",
      "1. 비상장주식은 상장주식과 달리 공인된 거래소에서 거래되지 않아 유동성이 매우 낮습니다.",
      "2. 비상장주식은 재무정보 공시 의무가 없어 투자 판단에 필요한 정보를 얻기 어려울 수 있습니다.",
      "3. 비상장주식은 상장주식에 비해 가격 변동성이 크며, 원금 전액 손실 가능성도 있습니다.",
      "4. 투자에 앞서 해당 기업의 사업 내용, 재무 상태, 경영진 역량 등을 충분히 검토하시기 바랍니다.",
      "5. 누보리치가 제공하는 정보는 투자 권유가 아니며, 최종 투자 결정은 투자자 본인이 하여야 합니다.",
      "6. 투자로 인한 손실은 투자자 본인이 책임지며, 회사는 이에 대한 책임을 지지 않습니다.",
      "7. 투자 전 충분한 정보 수집과 전문가 상담을 권장합니다.",
    ],
  },
  about: {
    title: "회사소개",
    content: [
      "■ 누보리치 소개",
      "누보리치는 비상장주식 거래 정보를 투명하게 제공하는 플랫폼입니다.",
      "저희는 누구나 쉽고 안전하게 비상장주식 정보를 얻을 수 있는 환경을 만들어 나가고 있습니다.",
      "■ 주요 서비스",
      "• 비상장주식 시세 및 순위 정보 제공",
      "• 공모주(IPO) 청약 일정 및 정보 제공",
      "• 전문가 리포트 및 시장 분석 자료 제공",
      "• 주식 토론방을 통한 투자 커뮤니티 운영",
      "• 비상장주식 입고/출고 서비스",
      "■ 고객센터",
      "전화: 070-4571-8823",
      "운영시간: 평일 09:00 ~ 18:00 (점심 12:00 ~ 13:00)",
    ],
  },
  careers: {
    title: "채용공고",
    content: [
      "■ 누보리치 채용 안내",
      "현재 아래 포지션에서 함께할 인재를 모집하고 있습니다.",
      "● 프론트엔드 개발자 (React/TypeScript)",
      "  - 경력: 3년 이상",
      "  - 담당업무: 비상장주식 플랫폼 UI 개발 및 유지보수",
      "  - 우대사항: 핀테크 서비스 개발 경험, TanStack Query 사용 경험",
      "● 백엔드 개발자 (Node.js/Express)",
      "  - 경력: 3년 이상",
      "  - 담당업무: API 서버 개발 및 데이터 수집 시스템 구축",
      "  - 우대사항: 금융 데이터 처리 경험, PostgreSQL 사용 경험",
      "● 마케팅 담당자",
      "  - 경력: 2년 이상",
      "  - 담당업무: 디지털 마케팅, SNS 채널 운영, 사용자 확보",
      "■ 지원 방법",
      "채용 문의: 070-4571-8823",
      "채용 공고는 수시로 업데이트되오니 정기적으로 확인하여 주시기 바랍니다.",
    ],
  },
};

function Footer() {
  const [openModal, setOpenModal] = useState<string | null>(null);
  const modal = openModal ? FOOTER_MODALS[openModal] : null;

  return (
    <footer id="footer" className="bg-[#F9FAFB] border-t border-[#E0E2E4] mt-12" data-testid="footer">
      <div className="max-w-[1200px] mx-auto px-4 py-8">
        <p className="text-[11px] text-[#9D9FA0] leading-relaxed mb-4">
          누보리치는 비상장주식 거래 정보를 제공하며, 투자 판단에 대한 책임은 투자자 본인에게 있습니다.
          비상장주식은 상장주식에 비해 유동성이 낮고 가격 변동성이 클 수 있으니 투자에 유의하시기 바랍니다.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="shrink-0 flex items-center">
            <SiteLogoBadge size={40} />
          </div>
          <div className="text-[10px] xl:text-[11px] text-[#9D9FA0] leading-relaxed flex-1 min-w-0">
            <p className="sm:whitespace-nowrap">(주)누보리치 &nbsp;|&nbsp; 사업자등록번호 555-81-01075 &nbsp;|&nbsp; 대표자 : 정혜원 &nbsp;|&nbsp; 설립일자 : 2018-08-20 &nbsp;|&nbsp; 주소 : 서울 송파구 법원로 96, 1001호 &nbsp;|&nbsp; © NOUVEAU RICHE</p>
          </div>
          <div className="shrink-0 flex items-center gap-2 border border-[#E0E2E4] rounded px-3 py-2 bg-white">
            <svg width="28" height="28" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="20" cy="20" r="19" stroke="#1A3A6B" strokeWidth="2" fill="white"/>
              <text x="20" y="16" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#1A3A6B">금융</text>
              <text x="20" y="25" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#1A3A6B">위원회</text>
            </svg>
            <div className="text-[10px] text-[#585B5E] leading-tight">
              <p className="font-semibold">금융위원회</p>
              <p>혁신금융서비스 사업자</p>
            </div>
          </div>
        </div>
      </div>

      {modal && (
        <Dialog open={!!openModal} onOpenChange={(v) => { if (!v) setOpenModal(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{modal.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm text-[#444] leading-relaxed">
              {modal.content.map((line, i) => (
                <p key={i} className={line.startsWith("■") || line.startsWith("●") ? "font-semibold text-[#222]" : ""}>{line}</p>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </footer>
  );
}

export default function TradePage() {
  const { data: user } = useQuery<UserType | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { watchlistNames, toggleWatchlist } = useWatchlist(user ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchMode, setIsSearchMode] = useState(false);
  const mobileSearchRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();

  const searchResults = searchStocks(searchQuery);

  const exitSearch = () => {
    setIsSearchMode(false);
    setSearchQuery("");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") exitSearch(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="min-h-screen bg-white" data-testid="page-landing">
      <GlobalNav />

      <main className="max-w-[1200px] mx-auto px-4 py-4">
        {/* 모바일 검색바 */}
        <div className="lg:hidden mb-3">
          {isSearchMode ? (
            <div className="flex items-center gap-2">
              <button onClick={exitSearch} className="shrink-0 p-1" data-testid="button-search-back">
                <ArrowLeft className="w-5 h-5 text-[#222]" />
              </button>
              <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-[#f5f5f5] rounded-xl">
                <Search className="w-4 h-4 text-[#999] shrink-0" />
                <input
                  ref={mobileSearchRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="종목명·초성·코드 검색"
                  className="bg-transparent text-sm text-[#222] placeholder-[#aaa] outline-none flex-1"
                  autoFocus
                  data-testid="input-search-mobile-top"
                />
                {searchQuery.length > 0 && (
                  <button onClick={() => setSearchQuery("")} className="shrink-0">
                    <X className="w-4 h-4 text-[#999]" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-2 px-3 py-2.5 bg-[#f5f5f5] rounded-xl cursor-text"
              onClick={() => { setIsSearchMode(true); setTimeout(() => mobileSearchRef.current?.focus(), 50); }}
            >
              <Search className="w-4 h-4 text-[#999] shrink-0" />
              <span className="text-sm text-[#aaa] flex-1" data-testid="input-search-mobile-top">종목명·초성·코드 검색</span>
              <Bell className="w-4 h-4 text-[#999] shrink-0" />
            </div>
          )}
        </div>

        {/* 검색 결과 */}
        {isSearchMode && (
          <div className="mt-2" data-testid="search-results">
            {searchQuery.trim().length === 0 ? (
              <p className="text-sm text-[#999] py-8 text-center">종목명을 입력하세요</p>
            ) : searchResults.length === 0 ? (
              <p className="text-sm text-[#999] py-8 text-center">
                입력한 '<span className="text-[#222] font-medium">{searchQuery}</span>'에 대한 결과가 없습니다
              </p>
            ) : (
              <>
                <p className="text-xs text-[#999] mb-2 px-1">
                  입력한 '<span className="text-[#222] font-medium">{searchQuery}</span>'에 대한 {searchResults.length}개 결과
                </p>
                <div className="divide-y divide-[#f5f5f5]">
                  {searchResults.map(stock => (
                    <button
                      key={stock.code}
                      className="w-full flex items-center gap-3 py-3 px-1 hover:bg-[#fafafa] transition-colors text-left"
                      onClick={() => { navigate(`/stock/${encodeURIComponent(stock.name)}`); exitSearch(); }}
                      data-testid={`search-result-${stock.code}`}
                    >
                      <StockIcon name={stock.name} size={36} />
                      <div>
                        <div className="text-sm font-semibold text-[#222]">{stock.name}</div>
                        <div className="text-xs text-[#999]">{stock.code}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}



        <div className={`flex flex-col lg:flex-row gap-6 mt-2 ${isSearchMode ? "hidden" : ""}`}>
          <div className="flex-1 min-w-0 space-y-8">
            {/* 모바일 보유종목 섹션 */}
            <MobileHoldingsSection />

            <StockRankings watchlistNames={watchlistNames} onToggleWatchlist={toggleWatchlist} />
            <MajorNews />
            <ThemeStocks />
            <ExpertReports />
          </div>

          <aside className="hidden lg:flex lg:flex-col lg:w-[340px] lg:pt-8 shrink-0 space-y-6">
            <MyHoldings />
            <IPOUpcomingSidebar />
            <Tips />
          </aside>
        </div>
      </main>

      <Footer />

      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        html { scroll-behavior: smooth; }
        [id] { scroll-margin-top: 70px; }
      `}</style>
    </div>
  );
}