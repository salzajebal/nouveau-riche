import { useState } from "react";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  LayoutDashboard,
  Users,
  ClipboardList,
  ArrowRightLeft,
  Package,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  Eye,
  Edit,
  Snowflake,
  Trash2,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Clock,
  Search,
  Plus,
  Send,
} from "lucide-react";
import { SiteLogoBadge } from "@/components/site-logo";

interface ManualSection {
  id: string;
  title: string;
  icon: typeof LayoutDashboard;
  content: SectionContent[];
}

interface SectionContent {
  subtitle: string;
  description: string;
  steps?: string[];
  tips?: string[];
  warnings?: string[];
}

const MANUAL_SECTIONS: ManualSection[] = [
  {
    id: "login",
    title: "관리자 로그인",
    icon: Users,
    content: [
      {
        subtitle: "관리자 페이지 접속 방법",
        description: "관리자 페이지는 별도의 로그인이 필요합니다.",
        steps: [
          "브라우저에서 /admin/login 경로로 접속합니다.",
          "관리자 아이디와 비밀번호를 입력합니다.",
          "기본 관리자 계정: 아이디 admin / 비밀번호 s15154",
          "로그인 성공 시 관리자 대시보드로 자동 이동됩니다.",
        ],
        warnings: [
          "보안을 위해 기본 비밀번호는 반드시 변경해 주세요.",
          "일반 회원 로그인(/login)과 관리자 로그인(/admin/login)은 별도입니다.",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    title: "대시보드",
    icon: LayoutDashboard,
    content: [
      {
        subtitle: "대시보드 개요",
        description: "관리자 페이지에 로그인하면 가장 먼저 보이는 화면입니다. 전체 시스템 현황을 한눈에 파악할 수 있습니다.",
        steps: [
          "총 회원수: 현재 가입된 전체 회원 수를 표시합니다.",
          "총 입고: 전체 주식 입고 건수를 표시합니다.",
          "총 출고: 전체 주식 출고 건수를 표시합니다.",
          "최근 회원: 최근 가입한 회원 5명의 목록과 빠른 입고/출고 버튼이 제공됩니다.",
          "최근 거래: 최근 입출고 거래 내역 5건이 표시됩니다.",
          "총 자산 현황: 전체 입고 기준 총 자산 가치를 확인할 수 있습니다.",
        ],
        tips: [
          "'전체보기' 버튼을 클릭하면 해당 메뉴(회원 관리, 거래 내역)로 바로 이동합니다.",
          "대시보드의 최근 회원 목록에서도 바로 입고/출고 처리가 가능합니다.",
        ],
      },
    ],
  },
  {
    id: "members",
    title: "회원 관리",
    icon: Users,
    content: [
      {
        subtitle: "회원 검색",
        description: "등록된 전체 회원 목록을 확인하고 검색할 수 있습니다.",
        steps: [
          "상단 검색창에 이름, 아이디, 또는 계좌번호를 입력하여 회원을 검색합니다.",
          "검색 결과는 실시간으로 필터링되어 표시됩니다.",
          "전체 회원 수가 검색창 옆에 표시됩니다.",
        ],
      },
      {
        subtitle: "회원 정보 열람",
        description: "각 회원의 상세 정보와 거래 현황을 확인합니다.",
        steps: [
          "회원 목록에서 눈 모양 아이콘(정보 열람)을 클릭합니다.",
          "회원의 기본 정보(이름, 아이디, 은행, 계좌)가 표시됩니다.",
          "총 입고 수량, 총 출고 수량, 총 입고 금액이 표시됩니다.",
          "해당 회원의 전체 거래 내역 목록을 확인할 수 있습니다.",
        ],
      },
      {
        subtitle: "회원 정보 변경",
        description: "회원의 개인정보를 수정할 수 있습니다.",
        steps: [
          "회원 목록에서 연필 모양 아이콘(정보 변경)을 클릭합니다.",
          "성명, 은행명, 예금주명, 계좌번호를 수정할 수 있습니다.",
          "수정 후 '변경사항 저장' 버튼을 클릭하면 즉시 반영됩니다.",
        ],
        tips: [
          "아이디(username)는 변경할 수 없습니다.",
        ],
      },
      {
        subtitle: "회원 동결/해제",
        description: "문제가 있는 회원의 계정을 동결하거나 해제할 수 있습니다.",
        steps: [
          "회원 목록에서 눈꽃 모양 아이콘(동결/해제)을 클릭합니다.",
          "현재 상태에 따라 '동결' 또는 '해제' 버튼이 표시됩니다.",
          "동결된 회원은 로그인이 불가능합니다.",
          "동결된 회원은 목록에서 흐리게 표시되며 '동결' 배지가 붙습니다.",
        ],
        warnings: [
          "동결된 회원은 시스템에 로그인할 수 없으므로 신중하게 사용해 주세요.",
        ],
      },
      {
        subtitle: "회원 삭제",
        description: "회원 계정을 완전히 삭제합니다.",
        steps: [
          "회원 목록에서 휴지통 아이콘(삭제)을 클릭합니다.",
          "확인을 위해 해당 회원의 아이디를 직접 입력해야 합니다.",
          "아이디가 정확히 일치하면 '회원 삭제' 버튼이 활성화됩니다.",
          "삭제를 실행하면 회원의 모든 데이터가 영구적으로 삭제됩니다.",
        ],
        warnings: [
          "삭제된 회원의 데이터는 복구할 수 없습니다.",
          "회원의 모든 거래 내역도 함께 삭제됩니다.",
          "아이디 확인 입력이 반드시 필요합니다.",
        ],
      },
      {
        subtitle: "빠른 입고/출고",
        description: "회원 관리 화면에서 바로 주식 입고/출고 처리를 할 수 있습니다.",
        steps: [
          "회원 목록의 관리 영역에서 빨간색 '입고' 또는 파란색 '출고' 버튼을 클릭합니다.",
          "해당 기능은 아래 '거래 내역' 섹션의 입고/출고 처리와 동일합니다.",
        ],
      },
    ],
  },
  {
    id: "transactions",
    title: "거래 내역",
    icon: ClipboardList,
    content: [
      {
        subtitle: "거래 내역 조회",
        description: "전체 주식 입출고 거래 내역을 확인할 수 있습니다.",
        steps: [
          "좌측 사이드바에서 '거래 내역'을 클릭합니다.",
          "'유형' 필터로 전체/입고/출고를 선택할 수 있습니다.",
          "'카테고리' 필터로 일반/매수/매도/대체입고/대체출고/공모/S.O/스팩/기타를 선택할 수 있습니다.",
          "필터링된 결과 건수가 상단에 표시됩니다.",
        ],
      },
      {
        subtitle: "주식 입고 처리",
        description: "회원에게 주식을 입고(지급)합니다.",
        steps: [
          "회원 관리 또는 대시보드에서 해당 회원의 빨간색 '입고' 버튼을 클릭합니다.",
          "카테고리를 선택합니다 (일반, 매수, 매도, 대체입고, 대체출고, 공모, S.O, 스팩, 기타).",
          "종목명을 입력합니다 (예: 삼성전자, 케이뱅크 등).",
          "수량(주)과 단가(원)를 입력합니다.",
          "필요시 메모를 입력합니다.",
          "'입고 처리' 버튼을 클릭하면 즉시 반영됩니다.",
        ],
        tips: [
          "입고된 주식은 해당 회원의 대시보드와 공모주 마이페이지에 바로 반영됩니다.",
          "종목명은 자유롭게 입력 가능합니다.",
        ],
      },
      {
        subtitle: "주식 출고 처리",
        description: "회원의 주식을 출고(차감)합니다.",
        steps: [
          "회원 관리 또는 대시보드에서 해당 회원의 파란색 '출고' 버튼을 클릭합니다.",
          "입고와 동일한 방식으로 카테고리, 종목명, 수량, 단가를 입력합니다.",
          "'출고 처리' 버튼을 클릭하면 즉시 반영됩니다.",
        ],
        warnings: [
          "출고는 보유 수량과 관계없이 처리되므로 수량을 반드시 확인해 주세요.",
        ],
      },
      {
        subtitle: "거래 내역 수정",
        description: "이미 처리된 거래 내역을 수정할 수 있습니다.",
        steps: [
          "거래 내역 목록에서 연필 아이콘(수정)을 클릭합니다.",
          "수량과 단가를 수정할 수 있습니다.",
          "'수정 완료' 버튼을 클릭하면 변경사항이 반영됩니다.",
        ],
      },
      {
        subtitle: "거래 내역 삭제",
        description: "거래 내역을 삭제합니다.",
        steps: [
          "거래 내역 목록에서 휴지통 아이콘(삭제)을 클릭합니다.",
          "확인 없이 즉시 삭제되므로 주의가 필요합니다.",
        ],
        warnings: [
          "삭제된 거래 내역은 복구할 수 없습니다.",
          "거래 삭제 시 해당 회원의 보유 현황에도 즉시 반영됩니다.",
        ],
      },
    ],
  },
  {
    id: "transfers",
    title: "대체출고 관리",
    icon: ArrowRightLeft,
    content: [
      {
        subtitle: "대체출고란?",
        description: "회원이 보유한 비상장 주식을 타 증권사 계좌로 출고(이전)하는 것을 말합니다. 회원이 로그인 페이지에서 직접 신청하며, 관리자가 승인/거부/보류 처리합니다.",
      },
      {
        subtitle: "대체출고 신청 목록 확인",
        description: "회원들이 신청한 대체출고 요청을 확인합니다.",
        steps: [
          "좌측 사이드바에서 '대체출고 관리'를 클릭합니다.",
          "전체 신청 건수와 대기 중인 건수가 상단에 표시됩니다.",
          "각 신청 건에는 신청 회원, 종목, 수량, 예금주, 계좌번호, 신청일이 표시됩니다.",
          "현재 상태가 배지로 표시됩니다: 대기, 승인, 거부, 보류",
        ],
      },
      {
        subtitle: "대체출고 처리 (승인/거부/보류)",
        description: "각 대체출고 신청 건에 대해 처리합니다.",
        steps: [
          "초록색 '승인' 버튼: 출고 신청을 승인합니다. 승인 시 해당 수량이 출고 처리됩니다.",
          "빨간색 '거부' 버튼: 출고 신청을 거부합니다.",
          "회색 '보류' 버튼: 출고 신청을 보류 상태로 변경합니다.",
          "처리 결과는 회원에게 실시간으로 알림됩니다 (WebSocket).",
        ],
        tips: [
          "이미 처리된 건도 상태를 변경할 수 있습니다 (단, 같은 상태로는 변경 불가).",
          "새로운 대체출고 신청이 들어오면 실시간 알림이 표시됩니다.",
        ],
      },
    ],
  },
  {
    id: "stocks",
    title: "종목 관리 (IPO 청약)",
    icon: Package,
    content: [
      {
        subtitle: "종목 관리 개요",
        description: "IPO 청약 종목을 등록/수정/삭제하고, 메인 페이지의 IPO 캘린더에 표시할 종목을 관리합니다.",
      },
      {
        subtitle: "종목 추가",
        description: "새로운 IPO 청약 종목을 등록합니다.",
        steps: [
          "'종목 추가' 버튼을 클릭합니다.",
          "종목명을 입력합니다. 국내 주식 140여 개 종목을 검색하여 선택할 수도 있습니다.",
          "청약 시작일과 종료일을 설정합니다.",
          "주관사(증권사)를 입력합니다.",
          "공모가 범위(최소~최대)를 입력합니다.",
          "경쟁률을 입력합니다 (선택사항).",
          "청약 상태를 선택합니다: 청약진행중 또는 청약예정.",
          "활성/비활성 상태를 선택합니다 (비활성 종목은 메인 페이지에 표시되지 않습니다).",
          "'종목 등록' 버튼을 클릭하면 등록됩니다.",
        ],
        tips: [
          "종목 검색 기능을 활용하면 정확한 종목명을 쉽게 입력할 수 있습니다.",
          "활성 상태의 종목만 메인 페이지 IPO 캘린더에 표시됩니다.",
        ],
      },
      {
        subtitle: "종목 수정",
        description: "등록된 IPO 종목의 정보를 수정합니다.",
        steps: [
          "종목 목록에서 연필 아이콘(수정)을 클릭합니다.",
          "종목명, 청약 기간, 주관사, 공모가 범위, 경쟁률, 상태 등을 수정합니다.",
          "'수정 완료' 버튼을 클릭하면 변경사항이 반영됩니다.",
        ],
      },
      {
        subtitle: "종목 삭제",
        description: "등록된 IPO 종목을 삭제합니다.",
        steps: [
          "종목 목록에서 휴지통 아이콘(삭제)을 클릭합니다.",
          "삭제 확인 후 영구적으로 삭제됩니다.",
        ],
        warnings: [
          "삭제된 종목은 복구할 수 없습니다.",
        ],
      },
      {
        subtitle: "종목 활성/비활성 관리",
        description: "종목의 표시 여부를 제어합니다.",
        steps: [
          "종목 목록의 '상태' 열에서 활성/비활성 배지를 확인합니다.",
          "종목 수정을 통해 활성/비활성 상태를 변경할 수 있습니다.",
          "비활성 종목은 메인 페이지의 IPO 캘린더에 표시되지 않습니다.",
        ],
      },
    ],
  },
  {
    id: "chat",
    title: "1:1 상담",
    icon: MessageSquare,
    content: [
      {
        subtitle: "1:1 상담 개요",
        description: "회원들과 실시간으로 1:1 채팅 상담을 진행할 수 있습니다. WebSocket 기반으로 메시지가 즉시 전달됩니다.",
      },
      {
        subtitle: "상담 목록 확인",
        description: "회원들의 상담 요청 목록을 확인합니다.",
        steps: [
          "좌측 사이드바에서 '1:1 상담'을 클릭합니다.",
          "왼쪽에 상담 목록이 표시됩니다 (회원 이름, 마지막 메시지 날짜).",
          "읽지 않은 메시지가 있으면 빨간색 숫자 배지가 표시됩니다.",
          "상담방을 클릭하면 오른쪽에 채팅 내용이 표시됩니다.",
        ],
      },
      {
        subtitle: "상담 메시지 보내기",
        description: "회원에게 답변 메시지를 보냅니다.",
        steps: [
          "상담 목록에서 회원을 선택합니다.",
          "하단 입력창에 답변 메시지를 입력합니다.",
          "Enter 키를 누르거나 전송 버튼을 클릭하면 메시지가 전송됩니다.",
          "관리자 메시지는 오른쪽(빨간색 배경), 회원 메시지는 왼쪽(회색 배경)에 표시됩니다.",
        ],
        tips: [
          "새로운 상담 메시지가 도착하면 실시간 알림이 표시됩니다.",
          "모바일에서는 상담 목록과 채팅창이 전환 방식으로 표시됩니다.",
          "채팅방 좌측 상단의 뒤로가기 버튼으로 상담 목록으로 돌아갈 수 있습니다.",
            "관리자가 보낸 메시지는 회원이 읽기 전까지만 회수할 수 있으며, '읽음' 상태가 되면 회수할 수 없습니다.",
            "입력창의 '문구' 메뉴에서 자주 쓰는 문구를 선택하거나 추가·수정·삭제할 수 있습니다.",
        ],
      },
    ],
  },
];

function SectionAccordion({ section }: { section: ManualSection }) {
  const [isOpen, setIsOpen] = useState(false);
  const Icon = section.icon;

  return (
    <Card className="overflow-hidden border-gray-200 bg-white">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 sm:p-5 text-left hover-elevate"
        data-testid={`manual-section-${section.id}`}
      >
        <div className="w-10 h-10 rounded-lg bg-[#E8344E]/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#E8344E]" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-sm sm:text-base">{section.title}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{section.content.length}개 항목</p>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {section.content.map((item, idx) => (
            <div key={idx} className="p-4 sm:p-5 space-y-3">
              <div>
                <h4 className="font-semibold text-gray-900 text-sm">{item.subtitle}</h4>
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">{item.description}</p>
              </div>

              {item.steps && item.steps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">순서</p>
                  <ol className="space-y-1.5">
                    {item.steps.map((step, stepIdx) => (
                      <li key={stepIdx} className="flex gap-2.5 text-sm text-gray-700">
                        <span className="w-5 h-5 rounded-full bg-[#E8344E]/10 text-[#E8344E] text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {stepIdx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {item.tips && item.tips.length > 0 && (
                <div className="bg-blue-50 rounded-md p-3 space-y-1">
                  <p className="text-xs font-semibold text-blue-700">TIP</p>
                  {item.tips.map((tip, tipIdx) => (
                    <p key={tipIdx} className="text-sm text-blue-700 leading-relaxed flex gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </p>
                  ))}
                </div>
              )}

              {item.warnings && item.warnings.length > 0 && (
                <div className="bg-red-50 rounded-md p-3 space-y-1">
                  <p className="text-xs font-semibold text-red-700">주의사항</p>
                  {item.warnings.map((warning, warnIdx) => (
                    <p key={warnIdx} className="text-sm text-red-700 leading-relaxed flex gap-1.5">
                      <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>{warning}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default function AdminManualPage() {
  const [expandAll, setExpandAll] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin">
            <Button variant="ghost" size="sm" data-testid="link-back-admin">
              <ArrowLeft className="w-4 h-4 mr-1" /> 관리자 페이지
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <SiteLogoBadge size={32} />
            <span className="font-bold text-base text-gray-900">누보리치</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">관리자 사용 매뉴얼</h1>
          <p className="text-sm text-gray-500 mt-1.5">관리자 페이지의 모든 기능을 안내합니다</p>
        </div>

        <Card className="p-4 sm:p-5 mb-6 bg-[#FFF8E1] border-[#FFE082]">
          <h3 className="font-bold text-sm text-[#F57F17] mb-2">빠른 시작 가이드</h3>
          <div className="space-y-2 text-sm text-[#795548]">
            <p className="flex gap-2">
              <span className="font-bold text-[#F57F17]">1.</span>
              <span>/admin/login 에서 관리자 로그인 (admin / s15154)</span>
            </p>
            <p className="flex gap-2">
              <span className="font-bold text-[#F57F17]">2.</span>
              <span>좌측 메뉴에서 원하는 관리 기능을 선택</span>
            </p>
            <p className="flex gap-2">
              <span className="font-bold text-[#F57F17]">3.</span>
              <span>회원 관리에서 입고/출고 처리, 회원 정보 수정 가능</span>
            </p>
            <p className="flex gap-2">
              <span className="font-bold text-[#F57F17]">4.</span>
              <span>종목 관리에서 IPO 청약 종목 등록, 1:1 상담에서 회원 문의 응답</span>
            </p>
          </div>
        </Card>

        <div className="space-y-3">
          {MANUAL_SECTIONS.map((section) => (
            <SectionAccordion key={section.id} section={section} />
          ))}
        </div>

        <Card className="mt-6 p-4 sm:p-5 bg-white border-gray-200">
          <h3 className="font-bold text-sm text-gray-900 mb-3">메뉴 아이콘 안내</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Eye className="w-4 h-4 text-gray-400" /> 정보 열람
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Edit className="w-4 h-4 text-gray-400" /> 정보 수정
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Snowflake className="w-4 h-4 text-gray-400" /> 동결/해제
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Trash2 className="w-4 h-4 text-destructive" /> 삭제
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ArrowDownRight className="w-4 h-4 text-red-500" /> 입고
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <ArrowUpRight className="w-4 h-4 text-blue-500" /> 출고
            </div>
          </div>
        </Card>

        <Card className="mt-3 p-4 sm:p-5 bg-white border-gray-200">
          <h3 className="font-bold text-sm text-gray-900 mb-3">상태 배지 안내</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="gap-1 border-gray-200 text-gray-500"><Clock className="w-3 h-3" />대기</Badge>
              <span className="text-sm text-gray-600">처리 대기 중인 상태</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge className="gap-1 bg-green-600 border-green-600"><CheckCircle2 className="w-3 h-3" />승인</Badge>
              <span className="text-sm text-gray-600">관리자가 승인한 상태</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" />거부</Badge>
              <span className="text-sm text-gray-600">관리자가 거부한 상태</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="gap-1"><PauseCircle className="w-3 h-3" />보류</Badge>
              <span className="text-sm text-gray-600">추가 확인이 필요한 상태</span>
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center text-xs text-gray-400 pb-8">
          누보리치 관리자 매뉴얼 v1.0
        </div>
      </div>
    </div>
  );
}
