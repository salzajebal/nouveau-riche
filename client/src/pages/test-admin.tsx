import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { StockIcon } from "@/components/stock-icon";
import { SiteLogoBadge } from "@/components/site-logo";
import {
  LogOut, Users, Package, ArrowDownRight, ArrowUpRight,
  Search, Trash2, LayoutDashboard, ClipboardList, Home,
  ChevronLeft, ChevronRight, Eye, Pencil, Snowflake, UserX,
  Save, X, ArrowRightLeft, CheckCircle2, XCircle, PauseCircle,
  Clock, MessageSquare, Send, Menu, Plus, BookOpen, Copy,
} from "lucide-react";

const DEMO_MEMBERS = [
  { id: "1", username: "kim123", fullName: "김민준", phone: "01012345678", bank: "키움증권", accountNumber: "12345678", accountHolder: "김민준", isAdmin: false, isFrozen: false, createdAt: "2026-01-15T09:00:00Z", plainPassword: "test1234" },
  { id: "2", username: "lee456", fullName: "이서연", phone: "01098765432", bank: "삼성증권", accountNumber: "87654321", accountHolder: "이서연", isAdmin: false, isFrozen: false, createdAt: "2026-02-03T11:30:00Z", plainPassword: "pass5678" },
  { id: "3", username: "park789", fullName: "박지훈", phone: "01055557777", bank: "NH투자증권", accountNumber: "55557777", accountHolder: "박지훈", isAdmin: false, isFrozen: true, createdAt: "2026-02-20T14:00:00Z", plainPassword: "abc9876" },
  { id: "4", username: "choi001", fullName: "최수아", phone: "01033334444", bank: "미래에셋증권", accountNumber: "33334444", accountHolder: "최수아", isAdmin: false, isFrozen: false, createdAt: "2026-03-05T10:15:00Z", plainPassword: "xyz1122" },
  { id: "5", username: "jung202", fullName: "정태양", phone: "01077778888", bank: "한국투자증권", accountNumber: "77778888", accountHolder: "정태양", isAdmin: false, isFrozen: false, createdAt: "2026-03-18T16:45:00Z", plainPassword: "qwe3344" },
];

const DEMO_TRANSACTIONS = [
  { id: "t1", userId: "1", fullName: "김민준", type: "in", category: "공모주", stockName: "한패스", quantity: 500, pricePerShare: 19000, memo: "", createdAt: "2026-03-10T09:00:00Z" },
  { id: "t2", userId: "2", fullName: "이서연", type: "in", category: "일반", stockName: "두나무", quantity: 200, pricePerShare: 300000, memo: "VIP 입고", createdAt: "2026-03-12T13:00:00Z" },
  { id: "t3", userId: "3", fullName: "박지훈", type: "out", category: "공모주", stockName: "채비", quantity: 300, pricePerShare: 15000, memo: "", createdAt: "2026-03-15T10:00:00Z" },
  { id: "t4", userId: "4", fullName: "최수아", type: "in", category: "공모주", stockName: "코스모로보틱스", quantity: 1000, pricePerShare: 6000, memo: "", createdAt: "2026-03-20T11:00:00Z" },
  { id: "t5", userId: "5", fullName: "정태양", type: "in", category: "일반", stockName: "토스", quantity: 100, pricePerShare: 185000, memo: "프리미엄", createdAt: "2026-03-22T15:30:00Z" },
];

const DEMO_TRANSFERS = [
  { id: "tr1", userId: "1", fullName: "김민준", accountName: "김민준", accountNumber: "12345678", quantity: 500, stockName: "한패스", status: "pending", createdAt: "2026-03-25T09:00:00Z" },
  { id: "tr2", userId: "2", fullName: "이서연", accountName: "이서연", accountNumber: "87654321", quantity: 100, stockName: "두나무", status: "approved", createdAt: "2026-03-20T14:00:00Z" },
  { id: "tr3", userId: "4", fullName: "최수아", accountName: "최수아", accountNumber: "33334444", quantity: 200, stockName: "코스모로보틱스", status: "held", createdAt: "2026-03-18T11:00:00Z" },
];

const DEMO_IPO = [
  { id: "i1", stockName: "한패스", startDate: "2026-03-17", endDate: "2026-03-19", brokers: "키움증권, 삼성증권", priceMin: 17000, priceMax: 21000, competitionRate: "245.3:1", status: "active", subscriptionStatus: "청약진행중" },
  { id: "i2", stockName: "코스모로보틱스", startDate: "2026-04-09", endDate: "2026-04-10", brokers: "NH투자증권", priceMin: 5300, priceMax: 6000, competitionRate: "-", status: "active", subscriptionStatus: "청약예정" },
  { id: "i3", stockName: "채비", startDate: "2026-04-02", endDate: "2026-04-03", brokers: "한국투자증권, 미래에셋증권", priceMin: 13000, priceMax: 16000, competitionRate: "182.7:1", status: "active", subscriptionStatus: "청약진행중" },
];

const DEMO_CHATS = [
  { id: "c1", userId: "1", fullName: "김민준", lastMessage: "입고 확인 부탁드립니다", lastAt: "2026-03-25T10:30:00Z", unread: 2 },
  { id: "c2", userId: "4", fullName: "최수아", lastMessage: "출금 신청 했습니다", lastAt: "2026-03-24T15:00:00Z", unread: 0 },
  { id: "c3", userId: "5", fullName: "정태양", lastMessage: "안녕하세요 문의드립니다", lastAt: "2026-03-23T09:00:00Z", unread: 1 },
];

const DEMO_MESSAGES: Record<string, { id: string; senderRole: string; content: string; createdAt: string }[]> = {
  c1: [
    { id: "m1", senderRole: "user", content: "안녕하세요, 입고 처리 확인 부탁드립니다.", createdAt: "2026-03-25T10:00:00Z" },
    { id: "m2", senderRole: "admin", content: "네, 확인 중입니다. 잠시 기다려 주세요.", createdAt: "2026-03-25T10:05:00Z" },
    { id: "m3", senderRole: "user", content: "입고 확인 부탁드립니다", createdAt: "2026-03-25T10:30:00Z" },
  ],
  c2: [
    { id: "m4", senderRole: "user", content: "출금 신청 했습니다", createdAt: "2026-03-24T15:00:00Z" },
    { id: "m5", senderRole: "admin", content: "확인했습니다. 처리 완료 후 연락드리겠습니다.", createdAt: "2026-03-24T15:10:00Z" },
  ],
  c3: [
    { id: "m6", senderRole: "user", content: "안녕하세요 문의드립니다", createdAt: "2026-03-23T09:00:00Z" },
  ],
};

type Section = "dashboard" | "members" | "transactions" | "transfers" | "chat" | "ipo";

const STATS = {
  totalMembers: 5,
  totalTransactions: 5,
  pendingTransfers: 1,
  activeChats: 3,
};

export default function TestAdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginId, setLoginId] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState<typeof DEMO_MEMBERS[0] | null>(null);
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const { toast } = useToast();

  const demo = () => toast({ title: "데모 버전입니다", description: "실제 어드민에서 사용 가능한 기능입니다." });

  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-sm p-8 space-y-6">
          <div className="flex flex-col items-center gap-2">
            <SiteLogoBadge size={40} />
            <h1 className="text-xl font-bold">누보리치</h1>
            <p className="text-sm text-muted-foreground">관리자 데모 로그인</p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>아이디</Label>
              <Input value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="아이디 입력" />
            </div>
            <div className="space-y-1">
              <Label>비밀번호</Label>
              <Input type="password" value={loginPw} onChange={e => setLoginPw(e.target.value)} placeholder="비밀번호 입력" onKeyDown={e => e.key === "Enter" && setLoggedIn(true)} />
            </div>
            <Button className="w-full bg-primary" onClick={() => setLoggedIn(true)}>로그인</Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">※ 데모 버전 — 아무 정보나 입력 후 로그인하세요</p>
        </Card>
      </div>
    );
  }

  const filteredMembers = DEMO_MEMBERS.filter(m =>
    m.fullName.includes(memberSearch) || m.username.includes(memberSearch) || m.phone.includes(memberSearch)
  );

  const navItems: { id: Section; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
    { id: "dashboard", label: "대시보드", icon: LayoutDashboard },
    { id: "members", label: "회원 관리", icon: Users },
    { id: "transactions", label: "입고/출고", icon: Package },
    { id: "transfers", label: "대체출고 관리", icon: ArrowRightLeft, badge: DEMO_TRANSFERS.filter(t => t.status === "pending").length },
    { id: "chat", label: "1:1 상담", icon: MessageSquare, badge: DEMO_CHATS.reduce((s, c) => s + c.unread, 0) },
    { id: "ipo", label: "IPO 종목 관리", icon: BookOpen },
  ];

  const sidebarContent = (isMobile: boolean) => (
    <>
      <div className={`h-14 border-b flex items-center ${!isMobile && sidebarCollapsed ? "justify-center px-2" : "px-4"} gap-2`}>
        {(!isMobile && sidebarCollapsed) ? <SiteLogoBadge size={26} /> : (
          <>
            <SiteLogoBadge size={26} />
            {(isMobile || !sidebarCollapsed) && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-sm">누보리치</span>
                <span className="text-[11px] text-muted-foreground">관리자 데모</span>
              </div>
            )}
            {isMobile && <button onClick={() => setMobileSidebarOpen(false)} className="ml-auto p-1"><X className="w-5 h-5 text-muted-foreground" /></button>}
          </>
        )}
      </div>
      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = section === item.id;
          return (
            <button key={item.id} onClick={() => { setSection(item.id); if (isMobile) setMobileSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 rounded-md text-sm font-medium transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"} ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
              <div className="relative shrink-0">
                <Icon className="w-4 h-4" />
                {item.badge ? <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] rounded-full w-3.5 h-3.5 flex items-center justify-center font-bold">{item.badge}</span> : null}
              </div>
              {(isMobile || !sidebarCollapsed) && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
      <div className="border-t p-2 space-y-1">
        <button onClick={() => setLoggedIn(false)} className={`w-full flex items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors ${!isMobile && sidebarCollapsed ? "justify-center px-2 py-2.5" : "px-3 py-2.5"}`}>
          <LogOut className="w-4 h-4 shrink-0" />
          {(isMobile || !sidebarCollapsed) && <span>로그아웃</span>}
        </button>
        {!isMobile && (
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className={`w-full flex items-center gap-3 rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors ${sidebarCollapsed ? "justify-center px-2 py-2" : "px-3 py-2"}`}>
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4 shrink-0" /><span>접기</span></>}
          </button>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r flex flex-col z-10">{sidebarContent(true)}</aside>
        </div>
      )}
      <aside className={`hidden md:flex ${sidebarCollapsed ? "w-16" : "w-56"} border-r bg-muted/30 flex-col transition-all duration-200 shrink-0`}>{sidebarContent(false)}</aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-14 border-b bg-background flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <button onClick={() => setMobileSidebarOpen(true)} className="md:hidden p-1"><Menu className="w-5 h-5" /></button>
            <h1 className="font-bold text-base">{navItems.find(n => n.id === section)?.label}</h1>
            <Badge variant="outline" className="text-[10px] text-orange-500 border-orange-300 hidden sm:flex">데모</Badge>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">

          {/* 대시보드 */}
          {section === "dashboard" && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "총 회원수", value: `${STATS.totalMembers}명`, icon: Users, color: "text-blue-500", bg: "bg-blue-50" },
                  { label: "총 거래건수", value: `${STATS.totalTransactions}건`, icon: Package, color: "text-red-500", bg: "bg-red-50" },
                  { label: "대기 출금신청", value: `${STATS.pendingTransfers}건`, icon: ArrowRightLeft, color: "text-orange-500", bg: "bg-orange-50" },
                  { label: "활성 상담", value: `${STATS.activeChats}건`, icon: MessageSquare, color: "text-green-500", bg: "bg-green-50" },
                ].map(item => (
                  <Card key={item.label} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{item.label}</p>
                        <p className="text-2xl font-bold mt-1">{item.value}</p>
                      </div>
                      <div className={`w-10 h-10 rounded-md ${item.bg} flex items-center justify-center`}>
                        <item.icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <Card className="p-5">
                <h3 className="font-semibold text-sm mb-3">최근 거래내역</h3>
                <div className="space-y-2">
                  {DEMO_TRANSACTIONS.slice(0, 5).map(tx => (
                    <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3">
                        <Badge className={tx.type === "in" ? "bg-red-500 border-red-500 text-white text-xs" : "bg-blue-500 border-blue-500 text-white text-xs"}>{tx.type === "in" ? "입고" : "출고"}</Badge>
                        <StockIcon name={tx.stockName} size={22} />
                        <div>
                          <p className="text-sm font-medium">{tx.stockName}</p>
                          <p className="text-xs text-muted-foreground">{tx.fullName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">{tx.quantity.toLocaleString()}주</p>
                        <p className="text-xs text-muted-foreground">{tx.pricePerShare.toLocaleString()}원</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* 회원 관리 */}
          {section === "members" && (
            <>
              <div className="flex gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="이름, 아이디, 전화번호 검색" className="pl-9" />
                </div>
              </div>
              <Card className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>아이디</TableHead>
                      <TableHead>성명</TableHead>
                      <TableHead className="hidden md:table-cell">전화번호</TableHead>
                      <TableHead className="hidden md:table-cell">증권사</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-sm">{m.username}</TableCell>
                        <TableCell className="font-medium">{m.fullName}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{m.phone}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{m.bank}</TableCell>
                        <TableCell>
                          {m.isFrozen ? <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">동결</Badge> : <Badge variant="outline" className="text-green-600 border-green-300 text-xs">정상</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setSelectedMember(m); setMemberDialogOpen(true); }}><Eye className="w-3 h-3 mr-1" />조회</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={demo}><Pencil className="w-3 h-3 mr-1" />수정</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-blue-600" onClick={demo}><Snowflake className="w-3 h-3 mr-1" />{m.isFrozen ? "해제" : "동결"}</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={demo}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}

          {/* 입고/출고 */}
          {section === "transactions" && (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">전체 {DEMO_TRANSACTIONS.length}건</p>
              </div>
              <Card className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>구분</TableHead>
                      <TableHead>회원명</TableHead>
                      <TableHead>종목명</TableHead>
                      <TableHead className="text-right">수량</TableHead>
                      <TableHead className="text-right">단가</TableHead>
                      <TableHead className="text-right">총액</TableHead>
                      <TableHead>날짜</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DEMO_TRANSACTIONS.map(tx => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge className={tx.type === "in" ? "bg-red-500 border-red-500 text-white text-xs" : "bg-blue-500 border-blue-500 text-white text-xs"}>{tx.type === "in" ? "입고" : "출고"}</Badge>
                        </TableCell>
                        <TableCell className="font-medium text-sm">{tx.fullName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StockIcon name={tx.stockName} size={22} />
                            <span className="text-sm">{tx.stockName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{tx.quantity.toLocaleString()}주</TableCell>
                        <TableCell className="text-right font-mono text-sm">{tx.pricePerShare.toLocaleString()}원</TableCell>
                        <TableCell className="text-right font-mono text-sm">{(tx.quantity * tx.pricePerShare).toLocaleString()}원</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={demo}><Pencil className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={demo}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
              <div className="pt-2">
                <Button onClick={demo} className="bg-red-500 hover:bg-red-600 text-white"><ArrowDownRight className="w-4 h-4 mr-2" />신규 입고 처리</Button>
              </div>
            </>
          )}

          {/* 대체출고 관리 */}
          {section === "transfers" && (
            <Card className="p-0 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>신청일</TableHead>
                    <TableHead>회원명</TableHead>
                    <TableHead>종목명</TableHead>
                    <TableHead className="text-right">수량</TableHead>
                    <TableHead>계좌번호</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">처리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DEMO_TRANSFERS.map(tr => (
                    <TableRow key={tr.id}>
                      <TableCell className="text-sm text-muted-foreground">{new Date(tr.createdAt).toLocaleDateString("ko-KR")}</TableCell>
                      <TableCell className="font-medium text-sm">{tr.fullName}</TableCell>
                      <TableCell className="text-sm">{tr.stockName}</TableCell>
                      <TableCell className="text-right font-mono text-sm">{tr.quantity.toLocaleString()}주</TableCell>
                      <TableCell className="text-sm font-mono">{tr.accountNumber}</TableCell>
                      <TableCell>
                        {tr.status === "pending" && <Badge variant="outline" className="gap-1 text-xs"><Clock className="w-3 h-3" />대기중</Badge>}
                        {tr.status === "approved" && <Badge className="gap-1 text-xs bg-green-600"><CheckCircle2 className="w-3 h-3" />승인</Badge>}
                        {tr.status === "held" && <Badge variant="secondary" className="gap-1 text-xs"><PauseCircle className="w-3 h-3" />보류</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={demo}><CheckCircle2 className="w-3 h-3 mr-1" />승인</Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-orange-600" onClick={demo}><PauseCircle className="w-3 h-3 mr-1" />보류</Button>
                          <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={demo}><XCircle className="w-3 h-3 mr-1" />거부</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          {/* 1:1 상담 */}
          {section === "chat" && (
            <div className="flex gap-4 h-[calc(100vh-10rem)]">
              <Card className="w-64 shrink-0 p-0 overflow-hidden flex flex-col">
                <div className="p-3 border-b"><p className="text-sm font-semibold">상담 목록</p></div>
                <div className="flex-1 overflow-y-auto">
                  {DEMO_CHATS.map(c => (
                    <button key={c.id} onClick={() => setSelectedChat(c.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 border-b text-left hover:bg-muted transition-colors ${selectedChat === c.id ? "bg-muted" : ""}`}>
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary">{c.fullName.charAt(0)}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{c.fullName}</span>
                          {c.unread > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">{c.unread}</span>}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
              <Card className="flex-1 flex flex-col p-0 overflow-hidden">
                {selectedChat ? (
                  <>
                    <div className="p-3 border-b">
                      <p className="text-sm font-semibold">{DEMO_CHATS.find(c => c.id === selectedChat)?.fullName}님</p>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {(DEMO_MESSAGES[selectedChat] || []).map(msg => (
                        <div key={msg.id} className={`flex ${msg.senderRole === "admin" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${msg.senderRole === "admin" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-3 border-t flex gap-2">
                      <Input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="메시지 입력..." className="flex-1" onKeyDown={e => e.key === "Enter" && demo()} />
                      <Button onClick={demo} size="sm" className="bg-primary"><Send className="w-4 h-4" /></Button>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">상담방을 선택해주세요</div>
                )}
              </Card>
            </div>
          )}

          {/* IPO 종목 관리 */}
          {section === "ipo" && (
            <>
              <div className="flex justify-end">
                <Button onClick={demo} className="bg-primary"><Plus className="w-4 h-4 mr-2" />종목 추가</Button>
              </div>
              <Card className="p-0 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>종목명</TableHead>
                      <TableHead>청약일</TableHead>
                      <TableHead className="hidden md:table-cell">주관사</TableHead>
                      <TableHead className="text-right hidden md:table-cell">공모가 범위</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>청약상태</TableHead>
                      <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {DEMO_IPO.map(ipo => (
                      <TableRow key={ipo.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StockIcon name={ipo.stockName} size={24} />
                            <span className="font-medium text-sm">{ipo.stockName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ipo.startDate} ~ {ipo.endDate}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm">{ipo.brokers}</TableCell>
                        <TableCell className="hidden md:table-cell text-right font-mono text-sm">{ipo.priceMin.toLocaleString()} ~ {ipo.priceMax.toLocaleString()}원</TableCell>
                        <TableCell><Badge variant="outline" className="text-green-600 border-green-300 text-xs">활성</Badge></TableCell>
                        <TableCell>
                          <Badge className={ipo.subscriptionStatus === "청약진행중" ? "bg-red-500 border-red-500 text-white text-xs" : "bg-orange-400 border-orange-400 text-white text-xs"}>
                            {ipo.subscriptionStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={demo}><Pencil className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={demo}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </main>
      </div>

      {/* 회원 상세 조회 다이얼로그 */}
      <Dialog open={memberDialogOpen} onOpenChange={setMemberDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>회원 정보 조회</DialogTitle></DialogHeader>
          {selectedMember && (
            <div className="space-y-3 text-sm">
              {[
                ["아이디", selectedMember.username],
                ["성명", selectedMember.fullName],
                ["전화번호", selectedMember.phone],
                ["증권사", selectedMember.bank],
                ["계좌번호", selectedMember.accountNumber],
                ["예금주", selectedMember.accountHolder],
                ["상태", selectedMember.isFrozen ? "동결" : "정상"],
                ["가입일", new Date(selectedMember.createdAt).toLocaleDateString("ko-KR")],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 bg-primary" onClick={demo}><Pencil className="w-3 h-3 mr-1" />정보 수정</Button>
                <Button variant="outline" className="flex-1 text-blue-600" onClick={demo}><Snowflake className="w-3 h-3 mr-1" />동결 처리</Button>
                <Button variant="outline" className="text-red-600" onClick={demo}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
