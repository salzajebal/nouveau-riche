import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, Link, Redirect } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, getQueryFn } from "@/lib/queryClient";
import { STOCK_CATEGORIES, KOREAN_BANKS } from "@shared/schema";
import { StockIcon } from "@/components/stock-icon";
import { calculateHoldingLots } from "@/lib/holding-lots";
import { playNotificationSound, unlockNotificationSound } from "@/lib/notification-sound";
import type { User, StockTransaction, TransferRequest, IpoStock, StockCatalog, DomainGroup, LoginLog, BlockedIp, StockMemberTransfer, UnionCode, DomainFallbackUrl, WithdrawRequest } from "@shared/schema";
import { mergeChatSnapshot } from "@shared/chat-security";
import {
  LogOut, Users, Package, ArrowDownRight, ArrowUpRight,
  Search, Trash2, LayoutDashboard, ClipboardList, Home, ChevronLeft, ChevronRight,
  Eye, EyeOff, Pencil, Snowflake, UserX, AlertTriangle, Save, X, ArrowRightLeft,
  CheckCircle2, XCircle, PauseCircle, Clock, MessageSquare, Send, Menu, Plus, BookOpen, Copy,
  Bell, BellOff, Volume2, VolumeX, Globe, Activity, GripVertical, ExternalLink, ToggleLeft, ToggleRight, Loader2, Ban, Shield, ImageIcon,
  Banknote, TrendingDown, ChevronUp, ChevronDown,
} from "lucide-react";

const formatPct = (n: number) =>
  n.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KOREAN_STOCK_LIST = [
  "삼성전자","SK하이닉스","LG에너지솔루션","삼성바이오로직스","현대자동차","기아","셀트리온","KB금융","POSCO홀딩스","신한지주",
  "삼성SDI","LG화학","NAVER","카카오","하나금융지주","현대모비스","삼성물산","SK이노베이션","LG전자","삼성생명",
  "한국전력","SK텔레콤","KT","우리금융지주","삼성화재","포스코인터내셔널","SK","한화에어로스페이스","대한항공","HMM",
  "LG","고려아연","삼성전기","한화솔루션","한국타이어앤테크놀로지","CJ제일제당","S-Oil","두산에너빌리티","롯데케미칼","엔씨소프트",
  "카카오뱅크","크래프톤","삼성에스디에스","NH투자증권","미래에셋증권","한국투자증권","키움증권","대신증권","SK바이오팜","SK바이오사이언스",
  "에코프로비엠","에코프로","포스코퓨처엠","알테오젠","한미약품","유한양행","녹십자","JYP엔터","HYBE","SM엔터",
  "넷마블","펄어비스","컴투스","CJ ENM","스튜디오드래곤","카카오게임즈","위메이드","쿠팡","SK스퀘어","LG이노텍",
  "두산밥캣","한화오션","HD현대","HD한국조선해양","HD현대중공업","현대건설","GS건설","대우건설","현대엔지니어링","DL이앤씨",
  "한전KPS","한국가스공사","에스원","CJ대한통운","하이브","아모레퍼시픽","LG생활건강","호텔신라","F&F","한섬",
  "케이뱅크","무신사","두나무","빗썸","에스팀","엑스비스","카나프테라퓨틱스","한패스","아이엠바이오로직스","리센스메디컬","채비","코스모로보틱스","토스","야놀자","컬리",
  "오아시스","에너진","오톰","이브이알스튜디오","에스엠랩","케이솔루션","비바리퍼블리카","직방","마켓컬리","쏘카",
  "원스토어","리디","버킷플레이스","당근","지그재그","클래스101","스파크플러스","마이리얼트립","타다","플레이디",
  "위블","코리아센터","브레인즈컴퍼니","메디톡스","휴젤","파마리서치","제넥신","진원생명과학","씨젠","에이비엘바이오",
  "레인보우로보틱스","두산로보틱스","한화시스템","LIG넥스원","현대로템","풍산","한국항공우주","한화","LG디스플레이","BOE",
  "마키나락스","피스피스스튜디오","매드업","레몬헬스케어","덕양에너젠","빅웨이브로보틱스","기도산업","니어스랩","브릴스",
];

const STOCK_FACE_VALUES: Record<string, number> = {
  "마키나락스": 500,
  "레몬헬스케어": 3000,
  "덕양에너젠": 10000,
  "빅웨이브로보틱스": 20000,
  "기도산업": 9000,
};

function StockTransactionDialog({
  user,
  type,
  onSuccess,
}: {
  user: User;
  type: "in" | "out";
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [category, setCategory] = useState("일반");
  const [stockName, setStockName] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [quantity, setQuantity] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");
  const [memo, setMemo] = useState("");
  const [txDate, setTxDate] = useState("");
  const [fetchedLogoUrl, setFetchedLogoUrl] = useState<string | null>(null);
  const [logoImgErr, setLogoImgErr] = useState(false);
  const { toast } = useToast();

  const filteredStocks = stockSearch.length > 0
    ? KOREAN_STOCK_LIST.filter(s => s.includes(stockSearch)).slice(0, 8)
    : [];

  useEffect(() => {
    if (!stockName || stockSearch) { setFetchedLogoUrl(null); setLogoImgErr(false); return; }
    const t = setTimeout(() => {
      fetch(`/api/stock-logo-search?name=${encodeURIComponent(stockName)}`)
        .then(r => r.json())
        .then((d: { logoUrl: string | null }) => { setFetchedLogoUrl(d.logoUrl || null); setLogoImgErr(false); })
        .catch(() => setFetchedLogoUrl(null));
    }, 300);
    return () => clearTimeout(t);
  }, [stockName, stockSearch]);

  const resetForm = () => {
    setStockName(""); setStockSearch(""); setQuantity(""); setPricePerShare("");
    setMemo(""); setTxDate(""); setStep("form");
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/transactions", {
        userId: user.id,
        type,
        category,
        stockName,
        quantity: parseInt(quantity),
        pricePerShare: parseInt(pricePerShare),
        memo: memo || null,
        createdAt: txDate || undefined,
      });
    },
    onSuccess: () => {
      toast({
        title: type === "in" ? "입고 완료" : "출고 완료",
        description: `${user.fullName}님에게 ${stockName} ${quantity}주 ${type === "in" ? "입고" : "출고"} 완료`,
      });
      setOpen(false);
      resetForm();
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류 발생", description: error.message, variant: "destructive" });
      setStep("form");
    },
  });

  const qty = parseInt(quantity) || 0;
  const price = parseInt(pricePerShare) || 0;
  const totalAmount = qty * price;
  const canProceed = !!stockName && qty > 0 && price > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={type === "in" ? "default" : "secondary"}
          className={type === "in" ? "bg-red-500 border-red-500" : "bg-blue-500 border-blue-500 text-white"}
          data-testid={`button-${type}-${user.id}`}
        >
          {type === "in" ? (
            <><ArrowDownRight className="w-3 h-3 mr-1" />입고</>
          ) : (
            <><ArrowUpRight className="w-3 h-3 mr-1" />출고</>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {user.fullName}님 - {type === "in" ? "주식 입고" : "주식 출고"}
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>카테고리</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STOCK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 relative">
              <Label>종목명</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={stockSearch || stockName}
                  onChange={(e) => { setStockSearch(e.target.value); setStockName(e.target.value); }}
                  placeholder="종목명 검색 (예: 삼성전자)"
                  className="pl-9"
                  data-testid="input-stock-name"
                />
              </div>
              {stockName && !stockSearch && (
                <div className="flex items-center gap-2 mt-1 px-1">
                  {stockName !== "니어스랩" && fetchedLogoUrl && !logoImgErr ? (
                    <img src={fetchedLogoUrl} alt={stockName} className="w-5 h-5 rounded-full object-cover shrink-0" onError={() => setLogoImgErr(true)} />
                  ) : (
                    <StockIcon name={stockName} size={20} />
                  )}
                  <span className="text-sm font-medium text-gray-700">{stockName}</span>
                  {stockName !== "니어스랩" && fetchedLogoUrl && !logoImgErr && <span className="text-xs text-green-600">로고 확인됨</span>}
                </div>
              )}
              {filteredStocks.length > 0 && stockSearch && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-[240px] overflow-y-auto">
                  {filteredStocks.map((name) => (
                    <button
                      key={name}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
                      onClick={() => {
                        setStockName(name);
                        setStockSearch("");
                        if (type === "in" && STOCK_FACE_VALUES[name]) {
                          setPricePerShare(String(STOCK_FACE_VALUES[name]));
                        }
                      }}
                      data-testid={`suggestion-stock-${name}`}
                    >
                      <StockIcon name={name} size={24} />
                      <span className="font-medium text-gray-800">{name}</span>
                      {STOCK_FACE_VALUES[name] && (
                        <span className="ml-auto text-xs text-gray-400">참고단가 {STOCK_FACE_VALUES[name].toLocaleString()}원</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>수량 (주)</Label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="수량 입력" data-testid="input-quantity" />
              </div>
              <div className="space-y-2">
                <Label>단가 (원)</Label>
                <Input type="number" value={pricePerShare} onChange={(e) => setPricePerShare(e.target.value)} placeholder="단가 입력" data-testid="input-price" />
              </div>
            </div>
            {qty > 0 && price > 0 && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-500">{qty.toLocaleString()}주 × {price.toLocaleString()}원</span>
                <span className="text-base font-bold tabular-nums text-gray-900">= {totalAmount.toLocaleString()}원</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>메모</Label>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" data-testid="input-memo" />
            </div>
            <div className="space-y-2">
              <Label>거래일자 (미입력 시 현재 시간)</Label>
              <Input type="datetime-local" value={txDate} onChange={(e) => setTxDate(e.target.value)} data-testid="input-tx-date" />
            </div>
            <Button
              className="w-full"
              onClick={() => setStep("confirm")}
              disabled={!canProceed}
              data-testid="button-next-confirm"
            >
              다음 → 내용 확인
            </Button>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-4 space-y-3">
              <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                ⚠️ 저장 전 내용을 반드시 확인하세요
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">회원</span>
                  <span className="font-semibold text-gray-800">{user.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">유형</span>
                  <span className={`font-semibold ${type === "in" ? "text-red-600" : "text-blue-600"}`}>{type === "in" ? "입고" : "출고"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">종목</span>
                  <span className="font-semibold text-gray-800">{stockName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">카테고리</span>
                  <span className="font-semibold text-gray-800">{category}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">수량</span>
                  <span className="font-semibold text-gray-800">{qty.toLocaleString()}주</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">단가</span>
                  <span className="font-bold text-lg text-gray-900">{price.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between border-t border-amber-200 pt-2 mt-1">
                  <span className="text-gray-600 font-medium">총 금액</span>
                  <span className="font-bold text-xl text-gray-900">{totalAmount.toLocaleString()}원</span>
                </div>
                {memo && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">메모</span>
                    <span className="text-gray-700">{memo}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep("form")} data-testid="button-back-form">
                ← 수정하기
              </Button>
              <Button
                className={`flex-1 ${type === "in" ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"}`}
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending}
                data-testid="button-submit-transaction"
              >
                {mutation.isPending ? "처리 중..." : `✓ 확인 후 ${type === "in" ? "입고" : "출고"} 저장`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionEditDialog({ tx, onSuccess }: { tx: StockTransaction; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(tx.quantity));
  const [pricePerShare, setPricePerShare] = useState(String(tx.pricePerShare));
  const [memo, setMemo] = useState(tx.memo || "");
  const [category, setCategory] = useState(tx.category);
  const [txDate, setTxDate] = useState(() => {
    const d = new Date(tx.createdAt);
    return d.toISOString().slice(0, 16);
  });
  const { toast } = useToast();

  const isValid = quantity && parseInt(quantity) > 0 && pricePerShare && parseInt(pricePerShare) > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/admin/transactions/${tx.id}`, {
        quantity: parseInt(quantity),
        pricePerShare: parseInt(pricePerShare),
        memo: memo || null,
        category,
        createdAt: txDate ? new Date(txDate).toISOString() : undefined,
      });
    },
    onSuccess: () => {
      toast({ title: "수정 완료", description: `거래내역이 수정되었습니다` });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) { setQuantity(String(tx.quantity)); setPricePerShare(String(tx.pricePerShare)); setMemo(tx.memo || ""); setCategory(tx.category); setTxDate(new Date(tx.createdAt).toISOString().slice(0, 16)); } }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-tx-${tx.id}`} title="수정">
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>거래내역 수정</DialogTitle>
          <DialogDescription>{tx.stockName} - {tx.type === "in" ? "입고" : "출고"}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>카테고리</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-edit-tx-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOCK_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>수량 (주)</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} data-testid="input-edit-tx-quantity" />
          </div>
          <div className="space-y-2">
            <Label>{tx.type === "in" || tx.type === "입고" ? "매입단가 (원)" : "단가 (원)"}</Label>
            <Input type="number" value={pricePerShare} onChange={(e) => setPricePerShare(e.target.value)} data-testid="input-edit-tx-price" />
          </div>
          <div className="space-y-2">
            <Label>거래일자</Label>
            <Input type="datetime-local" value={txDate} onChange={(e) => setTxDate(e.target.value)} data-testid="input-edit-tx-date" />
          </div>
          <div className="space-y-2">
            <Label>메모</Label>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="메모 (선택)" data-testid="input-edit-tx-memo" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !isValid} data-testid="button-save-tx">
              {mutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberPurchasePriceDialog({
  user,
  transactions,
  onSuccess,
}: {
  user: User;
  transactions: StockTransaction[];
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const holdingLots = calculateHoldingLots(transactions.filter((tx) => tx.userId === user.id));

  const mutation = useMutation({
    mutationFn: async ({ transactionId, pricePerShare }: { transactionId: string; pricePerShare: number }) => {
      await apiRequest("PUT", `/api/admin/transactions/${transactionId}`, { pricePerShare });
    },
    onSuccess: () => {
      toast({ title: "수정 완료", description: "회원의 매입단가가 변경되었습니다" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setPrices(Object.fromEntries(holdingLots.map((lot) => [lot.id, String(lot.pricePerShare)])));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          data-testid={`button-purchase-price-${user.id}`}
          title="매입단가 설정"
        >
          <Banknote className="w-4 h-4 text-emerald-600" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>회원별 매입단가 설정</DialogTitle>
          <DialogDescription>
            {user.fullName} 회원의 보유 주식 매입단가를 입고 건별로 설정합니다.
          </DialogDescription>
        </DialogHeader>
        {holdingLots.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            현재 보유 중인 주식이 없습니다.
          </div>
        ) : (
          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {holdingLots.map((lot) => {
              const nextPrice = Number(prices[lot.id]);
              const isValid = Number.isInteger(nextPrice) && nextPrice > 0;
              const unchanged = nextPrice === lot.pricePerShare;
              return (
                <Card key={lot.id} className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <StockIcon name={lot.name} size={24} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium">{lot.name}</span>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{lot.category}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          보유 {lot.qty.toLocaleString()}주 · 입고 {new Date(lot.createdAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={prices[lot.id] ?? ""}
                        onChange={(event) => setPrices((current) => ({ ...current, [lot.id]: event.target.value }))}
                        className="h-8 w-28 text-right text-xs"
                        aria-label={`${lot.name} 매입단가`}
                        data-testid={`input-purchase-price-${lot.id}`}
                      />
                      <span className="text-xs text-muted-foreground">원</span>
                      <Button
                        size="sm"
                        className="h-8"
                        onClick={() => mutation.mutate({ transactionId: lot.id, pricePerShare: nextPrice })}
                        disabled={mutation.isPending || !isValid || unchanged}
                        data-testid={`button-save-purchase-price-${lot.id}`}
                      >
                        저장
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionDeleteButton({ tx, onSuccess }: { tx: StockTransaction; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/transactions/${tx.id}`);
    },
    onSuccess: () => {
      toast({ title: "삭제 완료", description: `${tx.stockName} ${tx.quantity}주 거래가 삭제되었습니다` });
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-delete-tx-${tx.id}`} title="삭제" className="text-destructive">
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>거래내역 삭제</DialogTitle>
          <DialogDescription>이 거래를 삭제하면 회원에게 보이지 않게 됩니다.</DialogDescription>
        </DialogHeader>
        <Card className="p-3">
          <div className="flex items-center gap-2">
            <Badge variant={tx.type === "in" ? "default" : "secondary"} className={`shrink-0 text-[11px] ${tx.type === "in" ? "bg-red-500 border-red-500" : "bg-blue-500 border-blue-500 text-white"}`}>
              {tx.type === "in" ? "입고" : "출고"}
            </Badge>
            <span className="text-sm font-medium">{tx.stockName}</span>
          </div>
          <p className="text-sm mt-1">{tx.quantity.toLocaleString()}주 x {tx.pricePerShare.toLocaleString()}원</p>
          <p className="text-xs text-muted-foreground mt-1">{new Date(tx.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</p>
        </Card>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button variant="destructive" onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-confirm-delete-tx">
            {mutation.isPending ? "삭제 중..." : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberDetailDialog({ user, transactions, onTransactionChange }: { user: User; transactions: StockTransaction[]; onTransactionChange: () => void }) {
  const [open, setOpen] = useState(false);
  const userTx = transactions.filter((t) => t.userId === user.id);
  const totalIn = userTx.filter((t) => t.type === "in").reduce((s, t) => s + t.quantity, 0);
  const totalOut = userTx.filter((t) => t.type === "out").reduce((s, t) => s + t.quantity, 0);
  const totalValue = userTx.filter((t) => t.type === "in").reduce((s, t) => s + t.quantity * t.pricePerShare, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-view-${user.id}`} title="정보 열람">
          <Eye className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>회원 정보 열람</DialogTitle>
          <DialogDescription>회원의 상세 정보와 거래 현황을 확인합니다</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">{user.fullName.charAt(0)}</span>
            </div>
            <div>
              <p className="font-bold text-lg">{user.fullName}</p>
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            </div>
            {user.isFrozen && <Badge variant="destructive" className="ml-auto">동결</Badge>}
          </div>

          <Card className="p-3">
            <p className="text-xs text-muted-foreground">비밀번호</p>
            <p className="text-sm font-medium font-mono mt-0.5">{user.plainPassword || "(암호화됨)"}</p>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">생년월일</p>
              <p className="text-sm font-medium mt-0.5">{user.birthDate || "-"}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">휴대폰번호</p>
              <p className="text-sm font-medium mt-0.5">{user.phone || "-"}</p>
            </Card>
            <Card className="p-3 col-span-2">
              <p className="text-xs text-muted-foreground">이메일</p>
              <p className="text-sm font-medium mt-0.5">{user.email || "-"}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">증권사</p>
              <p className="text-sm font-medium mt-0.5">{user.bank}</p>
            </Card>
            <Card className="p-3">
              <p className="text-xs text-muted-foreground">예금주</p>
              <p className="text-sm font-medium mt-0.5">{user.accountHolder}</p>
            </Card>
            <Card className="p-3 col-span-2">
              <p className="text-xs text-muted-foreground">계좌번호</p>
              <p className="text-sm font-medium font-mono mt-0.5">{user.accountNumber}</p>
            </Card>
            {user.unionCode && (
              <Card className="p-3 col-span-2">
                <p className="text-xs text-muted-foreground">조합코드</p>
                <p className="text-sm font-medium font-mono mt-0.5">{user.unionCode}</p>
              </Card>
            )}
          </div>

          <Card className="p-3">
            <p className="text-xs text-muted-foreground mb-2">가입일</p>
            <p className="text-sm font-medium">{new Date(user.createdAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</p>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">총 입고</p>
              <p className="text-lg font-bold text-red-500 mt-0.5 tabular-nums">{totalIn.toLocaleString()}주</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">총 출고</p>
              <p className="text-lg font-bold text-blue-500 mt-0.5 tabular-nums">{totalOut.toLocaleString()}주</p>
            </Card>
            <Card className="p-3 text-center">
              <p className="text-xs text-muted-foreground">보유 잔량</p>
              <p className="text-lg font-bold mt-0.5 tabular-nums">{(totalIn - totalOut).toLocaleString()}주</p>
            </Card>
          </div>

          <Card className="p-3">
            <p className="text-xs text-muted-foreground">총 입고 금액</p>
            <p className="text-lg font-bold mt-0.5 tabular-nums">{totalValue.toLocaleString()}원</p>
          </Card>

          {userTx.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">거래 내역 관리</p>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {userTx.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-2 text-sm py-1.5 px-2 rounded-md bg-muted/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant={tx.type === "in" ? "default" : "secondary"} className={`shrink-0 text-[11px] ${tx.type === "in" ? "bg-red-500 border-red-500" : "bg-blue-500 border-blue-500 text-white"}`}>
                        {tx.type === "in" ? "입고" : "출고"}
                      </Badge>
                      <span className="truncate flex items-center gap-1.5"><StockIcon name={tx.stockName} size={18} />{tx.stockName} {tx.quantity.toLocaleString()}주</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-muted-foreground text-xs mr-1">{new Date(tx.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                      <TransactionEditDialog tx={tx} onSuccess={onTransactionChange} />
                      <TransactionDeleteButton tx={tx} onSuccess={onTransactionChange} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberEditDialog({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(user.fullName);
  const [birthDate, setBirthDate] = useState(user.birthDate || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [bank, setBank] = useState(user.bank);
  const [accountNumber, setAccountNumber] = useState(user.accountNumber);
  const [accountHolder, setAccountHolder] = useState(user.accountHolder);
  const [newPassword, setNewPassword] = useState("");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = { fullName, birthDate, phone, email, bank, accountNumber, accountHolder };
      if (newPassword) body.password = newPassword;
      await apiRequest("PUT", `/api/admin/users/${user.id}`, body);
    },
    onSuccess: () => {
      toast({ title: "수정 완료", description: `${fullName}님의 정보가 수정되었습니다` });
      setOpen(false);
      setNewPassword("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (v) {
        setFullName(user.fullName);
        setBirthDate(user.birthDate || "");
        setPhone(user.phone || "");
        setEmail(user.email || "");
        setBank(user.bank);
        setAccountNumber(user.accountNumber);
        setAccountHolder(user.accountHolder);
        setNewPassword("");
      }
    }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-edit-${user.id}`} title="정보 변경">
          <Pencil className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>회원 정보 변경</DialogTitle>
          <DialogDescription>{user.username} 회원의 정보를 수정합니다</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>이름</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} data-testid="input-edit-fullname" />
          </div>
          <div className="space-y-2">
            <Label>생년월일</Label>
            <Input value={birthDate} onChange={(e) => setBirthDate(e.target.value)} placeholder="예: 19900101" data-testid="input-edit-birthdate" />
          </div>
          <div className="space-y-2">
            <Label>휴대폰번호</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="예: 01012345678" data-testid="input-edit-phone" />
          </div>
          <div className="space-y-2">
            <Label>이메일</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일" data-testid="input-edit-email" />
          </div>
          <div className="space-y-2">
            <Label>예금주명</Label>
            <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} data-testid="input-edit-holder" />
          </div>
          <div className="space-y-2">
            <Label>증권사</Label>
            <Select value={bank} onValueChange={setBank}>
              <SelectTrigger data-testid="select-edit-bank">
                <SelectValue />
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
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} data-testid="input-edit-account" />
          </div>
          <div className="space-y-2">
            <Label>현재 비밀번호</Label>
            <Input value={user.plainPassword || "(암호화됨)"} readOnly className="bg-gray-50 text-gray-600" data-testid="text-current-password" />
          </div>
          <div className="space-y-2">
            <Label>새 비밀번호 (변경 시에만 입력)</Label>
            <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="비밀번호 변경 시 입력" data-testid="input-edit-password" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !fullName || !accountNumber || !accountHolder} data-testid="button-save-user">
              {mutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MemberFreezeDialog({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const isFrozen = user.isFrozen;

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/users/${user.id}/freeze`, { isFrozen: !isFrozen });
    },
    onSuccess: () => {
      toast({
        title: isFrozen ? "동결 해제" : "계정 동결",
        description: `${user.fullName}님의 계정이 ${isFrozen ? "동결 해제" : "동결"}되었습니다`,
      });
      setOpen(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-freeze-${user.id}`} title={isFrozen ? "동결 해제" : "계정 동결"}>
          <Snowflake className={`w-4 h-4 ${isFrozen ? "text-blue-500" : ""}`} />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isFrozen ? "계정 동결 해제" : "계정 동결"}</DialogTitle>
          <DialogDescription>
            {isFrozen
              ? `${user.fullName}님의 계정 동결을 해제하시겠습니까? 해제 후 로그인이 가능합니다.`
              : `${user.fullName}님의 계정을 동결하시겠습니까? 동결 시 로그인이 차단됩니다.`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 p-4 rounded-md bg-muted/50 mt-2">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-primary">{user.fullName.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium text-sm">{user.fullName} (@{user.username})</p>
            <p className="text-xs text-muted-foreground">{user.bank} · {user.accountNumber}</p>
          </div>
          {isFrozen && <Badge variant="destructive" className="ml-auto">동결 중</Badge>}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button
            variant={isFrozen ? "default" : "destructive"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            data-testid="button-confirm-freeze"
          >
            {mutation.isPending ? "처리 중..." : isFrozen ? "동결 해제" : "계정 동결"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberDeleteDialog({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [composing, setComposing] = useState(false);
  const { toast } = useToast();

  const normalize = (s: string) => s.normalize("NFC").toLowerCase().replace(/\s/g, '');
  const isMatch = normalize(confirmText) === normalize(user.username);

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/admin/users/${user.id}`);
    },
    onSuccess: () => {
      toast({ title: "삭제 완료", description: `${user.fullName}님의 계정이 삭제되었습니다` });
      setOpen(false);
      setConfirmText("");
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setConfirmText(""); }}>
      <DialogTrigger asChild>
        <Button size="icon" variant="ghost" data-testid={`button-delete-user-${user.id}`} title="회원 삭제">
          <UserX className="w-4 h-4 text-destructive" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            회원 삭제
          </DialogTitle>
          <DialogDescription>
            이 작업은 되돌릴 수 없습니다. 회원의 모든 거래 내역도 함께 삭제됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 p-4 rounded-md bg-destructive/10 mt-2">
          <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-destructive">{user.fullName.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium text-sm">{user.fullName} (@{user.username})</p>
            <p className="text-xs text-muted-foreground">{user.bank} · {user.accountNumber}</p>
          </div>
        </div>
        <div className="space-y-2 mt-2">
          <Label>확인을 위해 회원 아이디를 입력해주세요</Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            onCompositionStart={() => setComposing(true)}
            onCompositionEnd={(e) => { setComposing(false); setConfirmText((e.target as HTMLInputElement).value); }}
            placeholder={user.username}
            data-testid="input-confirm-delete"
          />
        </div>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isMatch}
            data-testid="button-confirm-delete"
          >
            {mutation.isPending ? "삭제 중..." : "회원 삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UnionCodeDialog({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(user.unionCode || "");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/users/${user.id}/union-code`, { unionCode: code });
    },
    onSuccess: () => {
      toast({ title: "조합코드 변경", description: `${user.fullName}님의 조합코드가 변경되었습니다. 새로고침합니다...` });
      setOpen(false);
      setTimeout(() => window.location.reload(), 800);
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setCode(user.unionCode || ""); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-purple-200 text-purple-700 bg-purple-50" data-testid={`button-union-code-${user.id}`} title="조합코드 변경">
          조합: {user.unionCode || <span className="text-gray-400">없음</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>조합코드 변경</DialogTitle>
          <DialogDescription>
            {user.fullName}(@{user.username})님의 조합코드를 입력하세요. 비워두면 코드 없음으로 처리됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <Label>조합코드</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="조합코드 (없으면 비워두세요)"
            data-testid="input-union-code-dialog"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-confirm-union-code">
            {mutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManagerCodeDialog({ user, onSuccess }: { user: User; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(user.managerCode || "");
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/admin/users/${user.id}/manager-code`, { managerCode: code });
    },
    onSuccess: () => {
      toast({ title: "담당자 코드 변경", description: `${user.fullName}님의 담당자 코드가 변경되었습니다` });
      setOpen(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setCode(user.managerCode || ""); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 text-xs px-2 border-gray-200 text-gray-600" data-testid={`button-manager-code-${user.id}`} title="담당자 코드 설정">
          담당자: {user.managerCode || <span className="text-gray-400">없음</span>}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>담당자 코드 설정</DialogTitle>
          <DialogDescription>
            {user.fullName}(@{user.username})님의 담당자 코드를 입력하세요. 비워두면 담당자 없음으로 처리됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 mt-2">
          <Label>담당자 코드</Label>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="담당자 코드 (없으면 비워두세요)"
            data-testid="input-manager-code-dialog"
          />
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>취소</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            data-testid="button-confirm-manager-code"
          >
            {mutation.isPending ? "저장 중..." : "저장"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StocksManagementSection({
  ipoStocks,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  isCreating,
  isUpdating,
}: {
  ipoStocks: IpoStock[];
  isLoading: boolean;
  onCreate: (data: any) => void;
  onUpdate: (data: any) => void;
  onDelete: (id: string) => void;
  isCreating: boolean;
  isUpdating: boolean;
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editStock, setEditStock] = useState<IpoStock | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stockSearch, setStockSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const [formData, setFormData] = useState({
    stockName: "",
    startDate: "",
    endDate: "",
    brokers: "",
    priceMin: "",
    priceMax: "",
    competitionRate: "",
    status: "active",
    subscriptionStatus: "청약예정",
  });

  const resetForm = () => {
    setFormData({ stockName: "", startDate: "", endDate: "", brokers: "", priceMin: "", priceMax: "", competitionRate: "", status: "active", subscriptionStatus: "청약예정" });
    setStockSearch("");
  };

  const filteredStockSuggestions = stockSearch.length >= 1
    ? KOREAN_STOCK_LIST.filter(s => s.includes(stockSearch)).slice(0, 8)
    : [];

  const handleAdd = () => {
    if (!formData.stockName || !formData.startDate || !formData.endDate || !formData.brokers || !formData.priceMin || !formData.priceMax) return;
    onCreate(formData);
    setAddOpen(false);
    resetForm();
  };

  const handleEdit = () => {
    if (!editStock) return;
    onUpdate({ id: editStock.id, ...formData });
    setEditOpen(false);
    setEditStock(null);
    resetForm();
  };

  const openEdit = (stock: IpoStock) => {
    setEditStock(stock);
    setFormData({
      stockName: stock.stockName,
      startDate: stock.startDate,
      endDate: stock.endDate,
      brokers: stock.brokers,
      priceMin: String(stock.priceMin),
      priceMax: String(stock.priceMax),
      competitionRate: stock.competitionRate || "",
      status: stock.status,
      subscriptionStatus: stock.subscriptionStatus,
    });
    setEditOpen(true);
  };

  const filteredStocks = ipoStocks.filter((s) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (searchTerm && !s.stockName.includes(searchTerm)) return false;
    return true;
  });

  const stockFormFields = (
    <div className="space-y-4 mt-2">
      <div className="space-y-2">
        <Label>종목명</Label>
        <div className="relative">
          <Input
            value={formData.stockName}
            onChange={(e) => { setFormData({ ...formData, stockName: e.target.value }); setStockSearch(e.target.value); }}
            placeholder="종목명 검색 (예: 삼성전자)"
            data-testid="input-stock-name"
          />
          {filteredStockSuggestions.length > 0 && stockSearch && formData.stockName === stockSearch && (
            <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {filteredStockSuggestions.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover-elevate flex items-center gap-2"
                  onClick={() => { setFormData({ ...formData, stockName: name }); setStockSearch(""); }}
                  data-testid={`suggest-stock-${name}`}
                >
                  <StockIcon name={name} size={20} />
                  <span>{name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>시작일</Label>
          <Input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} data-testid="input-stock-start" />
        </div>
        <div className="space-y-2">
          <Label>종료일</Label>
          <Input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} data-testid="input-stock-end" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>증권사</Label>
        <Input value={formData.brokers} onChange={(e) => setFormData({ ...formData, brokers: e.target.value })} placeholder="예: NH, 삼성, 한국" data-testid="input-stock-brokers" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>최소 공모가</Label>
          <Input type="number" value={formData.priceMin} onChange={(e) => setFormData({ ...formData, priceMin: e.target.value })} placeholder="7000" data-testid="input-stock-price-min" />
        </div>
        <div className="space-y-2">
          <Label>최대 공모가</Label>
          <Input type="number" value={formData.priceMax} onChange={(e) => setFormData({ ...formData, priceMax: e.target.value })} placeholder="8500" data-testid="input-stock-price-max" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>기관경쟁률</Label>
        <Input value={formData.competitionRate} onChange={(e) => setFormData({ ...formData, competitionRate: e.target.value })} placeholder="198.53:1 (없으면 비워두기)" data-testid="input-stock-competition" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>청약 상태</Label>
          <Select value={formData.subscriptionStatus} onValueChange={(v) => setFormData({ ...formData, subscriptionStatus: v })}>
            <SelectTrigger data-testid="select-subscription-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="청약진행중">청약진행중</SelectItem>
              <SelectItem value="청약예정">청약예정</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>활성 상태</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
            <SelectTrigger data-testid="select-stock-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">활성</SelectItem>
              <SelectItem value="inactive">비활성</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="종목 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-stocks"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px]" data-testid="select-filter-stock-status">
              <SelectValue placeholder="상태" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="active">활성</SelectItem>
              <SelectItem value="inactive">비활성</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="outline" className="shrink-0">{filteredStocks.length}건</Badge>
        </div>
        <Dialog open={addOpen} onOpenChange={(v) => { setAddOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#03C75A] border-[#03C75A]" data-testid="button-add-stock">
              <Plus className="w-4 h-4 mr-1" />종목 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>종목 추가</DialogTitle>
              <DialogDescription>새로운 청약 종목을 등록합니다</DialogDescription>
            </DialogHeader>
            {stockFormFields}
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setAddOpen(false); resetForm(); }}>취소</Button>
              <Button className="bg-[#03C75A] border-[#03C75A]" onClick={handleAdd} disabled={isCreating} data-testid="button-confirm-add-stock">
                {isCreating ? "추가 중..." : "추가"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full bg-gray-200" />)}
        </div>
      ) : filteredStocks.length === 0 ? (
        <Card className="p-12 text-center">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30 text-gray-400" />
          <p className="font-medium text-gray-500">
            {searchTerm ? "검색 결과가 없습니다" : "등록된 종목이 없습니다"}
          </p>
        </Card>
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {filteredStocks.map((stock) => (
              <Card key={stock.id} className="p-4 space-y-3" data-testid={`card-stock-${stock.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <StockIcon name={stock.stockName} size={28} />
                    <div>
                      <p className="text-sm font-bold text-gray-900">{stock.stockName}</p>
                      <p className="text-xs text-gray-500">{stock.brokers}</p>
                    </div>
                  </div>
                  <Badge variant={stock.status === "active" ? "default" : "secondary"} className={stock.status === "active" ? "bg-green-600 border-green-600" : ""}>
                    {stock.status === "active" ? "활성" : "비활성"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <span>시작: {stock.startDate}</span>
                  <span>종료: {stock.endDate}</span>
                  <span>공모가: {stock.priceMin.toLocaleString()} ~ {stock.priceMax.toLocaleString()}원</span>
                  <span>경쟁률: {stock.competitionRate || "-"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={stock.subscriptionStatus === "청약진행중" ? "text-[#03C75A] border-[#03C75A]" : ""}>{stock.subscriptionStatus}</Badge>
                </div>
                <div className="flex items-center gap-1 pt-2 border-t border-gray-200">
                  <Button size="sm" variant="default" className="bg-blue-500 border-blue-500 text-xs" onClick={() => openEdit(stock)} data-testid={`button-edit-stock-${stock.id}`}>
                    <Pencil className="w-3 h-3 mr-1" />수정
                  </Button>
                  <Button size="sm" variant="destructive" className="text-xs" onClick={() => onDelete(stock.id)} data-testid={`button-delete-stock-${stock.id}`}>
                    <Trash2 className="w-3 h-3 mr-1" />삭제
                  </Button>
                  <Button
                    size="sm"
                    variant={stock.status === "active" ? "secondary" : "default"}
                    className={`text-xs ml-auto ${stock.status !== "active" ? "bg-green-600 border-green-600" : ""}`}
                    onClick={() => onUpdate({ id: stock.id, status: stock.status === "active" ? "inactive" : "active" })}
                    data-testid={`button-toggle-stock-${stock.id}`}
                  >
                    {stock.status === "active" ? "비활성화" : "활성화"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          <Card className="hidden md:block p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-gray-500">종목명</TableHead>
                    <TableHead className="text-gray-500">시작일</TableHead>
                    <TableHead className="text-gray-500">종료일</TableHead>
                    <TableHead className="text-gray-500">증권사</TableHead>
                    <TableHead className="text-right text-gray-500">공모가</TableHead>
                    <TableHead className="text-gray-500">경쟁률</TableHead>
                    <TableHead className="text-gray-500">청약상태</TableHead>
                    <TableHead className="text-gray-500">상태</TableHead>
                    <TableHead className="text-center text-gray-500">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredStocks.map((stock) => (
                    <TableRow key={stock.id} data-testid={`row-stock-${stock.id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <StockIcon name={stock.stockName} size={24} />
                          <span className="font-medium text-gray-900">{stock.stockName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-700">{stock.startDate}</TableCell>
                      <TableCell className="text-gray-700">{stock.endDate}</TableCell>
                      <TableCell className="text-gray-700">{stock.brokers}</TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-gray-700">
                        {stock.priceMin.toLocaleString()} ~ {stock.priceMax.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-gray-700">{stock.competitionRate || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={stock.subscriptionStatus === "청약진행중" ? "text-[#03C75A] border-[#03C75A]" : ""}>
                          {stock.subscriptionStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stock.status === "active" ? "default" : "secondary"} className={stock.status === "active" ? "bg-green-600 border-green-600" : ""}>
                          {stock.status === "active" ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="default" className="bg-blue-500 border-blue-500 text-xs" onClick={() => openEdit(stock)} data-testid={`button-edit-stock-${stock.id}`}>
                            <Pencil className="w-3 h-3 mr-1" />수정
                          </Button>
                          <Button size="sm" variant="destructive" className="text-xs" onClick={() => onDelete(stock.id)} data-testid={`button-delete-stock-${stock.id}`}>
                            <Trash2 className="w-3 h-3 mr-1" />삭제
                          </Button>
                          <Button
                            size="sm"
                            variant={stock.status === "active" ? "secondary" : "default"}
                            className={`text-xs ${stock.status !== "active" ? "bg-green-600 border-green-600" : ""}`}
                            onClick={() => onUpdate({ id: stock.id, status: stock.status === "active" ? "inactive" : "active" })}
                            data-testid={`button-toggle-stock-${stock.id}`}
                          >
                            {stock.status === "active" ? "비활성화" : "활성화"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) { setEditStock(null); resetForm(); } }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>종목 수정</DialogTitle>
            <DialogDescription>{editStock?.stockName} 정보를 수정합니다</DialogDescription>
          </DialogHeader>
          {stockFormFields}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setEditOpen(false); setEditStock(null); resetForm(); }}>취소</Button>
            <Button className="bg-[#03C75A] border-[#03C75A]" onClick={handleEdit} disabled={isUpdating} data-testid="button-confirm-edit-stock">
              {isUpdating ? "수정 중..." : "수정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function StockCodeManagementSection() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockCatalog | null>(null);
  const [form, setForm] = useState({
    stockName: "", stockCode: "", purchasePrice: "", ipoPrice: "",
    category: "일반", isActive: true,
  });

  const { data: stocks = [], isLoading } = useQuery<StockCatalog[]>({
    queryKey: ["/api/admin/stock-catalog"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });
  const filtered = stocks.filter((stock) => {
    const term = search.trim().toLowerCase();
    return !term || stock.stockName.toLowerCase().includes(term) || stock.stockCode.toLowerCase().includes(term);
  });
  const reset = () => {
    setForm({ stockName: "", stockCode: "", purchasePrice: "", ipoPrice: "", category: "일반", isActive: true });
  };
  const openAdd = () => {
    setEditing(null); reset(); setDialogOpen(true);
  };
  const openEdit = (stock: StockCatalog) => {
    setEditing(stock);
    setForm({
      stockName: stock.stockName,
      stockCode: stock.stockCode,
      purchasePrice: String(stock.purchasePrice),
      ipoPrice: String(stock.ipoPrice),
      category: stock.category,
      isActive: stock.isActive,
    });
    setDialogOpen(true);
  };
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/stock-catalog"] });
    queryClient.invalidateQueries({ queryKey: ["/api/available-stocks"] });
  };
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.stockName.trim()) throw new Error("종목명을 입력해주세요.");
      const purchasePrice = Number(form.purchasePrice);
      const ipoPrice = Number(form.ipoPrice);
      if (!Number.isInteger(purchasePrice) || purchasePrice < 0 || !Number.isInteger(ipoPrice) || ipoPrice < 0) {
        throw new Error("매입가와 공모가는 0 이상의 정수로 입력해주세요.");
      }
      const data = {
        stockName: form.stockName.trim(),
        stockCode: form.stockCode.trim(),
        purchasePrice,
        ipoPrice,
        category: form.category,
        isActive: form.isActive,
      };
      if (editing) await apiRequest("PATCH", `/api/admin/stock-catalog/${editing.id}`, data);
      else await apiRequest("POST", "/api/admin/stock-catalog", data);
    },
    onSuccess: () => {
      invalidate(); setDialogOpen(false);
      toast({ title: editing ? "종목코드 수정 완료" : "종목코드 추가 완료" });
    },
    onError: (error: Error) => toast({ title: "오류", description: error.message, variant: "destructive" }),
  });
  const toggleMutation = useMutation({
    mutationFn: async (stock: StockCatalog) => {
      await apiRequest("PATCH", `/api/admin/stock-catalog/${stock.id}`, { isActive: !stock.isActive });
    },
    onSuccess: invalidate,
    onError: (error: Error) => toast({ title: "오류", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/admin/stock-catalog/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "종목코드 삭제 완료" }); },
    onError: (error: Error) => toast({ title: "오류", description: error.message, variant: "destructive" }),
  });

  const actionButtons = (stock: StockCatalog) => (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" className="text-xs" onClick={() => openEdit(stock)} data-testid={`button-edit-stock-code-${stock.id}`}>
        <Pencil className="w-3 h-3 mr-1" />수정
      </Button>
      <Button size="sm" variant="outline" className={`text-xs ${stock.isActive ? "text-orange-600" : "text-green-600"}`} onClick={() => toggleMutation.mutate(stock)} disabled={toggleMutation.isPending} data-testid={`button-toggle-stock-code-${stock.id}`}>
        {stock.isActive ? "비활성화" : "활성화"}
      </Button>
      <Button size="sm" variant="ghost" className="text-xs text-red-600" onClick={() => { if (window.confirm("이 종목코드를 삭제하시겠습니까?")) deleteMutation.mutate(stock.id); }} disabled={deleteMutation.isPending} data-testid={`button-delete-stock-code-${stock.id}`}>
        <Trash2 className="w-3 h-3 mr-1" />삭제
      </Button>
    </div>
  );

  return (
    <div className="space-y-4" data-testid="section-stock-code-management">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">종목코드 관리</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">회원 화면의 입고 가능 종목과 종목별 가격을 관리합니다.</p>
        </div>
        <Button className="bg-[#03C75A] border-[#03C75A]" onClick={openAdd} data-testid="button-add-stock-code"><Plus className="w-4 h-4 mr-1" />종목 추가</Button>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pl-9" placeholder="종목명 또는 종목코드 검색" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-stock-codes" />
        </div>
        <Badge variant="outline">{filtered.length}건</Badge>
      </div>
      {isLoading ? <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div> :
        filtered.length === 0 ? <Card className="p-12 text-center text-sm text-gray-500">등록된 종목코드가 없습니다.</Card> : (
          <>
            <div className="md:hidden space-y-3">
              {filtered.map((stock) => (
                <Card key={stock.id} className={`p-4 space-y-3 ${!stock.isActive ? "opacity-60" : ""}`} data-testid={`card-stock-code-${stock.id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-bold text-gray-900">{stock.stockName}</p><p className="text-xs text-gray-500 font-mono">{stock.stockCode || "코드 없음"}</p></div>
                    <Badge variant={stock.isActive ? "default" : "secondary"} className={stock.isActive ? "bg-green-600 border-green-600" : ""}>{stock.isActive ? "활성" : "비활성"}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <span>매입가: {stock.purchasePrice.toLocaleString()}원</span><span>공모가: {stock.ipoPrice.toLocaleString()}원</span><span>분류: {stock.category}</span>
                  </div>
                  {actionButtons(stock)}
                </Card>
              ))}
            </div>
            <Card className="hidden md:block p-0 overflow-hidden">
              <div className="overflow-x-auto"><Table>
                <TableHeader><TableRow className="bg-gray-50">
                  <TableHead>종목명</TableHead><TableHead>종목코드</TableHead><TableHead>분류</TableHead>
                  <TableHead className="text-right">매입가</TableHead><TableHead className="text-right">공모가</TableHead>
                  <TableHead className="text-center">상태</TableHead><TableHead className="text-center">관리</TableHead>
                </TableRow></TableHeader>
                <TableBody>{filtered.map((stock) => <TableRow key={stock.id} className={!stock.isActive ? "opacity-60" : ""} data-testid={`row-stock-code-${stock.id}`}>
                  <TableCell className="font-medium">{stock.stockName}</TableCell><TableCell className="font-mono">{stock.stockCode || "-"}</TableCell><TableCell>{stock.category}</TableCell>
                  <TableCell className="text-right tabular-nums">{stock.purchasePrice.toLocaleString()}원</TableCell><TableCell className="text-right tabular-nums">{stock.ipoPrice.toLocaleString()}원</TableCell>
                  <TableCell className="text-center"><Badge variant={stock.isActive ? "default" : "secondary"} className={stock.isActive ? "bg-green-600 border-green-600" : ""}>{stock.isActive ? "활성" : "비활성"}</Badge></TableCell>
                  <TableCell><div className="flex justify-center">{actionButtons(stock)}</div></TableCell>
                </TableRow>)}</TableBody>
              </Table></div>
            </Card>
          </>
        )}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); reset(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "종목코드 수정" : "종목코드 추가"}</DialogTitle><DialogDescription>종목명, 코드와 가격 정보를 입력하세요.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>종목명</Label><Input value={form.stockName} onChange={(e) => setForm({ ...form, stockName: e.target.value })} placeholder="예: 마키나락스" data-testid="input-stock-code-name" /></div>
            <div className="space-y-1"><Label>종목코드</Label><Input value={form.stockCode} onChange={(e) => setForm({ ...form, stockCode: e.target.value })} placeholder="예: 005930" data-testid="input-stock-code-code" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>매입 가격</Label><Input type="number" min="0" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} data-testid="input-stock-code-purchase-price" /></div>
              <div className="space-y-1"><Label>IPO 가격</Label><Input type="number" min="0" value={form.ipoPrice} onChange={(e) => setForm({ ...form, ipoPrice: e.target.value })} data-testid="input-stock-code-ipo-price" /></div>
            </div>
            <div className="space-y-1"><Label>카테고리</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger data-testid="select-stock-code-category"><SelectValue /></SelectTrigger><SelectContent>{STOCK_CATEGORIES.map((cat) => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center justify-between rounded-md border p-3"><Label>활성 상태</Label><Button type="button" size="sm" variant={form.isActive ? "default" : "outline"} onClick={() => setForm({ ...form, isActive: !form.isActive })}>{form.isActive ? "활성" : "비활성"}</Button></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button><Button className="bg-[#03C75A] border-[#03C75A]" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>{saveMutation.isPending ? "저장 중..." : "저장"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type PopularIpoStock = {
  id: string;
  stockName: string;
  stockCode?: string | null;
  logoUrl?: string | null;
  purchasePrice: number;
  displayPrice: number;
  sortOrder: number;
  isActive: boolean;
};

function PopularIpoManagementSection() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<PopularIpoStock | null>(null);
  const [form, setForm] = useState({
    stockName: "",
    stockCode: "",
    logoUrl: "",
    purchasePrice: "",
    displayPrice: "",
    isActive: true,
  });

  const { data: stocks = [], isLoading } = useQuery<PopularIpoStock[]>({
    queryKey: ["/api/admin/popular-ipo-stocks"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchOnWindowFocus: true,
  });
  const orderedStocks = [...stocks].sort((a, b) => a.sortOrder - b.sortOrder);
  const activeCount = stocks.filter((stock) => stock.isActive).length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/popular-ipo-stocks"] });
    queryClient.invalidateQueries({ queryKey: ["/api/market/ipo-calendar"] });
  };
  const showError = (error: Error) => toast({ title: "오류", description: error.message, variant: "destructive" });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const stockName = form.stockName.trim();
      const purchasePrice = Number(form.purchasePrice);
      const displayPrice = Number(form.displayPrice.replace(/,/g, ""));
      const isPositiveInteger = (value: string) => /^\d+$/.test(value) && Number(value) > 0;
      if (!stockName || !isPositiveInteger(form.purchasePrice) || !isPositiveInteger(form.displayPrice)) {
        throw new Error("종목명과 0보다 큰 정수인 조합 매수가·현재 표시 가격을 입력하세요.");
      }
      if (form.isActive && (!editingStock || !editingStock.isActive) && activeCount >= 5) {
        throw new Error("활성 종목은 최대 5개까지 등록할 수 있습니다. 먼저 다른 종목을 제외해 주세요.");
      }
      const payload = {
        stockName,
        stockCode: form.stockCode.trim() || null,
        logoUrl: form.logoUrl.trim() || null,
        purchasePrice,
        displayPrice,
        isActive: form.isActive,
        ...(editingStock ? {} : { sortOrder: orderedStocks.length }),
      };
      if (editingStock) {
        await apiRequest("PATCH", `/api/admin/popular-ipo-stocks/${editingStock.id}`, payload);
      } else {
        await apiRequest("POST", "/api/admin/popular-ipo-stocks", payload);
      }
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditingStock(null);
      toast({ title: editingStock ? "인기 종목 수정 완료" : "인기 종목 추가 완료" });
    },
    onError: showError,
  });

  const toggleMutation = useMutation({
    mutationFn: async (stock: PopularIpoStock) => {
      if (!stock.isActive && activeCount >= 5) {
        throw new Error("활성 종목은 최대 5개까지 노출할 수 있습니다.");
      }
      await apiRequest("PATCH", `/api/admin/popular-ipo-stocks/${stock.id}`, { isActive: !stock.isActive });
    },
    onSuccess: invalidate,
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/popular-ipo-stocks/${id}`);
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "인기 종목 삭제 완료" });
    },
    onError: showError,
  });

  const reorderMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await apiRequest("PATCH", "/api/admin/popular-ipo-stocks/reorder", { ids });
    },
    onSuccess: invalidate,
    onError: showError,
  });

  const openAdd = () => {
    setEditingStock(null);
    setForm({ stockName: "", stockCode: "", logoUrl: "", purchasePrice: "", displayPrice: "", isActive: activeCount < 5 });
    setDialogOpen(true);
  };
  const openEdit = (stock: PopularIpoStock) => {
    setEditingStock(stock);
    setForm({
      stockName: stock.stockName,
      stockCode: stock.stockCode || "",
      logoUrl: stock.logoUrl || "",
      purchasePrice: String(stock.purchasePrice),
      displayPrice: String(stock.displayPrice),
      isActive: stock.isActive,
    });
    setDialogOpen(true);
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= orderedStocks.length || reorderMutation.isPending) return;
    const ids = orderedStocks.map((stock) => stock.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderMutation.mutate(ids);
  };

  return (
    <Card className="mt-6 p-4 sm:p-5" data-testid="section-popular-ipo-management">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900">실시간 인기 종목 TOP 5 관리</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">사용자 공모주 캘린더에 노출할 종목을 관리합니다. 활성 {activeCount}/5개</p>
        </div>
        <Button size="sm" className="bg-[#03C75A] border-[#03C75A] shrink-0" onClick={openAdd} data-testid="button-add-popular-ipo">
          <Plus className="w-4 h-4 mr-1" />종목 추가
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full bg-gray-200" />)}</div>
      ) : orderedStocks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">등록된 인기 종목이 없습니다.</div>
      ) : (
        <div className="space-y-2">
          {orderedStocks.map((stock, index) => (
            <div key={stock.id} className={`flex items-center gap-2 sm:gap-3 rounded-lg border p-3 ${stock.isActive ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-70"}`} data-testid={`popular-ipo-row-${stock.id}`}>
              <div className="flex flex-col gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === 0 || reorderMutation.isPending} onClick={() => move(index, -1)} title="위로" data-testid={`button-popular-up-${stock.id}`}><ChevronUp className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" disabled={index === orderedStocks.length - 1 || reorderMutation.isPending} onClick={() => move(index, 1)} title="아래로" data-testid={`button-popular-down-${stock.id}`}><ChevronDown className="w-4 h-4" /></Button>
              </div>
              <span className="w-5 text-center text-sm font-bold text-gray-500 shrink-0">{index + 1}</span>
              <StockIcon name={stock.stockName} logoUrl={stock.logoUrl || undefined} size={32} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-gray-900 truncate">{stock.stockName}</p>
                  {stock.stockCode && <span className="text-xs text-gray-400 shrink-0">{stock.stockCode}</span>}
                  <Badge variant={stock.isActive ? "default" : "secondary"} className={stock.isActive ? "bg-green-600 border-green-600" : ""}>{stock.isActive ? "노출 중" : "제외됨"}</Badge>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-600 tabular-nums">
                  <span>조합 매수가 {stock.purchasePrice.toLocaleString("ko-KR")}원</span>
                  <button
                    type="button"
                    onClick={() => openEdit(stock)}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold text-gray-800 underline decoration-dotted underline-offset-2 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#03C75A] focus-visible:ring-offset-1"
                    aria-label={`${stock.stockName} 현재 표시 가격 ${stock.displayPrice.toLocaleString("ko-KR")}원 수정`}
                    title="현재 표시 가격 수정"
                    data-testid={`button-edit-popular-price-${stock.id}`}
                  >
                    현재 {stock.displayPrice.toLocaleString("ko-KR")}원 <Pencil className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <span className={stock.displayPrice >= stock.purchasePrice ? "text-red-500 font-semibold" : "text-blue-500 font-semibold"}>
                    수익률 {stock.purchasePrice > 0 ? `${stock.displayPrice >= stock.purchasePrice ? "+" : ""}${(((stock.displayPrice - stock.purchasePrice) / stock.purchasePrice) * 100).toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : "-"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" className="text-xs" onClick={() => openEdit(stock)} data-testid={`button-edit-popular-${stock.id}`}><Pencil className="w-3 h-3 mr-1" />수정</Button>
                <Button size="sm" variant={stock.isActive ? "secondary" : "default"} className={`text-xs ${!stock.isActive ? "bg-green-600 border-green-600" : ""}`} onClick={() => toggleMutation.mutate(stock)} disabled={toggleMutation.isPending} data-testid={`button-toggle-popular-${stock.id}`}>{stock.isActive ? "제외" : "재노출"}</Button>
                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => { if (confirm("이 인기 종목을 삭제하시겠습니까?")) deleteMutation.mutate(stock.id); }} disabled={deleteMutation.isPending} title="삭제" data-testid={`button-delete-popular-${stock.id}`}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingStock(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingStock ? "인기 종목 수정" : "인기 종목 추가"}</DialogTitle>
            <DialogDescription>사용자 TOP 5에 표시할 정보를 입력하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>종목명</Label><Input value={form.stockName} onChange={(e) => setForm({ ...form, stockName: e.target.value })} placeholder="예: 마키나락스" data-testid="input-popular-stock-name" /></div>
              <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>종목코드 (선택)</Label><Input value={form.stockCode} onChange={(e) => setForm({ ...form, stockCode: e.target.value })} placeholder="예: 123456" data-testid="input-popular-stock-code" /></div>
                <div className="space-y-1"><Label>조합 매수가 (원)</Label><Input type="number" min="1" step="1" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} placeholder="10000" data-testid="input-popular-stock-purchase-price" /></div>
              </div>
              <div className="space-y-1"><Label>현재 표시 가격 (원)</Label><Input type="number" min="1" step="1" value={form.displayPrice} onChange={(e) => setForm({ ...form, displayPrice: e.target.value })} placeholder="12000" data-testid="input-popular-stock-price" /></div>
            <div className="space-y-1"><Label>로고 URL (선택)</Label><Input type="url" value={form.logoUrl} onChange={(e) => setForm({ ...form, logoUrl: e.target.value })} placeholder="https://..." data-testid="input-popular-stock-logo" /></div>
            <div>
              <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> 사용자에게 노출</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !form.stockName.trim() || !form.displayPrice} data-testid="button-save-popular-ipo">{saveMutation.isPending ? "저장 중..." : "저장"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function copyUserInfo(user: User, toast: any) {
  const createdAt = user.createdAt ? (() => {
    const d = new Date(user.createdAt);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  })() : "-";
  const info = [
    `[ 가입자 정보 조회 ]`,
    ``,
    `이름: ${user.fullName}`,
    `회원아이디: ${user.username}`,
    `비밀번호: ${user.plainPassword || "(암호화됨)"}`,
    `생년월일: ${user.birthDate || "-"}`,
    `휴대폰번호: ${user.phone || "-"}`,
    `예금주명: ${user.accountHolder}`,
    `은행: ${user.bank}`,
    `계좌번호: ${user.accountNumber}`,
    `가입일: ${createdAt}`,
  ].join("\n");
  navigator.clipboard.writeText(info).then(() => {
    toast({ title: "복사 완료", description: `${user.fullName} 회원 정보가 클립보드에 복사되었습니다.` });
  }).catch(() => {
    toast({ title: "복사 실패", description: "클립보드 접근이 거부되었습니다.", variant: "destructive" });
  });
}

function DatabaseResetCard() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/reset-database", {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "초기화 완료", description: "모든 데이터가 삭제되었습니다. 페이지를 새로고침합니다." });
      setTimeout(() => window.location.reload(), 1500);
    },
    onError: (e: any) => {
      toast({ title: "초기화 실패", description: e.message, variant: "destructive" });
    },
  });

  return (
    <>
      <Card className="p-5 border-2 border-red-200 bg-red-50">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-sm text-red-700">전체 데이터 초기화</h3>
            <p className="text-xs text-red-500 mt-0.5">모든 회원, 거래, 종목 데이터를 완전히 삭제합니다.</p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            data-testid="button-open-db-reset"
            onClick={() => { setConfirm(""); setOpen(true); }}
          >
            초기화
          </Button>
        </div>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-bold text-red-600 mb-1">⚠️ 전체 데이터 초기화</h2>
            <p className="text-sm text-gray-600 mb-4">
              모든 회원, 거래내역, 종목 등 <strong>전체 데이터가 영구 삭제</strong>됩니다.<br />
              계속하려면 아래에 <strong className="text-red-600">삭제확인</strong>을 입력하세요.
            </p>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="삭제확인"
              data-testid="input-db-reset-confirm"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                data-testid="button-cancel-db-reset"
              >
                취소
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={confirm !== "삭제확인" || resetMutation.isPending}
                onClick={() => resetMutation.mutate()}
                data-testid="button-confirm-db-reset"
              >
                {resetMutation.isPending ? "삭제 중..." : "전체 삭제"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function MaintenanceToggleCard() {
  const { toast } = useToast();
  const { data } = useQuery<{ maintenance: boolean }>({
    queryKey: ["/api/maintenance"],
  });

  const maintenanceMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const res = await apiRequest("POST", "/api/admin/maintenance", { enabled });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/maintenance"], data);
      toast({
        title: data.maintenance ? "점검 모드 활성화" : "점검 모드 해제",
        description: data.maintenance ? "일반 사용자에게 점검 중 화면이 표시됩니다." : "사이트가 정상적으로 운영됩니다.",
      });
    },
  });

  const isOn = data?.maintenance ?? false;

  return (
    <Card className={`p-5 border-2 ${isOn ? "border-orange-400 bg-orange-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-gray-900">점검 모드</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {isOn ? "현재 점검 중 화면이 표시되고 있습니다." : "사이트가 정상 운영 중입니다."}
          </p>
        </div>
        <button
          data-testid="button-toggle-maintenance"
          onClick={() => maintenanceMutation.mutate(!isOn)}
          disabled={maintenanceMutation.isPending}
          className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none ${isOn ? "bg-orange-500" : "bg-gray-300"}`}
        >
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isOn ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
    </Card>
  );
}

type AdminSection = "dashboard" | "members" | "transactions" | "transfers" | "member-transfers" | "withdraw-requests" | "stocks" | "stockcodes" | "chat" | "groups" | "logs" | "ipblock" | "unioncodes" | "domainlinks";

const sidebarItems: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
  { id: "members", label: "회원 관리", icon: Users },
  { id: "transactions", label: "거래 내역", icon: ClipboardList },
  { id: "transfers", label: "대체출고 관리", icon: ArrowRightLeft },
  { id: "member-transfers", label: "주식 이전 관리", icon: Send },
  { id: "withdraw-requests", label: "출금신청 관리", icon: Banknote },
  { id: "stocks", label: "종목 관리", icon: Package },
  { id: "stockcodes", label: "종목코드", icon: BookOpen },
  { id: "chat", label: "1:1 상담", icon: MessageSquare },
  { id: "groups", label: "도메인 그룹", icon: Globe },
  { id: "logs", label: "접속 로그", icon: Activity },
  { id: "ipblock", label: "IP 차단", icon: Ban },
  { id: "unioncodes", label: "조합코드 관리", icon: Shield },
  { id: "domainlinks", label: "도메인 안내", icon: ExternalLink },
];

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const getHashSection = (): AdminSection => {
    const hash = window.location.hash.replace("#", "");
    const valid: AdminSection[] = ["dashboard", "members", "transactions", "transfers", "member-transfers", "withdraw-requests", "stocks", "stockcodes", "chat", "groups", "logs", "ipblock", "unioncodes", "domainlinks"];
    return valid.includes(hash as AdminSection) ? (hash as AdminSection) : "dashboard";
  };

  const [activeSection, setActiveSectionState] = useState<AdminSection>(getHashSection());
  const activeSectionRef = useRef<AdminSection>(activeSection);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("adminSoundEnabled") !== "false";
  });
  const [transferSoundEnabled, setTransferSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("adminTransferSoundEnabled") !== "false";
  });
  const [chatIndicatorEnabled, setChatIndicatorEnabled] = useState<boolean>(() => {
    return localStorage.getItem("adminChatIndicatorEnabled") !== "false";
  });
  const [chatSoundEnabled, setChatSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem("adminChatSoundEnabled") !== "false";
  });
  const [transferTab, setTransferTab] = useState<"all" | "pending" | "출고대기중" | "approved" | "rejected" | "held">("all");
  const [transferSearch, setTransferSearch] = useState("");
  const [filterTransferManager, setFilterTransferManager] = useState<string>("all");
  const [filterTransferUnionCode, setFilterTransferUnionCode] = useState<string>("all");
  const [selectedTransferIds, setSelectedTransferIds] = useState<Set<string>>(new Set());
  const [alertActive, setAlertActive] = useState(false);
  const prevPendingCount = useRef<number | null>(null);
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transferSoundEnabledRef = useRef(transferSoundEnabled);
  const chatSoundEnabledRef = useRef(chatSoundEnabled);
  const notifiedChatMessageIdsRef = useRef<Set<string>>(new Set());

  const setActiveSection = (section: AdminSection) => {
    activeSectionRef.current = section;
    setActiveSectionState(section);
    window.history.pushState(null, "", `#${section}`);
  };

  useEffect(() => {
    const handlePopState = () => {
      const section = getHashSection();
      activeSectionRef.current = section;
      setActiveSectionState(section);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!chatSoundEnabled) return;
    const unlock = () => {
      void unlockNotificationSound();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [chatSoundEnabled]);

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem("adminSoundEnabled", String(next));
      if (!next) {
        setAlertActive(false);
        if (soundIntervalRef.current) {
          clearInterval(soundIntervalRef.current);
          soundIntervalRef.current = null;
        }
      }
      return next;
    });
  };

  const toggleTransferSound = () => {
    setTransferSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem("adminTransferSoundEnabled", String(next));
      transferSoundEnabledRef.current = next;
      return next;
    });
  };

  const toggleChatIndicator = () => {
    setChatIndicatorEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("adminChatIndicatorEnabled", String(next));
      return next;
    });
  };

  const toggleChatSound = () => {
    setChatSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem("adminChatSoundEnabled", String(next));
      chatSoundEnabledRef.current = next;
      if (next) void unlockNotificationSound().then(() => playNotificationSound());
      return next;
    });
  };

  const dismissAlert = () => {
    setAlertActive(false);
    if (soundIntervalRef.current) {
      clearInterval(soundIntervalRef.current);
      soundIntervalRef.current = null;
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [filterManager, setFilterManager] = useState<string>("all");
  const [filterSiteGroup, setFilterSiteGroup] = useState<string>("all");
  const [filterUnionCode, setFilterUnionCode] = useState<string>("all");
  const [newGroupDomain, setNewGroupDomain] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupManagerCode, setNewGroupManagerCode] = useState("");
  const [bulkCode, setBulkCode] = useState("");
  const [bulkSelectedDomains, setBulkSelectedDomains] = useState<string[]>([]);
  const [logSearchFilter, setLogSearchFilter] = useState("");
  const [logPage, setLogPage] = useState(1);
  const LOG_PAGE_SIZE = 50;
  const [newBlockIp, setNewBlockIp] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");
  const [newDomainUrl, setNewDomainUrl] = useState("");
  const [newDomainLabel, setNewDomainLabel] = useState("");
  const [editingDomainLink, setEditingDomainLink] = useState<DomainFallbackUrl | null>(null);
  const [editDomainUrl, setEditDomainUrl] = useState("");
  const [editDomainLabel, setEditDomainLabel] = useState("");
  const [newUnionCode, setNewUnionCode] = useState("");
  const [newUnionLabel, setNewUnionLabel] = useState("");
  const [editingUnionCode, setEditingUnionCode] = useState<UnionCode | null>(null);
  const [editUnionCodeVal, setEditUnionCodeVal] = useState("");
  const [editUnionLabelVal, setEditUnionLabelVal] = useState("");
  const [txSearchTerm, setTxSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTxManager, setFilterTxManager] = useState<string>("all");
  const [filterTxUnionCode, setFilterTxUnionCode] = useState<string>("all");
  const [transactionSortField, setTransactionSortField] = useState<"createdAt" | "quantity" | "price" | "total">("createdAt");
  const [transactionSortDirection, setTransactionSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedChatRoom, setSelectedChatRoom] = useState<string | null>(null);
  const selectedChatRoomRef = useRef<string | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [macroDialogOpen, setMacroDialogOpen] = useState(false);
  const [macroTitle, setMacroTitle] = useState("");
  const [macroMessage, setMacroMessage] = useState("");
  const [macroEditId, setMacroEditId] = useState<string | null>(null);
  const [macroMenuOpen, setMacroMenuOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const chatWsRef = useRef<WebSocket | null>(null);
  const joinedChatRoomRef = useRef<string | null>(null);
  const [joinedChatRoomId, setJoinedChatRoomId] = useState<string | null>(null);
  const joinRequestRef = useRef(0);
  const chatSyncRoomRef = useRef<string | null>(null);
  const chatSyncingRef = useRef(false);
  const chatBufferedEventsRef = useRef<any[]>([]);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { data: authData, isLoading: authLoading } = useQuery<{ user: User } | null>({
    queryKey: ["/api/auth/admin-me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 60000,
    staleTime: 30000,
  });
  const { data: chatMacros = [] } = useQuery<any[]>({ queryKey: ["/api/admin/chat/macros"], queryFn: getQueryFn({ on401: "throw" }), enabled: !!authData?.user?.isAdmin });

  const { data: allUsers, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
  });

  const { data: domainGroupsList = [], refetch: refetchDomainGroups } = useQuery<DomainGroup[]>({
    queryKey: ["/api/admin/domain-groups"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
  });


  const { data: loginLogsList = [], refetch: refetchLoginLogs } = useQuery<LoginLog[]>({
    queryKey: ["/api/admin/login-logs"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
    refetchInterval: 30000,
  });

  const { data: blockedIpsList = [], refetch: refetchBlockedIps } = useQuery<BlockedIp[]>({
    queryKey: ["/api/admin/blocked-ips"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
  });

  const { data: unionCodesList = [] } = useQuery<UnionCode[]>({
    queryKey: ["/api/admin/union-codes"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
  });

  const { data: domainLinksList = [], refetch: refetchDomainLinks } = useQuery<DomainFallbackUrl[]>({
    queryKey: ["/api/admin/domain-fallbacks"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
  });

  const addDomainLinkMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/domain-fallbacks", { url: newDomainUrl.trim(), label: newDomainLabel.trim(), isActive: true }),
    onSuccess: () => {
      setNewDomainUrl("");
      setNewDomainLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/domain-fallbacks"] });
      toast({ title: "추가 완료", description: "도메인이 추가되었습니다" });
    },
    onError: (e: any) => {
      toast({ title: "오류", description: e.message || "추가 실패", variant: "destructive" });
    },
  });

  const updateDomainLinkMutation = useMutation({
    mutationFn: (vars: { id: string; url: string; label: string }) =>
      apiRequest("PATCH", `/api/admin/domain-fallbacks/${vars.id}`, { url: vars.url, label: vars.label }),
    onSuccess: () => {
      setEditingDomainLink(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/domain-fallbacks"] });
      toast({ title: "수정 완료" });
    },
    onError: (e: any) => {
      toast({ title: "오류", description: e.message || "수정 실패", variant: "destructive" });
    },
  });

  const toggleDomainLinkMutation = useMutation({
    mutationFn: (vars: { id: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/domain-fallbacks/${vars.id}`, { isActive: vars.isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/domain-fallbacks"] });
    },
  });

  const deleteDomainLinkMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/domain-fallbacks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/domain-fallbacks"] });
      toast({ title: "삭제 완료" });
    },
  });

  const addUnionCodeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/union-codes", { code: newUnionCode.trim(), label: newUnionLabel.trim() }),
    onSuccess: () => {
      setNewUnionCode("");
      setNewUnionLabel("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/union-codes"] });
      toast({ title: "추가 완료", description: "조합코드가 추가되었습니다" });
    },
    onError: (e: any) => {
      toast({ title: "오류", description: e.message || "이미 존재하는 코드입니다", variant: "destructive" });
    },
  });

  const updateUnionCodeMutation = useMutation({
    mutationFn: (vars: { id: string; code: string; label: string; isActive: boolean }) =>
      apiRequest("PATCH", `/api/admin/union-codes/${vars.id}`, { code: vars.code, label: vars.label, isActive: vars.isActive }),
    onSuccess: () => {
      setEditingUnionCode(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/union-codes"] });
      toast({ title: "수정 완료" });
    },
    onError: (e: any) => {
      toast({ title: "오류", description: e.message || "수정 실패", variant: "destructive" });
    },
  });

  const deleteUnionCodeMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/union-codes/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/union-codes"] });
      toast({ title: "삭제 완료", description: "조합코드가 삭제되었습니다" });
    },
  });

  const addBlockedIpMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/blocked-ips", { ip: newBlockIp.trim(), reason: newBlockReason.trim() || undefined }),
    onSuccess: () => {
      setNewBlockIp("");
      setNewBlockReason("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-ips"] });
      toast({ title: "차단 완료", description: `${newBlockIp} IP가 차단되었습니다` });
    },
    onError: (e: any) => {
      toast({ title: "오류", description: e.message || "이미 차단된 IP이거나 오류가 발생했습니다", variant: "destructive" });
    },
  });

  const removeBlockedIpMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/blocked-ips/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/blocked-ips"] });
      toast({ title: "차단 해제", description: "IP 차단이 해제되었습니다" });
    },
  });

  const { data: pendingUsers = [], refetch: refetchPending } = useQuery<User[]>({
    queryKey: ["/api/admin/users/pending"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (prevPendingCount.current === null) {
      prevPendingCount.current = pendingUsers.length;
      return;
    }
    if (pendingUsers.length > prevPendingCount.current && soundEnabled) {
      setAlertActive(true);
    }
    if (pendingUsers.length === 0) {
      setAlertActive(false);
    }
    prevPendingCount.current = pendingUsers.length;
  }, [pendingUsers.length]);

  useEffect(() => {
    if (alertActive && soundEnabled) {
      playNotificationSound();
      soundIntervalRef.current = setInterval(() => {
        playNotificationSound();
      }, 4000);
    } else {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    }
    return () => {
      if (soundIntervalRef.current) {
        clearInterval(soundIntervalRef.current);
        soundIntervalRef.current = null;
      }
    };
  }, [alertActive, soundEnabled]);

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/users/${id}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "승인 완료", description: "회원 가입이 승인되었습니다" });
    },
    onError: () => toast({ title: "오류", description: "승인에 실패했습니다", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/users/${id}/reject`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "거절 완료", description: "가입 신청이 거절되었습니다" });
    },
    onError: () => toast({ title: "오류", description: "거절에 실패했습니다", variant: "destructive" }),
  });

  const holdMemberMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("POST", `/api/admin/users/${id}/hold`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "보류 완료", description: "가입 신청이 보류되었습니다. 회원 목록에서 확인할 수 있습니다." });
    },
    onError: () => toast({ title: "오류", description: "보류 처리에 실패했습니다", variant: "destructive" }),
  });

  const { data: allTransactions, isLoading: txLoading } = useQuery<StockTransaction[]>({
    queryKey: ["/api/admin/transactions"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
    refetchOnWindowFocus: true,
    refetchInterval: 10000,
  });

  const { data: allTransferRequests, isLoading: transfersLoading } = useQuery<TransferRequest[]>({
    queryKey: ["/api/admin/transfer-requests"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: allMemberTransfers = [], isLoading: memberTransfersLoading } = useQuery<StockMemberTransfer[]>({
    queryKey: ["/api/admin/stock-member-transfers"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
    refetchInterval: 5000,
    staleTime: 0,
  });

  const { data: allWithdrawRequests = [], isLoading: withdrawRequestsLoading } = useQuery<WithdrawRequest[]>({
    queryKey: ["/api/admin/withdraw-requests"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
    refetchInterval: 5000,
    staleTime: 0,
  });

  const { data: chatRooms, isLoading: chatRoomsLoading } = useQuery<any[]>({
    queryKey: ["/api/chat/rooms"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
    refetchInterval: 5000,
  });

  const { data: ipoStocksData, isLoading: ipoStocksLoading } = useQuery<IpoStock[]>({
    queryKey: ["/api/admin/ipo-stocks"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: !!authData?.user?.isAdmin,
  });

  const totalUnreadCount = (chatRooms || []).reduce((sum: number, room: any) => sum + (room.unreadCount || 0), 0);
  const pendingTransferCount = (allTransferRequests || []).filter(r => r.status === "pending").length;
  const pendingMemberTransferCount = allMemberTransfers.filter(t => t.status === "pending").length;

  const [memberTransferAdminMemo, setMemberTransferAdminMemo] = useState<Record<string, string>>({});
  const [memberTransferTab, setMemberTransferTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [memberTransferSearch, setMemberTransferSearch] = useState("");
  const [chatSearch, setChatSearch] = useState("");
  const [withdrawTab, setWithdrawTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [withdrawSearch, setWithdrawSearch] = useState("");
  const [withdrawAdminMemo, setWithdrawAdminMemo] = useState<Record<string, string>>({});
  const [depositEditId, setDepositEditId] = useState<string | null>(null);
  const [depositEditAmount, setDepositEditAmount] = useState("");

  // 출금신청 승인/거부
  const approveWithdrawMutation = useMutation({
    mutationFn: async ({ id, status, adminMemo }: { id: string; status: string; adminMemo?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/withdraw-requests/${id}`, { status, adminMemo });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/withdraw-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: vars.status === "approved" ? "출금 승인 완료" : "출금 거부 완료", description: vars.status === "approved" ? "출금이 승인되어 예수금에서 차감되었습니다." : "출금신청이 거부되었습니다." });
    },
    onError: (err: Error) => {
      let msg = "처리에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "오류", description: msg, variant: "destructive" });
    },
  });

  // 회원 예수금 수동 설정
  const setDepositBalanceMutation = useMutation({
    mutationFn: async ({ userId, amount }: { userId: string; amount: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/deposit-balance`, { amount });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setDepositEditId(null);
      setDepositEditAmount("");
      toast({ title: "예수금 수정 완료" });
    },
    onError: (err: Error) => {
      let msg = "처리에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "오류", description: msg, variant: "destructive" });
    },
  });

  // 확정매도 전체 비허용 초기화
  const resetAllCanSellMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/users/reset-can-sell-all");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "전체 초기화 완료", description: `${data.updated ?? "전체"}명이 확정매도 비허용으로 설정되었습니다.` });
    },
    onError: () => toast({ title: "오류", description: "초기화에 실패했습니다", variant: "destructive" }),
  });

  // 회원별 확정매도 허용 토글
  const setCanSellMutation = useMutation({
    mutationFn: async ({ userId, canSell }: { userId: string; canSell: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/can-sell`, { canSell });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: "설정 완료" });
    },
    onError: (err: Error) => {
      let msg = "처리에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "오류", description: msg, variant: "destructive" });
    },
  });

  const approveMemberTransferMutation = useMutation({
    mutationFn: async ({ id, status, adminMemo }: { id: string; status: string; adminMemo?: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/stock-member-transfers/${id}`, { status, adminMemo });
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stock-member-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      toast({ title: vars.status === "approved" ? "승인 완료" : "거부 완료", description: vars.status === "approved" ? "주식 이전이 처리되었습니다." : "주식 이전 신청이 거부되었습니다." });
    },
    onError: (err: Error) => {
      let msg = "처리에 실패했습니다";
      try { const p = JSON.parse(err.message.replace(/^[0-9]+:\s*/, "")); if (p.message) msg = p.message; } catch {}
      toast({ title: "오류", description: msg, variant: "destructive" });
    },
  });

  const createIpoStockMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/admin/ipo-stocks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ipo-stocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ipo-stocks"] });
      toast({ title: "종목 추가 완료" });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const updateIpoStockMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      await apiRequest("PATCH", `/api/admin/ipo-stocks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ipo-stocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ipo-stocks"] });
      toast({ title: "종목 수정 완료" });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteIpoStockMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/ipo-stocks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ipo-stocks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ipo-stocks"] });
      toast({ title: "종목 삭제 완료" });
    },
  });

  const updateTransferStatusMutation = useMutation({
    mutationFn: async ({ id, status, adminMemo }: { id: string; status: string; adminMemo?: string }) => {
      await apiRequest("PATCH", `/api/admin/transfer-requests/${id}`, { status, adminMemo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer-requests"] });
      toast({ title: "상태 변경 완료", description: "대체출고 신청 상태가 변경되었습니다" });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const bulkUpdateTransferMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map((id) => apiRequest("PATCH", `/api/admin/transfer-requests/${id}`, { status })));
    },
    onSuccess: (_, { ids, status }) => {
      const label: Record<string, string> = { approved: "승인", rejected: "거부", held: "보류", "출고대기중": "출고대기중" };
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer-requests"] });
      setSelectedTransferIds(new Set());
      toast({ title: `일괄 ${label[status] ?? status} 완료`, description: `${ids.length}건 처리되었습니다` });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: async (txId: string) => {
      await apiRequest("DELETE", `/api/admin/transactions/${txId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      toast({ title: "삭제 완료", description: "거래 내역이 삭제되었습니다" });
    },
  });

  const toggleHiddenMutation = useMutation({
    mutationFn: async (txId: string) => {
      await apiRequest("PATCH", `/api/admin/transactions/${txId}/hidden`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
      toast({ title: "처리 완료", description: "내역 숨김 상태가 변경되었습니다" });
    },
  });

  const deleteTransferRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/transfer-requests/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer-requests"] });
      toast({ title: "삭제 완료", description: "출고 신청 내역이 삭제되었습니다" });
    },
    onError: () => {
      toast({ title: "오류", description: "삭제에 실패했습니다", variant: "destructive" });
    },
  });

  const [editDateTransferId, setEditDateTransferId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState("");

  const updateTransferDateMutation = useMutation({
    mutationFn: async ({ id, createdAt }: { id: string; createdAt: string }) => {
      await apiRequest("PATCH", `/api/admin/transfer-requests/${id}/date`, { createdAt });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer-requests"] });
      setEditDateTransferId(null);
      toast({ title: "날짜 변경 완료" });
    },
    onError: () => {
      toast({ title: "오류", description: "날짜 변경에 실패했습니다", variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/admin-logout");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/admin-me"] });
      setLocation("/admin/login");
    },
  });

  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer-requests"] });
    queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshData();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!authData?.user?.isAdmin) return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isClosed = false;

    const connect = () => {
      if (isClosed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
      chatWsRef.current = ws;
       ws.onopen = () => {
         const currentRoom = selectedChatRoomRef.current;
         joinedChatRoomRef.current = null;
         setJoinedChatRoomId(null);
         if (currentRoom) ws.send(JSON.stringify({ type: "join", roomId: currentRoom, requestId: ++joinRequestRef.current }));
       };
      ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
         if (parsed.type === "error") {
           toast({ title: "채팅 오류", description: parsed.message || "전송할 수 없습니다", variant: "destructive" });
           return;
         }
         if (parsed.type === "joined" && parsed.data?.roomId) {
           if (parsed.data.requestId !== joinRequestRef.current) return;
           joinedChatRoomRef.current = parsed.data.roomId;
           setJoinedChatRoomId(parsed.data.roomId);
           chatSyncRoomRef.current = parsed.data.roomId;
           chatSyncingRef.current = true;
           chatBufferedEventsRef.current = [];
            fetch(`/api/chat/rooms/${parsed.data.roomId}/messages`, { credentials: "include" }).then((response) => {
              if (!response.ok) throw new Error("채팅 내역을 불러오지 못했습니다");
              return response.json();
            }).then((history) => {
             if (selectedChatRoomRef.current !== parsed.data.roomId) return;
              const bufferedEvents = chatBufferedEventsRef.current;
              chatBufferedEventsRef.current = [];
              chatSyncingRef.current = false;
              setChatMessages((prev) =>
                mergeChatSnapshot(parsed.data.roomId, parsed.data.roomId, prev, history, bufferedEvents)
              );
             fetch(`/api/chat/rooms/${parsed.data.roomId}/mark-read`, { method: "POST", credentials: "include" }).then(() => queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] })).catch(() => {});
            }).catch(() => {
              if (selectedChatRoomRef.current !== parsed.data.roomId) return;
              const bufferedEvents = chatBufferedEventsRef.current;
              chatBufferedEventsRef.current = [];
              chatSyncingRef.current = false;
              setChatMessages((prev) => {
                const byId = new Map(prev.map((message: any) => [message.id, message]));
                for (const event of bufferedEvents) {
                  if (event.type === "message") byId.set(event.data.id, event.data);
                  if (event.type === "message_deleted") byId.delete(event.data.id);
                  if (event.type === "messages_read") for (const id of event.data.messageIds || []) {
                    const message = byId.get(id);
                    if (message) byId.set(id, { ...message, isReadByMember: 1 });
                  }
                }
                return Array.from(byId.values());
              });
              fetch(`/api/chat/rooms/${parsed.data.roomId}/mark-read`, { method: "POST", credentials: "include" })
                .then(() => queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] }))
                .catch(() => {});
            });
         }
         if (parsed.data?.roomId === selectedChatRoomRef.current && chatSyncingRef.current) {
           chatBufferedEventsRef.current.push(parsed);
           return;
         }
        if (parsed.type === "message" && parsed.data) {
           if (parsed.data.roomId === selectedChatRoomRef.current) {
             setChatMessages((prev) => {
               if (prev.some((m) => m.id === parsed.data.id)) return prev;
               return [...prev, parsed.data];
             });
           }
          if (parsed.data.senderRole === "user") {
            const currentRoom = selectedChatRoomRef.current;
             if (
               currentRoom &&
               parsed.data.roomId === currentRoom &&
               activeSectionRef.current === "chat" &&
               document.visibilityState === "visible"
             ) {
              fetch(`/api/chat/rooms/${currentRoom}/mark-read`, { method: "POST", credentials: "include" }).then(() => {
                queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
              }).catch(() => {});
            } else {
              queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
            }
          }
        }
        if (parsed.type === "message_deleted" && parsed.data) {
          setChatMessages((prev) => prev.filter((m) => m.id !== parsed.data.id));
        }
        if (parsed.type === "messages_read" && parsed.data?.readerRole === "member") {
          setChatMessages((prev) => prev.map((m) => parsed.data.messageIds.includes(m.id) ? { ...m, isReadByMember: 1 } : m));
        }
        if (parsed.type === "notification") {
          const messageId = parsed.data?.messageId;
          if (messageId && notifiedChatMessageIdsRef.current.has(messageId)) return;
          if (messageId) {
            notifiedChatMessageIdsRef.current.add(messageId);
            if (notifiedChatMessageIdsRef.current.size > 200) {
              const oldestId = notifiedChatMessageIdsRef.current.values().next().value;
              if (oldestId) notifiedChatMessageIdsRef.current.delete(oldestId);
            }
          }
           if (chatSoundEnabledRef.current) void playNotificationSound();
          toast({
            title: "새 상담 메시지",
            description: `${parsed.data.userName}: ${parsed.data.message.substring(0, 30)}${parsed.data.message.length > 30 ? "..." : ""}`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
        }
        if (parsed.type === "transfer_update" && parsed.data?.action === "new_request") {
          if (transferSoundEnabledRef.current) {
             void playNotificationSound();
          }
          toast({
            title: "새 대체출고 신청",
            description: `${parsed.data.userName || "회원"}님이 대체출고를 신청했습니다`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/transfer-requests"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
        }
        if (parsed.type === "transaction_update") {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/transactions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
        }
      } catch {}
    };
      ws.onclose = () => {
        chatWsRef.current = null;
         joinedChatRoomRef.current = null;
         setJoinedChatRoomId(null);
        if (!isClosed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
      ws.onerror = () => { ws.close(); };
    };

    connect();
    return () => {
      isClosed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (chatWsRef.current) { chatWsRef.current.close(); chatWsRef.current = null; }
    };
  }, [authData?.user?.isAdmin]);

  useEffect(() => {
    selectedChatRoomRef.current = selectedChatRoom;
    joinedChatRoomRef.current = null;
    chatSyncRoomRef.current = null;
    chatSyncingRef.current = false;
    chatBufferedEventsRef.current = [];
    setChatMessages((prev) => selectedChatRoom ? prev.filter((message) => message.roomId === selectedChatRoom) : []);
    setJoinedChatRoomId(null);
    if (selectedChatRoom && chatWsRef.current?.readyState === WebSocket.OPEN) {
      chatWsRef.current.send(JSON.stringify({ type: "join", roomId: selectedChatRoom, requestId: ++joinRequestRef.current }));
    }
  }, [selectedChatRoom]);

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleChatSend = () => {
    const text = chatInput.trim();
    if (!text || !chatWsRef.current || chatWsRef.current.readyState !== WebSocket.OPEN || !selectedChatRoom || joinedChatRoomRef.current !== selectedChatRoom) return;
    chatWsRef.current.send(JSON.stringify({ type: "message", roomId: selectedChatRoom, message: text }));
    setChatInput("");
  };

  const deleteChatMessageMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/chat/messages/${id}`);
    },
    onSuccess: (_, id) => {
      setChatMessages((prev) => prev.filter((m) => m.id !== id));
    },
    onError: (error: any) => {
      toast({ title: "메시지 회수 실패", description: error?.message || "다시 시도해주세요.", variant: "destructive" });
    },
  });

  const createMacroMutation = useMutation({
    mutationFn: () => apiRequest(macroEditId ? "PATCH" : "POST", macroEditId ? `/api/admin/chat/macros/${macroEditId}` : "/api/admin/chat/macros", { title: macroTitle, message: macroMessage }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/macros"] });
      setMacroTitle(""); setMacroMessage(""); setMacroEditId(null); setMacroDialogOpen(false);
    },
    onError: (error: any) => toast({ title: "매크로 저장 실패", description: error?.message, variant: "destructive" }),
  });
  const deleteMacroMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/chat/macros/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/chat/macros"] }),
    onError: (error: any) => toast({ title: "매크로 삭제 실패", description: error?.message, variant: "destructive" }),
  });

  const [chatImageUploading, setChatImageUploading] = useState(false);
  const adminChatImageRef = useRef<HTMLInputElement>(null);

  const handleChatImageUpload = async (file: File) => {
    if (!chatWsRef.current || !selectedChatRoom) return;
    setChatImageUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
       if (chatWsRef.current.readyState !== WebSocket.OPEN || joinedChatRoomRef.current !== selectedChatRoom) return;
      chatWsRef.current.send(JSON.stringify({ type: "message", roomId: selectedChatRoom, message: `[img]${dataUrl}` }));
    } catch {
      toast({ title: "이미지 업로드 실패", description: "다시 시도해주세요.", variant: "destructive" });
    } finally {
      setChatImageUploading(false);
      if (adminChatImageRef.current) adminChatImageRef.current.value = "";
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-10 w-full bg-gray-200" />
          <Skeleton className="h-32 w-full bg-gray-200" />
          <Skeleton className="h-64 w-full bg-gray-200" />
        </div>
      </div>
    );
  }

  if (!authData?.user?.isAdmin) {
    return <Redirect to="/admin/login" />;
  }

  const users = (allUsers || []).filter((u) => !u.isAdmin);
  const transactions = allTransactions || [];

  const managerCodes = Array.from(new Set(
    users.map((u) => u.managerCode).filter((c): c is string => !!c && c.trim() !== "")
  )).sort();

  const getGroupLabel = (siteGroup: string | null | undefined): string => {
    if (!siteGroup) return "";
    const found = domainGroupsList.find((g) => g.domain === siteGroup);
    return found ? found.groupName : siteGroup;
  };

  const uniqueSiteGroups = Array.from(new Set(
    users.map((u) => u.siteGroup).filter((g): g is string => !!g && g.trim() !== "")
  )).sort();

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.fullName.includes(searchTerm) ||
      u.username.includes(searchTerm) ||
      u.accountNumber.includes(searchTerm) ||
      (u.phone && u.phone.includes(searchTerm)) ||
      (u.email && u.email.includes(searchTerm)) ||
      (u.unionCode && u.unionCode.includes(searchTerm));
    if (!matchSearch) return false;
    if (filterManager !== "all") {
      if (filterManager === "none" && (u.managerCode && u.managerCode.trim() !== "")) return false;
      if (filterManager !== "none" && u.managerCode !== filterManager) return false;
    }
    if (filterSiteGroup !== "all") {
      if (filterSiteGroup === "none" && (u.siteGroup && u.siteGroup.trim() !== "")) return false;
      if (filterSiteGroup !== "none" && u.siteGroup !== filterSiteGroup) return false;
    }
    if (filterUnionCode !== "all") {
      if (filterUnionCode === "none" && (u.unionCode && u.unionCode.trim() !== "")) return false;
      if (filterUnionCode !== "none" && u.unionCode !== filterUnionCode) return false;
    }
    return true;
  });

  const getUserName = (userId: string) => {
    const u = (allUsers || []).find((u) => u.id === userId);
    return u ? u.fullName : "알 수 없음";
  };

  const getUserManagerCode = (userId: string) => {
    const u = (allUsers || []).find((u) => u.id === userId);
    return u?.managerCode || null;
  };

  const getUserUnionCode = (userId: string) => {
    const u = (allUsers || []).find((u) => u.id === userId);
    return u?.unionCode || null;
  };

  const getUserPhone = (userId: string) => {
    const u = (allUsers || []).find((u) => u.id === userId);
    return u?.phone || "-";
  };

  const getUserUsername = (userId: string) => {
    const u = (allUsers || []).find((u) => u.id === userId);
    return u?.username || "-";
  };

  const allManagerCodes = Array.from(new Set(
    (allUsers || []).map((u) => u.managerCode).filter((c): c is string => !!c && c.trim() !== "")
  )).sort();

  const allTransferUnionCodes = Array.from(new Set(
    (allUsers || []).map((u) => u.unionCode).filter((c): c is string => !!c && c.trim() !== "")
  )).sort();

  const filteredTransfers = (allTransferRequests || []).filter((tr) => {
    const matchTab = transferTab === "all" || tr.status === transferTab;
    const term = transferSearch.trim().toLowerCase();
    const name = getUserName(tr.userId).toLowerCase();
    const stock = tr.stockName.toLowerCase();
    const matchSearch = term === "" || name.includes(term) || stock.includes(term);
    const code = getUserManagerCode(tr.userId);
    const matchManager =
      filterTransferManager === "all" ||
      (filterTransferManager === "none" && !code) ||
      (filterTransferManager !== "none" && code === filterTransferManager);
    const uc = getUserUnionCode(tr.userId);
    const matchUnion =
      filterTransferUnionCode === "all" ||
      (filterTransferUnionCode === "none" && !uc) ||
      (filterTransferUnionCode !== "none" && uc === filterTransferUnionCode);
    return matchTab && matchSearch && matchManager && matchUnion;
  });

  const getUserHoldings = (userId: string) => {
    const isIn = (t: string) => t === "in" || t === "입고";
    const isOut = (t: string) => t === "out" || t === "출고" || t === "내 계좌로 옮기기";
    const map: Record<string, number> = {};
    for (const tx of transactions.filter((t) => t.userId === userId)) {
      if (!map[tx.stockName]) map[tx.stockName] = 0;
      if (isIn(tx.type)) map[tx.stockName] += tx.quantity;
      else if (isOut(tx.type)) map[tx.stockName] -= tx.quantity;
    }
    return Object.entries(map)
      .filter(([, qty]) => qty > 0)
      .map(([name, qty]) => ({ name, qty }));
  };

  const filteredTransactions = transactions
    .filter((tx) => {
      if (filterCategory !== "all" && tx.category !== filterCategory) return false;
      if (filterType !== "all" && tx.type !== filterType) return false;
      if (filterTxManager !== "all") {
        const code = getUserManagerCode(tx.userId);
        if (filterTxManager === "none" && code) return false;
        if (filterTxManager !== "none" && code !== filterTxManager) return false;
      }
      if (filterTxUnionCode !== "all") {
        const code = getUserUnionCode(tx.userId);
        if (filterTxUnionCode === "none" && code) return false;
        if (filterTxUnionCode !== "none" && code !== filterTxUnionCode) return false;
      }
      if (txSearchTerm) {
        const userName = getUserName(tx.userId);
        const phone = getUserPhone(tx.userId);
        const username = getUserUsername(tx.userId);
        const managerCode = getUserManagerCode(tx.userId) || "";
        const unionCode = getUserUnionCode(tx.userId) || "";
        const term = txSearchTerm;
        if (
          !userName.includes(term) &&
          !tx.stockName.includes(term) &&
          !(tx.memo && tx.memo.includes(term)) &&
          !phone.includes(term) &&
          !username.includes(term) &&
          !managerCode.includes(term) &&
          !unionCode.includes(term)
        ) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const getSortValue = (tx: StockTransaction) => {
        if (transactionSortField === "quantity") return tx.quantity;
        if (transactionSortField === "price") return tx.pricePerShare;
        if (transactionSortField === "total") return tx.quantity * tx.pricePerShare;
        return new Date(tx.createdAt).getTime();
      };
      const difference = getSortValue(a) - getSortValue(b);
      return transactionSortDirection === "asc" ? difference : -difference;
    });

  const totalMembers = users.length;
  const frozenMembers = users.filter((u) => u.isFrozen).length;
  const totalIn = transactions.filter((t) => t.type === "in").reduce((s, t) => s + t.quantity, 0);
  const totalOut = transactions.filter((t) => t.type === "out").reduce((s, t) => s + t.quantity, 0);
  const totalValue = transactions.filter((t) => t.type === "in").reduce((s, t) => s + t.quantity * t.pricePerShare, 0);

  const adminSidebarContent = (isMobile: boolean) => (
    <>
      <div className={`h-14 border-b border-gray-200 flex items-center ${!isMobile && sidebarCollapsed ? "justify-center px-2" : "px-4"} gap-2`}>
        {(!isMobile && sidebarCollapsed) ? (
          <div className="w-7 h-7 rounded-md bg-[#03C75A] flex items-center justify-center shrink-0">
            <span className="text-white text-xs font-bold">U+</span>
          </div>
        ) : (
          <>
            <div className="w-7 h-7 rounded-md bg-[#03C75A] flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">U+</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-sm truncate text-gray-900">누보리치</span>
              <span className="text-[11px] text-gray-500">관리자 시스템</span>
            </div>
            {isMobile && (
              <button onClick={() => setMobileSidebarOpen(false)} className="ml-auto p-1" data-testid="button-close-admin-sidebar">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </>
        )}
      </div>
      <nav className="flex-1 py-3 px-2 space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          const showUnread = item.id === "chat" && totalUnreadCount > 0;
          const showPending = item.id === "members" && pendingUsers.length > 0;
          const showPendingTransfer = item.id === "transfers" && pendingTransferCount > 0;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveSection(item.id); if (isMobile) setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 rounded-md text-sm font-medium transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"} ${isActive ? "bg-[#03C75A] text-white" : "text-gray-600"}`}
              data-testid={`nav-admin-${item.id}`}
              title={!isMobile && sidebarCollapsed ? item.label : undefined}
            >
              <div className="relative shrink-0">
                <Icon className="w-4 h-4" />
                {showUnread && !isMobile && sidebarCollapsed && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" data-testid="badge-chat-unread-icon">
                    {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                  </span>
                )}
                {showPending && !isMobile && sidebarCollapsed && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center" data-testid="badge-members-pending-icon">
                    {pendingUsers.length}
                  </span>
                )}
                {showPendingTransfer && !isMobile && sidebarCollapsed && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center" data-testid="badge-transfers-pending-icon">
                    {pendingTransferCount}
                  </span>
                )}
              </div>
              {(isMobile || !sidebarCollapsed) && (
                <span className="flex-1 text-left">{item.label}</span>
              )}
              {showUnread && (isMobile || !sidebarCollapsed) && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0" data-testid="badge-chat-unread">
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </span>
              )}
              {showPending && (isMobile || !sidebarCollapsed) && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0" data-testid="badge-members-pending">
                  {pendingUsers.length}
                </span>
              )}
              {showPendingTransfer && (isMobile || !sidebarCollapsed) && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0" data-testid="badge-transfers-pending">
                  {pendingTransferCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div className="border-t border-gray-200 p-2 space-y-1">
        <Link href="/admin/manual">
          <button onClick={() => isMobile && setMobileSidebarOpen(false)} className={`w-full flex items-center gap-3 rounded-md text-sm text-gray-600 transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`} data-testid="nav-admin-manual" title={!isMobile && sidebarCollapsed ? "사용 매뉴얼" : undefined}>
            <BookOpen className="w-4 h-4 shrink-0" />
            {(isMobile || !sidebarCollapsed) && <span>사용 매뉴얼</span>}
          </button>
        </Link>
        <Link href="/">
          <button onClick={() => isMobile && setMobileSidebarOpen(false)} className={`w-full flex items-center gap-3 rounded-md text-sm text-gray-600 transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`} data-testid="nav-admin-home" title={!isMobile && sidebarCollapsed ? "메인 홈" : undefined}>
            <Home className="w-4 h-4 shrink-0" />
            {(isMobile || !sidebarCollapsed) && <span>메인 홈</span>}
          </button>
        </Link>
        <button
          onClick={() => logoutMutation.mutate()}
          className={`w-full flex items-center gap-3 rounded-md text-sm text-gray-600 transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`}
          data-testid="button-admin-logout"
          title={!isMobile && sidebarCollapsed ? "로그아웃" : undefined}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {(isMobile || !sidebarCollapsed) && <span>로그아웃</span>}
        </button>
        {!isMobile && (
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`w-full flex items-center gap-3 rounded-md text-sm text-gray-600 transition-colors ${sidebarCollapsed ? "justify-center px-2 py-2" : "px-3 py-2"}`}
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
    <div className="flex h-screen bg-white overflow-hidden">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-gray-50 border-r border-gray-200 flex flex-col z-10">
            {adminSidebarContent(true)}
          </aside>
        </div>
      )}

      <aside className={`hidden md:flex ${sidebarCollapsed ? "w-16" : "w-60"} border-r border-gray-200 bg-gray-50 flex-col transition-all duration-200 shrink-0`}>
        {adminSidebarContent(false)}
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b border-gray-200 bg-gray-50 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-1 text-gray-500" data-testid="button-admin-mobile-menu">
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="truncate font-bold text-base sm:text-lg text-gray-900" data-testid="text-admin-section-title">
              {sidebarItems.find((i) => i.id === activeSection)?.label}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-2 text-sm text-gray-500">
            <button
              type="button"
              onClick={() => setActiveSection("chat")}
              className={`relative inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md border transition-colors ${
                chatIndicatorEnabled && totalUnreadCount > 0
                  ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
              }`}
              title={totalUnreadCount > 0 ? `읽지 않은 상담 ${totalUnreadCount}건` : "1:1 상담"}
              aria-label={totalUnreadCount > 0 ? `읽지 않은 상담 ${totalUnreadCount}건 열기` : "1:1 상담 열기"}
              data-testid="button-admin-chat-notifications"
            >
              <MessageSquare className="h-4 w-4" />
              {chatIndicatorEnabled && totalUnreadCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-5 text-white">
                  {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={toggleChatIndicator}
              className={`inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md border transition-colors ${
                chatIndicatorEnabled ? "border-blue-200 bg-blue-50 text-blue-600" : "border-gray-200 bg-white text-gray-400"
              }`}
              title={chatIndicatorEnabled ? "상담 알림 표시 끄기" : "상담 알림 표시 켜기"}
              aria-label={chatIndicatorEnabled ? "상담 알림 표시 끄기" : "상담 알림 표시 켜기"}
              aria-pressed={chatIndicatorEnabled}
              data-testid="button-admin-chat-indicator-toggle"
            >
              {chatIndicatorEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={toggleChatSound}
              className={`inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-md border transition-colors ${
                chatSoundEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-600" : "border-gray-200 bg-white text-gray-400"
              }`}
              title={chatSoundEnabled ? "상담 알림음 끄기" : "상담 알림음 켜기"}
              aria-label={chatSoundEnabled ? "상담 알림음 끄기" : "상담 알림음 켜기"}
              aria-pressed={chatSoundEnabled}
              data-testid="button-admin-chat-sound-toggle"
            >
              {chatSoundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <Badge variant="outline" className="hidden sm:inline-flex border-gray-200 text-gray-500">Admin</Badge>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
          {activeSection === "dashboard" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="p-5 bg-white border-gray-200">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500">총 회원수</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums text-gray-900" data-testid="text-total-members">{totalMembers}명</p>
                      {frozenMembers > 0 && <p className="text-xs text-blue-500 mt-0.5">{frozenMembers}명 동결</p>}
                    </div>
                    <div className="w-10 h-10 rounded-md bg-[#03C75A]/20 flex items-center justify-center">
                      <Users className="w-5 h-5 text-[#03C75A]" />
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-white border-gray-200">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500">총 입고</p>
                      <p className="text-2xl font-bold mt-1 text-red-500 tabular-nums" data-testid="text-admin-total-in">{totalIn.toLocaleString()}주</p>
                    </div>
                    <div className="w-10 h-10 rounded-md bg-red-500/10 flex items-center justify-center">
                      <ArrowDownRight className="w-5 h-5 text-red-500" />
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-white border-gray-200">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500">총 출고</p>
                      <p className="text-2xl font-bold mt-1 text-blue-500 tabular-nums" data-testid="text-admin-total-out">{totalOut.toLocaleString()}주</p>
                    </div>
                    <div className="w-10 h-10 rounded-md bg-blue-500/10 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-blue-500" />
                    </div>
                  </div>
                </Card>
                <Card className="p-5 bg-white border-gray-200">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-500">보유 잔량</p>
                      <p className="text-2xl font-bold mt-1 tabular-nums text-gray-900" data-testid="text-admin-holding">{(totalIn - totalOut).toLocaleString()}주</p>
                    </div>
                    <div className="w-10 h-10 rounded-md bg-[#03C75A]/20 flex items-center justify-center">
                      <Package className="w-5 h-5 text-[#03C75A]" />
                    </div>
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="p-0 overflow-hidden bg-white border-gray-200">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">최근 회원</h3>
                      <p className="text-xs text-gray-500 mt-0.5">최근 가입한 회원 목록</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveSection("members")} data-testid="link-view-all-members">
                      전체보기
                    </Button>
                  </div>
                  {usersLoading ? (
                    <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full bg-gray-200" />)}</div>
                  ) : users.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">등록된 회원이 없습니다</div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {users.slice(0, 5).map((u) => (
                        <div key={u.id} className="px-4 py-3 flex items-center justify-between gap-4" data-testid={`dash-user-${u.id}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-[#03C75A]/20 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-[#03C75A]">{u.fullName.charAt(0)}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium truncate text-gray-700">{u.fullName}</p>
                                {u.isFrozen && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">동결</Badge>}
                              </div>
                              <p className="text-xs text-gray-500 truncate">{u.bank} · {u.accountNumber}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <StockTransactionDialog user={u} type="in" onSuccess={refreshData} />
                            <StockTransactionDialog user={u} type="out" onSuccess={refreshData} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                <Card className="p-0 overflow-hidden bg-white border-gray-200">
                  <div className="p-4 border-b border-gray-200 flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-sm text-gray-900">최근 거래</h3>
                      <p className="text-xs text-gray-500 mt-0.5">최근 입출고 내역</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setActiveSection("transactions")} data-testid="link-view-all-tx">
                      전체보기
                    </Button>
                  </div>
                  {txLoading ? (
                    <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full bg-gray-200" />)}</div>
                  ) : transactions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">거래 내역이 없습니다</div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {transactions.slice(0, 5).map((tx) => (
                        <div key={tx.id} className="px-4 py-3 flex items-center justify-between gap-4" data-testid={`dash-tx-${tx.id}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <Badge
                              variant={tx.type === "in" ? "default" : "secondary"}
                              className={`shrink-0 ${tx.type === "in" ? "bg-red-500 border-red-500" : "bg-blue-500 border-blue-500 text-white"}`}
                            >
                              {tx.type === "in" ? "입고" : "출고"}
                            </Badge>
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate text-gray-700 flex items-center gap-1.5"><StockIcon name={tx.stockName} size={18} />{getUserName(tx.userId)} · {tx.stockName}</span>
                              <p className="text-xs text-gray-500">{tx.quantity.toLocaleString()}주 · {tx.pricePerShare.toLocaleString()}원</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 shrink-0">{new Date(tx.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              <MaintenanceToggleCard />

              <Card className="p-5 bg-white border-gray-200">
                <h3 className="font-bold text-sm mb-1 text-gray-900">자산 요약</h3>
                <p className="text-xs text-gray-500 mb-4">전체 입고 기준 총 자산 가치</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-500">총 거래 건수</p>
                    <p className="text-xl font-bold mt-1 tabular-nums text-gray-900">{transactions.length}건</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">총 입고 금액</p>
                    <p className="text-xl font-bold mt-1 tabular-nums text-gray-900">{totalValue.toLocaleString()}원</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">현재 보유 잔량</p>
                    <p className="text-xl font-bold mt-1 tabular-nums text-gray-900">{(totalIn - totalOut).toLocaleString()}주</p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {activeSection === "members" && (
            <>
              {pendingUsers.length > 0 && (
                <Card className={`border-amber-200 p-4 ${alertActive ? "bg-amber-100" : "bg-amber-50"}`}>
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <div className={`w-2 h-2 rounded-full bg-amber-500 ${alertActive ? "animate-ping" : "animate-pulse"}`} />
                    <h3 className="font-bold text-sm text-amber-900">가입 승인 대기</h3>
                    <Badge className="bg-amber-500 text-white text-xs">{pendingUsers.length}명</Badge>
                    {alertActive && (
                      <button
                        onClick={dismissAlert}
                        className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-red-500 text-white font-bold animate-pulse border-0"
                        data-testid="button-dismiss-alert"
                      >
                        🔔 알림 확인
                      </button>
                    )}
                    <button
                      onClick={toggleSound}
                      className={`ml-auto flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        soundEnabled
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-white border-amber-300 text-amber-600"
                      }`}
                      title={soundEnabled ? "알림 소리 켜짐" : "알림 소리 꺼짐"}
                      data-testid="button-toggle-sound"
                    >
                      {soundEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                      {soundEnabled ? "소리 ON" : "소리 OFF"}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {pendingUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-amber-200 px-3 py-2" data-testid={`row-pending-${u.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-gray-900">{u.fullName} <span className="font-normal text-gray-500">({u.username})</span></p>
                            {u.siteGroup && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] whitespace-nowrap">
                                <Globe className="w-3 h-3" />
                                {u.siteGroup}
                                {getGroupLabel(u.siteGroup) !== u.siteGroup && (
                                  <span className="text-blue-500">({getGroupLabel(u.siteGroup)})</span>
                                )}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate">{u.phone || "-"} · {u.bank} · {u.accountNumber}</p>
                          {u.unionCode && (
                            <p className="text-xs mt-0.5">조합코드: <span className="font-mono font-bold text-purple-700 bg-purple-50 px-1 rounded">{u.unionCode}</span></p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            className="bg-[#03C75A] hover:bg-[#d42e45] text-white text-xs h-7 px-3"
                            onClick={() => approveMutation.mutate(u.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending || holdMemberMutation.isPending}
                            data-testid={`button-approve-${u.id}`}
                          >
                            승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-3 border-amber-300 text-amber-600 hover:bg-amber-50"
                            onClick={() => holdMemberMutation.mutate(u.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending || holdMemberMutation.isPending}
                            data-testid={`button-hold-${u.id}`}
                          >
                            보류
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 px-3 border-gray-300 text-gray-600"
                            onClick={() => rejectMutation.mutate(u.id)}
                            disabled={approveMutation.isPending || rejectMutation.isPending || holdMemberMutation.isPending}
                            data-testid={`button-reject-${u.id}`}
                          >
                            거절
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="회원 검색 (이름, 아이디, 계좌번호)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                    data-testid="input-search-members"
                  />
                </div>
                <Select value={filterManager} onValueChange={setFilterManager}>
                  <SelectTrigger className="w-[150px] bg-white border-gray-200 text-gray-700" data-testid="select-filter-manager">
                    <SelectValue placeholder="담당자 필터" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">담당자 전체</SelectItem>
                    <SelectItem value="none">담당자 없음</SelectItem>
                    {managerCodes.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterSiteGroup} onValueChange={setFilterSiteGroup}>
                  <SelectTrigger className="w-[160px] bg-white border-gray-200 text-gray-700" data-testid="select-filter-site-group">
                    <Globe className="w-3.5 h-3.5 mr-1.5 shrink-0" />
                    <SelectValue placeholder="도메인 그룹" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 도메인</SelectItem>
                    <SelectItem value="none">미분류</SelectItem>
                    {uniqueSiteGroups.map((g) => (
                      <SelectItem key={g} value={g}>{getGroupLabel(g)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterUnionCode} onValueChange={setFilterUnionCode}>
                  <SelectTrigger className="w-[150px] bg-white border-gray-200 text-gray-700" data-testid="select-filter-union-code">
                    <SelectValue placeholder="조합코드 필터" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">조합코드 전체</SelectItem>
                    <SelectItem value="none">코드 없음</SelectItem>
                    {Array.from(new Set(users.map(u => u.unionCode).filter((c): c is string => !!c && c.trim() !== ""))).sort().map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="shrink-0 border-gray-200 text-gray-500">{filteredUsers.length}명</Badge>
                <button
                  onClick={() => {
                    if (confirm("전체 회원을 확정매도 비허용으로 초기화하시겠습니까?")) {
                      resetAllCanSellMutation.mutate();
                    }
                  }}
                  disabled={resetAllCanSellMutation.isPending}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border bg-red-50 border-red-200 text-red-600 hover:bg-red-100 transition-colors font-medium"
                  title="전체 회원 확정매도 비허용으로 초기화"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  전체 비허용 초기화
                </button>
                <button
                  onClick={toggleSound}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                    soundEnabled
                      ? "bg-amber-50 border-amber-300 text-amber-700"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  }`}
                  title={soundEnabled ? "가입 알림 소리 켜짐 (클릭 시 끄기)" : "가입 알림 소리 꺼짐 (클릭 시 켜기)"}
                  data-testid="button-toggle-sound-bar"
                >
                  {soundEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                  가입알림 {soundEnabled ? "ON" : "OFF"}
                </button>
              </div>

              {usersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full bg-gray-200" />)}
                </div>
              ) : filteredUsers.length === 0 ? (
                <Card className="p-12 text-center bg-white border-gray-200">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30 text-gray-400" />
                  <p className="font-medium text-gray-500">
                    {searchTerm ? "검색 결과가 없습니다" : "등록된 회원이 없습니다"}
                  </p>
                </Card>
              ) : (
                <>
                <div className="md:hidden space-y-3">
                  {filteredUsers.map((u) => (
                    <div key={u.id} className={`rounded-md border border-gray-200 bg-white p-4 space-y-3 ${u.isFrozen ? "opacity-60" : ""}`} data-testid={`row-user-${u.id}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#03C75A]/20 flex items-center justify-center shrink-0">
                          <span className="text-sm font-bold text-[#03C75A]">{u.fullName.charAt(0)}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-700 truncate">{u.fullName}</p>
                          <p className="text-xs text-gray-500">@{u.username}</p>
                        </div>
                        {u.isFrozen ? (
                          <Badge variant="destructive" className="text-[11px] shrink-0">동결</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] border-gray-200 text-gray-500 shrink-0">정상</Badge>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>{u.phone || "-"} · {u.email || "-"}</p>
                        <p>{u.bank} · {u.accountHolder}</p>
                        <p className="font-mono text-gray-400">{u.accountNumber}</p>
                        <div className="pt-0.5 flex flex-wrap gap-1">
                          <UnionCodeDialog user={u} onSuccess={refreshData} />
                          <ManagerCodeDialog user={u} onSuccess={refreshData} />
                        </div>
                      </div>
                      {(() => {
                        const holdings = getUserHoldings(u.id);
                        return holdings.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {holdings.map((h) => (
                              <Badge key={h.name} variant="outline" className="text-[11px] border-blue-200 text-blue-700 bg-blue-50 font-medium">
                                {h.name} {h.qty.toLocaleString()}주
                              </Badge>
                            ))}
                          </div>
                        ) : null;
                      })()}
                      <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-gray-200">
                        <MemberPurchasePriceDialog user={u} transactions={transactions} onSuccess={refreshData} />
                        <MemberDetailDialog user={u} transactions={transactions} onTransactionChange={refreshData} />
                        <MemberEditDialog user={u} onSuccess={refreshData} />
                        <MemberFreezeDialog user={u} onSuccess={refreshData} />
                        <MemberDeleteDialog user={u} onSuccess={refreshData} />
                        <Button size="icon" variant="ghost" data-testid={`button-copy-user-${u.id}`} title="회원정보 복사" onClick={() => copyUserInfo(u, toast)}>
                          <Copy className="w-4 h-4 text-gray-500" />
                        </Button>
                        <div className="w-px h-5 bg-gray-200 mx-1" />
                        <StockTransactionDialog user={u} type="in" onSuccess={refreshData} />
                        <StockTransactionDialog user={u} type="out" onSuccess={refreshData} />
                      </div>
                    </div>
                  ))}
                </div>

                <Card className="hidden md:block p-0 overflow-hidden bg-white border-gray-200">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 border-gray-200">
                          <TableHead className="text-gray-500 whitespace-nowrap">아이디</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">비밀번호</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">이름</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">상태</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">담당자</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">접속도메인</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">생년월일</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">휴대폰</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">이메일</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">증권사</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">계좌번호</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">예금주</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">조합코드</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">예수금</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">확정매도</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">가입일</TableHead>
                          <TableHead className="text-gray-500 whitespace-nowrap">보유 종목</TableHead>
                          <TableHead className="text-center text-gray-500 whitespace-nowrap">관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.map((u) => (
                          <TableRow key={u.id} className={`border-gray-200 ${u.isFrozen ? "opacity-60" : ""}`} data-testid={`row-user-${u.id}`}>
                            <TableCell className="font-medium text-gray-700">{u.username}</TableCell>
                            <TableCell className="font-mono text-xs text-gray-700">{u.plainPassword || "(암호화됨)"}</TableCell>
                            <TableCell className="text-gray-700">{u.fullName}</TableCell>
                            <TableCell>
                              {u.isFrozen ? (
                                <Badge variant="destructive" className="text-[11px]">동결</Badge>
                              ) : (
                                <Badge variant="outline" className="text-[11px] border-gray-200 text-gray-500">정상</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <UnionCodeDialog user={u} onSuccess={refreshData} />
                                <ManagerCodeDialog user={u} onSuccess={refreshData} />
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {u.siteGroup ? (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] whitespace-nowrap">
                                  <Globe className="w-3 h-3" />
                                  {getGroupLabel(u.siteGroup)}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-[11px]">미분류</span>
                              )}
                            </TableCell>
                            <TableCell className="text-gray-700 text-xs whitespace-nowrap">{u.birthDate || "-"}</TableCell>
                            <TableCell className="text-gray-700 text-xs whitespace-nowrap">{u.phone || "-"}</TableCell>
                            <TableCell className="text-gray-700 text-xs whitespace-nowrap">{u.email || "-"}</TableCell>
                            <TableCell className="text-gray-700 whitespace-nowrap">{u.bank}</TableCell>
                            <TableCell className="font-mono text-sm text-gray-700 whitespace-nowrap">{u.accountNumber}</TableCell>
                            <TableCell className="text-gray-700 whitespace-nowrap">{u.accountHolder}</TableCell>
                            <TableCell className="text-xs whitespace-nowrap">
                              {u.unionCode ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-mono font-bold">
                                  {u.unionCode}
                                </span>
                              ) : (
                                <span className="text-gray-400 text-[11px]">-</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {depositEditId === u.id ? (
                                <div className="flex items-center gap-1">
                                  <Input
                                    type="number"
                                    value={depositEditAmount}
                                    onChange={(e) => setDepositEditAmount(e.target.value)}
                                    className="w-24 h-7 text-xs"
                                    placeholder="금액"
                                    data-testid={`input-deposit-balance-${u.id}`}
                                  />
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDepositBalanceMutation.mutate({ userId: u.id, amount: Number(depositEditAmount) })} disabled={setDepositBalanceMutation.isPending}>
                                    <Save className="w-3 h-3 text-green-600" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDepositEditId(null)}>
                                    <X className="w-3 h-3 text-gray-400" />
                                  </Button>
                                </div>
                              ) : (
                                <button
                                  className="text-xs tabular-nums text-[#03C75A] font-bold hover:underline"
                                  onClick={() => { setDepositEditId(u.id); setDepositEditAmount(String(u.depositBalance ?? 0)); }}
                                  data-testid={`button-edit-deposit-${u.id}`}
                                >
                                  {(u.depositBalance ?? 0).toLocaleString()}원
                                </button>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <button
                                onClick={() => setCanSellMutation.mutate({ userId: u.id, canSell: !u.canSell })}
                                className={`flex items-center gap-1.5 text-xs font-bold rounded px-3 py-1.5 border transition-colors ${u.canSell ? "bg-green-500 text-white border-green-600 hover:bg-green-600" : "bg-gray-100 text-gray-400 border-gray-300 hover:bg-gray-200"}`}
                                data-testid={`button-toggle-can-sell-${u.id}`}
                              >
                                {u.canSell ? (
                                  <><TrendingDown className="w-3.5 h-3.5" />확정매도 허용</>
                                ) : (
                                  <><XCircle className="w-3.5 h-3.5" />확정매도 비허용</>
                                )}
                              </button>
                            </TableCell>
                            <TableCell className="text-sm text-gray-400 whitespace-nowrap">
                              {new Date(u.createdAt).toLocaleDateString("ko-KR")}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1 min-w-[100px]">
                                {getUserHoldings(u.id).length === 0 ? (
                                  <span className="text-xs text-gray-400">-</span>
                                ) : (
                                  getUserHoldings(u.id).map((h) => (
                                    <Badge key={h.name} variant="outline" className="text-[11px] border-blue-200 text-blue-700 bg-blue-50 font-medium whitespace-nowrap">
                                      {h.name} {h.qty.toLocaleString()}주
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <MemberPurchasePriceDialog user={u} transactions={transactions} onSuccess={refreshData} />
                                <MemberDetailDialog user={u} transactions={transactions} onTransactionChange={refreshData} />
                                <MemberEditDialog user={u} onSuccess={refreshData} />
                                <MemberFreezeDialog user={u} onSuccess={refreshData} />
                                <MemberDeleteDialog user={u} onSuccess={refreshData} />
                                <Button size="icon" variant="ghost" data-testid={`button-copy-user-desktop-${u.id}`} title="회원정보 복사" onClick={() => copyUserInfo(u, toast)}>
                                  <Copy className="w-4 h-4 text-gray-500" />
                                </Button>
                                <div className="w-px h-5 bg-gray-200 mx-1" />
                                <StockTransactionDialog user={u} type="in" onSuccess={refreshData} />
                                <StockTransactionDialog user={u} type="out" onSuccess={refreshData} />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
                </>
              )}
            </>
          )}

          {activeSection === "transactions" && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="검색 (회원명, 아이디, 연락처, 종목명, 담당자코드)"
                    value={txSearchTerm}
                    onChange={(e) => setTxSearchTerm(e.target.value)}
                    className="pl-9 bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                    data-testid="input-search-transactions"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-[140px] bg-white border-gray-200 text-gray-700" data-testid="select-filter-type">
                    <SelectValue placeholder="유형" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    <SelectItem value="in">입고</SelectItem>
                    <SelectItem value="out">출고</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[140px] bg-white border-gray-200 text-gray-700" data-testid="select-filter-category">
                    <SelectValue placeholder="카테고리" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체</SelectItem>
                    {STOCK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterTxManager} onValueChange={setFilterTxManager}>
                  <SelectTrigger className="w-[140px] bg-white border-gray-200 text-gray-700" data-testid="select-filter-tx-manager">
                    <SelectValue placeholder="담당자 코드" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">코드 전체</SelectItem>
                    <SelectItem value="none">코드 없음</SelectItem>
                    {allManagerCodes.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterTxUnionCode} onValueChange={setFilterTxUnionCode}>
                  <SelectTrigger className="w-[140px] bg-white border-gray-200 text-gray-700" data-testid="select-filter-tx-union-code">
                    <SelectValue placeholder="조합코드" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">조합코드 전체</SelectItem>
                    <SelectItem value="none">코드 없음</SelectItem>
                    {allTransferUnionCodes.map((code) => (
                      <SelectItem key={code} value={code}>{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={transactionSortField} onValueChange={(value) => setTransactionSortField(value as "createdAt" | "quantity" | "price" | "total")}>
                  <SelectTrigger className="w-[130px] bg-white border-gray-200 text-gray-700" data-testid="select-transaction-sort-field">
                    <SelectValue placeholder="정렬 기준" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="createdAt">일시</SelectItem>
                    <SelectItem value="quantity">수량</SelectItem>
                    <SelectItem value="price">단가</SelectItem>
                    <SelectItem value="total">총액</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={transactionSortDirection} onValueChange={(value) => setTransactionSortDirection(value as "asc" | "desc")}>
                  <SelectTrigger className="w-[120px] bg-white border-gray-200 text-gray-700" data-testid="select-transaction-sort-direction">
                    <SelectValue placeholder="정렬 순서" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc">내림차순</SelectItem>
                    <SelectItem value="asc">오름차순</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="shrink-0 border-gray-200 text-gray-500">{filteredTransactions.length}건</Badge>
              </div>

              {filteredTransactions.length > 0 && (
                <div className="space-y-2">
                  {/* 전체 합산 */}
                  <div className="flex flex-wrap gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-sm">
                    <span className="text-gray-500 font-medium">합산:</span>
                    <span className="text-red-500 font-semibold">
                      입고 {filteredTransactions.filter(t => t.type === "in").reduce((s, t) => s + t.quantity, 0).toLocaleString()}주
                    </span>
                    <span className="text-blue-500 font-semibold">
                      출고 {filteredTransactions.filter(t => t.type === "out").reduce((s, t) => s + t.quantity, 0).toLocaleString()}주
                    </span>
                    <span className="text-gray-700 font-semibold">
                      순보유 {(filteredTransactions.filter(t => t.type === "in").reduce((s, t) => s + t.quantity, 0) - filteredTransactions.filter(t => t.type === "out").reduce((s, t) => s + t.quantity, 0)).toLocaleString()}주
                    </span>
                  </div>
                  {/* 담당코드별 합계 */}
                  {(() => {
                    const grouped: Record<string, { in: number; out: number }> = {};
                    for (const tx of filteredTransactions) {
                      const code = getUserManagerCode(tx.userId) || "(없음)";
                      if (!grouped[code]) grouped[code] = { in: 0, out: 0 };
                      if (tx.type === "in") grouped[code].in += tx.quantity;
                      else grouped[code].out += tx.quantity;
                    }
                    const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
                    if (entries.length <= 1 && entries[0]?.[0] === "(없음)") return null;
                    return (
                      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                          <span className="text-xs font-semibold text-gray-600">담당코드별 합계</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                          {entries.map(([code, { in: inQty, out: outQty }]) => (
                            <div key={code} className="flex items-center gap-4 px-3 py-2 text-xs">
                              <span className="font-mono font-semibold text-[#03C75A] w-24 shrink-0">{code}</span>
                              <span className="text-red-500">입고 {inQty.toLocaleString()}주</span>
                              <span className="text-blue-500">출고 {outQty.toLocaleString()}주</span>
                              <span className="text-gray-700 font-medium">순보유 {(inQty - outQty).toLocaleString()}주</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {txLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full bg-gray-200" />)}
                </div>
              ) : filteredTransactions.length === 0 ? (
                <Card className="p-12 text-center bg-white border-gray-200">
                  <Package className="w-10 h-10 mx-auto mb-3 opacity-30 text-gray-400" />
                  <p className="font-medium text-gray-500">거래 내역이 없습니다</p>
                </Card>
              ) : (
                <>
                {(() => {
                  // 담당코드+조합코드 기준으로 그룹핑
                  const groupKey = (tx: StockTransaction) => {
                    const mc = getUserManagerCode(tx.userId) || "";
                    const uc = getUserUnionCode(tx.userId) || "";
                    return `${mc}||${uc}`;
                  };
                  const groupOrder: string[] = [];
                  const groupMap: Record<string, StockTransaction[]> = {};
                  for (const tx of filteredTransactions) {
                    const k = groupKey(tx);
                    if (!groupMap[k]) { groupMap[k] = []; groupOrder.push(k); }
                    groupMap[k].push(tx);
                  }
                  const isGrouped = groupOrder.length > 1;

                  return (
                    <>
                    {/* 모바일 */}
                    <div className="md:hidden space-y-4">
                      {groupOrder.map((key) => {
                        const [mc, uc] = key.split("||");
                        const group = groupMap[key];
                        const inQty = group.filter(t => t.type === "in").reduce((s, t) => s + t.quantity, 0);
                        const outQty = group.filter(t => t.type === "out").reduce((s, t) => s + t.quantity, 0);
                        return (
                          <div key={key} className="space-y-2">
                            {isGrouped && (
                              <div className="flex items-center gap-2 px-1 py-1.5 border-b-2 border-gray-200">
                                <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                                  {mc ? <Badge variant="outline" className="border-[#03C75A]/40 text-[#03C75A] bg-[#03C75A]/5 font-mono text-xs">담당 {mc}</Badge> : <span className="text-xs text-gray-400 font-mono">담당코드 없음</span>}
                                  {uc ? <Badge variant="outline" className="border-purple-300 text-purple-600 bg-purple-50 font-mono text-xs">조합 {uc}</Badge> : null}
                                </div>
                                <div className="flex items-center gap-2 text-xs shrink-0">
                                  <span className="text-red-500 font-semibold">입고 {inQty.toLocaleString()}주</span>
                                  <span className="text-blue-500 font-semibold">출고 {outQty.toLocaleString()}주</span>
                                </div>
                              </div>
                            )}
                            {group.map((tx) => (
                              <div key={tx.id} className={`rounded-md border p-4 space-y-3 ${tx.hidden ? "border-orange-200 bg-orange-50 opacity-60" : "border-gray-200 bg-white"}`} data-testid={`row-tx-${tx.id}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <Badge
                                    variant={tx.type === "in" ? "default" : "secondary"}
                                    className={tx.type === "in" ? "bg-red-500 border-red-500" : "bg-blue-500 border-blue-500 text-white"}
                                  >
                                    {tx.type === "in" ? "입고" : "출고"}
                                  </Badge>
                                  <span className="text-xs text-gray-400">{new Date(tx.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><StockIcon name={tx.stockName} size={18} />{getUserName(tx.userId)} · {tx.stockName}</span>
                                  </div>
                                  <p className="text-xs text-gray-500 font-mono">{getUserPhone(tx.userId)} · <span className="text-gray-400">ID: {getUserUsername(tx.userId)}</span></p>
                                  <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span>{tx.quantity.toLocaleString()}주</span>
                                    <span>{tx.pricePerShare.toLocaleString()}원</span>
                                  </div>
                                  <p className="text-sm font-medium text-gray-700 tabular-nums">총 {(tx.quantity * tx.pricePerShare).toLocaleString()}원</p>
                                </div>
                                <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
                                  <span>{tx.category}{tx.memo ? ` · ${tx.memo}` : ""}</span>
                                </div>
                                <div className="flex items-center gap-1 pt-1 border-t border-gray-200">
                                  <TransactionEditDialog tx={tx} onSuccess={refreshData} />
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => toggleHiddenMutation.mutate(tx.id)}
                                    data-testid={`button-hidden-tx-${tx.id}`}
                                    title={tx.hidden ? "숨김 해제" : "회원화면 숨김"}
                                  >
                                    {tx.hidden ? <Eye className="w-4 h-4 text-orange-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => deleteTransactionMutation.mutate(tx.id)}
                                    data-testid={`button-delete-tx-${tx.id}`}
                                    title="삭제"
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>

                    {/* 데스크톱 */}
                    <div className="hidden md:block space-y-4">
                      {groupOrder.map((key) => {
                        const [mc, uc] = key.split("||");
                        const group = groupMap[key];
                        const inQty = group.filter(t => t.type === "in").reduce((s, t) => s + t.quantity, 0);
                        const outQty = group.filter(t => t.type === "out").reduce((s, t) => s + t.quantity, 0);
                        return (
                          <div key={key} className="rounded-lg border border-gray-200 overflow-hidden bg-white">
                            {isGrouped && (
                              <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                                <div className="flex items-center gap-2 flex-1">
                                  {mc ? <Badge variant="outline" className="border-[#03C75A]/40 text-[#03C75A] bg-[#03C75A]/5 font-mono text-xs">담당 {mc}</Badge> : <span className="text-xs text-gray-400 font-mono">담당코드 없음</span>}
                                  {uc ? <Badge variant="outline" className="border-purple-300 text-purple-600 bg-purple-50 font-mono text-xs">조합 {uc}</Badge> : null}
                                  <span className="text-xs text-gray-400">{group.length}건</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs">
                                  <span className="text-red-500 font-semibold">입고 {inQty.toLocaleString()}주</span>
                                  <span className="text-blue-500 font-semibold">출고 {outQty.toLocaleString()}주</span>
                                  <span className="text-gray-700 font-semibold">순보유 {(inQty - outQty).toLocaleString()}주</span>
                                </div>
                              </div>
                            )}
                            <div className="overflow-x-auto">
                              <Table>
                                {!isGrouped && (
                                  <TableHeader>
                                    <TableRow className="bg-gray-50 border-gray-200">
                                      <TableHead className="text-gray-500">유형</TableHead>
                                      <TableHead className="text-gray-500">카테고리</TableHead>
                                      <TableHead className="text-gray-500">담당코드</TableHead>
                                      <TableHead className="text-gray-500">조합코드</TableHead>
                                      <TableHead className="text-gray-500">회원</TableHead>
                                      <TableHead className="text-gray-500">연락처</TableHead>
                                      <TableHead className="text-gray-500">아이디</TableHead>
                                      <TableHead className="text-gray-500">종목</TableHead>
                                      <TableHead className="text-right text-gray-500">수량</TableHead>
                                      <TableHead className="text-right text-gray-500">단가</TableHead>
                                      <TableHead className="text-right text-gray-500">총액</TableHead>
                                      <TableHead className="text-gray-500">메모</TableHead>
                                      <TableHead className="text-gray-500">일시</TableHead>
                                      <TableHead className="text-center text-gray-500">관리</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                )}
                                {isGrouped && (
                                  <TableHeader>
                                    <TableRow className="border-gray-100">
                                      <TableHead className="text-gray-400 text-xs py-2">유형</TableHead>
                                      <TableHead className="text-gray-400 text-xs py-2">카테고리</TableHead>
                                      <TableHead className="text-gray-400 text-xs py-2">회원</TableHead>
                                      <TableHead className="text-gray-400 text-xs py-2">연락처</TableHead>
                                      <TableHead className="text-gray-400 text-xs py-2">아이디</TableHead>
                                      <TableHead className="text-gray-400 text-xs py-2">종목</TableHead>
                                      <TableHead className="text-right text-gray-400 text-xs py-2">수량</TableHead>
                                      <TableHead className="text-right text-gray-400 text-xs py-2">단가</TableHead>
                                      <TableHead className="text-right text-gray-400 text-xs py-2">총액</TableHead>
                                      <TableHead className="text-gray-400 text-xs py-2">메모</TableHead>
                                      <TableHead className="text-gray-400 text-xs py-2">일시</TableHead>
                                      <TableHead className="text-center text-gray-400 text-xs py-2">관리</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                )}
                                <TableBody>
                                  {group.map((tx) => (
                                    <TableRow key={tx.id} className={`border-gray-100 ${tx.hidden ? "bg-orange-50 opacity-60" : ""}`} data-testid={`row-tx-${tx.id}`}>
                                      <TableCell>
                                        <Badge
                                          variant={tx.type === "in" ? "default" : "secondary"}
                                          className={tx.type === "in" ? "bg-red-500 border-red-500" : "bg-blue-500 border-blue-500 text-white"}
                                        >
                                          {tx.type === "in" ? "입고" : "출고"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-gray-700">{tx.category}</TableCell>
                                      {!isGrouped && (
                                        <>
                                          <TableCell>
                                            {getUserManagerCode(tx.userId)
                                              ? <Badge variant="outline" className="border-[#03C75A]/40 text-[#03C75A] bg-[#03C75A]/5 font-mono text-xs">{getUserManagerCode(tx.userId)}</Badge>
                                              : <span className="text-gray-300 text-xs">-</span>}
                                          </TableCell>
                                          <TableCell>
                                            {getUserUnionCode(tx.userId)
                                              ? <Badge variant="outline" className="border-purple-300 text-purple-600 bg-purple-50 font-mono text-xs">{getUserUnionCode(tx.userId)}</Badge>
                                              : <span className="text-gray-300 text-xs">-</span>}
                                          </TableCell>
                                        </>
                                      )}
                                      <TableCell className="font-medium text-gray-700">{getUserName(tx.userId)}</TableCell>
                                      <TableCell className="font-mono text-xs text-gray-500 whitespace-nowrap">{getUserPhone(tx.userId)}</TableCell>
                                      <TableCell className="font-mono text-xs text-gray-400 whitespace-nowrap">{getUserUsername(tx.userId)}</TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-1.5">
                                          <StockIcon name={tx.stockName} size={22} />
                                          <span className="text-gray-700">{tx.stockName}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-right font-mono tabular-nums text-gray-700">{tx.quantity.toLocaleString()}주</TableCell>
                                      <TableCell className="text-right font-mono tabular-nums text-gray-700">{tx.pricePerShare.toLocaleString()}원</TableCell>
                                      <TableCell className="text-right font-mono tabular-nums text-gray-700">{(tx.quantity * tx.pricePerShare).toLocaleString()}원</TableCell>
                                      <TableCell className="text-sm text-gray-400">{tx.memo || "-"}</TableCell>
                                      <TableCell className="text-sm text-gray-400 whitespace-nowrap">
                                        {new Date(tx.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })}
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center justify-center gap-1">
                                          <TransactionEditDialog tx={tx} onSuccess={refreshData} />
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => toggleHiddenMutation.mutate(tx.id)}
                                            data-testid={`button-hidden-tx-${tx.id}`}
                                            title={tx.hidden ? "숨김 해제" : "회원화면 숨김"}
                                          >
                                            {tx.hidden ? <Eye className="w-4 h-4 text-orange-500" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                                          </Button>
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => deleteTransactionMutation.mutate(tx.id)}
                                            data-testid={`button-delete-tx-${tx.id}`}
                                            title="삭제"
                                          >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                          </Button>
                                        </div>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    </>
                  );
                })()}
                </>
              )}
            </>
          )}

          {activeSection === "transfers" && (
            <>
              {/* 탭 + 검색 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {(["all","pending","출고대기중","approved","held","rejected"] as const).map((tab) => {
                    const labels: Record<string, string> = { all: "전체", pending: "대기", "출고대기중": "출고대기중", approved: "승인", rejected: "거부", held: "보류" };
                    const counts: Record<string, number> = {
                      all: (allTransferRequests || []).length,
                      pending: (allTransferRequests || []).filter(t => t.status === "pending").length,
                      "출고대기중": (allTransferRequests || []).filter(t => t.status === "출고대기중").length,
                      approved: (allTransferRequests || []).filter(t => t.status === "approved").length,
                      rejected: (allTransferRequests || []).filter(t => t.status === "rejected").length,
                      held: (allTransferRequests || []).filter(t => t.status === "held").length,
                    };
                    const active = transferTab === tab;
                    return (
                      <button
                        key={tab}
                        onClick={() => setTransferTab(tab)}
                        className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${active ? "bg-[#03C75A] text-white border-[#03C75A]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                        data-testid={`tab-transfer-${tab}`}
                      >
                        {labels[tab]}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/20" : "bg-gray-100 text-gray-400"}`}>
                          {counts[tab]}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    onClick={toggleTransferSound}
                    className={`ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${transferSoundEnabled ? "bg-[#03C75A]/10 text-[#03C75A] border-[#03C75A]/30" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                    title={transferSoundEnabled ? "대체출고 알림 소리 켜짐" : "대체출고 알림 소리 꺼짐"}
                    data-testid="button-toggle-transfer-sound"
                  >
                    {transferSoundEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
                    <span>{transferSoundEnabled ? "알림 ON" : "알림 OFF"}</span>
                  </button>
                </div>
                {/* 검색 + 코드 필터 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="회원명 또는 종목명 검색..."
                      value={transferSearch}
                      onChange={(e) => setTransferSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#03C75A]/30 focus:border-[#03C75A]"
                      data-testid="input-transfer-search"
                    />
                  </div>
                  <Select value={filterTransferManager} onValueChange={(v) => { setFilterTransferManager(v); setSelectedTransferIds(new Set()); }}>
                    <SelectTrigger className="w-[150px] bg-white border-gray-200 text-gray-700 text-sm" data-testid="select-filter-transfer-manager">
                      <SelectValue placeholder="담당자 코드" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">코드 전체</SelectItem>
                      <SelectItem value="none">코드 없음</SelectItem>
                      {allManagerCodes.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterTransferUnionCode} onValueChange={(v) => { setFilterTransferUnionCode(v); setSelectedTransferIds(new Set()); }}>
                    <SelectTrigger className="w-[150px] bg-white border-purple-200 text-purple-700 text-sm" data-testid="select-filter-transfer-union">
                      <SelectValue placeholder="조합코드" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">조합코드 전체</SelectItem>
                      <SelectItem value="none">코드 없음</SelectItem>
                      {allTransferUnionCodes.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* 코드별 전체선택 버튼 */}
                  {filterTransferManager !== "all" && filteredTransfers.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-[#03C75A]/40 text-[#03C75A] hover:bg-[#03C75A]/5 text-xs"
                      onClick={() => {
                        const allIds = filteredTransfers.map((t) => t.id);
                        const allSelected = allIds.every((id) => selectedTransferIds.has(id));
                        if (allSelected) {
                          setSelectedTransferIds(new Set());
                        } else {
                          setSelectedTransferIds(new Set(allIds));
                        }
                      }}
                      data-testid="button-select-all-by-code"
                    >
                      {filteredTransfers.every((t) => selectedTransferIds.has(t.id)) ? "전체 해제" : `코드 전체선택 (${filteredTransfers.length})`}
                    </Button>
                  )}
                  <Badge variant="outline" className="shrink-0 border-gray-200 text-gray-500">{filteredTransfers.length}건</Badge>
                  <Badge variant="outline" className="shrink-0 border-blue-200 text-blue-600 bg-blue-50">총 {filteredTransfers.reduce((sum, t) => sum + t.quantity, 0).toLocaleString()}주</Badge>
                </div>

                {/* 일괄 처리 액션바 */}
                {selectedTransferIds.size > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-[#03C75A]/5 border border-[#03C75A]/20 rounded-lg flex-wrap">
                    <span className="text-sm font-medium text-[#03C75A]">{selectedTransferIds.size}건 선택됨</span>
                    <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                      <Button
                        size="sm"
                        className="bg-green-600 border-green-600 text-xs"
                        onClick={() => bulkUpdateTransferMutation.mutate({ ids: Array.from(selectedTransferIds), status: "approved" })}
                        disabled={bulkUpdateTransferMutation.isPending}
                        data-testid="button-bulk-approve"
                      >일괄 승인</Button>
                      <Button
                        size="sm"
                        className="bg-orange-500 border-orange-500 text-xs"
                        onClick={() => bulkUpdateTransferMutation.mutate({ ids: Array.from(selectedTransferIds), status: "출고대기중" })}
                        disabled={bulkUpdateTransferMutation.isPending}
                        data-testid="button-bulk-outgoing"
                      >일괄 출고대기</Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => bulkUpdateTransferMutation.mutate({ ids: Array.from(selectedTransferIds), status: "held" })}
                        disabled={bulkUpdateTransferMutation.isPending}
                        data-testid="button-bulk-hold"
                      >일괄 보류</Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="text-xs"
                        onClick={() => bulkUpdateTransferMutation.mutate({ ids: Array.from(selectedTransferIds), status: "rejected" })}
                        disabled={bulkUpdateTransferMutation.isPending}
                        data-testid="button-bulk-reject"
                      >일괄 거부</Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs text-gray-500"
                        onClick={() => setSelectedTransferIds(new Set())}
                      >선택 해제</Button>
                    </div>
                  </div>
                )}
              </div>

              {transfersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full bg-gray-200" />)}
                </div>
              ) : filteredTransfers.length === 0 ? (
                <Card className="p-12 text-center bg-white border-gray-200">
                  <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-30 text-gray-400" />
                  <p className="font-medium text-gray-500">{transferSearch ? "검색 결과가 없습니다" : "해당 항목이 없습니다"}</p>
                </Card>
              ) : (
                <>
                <div className="md:hidden space-y-3">
                  {filteredTransfers.map((tr) => (
                    <div key={tr.id} className={`rounded-md border bg-white p-4 space-y-3 ${selectedTransferIds.has(tr.id) ? "border-[#03C75A]/50 bg-[#03C75A]/3" : "border-gray-200"}`} data-testid={`row-transfer-${tr.id}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedTransferIds.has(tr.id)}
                            onChange={(e) => {
                              const next = new Set(selectedTransferIds);
                              e.target.checked ? next.add(tr.id) : next.delete(tr.id);
                              setSelectedTransferIds(next);
                            }}
                            className="w-4 h-4 accent-[#03C75A] cursor-pointer shrink-0"
                            data-testid={`checkbox-transfer-${tr.id}`}
                          />
                          <div className="flex items-center gap-1.5">
                            {tr.status === "pending" && <Badge variant="outline" className="gap-1 border-gray-200 text-gray-500"><Clock className="w-3 h-3" />대기</Badge>}
                            {tr.status === "출고대기중" && <Badge className="gap-1 bg-orange-500 border-orange-500"><Clock className="w-3 h-3" />출고대기중</Badge>}
                            {tr.status === "approved" && <Badge className="gap-1 bg-green-600 border-green-600"><CheckCircle2 className="w-3 h-3" />승인</Badge>}
                            {tr.status === "rejected" && <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />거부</Badge>}
                            {tr.status === "held" && <Badge variant="secondary" className="gap-1"><PauseCircle className="w-3 h-3" />보류</Badge>}
                            {(tr as any).requestType === "입고신청" && <Badge className="gap-1 bg-blue-500 border-blue-500 text-white text-xs">입고</Badge>}
                            {(tr as any).requestType !== "입고신청" && <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600 text-xs">출고</Badge>}
                          </div>
                        </div>
                        <span className="text-xs text-gray-400">
                          {new Date(tr.createdAt).toLocaleDateString("ko-KR")} {new Date(tr.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-700">{getUserName(tr.userId)}</p>
                          {getUserManagerCode(tr.userId) && (
                            <Badge variant="outline" className="border-[#03C75A]/40 text-[#03C75A] bg-[#03C75A]/5 font-mono text-xs">{getUserManagerCode(tr.userId)}</Badge>
                          )}
                          {getUserUnionCode(tr.userId) && (
                            <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 font-mono text-xs">조합: {getUserUnionCode(tr.userId)}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 font-mono font-medium">{getUserPhone(tr.userId)} · <span className="text-gray-500">ID: {getUserUsername(tr.userId)}</span></p>
                        <span className="text-sm text-gray-700 flex items-center gap-1.5">
                          <StockIcon name={tr.stockName} size={18} />{tr.stockName}
                          {tr.category && <Badge variant="outline" className="text-[10px]">{tr.category}</Badge>}
                          · {tr.quantity.toLocaleString()}주
                        </span>
                      </div>
                      {tr.currentPrice > 0 && (
                        <div className="bg-gray-50 rounded p-2 space-y-0.5 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-500">매입단가</span>
                            <span className="font-mono tabular-nums text-gray-600">{tr.purchasePrice.toLocaleString()}원</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-500">현재시세</span>
                            <span className="font-mono tabular-nums font-medium text-gray-700">{tr.currentPrice.toLocaleString()}원</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-gray-500">수익률</span>
                            <span className={`font-mono tabular-nums font-bold ${parseFloat(tr.profitRate) > 0 ? "text-red-500" : parseFloat(tr.profitRate) < 0 ? "text-blue-500" : "text-gray-600"}`}>
                              {parseFloat(tr.profitRate) > 0 ? "+" : ""}{formatPct(parseFloat(tr.profitRate))}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200 text-sm">
                            <span className="text-gray-500 font-medium">평가금액</span>
                            <span className="font-mono tabular-nums font-bold text-gray-800">{tr.totalAmount.toLocaleString()}원</span>
                          </div>
                        </div>
                      )}
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>{tr.accountName} · {tr.brokerName && <span className="text-gray-600">{tr.brokerName} </span>}<span className="font-mono text-gray-400">{tr.accountNumber}</span></p>
                        {(tr as any).approvedAt && (
                          <p className="text-gray-400">처리일시: {new Date((tr as any).approvedAt).toLocaleDateString("ko-KR")} {new Date((tr as any).approvedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</p>
                        )}
                        {tr.adminMemo && <p className="text-gray-400">{tr.adminMemo}</p>}
                      </div>
                      <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-gray-200">
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 border-green-600 text-xs"
                          onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "approved" })}
                          disabled={tr.status === "approved" || updateTransferStatusMutation.isPending}
                          data-testid={`button-approve-${tr.id}`}
                        >
                          승인
                        </Button>
                        <Button
                          size="sm"
                          className="bg-orange-500 border-orange-500 text-xs"
                          onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "출고대기중" })}
                          disabled={tr.status === "출고대기중" || updateTransferStatusMutation.isPending}
                          data-testid={`button-outgoing-${tr.id}`}
                        >
                          출고대기
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="text-xs"
                          onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "rejected" })}
                          disabled={tr.status === "rejected" || updateTransferStatusMutation.isPending}
                          data-testid={`button-reject-${tr.id}`}
                        >
                          거부
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          className="text-xs"
                          onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "held" })}
                          disabled={tr.status === "held" || updateTransferStatusMutation.isPending}
                          data-testid={`button-hold-${tr.id}`}
                        >
                          보류
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-gray-600 border-gray-300 hover:bg-gray-50"
                          onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "pending" })}
                          disabled={tr.status === "pending" || updateTransferStatusMutation.isPending}
                          data-testid={`button-pending-${tr.id}`}
                        >
                          대기로
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-blue-500 border-blue-200 hover:bg-blue-50"
                          onClick={() => { setEditDateTransferId(tr.id); setEditDateValue(new Date(tr.createdAt).toISOString().slice(0, 16)); }}
                          data-testid={`button-edit-date-transfer-${tr.id}`}
                        >
                          날짜수정
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs text-red-500 border-red-200 hover:bg-red-50 ml-auto"
                          onClick={() => { if (confirm("이 출고 신청 내역을 삭제하시겠습니까?")) deleteTransferRequestMutation.mutate(tr.id); }}
                          disabled={deleteTransferRequestMutation.isPending}
                          data-testid={`button-delete-transfer-${tr.id}`}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Card className="hidden md:block p-0 overflow-hidden bg-white border-gray-200">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 border-gray-200">
                          <TableHead className="w-10 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-[#03C75A] cursor-pointer"
                              checked={filteredTransfers.length > 0 && filteredTransfers.every((t) => selectedTransferIds.has(t.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTransferIds(new Set(filteredTransfers.map((t) => t.id)));
                                } else {
                                  setSelectedTransferIds(new Set());
                                }
                              }}
                              data-testid="checkbox-transfer-all"
                            />
                          </TableHead>
                          <TableHead className="text-gray-500">상태</TableHead>
                          <TableHead className="text-gray-500">담당자</TableHead>
                          <TableHead className="text-gray-500">조합코드</TableHead>
                          <TableHead className="text-gray-500">신청 회원</TableHead>
                          <TableHead className="text-gray-500">연락처</TableHead>
                          <TableHead className="text-gray-500">아이디</TableHead>
                          <TableHead className="text-gray-500">종목</TableHead>
                          <TableHead className="text-right text-gray-500">수량</TableHead>
                          <TableHead className="text-right text-gray-500">매입단가</TableHead>
                          <TableHead className="text-right text-gray-500">현재시세</TableHead>
                          <TableHead className="text-right text-gray-500">수익률</TableHead>
                          <TableHead className="text-right text-gray-500">평가금액</TableHead>
                          <TableHead className="text-gray-500">예금주</TableHead>
                          <TableHead className="text-gray-500">계좌번호</TableHead>
                          <TableHead className="text-gray-500">신청일시</TableHead>
                          <TableHead className="text-gray-500">처리일시</TableHead>
                          <TableHead className="text-gray-500">메모</TableHead>
                          <TableHead className="text-center text-gray-500">처리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransfers.map((tr) => (
                          <TableRow key={tr.id} className={`border-gray-200 ${selectedTransferIds.has(tr.id) ? "bg-[#03C75A]/3" : ""}`} data-testid={`row-transfer-${tr.id}`}>
                            <TableCell className="text-center">
                              <input
                                type="checkbox"
                                checked={selectedTransferIds.has(tr.id)}
                                onChange={(e) => {
                                  const next = new Set(selectedTransferIds);
                                  e.target.checked ? next.add(tr.id) : next.delete(tr.id);
                                  setSelectedTransferIds(next);
                                }}
                                className="w-4 h-4 accent-[#03C75A] cursor-pointer"
                                data-testid={`checkbox-transfer-${tr.id}`}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1 flex-wrap">
                                {tr.status === "pending" && <Badge variant="outline" className="gap-1 border-gray-200 text-gray-500"><Clock className="w-3 h-3" />대기</Badge>}
                                {tr.status === "출고대기중" && <Badge className="gap-1 bg-orange-500 border-orange-500"><Clock className="w-3 h-3" />출고대기중</Badge>}
                                {tr.status === "approved" && <Badge className="gap-1 bg-green-600 border-green-600"><CheckCircle2 className="w-3 h-3" />승인</Badge>}
                                {tr.status === "rejected" && <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />거부</Badge>}
                                {tr.status === "held" && <Badge variant="secondary" className="gap-1"><PauseCircle className="w-3 h-3" />보류</Badge>}
                                {(tr as any).requestType === "입고신청" ? (
                                  <Badge className="gap-1 bg-blue-500 border-blue-500 text-white text-xs">입고</Badge>
                                ) : (
                                  <Badge variant="outline" className="gap-1 border-orange-300 text-orange-600 text-xs">출고</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {getUserManagerCode(tr.userId)
                                ? <Badge variant="outline" className="border-[#03C75A]/40 text-[#03C75A] bg-[#03C75A]/5 font-mono text-xs">{getUserManagerCode(tr.userId)}</Badge>
                                : <span className="text-gray-300 text-xs">-</span>}
                            </TableCell>
                            <TableCell>
                              {getUserUnionCode(tr.userId)
                                ? <Badge variant="outline" className="border-purple-300 text-purple-700 bg-purple-50 font-mono text-xs">{getUserUnionCode(tr.userId)}</Badge>
                                : <span className="text-gray-300 text-xs">-</span>}
                            </TableCell>
                            <TableCell className="font-medium text-gray-700">{getUserName(tr.userId)}</TableCell>
                            <TableCell className="font-mono text-sm text-gray-700 font-medium whitespace-nowrap">{getUserPhone(tr.userId)}</TableCell>
                            <TableCell className="font-mono text-xs text-gray-400 whitespace-nowrap">{getUserUsername(tr.userId)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <StockIcon name={tr.stockName} size={22} />
                                <span className="text-gray-700">{tr.stockName}</span>
                                {tr.category && <Badge variant="outline" className="text-[10px]">{tr.category}</Badge>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-gray-700">{tr.quantity.toLocaleString()}주</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-gray-600 text-sm">{tr.purchasePrice > 0 ? `${tr.purchasePrice.toLocaleString()}원` : "-"}</TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-gray-700 text-sm font-medium">{tr.currentPrice > 0 ? `${tr.currentPrice.toLocaleString()}원` : "-"}</TableCell>
                            <TableCell className="text-right">
                              {tr.currentPrice > 0 ? (
                                <span className={`font-mono tabular-nums text-sm font-bold ${parseFloat(tr.profitRate) > 0 ? "text-red-500" : parseFloat(tr.profitRate) < 0 ? "text-blue-500" : "text-gray-600"}`}>
                                  {parseFloat(tr.profitRate) > 0 ? "+" : ""}{formatPct(parseFloat(tr.profitRate))}%
                                </span>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums text-gray-800 font-bold">{tr.totalAmount > 0 ? `${tr.totalAmount.toLocaleString()}원` : "-"}</TableCell>
                            <TableCell className="text-gray-700">{tr.accountName}</TableCell>
                            <TableCell className="text-sm text-gray-700">
                              {tr.brokerName && <span className="text-gray-500 mr-1">{tr.brokerName}</span>}
                              <span className="font-mono">{tr.accountNumber}</span>
                            </TableCell>
                            <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                              {new Date(tr.createdAt).toLocaleDateString("ko-KR")}<br/>
                              <span className="text-gray-300">{new Date(tr.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                            </TableCell>
                            <TableCell className="text-xs text-gray-400 whitespace-nowrap">
                              {(tr as any).approvedAt ? (
                                <>
                                  {new Date((tr as any).approvedAt).toLocaleDateString("ko-KR")}<br/>
                                  <span className="text-gray-300">{new Date((tr as any).approvedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                                </>
                              ) : "-"}
                            </TableCell>
                            <TableCell className="text-sm text-gray-400 max-w-[150px] truncate">
                              {tr.adminMemo || "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1 flex-nowrap">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="bg-green-600 border-green-600 text-xs sm:text-sm px-2 sm:px-3"
                                  onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "approved" })}
                                  disabled={tr.status === "approved" || updateTransferStatusMutation.isPending}
                                  data-testid={`button-approve-${tr.id}`}
                                >
                                  승인
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-orange-500 border-orange-500 text-xs sm:text-sm px-2 sm:px-3"
                                  onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "출고대기중" })}
                                  disabled={tr.status === "출고대기중" || updateTransferStatusMutation.isPending}
                                  data-testid={`button-outgoing-${tr.id}`}
                                >
                                  출고대기
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="text-xs sm:text-sm px-2 sm:px-3"
                                  onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "rejected" })}
                                  disabled={tr.status === "rejected" || updateTransferStatusMutation.isPending}
                                  data-testid={`button-reject-${tr.id}`}
                                >
                                  거부
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  className="text-xs sm:text-sm px-2 sm:px-3"
                                  onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "held" })}
                                  disabled={tr.status === "held" || updateTransferStatusMutation.isPending}
                                  data-testid={`button-hold-${tr.id}`}
                                >
                                  보류
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs sm:text-sm px-2 sm:px-3 text-gray-600 border-gray-300 hover:bg-gray-50"
                                  onClick={() => updateTransferStatusMutation.mutate({ id: tr.id, status: "pending" })}
                                  disabled={tr.status === "pending" || updateTransferStatusMutation.isPending}
                                  data-testid={`button-pending-${tr.id}`}
                                >
                                  대기로
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs sm:text-sm px-2 sm:px-3 text-blue-500 border-blue-200 hover:bg-blue-50"
                                  onClick={() => { setEditDateTransferId(tr.id); setEditDateValue(new Date(tr.createdAt).toISOString().slice(0, 16)); }}
                                  data-testid={`button-edit-date-admin-transfer-${tr.id}`}
                                >
                                  날짜수정
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs sm:text-sm px-2 sm:px-3 text-red-500 border-red-200 hover:bg-red-50"
                                  onClick={() => { if (confirm("이 출고 신청 내역을 삭제하시겠습니까?")) deleteTransferRequestMutation.mutate(tr.id); }}
                                  disabled={deleteTransferRequestMutation.isPending}
                                  data-testid={`button-delete-admin-transfer-${tr.id}`}
                                >
                                  삭제
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
                </>
              )}
            </>
          )}

          {/* 출고 신청 날짜 수정 다이얼로그 */}
          <Dialog open={!!editDateTransferId} onOpenChange={(v) => { if (!v) setEditDateTransferId(null); }}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>신청 날짜 수정</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">신청일시</label>
                  <Input
                    type="datetime-local"
                    value={editDateValue}
                    onChange={(e) => setEditDateValue(e.target.value)}
                    data-testid="input-edit-transfer-date"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" size="sm" onClick={() => setEditDateTransferId(null)}>취소</Button>
                  <Button
                    size="sm"
                    className="bg-[#03C75A] hover:bg-[#02b350]"
                    disabled={updateTransferDateMutation.isPending}
                    onClick={() => {
                      if (editDateTransferId && editDateValue) {
                        const d = new Date(editDateValue);
                        d.setSeconds(Math.floor(Math.random() * 60));
                        updateTransferDateMutation.mutate({ id: editDateTransferId, createdAt: d.toISOString() });
                      }
                    }}
                    data-testid="button-save-transfer-date"
                  >
                    저장
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {activeSection === "stocks" && (
            <>
              <StocksManagementSection
                ipoStocks={ipoStocksData || []}
                isLoading={ipoStocksLoading}
                onCreate={(data: any) => createIpoStockMutation.mutate(data)}
                onUpdate={(data: any) => updateIpoStockMutation.mutate(data)}
                onDelete={(id: string) => deleteIpoStockMutation.mutate(id)}
                isCreating={createIpoStockMutation.isPending}
                isUpdating={updateIpoStockMutation.isPending}
              />
              <PopularIpoManagementSection />
            </>
          )}

          {activeSection === "stockcodes" && <StockCodeManagementSection />}

          {activeSection === "chat" && (
            <>
              <div className="flex items-center gap-3 mb-4 sm:mb-6">
                <MessageSquare className="w-5 h-5 text-[#03C75A]" />
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-gray-900">1:1 고객 상담</h2>
                  <p className="text-xs sm:text-sm text-gray-500">회원 문의에 실시간으로 응답합니다</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 h-[calc(100vh-200px)] sm:h-[calc(100vh-180px)]">
                <Card className={`${selectedChatRoom ? "hidden sm:flex" : "flex"} w-full sm:w-72 sm:shrink-0 p-0 overflow-hidden flex-col bg-white border-gray-200`}>
                  <div className="p-3 border-b border-gray-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900">상담 목록</h3>
                      <p className="text-xs text-gray-500">{(chatRooms || []).length}건</p>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                      <Input
                        className="pl-7 h-7 text-xs bg-gray-50 border-gray-200"
                        placeholder="이름, 아이디, 담당자코드 검색"
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        data-testid="input-chat-search"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
                    {chatRoomsLoading ? (
                      <div className="p-3 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full bg-gray-200" />)}</div>
                    ) : (chatRooms || []).length === 0 ? (
                      <div className="p-8 text-center">
                        <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-gray-400" />
                        <p className="text-sm text-gray-500">상담 내역이 없습니다</p>
                      </div>
                    ) : (() => {
                      const q = chatSearch.trim().toLowerCase();
                      const filtered = (chatRooms || []).filter((room: any) =>
                        !q ||
                        (room.userName || "").toLowerCase().includes(q) ||
                        (room.userUsername || "").toLowerCase().includes(q) ||
                        (room.userManagerCode || "").toLowerCase().includes(q)
                      );
                      return filtered.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm text-gray-500">검색 결과가 없습니다</p>
                        </div>
                      ) : filtered.map((room: any) => (
                        <div
                          key={room.id}
                          className={`px-3 py-3 cursor-pointer hover-elevate ${selectedChatRoom === room.id ? "bg-[#03C75A]/20" : ""}`}
                          onClick={() => setSelectedChatRoom(room.id)}
                          data-testid={`chat-room-${room.id}`}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-[#03C75A]/20 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-[#03C75A]">{(room.userName || "?").charAt(0)}</span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <p className="text-sm font-medium truncate text-gray-700">{room.userName}</p>
                                  {room.userManagerCode && (
                                    <span className="text-[10px] bg-[#03C75A]/10 text-[#03C75A] px-1 py-0.5 rounded font-medium shrink-0">{room.userManagerCode}</span>
                                  )}
                                </div>
                                {room.unreadCount > 0 ? (
                                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shrink-0" data-testid={`badge-room-unread-${room.id}`}>
                                    {room.unreadCount > 99 ? "99+" : room.unreadCount}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-gray-400 shrink-0">
                                    {new Date(room.lastMessageAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric" })}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 truncate">@{room.userUsername}</p>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </Card>
                <Card className={`${!selectedChatRoom ? "hidden sm:flex" : "flex"} flex-1 p-0 overflow-hidden flex-col bg-white border-gray-200`}>
                  {!selectedChatRoom ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-3">
                        <MessageSquare className="w-10 h-10 mx-auto text-gray-400 opacity-30" />
                        <p className="text-sm text-gray-500">채팅방을 선택해주세요</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="p-3 border-b border-gray-200 flex items-center gap-2">
                        <button onClick={() => setSelectedChatRoom(null)} className="sm:hidden p-1 text-gray-500" data-testid="button-chat-back">
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <div className="w-7 h-7 rounded-full bg-[#03C75A]/20 flex items-center justify-center">
                          <span className="text-xs font-bold text-[#03C75A]">
                            {((chatRooms || []).find((r: any) => r.id === selectedChatRoom)?.userName || "?").charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">
                            {(chatRooms || []).find((r: any) => r.id === selectedChatRoom)?.userName || "알 수 없음"}
                          </p>
                          <p className="text-xs text-gray-500">
                            @{(chatRooms || []).find((r: any) => r.id === selectedChatRoom)?.userUsername || ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {chatMessages.filter(m => m.roomId === selectedChatRoom).length === 0 ? (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-sm text-gray-500">메시지가 없습니다</p>
                          </div>
                        ) : (
                          chatMessages.filter(m => m.roomId === selectedChatRoom).map((msg: any) => {
                            const isAdmin = msg.senderRole === "admin";
                            return (
                              <div key={msg.id} className={`flex group ${isAdmin ? "justify-end" : "justify-start"}`} data-testid={`admin-chat-msg-${msg.id}`}>
                                <div className={`max-w-[75%] space-y-1 flex flex-col ${isAdmin ? "items-end" : "items-start"}`}>
                                  <span className="text-xs text-gray-400 px-1">
                                    {isAdmin ? "상담원" : ((chatRooms || []).find((r: any) => r.id === selectedChatRoom)?.userName || "회원")}
                                  </span>
                                  <div className={`flex items-end gap-1.5 ${isAdmin ? "flex-row-reverse" : "flex-row"}`}>
                                    <div className={`rounded-md px-3 py-2 text-sm break-words ${msg.message.startsWith("[img]") ? "p-1" : ""} ${isAdmin ? "bg-[#03C75A] text-white" : "bg-gray-200 text-gray-700"}`}>
                                      {msg.message.startsWith("[img]") ? (
                                        <img src={msg.message.slice(5)} alt="이미지" className="max-w-full max-h-56 rounded cursor-pointer" onClick={() => setViewingImage(msg.message.slice(5))} />
                                      ) : (
                                        <span className="whitespace-pre-wrap">{msg.message}</span>
                                      )}
                                    </div>
                                    {isAdmin && !msg.isReadByMember && <button
                                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-red-500 shrink-0"
                                       onClick={() => { if (window.confirm("읽지 않은 메시지를 회수하시겠습니까?")) deleteChatMessageMutation.mutate(msg.id); }}
                                      disabled={deleteChatMessageMutation.isPending}
                                       title="읽지 않은 메시지 회수"
                                      data-testid={`button-delete-chat-msg-${msg.id}`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>}
                                  </div>
                                  <span className="text-[11px] text-gray-400 px-1">
                                    {new Date(msg.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                     {isAdmin && <span className="ml-2">{msg.isReadByMember ? "읽음" : "읽지 않음"}</span>}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                        <div ref={chatMessagesEndRef} />
                      </div>
                      <div className="shrink-0 border-t border-gray-200 p-3">
                        <div className="flex items-center gap-2">
                          <input
                            ref={adminChatImageRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e: any) => {
                              const file = e.target.files?.[0];
                              if (file) handleChatImageUpload(file);
                            }}
                            data-testid="input-admin-chat-image-file"
                          />
                          <div className="relative">
                           <Button size="sm" variant="outline" onClick={() => setMacroMenuOpen(!macroMenuOpen)} className="shrink-0" title="자주 쓰는 문구">문구</Button>
                           {macroMenuOpen && <div className="absolute bottom-10 left-0 z-20 w-64 max-h-56 overflow-y-auto rounded-md border bg-white p-1 shadow-lg">
                             {(chatMacros as any[]).map((macro: any) => <div key={macro.id} className="flex items-center gap-1 rounded p-1 hover:bg-gray-100">
                               <button className="min-w-0 flex-1 p-1 text-left text-xs truncate" onClick={() => { setChatInput(macro.message); setMacroMenuOpen(false); }}>{macro.title}</button>
                               <button className="p-1 text-gray-400 hover:text-[#03C75A]" onClick={() => { setMacroEditId(macro.id); setMacroTitle(macro.title); setMacroMessage(macro.message); setMacroDialogOpen(true); setMacroMenuOpen(false); }}>수정</button>
                               <button className="p-1 text-gray-400 hover:text-red-500" onClick={() => deleteMacroMutation.mutate(macro.id)}>삭제</button>
                             </div>)}
                             <button className="w-full border-t p-2 text-xs text-[#03C75A]" onClick={() => { setMacroEditId(null); setMacroTitle(""); setMacroMessage(""); setMacroDialogOpen(true); setMacroMenuOpen(false); }}>문구 관리</button>
                           </div>}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => adminChatImageRef.current?.click()}
                            disabled={chatImageUploading || joinedChatRoomId !== selectedChatRoom}
                            className="shrink-0 text-gray-500 hover:text-[#03C75A]"
                            data-testid="button-admin-attach-image"
                            title="이미지 첨부"
                          >
                            {chatImageUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                          </Button>
                          <Textarea
                            value={chatInput}
                            onChange={(e: any) => {
                              setChatInput(e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                            }}
                            onKeyDown={(e: any) => {
                              if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); }
                            }}
                            placeholder="답변을 입력하세요... (Shift+Enter로 줄바꿈)"
                            rows={1}
                            className="resize-none min-h-[40px] py-2 leading-snug bg-white border-gray-200 text-gray-900 placeholder:text-gray-400"
                            style={{ height: "40px", overflowY: "hidden" }}
                            data-testid="input-admin-chat"
                          />
                          <Button
                            size="icon"
                            onClick={handleChatSend}
                            disabled={!chatInput.trim() || joinedChatRoomId !== selectedChatRoom}
                            className="bg-[#03C75A] border-[#03C75A]"
                            data-testid="button-admin-send"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                        </div>
                       <Dialog open={macroDialogOpen} onOpenChange={(open) => {
                         setMacroDialogOpen(open);
                         if (!open) { setMacroEditId(null); setMacroTitle(""); setMacroMessage(""); }
                       }}>
                         <DialogContent>
                           <DialogHeader><DialogTitle>{macroEditId ? "자주 쓰는 문구 수정" : "자주 쓰는 문구 추가"}</DialogTitle></DialogHeader>
                           <Input value={macroTitle} onChange={(e) => setMacroTitle(e.target.value)} placeholder="문구 제목" />
                           <Textarea value={macroMessage} onChange={(e) => setMacroMessage(e.target.value)} placeholder="문구 내용" />
                           <DialogFooter><Button onClick={() => createMacroMutation.mutate()} disabled={!macroTitle.trim() || !macroMessage.trim()}>저장</Button></DialogFooter>
                         </DialogContent>
                       </Dialog>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            </>
          )}


          {activeSection === "logs" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">접속 로그</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-gray-200 text-gray-500">{loginLogsList.length}건</Badge>
                  <Button size="sm" variant="outline" className="border-gray-200 text-gray-600" onClick={() => refetchLoginLogs()} data-testid="button-refresh-logs">
                    새로고침
                  </Button>
                </div>
              </div>
              <Card className="p-4 bg-white border-gray-200">
                <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      placeholder="아이디, 회원이름, IP, 도메인 검색..."
                      value={logSearchFilter}
                      onChange={(e) => { setLogSearchFilter(e.target.value); setLogPage(1); }}
                      className="pl-9 bg-white border-gray-200"
                      data-testid="input-log-search"
                    />
                  </div>
                </div>
                {(() => {
                  const filtered = loginLogsList.filter((log) => {
                    if (!logSearchFilter.trim()) return true;
                    const q = logSearchFilter.toLowerCase();
                    const u = users.find((u) => u.id === log.userId);
                    return (
                      (u?.username || "").toLowerCase().includes(q) ||
                      (u?.fullName || "").toLowerCase().includes(q) ||
                      (log.ipAddress || "").includes(q) ||
                      (log.domain || "").toLowerCase().includes(q)
                    );
                  });
                  const totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
                  const page = Math.min(logPage, totalPages);
                  const paged = filtered.slice((page - 1) * LOG_PAGE_SIZE, page * LOG_PAGE_SIZE);

                  if (loginLogsList.length === 0) return (
                    <div className="text-center py-10 text-gray-400">
                      <Activity className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">접속 기록이 없습니다</p>
                      <p className="text-xs mt-1">회원이 로그인하면 자동으로 기록됩니다</p>
                    </div>
                  );

                  return (
                    <>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50 border-gray-200">
                              <TableHead className="text-gray-500">로그인 시간</TableHead>
                              <TableHead className="text-gray-500">아이디</TableHead>
                              <TableHead className="text-gray-500">IP 주소</TableHead>
                              <TableHead className="text-gray-500">접속 도메인</TableHead>
                              <TableHead className="text-gray-500">브라우저/OS</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paged.map((log) => {
                              const u = users.find((u) => u.id === log.userId);
                              const ua = log.userAgent || "";
                              const browser = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : ua.includes("Edge") ? "Edge" : "기타";
                              const os = ua.includes("Windows") ? "Windows" : ua.includes("Mac") ? "Mac" : ua.includes("iPhone") || ua.includes("iPad") ? "iOS" : ua.includes("Android") ? "Android" : "기타";
                              return (
                                <TableRow key={log.id} className="border-gray-200" data-testid={`log-row-${log.id}`}>
                                  <TableCell className="text-xs text-gray-600 whitespace-nowrap">
                                    {new Date(log.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                                  </TableCell>
                                  <TableCell>
                                    <span className="font-medium text-sm text-gray-800">{u?.username || log.userId}</span>
                                    {u?.fullName && <span className="text-xs text-gray-400 ml-1">({u.fullName})</span>}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-gray-600">{log.ipAddress || "-"}</TableCell>
                                  <TableCell className="text-xs">
                                    {log.domain ? (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">
                                        <Globe className="w-3 h-3" />
                                        {log.domain}
                                      </span>
                                    ) : "-"}
                                  </TableCell>
                                  <TableCell className="text-xs text-gray-500">
                                    <span className="inline-flex gap-1">
                                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{browser}</span>
                                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{os}</span>
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-400">
                            전체 {filtered.length}건 · {page}/{totalPages} 페이지
                          </span>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-gray-200" onClick={() => setLogPage(1)} disabled={page === 1}>처음</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-gray-200" onClick={() => setLogPage((p) => Math.max(1, p - 1))} disabled={page === 1}>이전</Button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                              const n = start + i;
                              return n <= totalPages ? (
                                <Button key={n} size="sm" variant={n === page ? "default" : "outline"} className={`h-7 w-7 p-0 text-xs ${n === page ? "bg-[#03C75A] border-[#03C75A]" : "border-gray-200"}`} onClick={() => setLogPage(n)}>{n}</Button>
                              ) : null;
                            })}
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-gray-200" onClick={() => setLogPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>다음</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-gray-200" onClick={() => setLogPage(totalPages)} disabled={page === totalPages}>마지막</Button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </Card>
            </>
          )}

          {activeSection === "groups" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">도메인 그룹 관리</h2>
                <Badge variant="outline" className="border-gray-200 text-gray-500">{domainGroupsList.length}개 등록</Badge>
              </div>
              <Card className="p-5 bg-white border-gray-200">
                <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <Activity className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-700">도메인에 <strong>담당자 코드</strong>를 설정하면, 해당 도메인으로 가입한 회원이 <strong>승인될 때 자동으로</strong> 해당 코드가 배정됩니다.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
                  <Input
                    placeholder="도메인 (예: abc.com)"
                    value={newGroupDomain}
                    onChange={(e) => setNewGroupDomain(e.target.value)}
                    className="bg-white border-gray-200"
                    data-testid="input-new-domain"
                  />
                  <Input
                    placeholder="그룹명 (예: A팀)"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="bg-white border-gray-200"
                    data-testid="input-new-group-name"
                  />
                  <Input
                    placeholder="담당자 코드 (선택)"
                    value={newGroupManagerCode}
                    onChange={(e) => setNewGroupManagerCode(e.target.value)}
                    className="bg-white border-gray-200"
                    data-testid="input-new-manager-code"
                  />
                  <Button
                    onClick={async () => {
                      if (!newGroupDomain.trim() || !newGroupName.trim()) {
                        toast({ title: "입력 오류", description: "도메인과 그룹명을 모두 입력해주세요", variant: "destructive" });
                        return;
                      }
                      await apiRequest("PUT", `/api/admin/domain-groups/${encodeURIComponent(newGroupDomain.trim())}`, { groupName: newGroupName.trim(), managerCode: newGroupManagerCode.trim() || null });
                      setNewGroupDomain(""); setNewGroupName(""); setNewGroupManagerCode("");
                      refetchDomainGroups();
                      toast({ title: "저장 완료", description: "도메인 그룹이 저장되었습니다" });
                    }}
                    className="bg-[#03C75A] border-[#03C75A] text-white"
                    data-testid="button-add-domain-group"
                  >
                    <Plus className="w-4 h-4 mr-1" /> 추가
                  </Button>
                </div>
                {domainGroupsList.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <Globe className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">등록된 도메인 그룹이 없습니다</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 border-gray-200">
                        <TableHead className="text-gray-500">도메인</TableHead>
                        <TableHead className="text-gray-500">그룹명</TableHead>
                        <TableHead className="text-gray-500">담당자 코드</TableHead>
                        <TableHead className="text-gray-500">해당 회원 수</TableHead>
                        <TableHead className="text-center text-gray-500">삭제</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...domainGroupsList].sort((a, b) => a.groupName.localeCompare(b.groupName, "ko")).map((g) => (
                        <TableRow key={g.domain} className="border-gray-200">
                          <TableCell className="font-mono text-sm text-gray-700">{g.domain}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium">
                              {g.groupName}
                            </span>
                          </TableCell>
                          <TableCell>
                            {g.managerCode ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 text-sm font-mono font-medium">
                                {g.managerCode}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">미설정</span>
                            )}
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {users.filter((u) => u.siteGroup === g.domain).length}명
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="icon" variant="ghost"
                              onClick={async () => {
                                await apiRequest("DELETE", `/api/admin/domain-groups/${encodeURIComponent(g.domain)}`);
                                refetchDomainGroups();
                                toast({ title: "삭제 완료" });
                              }}
                              data-testid={`button-delete-group-${g.domain}`}
                            >
                              <Trash2 className="w-4 h-4 text-gray-400" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>

              <Card className="p-5 bg-white border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700">담당자 코드 일괄 적용</h3>
                  <span className="text-xs text-gray-400">여러 도메인에 같은 코드를 한번에 적용</span>
                </div>
                <div className="flex gap-2 mb-3">
                  <Input
                    placeholder="적용할 담당자 코드"
                    value={bulkCode}
                    onChange={(e) => setBulkCode(e.target.value)}
                    className="max-w-[200px] bg-white border-gray-200"
                    data-testid="input-bulk-code"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-gray-200"
                    onClick={() => setBulkSelectedDomains(domainGroupsList.map((g) => g.domain))}
                    data-testid="button-select-all-domains"
                  >전체 선택</Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-gray-200"
                    onClick={() => setBulkSelectedDomains([])}
                    data-testid="button-deselect-all-domains"
                  >전체 해제</Button>
                  <Button
                    size="sm"
                    className="bg-[#03C75A] text-white text-xs"
                    disabled={bulkSelectedDomains.length === 0 || !bulkCode.trim()}
                    onClick={async () => {
                      if (!bulkCode.trim() || bulkSelectedDomains.length === 0) return;
                      await Promise.all(
                        bulkSelectedDomains.map((domain) => {
                          const existing = domainGroupsList.find((g) => g.domain === domain);
                          return apiRequest("PUT", `/api/admin/domain-groups/${encodeURIComponent(domain)}`, {
                            groupName: existing?.groupName ?? domain,
                            managerCode: bulkCode.trim(),
                          });
                        })
                      );
                      refetchDomainGroups();
                      setBulkSelectedDomains([]);
                      setBulkCode("");
                      toast({ title: "일괄 적용 완료", description: `${bulkSelectedDomains.length}개 도메인에 코드가 적용됐습니다` });
                    }}
                    data-testid="button-bulk-apply-code"
                  >
                    선택 도메인에 적용
                  </Button>
                </div>
                {domainGroupsList.length === 0 ? (
                  <p className="text-sm text-gray-400">먼저 도메인 그룹을 등록해주세요</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {domainGroupsList.map((g) => {
                      const selected = bulkSelectedDomains.includes(g.domain);
                      return (
                        <button
                          key={g.domain}
                          onClick={() => setBulkSelectedDomains((prev) =>
                            selected ? prev.filter((d) => d !== g.domain) : [...prev, g.domain]
                          )}
                          data-testid={`button-bulk-select-${g.domain}`}
                          className={`px-3 py-1.5 rounded-md border text-xs font-mono transition-all ${
                            selected
                              ? "bg-[#03C75A] border-[#03C75A] text-white"
                              : "bg-white border-gray-200 text-gray-600 hover:border-[#03C75A] hover:text-[#03C75A]"
                          }`}
                        >
                          {g.domain}
                          {g.managerCode && (
                            <span className={`ml-1.5 ${selected ? "text-red-200" : "text-orange-400"}`}>
                              ({g.managerCode})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card className="p-5 bg-white border-gray-200">
                <h3 className="text-sm font-bold text-gray-700 mb-3">도메인별 가입 현황</h3>
                {uniqueSiteGroups.length === 0 ? (
                  <p className="text-sm text-gray-400">아직 도메인 기록이 없습니다. 회원이 가입하면 자동으로 기록됩니다.</p>
                ) : (
                  <div className="space-y-1">
                    {[...uniqueSiteGroups, null].map((g) => {
                      const domainUsers = g
                        ? users.filter((u) => u.siteGroup === g)
                        : users.filter((u) => !u.siteGroup);
                      const label = g ? g : "미분류 (도메인 없음)";
                      const groupName = g ? getGroupLabel(g) : null;
                      const managerCode = g ? domainGroupsList.find((d) => d.domain === g)?.managerCode : null;
                      return (
                        <details key={g ?? "__none__"} className="group border border-gray-100 rounded-md overflow-hidden">
                          <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none hover:bg-gray-50 list-none">
                            <div className="flex items-center gap-2">
                              <Globe className="w-4 h-4 text-blue-400 shrink-0" />
                              <span className="font-mono text-sm text-gray-700">{label}</span>
                              {groupName && groupName !== g && (
                                <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">{groupName}</Badge>
                              )}
                              {managerCode && (
                                <Badge className="bg-orange-50 text-orange-700 border border-orange-200 text-[11px]">{managerCode}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-gray-200 text-gray-500">{domainUsers.length}명</Badge>
                              <ChevronRight className="w-4 h-4 text-gray-400 group-open:rotate-90 transition-transform" />
                            </div>
                          </summary>
                          {domainUsers.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-400 bg-gray-50">해당 도메인으로 가입한 회원이 없습니다</div>
                          ) : (
                            <div className="border-t border-gray-100 divide-y divide-gray-50">
                              {domainUsers.map((u) => (
                                <div key={u.id} className="flex items-center justify-between px-4 py-2 bg-gray-50 hover:bg-gray-100">
                                  <div className="flex items-center gap-3">
                                    <div>
                                      <span className="text-sm font-medium text-gray-800">{u.username}</span>
                                      {u.fullName && <span className="text-xs text-gray-400 ml-1">({u.fullName})</span>}
                                    </div>
                                    {u.managerCode && (
                                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">{u.managerCode}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {u.isApproved ? (
                                      <Badge className="bg-green-50 text-green-700 border border-green-200 text-[11px]">승인</Badge>
                                    ) : (
                                      <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200 text-[11px]">대기</Badge>
                                    )}
                                    {u.isFrozen && <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px]">동결</Badge>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </details>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          )}
          {activeSection === "member-transfers" && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-800">주식 이전 관리</h2>
                  {pendingMemberTransferCount > 0 && (
                    <Badge className="bg-[#03C75A] text-white border-[#03C75A]">{pendingMemberTransferCount}건 대기</Badge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {(["all", "pending", "approved", "rejected"] as const).map((tab) => {
                  const labels: Record<string, string> = { all: "전체", pending: "대기", approved: "승인", rejected: "거부" };
                  const counts: Record<string, number> = {
                    all: allMemberTransfers.length,
                    pending: allMemberTransfers.filter(t => t.status === "pending").length,
                    approved: allMemberTransfers.filter(t => t.status === "approved").length,
                    rejected: allMemberTransfers.filter(t => t.status === "rejected").length,
                  };
                  const active = memberTransferTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setMemberTransferTab(tab)}
                      className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${active ? "bg-[#03C75A] text-white border-[#03C75A]" : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"}`}
                      data-testid={`tab-member-transfer-${tab}`}
                    >
                      {labels[tab]}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/20" : "bg-gray-100 text-gray-400"}`}>
                        {counts[tab]}
                      </span>
                    </button>
                  );
                })}
                <div className="ml-auto relative min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="보내는 회원 또는 종목명..."
                    value={memberTransferSearch}
                    onChange={(e) => setMemberTransferSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#03C75A]/30 focus:border-[#03C75A]"
                    data-testid="input-member-transfer-search"
                  />
                </div>
              </div>

              {memberTransfersLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Card key={i} className="p-4 bg-white"><Skeleton className="h-12 w-full" /></Card>)}</div>
              ) : (() => {
                const filtered = allMemberTransfers.filter(t => {
                  if (memberTransferTab !== "all" && t.status !== memberTransferTab) return false;
                  if (memberTransferSearch) {
                    const q = memberTransferSearch.toLowerCase();
                    const fromUser = (allUsers || []).find(u => u.id === t.fromUserId);
                    const fromName = (fromUser?.fullName || fromUser?.username || "").toLowerCase();
                    if (!fromName.includes(q) && !t.toUsername.toLowerCase().includes(q) && !t.stockName.toLowerCase().includes(q)) return false;
                  }
                  return true;
                });
                if (filtered.length === 0) return (
                  <Card className="p-12 text-center bg-white border-gray-200">
                    <Send className="w-10 h-10 mx-auto mb-3 opacity-20 text-gray-400" />
                    <p className="font-medium text-gray-500">이전 신청 내역이 없습니다</p>
                  </Card>
                );
                return (
                  <div className="space-y-3">
                    {filtered.map((t) => {
                      const fromUser = (allUsers || []).find(u => u.id === t.fromUserId);
                      const fromName = fromUser?.fullName || fromUser?.username || t.fromUserId;
                      const memo = memberTransferAdminMemo[t.id] ?? (t.adminMemo || "");
                      const statusLabel: Record<string, string> = { pending: "대기중", approved: "승인", rejected: "거부" };
                      const statusColor: Record<string, string> = { pending: "bg-yellow-100 text-yellow-700 border-yellow-200", approved: "bg-green-100 text-green-700 border-green-200", rejected: "bg-red-100 text-red-700 border-red-200" };
                      return (
                        <Card key={t.id} className="p-4 bg-white border-gray-200" data-testid={`card-member-transfer-${t.id}`}>
                          <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <StockIcon name={t.stockName} size={20} />
                                <span className="font-semibold text-sm">{t.stockName}</span>
                                <span className="text-sm font-mono text-gray-700">{t.quantity.toLocaleString()}주</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColor[t.status] || "bg-gray-100 text-gray-500 border-gray-200"}`}>
                                  {statusLabel[t.status] || t.status}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                                <span>보내는 회원: <span className="font-medium text-gray-900">{fromName}</span>{fromUser?.username ? ` (${fromUser.username})` : ""}</span>
                                <span className="flex items-center gap-1"><Send className="w-3 h-3" /> 받는 회원: <span className="font-medium text-gray-900">{t.toUsername}</span></span>
                              </div>
                              <div className="text-xs text-gray-400">{new Date(t.createdAt).toLocaleString("ko-KR")}</div>
                              {t.adminMemo && t.status !== "pending" && (
                                <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1.5">메모: {t.adminMemo}</div>
                              )}
                            </div>
                            {t.status === "pending" && (
                              <div className="flex flex-col gap-2 sm:w-56">
                                <Input
                                  placeholder="관리자 메모 (선택)"
                                  value={memo}
                                  onChange={(e) => setMemberTransferAdminMemo(prev => ({ ...prev, [t.id]: e.target.value }))}
                                  className="text-xs h-8 bg-white border-gray-200"
                                  data-testid={`input-member-transfer-memo-${t.id}`}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs h-8"
                                    disabled={approveMemberTransferMutation.isPending}
                                    onClick={() => approveMemberTransferMutation.mutate({ id: t.id, status: "approved", adminMemo: memo || undefined })}
                                    data-testid={`button-approve-member-transfer-${t.id}`}
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />승인
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-red-300 text-red-600 hover:bg-red-50 text-xs h-8"
                                    disabled={approveMemberTransferMutation.isPending}
                                    onClick={() => approveMemberTransferMutation.mutate({ id: t.id, status: "rejected", adminMemo: memo || undefined })}
                                    data-testid={`button-reject-member-transfer-${t.id}`}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />거부
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {activeSection === "withdraw-requests" && (
            <>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold text-gray-800">출금신청 관리</h2>
                <Badge variant="outline" className="border-gray-200 text-gray-500">
                  {allWithdrawRequests.length}건 · 대기 {allWithdrawRequests.filter(r => r.status === "pending").length}건
                </Badge>
              </div>

              {/* 탭 */}
              <div className="flex gap-2 flex-wrap">
                {(["all", "pending", "approved", "rejected"] as const).map((tab) => {
                  const counts: Record<string, number> = {
                    all: allWithdrawRequests.length,
                    pending: allWithdrawRequests.filter(r => r.status === "pending").length,
                    approved: allWithdrawRequests.filter(r => r.status === "approved").length,
                    rejected: allWithdrawRequests.filter(r => r.status === "rejected").length,
                  };
                  const labels: Record<string, string> = { all: "전체", pending: "진행중", approved: "승인", rejected: "거부" };
                  return (
                    <Button
                      key={tab}
                      variant={withdrawTab === tab ? "default" : "outline"}
                      size="sm"
                      onClick={() => setWithdrawTab(tab)}
                      className={withdrawTab === tab ? "bg-[#03C75A] border-[#03C75A]" : "border-gray-200 text-gray-600"}
                    >
                      {labels[tab]} ({counts[tab]})
                    </Button>
                  );
                })}
              </div>

              {/* 검색 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="아이디 또는 예금주 검색..."
                  value={withdrawSearch}
                  onChange={(e) => setWithdrawSearch(e.target.value)}
                  className="pl-9 bg-white border-gray-200"
                />
              </div>

              {withdrawRequestsLoading ? (
                <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
              ) : (() => {
                const users = allWithdrawRequests;
                const filtered = users.filter(r => {
                  if (withdrawTab !== "all" && r.status !== withdrawTab) return false;
                  if (withdrawSearch.trim()) {
                    const s = withdrawSearch.trim().toLowerCase();
                    const u = allUsers?.find(u => u.id === r.userId);
                    if (!(u?.username.toLowerCase().includes(s) || r.accountName.toLowerCase().includes(s) || r.accountNumber.includes(s))) return false;
                  }
                  return true;
                });
                if (filtered.length === 0) {
                  return (
                    <Card className="p-12 text-center bg-white border-gray-200">
                      <Banknote className="w-10 h-10 mx-auto mb-3 opacity-20 text-gray-400" />
                      <p className="font-medium text-gray-500">출금신청 내역이 없습니다</p>
                    </Card>
                  );
                }
                return (
                  <div className="space-y-3">
                    {filtered.map((r) => {
                      const u = allUsers?.find(u => u.id === r.userId);
                      const memo = withdrawAdminMemo[r.id] ?? r.adminMemo ?? "";
                      return (
                        <Card key={r.id} className="p-4 bg-white border-gray-200" data-testid={`withdraw-item-${r.id}`}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-bold tabular-nums text-lg">{r.amount.toLocaleString()}원</span>
                                {r.status === "pending" && <Badge variant="outline" className="gap-1 text-xs"><Clock className="w-3 h-3" />진행중</Badge>}
                                {r.status === "approved" && <Badge className="gap-1 text-xs bg-green-600 border-green-600"><CheckCircle2 className="w-3 h-3" />승인</Badge>}
                                {r.status === "rejected" && <Badge variant="destructive" className="gap-1 text-xs"><XCircle className="w-3 h-3" />거부</Badge>}
                              </div>
                              <p className="text-sm text-gray-600">{r.bank} {r.accountNumber} ({r.accountName})</p>
                              <p className="text-xs text-gray-400">
                                {u ? `@${u.username} · ${u.fullName}` : r.userId}
                                {" · "}{new Date(r.createdAt).toLocaleString("ko-KR")}
                              </p>
                            </div>
                            {r.status === "pending" && (
                              <div className="flex flex-col gap-2 w-full sm:w-auto">
                                <Input
                                  placeholder="관리자 메모 (선택)"
                                  value={memo}
                                  onChange={(e) => setWithdrawAdminMemo(prev => ({ ...prev, [r.id]: e.target.value }))}
                                  className="text-xs h-8 bg-white border-gray-200"
                                  data-testid={`input-withdraw-memo-${r.id}`}
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-[#03C75A] border-[#03C75A] hover:bg-[#02b350] text-white text-xs"
                                    onClick={() => approveWithdrawMutation.mutate({ id: r.id, status: "approved", adminMemo: memo || undefined })}
                                    disabled={approveWithdrawMutation.isPending}
                                    data-testid={`button-approve-withdraw-${r.id}`}
                                  >
                                    <CheckCircle2 className="w-3 h-3 mr-1" />승인
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 text-xs"
                                    onClick={() => approveWithdrawMutation.mutate({ id: r.id, status: "rejected", adminMemo: memo || undefined })}
                                    disabled={approveWithdrawMutation.isPending}
                                    data-testid={`button-reject-withdraw-${r.id}`}
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />거부
                                  </Button>
                                </div>
                              </div>
                            )}
                            {r.status !== "pending" && r.adminMemo && (
                              <p className="text-xs text-gray-400 bg-gray-50 rounded p-2 w-full">메모: {r.adminMemo}</p>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                );
              })()}
            </>
          )}

          {activeSection === "unioncodes" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">조합코드 관리</h2>
                <Badge variant="outline" className="border-gray-200 text-gray-500">{unionCodesList.length}개</Badge>
              </div>

              <Card className="p-5 bg-white border-gray-200">
                <p className="text-sm text-gray-500 mb-3">회원가입 시 입력하는 조합코드를 관리합니다. 활성 상태인 코드만 가입에 사용 가능합니다.</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Input
                    placeholder="코드 (예: 0304)"
                    value={newUnionCode}
                    onChange={(e) => setNewUnionCode(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newUnionCode.trim() && addUnionCodeMutation.mutate()}
                    className="bg-white border-gray-200 font-mono"
                    data-testid="input-union-code-new"
                  />
                  <Input
                    placeholder="설명 (예: 1차 조합)"
                    value={newUnionLabel}
                    onChange={(e) => setNewUnionLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newUnionCode.trim() && addUnionCodeMutation.mutate()}
                    className="bg-white border-gray-200 md:col-span-2"
                    data-testid="input-union-label-new"
                  />
                  <Button
                    onClick={() => addUnionCodeMutation.mutate()}
                    disabled={!newUnionCode.trim() || addUnionCodeMutation.isPending}
                    className="bg-[#03C75A] hover:bg-[#02b350] text-white"
                    data-testid="button-add-union-code"
                  >
                    {addUnionCodeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />코드 추가</>}
                  </Button>
                </div>
              </Card>

              {unionCodesList.length === 0 ? (
                <Card className="p-12 text-center bg-white border-gray-200">
                  <Shield className="w-10 h-10 mx-auto mb-3 opacity-20 text-gray-400" />
                  <p className="font-medium text-gray-500">등록된 조합코드가 없습니다</p>
                  <p className="text-xs text-gray-400 mt-1">위 폼에서 코드를 추가하세요</p>
                </Card>
              ) : (
                <Card className="p-0 overflow-hidden bg-white border-gray-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50 border-gray-200">
                        <TableHead className="text-gray-500">코드</TableHead>
                        <TableHead className="text-gray-500">설명</TableHead>
                        <TableHead className="text-center text-gray-500">상태</TableHead>
                        <TableHead className="text-gray-500">등록일</TableHead>
                        <TableHead className="text-center text-gray-500">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unionCodesList.map((item) => (
                        <TableRow key={item.id} className="border-gray-200" data-testid={`row-union-code-${item.id}`}>
                          {editingUnionCode?.id === item.id ? (
                            <>
                              <TableCell>
                                <Input value={editUnionCodeVal} onChange={(e) => setEditUnionCodeVal(e.target.value)} className="font-mono h-8 text-sm" />
                              </TableCell>
                              <TableCell>
                                <Input value={editUnionLabelVal} onChange={(e) => setEditUnionLabelVal(e.target.value)} className="h-8 text-sm" />
                              </TableCell>
                              <TableCell className="text-center">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className={editingUnionCode.isActive ? "border-green-300 text-green-700" : "border-gray-300 text-gray-500"}
                                  onClick={() => setEditingUnionCode({ ...editingUnionCode, isActive: !editingUnionCode.isActive })}
                                >
                                  {editingUnionCode.isActive ? "활성" : "비활성"}
                                </Button>
                              </TableCell>
                              <TableCell className="text-xs text-gray-400">{new Date(item.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button size="sm" className="bg-[#03C75A] hover:bg-[#02b350] text-white h-7 px-2 text-xs"
                                    onClick={() => updateUnionCodeMutation.mutate({ id: item.id, code: editUnionCodeVal, label: editUnionLabelVal, isActive: editingUnionCode.isActive })}
                                    disabled={updateUnionCodeMutation.isPending}
                                  >저장</Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => setEditingUnionCode(null)}>취소</Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="font-mono font-bold text-gray-800">{item.code}</TableCell>
                              <TableCell className="text-gray-600 text-sm">{item.label || "-"}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={item.isActive ? "bg-green-100 text-green-700 border-green-200" : "bg-gray-100 text-gray-500 border-gray-200"} variant="outline">
                                  {item.isActive ? "활성" : "비활성"}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-gray-400 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex gap-1 justify-center">
                                  <Button size="sm" variant="outline" className="border-gray-200 h-7 px-2 text-xs"
                                    onClick={() => { setEditingUnionCode(item); setEditUnionCodeVal(item.code); setEditUnionLabelVal(item.label); }}
                                    data-testid={`button-edit-union-${item.id}`}
                                  ><Pencil className="w-3 h-3" /></Button>
                                  <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 h-7 px-2 text-xs"
                                    onClick={() => deleteUnionCodeMutation.mutate(item.id)}
                                    disabled={deleteUnionCodeMutation.isPending}
                                    data-testid={`button-delete-union-${item.id}`}
                                  ><Trash2 className="w-3 h-3" /></Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </>
          )}

          {activeSection === "ipblock" && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-800">IP 차단 관리</h2>
                <Badge variant="outline" className="border-gray-200 text-gray-500">{blockedIpsList.length}개 차단 중</Badge>
              </div>

              <Card className="p-5 bg-white border-gray-200">
                <div className="flex items-start gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <Shield className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">차단된 IP는 로그인을 포함한 모든 API 요청이 차단됩니다. IPv4/IPv6 형식 모두 지원합니다.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <Input
                    placeholder="IP 주소 (예: 192.168.1.1)"
                    value={newBlockIp}
                    onChange={(e) => setNewBlockIp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newBlockIp.trim() && addBlockedIpMutation.mutate()}
                    className="bg-white border-gray-200 md:col-span-2"
                    data-testid="input-block-ip"
                  />
                  <Input
                    placeholder="차단 사유 (선택)"
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newBlockIp.trim() && addBlockedIpMutation.mutate()}
                    className="bg-white border-gray-200"
                    data-testid="input-block-reason"
                  />
                  <Button
                    onClick={() => addBlockedIpMutation.mutate()}
                    disabled={!newBlockIp.trim() || addBlockedIpMutation.isPending}
                    className="bg-[#03C75A] hover:bg-[#c92b42] text-white"
                    data-testid="button-add-block-ip"
                  >
                    {addBlockedIpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Ban className="w-4 h-4 mr-1" />차단 추가</>}
                  </Button>
                </div>
              </Card>

              {blockedIpsList.length === 0 ? (
                <Card className="p-12 text-center bg-white border-gray-200">
                  <Ban className="w-10 h-10 mx-auto mb-3 opacity-20 text-gray-400" />
                  <p className="font-medium text-gray-500">차단된 IP가 없습니다</p>
                  <p className="text-xs text-gray-400 mt-1">위 폼에서 IP를 추가하면 즉시 차단됩니다</p>
                </Card>
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {blockedIpsList.map((item) => (
                      <div key={item.id} className="rounded-md border border-gray-200 bg-white p-4 flex items-center justify-between gap-3" data-testid={`row-blocked-ip-${item.id}`}>
                        <div>
                          <p className="font-mono text-sm font-semibold text-gray-800">{item.ip}</p>
                          {item.reason && <p className="text-xs text-gray-500 mt-0.5">{item.reason}</p>}
                          <p className="text-xs text-gray-400 mt-0.5">{new Date(item.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</p>
                        </div>
                        <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50 shrink-0"
                          onClick={() => removeBlockedIpMutation.mutate(item.id)}
                          disabled={removeBlockedIpMutation.isPending}
                          data-testid={`button-unblock-${item.id}`}
                        >차단 해제</Button>
                      </div>
                    ))}
                  </div>
                  <Card className="hidden md:block p-0 overflow-hidden bg-white border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 border-gray-200">
                          <TableHead className="text-gray-500">IP 주소</TableHead>
                          <TableHead className="text-gray-500">차단 사유</TableHead>
                          <TableHead className="text-gray-500">차단 일시</TableHead>
                          <TableHead className="text-center text-gray-500">관리</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {blockedIpsList.map((item) => (
                          <TableRow key={item.id} className="border-gray-200" data-testid={`row-blocked-ip-${item.id}`}>
                            <TableCell className="font-mono font-semibold text-gray-800">{item.ip}</TableCell>
                            <TableCell className="text-gray-500 text-sm">{item.reason || "-"}</TableCell>
                            <TableCell className="text-xs text-gray-500 whitespace-nowrap">
                              {new Date(item.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button size="sm" variant="outline" className="border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => removeBlockedIpMutation.mutate(item.id)}
                                disabled={removeBlockedIpMutation.isPending}
                                data-testid={`button-unblock-${item.id}`}
                              >차단 해제</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </Card>
                </>
              )}
            </>
          )}

          {activeSection === "domainlinks" && (
            <>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold text-gray-800">도메인 안내 관리</h2>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-gray-200 text-gray-500">{domainLinksList.length}개 등록</Badge>
                  <a href="/link" target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="gap-1.5 text-[#03C75A] border-[#03C75A] hover:bg-[#03C75A]/5">
                      <ExternalLink className="w-3.5 h-3.5" />안내 페이지 열기
                    </Button>
                  </a>
                </div>
              </div>

              <Card className="p-5 bg-white border-gray-200">
                <div className="flex items-start gap-2 mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <Globe className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-blue-700">
                    등록된 도메인은 <strong>/link</strong> 페이지에 공개됩니다. 회원들에게 이 주소를 즐겨찾기로 안내하세요.
                    도메인이 차단되면 여기서 새 주소를 추가하면 바로 반영됩니다.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    placeholder="도메인 주소 (예: https://example.com)"
                    value={newDomainUrl}
                    onChange={(e) => setNewDomainUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newDomainUrl.trim() && addDomainLinkMutation.mutate()}
                    className="bg-white border-gray-200 md:col-span-1"
                    data-testid="input-new-domain-url"
                  />
                  <Input
                    placeholder="표시 이름 (예: 메인 사이트)"
                    value={newDomainLabel}
                    onChange={(e) => setNewDomainLabel(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && newDomainUrl.trim() && addDomainLinkMutation.mutate()}
                    className="bg-white border-gray-200"
                    data-testid="input-new-domain-label"
                  />
                  <Button
                    onClick={() => addDomainLinkMutation.mutate()}
                    disabled={!newDomainUrl.trim() || addDomainLinkMutation.isPending}
                    className="bg-[#03C75A] hover:bg-[#02a84a] text-white"
                    data-testid="button-add-domain-link"
                  >
                    {addDomainLinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />도메인 추가</>}
                  </Button>
                </div>
              </Card>

              {domainLinksList.length === 0 ? (
                <Card className="p-12 text-center bg-white border-gray-200">
                  <Globe className="w-10 h-10 mx-auto mb-3 opacity-20 text-gray-400" />
                  <p className="font-medium text-gray-500">등록된 도메인이 없습니다</p>
                  <p className="text-xs text-gray-400 mt-1">위 폼에서 도메인을 추가하면 /link 페이지에 즉시 표시됩니다</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {[...domainLinksList].sort((a, b) => a.priority - b.priority).map((item) => (
                    <Card key={item.id} className={`p-4 bg-white border-gray-200 ${!item.isActive ? "opacity-50" : ""}`} data-testid={`row-domain-link-${item.id}`}>
                      {editingDomainLink?.id === item.id ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <Input
                            value={editDomainUrl}
                            onChange={(e) => setEditDomainUrl(e.target.value)}
                            className="flex-1 min-w-[200px] bg-white border-gray-200 text-sm"
                            placeholder="도메인 주소"
                            data-testid={`input-edit-domain-url-${item.id}`}
                          />
                          <Input
                            value={editDomainLabel}
                            onChange={(e) => setEditDomainLabel(e.target.value)}
                            className="w-40 bg-white border-gray-200 text-sm"
                            placeholder="표시 이름"
                            data-testid={`input-edit-domain-label-${item.id}`}
                          />
                          <Button size="sm" className="bg-[#03C75A] hover:bg-[#02a84a] text-white"
                            onClick={() => updateDomainLinkMutation.mutate({ id: item.id, url: editDomainUrl, label: editDomainLabel })}
                            disabled={!editDomainUrl.trim() || updateDomainLinkMutation.isPending}
                            data-testid={`button-save-domain-${item.id}`}
                          >
                            {updateDomainLinkMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingDomainLink(null)} data-testid={`button-cancel-domain-${item.id}`}>
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            {item.label && <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>}
                            <p className="text-sm font-semibold text-gray-800 break-all">{item.url}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge variant={item.isActive ? "default" : "outline"} className={item.isActive ? "bg-green-100 text-green-700 border-green-200" : "border-gray-200 text-gray-400"}>
                              {item.isActive ? "표시중" : "숨김"}
                            </Badge>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                              onClick={() => toggleDomainLinkMutation.mutate({ id: item.id, isActive: !item.isActive })}
                              title={item.isActive ? "숨기기" : "표시하기"}
                              data-testid={`button-toggle-domain-${item.id}`}
                            >
                              {item.isActive ? <EyeOff className="w-3.5 h-3.5 text-gray-500" /> : <Eye className="w-3.5 h-3.5 text-gray-500" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                              onClick={() => { setEditingDomainLink(item); setEditDomainUrl(item.url); setEditDomainLabel(item.label); }}
                              data-testid={`button-edit-domain-${item.id}`}
                            >
                              <Pencil className="w-3.5 h-3.5 text-gray-500" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0"
                              onClick={() => { if (confirm("이 도메인을 삭제하시겠습니까?")) deleteDomainLinkMutation.mutate(item.id); }}
                              disabled={deleteDomainLinkMutation.isPending}
                              data-testid={`button-delete-domain-${item.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}

        </main>
      </div>
    </div>
    {viewingImage && (
      <div
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        onClick={() => setViewingImage(null)}
      >
        <img
          src={viewingImage}
          alt="이미지"
          className="max-w-full max-h-full rounded-lg shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        />
        <button
          className="absolute top-4 right-4 text-white bg-black/50 rounded-full w-9 h-9 flex items-center justify-center text-xl"
          onClick={() => setViewingImage(null)}
        >×</button>
      </div>
    )}
    </>
  );
}
