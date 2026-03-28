import { useCallback, useEffect, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AUTH_REDIRECT_STORAGE_KEY,
  bindTelegram,
  buildFallbackProfile,
  callProtectedApi,
  createApiKey,
  CreditHubApiError,
  fetchApiKeyProfile,
  fetchXSession,
  getReadableAuthError,
  getXAuthorizationUrl,
  logoutXSession,
  type ApiKeyProfile,
  type XSessionUser,
} from "@/lib/creditHubAuth";

const DEFAULT_PROTECTED_PATH = "/api/v1/twitterUsers/info?userId=44196397";

const toSessionUserFromProfile = (nextProfile: ApiKeyProfile): XSessionUser => ({
  twitterId: nextProfile.twitterId,
  name: nextProfile.name,
  handle: nextProfile.handle,
  avatar: nextProfile.avatar,
  profileUrl: nextProfile.profileUrl,
});

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
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthCallback = location.pathname === "/credit-hub/auth/callback";

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

  const refreshProfile = useCallback(async () => {
    if (!sessionUser) {
      return;
    }

    setAuthError("");
    const nextProfile = await loadProfileForUser(sessionUser);
    setProfile(nextProfile);
  }, [loadProfileForUser, sessionUser]);

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

  const handleBindTelegram = useCallback(async () => {
    if (!sessionUser) {
      return;
    }

    setAuthError("");
    setStatusMessage("");
    setIsBindingTelegram(true);

    try {
      await bindTelegram();
      const nextProfile = await loadProfileForUser(sessionUser);
      setStatusMessage(
        nextProfile.telegramConnected
          ? "Telegram 綁定狀態已更新。"
          : "Bind Telegram 請求已送出，若後端還有下一步驗證流程請繼續完成。",
      );
    } catch (error) {
      setAuthError(getReadableAuthError(error));
    } finally {
      setIsBindingTelegram(false);
    }
  }, [loadProfileForUser, sessionUser]);

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
      setStatusMessage(
        result.ok ? "受保護 API 呼叫完成。" : "受保護 API 回傳非 2xx，請檢查 key 權限、endpoint 或後端回應內容。",
      );
    } catch (error) {
      setProtectedResponse("");
      setAuthError(getReadableAuthError(error));
    } finally {
      setIsCallingProtectedApi(false);
    }
  }, [apiKeyInput, protectedPath]);

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
      isProfileLoading={isProfileLoading}
      isCreatingApiKey={isCreatingApiKey}
      isRotatingApiKey={isRotatingApiKey}
      isBindingTelegram={isBindingTelegram}
      isCallingProtectedApi={isCallingProtectedApi}
      isLoggingOut={isLoggingOut}
      onRefreshProfile={() => {
        void refreshProfile();
      }}
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
