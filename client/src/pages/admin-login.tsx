import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Lock, User, AlertTriangle } from "lucide-react";
import type { User as UserType } from "@shared/schema";
import { SiteLogoBadge } from "@/components/site-logo";

export default function AdminLoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: authData } = useQuery<{ user: UserType } | null>({
    queryKey: ["/api/auth/admin-me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  useEffect(() => {
    if (authData?.user?.isAdmin) {
      setLocation("/admin");
    }
  }, [authData, setLocation]);

  const loginMutation = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/admin-login", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/admin-me"] });
      setLocation("/admin");
    },
    onError: (error: any) => {
      toast({
        title: "로그인 실패",
        description: error.message || "관리자 인증에 실패했습니다",
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
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#03C75A]/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[#03C75A]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <SiteLogoBadge size={52} className="mb-4" />
          <h1 className="text-2xl font-bold text-white mb-1" data-testid="text-admin-login-title">관리자 로그인</h1>
          <p className="text-sm text-slate-400">누보리치 관리 시스템</p>
        </div>

        <Card className="p-6 bg-[#111d33] border-[#1e3050]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300 text-sm">관리자 아이디</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="관리자 아이디 입력"
                  className="pl-10 bg-[#0a1628] border-[#1e3050] text-white placeholder:text-slate-600 focus:border-[#03C75A]"
                  data-testid="input-admin-username"
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
                  className="pl-10 bg-[#0a1628] border-[#1e3050] text-white placeholder:text-slate-600 focus:border-[#03C75A]"
                  data-testid="input-admin-password"
                />
              </div>
            </div>
            <Button
              type="submit"
              className="w-full bg-[#03C75A] border-[#03C75A] text-white font-semibold"
              disabled={loginMutation.isPending}
              data-testid="button-admin-login"
            >
              {loginMutation.isPending ? "인증 중..." : "관리자 로그인"}
            </Button>
          </form>

          <div className="mt-4 flex items-start gap-2 p-3 rounded-md bg-[#0a1628] border border-[#1e3050]">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-500">
              이 페이지는 관리자 전용입니다. 권한이 없는 계정으로는 접근할 수 없습니다.
            </p>
          </div>
        </Card>

        <p className="text-center text-xs text-slate-600 mt-6">Securities Plus Unlisted Co., Ltd.</p>
      </div>
    </div>
  );
}
