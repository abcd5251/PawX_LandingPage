import { useCallback, useEffect, useRef, useState } from "react";
import LoginScreen from "@/components/LoginScreen";
import Dashboard from "@/components/Dashboard";
import { useLocation, useNavigate } from "react-router-dom";
import {
  AUTH_REDIRECT_STORAGE_KEY,
  bindTelegram,
  buildEmptyCreditsHistory,
  buildEmptyApiUsage,
  buildFallbackProfile,
  clearStoredReferralCode,
  createApiKey,
  createPaymentSession,
  CreditHubApiError,
  fetchCreditsHistory,
  fetchApiKeyProfile,
  fetchPaymentSession,
  fetchPaymentSessionStatus,
  fetchReferralProfile,
  fetchApiUsage,
  fetchXSession,
  getStoredReferralCode,
  getTelegramBotUsername,
  getReadableAuthError,
  getXAuthorizationUrl,
  logoutXSession,
  normalizeCreditsDirection,
  normalizeCreditHistoryRange,
  normalizeCreditHistorySource,
  persistReferralCodeFromUrl,
  resolveReferralCode,
  type ApiKeyProfile,
  type ApiUsageSeries,
  type CreditsDirection,
  type CreditsHistoryResponse,
  type CreditHistoryRange,
  type CreditHistorySource,
  type GetCreditsHistoryQuery,
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

const TELEGRAM_WIDGET_SCRIPT_ID = "pawx-telegram-widget-script";

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
  profile.telegramConnected || Boolean(profile.telegramUsername) || Boolean(profile.telegramId) || profile.telegramBonus > 0;

const hasConcreteTwitterId = (twitterId: string) => Boolean(twitterId && twitterId !== "x-session");

const toSessionUserFromProfile = (nextProfile: ApiKeyProfile): XSessionUser => ({
  twitterId: nextProfile.twitterId,
  name: nextProfile.name,
  handle: nextProfile.handle,
  avatar: nextProfile.avatar,
  profileUrl: nextProfile.profileUrl,
});

const pickConcreteSessionUser = (...candidates: Array<XSessionUser | null | undefined>) =>
  candidates.find((candidate): candidate is XSessionUser => Boolean(candidate && hasConcreteTwitterId(candidate.twitterId))) ??
  candidates.find((candidate): candidate is XSessionUser => Boolean(candidate)) ??
  null;

const isSameReferralCode = (left?: string | null, right?: string | null) =>
  (left || "").trim().toUpperCase() === (right || "").trim().toUpperCase();

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

const DEFAULT_CREDITS_HISTORY_FILTERS: Required<GetCreditsHistoryQuery> = {
  direction: "all",
  range: "30d",
  source: "all",
  page: 1,
  pageSize: 20,
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
  const [creditsHistoryFilters, setCreditsHistoryFilters] = useState<Required<GetCreditsHistoryQuery>>(DEFAULT_CREDITS_HISTORY_FILTERS);
  const [creditsHistory, setCreditsHistory] = useState<CreditsHistoryResponse>(buildEmptyCreditsHistory(DEFAULT_CREDITS_HISTORY_FILTERS));
  const [creditsHistoryError, setCreditsHistoryError] = useState("");
  const [isCreditsHistoryLoading, setIsCreditsHistoryLoading] = useState(false);
  const [isTelegramWidgetReady, setIsTelegramWidgetReady] = useState(false);
  const [paymentSession, setPaymentSession] = useState<PaymentSession | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentSessionStatusResult | null>(null);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isCheckingPaymentStatus, setIsCheckingPaymentStatus] = useState(false);
  const [activePaymentPlanId, setActivePaymentPlanId] = useState<PaymentPlanId | null>(null);
  const telegramWidgetContainerRef = useRef<HTMLDivElement | null>(null);
  const paymentPopupWindowRef = useRef<Window | null>(null);
  const paymentPollingSessionIdRef = useRef<string | null>(null);
  const paymentPollingStartedAtRef = useRef<number | null>(null);
  const telegramWidgetBootstrapTimerRef = useRef<number | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const isAuthCallback = location.pathname === "/credit-hub/auth/callback";
  const isPaymentResultRoute = location.pathname === "/payment/result" || location.pathname === "/credit-hub/payment/result";
  const telegramBotUsername = getTelegramBotUsername();
  const telegramLinked = Boolean(profile && isTelegramBoundProfile(profile));
  const dashboardProfile = profile ? { ...profile, telegramConnected: telegramLinked } : null;

  const openPaymentPopup = useCallback((checkoutUrl: string) => {
    if (typeof window === "undefined") {
      return false;
    }

    const popup = window.open(
      checkoutUrl,
      "pawx-kirapay-checkout",
      "popup=yes,width=520,height=860,resizable=yes,scrollbars=yes",
    );

    if (!popup) {
      return false;
    }

    paymentPopupWindowRef.current = popup;
    popup.focus();
    return true;
  }, []);

  const closePaymentPopup = useCallback(() => {
    if (paymentPopupWindowRef.current && !paymentPopupWindowRef.current.closed) {
      paymentPopupWindowRef.current.close();
    }

    paymentPopupWindowRef.current = null;
  }, []);

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

  const loadCreditsHistory = useCallback(async (query: GetCreditsHistoryQuery) => {
    setIsCreditsHistoryLoading(true);
    setCreditsHistoryError("");

    try {
      const nextHistory = await fetchCreditsHistory(query);
      setCreditsHistory(nextHistory);
      return nextHistory;
    } catch (error) {
      setCreditsHistoryError(getReadableAuthError(error));
      throw error;
    } finally {
      setIsCreditsHistoryLoading(false);
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

    let cancelled = false;

    void loadResolvedReferral(referralCode)
      .then((resolved: ReferralCodeResolution) => {
        if (cancelled) {
          return;
        }

        if (!resolved.isValid) {
          clearStoredReferralCode();
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedReferral(null);
        }
      });

    return () => {
      cancelled = true;
    };
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
      setCreditsHistory(buildEmptyCreditsHistory(creditsHistoryFilters));
      setCreditsHistoryError("");
      return;
    }

    void loadCreditsHistory(creditsHistoryFilters).catch(() => {
      void 0;
    });
  }, [creditsHistoryFilters, loadCreditsHistory, sessionUser]);

  useEffect(() => {
    if (!sessionUser) {
      setReferralProfile(null);
      return;
    }

    void loadReferralProfile().catch(() => {
      void 0;
    });
  }, [loadReferralProfile, sessionUser, telegramLinked]);

  const resolveTelegramBindingContext = useCallback(async () => {
    const currentProfile = profile;
    const currentSessionUser = sessionUser;
    const currentProfileSessionUser = currentProfile ? toSessionUserFromProfile(currentProfile) : null;

    if (currentProfile && isTelegramBoundProfile(currentProfile)) {
      return {
        session: pickConcreteSessionUser(currentSessionUser, currentProfileSessionUser),
        profile: currentProfile,
        alreadyBound: true,
      };
    }

    let nextSessionUser = pickConcreteSessionUser(currentSessionUser, currentProfileSessionUser);

    try {
      const refreshedSession = await fetchXSession();

      if (refreshedSession) {
        nextSessionUser = pickConcreteSessionUser(refreshedSession, nextSessionUser);
        setSessionUser(nextSessionUser);
      }
    } catch {
      void 0;
    }

    if (nextSessionUser) {
      try {
        const nextProfile = await loadProfileForUser(nextSessionUser);

        return {
          session: pickConcreteSessionUser(toSessionUserFromProfile(nextProfile), nextSessionUser, currentProfileSessionUser),
          profile: nextProfile,
          alreadyBound: isTelegramBoundProfile(nextProfile),
        };
      } catch (error) {
        if (!(error instanceof CreditHubApiError && error.status === 401)) {
          throw error;
        }
      }
    }

    return {
      session: pickConcreteSessionUser(nextSessionUser, currentProfileSessionUser),
      profile: currentProfile,
      alreadyBound: Boolean(currentProfile && isTelegramBoundProfile(currentProfile)),
    };
  }, [loadProfileForUser, profile, sessionUser]);

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
    try {
      await loadCreditsHistory(creditsHistoryFilters);
    } catch {
      void 0;
    }
  }, [creditsHistoryFilters, loadCreditsHistory, loadProfileForUser, loadReferralProfile, loadUsage, sessionUser, usageRange]);

  const settleTelegramLinkedState = useCallback(
    async (nextProfile: ApiKeyProfile, options?: { alreadyLinked?: boolean }) => {
      setAuthError("");
      try {
        await loadReferralProfile();
      } catch {
        void 0;
      }
      try {
        await loadCreditsHistory(creditsHistoryFilters);
      } catch {
        void 0;
      }
      clearStoredReferralCode();
      setResolvedReferral(null);
      setStatusMessage(
        options?.alreadyLinked
          ? `Telegram is already linked for this X account. You currently have ${nextProfile.remainingCredits.toLocaleString()} / ${nextProfile.totalCredits.toLocaleString()} credits available.`
          : `Telegram linked successfully. Credits and account status were refreshed. You now have ${nextProfile.remainingCredits.toLocaleString()} / ${nextProfile.totalCredits.toLocaleString()} credits available.`,
      );
    },
    [creditsHistoryFilters, loadCreditsHistory, loadReferralProfile],
  );

  const recoverTelegramBindAfterUnauthorized = useCallback(
    async (previousProfile?: ApiKeyProfile | null) => {
      const refreshedBindingContext = await resolveTelegramBindingContext();
      const refreshedProfile = refreshedBindingContext.profile;

      if (!refreshedProfile) {
        return false;
      }

      const previousCredits = previousProfile?.totalCredits ?? 0;
      const creditsIncreased = refreshedProfile.totalCredits > previousCredits;

      if (isTelegramBoundProfile(refreshedProfile) || creditsIncreased) {
        await settleTelegramLinkedState(refreshedProfile, {
          alreadyLinked: !creditsIncreased && isTelegramBoundProfile(refreshedProfile),
        });
        return true;
      }

      return false;
    },
    [resolveTelegramBindingContext, settleTelegramLinkedState],
  );

  const handleCheckPaymentStatus = useCallback(
    async (sessionId: string, options?: { includeSessionDetails?: boolean; silent?: boolean }) => {
      if (!sessionUser) {
        return null;
      }

      setIsCheckingPaymentStatus(true);
      setAuthError("");

      if (!options?.silent) {
        setStatusMessage("Checking the latest KiraPay payment status...");
      }

      try {
        const [nextPaymentStatus, nextPaymentSession] = await Promise.all([
          fetchPaymentSessionStatus(sessionId),
          options?.includeSessionDetails ? fetchPaymentSession(sessionId) : Promise.resolve(null),
        ]);
        setPaymentStatus(nextPaymentStatus);
        setPaymentSession((currentSession) =>
          nextPaymentSession
            ? nextPaymentSession
            : currentSession && currentSession.id === nextPaymentStatus.sessionId
              ? {
                  ...currentSession,
                  status: nextPaymentStatus.status,
                  paid: nextPaymentStatus.paid,
                  paidAt: nextPaymentStatus.paidAt,
                  paymentId: nextPaymentStatus.paymentId,
                  paymentMatched: nextPaymentStatus.paymentMatched,
                  paymentRecordedAt: nextPaymentStatus.paymentRecordedAt,
                  paymentTxHash: nextPaymentStatus.paymentTxHash,
                  webhookReceived: nextPaymentStatus.webhookReceived,
                  telegramId: nextPaymentStatus.telegramId,
                  twitterId: nextPaymentStatus.twitterId,
                  creditsToAdd: nextPaymentStatus.creditsToAdd || currentSession.creditsToAdd,
                }
              : currentSession,
        );

        const webhookSynced = nextPaymentStatus.paymentMatched || nextPaymentStatus.webhookReceived;

        if (nextPaymentStatus.status === "success" && webhookSynced) {
          closePaymentPopup();
          await refreshProfile();
          paymentPollingSessionIdRef.current = null;
          paymentPollingStartedAtRef.current = null;
          setStatusMessage("Payment completed successfully. Credits and account balances were refreshed.");
        } else if (nextPaymentStatus.status === "success") {
          setStatusMessage("Payment was confirmed. Waiting for the webhook to finish syncing credits to your account.");
        } else if (nextPaymentStatus.status === "expired") {
          closePaymentPopup();
          paymentPollingSessionIdRef.current = null;
          paymentPollingStartedAtRef.current = null;
          setStatusMessage("");
          setAuthError("This payment session has expired. Please create a new session and try again.");
        } else if (!options?.silent) {
          setStatusMessage("Payment session is still pending. Complete the checkout, then refresh the payment status.");
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
    [closePaymentPopup, refreshProfile, sessionUser],
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

      const telegramConnected = telegramLinked;

      setAuthError("");
      setStatusMessage("");

      if (!telegramConnected) {
        setAuthError("Link Telegram before creating a KiraPay payment session.");
        return;
      }

      if (paymentSession?.status === "pending" && paymentSession.checkoutUrl) {
        const popupOpened = openPaymentPopup(paymentSession.checkoutUrl);

        if (!popupOpened) {
          setAuthError("The checkout popup was blocked by the browser. Please allow popups for this site and try again.");
          return;
        }

        setStatusMessage("An existing pending payment session is already open. Reusing the same checkout window.");
        return;
      }

      setIsCreatingPayment(true);
      setActivePaymentPlanId(planId);

      try {
        const nextPaymentSession = await createPaymentSession({ planId, tokenOut });
        setPaymentSession(nextPaymentSession);
        setPaymentStatus({
          id: nextPaymentSession.id,
          sessionId: nextPaymentSession.id,
          planId: nextPaymentSession.plan.id,
          status: nextPaymentSession.status,
          paid: nextPaymentSession.paid,
          paidAt: nextPaymentSession.paidAt,
          paymentId: nextPaymentSession.paymentId,
          paymentMatched: nextPaymentSession.paymentMatched,
          paymentRecordedAt: nextPaymentSession.paymentRecordedAt,
          paymentTxHash: nextPaymentSession.paymentTxHash,
          creditsToAdd: nextPaymentSession.creditsToAdd,
          telegramId: nextPaymentSession.telegramId,
          twitterId: nextPaymentSession.twitterId,
          webhookReceived: nextPaymentSession.webhookReceived,
        });
        const popupOpened = openPaymentPopup(nextPaymentSession.checkoutUrl);

        if (!popupOpened) {
          setStatusMessage("");
          setAuthError("The checkout popup was blocked by the browser. Please allow popups for this site and try again.");
          return;
        }

        setStatusMessage(`Payment session created for ${planId}. The KiraPay checkout was opened in a single popup window.`);
      } catch (error) {
        setStatusMessage("");
        setAuthError(getReadablePaymentError(error, telegramConnected));
      } finally {
        setIsCreatingPayment(false);
        setActivePaymentPlanId(null);
      }
    },
    [openPaymentPopup, paymentSession, sessionUser, telegramLinked],
  );

  const handleOpenPaymentCheckout = useCallback(() => {
    if (!paymentSession?.checkoutUrl) {
      return;
    }

    setAuthError("");
    const popupOpened = openPaymentPopup(paymentSession.checkoutUrl);

    if (!popupOpened) {
      setStatusMessage("");
      setAuthError("The checkout popup was blocked by the browser. Please allow popups for this site and try again.");
      return;
    }

    setStatusMessage("Reopened the current KiraPay checkout in the same popup window.");
  }, [openPaymentPopup, paymentSession?.checkoutUrl]);

  const handleBindTelegramAuth = useCallback(
    async (user: TelegramWidgetUser) => {
      if (!sessionUser) {
        return;
      }

      const bindingContext = await resolveTelegramBindingContext();

      if (bindingContext.alreadyBound) {
        if (bindingContext.profile) {
          await settleTelegramLinkedState(bindingContext.profile, { alreadyLinked: true });
        }
        return;
      }

      const previousProfile = bindingContext.profile ?? profile;
      const activeSessionUser = pickConcreteSessionUser(
        bindingContext.session,
        sessionUser,
        previousProfile ? toSessionUserFromProfile(previousProfile) : null,
      );

      if (!activeSessionUser || !hasConcreteTwitterId(activeSessionUser.twitterId)) {
        setAuthError("The current X session could not be verified for Telegram binding. Please sign in with X again and retry the first-time link.");
        setStatusMessage("");
        return;
      }

      setAuthError("");
      setStatusMessage("");
      setIsBindingTelegram(true);

      try {
        const storedReferralCode = getStoredReferralCode();
        const hasStoredReferralCode = Boolean(storedReferralCode);
        const referralValidationFinished =
          !hasStoredReferralCode || Boolean(resolvedReferral && isSameReferralCode(resolvedReferral.referralCode, storedReferralCode));

        if (!referralValidationFinished) {
          setStatusMessage("");
          setAuthError("Referral code is still being verified. Please wait a moment and retry Telegram linking.");
          return;
        }

        const validatedReferralCode =
          resolvedReferral?.isValid && (resolvedReferral.referralCode || storedReferralCode)
            ? resolvedReferral.referralCode || storedReferralCode || undefined
            : undefined;

        await bindTelegram({
          telegramAuth: toTelegramAuthPayload(user),
          referralCode: validatedReferralCode,
        });

        const nextProfile = await loadProfileForUser(activeSessionUser);
        if (isTelegramBoundProfile(nextProfile)) {
          await settleTelegramLinkedState(nextProfile);
        } else {
          setStatusMessage("Telegram authorization completed and the account status was refreshed.");
        }
      } catch (error) {
        if (error instanceof CreditHubApiError && error.status === 401) {
          setAuthError("");
          setStatusMessage("Refreshing your X session and Telegram status...");

          try {
            const recovered = await recoverTelegramBindAfterUnauthorized(previousProfile);

            if (recovered) {
              return;
            }
          } catch {
            void 0;
          }

          setStatusMessage("");
          setAuthError("We couldn't confirm the current X session for a new Telegram link. Please sign in with X again only if this account has never been linked before.");
          setStatusMessage("");
          return;
        }

        try {
          const recovered = await recoverTelegramBindAfterUnauthorized(previousProfile);

          if (recovered) {
            return;
          }
        } catch {
          void 0;
        }

        if (error instanceof CreditHubApiError && error.status === 403) {
          setAuthError(`Telegram authorization completed, but the backend rejected the bind result. Please confirm bind-telegram is writing to the correct DB account with twitterId=${activeSessionUser.twitterId}.`);
          return;
        }

        setAuthError(getReadableAuthError(error));
      } finally {
        setIsBindingTelegram(false);
      }
    },
    [loadProfileForUser, profile, recoverTelegramBindAfterUnauthorized, resolveTelegramBindingContext, resolvedReferral, sessionUser, settleTelegramLinkedState],
  );

  useEffect(() => {
    const widgetContainer = telegramWidgetContainerRef.current;

    if (!widgetContainer) {
      return;
    }

    if (!sessionUser || !telegramBotUsername || telegramLinked) {
      if (telegramWidgetBootstrapTimerRef.current) {
        window.clearTimeout(telegramWidgetBootstrapTimerRef.current);
        telegramWidgetBootstrapTimerRef.current = null;
      }
      setIsTelegramWidgetReady(false);
      widgetContainer.innerHTML = "";
      return;
    }

    const telegramWindow = window as TelegramAuthWindow;
    let observer: MutationObserver | null = null;
    let cancelled = false;
    let handleScriptLoad: (() => void) | null = null;

    const updateWidgetReady = () => {
      if (cancelled) {
        return false;
      }

      const ready = Boolean(widgetContainer.querySelector("iframe, button, a, [role='button']"));
      setIsTelegramWidgetReady(ready);
      return ready;
    };

    const mountWidget = () => {
      if (cancelled) {
        return;
      }

      widgetContainer.innerHTML = "";
      observer?.disconnect();
      observer = new MutationObserver(() => {
        updateWidgetReady();
      });
      observer.observe(widgetContainer, { childList: true, subtree: true });

      const widgetMarkupScript = document.createElement("script");
      widgetMarkupScript.src = "https://telegram.org/js/telegram-widget.js?22";
      widgetMarkupScript.async = true;
      widgetMarkupScript.setAttribute("data-telegram-login", telegramBotUsername);
      widgetMarkupScript.setAttribute("data-size", "large");
      widgetMarkupScript.setAttribute("data-userpic", "true");
      widgetMarkupScript.setAttribute("data-request-access", "write");
      widgetMarkupScript.setAttribute("data-onauth", `${TELEGRAM_WIDGET_CALLBACK_NAME}(user)`);
      widgetContainer.appendChild(widgetMarkupScript);

      telegramWidgetBootstrapTimerRef.current = window.setTimeout(() => {
        if (!updateWidgetReady() && !cancelled) {
          setAuthError(
            `Telegram widget failed to initialize. Please verify BotFather /setdomain includes ${window.location.origin} and that the bot username is correct.`,
          );
        }
      }, 4000);
    };

    if (telegramWidgetBootstrapTimerRef.current) {
      window.clearTimeout(telegramWidgetBootstrapTimerRef.current);
      telegramWidgetBootstrapTimerRef.current = null;
    }

    setIsTelegramWidgetReady(false);
    setAuthError((currentError) =>
      currentError.startsWith("Telegram widget failed to initialize.") ? "" : currentError,
    );

    telegramWindow[TELEGRAM_WIDGET_CALLBACK_NAME] = (user: TelegramWidgetUser) => {
      void handleBindTelegramAuth(user);
    };

    const existingScript = document.getElementById(TELEGRAM_WIDGET_SCRIPT_ID) as HTMLScriptElement | null;

    if (existingScript?.dataset.loaded === "true") {
      mountWidget();
    } else {
      const sharedScript =
        existingScript ||
        Object.assign(document.createElement("script"), {
          id: TELEGRAM_WIDGET_SCRIPT_ID,
          src: "https://telegram.org/js/telegram-widget.js?22",
          async: true,
        });

      handleScriptLoad = () => {
        sharedScript.dataset.loaded = "true";
        mountWidget();
      };

      sharedScript.addEventListener("load", handleScriptLoad, { once: true });

      if (!existingScript) {
        document.body.appendChild(sharedScript);
      }
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      if (telegramWidgetBootstrapTimerRef.current) {
        window.clearTimeout(telegramWidgetBootstrapTimerRef.current);
        telegramWidgetBootstrapTimerRef.current = null;
      }
      if (existingScript && handleScriptLoad) {
        existingScript.removeEventListener("load", handleScriptLoad);
      }
      widgetContainer.innerHTML = "";
      setIsTelegramWidgetReady(false);
      delete telegramWindow[TELEGRAM_WIDGET_CALLBACK_NAME];
    };
  }, [handleBindTelegramAuth, sessionUser, telegramBotUsername, telegramLinked]);

  const handleBindTelegram = useCallback(() => {
    if (telegramLinked) {
      setAuthError("");
      setStatusMessage("Telegram is already linked for this X account.");
      return;
    }

    const activeSessionUser = pickConcreteSessionUser(sessionUser, profile ? toSessionUserFromProfile(profile) : null);

    if (!activeSessionUser) {
      return;
    }

    setAuthError("");
    if (!telegramBotUsername) {
      setStatusMessage("");
      setAuthError("Telegram bot username is missing. Please verify VITE_TELEGRAM_BOT_USERNAME.");
      return;
    }

    if (!hasConcreteTwitterId(activeSessionUser.twitterId)) {
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
  }, [isTelegramWidgetReady, profile, sessionUser, telegramBotUsername, telegramLinked]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    setAuthError("");
    setStatusMessage("");

    try {
      closePaymentPopup();
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
      setCreditsHistoryFilters(DEFAULT_CREDITS_HISTORY_FILTERS);
      setCreditsHistory(buildEmptyCreditsHistory(DEFAULT_CREDITS_HISTORY_FILTERS));
      setCreditsHistoryError("");
    } catch (error) {
      setAuthError(getReadableAuthError(error));
    } finally {
      setIsLoggingOut(false);
    }
  }, [closePaymentPopup]);

  useEffect(() => {
    return () => {
      closePaymentPopup();
    };
  }, [closePaymentPopup]);

  useEffect(() => {
    const sessionId = new URLSearchParams(location.search).get("sessionId")?.trim();

    if (!sessionId || !sessionUser) {
      return;
    }

    if (!isPaymentResultRoute) {
      return;
    }

    if (paymentPollingSessionIdRef.current !== sessionId) {
      paymentPollingSessionIdRef.current = sessionId;
      paymentPollingStartedAtRef.current = Date.now();
    }

    void handleCheckPaymentStatus(sessionId, { includeSessionDetails: true, silent: false });
  }, [handleCheckPaymentStatus, isPaymentResultRoute, location.search, sessionUser]);

  useEffect(() => {
    const currentSessionId = paymentStatus?.sessionId || paymentSession?.id || "";
    const currentStatus = paymentStatus?.status || paymentSession?.status || "pending";
    const paymentMatched = paymentStatus?.paymentMatched ?? paymentSession?.paymentMatched ?? false;
    const webhookReceived = paymentStatus?.webhookReceived ?? paymentSession?.webhookReceived ?? paymentMatched;
    const shouldKeepPolling = currentStatus === "pending" || (currentStatus === "success" && !(paymentMatched || webhookReceived));

    if (!sessionUser || !isPaymentResultRoute || !currentSessionId || !shouldKeepPolling) {
      return;
    }

    const pollTimer = window.setInterval(() => {
      const pollingStartedAt = paymentPollingStartedAtRef.current;

      if (pollingStartedAt && Date.now() - pollingStartedAt >= 120000) {
        window.clearInterval(pollTimer);
        paymentPollingSessionIdRef.current = null;
        paymentPollingStartedAtRef.current = null;
        setStatusMessage("Payment is still syncing after 120 seconds. You can keep this page open or refresh the payment status again shortly.");
        return;
      }

      if (!document.hidden) {
        void handleCheckPaymentStatus(currentSessionId, { silent: true });
      }
    }, 3000);

    return () => {
      window.clearInterval(pollTimer);
    };
  }, [
    handleCheckPaymentStatus,
    isPaymentResultRoute,
    paymentSession?.id,
    paymentSession?.paymentMatched,
    paymentSession?.status,
    paymentSession?.webhookReceived,
    paymentStatus?.paymentMatched,
    paymentStatus?.sessionId,
    paymentStatus?.status,
    paymentStatus?.webhookReceived,
    sessionUser,
  ]);

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
      profile={dashboardProfile}
      latestApiKey={latestApiKey}
      referralProfile={referralProfile}
      resolvedReferral={resolvedReferral}
      statusMessage={statusMessage}
      errorMessage={authError}
      usage={usage}
      usageRange={usageRange}
      usageError={usageError}
      creditsHistory={creditsHistory}
      creditsHistoryError={creditsHistoryError}
      creditsHistoryRange={creditsHistoryFilters.range}
      creditsHistorySource={creditsHistoryFilters.source}
      creditsHistoryDirection={creditsHistoryFilters.direction}
      isProfileLoading={isProfileLoading}
      isCreatingApiKey={isCreatingApiKey}
      isRotatingApiKey={isRotatingApiKey}
      isBindingTelegram={isBindingTelegram}
      isLoggingOut={isLoggingOut}
      isUsageLoading={isUsageLoading}
      isCreditsHistoryLoading={isCreditsHistoryLoading}
      isTelegramWidgetReady={isTelegramWidgetReady}
      paymentSession={paymentSession}
      paymentStatus={paymentStatus}
      isCreatingPayment={isCreatingPayment}
      activePaymentPlanId={activePaymentPlanId}
      isCheckingPaymentStatus={isCheckingPaymentStatus}
      telegramWidgetContent={
        !telegramLinked ? (
          <div
            ref={telegramWidgetContainerRef}
            className="pointer-events-none absolute inset-0 z-20 overflow-hidden opacity-0 [&_a]:pointer-events-auto [&_a]:!block [&_a]:!h-full [&_a]:!w-full [&_button]:pointer-events-auto [&_button]:!h-full [&_button]:!w-full [&_iframe]:pointer-events-auto [&_iframe]:!h-full [&_iframe]:!w-full [&_iframe]:!max-w-none"
          />
        ) : null
      }
      onRefreshProfile={() => {
        void refreshProfile();
      }}
      onUsageRangeChange={setUsageRange}
      onCreditsHistoryRangeChange={(range: CreditHistoryRange) => {
        const nextRange = normalizeCreditHistoryRange(range);
        setCreditsHistoryFilters((current) => ({
          ...current,
          range: nextRange,
          page: 1,
        }));
      }}
      onCreditsHistorySourceChange={(source: CreditHistorySource) => {
        const nextSource = normalizeCreditHistorySource(source);
        setCreditsHistoryFilters((current) => ({
          ...current,
          source: nextSource,
          page: 1,
        }));
      }}
      onCreditsHistoryDirectionChange={(direction: CreditsDirection) => {
        const nextDirection = normalizeCreditsDirection(direction);
        setCreditsHistoryFilters((current) => ({
          ...current,
          direction: nextDirection,
          page: 1,
        }));
      }}
      onCreditsHistoryPageChange={(page: number) => {
        const nextPage = Number.isFinite(page) ? Math.max(1, Math.trunc(page)) : 1;
        setCreditsHistoryFilters((current) => ({
          ...current,
          page: nextPage,
        }));
      }}
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
      onOpenPaymentCheckout={() => {
        handleOpenPaymentCheckout();
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
