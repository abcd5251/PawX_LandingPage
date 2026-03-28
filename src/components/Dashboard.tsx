import { motion } from "framer-motion";
import { Check, Copy, KeyRound, LogOut, RefreshCw, Send, ShieldCheck, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import PawIcon from "@/components/PawIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ApiKeyProfile, XSessionUser } from "@/lib/creditHubAuth";

interface DashboardProps {
  sessionUser: XSessionUser;
  profile: ApiKeyProfile | null;
  latestApiKey: string;
  apiKeyInput: string;
  protectedPath: string;
  protectedResponse: string;
  statusMessage: string;
  errorMessage: string;
  isProfileLoading: boolean;
  isCreatingApiKey: boolean;
  isRotatingApiKey: boolean;
  isBindingTelegram: boolean;
  isCallingProtectedApi: boolean;
  isLoggingOut: boolean;
  onRefreshProfile: () => void;
  onApiKeyInputChange: (value: string) => void;
  onProtectedPathChange: (value: string) => void;
  onCreateApiKey: () => void;
  onRotateApiKey: () => void;
  onBindTelegram: () => void;
  onCallProtectedApi: () => void;
  onLogout: () => void;
}

const protectedApiPresets = [
  "/api/v1/twitterUsers/info?userId=44196397",
  "/api/v1/twitterUsers/kol-users",
  "/api/v1/twitterUsers/tweets",
  "/api/v1/keywordMonitors",
];

const Dashboard = ({
  sessionUser,
  profile,
  latestApiKey,
  apiKeyInput,
  protectedPath,
  protectedResponse,
  statusMessage,
  errorMessage,
  isProfileLoading,
  isCreatingApiKey,
  isRotatingApiKey,
  isBindingTelegram,
  isCallingProtectedApi,
  isLoggingOut,
  onRefreshProfile,
  onApiKeyInputChange,
  onProtectedPathChange,
  onCreateApiKey,
  onRotateApiKey,
  onBindTelegram,
  onCallProtectedApi,
  onLogout,
}: DashboardProps) => {
  const [copiedValue, setCopiedValue] = useState<"" | "key" | "handle" | "twitterId" | "avatar" | "profileUrl">("");

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

  const copyText = async (value: string, type: "key" | "handle" | "twitterId" | "avatar" | "profileUrl") => {
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

        <div className="grid gap-8 lg:grid-cols-2">
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
                    ? `已有 active key${activeProfile.apiKeyLast4 ? `，last4 為 ${activeProfile.apiKeyLast4}` : activeProfile.apiKeyPreview ? ` (${activeProfile.apiKeyPreview})` : ""}，可 rotate 取得新 key。`
                    : "尚未建立 API key，可直接按 Create API Key。"}
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

              <div className="space-y-2">
                <p className="text-sm font-medium">API key for protected APIs</p>
                <Input
                  value={apiKeyInput}
                  onChange={(event) => onApiKeyInputChange(event.target.value)}
                  placeholder="建立或 rotate 後會自動帶入，也可手動貼上既有 key"
                />
                <p className="text-xs text-muted-foreground">
                  後端通常只會在建立或 rotate 當下回傳完整 key 一次，之後只能看到 preview。
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

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border bg-card p-6 shadow-card"
          >
            <div className="mb-4 flex items-center gap-3">
              <Send className="h-5 w-5 text-[hsl(200,80%,50%)]" />
              <h2 className="text-lg font-bold">Bind Telegram</h2>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl bg-muted/50 p-4">
                <p className="text-sm font-medium">
                  {activeProfile.telegramConnected
                    ? `已綁定 ${activeProfile.telegramUsername || "Telegram account"}`
                    : "尚未綁定 Telegram"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  綁定後可從後端更新 credits、推薦碼與 Telegram 狀態。
                </p>
              </div>

              <Button
                className="w-full bg-[hsl(200,80%,50%)] text-white hover:bg-[hsl(200,80%,45%)]"
                onClick={onBindTelegram}
                disabled={isBindingTelegram}
              >
                <Send className="h-4 w-4" />
                {isBindingTelegram ? "Binding Telegram..." : activeProfile.telegramConnected ? "Re-bind Telegram" : "Bind Telegram"}
              </Button>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Telegram Username</p>
                  <p className="mt-1 font-semibold">{activeProfile.telegramUsername || "Not linked"}</p>
                </div>
                <div className="rounded-xl bg-muted/50 p-4">
                  <p className="text-xs text-muted-foreground">Referral Code</p>
                  <p className="mt-1 font-semibold">{activeProfile.referralCode || "Waiting for backend"}</p>
                </div>
              </div>
            </div>
          </motion.section>
        </div>

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border bg-card p-6 shadow-card"
        >
          <div className="mb-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold">Protected API Test</h2>
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {protectedApiPresets.map((preset) => (
                <Button key={preset} variant="outline" size="sm" onClick={() => onProtectedPathChange(preset)}>
                  {preset}
                </Button>
              ))}
            </div>

            <Input
              value={protectedPath}
              onChange={(event) => onProtectedPathChange(event.target.value)}
              placeholder="/api/v1/twitterUsers/info?userId=44196397"
            />

            <div className="flex flex-wrap gap-3">
              <Button onClick={onCallProtectedApi} disabled={isCallingProtectedApi}>
                <ShieldCheck className="h-4 w-4" />
                {isCallingProtectedApi ? "Calling protected API..." : "Call protected API"}
              </Button>
              <p className="self-center text-sm text-muted-foreground">Header 會自動帶上 X-API-Key</p>
            </div>

            <Textarea
              value={protectedResponse}
              readOnly
              className="min-h-[240px] font-mono text-xs"
              placeholder={'呼叫結果會顯示在這裡，例如\n{\n  "status": 200,\n  "body": {...}\n}'}
            />
          </div>
        </motion.section>
      </main>
    </div>
  );
};

export default Dashboard;
