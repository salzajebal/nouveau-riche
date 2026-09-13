import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { registerSchema, KOREAN_BANKS } from "@shared/schema";
import { ArrowLeft } from "lucide-react";
import { SiteLogoBadge } from "@/components/site-logo";
import { z } from "zod";

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [registered, setRegistered] = useState(false);
  const [registeredName, setRegisteredName] = useState("");

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      username: "",
      password: "",
      phone: "",
      accountHolder: "",
      bank: "",
      accountNumber: "",
      unionCode: "",
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const res = await apiRequest("POST", "/api/auth/register", data);
      return res.json();
    },
    onSuccess: (data) => {
      setRegisteredName(form.getValues("fullName"));
      setRegistered(true);
    },
    onError: (error: Error) => {
      toast({
        title: "회원가입 실패",
        description: error.message.includes("409") ? "이미 존재하는 아이디입니다" : "오류가 발생했습니다",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  if (registered) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-[#444] text-base">가입 신청이 접수되었습니다.</p>
          <p className="text-[#444] text-base">승인 후 로그인하실 수 있습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="link-back-home">
              <ArrowLeft className="w-4 h-4 mr-1" /> 홈으로
            </Button>
          </Link>
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <SiteLogoBadge size={36} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">회원가입</h1>
          <p className="text-sm text-muted-foreground mt-1">비상장 주식 관리 시스템</p>
        </div>

        <Card className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="이름을 입력하세요"
                        data-testid="input-fullname"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>회원아이디</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="영문/숫자만 가능 (4자 이상)"
                        data-testid="input-username"
                        {...field}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                          field.onChange(val);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>비밀번호</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="비밀번호를 입력하세요 (6자 이상)"
                        data-testid="input-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>휴대폰번호</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="예: 01012345678"
                        data-testid="input-phone"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountHolder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>예금주명</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="예금주명을 입력하세요"
                        data-testid="input-account-holder"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bank"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>증권사</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-bank">
                          <SelectValue placeholder="증권사 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {KOREAN_BANKS.map((bank) => (
                          <SelectItem key={bank} value={bank} data-testid={`option-bank-${bank}`}>
                            {bank}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>계좌번호 <span className="font-normal text-[#585B5E]">(CMA, ISA 계좌가 아닌, 일반종합계좌를 입력해 주시기 바랍니다.)</span></FormLabel>
                    <FormControl>
                      <Input
                        placeholder="증권 계좌번호를 입력하세요"
                        data-testid="input-account-number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unionCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>조합코드</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="조합코드를 입력하세요"
                        data-testid="input-union-code"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500 font-medium" />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={registerMutation.isPending}
                data-testid="button-register"
              >
                {registerMutation.isPending ? "가입 중..." : "회원가입"}
              </Button>
            </form>
          </Form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-primary font-medium" data-testid="link-login">
              로그인
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
