import { useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import type { UserData } from "@/components/Dashboard";

const CreditHub = () => {
  const [user, setUser] = useState<UserData | null>(null);

  const handleTwitterLogin = () => {
    setUser({
      name: "CryptoWhale",
      handle: "@cryptowhale_ai",
      avatar: "https://api.dicebear.com/7.x/thumbs/svg?seed=cryptowhale",
      twitterConnected: true,
      telegramConnected: false,
      telegramUsername: "",
      referralCode: "",
      baseCredits: 2500,
      telegramBonus: 0,
      referralBonus: 0,
      creditsUsed: 0,
      referralCount: 0,
      dailyUsage: [
        { date: "Mar 15", used: 120 },
        { date: "Mar 16", used: 85 },
        { date: "Mar 17", used: 200 },
        { date: "Mar 18", used: 50 },
        { date: "Mar 19", used: 175 },
        { date: "Mar 20", used: 310 },
        { date: "Mar 21", used: 60 },
      ],
    });
  };

  const handleTelegramLink = () => {
    if (!user) return;
    setUser({
      ...user,
      telegramConnected: true,
      telegramUsername: "@cryptowhale_tg",
      referralCode: "PAWX-CW7K2",
      telegramBonus: 1500,
    });
  };

  const handleSimulateReferral = () => {
    if (!user) return;
    setUser({
      ...user,
      referralCount: user.referralCount + 1,
      referralBonus: user.referralBonus + 500,
    });
  };

  const handleSimulateUsage = () => {
    if (!user) return;
    const amount = Math.floor(Math.random() * 100) + 10;
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const updatedUsage = [...user.dailyUsage];
    const todayIdx = updatedUsage.findIndex((d) => d.date === today);
    if (todayIdx >= 0) {
      updatedUsage[todayIdx].used += amount;
    } else {
      updatedUsage.push({ date: today, used: amount });
    }
    setUser({
      ...user,
      creditsUsed: user.creditsUsed + amount,
      dailyUsage: updatedUsage.slice(-7),
    });
  };

  if (!user) {
    return <LoginScreen onLogin={handleTwitterLogin} />;
  }

  return (
    <Dashboard
      user={user}
      onLinkTelegram={handleTelegramLink}
      onSimulateReferral={handleSimulateReferral}
      onSimulateUsage={handleSimulateUsage}
    />
  );
};

export default CreditHub;
