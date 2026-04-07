import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearStoredReferralCode,
  getAppBaseUrl,
  getStoredReferralCode,
  getApiBaseUrl,
  getPaymentReturnUrl,
  getXAuthorizationUrl,
  normalizeUsageRange,
  persistReferralCodeFromUrl,
  toPaymentSession,
  toPaymentSessionStatusResult,
  toReferralCodeResolution,
  toReferralProfile,
  toApiKeyProfile,
  toApiUsageSeries,
  toXSessionUser,
  type XSessionUser,
} from "@/lib/creditHubAuth";

describe("creditHubAuth", () => {
  const sessionUser: XSessionUser = {
    twitterId: "44196397",
    name: "Elon Musk",
    handle: "@elonmusk",
    avatar: "https://example.com/avatar.jpg",
    profileUrl: "https://x.com/elonmusk",
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("builds the X authorization URL from VITE_PAWX_API_BASE_URL", () => {
    vi.stubEnv("VITE_PAWX_API_BASE_URL", "https://api.example.com/");
    const url = getXAuthorizationUrl();

    expect(url).toBe("https://api.example.com/api/v1/auth/x/start");
  });

  it("prefers VITE_PAWX_API_BASE_URL when both backend env vars exist", () => {
    vi.stubEnv("VITE_PAWX_API_BASE_URL", "https://pawx.example.com/");
    vi.stubEnv("VITE_API_BASE_URL", "https://fallback.example.com/");

    const url = getXAuthorizationUrl();

    expect(url).toBe("https://pawx.example.com/api/v1/auth/x/start");
  });

  it("trims whitespace around the configured backend url", () => {
    vi.stubEnv("VITE_PAWX_API_BASE_URL", " http://localhost:3001/ ");

    expect(getApiBaseUrl()).toBe("http://localhost:3001");
  });

  it("trims whitespace around the configured app url", () => {
    vi.stubEnv("VITE_PAWX_APP_URL", " https://pawx.example.com/ ");

    expect(getAppBaseUrl()).toBe("https://pawx.example.com");
  });

  it("builds the payment return url from the configured app url", () => {
    vi.stubEnv("VITE_PAWX_APP_URL", " https://pawx.example.com/ ");

    expect(getPaymentReturnUrl()).toBe("https://pawx.example.com/payment/result");
  });

  it("maps nested session payloads into the authenticated X user", () => {
    const user = toXSessionUser({
      authenticated: true,
      user: {
        twitterId: "44196397",
        username: "elonmusk",
        name: "Elon Musk",
        profileImageUrl: "https://example.com/profile.jpg",
      },
    });

    expect(user).toEqual({
      twitterId: "44196397",
      name: "Elon Musk",
      handle: "@elonmusk",
      avatar: "https://example.com/profile.jpg",
      profileUrl: "https://x.com/elonmusk",
    });
  });

  it("maps snake_case X session payloads into the authenticated user", () => {
    const user = toXSessionUser({
      authenticated: true,
      user: {
        userId: "123456",
        screen_name: "pawx_ai",
        name: "PawX AI",
        profile_image_url_https: "https://example.com/pawx.jpg",
        profileUrl: "https://x.com/pawx_ai",
      },
    });

    expect(user).toEqual({
      twitterId: "123456",
      name: "PawX AI",
      handle: "@pawx_ai",
      avatar: "https://example.com/pawx.jpg",
      profileUrl: "https://x.com/pawx_ai",
    });
  });

  it("maps auth session payloads when user info is nested under session", () => {
    const user = toXSessionUser({
      authenticated: true,
      session: {
        twitterId: "1593094399231041536",
        username: "allenpaper0915",
        name: "testing Allen",
        avatarUrl: "https://pbs.twimg.com/profile_images/1979085343522496513/NGf13oXA_normal.jpg",
        profileUrl: "https://x.com/allenpaper0915",
      },
    });

    expect(user).toEqual({
      twitterId: "1593094399231041536",
      name: "testing Allen",
      handle: "@allenpaper0915",
      avatar: "https://pbs.twimg.com/profile_images/1979085343522496513/NGf13oXA_normal.jpg",
      profileUrl: "https://x.com/allenpaper0915",
    });
  });

  it("treats authenticated true as a valid signed-in session even before user details are returned", () => {
    const user = toXSessionUser({
      authenticated: true,
    });

    expect(user).toEqual({
      twitterId: "x-session",
      name: "X account",
      handle: "@x-session",
      avatar: "https://api.dicebear.com/7.x/thumbs/svg?seed=x-session",
      profileUrl: "https://x.com/x-session",
    });
  });

  it("maps nested API key payloads into dashboard profile data", () => {
    const profile = toApiKeyProfile(sessionUser, {
      user: {
        username: "elonmusk",
        profileImageUrl: "https://example.com/profile.jpg",
        telegramUsername: "@pawx_ai",
      },
      credits: {
        base: 2500,
        telegramBonus: 1500,
        referralBonus: 500,
        used: 120,
      },
      referral: {
        code: "PAWX-TEST",
        count: 3,
      },
      hasActiveApiKey: true,
      apiKeyPreview: "pk_live_...7890",
      status: "active",
    });

    expect(profile).toEqual({
      twitterId: "44196397",
      name: "Elon Musk",
      handle: "@elonmusk",
      avatar: "https://example.com/profile.jpg",
      profileUrl: "https://x.com/elonmusk",
      baseCredits: 2500,
      telegramBonus: 1500,
      referralBonus: 500,
      totalCredits: 4500,
      creditsUsed: 120,
      remainingCredits: 4380,
      hasActiveApiKey: true,
      apiKeyPreview: "pk_live_...7890",
      apiKeyLast4: "7890",
      telegramConnected: true,
      telegramUsername: "@pawx_ai",
      referralCode: "PAWX-TEST",
      referralCount: 3,
      statusLabel: "active",
    });
  });

  it("maps account-style credit payloads and numeric credits into the dashboard profile", () => {
    const profile = toApiKeyProfile(sessionUser, {
      account: {
        credits: 2500,
      },
      apiKey: {
        active: true,
        last4: "1234",
      },
      status: "active",
    });

    expect(profile).toEqual({
      twitterId: "44196397",
      name: "Elon Musk",
      handle: "@elonmusk",
      avatar: "https://example.com/avatar.jpg",
      profileUrl: "https://x.com/elonmusk",
      baseCredits: 2500,
      telegramBonus: 0,
      referralBonus: 0,
      totalCredits: 2500,
      creditsUsed: 0,
      remainingCredits: 2500,
      hasActiveApiKey: true,
      apiKeyPreview: "",
      apiKeyLast4: "1234",
      telegramConnected: false,
      telegramUsername: "",
      referralCode: "",
      referralCount: 0,
      statusLabel: "active",
    });
  });

  it("maps telegram binding fields from alternative backend response shapes", () => {
    const profile = toApiKeyProfile(sessionUser, {
      account: {
        credits: 2500,
        telegramCredits: 1500,
      },
      telegramBound: true,
      telegram: {
        userName: "@allenchu",
      },
    });

    expect(profile).toEqual({
      twitterId: "44196397",
      name: "Elon Musk",
      handle: "@elonmusk",
      avatar: "https://example.com/avatar.jpg",
      profileUrl: "https://x.com/elonmusk",
      baseCredits: 2500,
      telegramBonus: 1500,
      referralBonus: 0,
      totalCredits: 4000,
      creditsUsed: 0,
      remainingCredits: 4000,
      hasActiveApiKey: false,
      apiKeyPreview: "",
      apiKeyLast4: "",
      telegramConnected: true,
      telegramUsername: "@allenchu",
      referralCode: "",
      referralCount: 0,
      statusLabel: "Signed in",
    });
  });

  it("maps snake_case profile fields from the api key payload", () => {
    const profile = toApiKeyProfile(sessionUser, {
      user: {
        userId: "998877",
        name: "Allen",
        screen_name: "allenpaper0915",
        profile_image_url: "https://example.com/allen.jpg",
        profileUrl: "https://x.com/allenpaper0915",
      },
      account: {
        credits: 2500,
      },
    });

    expect(profile).toEqual({
      twitterId: "998877",
      name: "Allen",
      handle: "@allenpaper0915",
      avatar: "https://example.com/allen.jpg",
      profileUrl: "https://x.com/allenpaper0915",
      baseCredits: 2500,
      telegramBonus: 0,
      referralBonus: 0,
      totalCredits: 2500,
      creditsUsed: 0,
      remainingCredits: 2500,
      hasActiveApiKey: false,
      apiKeyPreview: "",
      apiKeyLast4: "",
      telegramConnected: false,
      telegramUsername: "",
      referralCode: "",
      referralCount: 0,
      statusLabel: "Signed in",
    });
  });

  it("maps payment session payloads returned from create session", () => {
    const paymentSession = toPaymentSession({
      code: 201,
      message: "Payment session created",
      data: {
        id: "session-uuid",
        customOrderId: "session-uuid",
        plan: {
          id: "Starter",
          amount: 2,
          credits: 1000,
        },
        amount: 2,
        checkoutUrl: "https://checkout.kira-pay.com/abc123xyz7",
        qrCodeValue: "https://checkout.kira-pay.com/abc123xyz7",
        identifierInUsd: "abc123xyz7",
        status: "pending",
        paid: false,
        createdAt: "2026-04-07T00:00:00.000Z",
        expiresAt: "2026-04-07T00:30:00.000Z",
        paidAt: null,
        telegramId: "tg-123",
        twitterId: "x-123",
        creditsToAdd: 1000,
        redirectUrl: "https://pawx.example.com/payment/result?sessionId=session-uuid",
        providerPrice: 2,
        providerOriginalPrice: 2,
      },
    });

    expect(paymentSession).toEqual({
      id: "session-uuid",
      customOrderId: "session-uuid",
      plan: {
        id: "Starter",
        amount: 2,
        credits: 1000,
      },
      amount: 2,
      checkoutUrl: "https://checkout.kira-pay.com/abc123xyz7",
      qrCodeValue: "https://checkout.kira-pay.com/abc123xyz7",
      identifierInUsd: "abc123xyz7",
      status: "pending",
      paid: false,
      createdAt: "2026-04-07T00:00:00.000Z",
      expiresAt: "2026-04-07T00:30:00.000Z",
      paidAt: null,
      telegramId: "tg-123",
      twitterId: "x-123",
      creditsToAdd: 1000,
      redirectUrl: "https://pawx.example.com/payment/result?sessionId=session-uuid",
      providerPrice: 2,
      providerOriginalPrice: 2,
    });
  });

  it("maps payment status payloads returned from fetch session", () => {
    const paymentStatus = toPaymentSessionStatusResult({
      code: 200,
      message: "Payment session fetched",
      data: {
        id: "session-uuid",
        status: "success",
      },
    });

    expect(paymentStatus).toEqual({
      id: "session-uuid",
      status: "success",
    });
  });

  it("stores and clears referral codes from the url", () => {
    expect(persistReferralCodeFromUrl("?ref=ABC123")).toBe("ABC123");
    expect(getStoredReferralCode()).toBe("ABC123");

    clearStoredReferralCode();

    expect(getStoredReferralCode()).toBeNull();
  });

  it("maps dedicated referral profile payloads", () => {
    vi.stubEnv("VITE_PAWX_APP_URL", "https://pawx.example.com/");

    const referralProfile = toReferralProfile({
      referralCode: "ABC123",
      stats: {
        peopleReferred: 7,
        creditsEarned: 3500,
      },
      referrals: [{ twitterId: "1" }],
    });

    expect(referralProfile.referralCode).toBe("ABC123");
    expect(referralProfile.referralLink).toBe("https://pawx.example.com/?ref=ABC123");
    expect(referralProfile.peopleReferred).toBe(7);
    expect(referralProfile.creditsEarned).toBe(3500);
    expect(referralProfile.referrals).toHaveLength(1);
  });

  it("maps referral resolve payloads and normalizes inviter handles", () => {
    const resolved = toReferralCodeResolution(
      {
        valid: true,
        inviter: {
          name: "Allen",
          username: "allen_test",
        },
      },
      "ABC123",
    );

    expect(resolved).toEqual({
      referralCode: "ABC123",
      isValid: true,
      inviterName: "Allen",
      inviterHandle: "@allen_test",
      message: "",
    });
  });

  it("normalizes supported usage range query values", () => {
    expect(normalizeUsageRange("7")).toBe("7d");
    expect(normalizeUsageRange("7d")).toBe("7d");
    expect(normalizeUsageRange("30")).toBe("30d");
    expect(normalizeUsageRange("30d")).toBe("30d");
    expect(normalizeUsageRange("unexpected")).toBe("7d");
  });

  it("maps usage payloads and fills missing days with zero values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00Z"));

    const usage = toApiUsageSeries(
      {
        data: {
          usage: [
            {
              date: "2026-03-27",
              creditsUsed: 120,
              requestCount: 3,
            },
            {
              bucketDate: "2026-03-29",
              totalCreditsUsed: 80,
              requests: {
                count: 2,
              },
            },
          ],
        },
      },
      "7",
    );

    expect(usage.range).toBe("7d");
    expect(usage.rangeDays).toBe(7);
    expect(usage.totalCreditsUsed).toBe(200);
    expect(usage.totalRequestCount).toBe(5);
    expect(usage.days).toHaveLength(7);
    expect(usage.days[0]).toMatchObject({
      date: "2026-03-23",
      creditsUsed: 0,
      requestCount: 0,
    });
    expect(usage.days[4]).toMatchObject({
      date: "2026-03-27",
      creditsUsed: 120,
      requestCount: 3,
    });
    expect(usage.days[5]).toMatchObject({
      date: "2026-03-28",
      creditsUsed: 0,
      requestCount: 0,
    });
    expect(usage.days[6]).toMatchObject({
      date: "2026-03-29",
      creditsUsed: 80,
      requestCount: 2,
    });
  });

  it("maps signed-in session usage payload shape returned by the backend", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-29T12:00:00Z"));

    const usage = toApiUsageSeries({
      apiKeyType: "managed",
      range: "7d",
      rangeDays: 7,
      twitterId: "1548365572651757568",
      telegramId: "1162706985",
      accountStatus: "active",
      currentBalance: 3999,
      totalConsumedCredits: 1,
      totalRequests: 1,
      dailyUsage: [
        { date: "2026-03-23", consumedCredits: 0, requestCount: 0 },
        { date: "2026-03-24", consumedCredits: 0, requestCount: 0 },
        { date: "2026-03-25", consumedCredits: 0, requestCount: 0 },
        { date: "2026-03-26", consumedCredits: 0, requestCount: 0 },
        { date: "2026-03-27", consumedCredits: 0, requestCount: 0 },
        { date: "2026-03-28", consumedCredits: 0, requestCount: 0 },
        { date: "2026-03-29", consumedCredits: 1, requestCount: 1 },
      ],
    });

    expect(usage).toMatchObject({
      range: "7d",
      rangeDays: 7,
      apiKeyType: "managed",
      twitterId: "1548365572651757568",
      telegramId: "1162706985",
      accountStatus: "active",
      currentBalance: 3999,
      totalCreditsUsed: 1,
      totalRequestCount: 1,
    });
    expect(usage.days[6]).toMatchObject({
      date: "2026-03-29",
      creditsUsed: 1,
      requestCount: 1,
    });
  });
});
