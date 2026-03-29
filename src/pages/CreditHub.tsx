import { useCallback, useEffect, useRef, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AUTH_REDIRECT_STORAGE_KEY,
  bindTelegram,
  buildEmptyApiUsage,
  buildFallbackProfile,
  callProtectedApi,
  createApiKey,
  CreditHubApiError,
  fetchApiKeyProfile,
  fetchApiUsage,
  fetchXSession,
  getTelegramBotUsername,
  getReadableAuthError,
  getXAuthorizationUrl,
  logoutXSession,
  type ApiKeyProfile,
  type ApiUsageSeries,
  type TelegramAuthPayload,
  type UsageRange,
  type XSessionUser,
} from "@/lib/creditHubAuth";

const DEFAULT_PROTECTED_PATH = "/api/v1/twitterUsers/info?userId=44196397";
const TELEGRAM_WIDGET_CALLBACK_NAME = "__pawxTelegramAuth";

interface TelegramWidgetUser {
  id: number | string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

interface TelegramAuthWindow extends Window {
  [TELEGRAM_WIDGET_CALLBACK_NAME]?: (user: TelegramWidgetUser) => void;
}

const toTelegramAuthPayload = (user: TelegramWidgetUser): TelegramAuthPayload => ({
  id: String(user.id),
  first_name: user.first_name,
  last_name: user.last_name,
  username: user.username,
  photo_url: user.photo_url,
  auth_date: String(user.auth_date),
  hash: user.hash,
});

const isTelegramBoundProfile = (profile: ApiKeyProfile) =>
  profile.telegramConnected || Boolean(profile.telegramUsername) || profile.telegramBonus > 0;

const hasConcreteTwitterId = (twitterId: string) => Boolean(twitterId && twitterId !== "x-session");

const toSessionUserFromProfile = (nextProfile: ApiKeyProfile): XSessionUser => ({
  twitterId: nextProfile.twitterId,
  name: nextProfile.name,
  handle: nextProfile.handle,
  avatar: nextProfile.avatar,
  profileUrl: nextProfile.profileUrl,
});

const getReadableUsageError = (error: unknown, range: UsageRange) => {
  if (error instanceof CreditHubApiError) {
    if (error.message.toLowerCase().includes("generate_series")) {
      return range === "30d"
        ? "最近 30 天用量資料暫時無法讀取，已改為顯示最近 7 天。"
        : "每日用量資料暫時無法讀取，請稍後再試。";
    }
  }

  return getReadableAuthError(error);
};

const CreditHub = () => {
  const [sessionUser, setSessionUser] = useState<XSessionUser | null>(null);
  const [profile, setProfile] = useState<ApiKeyProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedirectingToX, setIsRedirectingToX] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isCreatingApiKey, setIsCreatingApiKey] = useState(false);
  const [isRotatingApiKey, setIsRotatingApiKey] = useState(false);
  const [isBindingTelegram, setIsBindingTelegram] = useState(false);
  const [isCallingProtectedApi, setIsCallingProtectedApi] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authError, setAuthError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [latestApiKey, setLatestApiKey] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [protectedPath, setProtectedPath] = useState(DEFAULT_PROTECTED_PATH);
  const [protectedResponse, setProtectedResponse] = useState("");
  const [usageRange, setUsageRange] = useState<UsageRange>("7d");
  const [usage, setUsage] = useState<ApiUsageSeries>(buildEmptyApiUsage("7d"));
  const [usageError, setUsageError] = useState("");
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const [isTelegramWidgetReady, setIsTelegramWidgetReady] = useState(false);
  const telegramWidgetContainerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthCallback = location.pathname === "/credit-hub/auth/callback";
  const telegramBotUsername = getTelegramBotUsername();

  const loadProfileForUser = useCallback(async (user: XSessionUser) => {
    setIsProfileLoading(true);

    try {
      const nextProfile = await fetchApiKeyProfile(user);
      setProfile(nextProfile);
      setSessionUser(toSessionUserFromProfile(nextProfile));
      return nextProfile;
    } catch (error) {
      if (error instanceof CreditHubApiError && error.status === 404) {
        const fallbackProfile = buildFallbackProfile(user);
        setProfile(fallbackProfile);
        setSessionUser(user);
        return fallbackProfile;
      }

      throw error;
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  const loadUsage = useCallback(async (range: UsageRange) => {
    setIsUsageLoading(true);
    setUsageError("");

    try {
      const nextUsage = await fetchApiUsage(range);
      setUsage(nextUsage);
      return nextUsage;
    } catch (error) {
      setUsageError(getReadableUsageError(error, range));
      throw error;
    } finally {
      setIsUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    const bootstrapSession = async () => {
      setIsLoading(true);
      setAuthError("");
      setProtectedResponse("");

      if (isAuthCallback) {
        setStatusMessage("正在完成 X 登入，準備讀取 session 與 API key 狀態...");
      } else {
        setStatusMessage("");
      }

      try {
        const authenticatedUser = await fetchXSession();
        setSessionUser(authenticatedUser);

        if (!authenticatedUser) {
          setProfile(null);
          window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
          if (isAuthCallback) {
            setAuthError("X 登入完成後沒有讀到有效 session，請確認後端 callback 是否有成功寫入 httpOnly cookie。");
          }
          return;
        }

        let nextProfile = await loadProfileForUser(authenticatedUser);

        if (!nextProfile.hasActiveApiKey) {
          const createdApiKey = await createApiKey(authenticatedUser, false);
          setLatestApiKey(createdApiKey.apiKey);
          setApiKeyInput(createdApiKey.apiKey);
          setProfile(createdApiKey.profile);
          setSessionUser(toSessionUserFromProfile(createdApiKey.profile));
          nextProfile = await loadProfileForUser(toSessionUserFromProfile(createdApiKey.profile));
          setStatusMessage(
            `X 登入成功，已進入 API Credits 頁面，並自動建立 API key。你目前有 ${nextProfile.totalCredits.toLocaleString()} credits。`,
          );
        } else {
          setStatusMessage(
            `X 登入成功，已進入 API Credits 頁面，目前可用 ${nextProfile.remainingCredits.toLocaleString()} / ${nextProfile.totalCredits.toLocaleString()} credits。`,
          );
        }

        if (isAuthCallback) {
          navigate("/credit-hub", { replace: true });
        }
        window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
      } catch (error) {
        setSessionUser(null);
        setProfile(null);
        setAuthError(getReadableAuthError(error));
        window.sessionStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
      } finally {
        setIsLoading(false);
        setIsRedirectingToX(false);
      }
    };

    void bootstrapSession();
  }, [isAuthCallback, loadProfileForUser, navigate]);

  useEffect(() => {
    if (!sessionUser) {
      setUsage(buildEmptyApiUsage(usageRange));
      setUsageError("");
      return;
    }

    void loadUsage(usageRange).catch(() => {
      if (usageRange === "30d") {
        setStatusMessage("最近 30 天用量資料暫時無法讀取，已改為顯示最近 7 天。");
        setUsageRange("7d");
      }
    });
  }, [loadUsage, sessionUser, usageRange]);

  const refreshProfile = useCallback(async () => {
    if (!sessionUser) {
      return;
    }

    setAuthError("");
    const nextProfile = await loadProfileForUser(sessionUser);
    setProfile(nextProfile);
    try {
      await loadUsage(usageRange);
    } catch {
      void 0;
    }
  }, [loadProfileForUser, loadUsage, sessionUser, usageRange]);

  const handleTwitterLogin = () => {
    setAuthError("");
    setStatusMessage("");
    setIsRedirectingToX(true);
    window.sessionStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, "1");
    window.location.assign(getXAuthorizationUrl());
  };

  const handleCreateApiKey = useCallback(
    async (rotateExisting = false) => {
      if (!sessionUser) {
        return;
      }

      setAuthError("");
      setStatusMessage("");

      if (rotateExisting) {
        setIsRotatingApiKey(true);
      } else {
        setIsCreatingApiKey(true);
      }

      try {
        const result = await createApiKey(sessionUser, rotateExisting);
        setLatestApiKey(result.apiKey);
        setApiKeyInput(result.apiKey);
        setProfile(result.profile);
        await loadProfileForUser(sessionUser);
        setStatusMessage(
          rotateExisting ? "API key 已 rotate，新的 key 只會顯示這一次。" : "API key 建立成功，新的 key 只會顯示這一次。",
        );
      } catch (error) {
        setAuthError(getReadableAuthError(error));
      } finally {
        if (rotateExisting) {
          setIsRotatingApiKey(false);
        } else {
          setIsCreatingApiKey(false);
        }
      }
    },
    [loadProfileForUser, sessionUser],
  );

  const handleBindTelegramAuth = useCallback(
    async (user: TelegramWidgetUser) => {
      if (!sessionUser) {
        return;
      }

      if (!hasConcreteTwitterId(sessionUser.twitterId)) {
        setAuthError("目前尚未讀到有效的 Twitter ID，請重新登入後再綁定 Telegram。");
        setStatusMessage("");
        return;
      }

      const previousProfile = profile;

      setAuthError("");
      setStatusMessage("");
      setIsBindingTelegram(true);

      try {
        await bindTelegram({
          twitterId: sessionUser.twitterId,
          telegramAuth: toTelegramAuthPayload(user),
        });

        const nextProfile = await loadProfileForUser(sessionUser);
        setStatusMessage(
          nextProfile.telegramConnected
            ? `Telegram 綁定成功，credits 與綁定狀態已刷新，目前可用 ${nextProfile.remainingCredits.toLocaleString()} / ${nextProfile.totalCredits.toLocaleString()} credits。`
            : "Telegram 綁定完成，已刷新帳號狀態。",
        );
      } catch (error) {
        try {
          const refreshedProfile = await loadProfileForUser(sessionUser);
          const previousCredits = previousProfile?.totalCredits ?? 0;
          const creditsIncreased = refreshedProfile.totalCredits > previousCredits;

          if (isTelegramBoundProfile(refreshedProfile) || creditsIncreased) {
            setAuthError("");
            setStatusMessage(
              `Telegram 綁定成功，credits 與綁定狀態已刷新，目前可用 ${refreshedProfile.remainingCredits.toLocaleString()} / ${refreshedProfile.totalCredits.toLocaleString()} credits。`,
            );
            return;
          }
        } catch {
          void 0;
        }

        if (error instanceof CreditHubApiError && error.status === 403) {
          setAuthError(`Telegram 已完成授權，但後端沒有接受這次綁定結果。請確認 bind-telegram 是否使用 twitterId=${sessionUser.twitterId} 寫入正確的 DB 帳號。`);
          return;
        }

        setAuthError(getReadableAuthError(error));
      } finally {
        setIsBindingTelegram(false);
      }
    },
    [loadProfileForUser, profile, sessionUser],
  );

  useEffect(() => {
    const widgetContainer = telegramWidgetContainerRef.current;

    setIsTelegramWidgetReady(false);

    if (!widgetContainer) {
      return;
    }

    if (!sessionUser || !telegramBotUsername || profile?.telegramConnected) {
      widgetContainer.innerHTML = "";
      return;
    }

    const telegramWindow = window as TelegramAuthWindow;
    const observer = new MutationObserver(() => {
      setIsTelegramWidgetReady(Boolean(widgetContainer.querySelector("iframe, button, a, [role='button']")));
    });

    telegramWindow[TELEGRAM_WIDGET_CALLBACK_NAME] = (user: TelegramWidgetUser) => {
      void handleBindTelegramAuth(user);
    };

    widgetContainer.innerHTML = "";
    observer.observe(widgetContainer, { childList: true, subtree: true });

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.onload = () => {
      window.setTimeout(() => {
        setIsTelegramWidgetReady(Boolean(widgetContainer.querySelector("iframe, button, a, [role='button']")));
      }, 150);
    };
    script.setAttribute("data-telegram-login", telegramBotUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-userpic", "true");
    script.setAttribute("data-onauth", `${TELEGRAM_WIDGET_CALLBACK_NAME}(user)`);
    widgetContainer.appendChild(script);

    return () => {
      observer.disconnect();
      setIsTelegramWidgetReady(false);
      widgetContainer.innerHTML = "";
      delete telegramWindow[TELEGRAM_WIDGET_CALLBACK_NAME];
    };
  }, [handleBindTelegramAuth, profile?.telegramConnected, sessionUser, telegramBotUsername]);

  const handleBindTelegram = useCallback(() => {
    if (!sessionUser) {
      return;
    }

    setAuthError("");
    if (!telegramBotUsername) {
      setStatusMessage("");
      setAuthError("缺少 Telegram bot username 設定，請確認 VITE_TELEGRAM_BOT_USERNAME。");
      return;
    }

    if (!hasConcreteTwitterId(sessionUser.twitterId)) {
      setStatusMessage("");
      setAuthError("目前尚未讀到有效的 Twitter ID，請重新登入後再綁定 Telegram。");
      return;
    }

    if (!isTelegramWidgetReady) {
      setStatusMessage("");
      setAuthError("Telegram 授權元件仍在準備中，請稍候再試一次。");
      return;
    }

    setStatusMessage("請在 Telegram 授權視窗完成確認，成功後會自動綁定帳號並刷新 credits。");
  }, [isTelegramWidgetReady, sessionUser, telegramBotUsername]);

  const handleCallProtectedApi = useCallback(async () => {
    if (!apiKeyInput.trim()) {
      setAuthError("請先建立、rotate，或手動貼上完整 API key 後再呼叫受保護 API。");
      return;
    }

    setAuthError("");
    setStatusMessage("");
    setIsCallingProtectedApi(true);

    try {
      const result = await callProtectedApi(protectedPath, apiKeyInput.trim());
      setProtectedResponse(`${result.ok ? "OK" : "ERROR"} ${result.status}\n${result.body}`);
      if (result.ok) {
        try {
          await loadUsage(usageRange);
        } catch {
          void 0;
        }
      }
      setStatusMessage(
        result.ok ? "受保護 API 呼叫完成。" : "受保護 API 回傳非 2xx，請檢查 key 權限、endpoint 或後端回應內容。",
      );
    } catch (error) {
      setProtectedResponse("");
      setAuthError(getReadableAuthError(error));
    } finally {
      setIsCallingProtectedApi(false);
    }
  }, [apiKeyInput, loadUsage, protectedPath, usageRange]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setAuthError("");
    setStatusMessage("");

    try {
      await logoutXSession();
      setSessionUser(null);
      setProfile(null);
      setLatestApiKey("");
      setApiKeyInput("");
      setProtectedResponse("");
      setProtectedPath(DEFAULT_PROTECTED_PATH);
      setUsageRange("7d");
      setUsage(buildEmptyApiUsage("7d"));
      setUsageError("");
    } catch (error) {
      setAuthError(getReadableAuthError(error));
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  if (!sessionUser) {
    return (
      <LoginScreen
        onLogin={handleTwitterLogin}
        isLoading={isLoading || isRedirectingToX}
        loadingLabel={isAuthCallback ? "Finishing X sign in..." : "Checking X session..."}
        errorMessage={authError}
      />
    );
  }

  return (
    <Dashboard
      sessionUser={sessionUser}
      profile={profile}
      latestApiKey={latestApiKey}
      apiKeyInput={apiKeyInput}
      protectedPath={protectedPath}
      protectedResponse={protectedResponse}
      statusMessage={statusMessage}
      errorMessage={authError}
      usage={usage}
      usageRange={usageRange}
      usageError={usageError}
      isProfileLoading={isProfileLoading}
      isCreatingApiKey={isCreatingApiKey}
      isRotatingApiKey={isRotatingApiKey}
      isBindingTelegram={isBindingTelegram}
      isCallingProtectedApi={isCallingProtectedApi}
      isLoggingOut={isLoggingOut}
      isUsageLoading={isUsageLoading}
      isTelegramWidgetReady={isTelegramWidgetReady}
      telegramWidgetContent={
        !profile?.telegramConnected ? (
          <div
            ref={telegramWidgetContainerRef}
            className="absolute inset-0 z-20 overflow-hidden opacity-0 [&_iframe]:!h-full [&_iframe]:!w-full [&_iframe]:!max-w-none"
          />
        ) : null
      }
      onRefreshProfile={() => {
        void refreshProfile();
      }}
      onUsageRangeChange={setUsageRange}
      onApiKeyInputChange={setApiKeyInput}
      onProtectedPathChange={setProtectedPath}
      onCreateApiKey={() => {
        void handleCreateApiKey(false);
      }}
      onRotateApiKey={() => {
        void handleCreateApiKey(true);
      }}
      onBindTelegram={() => {
        void handleBindTelegram();
      }}
      onCallProtectedApi={() => {
        void handleCallProtectedApi();
      }}
      onLogout={() => {
        void handleLogout();
      }}
    />
  );
};

export default CreditHub;
