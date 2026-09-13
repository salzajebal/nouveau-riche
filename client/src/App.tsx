import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import TradePage from "@/pages/landing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import AdminPage from "@/pages/admin";
import AdminLoginPage from "@/pages/admin-login";
import DemoAdminPage from "@/pages/demo-admin";
import DemoAdminLoginPage from "@/pages/demo-admin-login";
import ChatPage from "@/pages/chat";
import MyStocksPage from "@/pages/my-stocks";
import IPOCalendarPage from "@/pages/ipo-calendar";
import AdminManualPage from "@/pages/admin-manual";
import TestAdminPage from "@/pages/test-admin";
import StockDetailPage from "@/pages/stock-detail";
import EventsPage from "@/pages/events";
import ServiceIntroPage from "@/pages/service-intro";
import NoticesPage from "@/pages/notices";
import LinkPage from "@/pages/link";
import ExpertReportPage from "@/pages/expert-report";
import { useEffect } from "react";

function MaintenancePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-[#E8344E]/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-[#E8344E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
          </svg>
        </div>
        <div className="mb-2">
          <span className="text-xs font-semibold text-[#E8344E] bg-[#E8344E]/10 px-3 py-1 rounded-full">시스템 점검</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mt-4 mb-3">서비스 점검 중입니다</h1>
        <p className="text-gray-500 text-sm leading-relaxed mb-2">
          보다 나은 서비스 제공을 위해 시스템 점검 중입니다.
        </p>
        <p className="text-gray-400 text-sm">
          점검이 완료되면 정상적으로 이용하실 수 있습니다.
        </p>
        <div className="mt-8 pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">누보리치</p>
        </div>
      </div>
    </div>
  );
}


function Router() {
  const [location] = useLocation();
  const isAdminPath = location.startsWith("/admin") || location.startsWith("/demo-admin") || location.startsWith("/test");

  const { data: maintenanceData } = useQuery<{ maintenance: boolean }>({
    queryKey: ["/api/maintenance"],
    refetchInterval: 30000,
  });

  if (maintenanceData?.maintenance && !isAdminPath) {
    return <MaintenancePage />;
  }

  return (
    <Switch>
      <Route path="/" component={TradePage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/my-stocks" component={MyStocksPage} />
      <Route path="/ipo-calendar" component={IPOCalendarPage} />
      <Route path="/admin/manual" component={AdminManualPage} />
      <Route path="/admin/login" component={AdminLoginPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/demo-admin/login" component={DemoAdminLoginPage} />
      <Route path="/demo-admin" component={DemoAdminPage} />
      <Route path="/test" component={TestAdminPage} />
      <Route path="/stock/:name" component={StockDetailPage} />
      <Route path="/events" component={EventsPage} />
      <Route path="/service" component={ServiceIntroPage} />
      <Route path="/notices" component={NoticesPage} />
      <Route path="/link" component={LinkPage} />
      <Route path="/chat" component={ChatPage} />
      <Route path="/expert-report/:id" component={ExpertReportPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
