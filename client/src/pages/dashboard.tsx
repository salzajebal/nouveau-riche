import { useQuery } from "@tanstack/react-query";
import { useLocation, Link, Redirect } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LogOut, Package, ArrowDownRight, ArrowUpRight, User as UserIcon,
  LayoutDashboard, ClipboardList, Wallet, Home,
  ChevronLeft, ChevronRight, MessageSquare, Menu, X, ArrowRightLeft,
  Send, Clock, CheckCircle2, XCircle, PauseCircle, Settings,
  Banknote, TrendingDown,
} from "lucide-react";
import { SiteLogoBadge } from "@/components/site-logo";
import { StockIcon } from "@/components/stock-icon";
import type { User, StockTransaction, TransferRequest, StockMemberTransfer, WithdrawRequest } from "@shared/schema";
import { KOREAN_BANKS } from "@shared/schema";
import { useState, useEffect, useRef } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fetchStockPrices } from "@/lib/market-prices";

type DashSection = "overview" | "holdings" | "transactions" | "transfer" | "member-transfer" | "withdraw" | "profile";

const formatPct = (n: number) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function TransferStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="gap-1" data-testid="badge-status-pending"><Clock className="w-3 h-3" />결제대기중</Badge>;
    case "출고대기중":
      return <Badge className="gap-1 bg-orange-500 border-orange-500" data-testid="badge-status-outgoing"><Clock className="w-3 h-3" />출고대기중</Badge>;
    case "approved":
      return <Badge variant="default" className="gap-1 bg-green-600 border-green-600" data-testid="badge-status-approved"><CheckCircle2 className="w-3 h-3" />승인</Badge>;
    case "rejected":
      return <Badge variant="destructive" className="gap-1" data-testid="badge-status-rejected"><XCircle className="w-3 h-3" />거부</Badge>;
    case "held":
      return <Badge variant="secondary" className="gap-1" data-testid="badge-status-held"><PauseCircle className="w-3 h-3" />보류</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const sidebarItems: { id: DashSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "계좌 총괄", icon: LayoutDashboard },
  { id: "holdings", label: "보유 종목", icon: Wallet },
  { id: "transactions", label: "거래 내역", icon: ClipboardList },
  { id: "transfer", label: "내 계좌로 옮기기", icon: ArrowRightLeft },
  { id: "member-transfer", label: "주식 이전 신청", icon: Send },
  { id: "withdraw", label: "출금하기", icon: Banknote },
  { id: "profile", label: "내 정보 수정", icon: Settings },
];

export default function DashboardPage() {
  const [location, setLocation] = useLocation();
  const isMobileDevice = useIsMobile();
  const [activeSection, setActiveSection] = useState<DashSection>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);

  useEffect(() => {
    const section = new URLSearchParams(location.split("?")[1] || "").get("section");
    if (
      section === "holdings" ||
      section === "transfer" ||
      section === "member-transfer"
    ) {
      setActiveSection(section);
    }
  }, [location]);

  const { data: authData, isLoading: authLoading } = useQuery<{ user: User } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const { data: transactions, isLoading: txLoading } = useQuery<StockTransaction[]>({
    queryKey: ["/api/transactions/my"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: allTransactions } = useQuery<StockTransaction[]>({
    queryKey: ["/api/transactions/my?includeHidden=true"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });


  const { data: myTransfers = [] } = useQuery<TransferRequest[]>({
    queryKey: ["/api/transfer-requests/my"],
    enabled: !!authData?.user,
  });

  const [transferName, setTransferName] = useState(() => authData?.user?.accountHolder || authData?.user?.fullName || "");
  const [transferAccount, setTransferAccount] = useState(() => authData?.user?.accountNumber || "");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferStock, setTransferStock] = useState("");
  const [stockInStock, setStockInStock] = useState("");
  const [stockInQuantity, setStockInQuantity] = useState("");
  const [memberTransferStock, setMemberTransferStock] = useState("");
  const [memberTransferQuantity, setMemberTransferQuantity] = useState("");
  const [memberTransferToUsername, setMemberTransferToUsername] = useState("");

  // 확정매도
  const [sellConfirmOpen, setSellConfirmOpen] = useState(false);
  const [sellStock, setSellStock] = useState("");
  const [sellQuantity, setSellQuantity] = useState("");

  // 출금신청
  const [withdrawAccountName, setWithdrawAccountName] = useState(() => authData?.user?.accountHolder || authData?.user?.fullName || "");
  const [withdrawBank, setWithdrawBank] = useState(() => authData?.user?.bank || "");
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState(() => authData?.user?.accountNumber || "");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data: availableStocks = [] } = useQuery<{ name: string; faceValue: number | null }[]>({
    queryKey: ["/api/available-stocks"],
    enabled: !!authData?.user,
  });

  const { data: myMemberTransfers = [] } = useQuery<StockMemberTransfer[]>({
    queryKey: ["/api/stock-member-transfers/my"],
    enabled: !!authData?.user,
  });

  const { data: myWithdrawRequests = [] } = useQuery<WithdrawRequest[]>({
    queryKey: ["/api/withdraw-requests/my"],
    enabled: !!authData?.user,
    refetchOnMount: "always",
  });

  // 확정매도 뮤테이션
  const sellMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/transactions/sell", {
        stockName: sellStock,
        quantity: parseInt(sellQuantity),
      });
      return res.json();
    },
    onSuccess: (data) => {
      const added = data.depositAdded ?? 0;
      toast({ title: "확정매도 완료", description: `${sellStock} ${parseInt(sellQuantity).toLocaleString()}주가 매도되었습니다. 예수금 ${added.toLocaleString()}원이 적립되었습니다.` });
      setSellStock("");
      setSellQuantity("");
      setSellConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/my?includeHidden=true"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (err: Error) => {
      let msg = "매도에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "매도 실패", description: msg, variant: "destructive" });
    },
  });

  // 출금신청 뮤테이션
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/withdraw-requests", {
        accountName: withdrawAccountName,
        bank: withdrawBank,
        accountNumber: withdrawAccountNumber,
        amount: parseInt(withdrawAmount.replace(/,/g, "")),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "출금신청 완료", description: "출금신청이 접수되었습니다. 관리자 승인 후 처리됩니다." });
      setWithdrawAmount("");
      queryClient.invalidateQueries({ queryKey: ["/api/withdraw-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (err: Error) => {
      let msg = "출금신청에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "신청 실패", description: msg, variant: "destructive" });
    },
  });

  // 출금신청 취소 뮤테이션
  const cancelWithdrawMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/withdraw-requests/${id}`);
    },
    onSuccess: () => {
      toast({ title: "출금신청 취소", description: "출금신청이 취소되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/withdraw-requests/my"] });
    },
    onError: (err: Error) => {
      let msg = "취소에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "취소 실패", description: msg, variant: "destructive" });
    },
  });

  const memberTransferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stock-member-transfers", {
        toUsername: memberTransferToUsername.trim(),
        stockName: memberTransferStock,
        quantity: parseInt(memberTransferQuantity),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "이전 신청 완료", description: `${memberTransferStock} ${parseInt(memberTransferQuantity).toLocaleString()}주 이전 신청이 접수되었습니다. 관리자 승인 후 처리됩니다.` });
      setMemberTransferStock("");
      setMemberTransferQuantity("");
      setMemberTransferToUsername("");
      queryClient.invalidateQueries({ queryKey: ["/api/stock-member-transfers/my"] });
    },
    onError: (err: Error) => {
      let msg = "이전 신청에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "신청 실패", description: msg, variant: "destructive" });
    },
  });

  const stockInMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/transfer-requests/stock-in", {
        stockName: stockInStock,
        quantity: parseInt(stockInQuantity),
      });
    },
    onSuccess: () => {
      toast({ title: "입고 신청 완료", description: `${stockInStock} ${parseInt(stockInQuantity).toLocaleString()}주 입고 신청이 접수되었습니다.` });
      setStockInStock("");
      setStockInQuantity("");
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-requests/my"] });
    },
    onError: (err: Error) => {
      toast({ title: "신청 실패", description: err.message, variant: "destructive" });
    },
  });
  const { toast } = useToast();

  const deleteTransferMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/transfer-requests/${id}`);
    },
    onSuccess: () => {
      toast({ title: "신청 취소 완료", description: "출고 신청이 삭제되었습니다." });
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-requests/my"] });
    },
    onError: (err: Error) => {
      let msg = "삭제에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "삭제 실패", description: msg, variant: "destructive" });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/transfer-requests", {
        userId: authData!.user.id,
        accountName: transferName,
        accountNumber: transferAccount,
        quantity: parseInt(transferQuantity),
        stockName: transferStock,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "신청완료", description: "내 계좌로 옮기기 신청 접수가 완료 되었습니다.\n\n신청하신 내역은 상장일 전까지 연동된 증권 계좌로 순차 입고될 예정입니다." });
      setTransferName("");
      setTransferAccount("");
      setTransferQuantity("");
      setTransferStock("");
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
    },
    onError: (error: Error) => {
      let msg = "출고 신청에 실패했습니다";
      try {
        const rawText = error.message.replace(/^\d+:\s*/, "");
        const parsed = JSON.parse(rawText);
        if (parsed?.message) msg = parsed.message;
      } catch {
        if (error.message.includes("400")) msg = "보유 수량을 초과하거나 입력이 올바르지 않습니다";
      }
      toast({ title: "신청 실패", description: msg, variant: "destructive" });
    },
  });

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferStock || !transferName || !transferAccount || !transferQuantity || parseInt(transferQuantity) <= 0) {
      toast({ title: "입력 오류", description: "모든 항목을 올바르게 입력해주세요", variant: "destructive" });
      return;
    }
    transferMutation.mutate();
  };

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/login");
    },
  });


  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!authData?.user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transaction_update") {
          queryClient.refetchQueries({ queryKey: ["/api/transactions/my"] });
          queryClient.refetchQueries({ queryKey: ["/api/transactions/my?includeHidden=true"] });
        }
        if (data.type === "transfer_update") {
          queryClient.invalidateQueries({ queryKey: ["/api/transfer-requests/my"] });
        }
      } catch {}
    };
    ws.onclose = () => {
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 3000);
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [authData?.user?.id]);

  const [priceData, setPriceData] = useState<Record<string, { currentPrice: number; changePercent: number }>>({});

  const txList = allTransactions || transactions || [];
  const visibleTxList = transactions || [];
  const holdings: Record<string, { qty: number; totalCost: number }> = {};
  const isIn = (type: string) => type === "in" || type === "입고";
  const isOut = (type: string) => type === "out" || type === "출고";
  txList.forEach((tx) => {
    const key = tx.stockName;
    if (!holdings[key]) holdings[key] = { qty: 0, totalCost: 0 };
    if (isIn(tx.type)) {
      holdings[key].qty += tx.quantity;
      holdings[key].totalCost += tx.quantity * tx.pricePerShare;
    } else if (isOut(tx.type)) {
      const currentAvg = holdings[key].qty > 0 ? holdings[key].totalCost / holdings[key].qty : 0;
      holdings[key].qty -= tx.quantity;
      if (holdings[key].qty <= 0) {
        holdings[key].qty = 0;
        holdings[key].totalCost = 0;
      } else {
        holdings[key].totalCost = holdings[key].qty * currentAvg;
      }
    }
  });
  const holdingStockNames = Object.entries(holdings).filter(([, v]) => v.qty > 0).map(([name]) => name);
  const holdingStockNamesKey = JSON.stringify(holdingStockNames);

  useEffect(() => {
    if (holdingStockNames.length > 0) {
      fetchStockPrices(holdingStockNames).then(setPriceData);
    }
  }, [holdingStockNamesKey]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!authData?.user) {
    return <Redirect to="/login" />;
  }

  const user = authData.user;
  const totalIn = txList.filter((t) => isIn(t.type)).reduce((sum, t) => sum + t.quantity, 0);
  const totalOut = txList.filter((t) => isOut(t.type)).reduce((sum, t) => sum + t.quantity, 0);
  const totalHolding = totalIn - totalOut;

  const faceValueMap = Object.fromEntries(
    availableStocks.filter(s => s.faceValue != null).map(s => [s.name, s.faceValue as number])
  );

  const holdingsList = Object.entries(holdings)
    .filter(([, v]) => v.qty > 0)
    .map(([name, v]) => {
      const avgPrice = Math.round(v.totalCost / v.qty);
      const market = priceData[name] || { currentPrice: avgPrice, changePercent: 0 };
      const currentPrice = market.currentPrice;
      const evalAmount = v.qty * currentPrice;
      const profitLoss = evalAmount - v.totalCost;
      const profitPct = v.totalCost > 0 ? ((profitLoss / v.totalCost) * 100) : 0;
      return { name, qty: v.qty, avgPrice, faceValue: faceValueMap[name] ?? null, currentPrice, evalAmount, totalCost: v.totalCost, profitLoss, profitPct, changePercent: market.changePercent };
    });

  const totalEval = holdingsList.reduce((s, h) => s + h.evalAmount, 0);
  const totalCost = holdingsList.reduce((s, h) => s + h.totalCost, 0);
  const totalProfit = totalEval - totalCost;
  const totalProfitPct = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;

  const sidebarContent = (isMobile: boolean) => (
    <>
      <div className={`h-14 border-b flex items-center ${!isMobile && sidebarCollapsed ? "justify-center px-2" : "px-4"} gap-2`}>
        {(!isMobile && sidebarCollapsed) ? (
          <SiteLogoBadge size={28} />
        ) : (
          <>
            <SiteLogoBadge size={28} />
            <div className="flex flex-col min-w-0">
              <span className="text-[11px] text-muted-foreground">내 계좌</span>
            </div>
            {isMobile && (
              <button onClick={() => setMobileSidebarOpen(false)} className="ml-auto p-1" data-testid="button-close-mobile-sidebar">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
          </>
        )}
      </div>
      <nav className="flex-1 py-3 px-2 space-y-1 overflow-y-auto">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveSection(item.id); if (isMobile) setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 rounded-md text-sm font-medium transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"} ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              data-testid={`nav-dash-${item.id}`}
              title={!isMobile && sidebarCollapsed ? item.label : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {(isMobile || !sidebarCollapsed) && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      <div className="border-t p-2 space-y-1">
        {(isMobile || !sidebarCollapsed) && (
          <div className="px-3 py-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-primary">{user.fullName.charAt(0)}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.fullName}</p>
                <p className="text-[11px] text-muted-foreground truncate">{user.bank}</p>
              </div>
            </div>
          </div>
        )}
        <Link href="/chat">
          <button onClick={() => isMobile && setMobileSidebarOpen(false)} className={`w-full flex items-center gap-3 rounded-md text-sm text-muted-foreground transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`} data-testid="nav-dash-chat" title={!isMobile && sidebarCollapsed ? "1:1 상담" : undefined}>
            <MessageSquare className="w-4 h-4 shrink-0" />
            {(isMobile || !sidebarCollapsed) && <span>1:1 상담</span>}
          </button>
        </Link>
        <Link href="/">
          <button onClick={() => isMobile && setMobileSidebarOpen(false)} className={`w-full flex items-center gap-3 rounded-md text-sm text-muted-foreground transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`} data-testid="nav-dash-home" title={!isMobile && sidebarCollapsed ? "메인 홈" : undefined}>
            <Home className="w-4 h-4 shrink-0" />
            {(isMobile || !sidebarCollapsed) && <span>메인 홈</span>}
          </button>
        </Link>
        <button
          onClick={() => logoutMutation.mutate()}
          className={`w-full flex items-center gap-3 rounded-md text-sm text-muted-foreground transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`}
          data-testid="button-logout"
          title={!isMobile && sidebarCollapsed ? "로그아웃" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {(isMobile || !sidebarCollapsed) && <span>로그아웃</span>}
        </button>
        {!isMobile && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-3 rounded-md text-sm text-muted-foreground transition-colors ${sidebarCollapsed ? "justify-center px-2 py-2" : "px-3 py-2"}`}
            data-testid="button-toggle-sidebar"
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4 shrink-0" /><span>접기</span></>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <>
    <div className="flex h-screen bg-background overflow-hidden">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r flex flex-col z-10">
            {sidebarContent(true)}
          </aside>
        </div>
      )}

      <aside className={`hidden md:flex ${sidebarCollapsed ? "w-16" : "w-60"} border-r bg-muted/30 flex-col transition-all duration-200 shrink-0`}>
        {sidebarContent(false)}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b bg-background flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-1" data-testid="button-mobile-menu">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-base sm:text-lg" data-testid="text-dashboard-title">
              {sidebarItems.find((i) => i.id === activeSection)?.label}
            </h1>
          </div>
          {isMobileDevice && (
            <button
              onClick={() => setActiveSection("profile")}
              className={`p-2 rounded-md transition-colors ${activeSection === "profile" ? "text-[#03C75A]" : "text-muted-foreground"}`}
              data-testid="button-mobile-profile"
              aria-label="내 정보 수정"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 pb-20 md:pb-6 space-y-4 sm:space-y-6">
          {activeSection === "overview" && (
            <>
              <Card className="p-5">
                <h3 className="text-sm text-muted-foreground mb-3">비상장 주식 시세</h3>
                <p className="text-sm text-muted-foreground">보유 종목의 현재 시세에 따라 평가금액과 수익률이 계산됩니다</p>
              </Card>

              <Card className="p-5">
                <h3 className="text-sm text-muted-foreground mb-4">총 자산 평가</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">평가금액</p>
                    <p className="text-2xl font-bold tabular-nums" data-testid="text-total-eval">{totalEval.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">총 매입금액</p>
                    <p className="text-2xl font-bold tabular-nums" data-testid="text-total-cost">{totalCost.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">평가손익</p>
                    <p className={`text-2xl font-bold tabular-nums ${totalProfit >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`} data-testid="text-total-profit">
                      {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString()}원
                    </p>
                    <p className={`text-sm font-medium tabular-nums ${totalProfitPct >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`} data-testid="text-total-profit-pct">
                      수익률 {totalProfitPct >= 0 ? "+" : ""}{formatPct(totalProfitPct)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
                      <Banknote className="w-3.5 h-3.5" />예수금
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-[#03C75A]" data-testid="text-deposit-balance">{(user.depositBalance ?? 0).toLocaleString()}원</p>
                    <button
                      onClick={() => setActiveSection("withdraw")}
                      className="text-xs text-[#03C75A] hover:underline mt-1"
                    >출금하기 →</button>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">총 보유수량</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums" data-testid="text-total-holding">{totalHolding.toLocaleString()}주</p>
                    </div>
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">총 입고</p>
                      <p className="text-2xl font-bold mt-1 text-[#F73631] tabular-nums" data-testid="text-total-in">{totalIn.toLocaleString()}주</p>
                    </div>
                    <div className="w-10 h-10 rounded-md bg-[#F73631]/10 flex items-center justify-center">
                      <ArrowDownRight className="w-5 h-5 text-[#F73631]" />
                    </div>
                  </div>
                </Card>
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">총 출고</p>
                      <p className="text-2xl font-bold mt-1 text-[#007EFF] tabular-nums" data-testid="text-total-out">{totalOut.toLocaleString()}주</p>
                    </div>
                    <div className="w-10 h-10 rounded-md bg-[#007EFF]/10 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-[#007EFF]" />
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm text-muted-foreground">내 정보</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs border-[#03C75A] text-[#03C75A] hover:bg-[#03C75A]/10"
                    onClick={() => setActiveSection("profile")}
                    data-testid="button-goto-profile"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    내 정보 수정
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">아이디</span>
                    <p className="font-medium" data-testid="text-my-username">{user.username}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">성명</span>
                    <p className="font-medium">{user.fullName}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">은행</span>
                    <p className="font-medium">{user.bank}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">계좌번호</span>
                    <p className="font-medium">{user.accountNumber}</p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {activeSection === "holdings" && (
            <>
              <Card className="p-5">
                <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
                  <h3 className="text-sm text-muted-foreground">보유 종목 현재가</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">평가금액</p>
                    <p className="text-xl font-bold tabular-nums">{totalEval.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">매입금액</p>
                    <p className="text-xl font-bold tabular-nums">{totalCost.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">평가손익</p>
                    <p className={`text-xl font-bold tabular-nums ${totalProfit >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                      {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString()}원 ({totalProfitPct >= 0 ? "+" : ""}{formatPct(totalProfitPct)}%)
                    </p>
                  </div>
                </div>
              </Card>

              {holdingsList.length === 0 ? (
                <Card className="p-12 text-center">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  <p className="font-medium text-muted-foreground">보유 중인 종목이 없습니다</p>
                  <p className="text-sm text-muted-foreground mt-1">관리자에게 입고 요청하세요</p>
                </Card>
              ) : (
                <>
                <Card className="p-0 overflow-hidden hidden sm:block">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>종목명</TableHead>
                          <TableHead className="text-right">보유수량</TableHead>
                          <TableHead className="text-right">평균단가</TableHead>
                          <TableHead className="text-right">현재가</TableHead>
                          <TableHead className="text-right">평가금액</TableHead>
                          <TableHead className="text-right">평가손익</TableHead>
                          <TableHead className="text-right">수익률</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {holdingsList.map((h) => (
                          <TableRow key={h.name} data-testid={`row-holding-${h.name}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <StockIcon name={h.name} size={28} />
                                <span className="font-semibold">{h.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{h.qty.toLocaleString()}주</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{h.avgPrice.toLocaleString()}원</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{h.currentPrice.toLocaleString()}원</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{h.evalAmount.toLocaleString()}원</TableCell>
                            <TableCell className={`text-right font-mono tabular-nums font-semibold ${h.profitLoss >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                              {h.profitLoss >= 0 ? "+" : ""}{h.profitLoss.toLocaleString()}원
                            </TableCell>
                            <TableCell className={`text-right font-mono tabular-nums font-semibold ${h.profitPct >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                              {h.profitPct >= 0 ? "+" : ""}{formatPct(h.profitPct)}%
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
                <div className="sm:hidden space-y-3">
                  {holdingsList.map((h) => (
                    <Card key={h.name} className="p-3" data-testid={`card-holding-mobile-${h.name}`}>
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <StockIcon name={h.name} size={28} />
                          <span className="font-semibold text-sm truncate">{h.name}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`text-sm font-semibold tabular-nums ${h.profitPct >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                            {h.profitPct >= 0 ? "+" : ""}{formatPct(h.profitPct)}%
                          </span>
                          <p className={`text-xs tabular-nums ${h.profitLoss >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                            {h.profitLoss >= 0 ? "+" : ""}{h.profitLoss.toLocaleString()}원
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <div className="flex justify-between"><span className="text-muted-foreground">보유수량</span><span className="tabular-nums">{h.qty.toLocaleString()}주</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">현재가</span><span className="tabular-nums">{h.currentPrice.toLocaleString()}원</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">평균단가</span><span className="tabular-nums">{h.avgPrice.toLocaleString()}원</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">평가금액</span><span className="tabular-nums">{h.evalAmount.toLocaleString()}원</span></div>
                      </div>
                    </Card>
                  ))}
                </div>
                <div className="mt-4 flex justify-center gap-3 flex-wrap">
                  <Button
                    variant="outline"
                    className="gap-2 border-[#03C75A] text-[#03C75A]"
                    onClick={() => setTransferConfirmOpen(true)}
                    data-testid="button-transfer-from-holdings"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    내 계좌로 옮기기
                  </Button>
                  {(user.canSell !== false) && (
                    <Button
                      variant="outline"
                      className="gap-2 border-[#F73631] text-[#F73631] hover:bg-[#F73631]/10"
                      onClick={() => setSellConfirmOpen(true)}
                      data-testid="button-sell-from-holdings"
                    >
                      <TrendingDown className="w-4 h-4" />
                      확정매도
                    </Button>
                  )}
                </div>
                </>
              )}
            </>
          )}

          {activeSection === "transactions" && (
            <>
              {txLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : visibleTxList.length === 0 ? (
                <Card className="p-12 text-center">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  <p className="font-medium text-muted-foreground">거래 내역이 없습니다</p>
                  <p className="text-sm text-muted-foreground mt-1">관리자가 주식을 입고하면 여기에 표시됩니다</p>
                </Card>
              ) : (
                <>
                <Card className="p-0 overflow-hidden hidden sm:block">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>유형</TableHead>
                          <TableHead>카테고리</TableHead>
                          <TableHead>종목</TableHead>
                          <TableHead className="text-right">수량</TableHead>
                          <TableHead className="text-right">단가</TableHead>
                          <TableHead className="text-right">총액</TableHead>
                          <TableHead>메모</TableHead>
                          <TableHead>일시</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visibleTxList.map((tx) => (
                          <TableRow key={tx.id} data-testid={`row-transaction-${tx.id}`}>
                            <TableCell>
                              {isIn(tx.type) ? (
                                <Badge className="bg-[#03C75A] border-[#03C75A]">입고</Badge>
                              ) : tx.memo === "확정매도" ? (
                                <Badge className="bg-[#F73631] border-[#F73631] text-white">매도</Badge>
                              ) : (
                                <Badge className="bg-[#007EFF] border-[#007EFF] text-white">출고</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">{tx.category}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <StockIcon name={tx.stockName} size={24} />
                                <span className="font-medium">{tx.stockName}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{tx.quantity.toLocaleString()}주</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{tx.pricePerShare.toLocaleString()}원</TableCell>
                            <TableCell className="text-right font-mono tabular-nums">{(tx.quantity * tx.pricePerShare).toLocaleString()}원</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{tx.memo || "-"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{new Date(tx.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
                <div className="sm:hidden space-y-2">
                  {visibleTxList.map((tx) => (
                    <Card key={tx.id} className="p-3" data-testid={`card-transaction-mobile-${tx.id}`}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {isIn(tx.type) ? (
                            <Badge className="bg-[#03C75A] border-[#03C75A] text-xs shrink-0">입고</Badge>
                          ) : tx.memo === "확정매도" ? (
                            <Badge className="bg-[#F73631] border-[#F73631] text-white text-xs shrink-0">매도</Badge>
                          ) : (
                            <Badge className="bg-[#007EFF] border-[#007EFF] text-white text-xs shrink-0">출고</Badge>
                          )}
                          <StockIcon name={tx.stockName} size={22} />
                          <span className="font-medium text-sm truncate">{tx.stockName}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums shrink-0">{(tx.quantity * tx.pricePerShare).toLocaleString()}원</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{tx.quantity.toLocaleString()}주 x {tx.pricePerShare.toLocaleString()}원 · {tx.category}</span>
                        <span>{new Date(tx.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                      </div>
                      {tx.memo && <p className="text-xs text-muted-foreground mt-1">{tx.memo}</p>}
                    </Card>
                  ))}
                </div>
                </>
              )}
            </>
          )}

          {activeSection === "transfer" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">

              <Card className="p-5 order-2 lg:order-1">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowRightLeft className="w-5 h-5 text-[#03C75A]" />
                  <h2 className="text-lg font-semibold" data-testid="text-transfer-title">내 계좌로 옮기기</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  현재 보유 중인 비상장 주식을 타 증권사로 출고할 수 있습니다.
                  출고 신청 시 현재 포지션이 종료되며, 관리자 승인 후 처리됩니다.
                </p>
                {totalHolding > 0 && (
                  <div className="bg-muted/50 rounded-md p-3 mb-4 text-sm">
                    <span className="text-muted-foreground">현재 보유수량: </span>
                    <span className="font-bold" data-testid="text-transfer-holding">{totalHolding.toLocaleString()}주</span>
                  </div>
                )}
                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>종목 선택</Label>
                    <Select value={transferStock} onValueChange={(val) => {
                      setTransferStock(val);
                      setTransferQuantity("");
                    }}>
                      <SelectTrigger data-testid="select-transfer-stock">
                        <SelectValue placeholder="출고할 종목을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {holdingsList.map((h) => (
                          <SelectItem key={h.name} value={h.name}>
                            {h.name} ({h.qty.toLocaleString()}주 · 매입단가 {h.avgPrice.toLocaleString()}원)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dash-transfer-name">예금주명</Label>
                    <Input
                      id="dash-transfer-name"
                      value={transferName}
                      readOnly
                      disabled
                      className="bg-muted/50 cursor-not-allowed"
                      placeholder="회원가입 시 입력한 이름"
                      data-testid="input-transfer-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dash-transfer-account">계좌번호</Label>
                    <Input
                      id="dash-transfer-account"
                      value={transferAccount}
                      readOnly
                      disabled
                      className="bg-muted/50 cursor-not-allowed"
                      placeholder="회원가입 시 입력한 계좌번호"
                      data-testid="input-transfer-account"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dash-transfer-quantity">출고 수량 (주)</Label>
                    <Input
                      id="dash-transfer-quantity"
                      type="number"
                      min="1"
                      max={transferStock ? (holdingsList.find(h => h.name === transferStock)?.qty || totalHolding) : totalHolding}
                      value={transferQuantity}
                      onChange={(e) => setTransferQuantity(e.target.value)}
                      placeholder={transferStock ? `최대 ${(holdingsList.find(h => h.name === transferStock)?.qty || 0).toLocaleString()}주` : "종목을 먼저 선택하세요"}
                      required
                      disabled={!transferStock}
                      data-testid="input-transfer-quantity"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#03C75A] border-[#03C75A] hover:bg-[#02b350]"
                    disabled={transferMutation.isPending || totalHolding <= 0}
                    data-testid="button-submit-transfer"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {transferMutation.isPending ? "신청 중..." : "출고 신청"}
                  </Button>
                </form>
              </Card>

              <Card className="p-5 order-1 lg:order-2">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#03C75A]" />
                  <h2 className="text-lg font-semibold">신청 목록</h2>
                </div>
                {myTransfers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    출고 신청 내역이 없습니다
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {myTransfers.map((tr) => (
                      <div
                        key={tr.id}
                        className="border rounded-md p-3 space-y-2"
                        data-testid={`transfer-item-${tr.id}`}
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <StockIcon name={tr.stockName} size={20} />
                            <span className="font-medium text-sm">{tr.stockName} {tr.quantity.toLocaleString()}주</span>
                          </div>
                          <TransferStatusBadge status={tr.status} />
                        </div>
                        {tr.currentPrice > 0 && (
                          <div className="bg-muted/50 rounded-md p-2 space-y-1">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">매입단가</span>
                              <span className="font-mono tabular-nums">{tr.purchasePrice.toLocaleString()}원</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">현재시세</span>
                              <span className="font-mono tabular-nums font-medium">{tr.currentPrice.toLocaleString()}원</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-muted-foreground">수익률</span>
                              <span className={`font-mono tabular-nums font-bold ${parseFloat(tr.profitRate) > 0 ? "text-[#F73631]" : parseFloat(tr.profitRate) < 0 ? "text-[#007EFF]" : ""}`}>
                                {parseFloat(tr.profitRate) > 0 ? "+" : ""}{formatPct(parseFloat(tr.profitRate))}%
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 text-sm pt-1 border-t border-border/50">
                              <span className="text-muted-foreground font-medium">결제금액</span>
                              <span className="font-mono tabular-nums font-bold">{(tr.purchasePrice * tr.quantity).toLocaleString()}원</span>
                            </div>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {tr.status === "approved"
                            ? "해당 신청건은 출고완료 되었습니다. 연동된 증권계좌 확인해주세요."
                            : tr.status === "출고대기중"
                            ? "대금결제 완료되었습니다. 상장당일 연동된 증권계좌로 출고됩니다."
                            : "대금결제는 담당 자문회사를 통해 납부해주시면 됩니다."}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tr.createdAt).toLocaleString("ko-KR")}
                        </div>
                        {tr.adminMemo && (
                          <div className="text-xs text-muted-foreground mt-1 bg-muted/50 rounded p-1.5">
                            관리자 메모: {tr.adminMemo}
                          </div>
                        )}
                        {tr.status === "pending" && (
                          <div className="pt-1 border-t border-border/50">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs text-red-500 border-red-200 hover:bg-red-50 w-full"
                              onClick={() => deleteTransferMutation.mutate(tr.id)}
                              disabled={deleteTransferMutation.isPending}
                              data-testid={`button-delete-transfer-${tr.id}`}
                            >
                              신청 취소
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeSection === "member-transfer" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Send className="w-5 h-5 text-[#03C75A]" />
                  <h2 className="text-lg font-semibold">주식 이전 신청</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  보유 중인 주식을 다른 회원에게 이전할 수 있습니다. 관리자 승인 후 처리됩니다.
                </p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>이전할 종목</Label>
                    <Select value={memberTransferStock} onValueChange={(val) => { setMemberTransferStock(val); setMemberTransferQuantity(""); }}>
                      <SelectTrigger data-testid="select-member-transfer-stock">
                        <SelectValue placeholder="종목을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        {holdingsList.map((h) => (
                          <SelectItem key={h.name} value={h.name}>
                            {h.name} ({h.qty.toLocaleString()}주 보유)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {memberTransferStock && (
                    <div className="bg-muted/50 rounded-md p-3 text-sm">
                      <span className="text-muted-foreground">보유 수량: </span>
                      <span className="font-bold">
                        {(holdingsList.find(h => h.name === memberTransferStock)?.qty || 0).toLocaleString()}주
                      </span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>이전 수량 (주)</Label>
                    <Input
                      type="number"
                      min="1"
                      max={memberTransferStock ? (holdingsList.find(h => h.name === memberTransferStock)?.qty || 0) : undefined}
                      value={memberTransferQuantity}
                      onChange={(e) => setMemberTransferQuantity(e.target.value)}
                      placeholder={memberTransferStock ? `최대 ${(holdingsList.find(h => h.name === memberTransferStock)?.qty || 0).toLocaleString()}주` : "종목을 먼저 선택하세요"}
                      disabled={!memberTransferStock}
                      data-testid="input-member-transfer-quantity"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>받는 회원 아이디</Label>
                    <Input
                      value={memberTransferToUsername}
                      onChange={(e) => setMemberTransferToUsername(e.target.value)}
                      placeholder="받는 회원의 아이디를 입력하세요"
                      data-testid="input-member-transfer-to-username"
                    />
                  </div>
                  <Button
                    className="w-full bg-[#03C75A] border-[#03C75A] hover:bg-[#02b350]"
                    disabled={
                      memberTransferMutation.isPending ||
                      !memberTransferStock ||
                      !memberTransferQuantity ||
                      parseInt(memberTransferQuantity) <= 0 ||
                      !memberTransferToUsername.trim() ||
                      holdingsList.length === 0
                    }
                    onClick={() => memberTransferMutation.mutate()}
                    data-testid="button-submit-member-transfer"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {memberTransferMutation.isPending ? "신청 중..." : "이전 신청"}
                  </Button>
                </div>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#03C75A]" />
                  <h2 className="text-lg font-semibold">이전 신청 내역</h2>
                </div>
                {myMemberTransfers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    주식 이전 신청 내역이 없습니다
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto">
                    {myMemberTransfers.map((mt) => (
                      <div key={mt.id} className="border rounded-md p-3 space-y-2" data-testid={`member-transfer-item-${mt.id}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <StockIcon name={mt.stockName} size={20} />
                            <span className="font-medium text-sm">{mt.stockName} {mt.quantity.toLocaleString()}주</span>
                          </div>
                          <TransferStatusBadge status={mt.status} />
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Send className="w-3 h-3" />
                          <span>받는 회원: <span className="font-medium text-foreground">{mt.toUsername}</span></span>
                        </div>
                        {mt.adminMemo && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-1.5">
                            관리자 메모: {mt.adminMemo}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {new Date(mt.createdAt).toLocaleString("ko-KR")}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeSection === "withdraw" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Banknote className="w-5 h-5 text-[#03C75A]" />
                  <h2 className="text-lg font-semibold">출금하기</h2>
                </div>
                <div className="bg-muted/50 rounded-md p-3 mb-4 text-sm">
                  <p className="text-muted-foreground mb-1">출금 가능 예수금</p>
                  <p className="text-2xl font-bold text-[#03C75A] tabular-nums">{(user.depositBalance ?? 0).toLocaleString()}원</p>
                  <p className="text-xs text-muted-foreground mt-1">확정매도 후 적립된 금액만 출금 가능합니다</p>
                </div>
                <form
                  className="space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const amt = parseInt(withdrawAmount.replace(/,/g, ""));
                    if (!withdrawAccountName || !withdrawBank || !withdrawAccountNumber || !amt || amt <= 0) {
                      return;
                    }
                    withdrawMutation.mutate();
                  }}
                >
                  <div className="space-y-2">
                    <Label>예금주명</Label>
                    <Input
                      value={withdrawAccountName}
                      onChange={(e) => setWithdrawAccountName(e.target.value)}
                      placeholder="예금주명 입력"
                      required
                      data-testid="input-withdraw-account-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>은행</Label>
                    <Select value={withdrawBank} onValueChange={setWithdrawBank}>
                      <SelectTrigger data-testid="select-withdraw-bank">
                        <SelectValue placeholder="은행 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {KOREAN_BANKS.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>계좌번호</Label>
                    <Input
                      value={withdrawAccountNumber}
                      onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                      placeholder="계좌번호 입력 (- 없이)"
                      required
                      data-testid="input-withdraw-account-number"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>출금금액 (원)</Label>
                    <Input
                      type="number"
                      min="1"
                      max={user.depositBalance ?? 0}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder={`최대 ${(user.depositBalance ?? 0).toLocaleString()}원`}
                      required
                      data-testid="input-withdraw-amount"
                    />
                    {withdrawAmount && parseInt(withdrawAmount) > (user.depositBalance ?? 0) && (
                      <p className="text-xs text-destructive">예수금을 초과합니다</p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#03C75A] border-[#03C75A] hover:bg-[#02b350]"
                    disabled={
                      withdrawMutation.isPending ||
                      !withdrawAccountName ||
                      !withdrawBank ||
                      !withdrawAccountNumber ||
                      !withdrawAmount ||
                      parseInt(withdrawAmount) <= 0 ||
                      parseInt(withdrawAmount) > (user.depositBalance ?? 0)
                    }
                    data-testid="button-submit-withdraw"
                  >
                    {withdrawMutation.isPending ? "신청 중..." : "출금 신청"}
                  </Button>
                </form>
              </Card>

              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#03C75A]" />
                  <h2 className="text-lg font-semibold">출금신청 내역</h2>
                </div>
                {myWithdrawRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">출금신청 내역이 없습니다</div>
                ) : (
                  <div className="space-y-3 max-h-[480px] overflow-y-auto">
                    {myWithdrawRequests.map((wr) => (
                      <div key={wr.id} className="border rounded-md p-3 space-y-2" data-testid={`withdraw-item-${wr.id}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="font-bold tabular-nums text-sm">{wr.amount.toLocaleString()}원</span>
                          {wr.status === "pending" && <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />진행중</Badge>}
                          {wr.status === "approved" && <Badge className="gap-1 bg-green-600 border-green-600"><CheckCircle2 className="w-3 h-3" />승인</Badge>}
                          {wr.status === "rejected" && <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />거부</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <p>{wr.bank} {wr.accountNumber} ({wr.accountName})</p>
                          <p>{new Date(wr.createdAt).toLocaleString("ko-KR")}</p>
                        </div>
                        {wr.adminMemo && (
                          <div className="text-xs text-muted-foreground bg-muted/50 rounded p-1.5">관리자 메모: {wr.adminMemo}</div>
                        )}
                        {wr.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs text-red-500 border-red-200 hover:bg-red-50 w-full"
                            onClick={() => cancelWithdrawMutation.mutate(wr.id)}
                            disabled={cancelWithdrawMutation.isPending}
                            data-testid={`button-cancel-withdraw-${wr.id}`}
                          >신청 취소</Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeSection === "profile" && (
            <ProfileEditSection user={user} />
          )}
        </main>
      </div>

      {/* 확정매도 다이얼로그 */}
      <Dialog open={sellConfirmOpen} onOpenChange={(v) => { if (!v) { setSellStock(""); setSellQuantity(""); } setSellConfirmOpen(v); }}>
        <DialogContent className="max-w-[360px] p-0 rounded-xl overflow-hidden border-0 shadow-2xl max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-b from-[#FFF5F5] to-white px-6 pt-8 pb-2 rounded-t-xl shrink-0">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#F73631]/10 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-[#F73631]" />
              </div>
            </div>
            <h3 className="text-base font-bold text-[#14181B] text-center mb-1">확정매도</h3>
            <p className="text-xs text-[#9D9FA0] text-center mb-4">매도금액이 예수금으로 즉시 적립됩니다</p>
          </div>
          <div className="px-6 pb-6 pt-2 space-y-3 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">종목 선택</Label>
              <Select value={sellStock} onValueChange={(v) => { setSellStock(v); setSellQuantity(""); }}>
                <SelectTrigger data-testid="select-dialog-sell-stock">
                  <SelectValue placeholder="매도할 종목을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {holdingsList.map((h) => (
                    <SelectItem key={h.name} value={h.name}>
                      {h.name} ({h.qty.toLocaleString()}주 · 현재가 {h.currentPrice.toLocaleString()}원)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">매도 수량</Label>
              <Input
                type="number"
                placeholder="수량을 입력하세요"
                value={sellQuantity}
                onChange={(e) => setSellQuantity(e.target.value)}
                min={1}
                max={holdingsList.find(h => h.name === sellStock)?.qty ?? undefined}
                data-testid="input-dialog-sell-quantity"
              />
              {sellStock && (
                <p className="text-xs font-bold text-[#14181B]">최대 {(holdingsList.find(h => h.name === sellStock)?.qty ?? 0).toLocaleString()}주</p>
              )}
            </div>
            {sellStock && sellQuantity && parseInt(sellQuantity) > 0 && (() => {
              const h = holdingsList.find(h => h.name === sellStock);
              if (!h) return null;
              const est = Math.round(h.currentPrice) * parseInt(sellQuantity);
              return (
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">현재가</span><span className="tabular-nums font-medium">{h.currentPrice.toLocaleString()}원</span></div>
                  <div className="flex justify-between font-bold"><span>예상 적립 예수금</span><span className="text-[#03C75A] tabular-nums">{est.toLocaleString()}원</span></div>
                </div>
              );
            })()}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setSellConfirmOpen(false)}>취소</Button>
              <Button
                className="flex-1 bg-[#F73631] hover:bg-[#d42f2a] text-white font-medium rounded-lg"
                onClick={() => sellMutation.mutate()}
                disabled={
                  !sellStock ||
                  !sellQuantity ||
                  parseInt(sellQuantity) <= 0 ||
                  parseInt(sellQuantity) > (holdingsList.find(h => h.name === sellStock)?.qty ?? 0) ||
                  sellMutation.isPending
                }
                data-testid="button-sell-confirm"
              >
                {sellMutation.isPending ? "처리 중..." : "확정매도"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={transferConfirmOpen} onOpenChange={(v) => { if (!v) { setTransferStock(""); setTransferQuantity(""); } setTransferConfirmOpen(v); }}>
        <DialogContent className="max-w-[360px] p-0 rounded-xl overflow-hidden border-0 shadow-2xl max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-b from-[#F3F5F6] to-white px-6 pt-8 pb-2 rounded-t-xl shrink-0">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#03C75A]/10 flex items-center justify-center">
                <ArrowRightLeft className="w-6 h-6 text-[#03C75A]" />
              </div>
            </div>
            <h3 className="text-base font-bold text-[#14181B] text-center mb-1">내 계좌로 옮기기</h3>
            <p className="text-xs text-[#9D9FA0] text-center mb-4">연동된 증권계좌로 출고 신청합니다</p>
          </div>
          <div className="px-6 pb-6 pt-2 space-y-3 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">종목 선택</Label>
              <Select value={transferStock} onValueChange={(v) => { setTransferStock(v); setTransferQuantity(""); }}>
                <SelectTrigger data-testid="select-dialog-transfer-stock">
                  <SelectValue placeholder="출고할 종목을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {holdingsList.map((h) => (
                    <SelectItem key={h.name} value={h.name}>
                      {h.name} ({h.qty.toLocaleString()}주 · 매입단가 {h.avgPrice.toLocaleString()}원)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">출고 수량</Label>
              <Input
                type="number"
                placeholder="수량을 입력하세요"
                value={transferQuantity}
                onChange={(e) => setTransferQuantity(e.target.value)}
                min={1}
                max={holdingsList.find(h => h.name === transferStock)?.qty ?? undefined}
                data-testid="input-dialog-transfer-quantity"
              />
              {transferStock && (
                <p className="text-xs font-bold text-[#14181B]">최대 {(holdingsList.find(h => h.name === transferStock)?.qty ?? 0).toLocaleString()}주</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">예금주명</Label>
              <Input
                value={authData?.user?.accountHolder || authData?.user?.fullName || ""}
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed text-sm"
                placeholder="회원가입 시 입력한 이름"
                data-testid="input-dialog-transfer-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">계좌번호</Label>
              <Input
                value={authData?.user?.accountNumber || ""}
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed text-sm"
                placeholder="회원가입 시 입력한 계좌번호"
                data-testid="input-dialog-transfer-account"
              />
              {!authData?.user?.accountNumber && (
                <p className="text-xs text-[#F73631]">내 정보에서 계좌번호를 먼저 등록해주세요</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTransferConfirmOpen(false)} data-testid="button-dialog-transfer-cancel">
                취소
              </Button>
              <Button
                className="flex-1 bg-[#03C75A] hover:bg-[#02b350] text-white font-medium rounded-lg"
                onClick={() => transferMutation.mutate()}
                disabled={
                  !transferStock ||
                  !transferQuantity ||
                  parseInt(transferQuantity) <= 0 ||
                  parseInt(transferQuantity) > (holdingsList.find(h => h.name === transferStock)?.qty ?? 0) ||
                  !authData?.user?.accountNumber ||
                  transferMutation.isPending
                }
                data-testid="button-transfer-confirm"
              >
                {transferMutation.isPending ? "신청 중..." : "출고 신청"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t flex items-stretch" data-testid="mobile-bottom-nav">
      {sidebarItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeSection === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${isActive ? "text-[#03C75A]" : "text-muted-foreground"}`}
            data-testid={`mobile-tab-${item.id}`}
          >
            <Icon className={`w-5 h-5 ${isActive ? "text-[#03C75A]" : "text-muted-foreground"}`} />
            <span className="w-full text-center leading-tight">
              {item.label === "내 계좌로 옮기기" ? "계좌이동" : item.label === "계좌 총괄" ? "총괄" : item.label === "보유 종목" ? "보유종목" : item.label === "거래 내역" ? "거래내역" : item.label === "내 정보 수정" ? "내정보" : item.label === "주식 이전 신청" ? "주식이전" : item.label}
            </span>
          </button>
        );
      })}
      <Link href="/chat" className="flex-1">
        <button
          className="w-full h-full flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground transition-colors"
          data-testid="mobile-tab-chat"
        >
          <MessageSquare className="w-5 h-5 text-muted-foreground" />
          <span className="w-full text-center leading-tight">상담</span>
        </button>
      </Link>
    </nav>
  </>
  );
}

function ProfileEditSection({ user }: { user: User }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState(user.phone || "");
  const [bank, setBank] = useState(user.bank || "");
  const [accountNumber, setAccountNumber] = useState(user.accountNumber || "");
  const [accountHolder, setAccountHolder] = useState(user.accountHolder || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    setPhone(user.phone || "");
    setBank(user.bank || "");
    setAccountNumber(user.accountNumber || "");
    setAccountHolder(user.accountHolder || "");
  }, [user]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        fullName: user.fullName,
        phone: phone.trim() || undefined,
        bank: bank || undefined,
        accountNumber: accountNumber || undefined,
        accountHolder: accountHolder || undefined,
      };
      if (newPassword) {
        if (newPassword !== confirmPassword) {
          throw new Error("비밀번호가 일치하지 않습니다");
        }
        if (newPassword.length < 6) {
          throw new Error("비밀번호는 6자 이상이어야 합니다");
        }
        body.password = newPassword;
      }
      await apiRequest("PUT", "/api/auth/profile", body);
    },
    onSuccess: () => {
      toast({ title: "수정 완료", description: "회원정보가 수정되었습니다" });
      setNewPassword("");
      setConfirmPassword("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (err: any) => {
      toast({ title: "수정 실패", description: err.message || "정보 수정에 실패했습니다", variant: "destructive" });
    },
  });

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-[#03C75A]" />
        <h2 className="text-lg font-semibold" data-testid="text-profile-title">내 정보 수정</h2>
      </div>
      <div className="space-y-4 max-w-lg">
        {/* 고정 정보 */}
        <div className="bg-muted/40 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">이름</span>
            <span className="text-sm font-semibold" data-testid="text-profile-fullname">{user.fullName}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">아이디</span>
            <span className="text-sm font-medium" data-testid="text-profile-username">{user.username}</span>
          </div>
        </div>

        {/* 전화번호 수정 */}
        <div className="space-y-2">
          <Label>전화번호</Label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="010-0000-0000"
            data-testid="input-profile-phone"
          />
        </div>

        {/* 비밀번호 */}
        <div className="space-y-2">
          <Label>비밀번호 (변경)</Label>
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="변경 시에만 입력 (6자 이상)"
            data-testid="input-profile-password"
          />
        </div>
        <div className="space-y-2">
          <Label>비밀번호 확인</Label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="비밀번호를 다시 입력하세요"
            data-testid="input-profile-password-confirm"
          />
          {newPassword && confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다</p>
          )}
        </div>

        {/* 증권 계좌 정보 */}
        <div className="space-y-2">
          <Label>증권사</Label>
          <Select value={bank} onValueChange={setBank}>
            <SelectTrigger data-testid="select-profile-bank">
              <SelectValue placeholder="증권사 선택" />
            </SelectTrigger>
            <SelectContent>
              {KOREAN_BANKS.map((b) => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>예금주</Label>
          <Input
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="예금주명"
            data-testid="input-profile-holder"
          />
        </div>
        <div className="space-y-2">
          <Label>계좌번호</Label>
          <Input
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            placeholder="증권사 계좌번호"
            data-testid="input-profile-account"
          />
        </div>

        <Button
          className="w-full bg-[#03C75A] border-[#03C75A] hover:bg-[#02b350] mt-2"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || (!!newPassword && newPassword !== confirmPassword)}
          data-testid="button-save-profile"
        >
          {mutation.isPending ? "저장 중..." : "완료"}
        </Button>
      </div>
    </Card>
  );
}
