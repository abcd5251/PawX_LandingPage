import { useCallback, useEffect, useRef, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AUTH_REDIRECT_STORAGE_KEY,
  bindTelegram,
  buildEmptyApiUsage,
  buildFallbackProfile,
  clearStoredReferralCode,
  createApiKey,
  createPaymentSession,
  CreditHubApiError,
  fetchApiKeyProfile,
  fetchPaymentSessionStatus,
  fetchReferralProfile,
  fetchApiUsage,
  fetchXSession,
  getStoredReferralCode,
  getTelegramBotUsername,
  getReadableAuthError,
  getXAuthorizationUrl,
  logoutXSession,
  persistReferralCodeFromUrl,
  resolveReferralCode,
  type ApiKeyProfile,
  type ApiUsageSeries,
  type PaymentPlanId,
  type PaymentSession,
  type PaymentSessionStatusResult,
  type PaymentTokenOut,
  type ReferralCodeResolution,
  type ReferralProfile,
  type TelegramAuthPayload,
  type UsageRange,
  type XSessionUser,
} from "@/lib/creditHubAuth";
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
        ? "Usage data for the last 30 days is temporarily unavailable. Showing the last 7 days instead."
        : "Daily usage data is temporarily unavailable. Please try again shortly.";
    }
  }

  return getReadableAuthError(error);
};

const getReadablePaymentError = (error: unknown, telegramConnected: boolean) => {
  if (error instanceof CreditHubApiError && error.status === 403 && !telegramConnected) {
    return "Payments require a Telegram-linked account before a KiraPay session can be created.";
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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [authError, setAuthError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [latestApiKey, setLatestApiKey] = useState("");
  const [referralProfile, setReferralProfile] = useState<ReferralProfile | null>(null);
  const [resolvedReferral, setResolvedReferral] = useState<ReferralCodeResolution | null>(null);
  const [usageRange, setUsageRange] = useState<UsageRange>("7d");
  const [usage, setUsage] = useState<ApiUsageSeries>(buildEmptyApiUsage("7d"));
  const [usageError, setUsageError] = useState("");
  const [isUsageLoading, setIsUsageLoading] = useState(false);
  const [isTelegramWidgetReady, setIsTelegramWidgetReady] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentSessionStatusResult | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isCheckingPaymentStatus, setIsCheckingPaymentStatus] = useState(false);
  const [activePaymentPlanId, setActivePaymentPlanId] = useState<PaymentPlanId | null>(null);
  const telegramWidgetContainerRef = useRef<HTMLDivElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthCallback = location.pathname === "/credit-hub/auth/callback";
  const isPaymentResultRoute = location.pathname === "/payment/result" || location.pathname === "/credit-hub/payment/result";
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

  const loadReferralProfile = useCallback(async () => {
    try {
      const nextReferralProfile = await fetchReferralProfile();
      setReferralProfile(nextReferralProfile);
      return nextReferralProfile;
    } catch (error) {
      if (error instanceof CreditHubApiError && error.status === 404) {
        setReferralProfile(null);
        return null;
      }

      throw error;
    }
  }, []);

  const loadResolvedReferral = useCallback(async (referralCode: string) => {
    const resolved = await resolveReferralCode(referralCode);
    setResolvedReferral(resolved);
    return resolved;
  }, []);

  useEffect(() => {
    const bootstrapSession = async () => {
      setIsLoading(true);
      setAuthError("");

      if (isAuthCallback) {
        setStatusMessage("Finishing X sign-in and loading your session and API key status...");
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
            setAuthError("X sign-in finished, but no valid session was found. Please verify that the backend callback successfully set the httpOnly cookie.");
          }
          return;
        }

        let nextProfile = await loadProfileForUser(authenticatedUser);

        if (!nextProfile.hasActiveApiKey) {
          const createdApiKey = await createApiKey(authenticatedUser, false);
          setLatestApiKey(createdApiKey.apiKey);
          setProfile(createdApiKey.profile);
          setSessionUser(toSessionUserFromProfile(createdApiKey.profile));
          nextProfile = await loadProfileForUser(toSessionUserFromProfile(createdApiKey.profile));
          setStatusMessage(
            `X sign-in succeeded. You are now in API Credits, and a new API key was created automatically. You currently have ${nextProfile.totalCredits.toLocaleString()} credits.`,
          );
        } else {
          setStatusMessage(
            `X sign-in succeeded. You are now in API Credits with ${nextProfile.remainingCredits.toLocaleString()} / ${nextProfile.totalCredits.toLocaleString()} credits available.`,
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
    const referralCode = persistReferralCodeFromUrl(location.search) ?? getStoredReferralCode();

    if (!referralCode) {
      setResolvedReferral(null);
      return;
    }

    void loadResolvedReferral(referralCode).catch(() => {
      void 0;
    });
  }, [loadResolvedReferral, location.search]);

  useEffect(() => {
    if (!sessionUser) {
      setUsage(buildEmptyApiUsage(usageRange));
      setUsageError("");
      return;
    }

    void loadUsage(usageRange).catch(() => {
      if (usageRange === "30d") {
        setStatusMessage("Usage data for the last 30 days is temporarily unavailable. Showing the last 7 days instead.");
        setUsageRange("7d");
      }
    });
  }, [loadUsage, sessionUser, usageRange]);

  useEffect(() => {
    if (!sessionUser) {
      setReferralProfile(null);
      return;
    }

    void loadReferralProfile().catch(() => {
      void 0;
    });
  }, [loadReferralProfile, profile?.telegramConnected, sessionUser]);

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
    try {
      await loadReferralProfile();
    } catch {
      void 0;
    }
  }, [loadProfileForUser, loadReferralProfile, loadUsage, sessionUser, usageRange]);

  const handleCheckPaymentStatus = useCallback(
    async (sessionId: string, options?: { clearQuery?: boolean; silent?: boolean }) => {
      if (!sessionUser) {
        return null;
      }

      setIsCheckingPaymentStatus(true);
      setAuthError("");

      if (!options?.silent) {
        setStatusMessage("Checking the latest KiraPay payment status...");
      }

      try {
        const nextPaymentStatus = await fetchPaymentSessionStatus(sessionId);
        setPaymentStatus(nextPaymentStatus);
        setPaymentSession((currentSession) =>
          currentSession && currentSession.id === nextPaymentStatus.id
            ? {
                ...currentSession,
                status: nextPaymentStatus.status,
                paid: nextPaymentStatus.status === "success",
                paidAt: nextPaymentStatus.status === "success" && !currentSession.paidAt ? new Date().toISOString() : currentSession.paidAt,
              }
            : currentSession,
        );

        if (nextPaymentStatus.status === "success") {
          await refreshProfile();
          setStatusMessage("Payment completed successfully. Credits and account balances were refreshed.");
        } else if (nextPaymentStatus.status === "expired") {
          setStatusMessage("");
          setAuthError("This payment session has expired. Please create a new session and try again.");
        } else {
          setStatusMessage("Payment session is still pending. Complete the checkout, then refresh the payment status.");
        }

        if (options?.clearQuery) {
          navigate("/credit-hub", { replace: true });
        }

        return nextPaymentStatus;
      } catch (error) {
        setStatusMessage("");
        setAuthError(getReadableAuthError(error));
        return null;
      } finally {
        setIsCheckingPaymentStatus(false);
      }
    },
    [navigate, refreshProfile, sessionUser],
  );

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
        setProfile(result.profile);
        await loadProfileForUser(sessionUser);
        setStatusMessage(
          rotateExisting
            ? "The API key was rotated successfully. The new full key is shown only this time."
            : "The API key was created successfully. The new full key is shown only this time.",
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

  const handleCreatePayment = useCallback(
    async (planId: PaymentPlanId, tokenOut: PaymentTokenOut) => {
      if (!sessionUser) {
        return;
      }

      const telegramConnected = profile?.telegramConnected ?? false;

      setAuthError("");
      setStatusMessage("");

      if (!telegramConnected) {
        setAuthError("Link Telegram before creating a KiraPay payment session.");
        return;
      }

      setIsCreatingPayment(true);
      setActivePaymentPlanId(planId);

      try {
        const nextPaymentSession = await createPaymentSession({ planId, tokenOut });
        setPaymentSession(nextPaymentSession);
        setPaymentStatus({ id: nextPaymentSession.id, status: nextPaymentSession.status });
        setStatusMessage(`Payment session created for ${planId}. Redirecting to the KiraPay checkout now...`);
        window.location.assign(nextPaymentSession.checkoutUrl);
      } catch (error) {
        setStatusMessage("");
        setAuthError(getReadablePaymentError(error, telegramConnected));
      } finally {
        setIsCreatingPayment(false);
        setActivePaymentPlanId(null);
      }
    },
    [profile?.telegramConnected, sessionUser],
  );

  const handleBindTelegramAuth = useCallback(
    async (user: TelegramWidgetUser) => {
      if (!sessionUser) {
        return;
      }

      if (!hasConcreteTwitterId(sessionUser.twitterId)) {
        setAuthError("A valid Twitter ID is not available yet. Please sign in again before linking Telegram.");
        setStatusMessage("");
        return;
      }

      const previousProfile = profile;

      setAuthError("");
      setStatusMessage("");
      setIsBindingTelegram(true);

      try {
        const storedReferralCode = getStoredReferralCode() || undefined;
        await bindTelegram({
          twitterId: sessionUser.twitterId,
          telegramAuth: toTelegramAuthPayload(user),
          referralCode: storedReferralCode,
        });

        const nextProfile = await loadProfileForUser(sessionUser);
        await loadReferralProfile();
        clearStoredReferralCode();
        setResolvedReferral(null);
        setStatusMessage(
          nextProfile.telegramConnected
            ? `Telegram linked successfully. Credits and account status were refreshed. You now have ${nextProfile.remainingCredits.toLocaleString()} / ${nextProfile.totalCredits.toLocaleString()} credits available.`
            : "Telegram authorization completed and the account status was refreshed.",
        );
      } catch (error) {
        try {
          const refreshedProfile = await loadProfileForUser(sessionUser);
          const previousCredits = previousProfile?.totalCredits ?? 0;
          const creditsIncreased = refreshedProfile.totalCredits > previousCredits;

          if (isTelegramBoundProfile(refreshedProfile) || creditsIncreased) {
            setAuthError("");
            try {
              await loadReferralProfile();
            } catch {
              void 0;
            }
            clearStoredReferralCode();
            setResolvedReferral(null);
            setStatusMessage(
              `Telegram linked successfully. Credits and account status were refreshed. You now have ${refreshedProfile.remainingCredits.toLocaleString()} / ${refreshedProfile.totalCredits.toLocaleString()} credits available.`,
            );
            return;
          }
        } catch {
          void 0;
        }

        if (error instanceof CreditHubApiError && error.status === 403) {
          setAuthError(`Telegram authorization completed, but the backend rejected the bind result. Please confirm bind-telegram is writing to the correct DB account with twitterId=${sessionUser.twitterId}.`);
          return;
        }

        setAuthError(getReadableAuthError(error));
      } finally {
        setIsBindingTelegram(false);
      }
    },
    [loadProfileForUser, loadReferralProfile, profile, sessionUser],
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
      setAuthError("Telegram bot username is missing. Please verify VITE_TELEGRAM_BOT_USERNAME.");
      return;
    }

    if (!hasConcreteTwitterId(sessionUser.twitterId)) {
      setStatusMessage("");
      setAuthError("A valid Twitter ID is not available yet. Please sign in again before linking Telegram.");
      return;
    }

    if (!isTelegramWidgetReady) {
      setStatusMessage("");
      setAuthError("The Telegram authorization widget is still loading. Please try again in a moment.");
      return;
    }

    setStatusMessage("Complete the confirmation inside the Telegram authorization window. The account will link automatically and refresh your credits.");
  }, [isTelegramWidgetReady, sessionUser, telegramBotUsername]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setAuthError("");
    setStatusMessage("");

    try {
      await logoutXSession();
      setSessionUser(null);
      setProfile(null);
      setLatestApiKey("");
      setReferralProfile(null);
      setResolvedReferral(null);
      setPaymentSession(null);
      setPaymentStatus(null);
      setUsageRange("7d");
      setUsage(buildEmptyApiUsage("7d"));
      setUsageError("");
    } catch (error) {
      setAuthError(getReadableAuthError(error));
    } finally {
      setIsLoggingOut(false);
    }
  }, []);

  useEffect(() => {
    const sessionId = new URLSearchParams(location.search).get("sessionId")?.trim();

    if (!sessionId || !sessionUser) {
      return;
    }

    if (!isPaymentResultRoute && location.pathname !== "/credit-hub") {
      return;
    }

    void handleCheckPaymentStatus(sessionId, { clearQuery: true, silent: false });
  }, [handleCheckPaymentStatus, isPaymentResultRoute, location.pathname, location.search, sessionUser]);

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
      referralProfile={referralProfile}
      resolvedReferral={resolvedReferral}
      statusMessage={statusMessage}
      errorMessage={authError}
      usage={usage}
      usageRange={usageRange}
      usageError={usageError}
      isProfileLoading={isProfileLoading}
      isCreatingApiKey={isCreatingApiKey}
      isRotatingApiKey={isRotatingApiKey}
      isBindingTelegram={isBindingTelegram}
      isLoggingOut={isLoggingOut}
      isUsageLoading={isUsageLoading}
      isTelegramWidgetReady={isTelegramWidgetReady}
      paymentSession={paymentSession}
      paymentStatus={paymentStatus}
      isCreatingPayment={isCreatingPayment}
      activePaymentPlanId={activePaymentPlanId}
      isCheckingPaymentStatus={isCheckingPaymentStatus}
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
      onCreateApiKey={() => {
        void handleCreateApiKey(false);
      }}
      onRotateApiKey={() => {
        void handleCreateApiKey(true);
      }}
      onBindTelegram={() => {
        void handleBindTelegram();
      }}
      onCreatePayment={(planId, tokenOut) => {
        void handleCreatePayment(planId, tokenOut);
      }}
      onCheckPaymentStatus={(sessionId) => {
        void handleCheckPaymentStatus(sessionId);
      }}
      onLogout={() => {
        void handleLogout();
      }}
    />
  );
};

export default CreditHub;
