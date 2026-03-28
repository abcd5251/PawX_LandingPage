import { afterEach, describe, expect, it, vi } from "vitest";
import { getXAuthorizationUrl, toApiKeyProfile, toXSessionUser, type XSessionUser } from "@/lib/creditHubAuth";

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
});
