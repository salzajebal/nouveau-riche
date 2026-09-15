import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Link, Redirect } from "wouter";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Package, TrendingUp, TrendingDown, ArrowRightLeft, Clock, CheckCircle2, XCircle, PauseCircle, Lock } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SiteLogoBadge } from "@/components/site-logo";
import { StockIcon } from "@/components/stock-icon";
import type { User, StockTransaction, TransferRequest } from "@shared/schema";
import { fetchStockPrices } from "@/lib/market-prices";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { calculateHoldingLots } from "@/lib/holding-lots";

export default function MyStocksPage() {
  const { data: authData, isLoading: userLoading } = useQuery<{ user: User } | null>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  const user = authData?.user ?? null;

  const { data: transactions, isLoading: txLoading } = useQuery<StockTransaction[]>({
    queryKey: ["/api/transactions/my"],
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: myTransfers = [] } = useQuery<TransferRequest[]>({
    queryKey: ["/api/transfer-requests/my"],
    enabled: !!user,
  });

  const { data: availableStocks = [] } = useQuery<{ name: string; faceValue: number | null }[]>({
    queryKey: ["/api/available-stocks"],
    enabled: !!user,
  });

  const faceValueMap = Object.fromEntries(
    availableStocks.filter(s => s.faceValue != null).map(s => [s.name, s.faceValue as number])
  );

  const [priceData, setPriceData] = useState<Record<string, { currentPrice: number; changePercent: number }>>({});
  const [transferConfirmOpen, setTransferConfirmOpen] = useState(false);
  const [transferStock, setTransferStock] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [sellDialogOpen, setSellDialogOpen] = useState(false);
  const [sellStock, setSellStock] = useState("");
  const [sellQty, setSellQty] = useState<string>("");
  const [frozenPrices, setFrozenPrices] = useState<Record<string, number>>({});
  const [sellFetchingPrice, setSellFetchingPrice] = useState(false);
  const { toast } = useToast();

  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/transfer-requests", {
        userId: user!.id,
        accountName: user!.accountHolder || user!.fullName || user!.username,
        accountNumber: user!.accountNumber || "",
        quantity: parseInt(transferQuantity),
        stockName: transferStock,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "신청완료", description: "내 계좌로 옮기기 신청 접수가 완료 되었습니다.\n\n신청하신 내역은 상장일 전까지 연동된 증권 계좌로 순차 입고될 예정입니다." });
      setTransferConfirmOpen(false);
      setTransferStock("");
      setTransferQuantity("");
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-requests/my"] });
    },
    onError: (error: Error) => {
      let description = "출고 신청에 실패했습니다. 다시 시도해주세요.";
      try {
        const match = error.message.match(/\d+: ([\s\S]*)/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          if (parsed.message) description = parsed.message;
        }
      } catch {}
      toast({ title: "신청 실패", description, variant: "destructive" });
    },
  });

  const txList = (transactions || []);
  const holdingLots = calculateHoldingLots(txList);

  const allTxStockNames = Array.from(new Set(txList.map(tx => tx.stockName)));
  const allStockNamesKey = JSON.stringify(allTxStockNames);

  const sellMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/transactions/sell", {
        stockName: sellStock,
        quantity: parseInt(sellQty),
        pricePerShare: frozenPrices[sellStock] ?? 0,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "매도 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      const totalAmt = (frozenPrices[sellStock] ?? 0) * parseInt(sellQty);
      toast({ title: "확정매도 완료", description: `${sellStock} ${parseInt(sellQty).toLocaleString()}주 매도 완료\n총 매도금액: ${totalAmt.toLocaleString()}원` });
      setSellDialogOpen(false);
      setSellStock("");
      setSellQty("");
      setFrozenPrices({});
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
    },
    onError: (err: Error) => {
      toast({ title: "매도 실패", description: err.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (allTxStockNames.length === 0) return;
    fetchStockPrices(allTxStockNames).then(setPriceData);
    const interval = setInterval(() => {
      fetchStockPrices(allTxStockNames).then(setPriceData);
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [allStockNamesKey]);

  if (userLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <Skeleton className="w-64 h-8" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const holdings = holdingLots.map((lot) => {
    const name = lot.name;
    const avgPrice = lot.pricePerShare;
    const market = priceData[name] || { currentPrice: avgPrice, changePercent: 0 };
    const currentPrice = market.currentPrice;
    const evalAmount = lot.qty * currentPrice;
    const totalCost = lot.qty * avgPrice;
    const profitLoss = evalAmount - totalCost;
    const profitPct = totalCost > 0 ? ((profitLoss / totalCost) * 100) : 0;
    return {
      id: lot.id,
      name,
      qty: lot.qty,
      avgPrice,
      faceValue: faceValueMap[name] ?? null,
      currentPrice,
      evalAmount,
      totalCost,
      profitLoss,
      profitPct,
      category: lot.category,
      changePercent: market.changePercent,
    };
  });

  const stockHoldings = Array.from(
    holdings.reduce((byStock, holding) => {
      byStock.set(holding.name, (byStock.get(holding.name) || 0) + holding.qty);
      return byStock;
    }, new Map<string, number>()),
  ).map(([name, qty]) => ({ name, qty }));

  const totalEval = holdings.reduce((sum, h) => sum + h.evalAmount, 0);
  const totalCost = holdings.reduce((sum, h) => sum + h.totalCost, 0);
  const totalProfit = totalEval - totalCost;
  const totalProfitPct = totalCost > 0 ? ((totalProfit / totalCost) * 100) : 0;

  return (
    <div className="min-h-screen bg-white" data-testid="page-my-stocks">
      <header className="border-b border-[#E0E2E4]">
        <div className="max-w-[1200px] mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/">
              <span className="flex items-center gap-1.5 cursor-pointer" data-testid="link-home">
                <SiteLogoBadge size={24} />
              </span>
            </Link>
            <span className="text-[#9D9FA0] text-sm">|</span>
            <span className="text-[#14181B] text-sm font-medium" data-testid="text-page-title">공모주 마이페이지</span>
          </div>
          <Link href="/">
            <span className="flex items-center gap-1 text-sm text-[#585B5E] hover:text-[#14181B] cursor-pointer" data-testid="link-back-home">
              <ArrowLeft className="w-4 h-4" />
              홈으로
            </span>
          </Link>
        </div>
      </header>

      <main className="max-w-[1200px] mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-[#14181B]" data-testid="text-greeting">{user.fullName}님의 보유 종목</h1>
        </div>

        <div className="bg-[#F3F5F6] rounded-lg p-5 mb-6">
          <div className="flex flex-wrap gap-6 mb-3">
            <div>
              <p className="text-xs text-[#9D9FA0] mb-1">보유 종목수</p>
              <p className="text-lg font-bold text-[#14181B]" data-testid="text-holdings-count">{stockHoldings.length}개</p>
            </div>
            <div>
              <p className="text-xs text-[#9D9FA0] mb-1">총 평가금액</p>
              <p className="text-lg font-bold text-[#14181B]" data-testid="text-total-value">{totalEval.toLocaleString()}원</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-3 border-t border-[#E0E2E4]">
            <div>
              <p className="text-xs text-[#9D9FA0] mb-1">평가손익</p>
              <p className={`text-lg font-bold tabular-nums ${totalProfit >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`} data-testid="text-total-profit">
                {totalProfit >= 0 ? "+" : ""}{totalProfit.toLocaleString()}원
                <span className="text-sm ml-1">({totalProfitPct >= 0 ? "+" : ""}{totalProfitPct.toFixed(2)}%)</span>
              </p>
            </div>
          </div>
        </div>

        {txLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : holdings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-full bg-[#f5f5f5] flex items-center justify-center mb-3">
              <Package className="w-6 h-6 text-[#ccc]" />
            </div>
            <p className="text-sm text-[#9D9FA0]" data-testid="text-no-holdings">보유 중인 종목이 없습니다</p>
            <p className="text-xs text-[#bbb] mt-1">관리자가 주식을 입고하면 여기에 표시됩니다</p>
          </div>
        ) : (
          <>
          <div className="border border-[#E0E2E4] rounded-lg overflow-hidden hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#F9FAFB]">
                  <TableHead className="text-xs text-[#585B5E] font-medium">종목명</TableHead>
                  <TableHead className="text-xs text-[#585B5E] font-medium text-center">카테고리</TableHead>
                  <TableHead className="text-xs text-[#585B5E] font-medium text-right">보유수량</TableHead>
                  <TableHead className="text-xs text-[#585B5E] font-medium text-right">매입단가</TableHead>
                  <TableHead className="text-xs text-[#585B5E] font-medium text-right">현재가</TableHead>
                  <TableHead className="text-xs text-[#585B5E] font-medium text-right">평가금액</TableHead>
                  <TableHead className="text-xs text-[#585B5E] font-medium text-right">평가손익</TableHead>
                  <TableHead className="text-xs text-[#585B5E] font-medium text-right">수익률</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.map((h) => (
                  <TableRow key={h.id} data-testid={`row-holding-${h.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StockIcon name={h.name} size={28} />
                        <span className="text-sm font-medium text-[#14181B]">{h.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">{h.category}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-[#14181B] tabular-nums">{h.qty.toLocaleString()}주</TableCell>
                    <TableCell className="text-right text-sm text-[#14181B] tabular-nums">{h.avgPrice.toLocaleString()}원</TableCell>
                    <TableCell className="text-right text-sm text-[#14181B] tabular-nums">{h.currentPrice.toLocaleString()}원</TableCell>
                    <TableCell className="text-right text-sm font-medium text-[#14181B] tabular-nums">{h.evalAmount.toLocaleString()}원</TableCell>
                    <TableCell className={`text-right text-sm font-semibold tabular-nums ${h.profitLoss >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                      {h.profitLoss >= 0 ? "+" : ""}{h.profitLoss.toLocaleString()}원
                    </TableCell>
                    <TableCell className={`text-right text-sm font-semibold tabular-nums ${h.profitPct >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                      {h.profitPct >= 0 ? "+" : ""}{h.profitPct.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="sm:hidden space-y-3">
            {holdings.map((h) => (
              <div key={h.id} className="border border-[#E0E2E4] rounded-lg p-3" data-testid={`card-holding-${h.id}`}>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <StockIcon name={h.name} size={28} />
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-[#14181B] truncate block">{h.name}</span>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{h.category}</Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold tabular-nums ${h.profitPct >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                      {h.profitPct >= 0 ? "+" : ""}{h.profitPct.toFixed(2)}%
                    </p>
                    <p className={`text-xs tabular-nums ${h.profitLoss >= 0 ? "text-[#F73631]" : "text-[#007EFF]"}`}>
                      {h.profitLoss >= 0 ? "+" : ""}{h.profitLoss.toLocaleString()}원
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-[#9D9FA0]">보유수량</span><span className="text-[#14181B] tabular-nums">{h.qty.toLocaleString()}주</span></div>
                  <div className="flex justify-between"><span className="text-[#9D9FA0]">현재가</span><span className="text-[#14181B] tabular-nums">{h.currentPrice.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-[#9D9FA0]">매입단가</span><span className="text-[#14181B] tabular-nums">{h.avgPrice.toLocaleString()}원</span></div>
                  <div className="flex justify-between"><span className="text-[#9D9FA0]">평가금액</span><span className="text-[#14181B] tabular-nums">{h.evalAmount.toLocaleString()}원</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button
              variant="outline"
              className="gap-2 border-[#03C75A] text-[#03C75A]"
              onClick={() => setTransferConfirmOpen(true)}
              data-testid="button-transfer-from-mystocks"
            >
              <ArrowRightLeft className="w-4 h-4" />
              내 계좌로 옮기기
            </Button>
          </div>
          </>
        )}

        <div className="mt-8 border-t border-[#E0E2E4] pt-6">
          <h2 className="text-base font-bold text-[#14181B] mb-4" data-testid="text-tx-history-title">입고/출고 내역</h2>
          {txList.length === 0 ? (
            <p className="text-sm text-[#9D9FA0]">거래 내역이 없습니다</p>
          ) : (
            <>
            <div className="border border-[#E0E2E4] rounded-lg overflow-hidden hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F9FAFB]">
                    <TableHead className="text-xs text-[#585B5E] font-medium">날짜</TableHead>
                    <TableHead className="text-xs text-[#585B5E] font-medium">구분</TableHead>
                    <TableHead className="text-xs text-[#585B5E] font-medium">종목명</TableHead>
                    <TableHead className="text-xs text-[#585B5E] font-medium text-right">수량</TableHead>
                    <TableHead className="text-xs text-[#585B5E] font-medium text-right">단가</TableHead>
                    <TableHead className="text-xs text-[#585B5E] font-medium text-right">총금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txList.map((tx) => {
                    const unitPrice = tx.type === "in" ? tx.pricePerShare : (priceData[tx.stockName]?.currentPrice ?? tx.pricePerShare);
                    const totalTx = tx.quantity * unitPrice;
                    return (
                    <TableRow key={tx.id} data-testid={`row-tx-${tx.id}`}>
                      <TableCell className="text-xs text-[#585B5E]">
                        {tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("ko-KR") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.type === "in" ? "default" : "secondary"} className={tx.type === "in" ? "bg-[#03C75A] text-white text-xs" : "text-xs"}>
                          {tx.type === "in" ? "입고" : "출고"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StockIcon name={tx.stockName} size={22} />
                          <span className="text-sm text-[#14181B]">{tx.stockName}</span>
                          <Badge variant="outline" className="text-[10px]">{tx.category}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm text-[#14181B]">{tx.quantity.toLocaleString()}주</TableCell>
                      <TableCell className="text-right text-sm text-[#14181B]">{unitPrice.toLocaleString()}원</TableCell>
                      <TableCell className="text-right text-sm font-medium text-[#14181B]">{totalTx.toLocaleString()}원</TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="sm:hidden space-y-2">
              {txList.map((tx) => {
                const unitPrice = tx.type === "in" ? tx.pricePerShare : (priceData[tx.stockName]?.currentPrice ?? tx.pricePerShare);
                const totalTx = tx.quantity * unitPrice;
                return (
                <div key={tx.id} className="border border-[#E0E2E4] rounded-lg p-3" data-testid={`card-tx-${tx.id}`}>
                  <div className="flex items-center gap-3">
                    <Badge variant={tx.type === "in" ? "default" : "secondary"} className={tx.type === "in" ? "bg-[#03C75A] text-white text-xs shrink-0" : "text-xs shrink-0"}>
                      {tx.type === "in" ? "입고" : "출고"}
                    </Badge>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <StockIcon name={tx.stockName} size={22} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-[#14181B] truncate">{tx.stockName}</span>
                          <Badge variant="outline" className="text-[10px] shrink-0">{tx.category}</Badge>
                        </div>
                        <span className="text-[11px] text-[#9D9FA0]">{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString("ko-KR") : "-"}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm text-[#14181B]">{tx.quantity.toLocaleString()}주</p>
                      <p className="text-xs text-[#585B5E]">{unitPrice.toLocaleString()}원</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#F3F5F6] flex justify-between items-center">
                    <span className="text-xs text-[#9D9FA0]">총금액</span>
                    <span className={`text-sm font-bold ${tx.type === "out" ? "text-[#F73631]" : "text-[#14181B]"}`}>{totalTx.toLocaleString()}원</span>
                  </div>
                </div>
                );
              })}
            </div>
            </>
          )}
        </div>

        <div className="mt-8 border-t border-[#E0E2E4] pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-[#03C75A]" />
            <h2 className="text-base font-bold text-[#14181B]">출고 신청 목록</h2>
          </div>
          {myTransfers.length === 0 ? (
            <p className="text-sm text-[#9D9FA0]" data-testid="text-no-transfers">출고 신청 내역이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {myTransfers.map((tr) => (
                <div key={tr.id} className="border border-[#E0E2E4] rounded-lg p-4 space-y-2" data-testid={`transfer-card-${tr.id}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <StockIcon name={tr.stockName} size={22} />
                      <span className="font-medium text-sm text-[#14181B]">{tr.stockName} {tr.quantity.toLocaleString()}주</span>
                    </div>
                    {tr.status === "pending" && (
                      <Badge variant="secondary" className="gap-1 text-xs"><Clock className="w-3 h-3" />결제대기중</Badge>
                    )}
                    {tr.status === "출고대기중" && (
                      <Badge className="gap-1 text-xs bg-orange-500 hover:bg-orange-500"><Clock className="w-3 h-3" />출고대기중</Badge>
                    )}
                    {tr.status === "approved" && (
                      <Badge className="gap-1 text-xs bg-[#00a878] hover:bg-[#00a878]"><CheckCircle2 className="w-3 h-3" />승인</Badge>
                    )}
                    {tr.status === "rejected" && (
                      <Badge variant="destructive" className="gap-1 text-xs"><XCircle className="w-3 h-3" />반려</Badge>
                    )}
                    {tr.status === "held" && (
                      <Badge variant="secondary" className="gap-1 text-xs"><PauseCircle className="w-3 h-3" />보류</Badge>
                    )}
                  </div>
                  {tr.currentPrice > 0 && (
                    <div className="bg-[#F3F5F6] rounded-md p-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-[#9D9FA0]">매입단가</span>
                        <span className="tabular-nums">{tr.purchasePrice.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#9D9FA0]">현재시세</span>
                        <span className="tabular-nums font-medium">{tr.currentPrice.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-[#9D9FA0]">수익률</span>
                        <span className={`tabular-nums font-bold ${parseFloat(tr.profitRate) > 0 ? "text-[#F73631]" : parseFloat(tr.profitRate) < 0 ? "text-[#007EFF]" : ""}`}>
                          {parseFloat(tr.profitRate) > 0 ? "+" : ""}{parseFloat(tr.profitRate).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm pt-1 border-t border-[#E0E2E4]">
                        <span className="text-[#9D9FA0] font-medium">결제금액</span>
                        <span className="tabular-nums font-bold">{(tr.purchasePrice * tr.quantity).toLocaleString()}원</span>
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-[#9D9FA0]">
                    {tr.status === "approved"
                      ? <strong className="font-bold text-[#585B5E]">해당 신청건은 출고완료 되었습니다. 연동된 증권계좌 확인해주세요.</strong>
                      : tr.status === "출고대기중"
                      ? <strong className="font-bold text-[#585B5E]">대금결제 완료되었습니다. 상장당일 연동된 증권계좌로 출고됩니다.</strong>
                      : <strong className="font-bold text-[#585B5E]">대금결제는 담당 자문회사를 통해 납부해주시면 됩니다.</strong>}
                  </p>
                  <p className="text-xs text-[#BFC0C1]">{new Date(tr.createdAt).toLocaleString("ko-KR")}</p>
                  {tr.adminMemo && (
                    <p className="text-xs text-[#9D9FA0] bg-[#F3F5F6] rounded p-1.5">관리자 메모: {tr.adminMemo}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 확정매도 다이얼로그 */}
      <Dialog open={sellDialogOpen} onOpenChange={(v) => { if (!v) { setSellStock(""); setSellQty(""); setFrozenPrices({}); } setSellDialogOpen(v); }}>
        <DialogContent className="max-w-[360px] p-0 rounded-xl overflow-hidden border-0 shadow-2xl max-h-[90vh] flex flex-col">
          <div className="bg-gradient-to-b from-[#f0fdf6] to-white px-6 pt-8 pb-2 rounded-t-xl shrink-0">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-[#03C75A]/10 flex items-center justify-center">
                <Lock className="w-6 h-6 text-[#03C75A]" />
              </div>
            </div>
            <h3 className="text-base font-bold text-[#14181B] text-center mb-1">확정매도</h3>
            <p className="text-xs text-[#9D9FA0] text-center mb-4">현재 시세로 주식을 매도합니다</p>
          </div>
          <div className="px-6 pb-6 pt-2 space-y-3 overflow-y-auto">
            {stockHoldings.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-[#585B5E]">종목 선택</Label>
                <Select value={sellStock} onValueChange={(v) => { setSellStock(v); setSellQty(String(stockHoldings.find(h => h.name === v)?.qty ?? "")); }}>
                  <SelectTrigger data-testid="select-sell-stock">
                    <SelectValue placeholder="매도할 종목을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {stockHoldings.map((h) => (
                      <SelectItem key={h.name} value={h.name}>
                        {h.name} ({h.qty.toLocaleString()}주)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {sellStock && (
              <div className="bg-[#F3F5F6] rounded-lg p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[#9D9FA0]">확정 매도가</span>
                  <span className="font-bold text-[#03C75A] tabular-nums">{(frozenPrices[sellStock] ?? 0).toLocaleString()}원</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#9D9FA0]">보유 수량</span>
                  <span className="tabular-nums">{(stockHoldings.find(h => h.name === sellStock)?.qty ?? 0).toLocaleString()}주</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">매도 수량</Label>
              <Input
                type="number"
                placeholder="수량을 입력하세요"
                value={sellQty}
                onChange={(e) => setSellQty(e.target.value)}
                min={1}
                max={stockHoldings.find(h => h.name === sellStock)?.qty ?? undefined}
                data-testid="input-sell-quantity"
              />
              {sellStock && (
                <p className="text-xs text-[#9D9FA0]">최대 {(stockHoldings.find(h => h.name === sellStock)?.qty ?? 0).toLocaleString()}주</p>
              )}
            </div>
            <div className="bg-[#03C75A]/5 border border-[#03C75A]/20 rounded-lg p-3 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-[#585B5E] font-medium">총 매도금액</span>
                <span className="font-bold text-[#03C75A] tabular-nums text-base">
                  {sellStock && sellQty && parseInt(sellQty) > 0
                    ? ((frozenPrices[sellStock] ?? 0) * parseInt(sellQty)).toLocaleString() + "원"
                    : "—"}
                </span>
              </div>
              {sellStock && sellQty && parseInt(sellQty) > 0 && (
                <div className="flex justify-between text-xs text-[#9D9FA0]">
                  <span>{(frozenPrices[sellStock] ?? 0).toLocaleString()}원 × {parseInt(sellQty).toLocaleString()}주</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSellDialogOpen(false)}
                disabled={sellMutation.isPending}
                data-testid="button-sell-cancel"
              >
                취소
              </Button>
              <Button
                className="flex-1 bg-[#03C75A] hover:bg-[#02b350] text-white font-medium rounded-lg"
                disabled={
                  !sellStock ||
                  !sellQty ||
                  parseInt(sellQty) <= 0 ||
                  parseInt(sellQty) > (stockHoldings.find(h => h.name === sellStock)?.qty ?? 0) ||
                  !(frozenPrices[sellStock] > 0) ||
                  sellMutation.isPending
                }
                onClick={() => sellMutation.mutate()}
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
                <SelectTrigger data-testid="select-mystocks-transfer-stock">
                  <SelectValue placeholder="출고할 종목을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {stockHoldings.map((h) => (
                    <SelectItem key={h.name} value={h.name}>
                      {h.name} ({h.qty.toLocaleString()}주)
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
                max={stockHoldings.find(h => h.name === transferStock)?.qty ?? undefined}
                data-testid="input-mystocks-transfer-quantity"
              />
              {transferStock && (
                <p className="text-xs font-bold text-[#14181B]">최대 {(stockHoldings.find(h => h.name === transferStock)?.qty ?? 0).toLocaleString()}주</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">예금주명</Label>
              <Input
                value={user.accountHolder || user.fullName || ""}
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed text-sm"
                placeholder="회원가입 시 입력한 이름"
                data-testid="input-mystocks-transfer-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-[#585B5E]">계좌번호</Label>
              <Input
                value={user.accountNumber || ""}
                readOnly
                disabled
                className="bg-muted/50 cursor-not-allowed text-sm"
                placeholder="회원가입 시 입력한 계좌번호"
                data-testid="input-mystocks-transfer-account"
              />
              {!user.accountNumber && (
                <p className="text-xs text-[#F73631]">내 정보에서 계좌번호를 먼저 등록해주세요</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTransferConfirmOpen(false)} data-testid="button-mystocks-transfer-cancel">
                취소
              </Button>
              <Button
                className="flex-1 bg-[#03C75A] hover:bg-[#02b350] text-white font-medium rounded-lg"
                onClick={() => {
                  transferMutation.mutate();
                }}
                disabled={
                  !transferStock ||
                  !transferQuantity ||
                  parseInt(transferQuantity) <= 0 ||
                  parseInt(transferQuantity) > (stockHoldings.find(h => h.name === transferStock)?.qty ?? 0) ||
                  !user.accountNumber
                }
                data-testid="button-transfer-confirm-mystocks"
              >
                출고 신청
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
