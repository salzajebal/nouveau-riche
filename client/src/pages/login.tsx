import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Send, Clock, CheckCircle2, XCircle, PauseCircle, ArrowRightLeft, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SiteLogoBadge } from "@/components/site-logo";
import type { TransferRequest, StockTransaction } from "@shared/schema";
import { calculateHoldingLots } from "@/lib/holding-lots";

function TransferStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline" className="gap-1" data-testid="badge-status-pending"><Clock className="w-3 h-3" />대기중</Badge>;
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

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [transferName, setTransferName] = useState("");
  const [transferAccount, setTransferAccount] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferStock, setTransferStock] = useState("");
  const [transferCategory, setTransferCategory] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [findPwOpen, setFindPwOpen] = useState(false);
  const [findPwUsername, setFindPwUsername] = useState("");
  const [findPwPhone, setFindPwPhone] = useState("");
  const [foundPassword, setFoundPassword] = useState<string | null>(null);
  const [showFoundPw, setShowFoundPw] = useState(false);

  const findPasswordMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/find-password", { username: findPwUsername, phone: findPwPhone }),
    onSuccess: async (res) => {
      const data = await res.json();
      setFoundPassword(data.password);
    },
    onError: async (err: any) => {
      let msg = "일치하는 회원 정보가 없습니다";
      try { const d = await err.response?.json(); if (d?.message) msg = d.message; } catch {}
      toast({ title: "비밀번호 찾기 실패", description: msg, variant: "destructive" });
    },
  });

  const { data: authData } = useQuery<{ user: any }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const currentUser = authData?.user;

  const { data: myTransfers = [] } = useQuery<TransferRequest[]>({
    queryKey: ["/api/transfer-requests/my"],
    enabled: !!currentUser,
  });

  const { data: myTransactions = [] } = useQuery<StockTransaction[]>({
    queryKey: ["/api/transactions/my"],
    enabled: !!currentUser,
  });

  const loginHoldings: { name: string; category: string; qty: number; avgPrice: number }[] = (() => {
    const lots = calculateHoldingLots(myTransactions);
    const map = new Map<string, { name: string; category: string; qty: number; totalCost: number }>();
    lots.filter((lot) => lot.category === "S.O").forEach((lot) => {
      const key = `${lot.name}\u0000${lot.category ?? ""}`;
      const holding = map.get(key) || { name: lot.name, category: lot.category ?? "", qty: 0, totalCost: 0 };
      holding.qty += lot.qty;
      holding.totalCost += lot.qty * lot.pricePerShare;
      map.set(key, holding);
    });
    return Array.from(map.values())
      .map((holding) => {
        const pendingQty = myTransfers
          .filter((request) =>
            ["pending", "출고대기중", "held"].includes(request.status) &&
            request.stockName === holding.name &&
            (!request.category || request.category === holding.category)
          )
          .reduce((sum, request) => sum + request.quantity, 0);
        return {
          ...holding,
          qty: Math.max(0, holding.qty - pendingQty),
          avgPrice: Math.round(holding.totalCost / holding.qty),
        };
      })
      .filter((holding) => holding.qty > 0);
  })();

  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws?role=member`);
    wsRef.current = ws;
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "transfer_update") {
          queryClient.invalidateQueries({ queryKey: ["/api/transfer-requests/my"] });
          if (data.data?.action === "status_change" && data.data?.statusLabel) {
            toast({
              title: "대체출고 상태 변경",
              description: `신청이 "${data.data.statusLabel}" 처리되었습니다`,
            });
          }
        }
        if (data.type === "transaction_update") {
          queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
        }
      } catch {}
    };
    return () => { ws.close(); wsRef.current = null; };
  }, [currentUser?.id]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/login", { username, password });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      if (data.user.isAdmin) {
        setLocation("/admin");
      } else {
        setLocation("/");
      }
    },
    onError: (error: Error) => {
      let description = "오류가 발생했습니다";
      if (error.message.includes("401")) {
        description = "아이디 또는 비밀번호가 일치하지 않습니다";
      } else if (error.message.includes("403")) {
        try {
          const bodyStr = error.message.replace(/^\d+:\s*/, "");
          const body = JSON.parse(bodyStr);
          if (body.code === "PENDING_APPROVAL") {
            description = "가입 승인 대기 중입니다. 관리자 승인 후 로그인이 가능합니다.";
          } else {
            description = "계정이 동결되었습니다. 관리자에게 문의하세요.";
          }
        } catch {
          description = "계정이 동결되었습니다. 관리자에게 문의하세요.";
        }
      }
      toast({
        title: "로그인 실패",
        description,
        variant: "destructive",
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/transfer-requests", {
        userId: currentUser.id,
        accountName: transferName,
        accountNumber: transferAccount,
        quantity: parseInt(transferQuantity),
        stockName: transferStock,
        category: transferCategory,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "출고 신청 완료", description: "타사 대체출고가 신청되었습니다. 관리자 승인을 기다려주세요." });
      setTransferName("");
      setTransferAccount("");
      setTransferQuantity("");
      setTransferStock("");
      setTransferCategory("");
      queryClient.invalidateQueries({ queryKey: ["/api/transfer-requests/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions/my"] });
    },
    onError: (error: Error) => {
      let msg = "출고 신청에 실패했습니다";
      try {
        const parsed = JSON.parse(error.message.replace(/^[0-9]+:\s*/, ""));
        if (parsed.message) msg = parsed.message;
      } catch {
        if (error.message.includes("400")) msg = "보유 수량을 초과하거나 입력이 올바르지 않습니다";
      }
      toast({ title: "출고 신청 실패", description: msg, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const selectedHolding = loginHoldings.find(h => h.name === transferStock && h.category === transferCategory);
    if (!transferStock || !transferName || !transferAccount || !transferQuantity || parseInt(transferQuantity) <= 0 || parseInt(transferQuantity) > (selectedHolding?.qty ?? 0)) {
      toast({ title: "입력 오류", description: "모든 항목을 올바르게 입력해주세요", variant: "destructive" });
      return;
    }
    transferMutation.mutate();
  };

  const showTransferPanel = isLoggedIn || !!currentUser;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className={`w-full ${showTransferPanel ? "max-w-4xl" : "max-w-md"}`}>
        <div className="text-center mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
              <ArrowLeft className="w-4 h-4 mr-1" /> 홈으로
            </Button>
          </Link>
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <SiteLogoBadge size={36} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{showTransferPanel ? "누보리치" : "로그인"}</h1>
          <p className="text-sm text-muted-foreground mt-1">비상장 주식 관리 시스템</p>
        </div>

        <div className={`${showTransferPanel ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}`}>
          {!showTransferPanel && (
            <>
            <Card className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">아이디</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="아이디를 입력하세요"
                    required
                    data-testid="input-username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">비밀번호</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    required
                    data-testid="input-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                  data-testid="button-login"
                >
                  {loginMutation.isPending ? "로그인 중..." : "로그인"}
                </Button>
              </form>
              <div className="mt-4 text-center text-sm text-muted-foreground space-y-1">
                <div>
                  계정이 없으신가요?{" "}
                  <Link href="/register" className="text-primary font-medium" data-testid="link-register">
                    회원가입
                  </Link>
                </div>
                <div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-primary underline underline-offset-2 text-xs"
                    onClick={() => { setFindPwOpen(true); setFoundPassword(null); setFindPwUsername(""); setFindPwPhone(""); }}
                    data-testid="button-find-password"
                  >
                    비밀번호 찾기
                  </button>
                </div>
              </div>
            </Card>

            <Dialog open={findPwOpen} onOpenChange={(o) => { setFindPwOpen(o); if (!o) { setFoundPassword(null); setShowFoundPw(false); } }}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>비밀번호 찾기</DialogTitle>
                  <DialogDescription>가입 시 등록한 아이디와 휴대폰 번호를 입력하세요</DialogDescription>
                </DialogHeader>
                {foundPassword ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
                      <p className="text-xs text-green-700 mb-2 font-medium">비밀번호가 확인되었습니다</p>
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-mono text-lg font-bold text-green-800">
                          {showFoundPw ? foundPassword : "•".repeat(foundPassword.length)}
                        </span>
                        <button type="button" onClick={() => setShowFoundPw(v => !v)} className="text-green-600 hover:text-green-800">
                          {showFoundPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full" onClick={() => { setFindPwOpen(false); setPassword(foundPassword); setUsername(findPwUsername); setFoundPassword(null); setShowFoundPw(false); }} data-testid="button-use-found-password">
                      이 비밀번호로 로그인
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="find-username">아이디</Label>
                      <Input id="find-username" value={findPwUsername} onChange={e => setFindPwUsername(e.target.value)} placeholder="아이디를 입력하세요" data-testid="input-find-username" />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="find-phone">휴대폰 번호</Label>
                      <Input id="find-phone" value={findPwPhone} onChange={e => setFindPwPhone(e.target.value)} placeholder="010-0000-0000" data-testid="input-find-phone" />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => findPasswordMutation.mutate()}
                      disabled={findPasswordMutation.isPending || !findPwUsername || !findPwPhone}
                      data-testid="button-submit-find-password"
                    >
                      {findPasswordMutation.isPending ? "확인 중..." : "비밀번호 확인"}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>
            </>
          )}

          {showTransferPanel && (
            <>
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowRightLeft className="w-5 h-5 text-[#03C75A]" />
                  <h2 className="text-lg font-semibold">타사 대체출고 신청</h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  현재 보유 중인 비상장 주식을 타 증권사로 출고할 수 있습니다.
                  출고 신청 시 현재 포지션이 종료되며, 관리자 승인 후 처리됩니다.
                </p>
                <form onSubmit={handleTransferSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>종목 선택</Label>
                    {loginHoldings.length > 0 ? (
                      <Select
                        value={transferStock ? `${transferStock}\u0000${transferCategory}` : ""}
                        onValueChange={(val) => {
                          const separator = val.indexOf("\u0000");
                          setTransferStock(separator >= 0 ? val.slice(0, separator) : val);
                          setTransferCategory(separator >= 0 ? val.slice(separator + 1) : "");
                          setTransferQuantity("");
                        }}
                      >
                        <SelectTrigger data-testid="select-login-transfer-stock">
                          <SelectValue placeholder="출고할 종목을 선택하세요" />
                        </SelectTrigger>
                        <SelectContent>
                          {loginHoldings.map((h) => (
                            <SelectItem key={`${h.name}\u0000${h.category}`} value={`${h.name}\u0000${h.category}`}>
                              {h.name} · {h.category || "일반"} ({h.qty.toLocaleString()}주 · 매입단가 {h.avgPrice.toLocaleString()}원)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">보유 중인 종목이 없습니다</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transfer-name">예금주명</Label>
                    <Input
                      id="transfer-name"
                      value={transferName}
                      onChange={(e) => setTransferName(e.target.value)}
                      placeholder="출고 받을 계좌 예금주명"
                      required
                      data-testid="input-transfer-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transfer-account">계좌번호</Label>
                    <Input
                      id="transfer-account"
                      value={transferAccount}
                      onChange={(e) => setTransferAccount(e.target.value)}
                      placeholder="출고 받을 증권사 계좌번호"
                      required
                      data-testid="input-transfer-account"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="transfer-quantity">출고 수량 (주)</Label>
                    <Input
                      id="transfer-quantity"
                      type="number"
                      min="1"
                      max={transferStock ? (loginHoldings.find(h => h.name === transferStock && h.category === transferCategory)?.qty || 0) : undefined}
                      value={transferQuantity}
                      onChange={(e) => setTransferQuantity(e.target.value)}
                      placeholder={transferStock ? `최대 ${(loginHoldings.find(h => h.name === transferStock && h.category === transferCategory)?.qty || 0).toLocaleString()}주` : "종목을 먼저 선택하세요"}
                      required
                      disabled={!transferStock}
                      data-testid="input-transfer-quantity"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[#03C75A] border-[#03C75A] hover:bg-[#02b350]"
                    disabled={transferMutation.isPending || loginHoldings.length === 0 || !transferStock}
                    data-testid="button-submit-transfer"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {transferMutation.isPending ? "신청 중..." : "출고 신청"}
                  </Button>
                </form>
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <Link href="/dashboard">
                    <Button variant="outline" size="sm" data-testid="link-dashboard">
                      대시보드로 이동
                    </Button>
                  </Link>
                </div>
              </Card>

              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-[#03C75A]" />
                  <h2 className="text-lg font-semibold">대체출고 신청 목록</h2>
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
                           <span className="font-medium text-sm">
                             {tr.stockName} {(tr as TransferRequest & { category?: string }).category && (
                               <Badge variant="outline" className="text-[10px] ml-1">{(tr as TransferRequest & { category?: string }).category}</Badge>
                             )} {tr.quantity.toLocaleString()}주
                           </span>
                          <TransferStatusBadge status={tr.status} />
                        </div>
                        {tr.currentPrice > 0 && (
                          <div className="bg-muted/50 rounded-md p-2 space-y-1">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">매입단가</span>
                              <span className="tabular-nums">{tr.purchasePrice.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">현재시세</span>
                              <span className="tabular-nums font-medium">{tr.currentPrice.toLocaleString()}원</span>
                            </div>
                            <div className="flex justify-between text-sm pt-1 border-t border-border/50">
                              <span className="text-muted-foreground font-medium">결제금액</span>
                              <span className="tabular-nums font-bold">{(tr.purchasePrice * tr.quantity).toLocaleString()}원</span>
                            </div>
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground">
                          {tr.status === "approved"
                            ? <strong className="font-medium text-foreground">승인처리 완료되었습니다. 상장당일 연동된 증권계좌로 이동됩니다.</strong>
                             : tr.status === "출고대기중"
                             ? <strong className="font-medium text-foreground">입고되신 주식 대금결제 완료되었습니다. 상장 2거래일전(D-2) 전부터 순차적으로 출고되십니다.</strong>
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
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
