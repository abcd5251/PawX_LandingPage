import type { UserData } from "@/components/Dashboard";

export interface AuthenticatedXUser {
  twitterId: string;
  name: string;
  handle: string;
  avatar: string;
}

type JsonRecord = Record<string, unknown>;

class CreditHubApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CreditHubApiError";
    this.status = status;
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:3001";

const toRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
};

const readPath = (source: unknown, path: string[]) => {
  let current: unknown = source;

  for (const segment of path) {
    const record = toRecord(current);
    if (!record) {
      return undefined;
    }
    current = record[segment];
  }

  return current;
};

const pickFirst = (source: unknown, paths: string[][]) => {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return undefined;
};

const readString = (source: unknown, paths: string[][], fallback = "") => {
  const value = pickFirst(source, paths);
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return fallback;
};

const readNumber = (source: unknown, paths: string[][], fallback = 0) => {
  const value = pickFirst(source, paths);
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

const readBoolean = (source: unknown, paths: string[][], fallback = false) => {
  const value = pickFirst(source, paths);
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return value === "true";
  }
  return fallback;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const normalizeHandle = (value: string, twitterId: string) => {
  if (!value) {
    return `@${twitterId}`;
  }
  return value.startsWith("@") ? value : `@${value}`;
};

const buildAvatar = (sessionUser: Partial<AuthenticatedXUser>) => {
  if (sessionUser.avatar) {
    return sessionUser.avatar;
  }

  if (sessionUser.twitterId) {
    return `https://api.dicebear.com/7.x/thumbs/svg?seed=${sessionUser.twitterId}`;
  }

  return "https://api.dicebear.com/7.x/thumbs/svg?seed=pawx-user";
};

const buildDailyUsage = (payload: unknown): { date: string; used: number }[] => {
  const raw =
    pickFirst(payload, [["dailyUsage"], ["usage", "daily"], ["data", "dailyUsage"], ["user", "dailyUsage"]]) ?? [];

  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((entry) => {
      const record = toRecord(entry);
      if (!record) {
        return null;
      }

      const date = typeof record.date === "string" ? record.date : "";
      const used = typeof record.used === "number" ? record.used : Number(record.used ?? 0);

      if (!date || !Number.isFinite(used)) {
        return null;
      }

      return { date, used };
    })
    .filter((entry): entry is { date: string; used: number } => Boolean(entry));
};

const toUserData = (sessionUser: AuthenticatedXUser, payload: unknown): UserData => {
  const telegramUsername = readString(payload, [["telegramUsername"], ["user", "telegramUsername"], ["telegram", "username"]]);
  const referralCode = readString(payload, [["referralCode"], ["user", "referralCode"], ["referral", "code"]]);

  return {
    name: readString(payload, [["name"], ["user", "name"]], sessionUser.name),
    handle: normalizeHandle(readString(payload, [["handle"], ["screenName"], ["username"], ["user", "handle"], ["user", "username"]], sessionUser.handle), sessionUser.twitterId),
    avatar: readString(payload, [["avatar"], ["avatarUrl"], ["profileImageUrl"], ["user", "avatar"], ["user", "avatarUrl"], ["user", "profileImageUrl"]], sessionUser.avatar),
    twitterConnected: true,
    telegramConnected: readBoolean(
      payload,
      [["telegramConnected"], ["user", "telegramConnected"], ["telegram", "connected"]],
      Boolean(telegramUsername),
    ),
    telegramUsername,
    referralCode,
    baseCredits: readNumber(payload, [["baseCredits"], ["credits", "base"], ["user", "baseCredits"]], 2500),
    telegramBonus: readNumber(payload, [["telegramBonus"], ["credits", "telegramBonus"], ["user", "telegramBonus"]], 0),
    referralBonus: readNumber(payload, [["referralBonus"], ["credits", "referralBonus"], ["user", "referralBonus"]], 0),
    creditsUsed: readNumber(payload, [["creditsUsed"], ["credits", "used"], ["user", "creditsUsed"]], 0),
    referralCount: readNumber(payload, [["referralCount"], ["referral", "count"], ["user", "referralCount"]], 0),
    dailyUsage: buildDailyUsage(payload),
  };
};

const parseJson = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json();
};

const buildErrorMessage = async (response: Response) => {
  const payload = await parseJson(response);
  const message =
    readString(payload, [["message"], ["error"], ["errors", "0", "message"]]) ||
    `Request failed with status ${response.status}`;

  return new CreditHubApiError(message, response.status);
};

const apiRequest = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw await buildErrorMessage(response);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await parseJson(response)) as T;
};

export const getApiBaseUrl = () => {
  const configured = import.meta.env.VITE_PAWX_API_BASE_URL;
  return trimTrailingSlash(configured || DEFAULT_API_BASE_URL);
};

export const getAppBaseUrl = () => {
  const configured = import.meta.env.VITE_PAWX_APP_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window !== "undefined") {
    return trimTrailingSlash(window.location.origin);
  }

  return "http://localhost:8080";
};

export const getCreditHubCallbackUrl = () => `${getAppBaseUrl()}/credit-hub/auth/callback`;

export const getXAuthorizationUrl = () => {
  const redirectUri = encodeURIComponent(getCreditHubCallbackUrl());
  return `${getApiBaseUrl()}/api/v1/auth/x/start?redirectUri=${redirectUri}`;
};

export const getAuthenticatedXUser = async () => {
  try {
    const payload = await apiRequest<unknown>("/api/v1/auth/x/session", { method: "GET" });
    const twitterId = readString(payload, [["twitterId"], ["id"], ["user", "twitterId"], ["user", "id"]]);

    if (!twitterId) {
      return null;
    }

    const name = readString(payload, [["name"], ["user", "name"]], twitterId);
    const handle = normalizeHandle(
      readString(payload, [["handle"], ["screenName"], ["username"], ["user", "handle"], ["user", "screenName"], ["user", "username"]], twitterId),
      twitterId,
    );
    const avatar = buildAvatar({
      twitterId,
      avatar: readString(payload, [["avatar"], ["avatarUrl"], ["profileImageUrl"], ["user", "avatar"], ["user", "avatarUrl"], ["user", "profileImageUrl"]]),
    });

    return { twitterId, name, handle, avatar };
  } catch (error) {
    if (error instanceof CreditHubApiError && error.status === 401) {
      return null;
    }
    throw error;
  }
};

export const provisionCreditHubUser = async (sessionUser: AuthenticatedXUser) => {
  const payload = await apiRequest<unknown>("/api/v1/twitterUsers/api-keys", {
    method: "POST",
    body: JSON.stringify({ twitterId: sessionUser.twitterId }),
  });

  return toUserData(sessionUser, payload);
};

export const bootstrapCreditHubUser = async () => {
  const sessionUser = await getAuthenticatedXUser();
  if (!sessionUser) {
    return null;
  }

  return provisionCreditHubUser(sessionUser);
};

export const getReadableAuthError = (error: unknown) => {
  if (error instanceof CreditHubApiError) {
    if (error.status === 401) {
      return "X 登入尚未完成，請重新點擊 Sign in with X。";
    }

    if (error.status === 403) {
      return "目前登入狀態未通過後端驗證，請確認 X OAuth callback 與 session 設定。";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "登入流程發生未知錯誤。";
};

export { toUserData };
