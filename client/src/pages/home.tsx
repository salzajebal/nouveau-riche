import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SiteLogoBadge } from "@/components/site-logo";
import { getQueryFn } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import {
  TrendingUp, Shield, BarChart3, ArrowRight, ChevronDown,
  Smartphone, Clock, Users, Star, LogIn, UserPlus, LogOut, LayoutDashboard, Menu, X,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";

export default function HomePage() {
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const { data: authData } = useQuery<{ user: User } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/auth/logout"); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }); },
  });

  const user = authData?.user;

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white" data-testid="home-page">
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/95 backdrop-blur-sm shadow-sm" : "bg-transparent"}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 h-16">
          <div className="flex items-center gap-2">
            <SiteLogoBadge size={32} />
            <span className={`font-bold text-lg transition-colors ${scrolled ? "text-gray-900" : "text-white"}`}>누보리치</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className={`text-sm font-medium transition-colors ${scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/80 hover:text-white"}`} data-testid="nav-features">서비스 소개</a>
            <a href="#benefits" className={`text-sm font-medium transition-colors ${scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/80 hover:text-white"}`} data-testid="nav-benefits">혜택</a>
            <a href="#info" className={`text-sm font-medium transition-colors ${scrolled ? "text-gray-600 hover:text-gray-900" : "text-white/80 hover:text-white"}`} data-testid="nav-info">안내</a>
          </nav>

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className={`gap-1.5 ${scrolled ? "text-gray-700" : "text-white hover:bg-white/10"}`} data-testid="button-my-account">
                    <LayoutDashboard className="w-4 h-4" /> 내 계좌
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className={`gap-1.5 ${scrolled ? "text-gray-700" : "text-white hover:bg-white/10"}`} onClick={() => logoutMutation.mutate()} data-testid="button-logout">
                  <LogOut className="w-4 h-4" /> 로그아웃
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className={`gap-1.5 ${scrolled ? "text-gray-700" : "text-white hover:bg-white/10"}`} data-testid="button-login">
                    <LogIn className="w-4 h-4" /> 로그인
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="gap-1.5 bg-[#E8344E] border-[#E8344E]" data-testid="button-register">
                    <UserPlus className="w-4 h-4" /> 회원가입
                  </Button>
                </Link>
              </>
            )}
          </div>

          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2" data-testid="button-mobile-nav">
            {mobileMenuOpen ? <X className={`w-6 h-6 ${scrolled ? "text-gray-900" : "text-white"}`} /> : <Menu className={`w-6 h-6 ${scrolled ? "text-gray-900" : "text-white"}`} />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t shadow-lg">
            <div className="p-4 space-y-2">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 rounded-md" data-testid="mobile-nav-features">서비스 소개</a>
              <a href="#benefits" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 rounded-md" data-testid="mobile-nav-benefits">혜택</a>
              <a href="#info" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-medium text-gray-700 rounded-md" data-testid="mobile-nav-info">안내</a>
              <div className="border-t pt-2 mt-2 space-y-2">
                {user ? (
                  <>
                    <Link href="/dashboard">
                      <button onClick={() => setMobileMenuOpen(false)} className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 rounded-md flex items-center gap-2" data-testid="mobile-my-account">
                        <LayoutDashboard className="w-4 h-4" /> 내 계좌
                      </button>
                    </Link>
                    <button onClick={() => { logoutMutation.mutate(); setMobileMenuOpen(false); }} className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 rounded-md flex items-center gap-2" data-testid="mobile-logout">
                      <LogOut className="w-4 h-4" /> 로그아웃
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <button onClick={() => setMobileMenuOpen(false)} className="w-full text-left px-4 py-2.5 text-sm font-medium text-gray-700 rounded-md flex items-center gap-2" data-testid="mobile-login">
                        <LogIn className="w-4 h-4" /> 로그인
                      </button>
                    </Link>
                    <Link href="/register">
                      <button onClick={() => setMobileMenuOpen(false)} className="w-full text-left px-4 py-2.5 text-sm font-medium text-[#E8344E] rounded-md flex items-center gap-2" data-testid="mobile-register">
                        <UserPlus className="w-4 h-4" /> 회원가입
                      </button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: "linear-gradient(135deg, #E8344E 0%, #C62828 40%, #8B1A1A 100%)" }} data-testid="hero-section">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-[#E8344E]/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#C62828]/30 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#E8344E]/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl mx-auto">
          <Badge className="bg-white/10 text-white border-white/20 mb-6 px-4 py-1.5 text-sm no-default-hover-elevate no-default-active-elevate" data-testid="badge-new">
            <Star className="w-3.5 h-3.5 mr-1.5" /> NEW
          </Badge>

          <h1 className="text-white text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-tight tracking-tight mb-4">
            <span className="block text-white/70 text-lg sm:text-2xl md:text-3xl font-medium tracking-widest mb-3">누보리치에서</span>
            <span className="block">주식관리</span>
          </h1>

          <div className="flex items-center justify-center gap-3 sm:gap-4 my-6 sm:my-8">
            <div className="w-16 sm:w-20 h-8 sm:h-10 bg-white/20 rounded-full flex items-center px-1">
              <div className="w-6 sm:w-8 h-6 sm:h-8 bg-white rounded-full flex items-center justify-center shadow-lg ml-auto">
                <TrendingUp className="w-3 sm:w-4 h-3 sm:h-4 text-[#E8344E]" />
              </div>
            </div>
            <span className="text-white text-4xl sm:text-6xl md:text-7xl font-black tracking-tight">ON</span>
          </div>

          <p className="text-white/70 text-base sm:text-lg md:text-xl mb-8 sm:mb-10 max-w-xl mx-auto leading-relaxed">
             투자의 시작, 믿을 수 있는 누보리치에서<br className="hidden sm:block" />
            안전하고 편리한 주식 관리 서비스
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto min-w-[200px] bg-white text-[#E8344E] hover:bg-gray-100 font-bold text-base h-12 sm:h-14 rounded-full gap-2 no-default-hover-elevate" data-testid="button-hero-register">
                계좌 개설하기 <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/trade">
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[200px] border-white/30 text-white hover:bg-white/10 font-bold text-base h-12 sm:h-14 rounded-full gap-2 no-default-hover-elevate backdrop-blur-sm" data-testid="button-hero-trade">
                주식 모으러 가기 <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="w-6 h-6 text-white/40" />
        </div>
      </section>

      <section id="features" className="py-16 sm:py-24 bg-white" data-testid="features-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <Badge className="bg-[#E8344E]/10 text-[#E8344E] border-[#E8344E]/20 mb-4 no-default-hover-elevate no-default-active-elevate">서비스 소개</Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-gray-900 mb-4">
              누보리치가 제공하는<br />주식 관리 서비스
            </h2>
            <p className="text-gray-500 text-base sm:text-lg max-w-2xl mx-auto">
              입고부터 출고까지, 간편하고 안전한 주식 관리를 경험하세요
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[
              { icon: BarChart3, title: "실시간 시세 조회", desc: "비상장 종목 실시간 시세와 차트를 한눈에 확인하세요", color: "bg-blue-50 text-blue-600" },
              { icon: Shield, title: "안전한 자산 관리", desc: "누보리치의 검증된 시스템으로 소중한 자산을 보호합니다", color: "bg-green-50 text-green-600" },
              { icon: TrendingUp, title: "실시간 손익 추적", desc: "보유 주식의 현재가 대비 실시간 수익률을 확인하세요", color: "bg-purple-50 text-purple-600" },
              { icon: Smartphone, title: "모바일 최적화", desc: "언제 어디서나 모바일로 편리하게 주식을 관리하세요", color: "bg-orange-50 text-orange-600" },
              { icon: Clock, title: "빠른 입출고 처리", desc: "신속하고 정확한 주식 입고/출고 처리를 경험하세요", color: "bg-red-50 text-red-600" },
              { icon: Users, title: "1:1 전문 상담", desc: "전문 상담원이 실시간으로 고객 문의에 응답합니다", color: "bg-teal-50 text-teal-600" },
            ].map((f, i) => {
              const Icon = f.icon;
              return (
                <Card key={i} className="p-6 sm:p-8 bg-white border border-gray-100 hover-elevate" data-testid={`card-feature-${i}`}>
                  <div className={`w-12 h-12 rounded-md flex items-center justify-center mb-5 ${f.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="benefits" className="py-16 sm:py-24" style={{ background: "linear-gradient(180deg, #002D5E 0%, #001A3A 100%)" }} data-testid="benefits-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <Badge className="bg-white/10 text-white border-white/20 mb-4 no-default-hover-elevate no-default-active-elevate">혜택</Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-white mb-4">
              국내주식<br />첫 투자 ON
            </h2>
            <p className="text-white/60 text-base sm:text-lg max-w-xl mx-auto">
               누보리치가 처음이라면<br />
              <span className="text-[#4db8ff] font-bold">매매수수료 12개월 우대</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto mb-10 sm:mb-12">
            <Card className="p-6 sm:p-8 bg-white/5 border-white/10 text-center" data-testid="card-benefit-stock">
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2">국내주식</h3>
              <p className="text-white/50 text-sm mb-4">(코스피, 코스닥, 코넥스)</p>
              <div className="border-t border-white/10 pt-4">
                <span className="text-3xl sm:text-4xl font-black text-[#4db8ff]">0.003%</span>
              </div>
            </Card>
            <Card className="p-6 sm:p-8 bg-white/5 border-white/10 text-center" data-testid="card-benefit-etf">
              <h3 className="text-xl sm:text-2xl font-black text-white mb-2">ETF/ETN/ELW</h3>
              <p className="text-white/50 text-sm mb-4">(상장지수펀드)</p>
              <div className="border-t border-white/10 pt-4">
                <span className="text-3xl sm:text-4xl font-black text-[#4db8ff]">0.0010%</span>
              </div>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link href="/register">
              <Button size="lg" className="w-full sm:w-auto min-w-[180px] bg-[#7ad03a] text-gray-900 hover:bg-[#6bc02e] font-bold text-base h-12 sm:h-14 rounded-full gap-2 no-default-hover-elevate border-[#7ad03a]" data-testid="button-benefit-register">
                계좌 개설하기
              </Button>
            </Link>
            <Link href="/trade">
              <Button size="lg" variant="outline" className="w-full sm:w-auto min-w-[180px] border-[#f5a623] bg-[#f5a623]/10 text-[#f5a623] hover:bg-[#f5a623]/20 font-bold text-base h-12 sm:h-14 rounded-full gap-2 no-default-hover-elevate" data-testid="button-benefit-trade">
                주식 모으러 가기
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-24 bg-white" data-testid="event-section">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-14">
            <Badge className="bg-[#E8344E]/10 text-[#E8344E] border-[#E8344E]/20 mb-4 no-default-hover-elevate no-default-active-elevate">이벤트</Badge>
            <h2 className="text-2xl sm:text-4xl font-black text-gray-900 mb-4">
              누보리치에서는<br />주식모으기 수수료 부담없이!
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            <Card className="p-6 sm:p-8 bg-gray-50 border-gray-100" data-testid="card-event-detail">
              <div className="space-y-5">
                <div>
                  <Badge className="bg-[#7ad03a]/20 text-[#4a8c1e] border-[#7ad03a]/30 mb-2 no-default-hover-elevate no-default-active-elevate">이벤트 내용</Badge>
                  <h3 className="font-bold text-gray-900 text-lg">주식모으기 매수 수수료 무료 (국내주식)</h3>
                  <p className="text-sm text-gray-500 mt-1">*이벤트 기간동안 거래되는<br />기존/신규 주식모으기 거래 모두 혜택 적용</p>
                </div>
                <div>
                  <Badge className="bg-[#7ad03a]/20 text-[#4a8c1e] border-[#7ad03a]/30 mb-2 no-default-hover-elevate no-default-active-elevate">이벤트 기간</Badge>
                  <p className="font-bold text-gray-900">2026년 1월 1일 ~ 2026년 6월 30일</p>
                </div>
                <div>
                  <Badge className="bg-[#7ad03a]/20 text-[#4a8c1e] border-[#7ad03a]/30 mb-2 no-default-hover-elevate no-default-active-elevate">이벤트 대상</Badge>
                  <p className="text-gray-700">주식 모으기 서비스를 이용하는<br />누보리치 회원 누구나!</p>
                </div>
              </div>
            </Card>

            <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8">
              <div className="relative mb-6">
                <span className="text-8xl sm:text-9xl font-black text-[#7ad03a]">0</span>
                <span className="text-3xl sm:text-4xl font-black text-gray-900 ml-1">원</span>
                <div className="absolute -top-2 -right-2">
                  <Star className="w-5 h-5 text-[#f5a623] fill-[#f5a623]" />
                </div>
                <div className="absolute -top-4 right-4">
                  <Star className="w-3 h-3 text-[#f5a623] fill-[#f5a623]" />
                </div>
              </div>
              <p className="text-gray-500 text-sm mb-6">주식모으기 매수 수수료</p>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <Link href="/register">
                  <Button size="lg" className="w-full sm:w-auto bg-[#7ad03a] text-gray-900 hover:bg-[#6bc02e] font-bold rounded-full no-default-hover-elevate border-[#7ad03a]" data-testid="button-event-register">
                    계좌 개설하기
                  </Button>
                </Link>
                <Link href="/trade">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-[#f5a623] text-[#f5a623] hover:bg-[#f5a623]/10 font-bold rounded-full no-default-hover-elevate" data-testid="button-event-trade">
                    주식 모으러 가기
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="info" className="py-16 sm:py-20" style={{ background: "linear-gradient(180deg, #001A3A 0%, #000D1F 100%)" }} data-testid="info-section">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <h3 className="text-white font-bold text-lg mb-4">투자 유의사항</h3>
          <div className="text-white/40 text-xs sm:text-sm space-y-2 leading-relaxed">
            <p>- 투자자는 금융투자상품에 대하여 증권사로부터 충분한 설명을 받을 권리가 있으며, 투자 전 상품설명서 등을 반드시 읽어보시기 바랍니다.</p>
            <p>- 이 금융상품(주식)은 예금자보호법에 의하여 보호되지 않습니다.</p>
            <p>- 주식 거래(매매)의 수수료는 유관기관 수수료를 포함하여 산정됩니다.</p>
            <p>- 주식 가치가 변동, 환율 변동, 신용등급 하락 등에 따라 투자원금의 손실(0~100%)이 발생할 수 있으며, 그 손실은 투자자에게 귀속됩니다.</p>
            <p>- 본 이벤트는 당사 사정 또는 금융당국의 지도 및 규제환경 변화에 따라 사전 통보 없이 변경 또는 조기 종료될 수 있습니다.</p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10">
            <h4 className="text-white/80 font-bold text-sm mb-3">국내주식 모으기 이벤트</h4>
            <div className="text-white/40 text-xs space-y-1.5 leading-relaxed">
              <p>- 누보리치 회원이라면 누구나 이벤트에 참여 가능합니다.</p>
              <p>- 본 이벤트는 서비스 신뢰를 위한 정보 제공을 목적으로 하며, 투자권유를 위한 것은 아닙니다.</p>
              <p>- 국내주식 모으기 무료 이벤트는 매수/매매 관련 거래 모든 종류에 매매수수료와 기본 수수료가 무료로 적용되며, 그 외 수수료가 제한됩니다.</p>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#000D1F] py-8 sm:py-10 border-t border-white/5" data-testid="footer">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SiteLogoBadge size={24} />
              <span className="text-white/60 text-sm font-medium">누보리치</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <Link href="/trade">
                  <span className="text-white/40 text-xs hover:text-white/60 cursor-pointer" data-testid="footer-trade">거래소</span>
                </Link>
                <Link href="/login">
                  <span className="text-white/40 text-xs hover:text-white/60 cursor-pointer" data-testid="footer-login">로그인</span>
                </Link>
                <Link href="/register">
                  <span className="text-white/40 text-xs hover:text-white/60 cursor-pointer" data-testid="footer-register">회원가입</span>
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-6 text-center sm:text-left">
            <p className="text-white/30 text-xs">
              누보리치 주식관리 시스템 | 본 서비스는 투자 참고용이며, 투자 판단의 책임은 투자자에게 있습니다.
            </p>
          </div>
        </div>
      </footer>

      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-3 bg-white/95 backdrop-blur-sm px-4 sm:px-5 py-2.5 sm:py-3 rounded-full shadow-lg border border-gray-200" data-testid="floating-cta">
        <Link href="/register">
          <Button size="sm" className="bg-[#7ad03a] text-gray-900 hover:bg-[#6bc02e] font-bold rounded-full text-xs sm:text-sm no-default-hover-elevate border-[#7ad03a]" data-testid="button-float-register">
            계좌 개설하기
          </Button>
        </Link>
        <Link href="/trade">
          <Button size="sm" variant="outline" className="border-[#f5a623] text-[#f5a623] hover:bg-[#f5a623]/10 font-bold rounded-full text-xs sm:text-sm no-default-hover-elevate" data-testid="button-float-trade">
            주식 모으러 가기
          </Button>
        </Link>
      </div>
    </div>
  );
}
