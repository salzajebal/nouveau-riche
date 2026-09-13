import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Menu, X, LogIn, LogOut, User, Search } from "lucide-react";
import { SiteLogoBadge } from "@/components/site-logo";
import { StockIcon } from "@/components/stock-icon";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { searchStocks } from "@/lib/stocks";

const NAV_LINKS = [
  { label: "공모주 IPO 캘린더", href: "/ipo-calendar" },
  { label: "서비스소개", href: "/service" },
  { label: "보유종목", href: "/my-stocks" },
  { label: "출고 신청", href: "/dashboard?section=transfer" },
  { label: "회원 간 거래", href: "/dashboard?section=member-transfer" },
];

function StockDropdown({ results, onSelect }: {
  results: { name: string; code: string }[];
  onSelect: (name: string) => void;
}) {
  if (results.length === 0) return null;
  return (
    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E2E4] rounded-lg shadow-lg z-50 max-h-72 overflow-y-auto">
      {results.slice(0, 10).map(stock => (
        <button
          key={stock.code}
          onMouseDown={e => { e.preventDefault(); onSelect(stock.name); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F3F5F6] text-left transition-colors"
          data-testid={`search-dropdown-${stock.code}`}
        >
          <StockIcon name={stock.name} size={28} />
          <div>
            <div className="text-sm font-medium text-[#14181B]">{stock.name}</div>
            <div className="text-xs text-[#9D9FA0]">{stock.code}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function GlobalNav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearch, setMobileSearch] = useState("");
  const [mobileSearchFocused, setMobileSearchFocused] = useState(false);
  const [location, navigate] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: user } = useQuery<{ id: number; fullName: string; username: string } | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const searchResults = searchStocks(searchQuery);
  const mobileSearchResults = searchStocks(mobileSearch);

  async function handleLogout() {
    try {
      await apiRequest("POST", "/api/auth/logout");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch {}
  }

  function handleSelect(name: string) {
    setSearchQuery("");
    setMobileSearch("");
    setSearchFocused(false);
    setMobileSearchFocused(false);
    navigate(`/stock/${encodeURIComponent(name)}`);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showDropdown = searchFocused && searchQuery.trim().length > 0;
  const showMobileDropdown = mobileSearchFocused && mobileSearch.trim().length > 0;

  return (
    <header className="sticky top-0 z-[9999] bg-white border-b border-[#E0E2E4]" data-testid="global-nav">
      <div className="max-w-[1200px] mx-auto px-4">
        <div className="flex items-center justify-between gap-4 h-14">
          {/* Logo */}
          <Link href="/">
            <div className="shrink-0 cursor-pointer" data-testid="link-home-nav">
              <SiteLogoBadge size={48} />
            </div>
          </Link>

          {/* Desktop search bar */}
          <div className="hidden md:flex flex-1 max-w-[360px] mx-4" ref={searchRef}>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#999]" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                placeholder="종목명·초성·코드 검색"
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-[#F3F5F6] border-none text-sm text-[#14181B] placeholder-[#9D9FA0] outline-none focus:ring-1 focus:ring-[#03C75A]"
                data-testid="input-search-nav"
              />
              {searchQuery.length > 0 && (
                <button
                  className="absolute right-2.5 top-1/2 -translate-y-1/2"
                  onClick={() => { setSearchQuery(""); setSearchFocused(false); }}
                  data-testid="button-search-clear-nav"
                >
                  <X className="w-4 h-4 text-[#999]" />
                </button>
              )}
              {showDropdown && searchResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#E0E2E4] rounded-lg shadow-lg z-50 px-4 py-3">
                  <p className="text-sm text-[#999]">'{searchQuery}'에 대한 결과가 없습니다</p>
                </div>
              )}
              {showDropdown && searchResults.length > 0 && (
                <StockDropdown results={searchResults} onSelect={handleSelect} />
              )}
            </div>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1 shrink-0">
            {NAV_LINKS.map((link) => {
              const isActive = location === link.href || location.startsWith(link.href + "/") || (link.href.startsWith("/dashboard?") && location === link.href);
              return (
                <Link key={link.label} href={link.href}>
                  <span
                    className={`text-[13px] px-2 py-1 whitespace-nowrap transition-colors cursor-pointer ${
                      isActive ? "text-[#03C75A] font-bold hover:text-[#02b350]" : "text-[#585B5E] hover:text-[#14181B]"
                    }`}
                    data-testid={`link-nav-${link.label}`}
                  >
                    {link.label}
                  </span>
                </Link>
              );
            })}
            <Link href="/my-stocks">
              <span
                className="text-[13px] text-[#03C75A] font-bold px-3 py-1.5 ml-1 whitespace-nowrap border border-[#03C75A] rounded-full hover:bg-[#03C75A] hover:text-white transition-colors cursor-pointer"
                data-testid="link-nav-my-stocks"
              >
                공모주 마이페이지
              </span>
            </Link>
          </nav>

          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            {user ? (
              <>
                <Link href="/dashboard">
                  <span className="flex items-center gap-1 text-sm text-[#585B5E] hover:text-[#14181B] cursor-pointer" data-testid="link-nav-dashboard">
                    <User className="w-6 h-6" />
                    {user.fullName}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-[#585B5E] hover:text-[#F73631] transition-colors"
                  data-testid="button-nav-logout"
                >
                  <LogOut className="w-6 h-6" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <span className="flex items-center gap-1 text-sm text-white bg-[#03C75A] px-3 py-1.5 rounded-md hover:bg-[#02b350] transition-colors cursor-pointer" data-testid="link-nav-login">
                    <LogIn className="w-3.5 h-3.5" />
                    로그인
                  </span>
                </Link>
                <Link href="/register">
                  <span className="text-sm text-[#585B5E] hover:text-[#14181B] cursor-pointer" data-testid="link-nav-register">회원가입</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="lg:hidden flex items-center justify-center w-9 h-9"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="button-mobile-menu-nav"
          >
            {mobileOpen ? <X className="w-5 h-5 text-[#222]" /> : <Menu className="w-5 h-5 text-[#222]" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-white border-t border-[#E0E2E4] px-4 py-3 space-y-2">
          {/* Mobile search */}
          <div className="md:hidden mb-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9D9FA0]" />
              <input
                type="text"
                value={mobileSearch}
                onChange={e => setMobileSearch(e.target.value)}
                onFocus={() => setMobileSearchFocused(true)}
                onBlur={() => setTimeout(() => setMobileSearchFocused(false), 150)}
                placeholder="종목명·초성·코드 검색"
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-[#F3F5F6] border-none text-sm text-[#14181B] placeholder-[#9D9FA0] outline-none focus:ring-1 focus:ring-[#03C75A]"
                data-testid="input-search-mobile-nav"
              />
              {mobileSearch.length > 0 && (
                <button className="absolute right-2.5 top-1/2 -translate-y-1/2" onClick={() => setMobileSearch("")}>
                  <X className="w-4 h-4 text-[#999]" />
                </button>
              )}
            </div>
            {showMobileDropdown && mobileSearchResults.length === 0 && (
              <div className="mt-1 bg-white border border-[#E0E2E4] rounded-lg px-4 py-3">
                <p className="text-sm text-[#999]">'{mobileSearch}'에 대한 결과가 없습니다</p>
              </div>
            )}
            {showMobileDropdown && mobileSearchResults.length > 0 && (
              <div className="mt-1 bg-white border border-[#E0E2E4] rounded-lg max-h-60 overflow-y-auto">
                {mobileSearchResults.slice(0, 10).map(stock => (
                  <button
                    key={stock.code}
                    onMouseDown={() => { handleSelect(stock.name); setMobileOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-[#F3F5F6] text-left"
                    data-testid={`search-mobile-result-${stock.code}`}
                  >
                    <StockIcon name={stock.name} size={28} />
                    <div>
                      <div className="text-sm font-medium text-[#14181B]">{stock.name}</div>
                      <div className="text-xs text-[#9D9FA0]">{stock.code}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {NAV_LINKS.map((link) => {
            const isActive = location === link.href;
            return (
              <Link key={link.label} href={link.href}>
                <span
                  onClick={() => setMobileOpen(false)}
                  className={`block text-sm py-2 border-b border-[#F3F5F6] cursor-pointer ${
                    isActive ? "text-[#03C75A] font-bold" : "text-[#585B5E] hover:text-[#14181B]"
                  }`}
                  data-testid={`link-mobile-nav-${link.label}`}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}

          <Link href="/dashboard">
            <span onClick={() => setMobileOpen(false)} className="block text-sm text-[#03C75A] font-bold py-2 cursor-pointer" data-testid="link-mobile-nav-member-transfer">
              주식 이전 신청
            </span>
          </Link>
          <Link href="/my-stocks">
            <span onClick={() => setMobileOpen(false)} className="block text-sm text-[#03C75A] font-bold py-2 cursor-pointer" data-testid="link-mobile-nav-my-stocks">
              공모주 마이페이지
            </span>
          </Link>
          <Link href="/chat">
            <span onClick={() => setMobileOpen(false)} className="block text-sm text-[#03C75A] font-bold py-2 cursor-pointer" data-testid="link-mobile-nav-chat">
              상담문의하기
            </span>
          </Link>

          <div className="border-t border-[#E0E2E4] pt-3 flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard">
                  <span onClick={() => setMobileOpen(false)} className="text-sm text-[#14181B] font-medium cursor-pointer" data-testid="link-mobile-nav-dashboard">
                    {user.fullName}
                  </span>
                </Link>
                <button onClick={handleLogout} className="text-sm text-[#03C75A]" data-testid="button-mobile-nav-logout">로그아웃</button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <span onClick={() => setMobileOpen(false)} className="text-sm text-white bg-[#03C75A] px-4 py-1.5 rounded-md cursor-pointer" data-testid="link-mobile-nav-login">로그인</span>
                </Link>
                <Link href="/register">
                  <span onClick={() => setMobileOpen(false)} className="text-sm text-[#585B5E] cursor-pointer" data-testid="link-mobile-nav-register">회원가입</span>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
