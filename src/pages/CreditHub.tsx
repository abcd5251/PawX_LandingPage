import { useCallback, useEffect, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import type { UserData } from "@/components/Dashboard";
import { useLocation } from "react-router-dom";
import { bootstrapCreditHubUser, getReadableAuthError, getXAuthorizationUrl } from "@/lib/creditHubAuth";

const CreditHub = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirectingToX, setIsRedirectingToX] = useState(false);
  const [authError, setAuthError] = useState("");
  const location = useLocation();
  const isAuthCallback = location.pathname === "/credit-hub/auth/callback";

  const refreshAuthenticatedUser = useCallback(async () => {
    setIsLoading(true);
    setAuthError("");

    try {
      const authenticatedUser = await bootstrapCreditHubUser();
      setUser(authenticatedUser);

      if (!authenticatedUser && isAuthCallback) {
        setAuthError("X 登入完成後沒有讀到有效 session，請確認後端 callback 是否有成功寫入 httpOnly cookie。");
      }
    } catch (error) {
      setUser(null);
      setAuthError(getReadableAuthError(error));
    } finally {
      setIsLoading(false);
      setIsRedirectingToX(false);
    }
  }, [isAuthCallback]);

  useEffect(() => {
    void refreshAuthenticatedUser();
  }, [refreshAuthenticatedUser]);

  const handleTwitterLogin = () => {
    setAuthError("");
    setIsRedirectingToX(true);
    window.location.assign(getXAuthorizationUrl());
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
    return (
      <LoginScreen
        onLogin={handleTwitterLogin}
        isLoading={isLoading || isRedirectingToX}
        loadingLabel={isAuthCallback ? "Finishing X sign in..." : "Connecting to X..."}
        errorMessage={authError}
      />
    );
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
