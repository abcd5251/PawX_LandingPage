import { motion } from "framer-motion";
import { Copy, Check, Users, Zap, Send, BarChart3 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import PawIcon from "@/components/PawIcon";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface UserData {
  name: string;
  handle: string;
  avatar: string;
  twitterConnected: boolean;
  telegramConnected: boolean;
  telegramUsername: string;
  referralCode: string;
  baseCredits: number;
  telegramBonus: number;
  referralBonus: number;
  creditsUsed: number;
  referralCount: number;
  dailyUsage: { date: string; used: number }[];
}

interface DashboardProps {
  user: UserData;
  onLinkTelegram: () => void;
  onSimulateReferral: () => void;
  onSimulateUsage: () => void;
}

const Dashboard = ({ user, onLinkTelegram, onSimulateReferral, onSimulateUsage }: DashboardProps) => {
  const [copied, setCopied] = useState(false);
  const totalCredits = user.baseCredits + user.telegramBonus + user.referralBonus;
  const remaining = totalCredits - user.creditsUsed;
  const usagePercent = totalCredits > 0 ? (user.creditsUsed / totalCredits) * 100 : 0;
  const referralLink = user.referralCode ? `https://pawxai.com/ref/${user.referralCode}` : "";

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen">
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PawIcon size={32} />
            <span className="text-xl font-extrabold">
              Paw<span className="text-primary">X</span> AI
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.handle}</p>
            </div>
            <img
              src={user.avatar}
              alt={user.name}
              className="w-9 h-9 rounded-full border-2 border-primary/30"
            />
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border bg-card p-6 md:p-8 shadow-card"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Available Credits
              </p>
              <p className="text-5xl font-extrabold text-foreground">
                {remaining.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">
                of {totalCredits.toLocaleString()} total credits
              </p>
            </div>

            <div className="flex items-center gap-6 flex-wrap">
              <div className="space-y-2 min-w-[200px]">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Used: {user.creditsUsed.toLocaleString()}</span>
                  <span>{usagePercent.toFixed(1)}%</span>
                </div>
                <div className="h-3 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${usagePercent}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={onSimulateUsage}>
                Simulate Usage
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t">
            {[
              { label: "Base Credits", value: user.baseCredits, icon: "🎁" },
              { label: "Telegram Bonus", value: user.telegramBonus, icon: "📱" },
              { label: "Referral Bonus", value: user.referralBonus, icon: "🤝" },
              { label: "Total Used", value: user.creditsUsed, icon: "📊" },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 rounded-xl bg-muted/50">
                <span className="text-lg">{item.icon}</span>
                <p className="text-xl font-bold mt-1">{item.value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-3 mb-4">
              <Send className="w-5 h-5 text-[hsl(200,80%,50%)]" />
              <h2 className="text-lg font-bold">Link Telegram</h2>
            </div>

            {!user.telegramConnected ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Connect your Telegram account to unlock your <strong>Referral Code</strong> and earn{" "}
                  <span className="font-bold text-primary">+1,500 bonus credits</span>!
                </p>
                <Button
                  onClick={onLinkTelegram}
                  className="w-full bg-[hsl(200,80%,50%)] text-white hover:bg-[hsl(200,80%,45%)]"
                >
                  <Send className="w-4 h-4" />
                  Connect Telegram
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="font-medium">Connected as {user.telegramUsername}</span>
                </div>
                <div className="p-4 rounded-xl bg-muted/60 space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Your Referral Code</p>
                  <p className="text-2xl font-extrabold text-primary tracking-wider">{user.referralCode}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Referral Link</p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={referralLink}
                      className="flex-1 text-xs bg-muted/60 rounded-lg px-3 py-2 text-foreground border-0 outline-none"
                    />
                    <Button variant="outline" size="sm" onClick={handleCopy}>
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Each referral earns <span className="text-primary font-semibold">+500 credits</span> when they link both X & Telegram
                  </p>
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl border bg-card p-6 shadow-card"
          >
            <div className="flex items-center gap-3 mb-4">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-bold">Referral Stats</h2>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <p className="text-3xl font-extrabold text-foreground">{user.referralCount}</p>
                <p className="text-xs text-muted-foreground mt-1">People Referred</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/50 text-center">
                <p className="text-3xl font-extrabold text-primary">+{user.referralBonus.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground mt-1">Credits Earned</p>
              </div>
            </div>

            {user.telegramConnected ? (
              <Button variant="outline" className="w-full" onClick={onSimulateReferral}>
                <Users className="w-4 h-4" />
                Simulate New Referral (+500)
              </Button>
            ) : (
              <p className="text-sm text-muted-foreground text-center p-3 rounded-xl bg-muted/30">
                Link Telegram first to start earning referral credits
              </p>
            )}
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border bg-card p-6 shadow-card"
        >
          <div className="flex items-center gap-3 mb-6">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold">Daily Usage (Last 7 Days)</h2>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={user.dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 25%, 88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(20, 10%, 45%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(20, 10%, 45%)" }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(30, 50%, 98%)",
                    border: "1px solid hsl(30, 25%, 88%)",
                    borderRadius: "12px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="used" fill="hsl(28, 90%, 55%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </main>
    </div>
  );
};

export default Dashboard;
