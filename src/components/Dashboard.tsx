import { motion } from "framer-motion";
import { BarChart3, Check, Copy, KeyRound, Link2, LogOut, RefreshCw, Send, ShieldCheck, Users } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import PawIcon from "@/components/PawIcon";
import { Button } from "@/components/ui/button";
import type { ApiKeyProfile, ApiUsageSeries, ReferralCodeResolution, ReferralProfile, UsageRange, XSessionUser } from "@/lib/creditHubAuth";

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
  isProfileLoading: boolean;
  isCreatingApiKey: boolean;
  isRotatingApiKey: boolean;
  isBindingTelegram: boolean;
  isLoggingOut: boolean;
  isUsageLoading: boolean;
  isTelegramWidgetReady: boolean;
  telegramWidgetContent: ReactNode;
  onRefreshProfile: () => void;
  onUsageRangeChange: (value: UsageRange) => void;
  onCreateApiKey: () => void;
  onRotateApiKey: () => void;
  onBindTelegram: () => void;
  onLogout: () => void;
}

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
  isProfileLoading,
  isCreatingApiKey,
  isRotatingApiKey,
  isBindingTelegram,
  isLoggingOut,
  isUsageLoading,
  isTelegramWidgetReady,
  telegramWidgetContent,
  onRefreshProfile,
  onUsageRangeChange,
  onCreateApiKey,
  onRotateApiKey,
  onBindTelegram,
  onLogout,
}: DashboardProps) => {
  const [copiedValue, setCopiedValue] = useState<"" | "key" | "handle" | "twitterId" | "avatar" | "profileUrl" | "referralLink">("");

  const activeProfile = profile ?? {
    ...sessionUser,
    baseCredits: 0,
    telegramBonus: 0,
    referralBonus: 0,
    totalCredits: 0,
    creditsUsed: 0,
    remainingCredits: 0,
    hasActiveApiKey: false,
    apiKeyPreview: "",
    apiKeyLast4: "",
    telegramConnected: false,
    telegramUsername: "",
    referralCode: "",
    referralCount: 0,
    statusLabel: "Signed in",
  };

  const usagePercent = useMemo(() => {
    if (!activeProfile.totalCredits) {
      return 0;
    }

    return Math.min((activeProfile.creditsUsed / activeProfile.totalCredits) * 100, 100);
  }, [activeProfile.creditsUsed, activeProfile.totalCredits]);

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
  const creditsEarned = referralProfile?.creditsEarned ?? activeProfile.referralBonus;
  const inviterDisplay = resolvedReferral?.inviterHandle || resolvedReferral?.inviterName;

  const averageDailyUsage = useMemo(() => {
    if (!usage.days.length) {
      return 0;
    }

    return usage.totalCreditsUsed / usage.days.length;
  }, [usage.days.length, usage.totalCreditsUsed]);

  const copyText = async (
    value: string,
    type: "key" | "handle" | "twitterId" | "avatar" | "profileUrl" | "referralLink",
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
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Authenticated with X session
              </p>
              <div>
                <p className="text-3xl font-extrabold md:text-5xl">{activeProfile.remainingCredits.toLocaleString()}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Remaining credits / {activeProfile.totalCredits.toLocaleString()} total
                </p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                <span className="rounded-full border px-3 py-1">{activeProfile.statusLabel}</span>
                <span className="rounded-full border px-3 py-1">Twitter ID {activeProfile.twitterId}</span>
                <span className="rounded-full border px-3 py-1">
                  {activeProfile.hasActiveApiKey ? "API key active" : "No API key yet"}
                </span>
                {activeProfile.apiKeyLast4 ? (
                  <span className="rounded-full border px-3 py-1">Last4 {activeProfile.apiKeyLast4}</span>
                ) : null}
              </div>
            </div>

            <div className="w-full max-w-md space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Used {activeProfile.creditsUsed.toLocaleString()}</span>
                  <span>{usagePercent.toFixed(1)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Base Credits", value: activeProfile.baseCredits },
                  { label: "Telegram Bonus", value: activeProfile.telegramBonus },
                  { label: "Referral Bonus", value: activeProfile.referralBonus },
                  { label: "Referral Count", value: activeProfile.referralCount },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl bg-muted/60 p-3 text-center">
                    <p className="text-lg font-bold">{item.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-t pt-6">
            <Button variant="outline" onClick={onRefreshProfile} disabled={isProfileLoading}>
              <RefreshCw className={`h-4 w-4 ${isProfileLoading ? "animate-spin" : ""}`} />
              {isProfileLoading ? "Refreshing..." : "Refresh session/profile"}
            </Button>
            <Button variant="outline" onClick={() => copyText(activeProfile.handle, "handle")}>
              {copiedValue === "handle" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedValue === "handle" ? "Copied handle" : "Copy X handle"}
            </Button>
            <Button variant="outline" onClick={() => copyText(activeProfile.twitterId, "twitterId")}>
              {copiedValue === "twitterId" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedValue === "twitterId" ? "Copied ID" : "Copy Twitter ID"}
            </Button>
            <Button variant="outline" onClick={() => copyText(activeProfile.avatar, "avatar")}>
              {copiedValue === "avatar" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedValue === "avatar" ? "Copied avatar URL" : "Copy avatar URL"}
            </Button>
            <Button variant="outline" onClick={() => copyText(activeProfile.profileUrl, "profileUrl")}>
              {copiedValue === "profileUrl" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedValue === "profileUrl" ? "Copied profile URL" : "Copy profile URL"}
            </Button>
          </div>

          <div className="mt-6 grid gap-3 border-t pt-6 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: "Twitter Name", value: activeProfile.name },
              { label: "X Handle", value: activeProfile.handle },
              { label: "Twitter ID", value: activeProfile.twitterId },
              { label: "Avatar URL", value: activeProfile.avatar },
              { label: "Profile URL", value: activeProfile.profileUrl },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-muted/50 p-4">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                {item.label === "Avatar URL" || item.label === "Profile URL" ? (
                  <a
                    href={item.value}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 block break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="mt-1 break-all text-sm font-medium">{item.value}</p>
                )}
              </div>
            ))}
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

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
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

              {latestApiKey ? (
                <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-sm font-medium">New API key</p>
                  <p className="break-all text-sm">{latestApiKey}</p>
                  <Button variant="outline" size="sm" onClick={() => copyText(latestApiKey, "key")}>
                    {copiedValue === "key" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiedValue === "key" ? "Copied key" : "Copy key"}
                  </Button>
                </div>
              ) : null}
            </div>
          </motion.section>

          <div className="grid gap-8">
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
                  <Button
                    className="w-full bg-[hsl(200,80%,50%)] text-white hover:bg-[hsl(200,80%,45%)]"
                    onClick={onBindTelegram}
                    disabled={isBindingTelegram || activeProfile.telegramConnected}
                  >
                    <Send className="h-4 w-4" />
                    {activeProfile.telegramConnected
                      ? `Connected${activeProfile.telegramUsername ? ` · ${activeProfile.telegramUsername}` : ""}`
                      : isBindingTelegram
                        ? "Connecting Telegram..."
                        : !isTelegramWidgetReady
                          ? "Preparing Telegram..."
                          : "Connect Telegram"}
                  </Button>
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

            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="rounded-2xl border bg-card p-6 shadow-card"
            >
              <div className="mb-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-[hsl(28,94%,53%)]" />
                <h2 className="text-lg font-bold">Referral Stats</h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-3xl font-extrabold">{peopleReferred.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">People Referred</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-3xl font-extrabold text-[hsl(28,94%,53%)]">+{creditsEarned.toLocaleString()}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Credits Earned</p>
                </div>
              </div>

              <div className="mt-4 space-y-3 rounded-xl bg-muted/40 p-4">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Referral Link</p>
                </div>

                {resolvedReferral?.isValid && inviterDisplay && !activeProfile.telegramConnected ? (
                  <p className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
                    Invited by {inviterDisplay}. Link Telegram to apply this referral.
                  </p>
                ) : null}

                {referralLink ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-background px-4 py-3 text-sm">
                      <p className="mt-1 break-all text-muted-foreground">{referralLink}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => copyText(referralLink, "referralLink")}>
                      {copiedValue === "referralLink" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copiedValue === "referralLink" ? "Copied link" : "Copy Referral Link"}
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-xl bg-background px-4 py-3 text-sm text-muted-foreground">
                    {activeProfile.telegramConnected ? "Waiting for the backend to return your referral link" : "Link Telegram first to unlock your referral link"}
                  </p>
                )}
              </div>
            </motion.section>
          </div>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border bg-card p-6 shadow-card"
        >
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-bold">Daily Usage ({usageRange === "7d" ? "Last 7 Days" : "Last 30 Days"})</h2>
                <p className="text-sm text-muted-foreground">Track your daily credits used and request count for this account.</p>
              </div>
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
              <p className="text-xs text-muted-foreground">Credits Used</p>
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
            <p className="mb-4 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-700">{usageError}</p>
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

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              {isUsageLoading
                ? "Loading usage..."
                : `Showing ${usage.days.length.toLocaleString()} daily points for ${usage.range} · ${usage.apiKeyType || "session"} · avg ${averageDailyUsage.toFixed(1)}/day.`}
            </p>
            {!usageError ? <p>Tooltip includes daily request count for each bar.</p> : null}
          </div>

          {!usageError && (usage.twitterId || usage.telegramId || usage.accountStatus) ? (
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
              {usage.accountStatus ? <span className="rounded-full border px-3 py-1">Status {usage.accountStatus}</span> : null}
              {usage.apiKeyType ? <span className="rounded-full border px-3 py-1">API Key {usage.apiKeyType}</span> : null}
              {usage.twitterId ? <span className="rounded-full border px-3 py-1">Twitter ID {usage.twitterId}</span> : null}
              {usage.telegramId ? <span className="rounded-full border px-3 py-1">Telegram ID {usage.telegramId}</span> : null}
            </div>
          ) : null}
        </motion.section>

      </main>
    </div>
  );
};

export default Dashboard;
