import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, BarChart3, Check, Copy, ExternalLink, Filter, KeyRound, Link2, LogOut, MessageCircleMore, RefreshCw, Send, ShieldCheck, Users, Wallet } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PawIcon from "@/components/PawIcon";
import { Button } from "@/components/ui/button";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ApiKeyProfile,
  ApiUsageSeries,
  CreditsDirection,
  CreditsHistoryResponse,
  CreditHistoryRange,
  CreditHistorySource,
  PaymentPlanId,
  PaymentSession,
  PaymentSessionStatusResult,
  PaymentTokenOut,
  ReferralCodeResolution,
  ReferralProfile,
  UsageRange,
  XSessionUser,
} from "@/lib/creditHubAuth";

interface DashboardProps {
  sessionUser: XSessionUser;
  profile: ApiKeyProfile | null;
  latestApiKey: string;
  referralProfile: ReferralProfile | null;
  resolvedReferral: ReferralCodeResolution | null;
  statusMessage: string;
  errorMessage: string;
  usage: ApiUsageSeries;
  usageRange: UsageRange;
  usageError: string;
  creditsHistory: CreditsHistoryResponse;
  creditsHistoryError: string;
  creditsHistoryRange: CreditHistoryRange;
  creditsHistorySource: CreditHistorySource;
  creditsHistoryDirection: CreditsDirection;
  isProfileLoading: boolean;
  isCreatingApiKey: boolean;
  isRotatingApiKey: boolean;
  isBindingTelegram: boolean;
  isLoggingOut: boolean;
  isUsageLoading: boolean;
  isCreditsHistoryLoading: boolean;
  isTelegramWidgetReady: boolean;
  paymentSession: PaymentSession | null;
  paymentStatus: PaymentSessionStatusResult | null;
  isCreatingPayment: boolean;
  activePaymentPlanId: PaymentPlanId | null;
  isCheckingPaymentStatus: boolean;
  telegramWidgetContent: ReactNode;
  onRefreshProfile: () => void;
  onUsageRangeChange: (value: UsageRange) => void;
  onCreditsHistoryRangeChange: (value: CreditHistoryRange) => void;
  onCreditsHistorySourceChange: (value: CreditHistorySource) => void;
  onCreditsHistoryDirectionChange: (value: CreditsDirection) => void;
  onCreditsHistoryPageChange: (page: number) => void;
  onCreateApiKey: () => void;
  onRotateApiKey: () => void;
  onBindTelegram: () => void;
  onCreatePayment: (planId: PaymentPlanId, tokenOut: PaymentTokenOut) => void;
  onOpenPaymentCheckout: () => void;
  onCheckPaymentStatus: (sessionId: string) => void;
  onLogout: () => void;
}

const SUPPORT_CONTACT_URL = "https://t.me/pawx_ai";
const TOP_UP_PLANS = [
  {
    id: "Starter",
    name: "Starter Pack",
    price: "2 USDC",
    credits: "1,000 Credits",
    description: "Entry top-up mapped to the backend Starter payment plan.",
    features: ["Base USDC checkout", "Webhook adds 1,000 credits", "Good for light API usage"],
    actionLabel: "Top Up 2 USDC",
    highlighted: false,
  },
  {
    id: "Standard",
    name: "Standard Pack",
    price: "4 USDC",
    credits: "3,000 Credits",
    description: "Recommended top-up mapped to the backend Standard payment plan.",
    features: ["Base USDC checkout", "Webhook adds 3,000 credits", "Best fit for recurring usage"],
    actionLabel: "Top Up 4 USDC",
    highlighted: true,
  },
  {
    id: "Advanced",
    name: "Advanced Pack",
    price: "6 USDC",
    credits: "5,000 Credits",
    description: "Highest quick top-up mapped to the backend Advanced payment plan.",
    features: ["Base USDC checkout", "Webhook adds 5,000 credits", "Suitable for heavier workloads"],
    actionLabel: "Top Up 6 USDC",
    highlighted: false,
  },
] as const satisfies ReadonlyArray<{
  id: PaymentPlanId;
  name: string;
  price: string;
  credits: string;
  description: string;
  features: readonly string[];
  actionLabel: string;
  highlighted: boolean;
}>;

const PAYMENT_TOKEN_OPTIONS = [
  {
    id: "base-usdc",
    label: "Base USDC",
    chainLabel: "Base · Chain ID 8453",
    symbol: "USDC",
    chainId: "8453",
    address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    description: "Official USDC on Base, ready for the current KiraPay checkout flow.",
  },
] as const;

const CUSTOM_PLAN = {
  title: "Custom Plan",
  description: "For larger monthly usage, team access, or bespoke enterprise needs.",
  label: "Flexible",
  actionLabel: "Contact on Telegram",
  href: SUPPORT_CONTACT_URL,
} as const;

type InsightsTab = "usage" | "history";

const formatHistoryDate = (value: string) => {
  if (!value) {
    return "Unknown date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const formatHistoryTimestamp = (value: string) => {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const getHistorySourceLabel = (value: string) => {
  if (value === "topup") {
    return "Top Up";
  }
  if (value === "signup") {
    return "Signup";
  }
  if (value === "telegram") {
    return "Telegram";
  }
  if (value === "referral") {
    return "Referral";
  }
  return "Other";
};

const getHistorySourceTone = (value: string) => {
  if (value === "topup") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (value === "signup") {
    return "border-sky-200 bg-sky-50 text-sky-700";
  }
  if (value === "telegram") {
    return "border-cyan-200 bg-cyan-50 text-cyan-700";
  }
  if (value === "referral") {
    return "border-violet-200 bg-violet-50 text-violet-700";
  }
  return "border-slate-200 bg-slate-50 text-slate-700";
};

const formatSignedCredits = (value: number) => `${value > 0 ? "+" : ""}${value.toLocaleString()}`;

const formatUsdAmount = (value: string) => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return "$0.00";
  }

  return parsed.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatTelegramUsername = (value: string) => {
  if (!value) {
    return "";
  }

  return value.startsWith("@") ? value : `@${value}`;
};

const Dashboard = ({
  sessionUser,
  profile,
  latestApiKey,
  referralProfile,
  resolvedReferral,
  statusMessage,
  errorMessage,
  usage,
  usageRange,
  usageError,
  creditsHistory,
  creditsHistoryError,
  creditsHistoryRange,
  creditsHistorySource,
  creditsHistoryDirection,
  isProfileLoading,
  isCreatingApiKey,
  isRotatingApiKey,
  isBindingTelegram,
  isLoggingOut,
  isUsageLoading,
  isCreditsHistoryLoading,
  isTelegramWidgetReady,
  paymentSession,
  paymentStatus,
  isCreatingPayment,
  activePaymentPlanId,
  isCheckingPaymentStatus,
  telegramWidgetContent,
  onRefreshProfile,
  onUsageRangeChange,
  onCreditsHistoryRangeChange,
  onCreditsHistorySourceChange,
  onCreditsHistoryDirectionChange,
  onCreditsHistoryPageChange,
  onCreateApiKey,
  onRotateApiKey,
  onBindTelegram,
  onCreatePayment,
  onOpenPaymentCheckout,
  onCheckPaymentStatus,
  onLogout,
}: DashboardProps) => {
  const [copiedValue, setCopiedValue] = useState<"" | "key" | "handle" | "twitterId" | "referralCode" | "referralLink">("");
  const [selectedPaymentTokenId, setSelectedPaymentTokenId] = useState<(typeof PAYMENT_TOKEN_OPTIONS)[number]["id"]>(PAYMENT_TOKEN_OPTIONS[0].id);
  const [insightsTab, setInsightsTab] = useState<InsightsTab>("usage");

  const activeProfile = profile ?? {
    ...sessionUser,
    telegramId: "",
    baseCredits: creditsHistory.cards.topUpCredits + creditsHistory.cards.signupBonus,
    telegramBonus: creditsHistory.cards.telegramBonus,
    referralBonus: creditsHistory.cards.referralBonus,
    totalCredits:
      creditsHistory.cards.topUpCredits +
      creditsHistory.cards.signupBonus +
      creditsHistory.cards.telegramBonus +
      creditsHistory.cards.referralBonus,
    creditsUsed: Math.max(
      creditsHistory.cards.topUpCredits +
        creditsHistory.cards.signupBonus +
        creditsHistory.cards.telegramBonus +
        creditsHistory.cards.referralBonus -
        creditsHistory.flowSummary.currentBalance,
      0,
    ),
    remainingCredits: creditsHistory.flowSummary.currentBalance,
    hasActiveApiKey: false,
    apiKeyPreview: "",
    apiKeyLast4: "",
    telegramConnected: false,
    telegramUsername: "",
    referralCode: "",
    referralCount: referralProfile?.peopleReferred ?? 0,
    statusLabel: "Signed in",
  };

  const referralLink = useMemo(() => {
    if (referralProfile?.referralLink) {
      return referralProfile.referralLink;
    }

    const referralCode = referralProfile?.referralCode || activeProfile.referralCode;

    if (!referralCode) {
      return "";
    }

    const origin = typeof window === "undefined" ? "" : window.location.origin;
    return `${origin}/?ref=${encodeURIComponent(referralCode)}`;
  }, [activeProfile.referralCode, referralProfile?.referralCode, referralProfile?.referralLink]);

  const peopleReferred = referralProfile?.peopleReferred ?? activeProfile.referralCount;
  const paidReferrals = referralProfile?.stats.paidReferrals ?? referralProfile?.paidReferrals ?? 0;
  const referralPaymentCount = referralProfile?.stats.referralPaymentCount ?? referralProfile?.referralPaymentCount ?? 0;
  const creditsEarned = referralProfile?.creditsEarned ?? activeProfile.referralBonus;
  const claimableAmountUsd = referralProfile?.stats.claimableAmountUsd ?? referralProfile?.claimableAmountUsd ?? "0";
  const referralItems = referralProfile?.referrals ?? [];
  const inviterDisplay = resolvedReferral?.inviterHandle || resolvedReferral?.inviterName;
  const referralCodeValue = referralProfile?.referralCode || activeProfile.referralCode;
  const shouldShowReferralInviteBanner = Boolean(resolvedReferral?.isValid && !activeProfile.telegramConnected);
  const apiKeyStatusText = activeProfile.hasActiveApiKey
    ? `Active key available${activeProfile.apiKeyLast4 ? ` · ${activeProfile.apiKeyLast4}` : activeProfile.apiKeyPreview ? ` · ${activeProfile.apiKeyPreview}` : ""}`
    : "No API key created";
  const paidReferralRate = peopleReferred > 0 ? (paidReferrals / peopleReferred) * 100 : 0;
  const claimableAmountNumber = Number(claimableAmountUsd);
  const averageClaimablePerPayment =
    referralPaymentCount > 0 && Number.isFinite(claimableAmountNumber) ? claimableAmountNumber / referralPaymentCount : 0;

  const averageDailyUsage = useMemo(() => {
    if (!usage.days.length) {
      return 0;
    }

    return usage.totalCreditsUsed / usage.days.length;
  }, [usage.days.length, usage.totalCreditsUsed]);

  useEffect(() => {
    console.log("[referral-ui] state", {
      search: typeof window === "undefined" ? "" : window.location.search,
      shouldShowReferralInviteBanner,
      resolvedReferral,
      inviterDisplay: inviterDisplay || null,
      telegramConnected: activeProfile.telegramConnected,
      referralCodeValue: referralCodeValue || null,
      referralLink: referralLink || null,
      peopleReferred,
      referralItemsCount: referralItems.length,
    });
  }, [
    activeProfile.telegramConnected,
    inviterDisplay,
    peopleReferred,
    referralCodeValue,
    referralItems.length,
    referralLink,
    resolvedReferral,
    shouldShowReferralInviteBanner,
  ]);

  const balanceOverview = useMemo(() => {
    const allocatedBaseCredits = Math.max(
      creditsHistory.cards.topUpCredits + creditsHistory.cards.signupBonus,
      activeProfile.baseCredits,
    );
    const telegramBonus = Math.max(creditsHistory.cards.telegramBonus, activeProfile.telegramBonus);
    const referralBonus = Math.max(creditsHistory.cards.referralBonus, activeProfile.referralBonus, creditsEarned);
    const totalCredits = Math.max(
      allocatedBaseCredits + telegramBonus + referralBonus,
      activeProfile.totalCredits,
    );
    const remainingCredits = Math.max(
      creditsHistory.flowSummary.currentBalance,
      creditsHistory.currentBalance,
      activeProfile.remainingCredits,
    );
    const creditsUsed = Math.max(totalCredits - remainingCredits, activeProfile.creditsUsed, 0);
    const baseCredits = Math.max(allocatedBaseCredits, totalCredits - telegramBonus - referralBonus, 0);
    const referralCount = Math.max(activeProfile.referralCount, peopleReferred);
    const usagePercent = totalCredits > 0 ? Math.min((creditsUsed / totalCredits) * 100, 100) : 0;

    return {
      baseCredits,
      creditsUsed,
      referralBonus,
      referralCount,
      remainingCredits,
      telegramBonus,
      totalCredits,
      usagePercent,
    };
  }, [
    activeProfile.baseCredits,
    activeProfile.creditsUsed,
    activeProfile.referralBonus,
    activeProfile.referralCount,
    activeProfile.remainingCredits,
    activeProfile.telegramBonus,
    activeProfile.totalCredits,
    creditsHistory.cards.referralBonus,
    creditsHistory.cards.signupBonus,
    creditsHistory.cards.telegramBonus,
    creditsHistory.cards.topUpCredits,
    creditsEarned,
    creditsHistory.currentBalance,
    creditsHistory.flowSummary.currentBalance,
    peopleReferred,
  ]);

  const creditsEventsItems = useMemo(
    () =>
      [...creditsHistory.events].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [creditsHistory.events],
  );

  const creditsHistoryChartData = useMemo(() => {
    return [...creditsHistory.chart]
      .map((entry) => ({
        ...entry,
        label: formatHistoryDate(entry.date),
      }))
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime());
  }, [creditsHistory.chart]);

  const filteredHistoryAddedAmount = creditsHistory.flowSummary.visibleCreditsAdded;
  const filteredHistoryDeductedAmount = Math.abs(creditsHistory.flowSummary.visibleCreditsDeducted);

  const selectedPaymentToken = useMemo(
    () => PAYMENT_TOKEN_OPTIONS.find((option) => option.id === selectedPaymentTokenId) ?? PAYMENT_TOKEN_OPTIONS[0],
    [selectedPaymentTokenId],
  );
  const activePaymentSessionId = paymentStatus?.sessionId || paymentStatus?.id || paymentSession?.id || "";
  const activePaymentState = paymentStatus?.status || paymentSession?.status || null;
  const activePaymentCheckoutUrl = paymentSession?.checkoutUrl || "";
  const activePaymentExpiresAt = paymentSession?.expiresAt || "";
  const activePaymentPlan = paymentSession?.plan;
  const activePaymentMatched = paymentStatus?.paymentMatched ?? paymentSession?.paymentMatched ?? false;
  const activeWebhookReceived = paymentStatus?.webhookReceived ?? paymentSession?.webhookReceived ?? activePaymentMatched;
  const activePaymentPaid = paymentStatus?.paid ?? paymentSession?.paid ?? false;
  const activePaymentTxHash = paymentStatus?.paymentTxHash || paymentSession?.paymentTxHash || "";
  const activePaymentId = paymentStatus?.paymentId || paymentSession?.paymentId || "";
  const activePaymentRecordedAt = paymentStatus?.paymentRecordedAt || paymentSession?.paymentRecordedAt || "";
  const activePaymentPaidAt = paymentStatus?.paidAt || paymentSession?.paidAt || "";
  const activePaymentCredits = paymentStatus?.creditsToAdd || paymentSession?.creditsToAdd || activePaymentPlan?.credits || 0;
  const hasPendingPaymentSession = activePaymentState === "pending" && Boolean(activePaymentPlan);
  const isPaymentSynced = activePaymentState === "success" && (activePaymentMatched || activeWebhookReceived);
  const paymentStatusTone =
    activePaymentState === "success"
      ? "border-emerald-300/60 bg-emerald-50 text-emerald-700"
      : activePaymentState === "expired"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : "border-amber-300/60 bg-amber-50 text-amber-700";
  const paymentStatusLabel =
    activePaymentState === "success" ? "Paid" : activePaymentState === "expired" ? "Expired" : activePaymentState === "pending" ? "Pending" : "";
  const formattedPaymentExpiry = activePaymentExpiresAt ? new Date(activePaymentExpiresAt).toLocaleString() : "";

  const copyText = async (
    value: string,
    type: "key" | "handle" | "twitterId" | "referralCode" | "referralLink",
  ) => {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedValue(type);
    window.setTimeout(() => setCopiedValue(""), 1800);
  };

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 border-b bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <PawIcon size={32} />
            <span className="text-xl font-extrabold">
              Paw<span className="text-primary">X</span> AI
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{activeProfile.name}</p>
              <p className="text-xs text-muted-foreground">{activeProfile.handle}</p>
            </div>
            <img
              src={activeProfile.avatar}
              alt={activeProfile.name}
              className="h-9 w-9 rounded-full border-2 border-primary/30"
            />
            <Button variant="outline" size="sm" onClick={onLogout} disabled={isLoggingOut}>
              <LogOut className="h-4 w-4" />
              {isLoggingOut ? "Signing out..." : "Logout"}
            </Button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border bg-card p-6 shadow-card md:p-8"
        >
          <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
            <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-background p-5">
              <div className="flex items-start gap-4">
                <img
                  src={activeProfile.avatar}
                  alt={activeProfile.name}
                  className="h-20 w-20 rounded-2xl border border-primary/20 object-cover shadow-[0_12px_30px_rgba(251,146,60,0.18)]"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Developer Identity
                  </p>
                  <h1 className="mt-2 truncate text-2xl font-extrabold">{activeProfile.name}</h1>
                  <a
                    href={activeProfile.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {activeProfile.handle}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <div className="rounded-2xl border bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Twitter ID</p>
                  <p className="mt-1 break-all text-sm font-semibold">{activeProfile.twitterId}</p>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">API access</p>
                  <p className="mt-1 text-sm font-semibold">{apiKeyStatusText}</p>
                </div>
                <div className="rounded-2xl border bg-background/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Telegram</p>
                  <p className="mt-1 text-sm font-semibold">
                    {activeProfile.telegramConnected
                      ? activeProfile.telegramUsername || "Connected"
                      : "Not connected yet"}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="outline" onClick={onRefreshProfile} disabled={isProfileLoading}>
                  <RefreshCw className={`h-4 w-4 ${isProfileLoading ? "animate-spin" : ""}`} />
                  {isProfileLoading ? "Refreshing..." : "Refresh"}
                </Button>
                <Button variant="outline" onClick={() => copyText(activeProfile.handle, "handle")}>
                  {copiedValue === "handle" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedValue === "handle" ? "Copied handle" : "Copy Handle"}
                </Button>
                <Button variant="outline" onClick={() => copyText(activeProfile.twitterId, "twitterId")}>
                  {copiedValue === "twitterId" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copiedValue === "twitterId" ? "Copied ID" : "Copy Twitter ID"}
                </Button>
                <Button variant="outline" asChild>
                  <a href={activeProfile.profileUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Open X Profile
                  </a>
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-3xl border bg-background/70 p-6 lg:p-7">
                <div className="flex flex-col gap-6 lg:gap-8">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Credit Balance</p>
                    <p className="mt-3 text-5xl font-extrabold leading-none md:text-6xl xl:text-7xl">{balanceOverview.remainingCredits.toLocaleString()}</p>
                    <p className="mt-3 max-w-md text-base text-muted-foreground">
                      Remaining credits / {balanceOverview.totalCredits.toLocaleString()} total allocated credits
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
                      <span className="rounded-full border bg-background px-3 py-1">{activeProfile.statusLabel}</span>
                      <span className="rounded-full border bg-background px-3 py-1">
                        {activeProfile.hasActiveApiKey ? "API key active" : "API key pending"}
                      </span>
                      <span className="rounded-full border bg-background px-3 py-1">
                        {activeProfile.telegramConnected ? "Telegram linked" : "Telegram not linked"}
                      </span>
                      {referralCodeValue ? <span className="rounded-full border bg-background px-3 py-1">Referral unlocked</span> : null}
                    </div>
                  </div>

                    <div className="w-full max-w-lg space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Used {balanceOverview.creditsUsed.toLocaleString()}</span>
                          <span>{balanceOverview.usagePercent.toFixed(1)}%</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-muted">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                            initial={{ width: 0 }}
                            animate={{ width: `${balanceOverview.usagePercent}%` }}
                            transition={{ duration: 0.7, ease: "easeOut" }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Current {balanceOverview.remainingCredits.toLocaleString()}</span>
                          <span>Total {balanceOverview.totalCredits.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: "Base Credits", value: balanceOverview.baseCredits },
                          { label: "Telegram Bonus", value: balanceOverview.telegramBonus },
                          { label: "Referral Bonus", value: balanceOverview.referralBonus },
                          { label: "Referral Count", value: balanceOverview.referralCount },
                        ].map((item) => (
                          <div key={item.label} className="rounded-2xl border bg-muted/40 p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.label}</p>
                            <p className="mt-2 text-2xl font-extrabold">{item.value.toLocaleString()}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-muted/30 p-5">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold">Referral Access</p>
                    </div>

                    {shouldShowReferralInviteBanner ? (
                      <p className="mt-4 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                        {inviterDisplay
                          ? `Invited by ${inviterDisplay}. Link Telegram to apply this referral.`
                          : "Referral link detected. Link Telegram to apply this referral."}
                      </p>
                    ) : null}

                    <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                      <div className="rounded-2xl bg-background p-4">
                        <p className="text-xs text-muted-foreground">Referral Code</p>
                        <p className="mt-2 break-all text-sm font-semibold">
                          {referralCodeValue || (activeProfile.telegramConnected ? "Waiting for backend response" : "Unlock after Telegram link")}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-background p-4">
                        <p className="text-xs text-muted-foreground">Referral Link</p>
                        <p className="mt-2 break-all text-sm font-semibold text-muted-foreground">
                          {referralLink || (activeProfile.telegramConnected ? "Waiting for backend response" : "Link Telegram first to unlock your referral link")}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {referralCodeValue ? (
                        <Button variant="outline" size="sm" onClick={() => copyText(referralCodeValue, "referralCode")}>
                          {copiedValue === "referralCode" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedValue === "referralCode" ? "Copied code" : "Copy Referral Code"}
                        </Button>
                      ) : null}
                      {referralLink ? (
                        <Button variant="outline" size="sm" onClick={() => copyText(referralLink, "referralLink")}>
                          {copiedValue === "referralLink" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          {copiedValue === "referralLink" ? "Copied link" : "Copy Referral Link"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {statusMessage ? (
            <p className="mt-4 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
              {statusMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </motion.section>

        <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border bg-card p-6 shadow-card"
          >
            <div className="mb-4 flex items-center gap-3">
              <KeyRound className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">API Key Management</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-sm font-medium">Current status</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {activeProfile.hasActiveApiKey
                    ? `Active key available${activeProfile.apiKeyLast4 ? ` · ${activeProfile.apiKeyLast4}` : activeProfile.apiKeyPreview ? ` · ${activeProfile.apiKeyPreview}` : ""}. Rotating will replace it and invalidate the old key.`
                    : "No API key has been created yet. Use Create API Key to generate one."}
                </p>
              </div>

              {latestApiKey ? (
                <div className="space-y-4 rounded-2xl border-2 border-primary/30 bg-primary/10 p-5">
                  <div className="space-y-1">
                    <p className="text-lg font-bold text-foreground sm:text-xl">New API Key</p>
                    <p className="text-sm text-muted-foreground">Save the full key now. If you leave or refresh, it will disappear.</p>
                  </div>
                  <div className="rounded-xl border bg-background px-4 py-4">
                    <p className="break-all font-mono text-base font-semibold tracking-wide text-foreground sm:text-lg">{latestApiKey}</p>
                  </div>
                  <Button variant="outline" size="lg" className="w-full sm:w-auto" onClick={() => copyText(latestApiKey, "key")}>
                    {copiedValue === "key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedValue === "key" ? "Copied key" : "Copy key"}
                  </Button>
                </div>
              ) : null}

              {!activeProfile.hasActiveApiKey ? (
                <Button className="w-full" onClick={onCreateApiKey} disabled={isCreatingApiKey || isProfileLoading}>
                  <KeyRound className="h-4 w-4" />
                  {isCreatingApiKey ? "Creating API Key..." : "Create API Key"}
                </Button>
              ) : (
                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={onRotateApiKey}
                  disabled={isRotatingApiKey || isProfileLoading}
                >
                  <RefreshCw className={`h-4 w-4 ${isRotatingApiKey ? "animate-spin" : ""}`} />
                  {isRotatingApiKey ? "Rotating API Key..." : "Rotate API Key"}
                </Button>
              )}

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-sm font-medium text-foreground">Shown once only</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save the full key now. If you leave or refresh, it will disappear. Rotating disables the old key and only the new key will work.
                </p>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border bg-card p-6 shadow-card"
          >
            <div className="mb-4 flex items-center gap-3">
              <Send className="h-5 w-5 text-[hsl(200,80%,50%)]" />
              <h2 className="text-lg font-bold">Link Telegram</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Telegram account to unlock your referral code and earn
                  <span className="ml-1 font-semibold text-[hsl(28,94%,53%)]">+1,500 bonus credits</span>
                </p>
              </div>

              <div className="relative">
                {activeProfile.telegramConnected ? (
                  <div className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[hsl(200,80%,50%)]/70 px-4 text-sm font-medium text-white">
                    <Send className="h-4 w-4" />
                    <span>{`Connected${activeProfile.telegramUsername ? ` · ${activeProfile.telegramUsername}` : ""}`}</span>
                  </div>
                ) : (
                  <Button
                    className="w-full bg-[hsl(200,80%,50%)] text-white hover:bg-[hsl(200,80%,45%)]"
                    onClick={onBindTelegram}
                    disabled={isBindingTelegram}
                  >
                    <Send className="h-4 w-4" />
                    {isBindingTelegram ? "Connecting Telegram..." : !isTelegramWidgetReady ? "Preparing Telegram..." : "Connect Telegram"}
                  </Button>
                )}
                {!activeProfile.telegramConnected ? telegramWidgetContent : null}
              </div>

              {activeProfile.telegramConnected ? (
                <div className="rounded-xl border border-[hsl(200,80%,50%)]/20 bg-[hsl(200,80%,50%)]/5 p-4">
                  <p className="text-sm font-medium text-foreground">Telegram linked successfully</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {activeProfile.telegramUsername
                      ? `Connected as ${activeProfile.telegramUsername}`
                      : "Your Telegram account is connected and ready for referral credits."}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[hsl(200,80%,50%)]/30 bg-[hsl(200,80%,50%)]/5 p-4">
                  <p className="text-sm text-muted-foreground">
                    {isTelegramWidgetReady
                      ? "Click Connect Telegram to open the Telegram authorization window. Once approved, the account will be linked automatically."
                      : "Preparing the Telegram authorization widget. You can continue as soon as it is ready."}
                  </p>
                </div>
              )}
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border bg-card p-6 shadow-card"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-[hsl(28,94%,53%)]" />
                <h2 className="text-lg font-bold">Referral Stats</h2>
              </div>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Track conversion, referral bonus credits, and claimable payout activity from the API referral scope in one place.
              </p>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
              {referralCodeValue
                ? `Referral code live · ${referralCodeValue}`
                : activeProfile.telegramConnected
                  ? "Referral code is syncing from the backend."
                  : "Link Telegram to unlock your referral link and referral tracking."}
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-muted/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">People Referred</p>
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="mt-4 text-3xl font-extrabold">{peopleReferred.toLocaleString()}</p>
              <p className="mt-1 text-xs text-muted-foreground">Users who joined through your referral link.</p>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-emerald-900">Paid Referrals</p>
                <Check className="h-4 w-4 text-emerald-700" />
              </div>
              <p className="mt-4 text-3xl font-extrabold text-emerald-700">{paidReferrals.toLocaleString()}</p>
              <p className="mt-1 text-xs text-emerald-700/80">Unique referred users with at least one payment.</p>
            </div>

            <div className="rounded-2xl border border-sky-200/80 bg-sky-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-sky-900">Payment Count</p>
                <RefreshCw className="h-4 w-4 text-sky-700" />
              </div>
              <p className="mt-4 text-3xl font-extrabold text-sky-700">{referralPaymentCount.toLocaleString()}</p>
              <p className="mt-1 text-xs text-sky-700/80">Total referral payment records returned by the API.</p>
            </div>

            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-amber-900">Credits Earned</p>
                <Link2 className="h-4 w-4 text-amber-700" />
              </div>
              <p className="mt-4 text-3xl font-extrabold text-[hsl(28,94%,53%)]">+{creditsEarned.toLocaleString()}</p>
              <p className="mt-1 text-xs text-amber-700/80">Credits from referral bonus ledger events.</p>
            </div>

            <div className="rounded-2xl border border-violet-200/80 bg-violet-50/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-violet-900">Claimable Amount</p>
                <Wallet className="h-4 w-4 text-violet-700" />
              </div>
              <p className="mt-4 text-3xl font-extrabold text-violet-700">{formatUsdAmount(claimableAmountUsd)}</p>
              <p className="mt-1 text-xs text-violet-700/80">Current claimable USD accumulated from referral payments.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="rounded-3xl border bg-muted/30 p-5">
              <p className="text-sm font-semibold">Performance Snapshot</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {peopleReferred > 0
                  ? `${paidReferralRate.toFixed(0)}% of referred users have already generated payment activity.`
                  : "Share your referral link to start tracking joined users, payments, and claimable amounts."}
              </p>

              <div className="mt-5 space-y-3">
                <div className="rounded-2xl bg-background px-4 py-3">
                  <p className="text-xs text-muted-foreground">Paid Conversion</p>
                  <p className="mt-1 text-lg font-bold">{peopleReferred > 0 ? `${paidReferralRate.toFixed(1)}%` : "0.0%"}</p>
                </div>
                <div className="rounded-2xl bg-background px-4 py-3">
                  <p className="text-xs text-muted-foreground">Average Claimable / Payment</p>
                  <p className="mt-1 text-lg font-bold">
                    {referralPaymentCount > 0 ? formatUsdAmount(String(averageClaimablePerPayment)) : "$0.00"}
                  </p>
                </div>
                <div className="rounded-2xl bg-background px-4 py-3">
                  <p className="text-xs text-muted-foreground">Referral Link Status</p>
                  <p className="mt-1 text-lg font-bold">{referralLink ? "Ready to share" : "Locked"}</p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border bg-background/80">
              <div className="flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold">Referral Details</p>
                  <p className="text-xs text-muted-foreground">Each referred account now includes payment activity and claimable payout data.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">{referralItems.length.toLocaleString()} users</span>
                  {referralItems.length > 3 ? (
                    <span className="rounded-full border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground">
                      Showing all referrals
                    </span>
                  ) : null}
                </div>
              </div>

              {referralItems.length ? (
                <ScrollArea className={referralItems.length > 3 ? "max-h-[420px]" : undefined}>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>User</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Claimable</TableHead>
                          <TableHead>Latest Paid</TableHead>
                          <TableHead>Joined</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {referralItems.map((item, index) => {
                          const displayName = formatTelegramUsername(item.telegramUsername) || item.telegramId || `Referral ${index + 1}`;

                          return (
                            <TableRow key={`${item.telegramId || displayName}-${item.createdAt || index}`}>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  {item.telegramPhotoUrl ? (
                                    <img
                                      src={item.telegramPhotoUrl}
                                      alt={displayName}
                                      className="h-10 w-10 rounded-full border object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full border bg-muted/60">
                                      <Users className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-medium">{displayName}</p>
                                    <p className="text-xs text-muted-foreground">{item.telegramId ? `Telegram ID ${item.telegramId}` : "Telegram user"}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                                      item.hasPaid
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-slate-200 bg-slate-50 text-slate-700"
                                    }`}
                                  >
                                    {item.hasPaid ? "Paid" : "No payment"}
                                  </span>
                                  <span className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                    {item.paymentCount.toLocaleString()} payments
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-medium">{formatUsdAmount(item.claimableAmountUsd)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {item.latestPaidAt ? formatHistoryTimestamp(item.latestPaidAt) : "—"}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">{item.createdAt ? formatHistoryTimestamp(item.createdAt) : "—"}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              ) : (
                <div className="px-5 py-10 text-center text-sm text-muted-foreground">
                  No referrals yet. Once users join from your link, payment status and claimable amounts will appear here.
                </div>
              )}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="rounded-2xl border bg-card p-6 shadow-card"
        >
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-bold">Top Up API Credits</h2>
                <p className="text-sm text-muted-foreground">Professional top-up cards inspired by modern API billing dashboards.</p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <a href={SUPPORT_CONTACT_URL} target="_blank" rel="noreferrer">
                <MessageCircleMore className="h-4 w-4" />
                Contact Support
              </a>
            </Button>
          </div>

          <div className="mb-5 rounded-3xl border bg-muted/30 p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold">Settlement Token</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select which USDC network the KiraPay checkout should use. The frontend sends only planId, tokenOut, and redirectUrl, and the backend validates the final payload before creating the payment session.
                </p>
              </div>
              {!activeProfile.telegramConnected ? (
                <div className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                  Link Telegram first. The payment API blocks accounts that have not finished Telegram binding.
                </div>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {PAYMENT_TOKEN_OPTIONS.map((option) => {
                const isSelected = option.id === selectedPaymentToken.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setSelectedPaymentTokenId(option.id)}
                    className={`rounded-2xl border p-4 text-left transition-all ${
                      isSelected
                        ? "border-primary/40 bg-primary/10 shadow-[0_14px_30px_rgba(251,146,60,0.12)]"
                        : "border-border bg-background hover:border-primary/20"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{option.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{option.chainLabel}</p>
                      </div>
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{option.symbol}</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{option.description}</p>
                    <p className="mt-3 break-all text-xs text-muted-foreground">{option.address}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {activePaymentSessionId ? (
            <div className="mb-5 rounded-3xl border bg-background/70 p-5 md:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-base font-bold">Latest Payment Session</p>
                    {paymentStatusLabel ? (
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${paymentStatusTone}`}>{paymentStatusLabel}</span>
                    ) : null}
                  </div>
                  <p className="mt-2 break-all text-sm text-muted-foreground">{activePaymentSessionId}</p>
                  {activePaymentPlan ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {activePaymentPlan.id} · {activePaymentPlan.amount} USD · {activePaymentPlan.credits.toLocaleString()} credits
                    </p>
                  ) : null}
                  {formattedPaymentExpiry ? (
                    <p className="mt-2 text-sm text-muted-foreground">Expires at {formattedPaymentExpiry}</p>
                  ) : null}
                  {isPaymentSynced ? (
                    <p className="mt-2 text-sm text-emerald-700">Webhook sync finished. Credits have been written to the account and the balance can be refreshed safely.</p>
                  ) : activePaymentState === "success" ? (
                    <p className="mt-2 text-sm text-amber-700">Payment is confirmed, but the webhook is still syncing credits. Keep this page open while the status updates.</p>
                  ) : null}
                  {activePaymentState === "pending" ? (
                    <p className="mt-2 text-sm text-amber-700">
                      Checkout is still open. Re-clicking top up reuses the same popup, so the UI will not create a stack of duplicate checkout windows.
                    </p>
                  ) : null}
                  {activePaymentCredits ? (
                    <p className="mt-2 text-sm text-muted-foreground">Credits to add after successful webhook sync: {activePaymentCredits.toLocaleString()}</p>
                  ) : null}
                  {(activePaymentPaid || activePaymentMatched || activeWebhookReceived) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className={`rounded-full border px-3 py-1 ${activePaymentPaid ? "border-emerald-300/60 bg-emerald-50 text-emerald-700" : "bg-background"}`}>
                        {activePaymentPaid ? "Invoice paid" : "Invoice pending"}
                      </span>
                      <span
                        className={`rounded-full border px-3 py-1 ${
                          activePaymentMatched || activeWebhookReceived ? "border-emerald-300/60 bg-emerald-50 text-emerald-700" : "bg-background"
                        }`}
                      >
                        {activePaymentMatched || activeWebhookReceived ? "Webhook matched" : "Webhook pending"}
                      </span>
                    </div>
                  )}
                  {activePaymentPaidAt ? (
                    <p className="mt-2 text-sm text-muted-foreground">Paid at {new Date(activePaymentPaidAt).toLocaleString()}</p>
                  ) : null}
                  {activePaymentRecordedAt ? (
                    <p className="mt-2 text-sm text-muted-foreground">Recorded at {new Date(activePaymentRecordedAt).toLocaleString()}</p>
                  ) : null}
                  {activePaymentId ? (
                    <p className="mt-2 break-all text-xs text-muted-foreground">Payment ID: {activePaymentId}</p>
                  ) : null}
                  {activePaymentTxHash ? (
                    <p className="mt-2 break-all text-xs text-muted-foreground">Tx Hash: {activePaymentTxHash}</p>
                  ) : null}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  {activePaymentCheckoutUrl && activePaymentState === "pending" ? (
                    <Button variant="outline" onClick={onOpenPaymentCheckout}>
                      <ExternalLink className="h-4 w-4" />
                      Continue Checkout
                    </Button>
                  ) : null}
                  <Button onClick={() => onCheckPaymentStatus(activePaymentSessionId)} disabled={isCheckingPaymentStatus}>
                    <RefreshCw className={`h-4 w-4 ${isCheckingPaymentStatus ? "animate-spin" : ""}`} />
                    {isCheckingPaymentStatus ? "Refreshing..." : "Refresh Status"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-3">
            {TOP_UP_PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-3xl border p-5 transition-all ${
                  plan.highlighted
                    ? "border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background shadow-[0_16px_40px_rgba(251,146,60,0.12)]"
                    : "bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{plan.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  </div>
                  {plan.highlighted ? (
                    <span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">Popular</span>
                  ) : null}
                </div>

                <div className="mt-6">
                  <p className="text-3xl font-extrabold">{plan.price}</p>
                  <p className="mt-1 text-sm font-medium text-primary">{plan.credits}</p>
                </div>

                <div className="mt-5 space-y-2">
                  {plan.features.map((feature: string) => (
                    <div key={feature} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="mt-0.5 h-4 w-4 text-primary" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                {hasPendingPaymentSession ? (
                  <p className="mt-4 text-xs text-muted-foreground">
                    {activePaymentPlan?.id === plan.id
                      ? "This pending session will reopen the same checkout popup until it succeeds or expires."
                      : `A ${activePaymentPlan?.id} checkout is currently pending. Finish or refresh that session before starting a new one.`}
                  </p>
                ) : null}

                <Button
                  className="mt-6 w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  onClick={() =>
                    onCreatePayment(plan.id, {
                      chainId: selectedPaymentToken.chainId,
                      address: selectedPaymentToken.address,
                    })
                  }
                  disabled={isCreatingPayment || !activeProfile.telegramConnected || (hasPendingPaymentSession && activePaymentPlan?.id !== plan.id)}
                >
                  {isCreatingPayment && activePaymentPlanId === plan.id
                    ? "Creating Session..."
                    : hasPendingPaymentSession && activePaymentPlan?.id === plan.id
                      ? "Continue Pending Checkout"
                      : hasPendingPaymentSession
                        ? "Pending Session In Progress"
                        : plan.actionLabel}
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-3xl border bg-muted/30 p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <p className="text-base font-bold">{CUSTOM_PLAN.title}</p>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{CUSTOM_PLAN.label}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{CUSTOM_PLAN.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Credits from Starter, Standard, and Advanced are written by the KiraPay webhook after payment confirmation, not by a direct top-up call from the browser.
                </p>
              </div>
              <Button variant="outline" asChild>
                <a href={CUSTOM_PLAN.href} target="_blank" rel="noreferrer">
                  <MessageCircleMore className="h-4 w-4" />
                  {CUSTOM_PLAN.actionLabel}
                </a>
              </Button>
            </div>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border bg-card p-6 shadow-card"
        >
          <Tabs value={insightsTab} onValueChange={(value) => setInsightsTab(value as InsightsTab)}>
            <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-primary" />
                <div>
                  <h2 className="text-lg font-bold">Credit Insights</h2>
                  <p className="text-sm text-muted-foreground">Switch between burn rate analytics and your top-up / credits flow history.</p>
                </div>
              </div>

              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="usage">Usage Trend</TabsTrigger>
                <TabsTrigger value="history">Credits History</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="usage" className="space-y-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-base font-bold">Daily Usage ({usageRange === "7d" ? "Last 7 Days" : "Last 30 Days"})</h3>
                  <p className="text-sm text-muted-foreground">Track credits consumed and request count returned by the usage API for the selected range.</p>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-1">
                  {(["7d", "30d"] as UsageRange[]).map((range) => (
                    <Button
                      key={range}
                      variant={usageRange === range ? "default" : "ghost"}
                      size="sm"
                      onClick={() => onUsageRangeChange(range)}
                      disabled={isUsageLoading}
                    >
                      {range === "7d" ? "Last 7 days" : "Last 30 days"}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Credits Used in Range</p>
                  <p className="mt-1 text-2xl font-extrabold">{usage.totalCreditsUsed.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">API Requests</p>
                  <p className="mt-1 text-2xl font-extrabold">{usage.totalRequestCount.toLocaleString()}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="mt-1 text-2xl font-extrabold">{usage.currentBalance.toLocaleString()}</p>
                </div>
              </div>

              {usageError ? (
                <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">{usageError}</p>
              ) : null}

              <div className="rounded-2xl border bg-background/80 p-4">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usage.days}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 25% 88%)" />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(20 10% 45%)" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(20 10% 45%)" }} />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(30 50% 98%)",
                          border: "1px solid hsl(30 25% 88%)",
                          borderRadius: "12px",
                          fontSize: "13px",
                        }}
                        formatter={(value: number, name: string) => [
                          Number(value).toLocaleString(),
                          name === "creditsUsed" ? "Credits Used" : "API Requests",
                        ]}
                        labelFormatter={(label: string, payload) =>
                          payload?.[0]?.payload?.date ? `${label} · ${payload[0].payload.date}` : label
                        }
                      />
                      <Bar dataKey="creditsUsed" fill="hsl(28 90% 55%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                <p>
                  {isUsageLoading
                    ? "Loading usage..."
                    : `Showing ${usage.days.length.toLocaleString()} daily points returned for ${usage.range} (${usage.rangeDays} days) · ${usage.apiKeyType || "session"} · avg ${averageDailyUsage.toFixed(1)}/day.`}
                </p>
                {!usageError ? <p>Tooltip includes daily request count for each bar.</p> : null}
              </div>

              {!usageError && (usage.twitterId || usage.telegramId || usage.accountStatus) ? (
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="rounded-full border px-3 py-1">Range {usage.range}</span>
                  <span className="rounded-full border px-3 py-1">Window {usage.rangeDays} days</span>
                  {usage.accountStatus ? <span className="rounded-full border px-3 py-1">Status {usage.accountStatus}</span> : null}
                  {usage.apiKeyType ? <span className="rounded-full border px-3 py-1">API Key {usage.apiKeyType}</span> : null}
                  {usage.twitterId ? <span className="rounded-full border px-3 py-1">Twitter ID {usage.twitterId}</span> : null}
                  {usage.telegramId ? <span className="rounded-full border px-3 py-1">Telegram ID {usage.telegramId}</span> : null}
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="history" className="space-y-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h3 className="text-base font-bold">Credits Flow & Top Up History</h3>
                  <p className="text-sm text-muted-foreground">Review each credit addition or deduction, with separate visual focus for inflows and outflows.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="min-w-[140px]">
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <Filter className="h-3.5 w-3.5" />
                      Range
                    </p>
                    <Select value={creditsHistoryRange} onValueChange={(value) => onCreditsHistoryRangeChange(value as CreditHistoryRange)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="all">All time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[140px]">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Source</p>
                    <Select value={creditsHistorySource} onValueChange={(value) => onCreditsHistorySourceChange(value as CreditHistorySource)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All sources</SelectItem>
                        <SelectItem value="topup">Top up only</SelectItem>
                        <SelectItem value="signup">Signup bonus</SelectItem>
                        <SelectItem value="telegram">Telegram bonus</SelectItem>
                        <SelectItem value="referral">Referral bonus</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="min-w-[180px]">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Direction</p>
                    <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1">
                      {([
                        { value: "all", label: "All" },
                        { value: "added", label: "Added" },
                        { value: "deducted", label: "Deducted" },
                      ] as Array<{ value: CreditsDirection; label: string }>).map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={creditsHistoryDirection === option.value ? "default" : "ghost"}
                          size="sm"
                          className="min-w-0 px-3 text-xs sm:text-sm"
                          onClick={() => onCreditsHistoryDirectionChange(option.value)}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/70 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Top Up Credits</p>
                  <p className="mt-2 text-3xl font-extrabold text-emerald-700">+{creditsHistory.cards.topUpCredits.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-emerald-700/80">API summary for paid credits matching the selected range and source.</p>
                </div>
                <div className="rounded-2xl border border-sky-200/70 bg-sky-50/70 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-sky-700">Signup Bonus</p>
                  <p className="mt-2 text-3xl font-extrabold text-sky-700">+{creditsHistory.cards.signupBonus.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-sky-700/80">API summary for first-time activation credits.</p>
                </div>
                <div className="rounded-2xl border border-cyan-200/70 bg-cyan-50/70 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-cyan-700">Telegram Bonus</p>
                  <p className="mt-2 text-3xl font-extrabold text-cyan-700">+{creditsHistory.cards.telegramBonus.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-cyan-700/80">API summary for Telegram bind bonuses and related credits.</p>
                </div>
                <div className="rounded-2xl border border-violet-200/70 bg-violet-50/70 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-violet-700">Referral Bonus</p>
                  <p className="mt-2 text-3xl font-extrabold text-violet-700">+{creditsHistory.cards.referralBonus.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-violet-700/80">API summary for credits earned from successful referrals.</p>
                </div>
              </div>

              {creditsHistoryError ? (
                <p className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">{creditsHistoryError}</p>
              ) : null}

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
                <div className="rounded-3xl border bg-background/80 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Credits History Chart</p>
                      <p className="text-xs text-muted-foreground">Green bars are additions, rose bars are deductions for the visible records.</p>
                    </div>
                    <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                      {isCreditsHistoryLoading ? "Syncing..." : `${creditsEventsItems.length.toLocaleString()} entries`}
                    </span>
                  </div>

                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={creditsHistoryChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(30 25% 88%)" />
                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(20 10% 45%)" }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "hsl(20 10% 45%)" }} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(30 50% 98%)",
                            border: "1px solid hsl(30 25% 88%)",
                            borderRadius: "12px",
                            fontSize: "13px",
                          }}
                          formatter={(value: number, name: string) => [
                            formatSignedCredits(Number(value)),
                            name === "addedCredits" ? "Credits Added" : "Credits Deducted",
                          ]}
                          labelFormatter={(label: string, payload) =>
                            payload?.[0]?.payload?.date ? `${label} · ${formatHistoryTimestamp(payload[0].payload.date)}` : label
                          }
                        />
                        <Bar dataKey="addedCredits" fill="hsl(142 71% 45%)" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="deductedCredits" fill="hsl(351 83% 61%)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <div className="rounded-3xl border bg-muted/30 p-5 min-h-[380px]">
                    <p className="text-sm font-semibold">Flow Summary</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                          Visible Credits Added
                        </div>
                        <span className="text-sm font-bold text-emerald-700">+{filteredHistoryAddedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <ArrowDownRight className="h-4 w-4 text-rose-600" />
                          Visible Credits Deducted
                        </div>
                        <span className="text-sm font-bold text-rose-700">-{filteredHistoryDeductedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Wallet className="h-4 w-4 text-primary" />
                          Current Balance
                        </div>
                        <span className="text-sm font-bold">{creditsHistory.currentBalance.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl bg-background px-4 py-3">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          Visible Entries
                        </div>
                        <span className="text-sm font-bold">{creditsHistory.flowSummary.visibleEntries.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border bg-background/80">
                <div className="flex flex-col gap-2 border-b px-5 py-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold">Credits Events</p>
                    <p className="text-xs text-muted-foreground">Use this ledger to inspect each top-up, signup reward, Telegram bonus, referral reward, or API call deduction.</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Page {creditsHistory.pagination.page} of {Math.max(creditsHistory.pagination.totalPages, 1)}
                  </span>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditsEventsItems.length ? (
                      creditsEventsItems.map((item, index) => (
                        <TableRow key={`${item.createdAt}-${item.eventType}-${index}`}>
                          <TableCell className="min-w-[160px] text-sm text-muted-foreground">{formatHistoryTimestamp(item.createdAt)}</TableCell>
                          <TableCell>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getHistorySourceTone(item.source)}`}>
                              {item.sourceLabel || getHistorySourceLabel(item.source)}
                            </span>
                          </TableCell>
                          <TableCell className="font-medium">{item.eventType || "Credit event"}</TableCell>
                          <TableCell className={`text-right font-semibold ${item.amount >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {formatSignedCredits(item.amount)}
                          </TableCell>
                          <TableCell className="text-right font-medium">{item.balanceAfter.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          {isCreditsHistoryLoading
                            ? "Loading credits history..."
                            : "No credits history matches the selected filters on this page."}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  {isCreditsHistoryLoading
                    ? "Refreshing credits history..."
                    : `Showing ${creditsEventsItems.length.toLocaleString()} visible entries on page ${creditsHistory.pagination.page} from ${creditsHistory.pagination.totalItems.toLocaleString()} API records.`}
                </p>

                <Pagination className="mx-0 w-auto justify-start md:justify-end">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (creditsHistory.pagination.page > 1 && !isCreditsHistoryLoading) {
                            onCreditsHistoryPageChange(creditsHistory.pagination.page - 1);
                          }
                        }}
                        className={creditsHistory.pagination.page <= 1 || isCreditsHistoryLoading ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                    <PaginationItem>
                      <span className="inline-flex h-9 items-center rounded-md border px-4 text-sm font-medium">
                        {creditsHistory.pagination.page} / {Math.max(creditsHistory.pagination.totalPages, 1)}
                      </span>
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        onClick={(event) => {
                          event.preventDefault();
                          if (creditsHistory.pagination.hasNextPage && !isCreditsHistoryLoading) {
                            onCreditsHistoryPageChange(creditsHistory.pagination.page + 1);
                          }
                        }}
                        className={!creditsHistory.pagination.hasNextPage || isCreditsHistoryLoading ? "pointer-events-none opacity-50" : ""}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            </TabsContent>
          </Tabs>
        </motion.section>

      </main>
    </div>
  );
};

export default Dashboard;
