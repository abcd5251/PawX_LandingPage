import { describe, expect, it } from "vitest";
import { getXAuthorizationUrl, toUserData, type AuthenticatedXUser } from "@/lib/creditHubAuth";

describe("creditHubAuth", () => {
  const sessionUser: AuthenticatedXUser = {
    twitterId: "44196397",
    name: "Elon Musk",
    handle: "@elonmusk",
    avatar: "https://example.com/avatar.jpg",
  };

  it("builds the X authorization URL with the frontend callback", () => {
    const url = getXAuthorizationUrl();

    expect(url).toContain("http://localhost:3001/api/v1/auth/x/start");
    expect(decodeURIComponent(url)).toContain("/credit-hub/auth/callback");
  });

  it("maps nested API payloads into dashboard user data", () => {
    const user = toUserData(sessionUser, {
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
      usage: {
        daily: [
          { date: "Mar 21", used: 80 },
          { date: "Mar 22", used: 40 },
        ],
      },
    });

    expect(user).toEqual({
      name: "Elon Musk",
      handle: "@elonmusk",
      avatar: "https://example.com/profile.jpg",
      twitterConnected: true,
      telegramConnected: true,
      telegramUsername: "@pawx_ai",
      referralCode: "PAWX-TEST",
      baseCredits: 2500,
      telegramBonus: 1500,
      referralBonus: 500,
      creditsUsed: 120,
      referralCount: 3,
      dailyUsage: [
        { date: "Mar 21", used: 80 },
        { date: "Mar 22", used: 40 },
      ],
    });
  });
});
