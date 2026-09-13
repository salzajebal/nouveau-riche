import { useState } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { Lock, Shield, User } from "lucide-react";
import { SiteLogoBadge } from "@/components/site-logo";

export default function DemoAdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/demo-admin/login", data);
      return res.json();
    },
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/demo-admin/auth-check"] });
      const seedRes = await fetch("/api/demo-admin/seed", { credentials: "include" });
      if (!seedRes.ok) {
        toast({ title: "씨드 오류", description: "테스트 데이터 초기화에 실패했습니다", variant: "destructive" });
      }
      setLocation("/demo-admin");
    },
    onError: (error: any) => {
      toast({
        title: "로그인 실패",
        description: error.message || "데모 계정 정보가 올바르지 않습니다",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      toast({ title: "입력 오류", description: "아이디와 비밀번호를 입력해주세요", variant: "destructive" });
      return;
    }
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen bg-[#0a1628] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#E8344E]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#E8344E]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <SiteLogoBadge size={52} className="mb-4" />
          <h1 className="text-2xl font-bold text-white mb-1">데모 어드민 로그인</h1>
          <p className="text-sm text-slate-400">누보리치 — 데모 관리 시스템</p>
        </div>

        <Card className="p-6 bg-[#111d33] border-[#1e3050]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">데모 아이디</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="demo"
                  className="pl-10 bg-[#0a1628] border-[#1e3050] text-white placeholder:text-slate-600 focus:border-[#E8344E]"
                  data-testid="input-demo-username"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">비밀번호</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  className="pl-10 bg-[#0a1628] border-[#1e3050] text-white placeholder:text-slate-600 focus:border-[#E8344E]"
                  data-testid="input-demo-password"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#E8344E] border-[#E8344E] text-white font-semibold"
              disabled={loginMutation.isPending}
              data-testid="button-demo-login"
            >
              {loginMutation.isPending ? "로그인 중..." : "데모 어드민 로그인"}
            </Button>
          </form>

          <div className="mt-4 p-3 rounded-md bg-[#0a1628] border border-[#1e3050]">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-yellow-400 shrink-0" />
              <p className="text-xs text-yellow-400 font-medium">데모 계정 안내</p>
            </div>
            <div className="space-y-1 text-xs text-slate-400">
              <p>아이디: <span className="text-white font-mono">demo</span></p>
              <p>비밀번호: <span className="text-white font-mono">demo2026</span></p>
              <p className="text-slate-500 mt-2">로그인 시 test1, test2, test3 테스트 회원 데이터가 자동으로 초기화됩니다.</p>
            </div>
          </div>
        </Card>

        <p className="text-center text-xs text-slate-600 mt-6">Securities Plus Unlisted Co., Ltd. — Demo Environment</p>
      </div>
    </div>
  );
}
