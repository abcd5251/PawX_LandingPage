import { eachDayOfInterval, format, parseISO, subDays } from "date-fns";

export interface XSessionUser {
  twitterId: string;
  name: string;
  handle: string;
  avatar: string;
  profileUrl: string;
}

export interface ApiKeyProfile {
  twitterId: string;
  name: string;
  handle: string;
  avatar: string;
  profileUrl: string;
  baseCredits: number;
  telegramBonus: number;
  referralBonus: number;
  totalCredits: number;
  creditsUsed: number;
  remainingCredits: number;
  hasActiveApiKey: boolean;
  apiKeyPreview: string;
  apiKeyLast4: string;
  telegramConnected: boolean;
  telegramUsername: string;
  referralCode: string;
  referralCount: number;
  statusLabel: string;
}

export interface ApiKeyMutationResult {
  apiKey: string;
  profile: ApiKeyProfile;
}

export interface ProtectedApiResult {
  ok: boolean;
  status: number;
  body: string;
}

export interface TelegramAuthPayload {
  id: string;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: string;
  hash: string;
}

export interface BindTelegramRequest {
  twitterId: string;
  telegramAuth: TelegramAuthPayload;
  referralCode?: string;
}

export type UsageRange = "7d" | "30d";

export interface ApiUsageDay {
  date: string;
  label: string;
  creditsUsed: number;
  requestCount: number;
}

export interface ApiUsageSeries {
  range: UsageRange;
  rangeDays: number;
  totalCreditsUsed: number;
  totalRequestCount: number;
  apiKeyType: string;
  twitterId: string;
  telegramId: string;
  accountStatus: string;
  currentBalance: number;
  days: ApiUsageDay[];
}

export const AUTH_REDIRECT_STORAGE_KEY = "pawx-credit-hub-auth-redirect";

type JsonRecord = Record<string, unknown>;

export class CreditHubApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CreditHubApiError";
    this.status = status;
  }
}

const DEFAULT_API_BASE_URL = "http://localhost:3001";
const DEFAULT_AVATAR = "https://api.dicebear.com/7.x/thumbs/svg?seed=pawx-user";

const toRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as JsonRecord;
};

const readPath = (source: unknown, path: string[]) => {
  let current: unknown = source;

  for (const segment of path) {
    if (Array.isArray(current)) {
      const index = Number(segment);
      if (!Number.isInteger(index)) {
        return undefined;
      }
      current = current[index];
      continue;
    }

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

const readArray = (source: unknown, paths: string[][]) => {
  for (const path of paths) {
    const value = readPath(source, path);
    if (Array.isArray(value)) {
      return value;
    }
  }

  return [];
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
const trimEnvValue = (value?: string) => value?.trim() || "";

const normalizeHandle = (value: string, twitterId: string) => {
  if (!value) {
    return `@${twitterId}`;
  }

  return value.startsWith("@") ? value : `@${value}`;
};

const buildProfileUrl = (handle: string, twitterId: string, profileUrl?: string) => {
  if (profileUrl) {
    return profileUrl;
  }

  const normalizedHandle = handle.startsWith("@") ? handle.slice(1) : handle;
  if (normalizedHandle) {
    return `https://x.com/${normalizedHandle}`;
  }

  if (twitterId) {
    return `https://x.com/i/user/${twitterId}`;
  }

  return "https://x.com";
};

const buildAvatar = (twitterId: string, avatar?: string) => {
  if (avatar) {
    return avatar;
  }

  if (twitterId) {
    return `https://api.dicebear.com/7.x/thumbs/svg?seed=${twitterId}`;
  }

  return DEFAULT_AVATAR;
};

const readResponseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return text || null;
};

const buildErrorMessage = async (response: Response) => {
  const payload = await readResponseBody(response);
  const message =
    (typeof payload === "string" ? payload : "") ||
    readString(payload, [["message"], ["error"], ["errors", "0", "message"]]) ||
    `Request failed with status ${response.status}`;

  return new CreditHubApiError(message, response.status);
};

const apiRequest = async <T>(path: string, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");

  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  if (!response.ok) {
    throw await buildErrorMessage(response);
  }

  if (response.status === 204) {
    return null as T;
  }

  return (await readResponseBody(response)) as T;
};

const readApiKeyValue = (payload: unknown) =>
  readString(payload, [
    ["apiKey"],
    ["key"],
    ["data", "apiKey"],
    ["data", "key"],
    ["apiKeyData", "value"],
  ]);

const readApiKeyLast4 = (payload: unknown, apiKeyPreview: string, fullApiKey = "") => {
  const explicitLast4 = readString(payload, [
    ["apiKeyLast4"],
    ["last4"],
    ["apiKey", "last4"],
    ["data", "apiKeyLast4"],
    ["apiKeyData", "last4"],
  ]);

  if (explicitLast4) {
    return explicitLast4.slice(-4);
  }

  if (fullApiKey) {
    return fullApiKey.slice(-4);
  }

  const previewTail = apiKeyPreview.replace(/[^a-zA-Z0-9]+/g, "");
  return previewTail ? previewTail.slice(-4) : "";
};

export const getApiBaseUrl = () => {
  const configured = trimEnvValue(import.meta.env.VITE_PAWX_API_BASE_URL) || trimEnvValue(import.meta.env.VITE_API_BASE_URL);
  return trimTrailingSlash(configured || DEFAULT_API_BASE_URL);
};

export const getTelegramBotUsername = () => trimEnvValue(import.meta.env.VITE_TELEGRAM_BOT_USERNAME);

export const getXAuthorizationUrl = () => `${getApiBaseUrl()}/api/v1/auth/x/start`;

export const normalizeUsageRange = (value?: string): UsageRange => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "30" || normalized === "30d" ? "30d" : "7d";
};

const getUsageRangeDays = (range: UsageRange) => (range === "30d" ? 30 : 7);

const normalizeUsageDate = (value: unknown) => {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return format(parsed, "yyyy-MM-dd");
};

export const buildEmptyApiUsage = (range: UsageRange): ApiUsageSeries => {
  const totalDays = getUsageRangeDays(range);
  const interval = eachDayOfInterval({
    start: subDays(new Date(), totalDays - 1),
    end: new Date(),
  });

  return {
    range,
    rangeDays: totalDays,
    totalCreditsUsed: 0,
    totalRequestCount: 0,
    apiKeyType: "",
    twitterId: "",
    telegramId: "",
    accountStatus: "",
    currentBalance: 0,
    days: interval.map((day) => ({
      date: format(day, "yyyy-MM-dd"),
      label: format(day, "MMM d"),
      creditsUsed: 0,
      requestCount: 0,
    })),
  };
};

export const toApiUsageSeries = (payload: unknown, rawRange?: string): ApiUsageSeries => {
  const range = normalizeUsageRange(
    rawRange ||
      readString(payload, [["range"], ["selectedRange"], ["data", "range"], ["meta", "range"]]),
  );
  const normalized = buildEmptyApiUsage(range);
  const usageByDate = new Map(
    normalized.days.map((day) => [
      day.date,
      {
        ...day,
      },
    ]),
  );

  for (const entry of readArray(payload, [["dailyUsage"], ["days"], ["usage"], ["data", "dailyUsage"], ["data", "days"], ["data", "usage"], ["items"], ["results"]])) {
    const date = normalizeUsageDate(
      pickFirst(entry, [["date"], ["day"], ["bucketDate"], ["bucket_date"], ["usageDate"], ["usage_date"]]),
    );

    if (!date || !usageByDate.has(date)) {
      continue;
    }

    usageByDate.set(date, {
      date,
      label: format(parseISO(date), "MMM d"),
      creditsUsed: readNumber(
        entry,
        [
          ["consumedCredits"],
          ["creditsUsed"],
          ["dailyConsumedCredits"],
          ["dailyCreditsUsed"],
          ["summary", "creditsUsed"],
          ["totalCreditsUsed"],
          ["usage"],
          ["credits"],
          ["total_usage"],
        ],
        0,
      ),
      requestCount: readNumber(
        entry,
        [["requestCount"], ["requests", "count"], ["count"], ["totalRequests"], ["summary", "requestCount"], ["requests"]],
        0,
      ),
    });
  }

  const days = normalized.days.map((day) => usageByDate.get(day.date) ?? day);
  const totalCreditsUsed = readNumber(
    payload,
    [["totalConsumedCredits"], ["totalCreditsUsed"], ["summary", "totalConsumedCredits"], ["summary", "totalCreditsUsed"]],
    days.reduce((sum, day) => sum + day.creditsUsed, 0),
  );
  const totalRequestCount = readNumber(
    payload,
    [["totalRequests"], ["totalRequestCount"], ["summary", "totalRequests"], ["summary", "totalRequestCount"]],
    days.reduce((sum, day) => sum + day.requestCount, 0),
  );

  return {
    range,
    rangeDays: readNumber(payload, [["rangeDays"], ["meta", "rangeDays"]], getUsageRangeDays(range)),
    totalCreditsUsed,
    totalRequestCount,
    apiKeyType: readString(payload, [["apiKeyType"], ["meta", "apiKeyType"]]),
    twitterId: readString(payload, [["twitterId"], ["meta", "twitterId"]]),
    telegramId: readString(payload, [["telegramId"], ["meta", "telegramId"]]),
    accountStatus: readString(payload, [["accountStatus"], ["status"], ["meta", "accountStatus"]]),
    currentBalance: readNumber(payload, [["currentBalance"], ["balance"], ["credits", "remaining"], ["meta", "currentBalance"]], 0),
    days,
  };
};

export const toXSessionUser = (payload: unknown) => {
  const twitterId = readString(
    payload,
    [["twitterId"], ["id"], ["userId"], ["session", "twitterId"], ["session", "id"], ["session", "userId"], ["user", "twitterId"], ["user", "id"], ["user", "userId"]],
  );
  const authenticated = readBoolean(payload, [["authenticated"], ["isAuthenticated"], ["session", "authenticated"]], Boolean(twitterId));

  if (!authenticated) {
    return null;
  }

  const fallbackTwitterId = twitterId || readString(payload, [["username"], ["session", "username"], ["user", "username"]], "x-session");

  const name = readString(
    payload,
    [["name"], ["displayName"], ["session", "name"], ["session", "displayName"], ["user", "name"], ["user", "displayName"]],
    "X account",
  );
  const handle = normalizeHandle(
    readString(
      payload,
      [
        ["handle"],
        ["screenName"],
        ["screen_name"],
        ["username"],
        ["session", "handle"],
        ["session", "screenName"],
        ["session", "screen_name"],
        ["session", "username"],
        ["user", "handle"],
        ["user", "screenName"],
        ["user", "screen_name"],
        ["user", "username"],
      ],
      fallbackTwitterId,
    ),
    fallbackTwitterId,
  );
  const avatar = buildAvatar(
    fallbackTwitterId,
    readString(
      payload,
      [
        ["avatar"],
        ["avatarUrl"],
        ["profileImageUrl"],
        ["profile_image_url"],
        ["profile_image_url_https"],
        ["session", "avatar"],
        ["session", "avatarUrl"],
        ["session", "profileImageUrl"],
        ["session", "profile_image_url"],
        ["session", "profile_image_url_https"],
        ["user", "avatar"],
        ["user", "avatarUrl"],
        ["user", "profileImageUrl"],
        ["user", "profile_image_url"],
        ["user", "profile_image_url_https"],
      ],
    ),
  );
  const profileUrl = buildProfileUrl(
    handle,
    fallbackTwitterId,
    readString(payload, [["profileUrl"], ["profileURL"], ["session", "profileUrl"], ["session", "profileURL"], ["user", "profileUrl"], ["user", "profileURL"]]),
  );

  return { twitterId: fallbackTwitterId, name, handle, avatar, profileUrl };
};

export const buildFallbackProfile = (sessionUser: XSessionUser): ApiKeyProfile => ({
  twitterId: sessionUser.twitterId,
  name: sessionUser.name,
  handle: sessionUser.handle,
  avatar: sessionUser.avatar,
  profileUrl: sessionUser.profileUrl,
  baseCredits: 0,
  telegramBonus: 0,
  referralBonus: 0,
  totalCredits: 0,
  creditsUsed: 0,
  remainingCredits: 0,
  hasActiveApiKey: false,
  apiKeyPreview: "",
  apiKeyLast4: "",
  telegramConnected: false,
  telegramUsername: "",
  referralCode: "",
  referralCount: 0,
  statusLabel: "Signed in",
});

export const toApiKeyProfile = (sessionUser: XSessionUser, payload: unknown): ApiKeyProfile => {
  const twitterId = readString(payload, [["twitterId"], ["id"], ["userId"], ["user", "twitterId"], ["user", "id"], ["user", "userId"]], sessionUser.twitterId);
  const name = readString(payload, [["name"], ["displayName"], ["user", "name"], ["user", "displayName"]], sessionUser.name);
  const handle = normalizeHandle(
    readString(
      payload,
      [["handle"], ["screenName"], ["screen_name"], ["username"], ["user", "handle"], ["user", "screenName"], ["user", "screen_name"], ["user", "username"]],
      sessionUser.handle,
    ),
    twitterId,
  );
  const avatar = buildAvatar(
    twitterId,
    readString(
      payload,
      [
        ["avatar"],
        ["avatarUrl"],
        ["profileImageUrl"],
        ["profile_image_url"],
        ["profile_image_url_https"],
        ["user", "avatar"],
        ["user", "avatarUrl"],
        ["user", "profileImageUrl"],
        ["user", "profile_image_url"],
        ["user", "profile_image_url_https"],
      ],
      sessionUser.avatar,
    ),
  );
  const profileUrl = buildProfileUrl(
    handle,
    twitterId,
    readString(payload, [["profileUrl"], ["profileURL"], ["user", "profileUrl"], ["user", "profileURL"]], sessionUser.profileUrl),
  );
  const baseCredits = readNumber(
    payload,
    [["baseCredits"], ["credits", "base"], ["credits", "granted"], ["account", "baseCredits"], ["account", "credits"], ["user", "baseCredits"]],
    0,
  );
  const telegramBonus = readNumber(
    payload,
    [
      ["telegramBonus"],
      ["credits", "telegramBonus"],
      ["credits", "telegram"],
      ["account", "telegramBonus"],
      ["account", "telegramCredits"],
      ["user", "telegramBonus"],
      ["bonus", "telegram"],
    ],
    0,
  );
  const referralBonus = readNumber(
    payload,
    [["referralBonus"], ["credits", "referralBonus"], ["credits", "referral"], ["account", "referralBonus"], ["user", "referralBonus"]],
    0,
  );
  const creditsUsed = readNumber(
    payload,
    [["creditsUsed"], ["credits", "used"], ["usage", "used"], ["account", "creditsUsed"], ["user", "creditsUsed"]],
    0,
  );
  const combinedCredits = baseCredits + telegramBonus + referralBonus;
  const totalCreditsCandidate = pickFirst(payload, [
    ["totalCredits"],
    ["credits", "total"],
    ["account", "totalCredits"],
    ["user", "totalCredits"],
    ["credits"],
    ["account", "credits"],
  ]);
  const resolvedTotalCredits =
    typeof totalCreditsCandidate === "number"
      ? totalCreditsCandidate
      : typeof totalCreditsCandidate === "string" && totalCreditsCandidate.trim()
        ? Number(totalCreditsCandidate)
        : Number.NaN;
  const totalCredits =
    Number.isFinite(resolvedTotalCredits) && resolvedTotalCredits > combinedCredits
      ? resolvedTotalCredits
      : Math.max(combinedCredits, Number.isFinite(resolvedTotalCredits) ? resolvedTotalCredits : 0);
  const remainingCreditsCandidate = pickFirst(payload, [
    ["remainingCredits"],
    ["credits", "remaining"],
    ["credits", "available"],
    ["account", "remainingCredits"],
    ["user", "remainingCredits"],
  ]);
  const resolvedRemainingCredits =
    typeof remainingCreditsCandidate === "number"
      ? remainingCreditsCandidate
      : typeof remainingCreditsCandidate === "string" && remainingCreditsCandidate.trim()
        ? Number(remainingCreditsCandidate)
        : Number.NaN;
  const remainingCredits = Number.isFinite(resolvedRemainingCredits)
    ? resolvedRemainingCredits
    : Math.max(totalCredits - creditsUsed, 0);
  const apiKeyPreview = readString(payload, [["apiKeyPreview"], ["apiKey", "preview"], ["keyPreview"], ["data", "apiKeyPreview"]]);
  const apiKeyLast4 = readApiKeyLast4(payload, apiKeyPreview);
  const hasActiveApiKey = readBoolean(
    payload,
    [["hasActiveApiKey"], ["apiKey", "hasActive"], ["apiKey", "active"], ["data", "hasActiveApiKey"]],
    Boolean(apiKeyPreview || apiKeyLast4),
  );
  const telegramUsername = readString(payload, [
    ["telegramUsername"],
    ["telegramUserName"],
    ["telegramHandle"],
    ["user", "telegramUsername"],
    ["user", "telegramUserName"],
    ["user", "telegram"],
    ["telegram", "username"],
    ["telegram", "userName"],
    ["telegram", "handle"],
  ]);
  const referralCode = readString(payload, [["referralCode"], ["user", "referralCode"], ["referral", "code"]]);

  return {
    twitterId,
    name,
    handle,
    avatar,
    profileUrl,
    baseCredits,
    telegramBonus,
    referralBonus,
    totalCredits,
    creditsUsed,
    remainingCredits,
    hasActiveApiKey,
    apiKeyPreview,
    apiKeyLast4,
    telegramConnected: readBoolean(
      payload,
      [["telegramConnected"], ["telegramBound"], ["isTelegramBound"], ["user", "telegramConnected"], ["telegram", "connected"], ["telegram", "isBound"]],
      Boolean(telegramUsername),
    ),
    telegramUsername,
    referralCode,
    referralCount: readNumber(payload, [["referralCount"], ["referral", "count"], ["user", "referralCount"]], 0),
    statusLabel:
      readString(payload, [["status"], ["accountStatus"], ["user", "status"], ["apiKey", "status"]]) ||
      (hasActiveApiKey ? "API key active" : "Signed in"),
  };
};

export const fetchXSession = async () => {
  try {
    const payload = await apiRequest<unknown>("/api/v1/auth/x/session", { method: "GET" });
    return toXSessionUser(payload);
  } catch (error) {
    if (error instanceof CreditHubApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
};

export const logoutXSession = async () => {
  await apiRequest("/api/v1/auth/x/logout", { method: "POST" });
};

export const fetchApiKeyProfile = async (sessionUser: XSessionUser) => {
  const payload = await apiRequest<unknown>("/api/v1/twitterUsers/api-keys/me", { method: "GET" });
  return toApiKeyProfile(sessionUser, payload);
};

export const fetchApiUsage = async (range: UsageRange) => {
  const attempts = range === "30d" ? ["30d", "30"] : ["7d", "7"];
  let lastError: unknown;

  for (const queryRange of attempts) {
    try {
      const payload = await apiRequest<unknown>(`/api/v1/twitterUsers/api-keys/usage?range=${encodeURIComponent(queryRange)}`, { method: "GET" });
      return toApiUsageSeries(payload, range);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

export const createApiKey = async (sessionUser: XSessionUser, rotateExisting = false): Promise<ApiKeyMutationResult> => {
  const payload = await apiRequest<unknown>("/api/v1/twitterUsers/api-keys", {
    method: "POST",
    body: JSON.stringify(rotateExisting ? { rotateExisting: true } : {}),
  });
  const apiKey = readApiKeyValue(payload);

  if (!apiKey) {
    throw new Error("後端沒有回傳新的 API key，請確認建立或 rotate API key 的回應格式。");
  }

  return {
    apiKey,
    profile: {
      ...toApiKeyProfile(sessionUser, payload),
      apiKeyLast4: apiKey.slice(-4),
    },
  };
};

export const bindTelegram = async (payload: BindTelegramRequest) => {
  return apiRequest<unknown>("/api/v1/twitterUsers/api-keys/bind-telegram", {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const callProtectedApi = async (path: string, apiKey: string): Promise<ProtectedApiResult> => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const response = await fetch(`${getApiBaseUrl()}${normalizedPath}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
  });
  const body = await readResponseBody(response);

  return {
    ok: response.ok,
    status: response.status,
    body: typeof body === "string" ? body : JSON.stringify(body ?? null, null, 2),
  };
};

export const getReadableAuthError = (error: unknown) => {
  if (error instanceof CreditHubApiError) {
    if (error.status === 401) {
      return "X 登入尚未完成或 session 已失效，請重新點擊 Sign in with X。";
    }

    if (error.status === 403) {
      return "目前登入狀態未通過後端驗證，請確認 httpOnly cookie、CORS 與 session 設定。";
    }

    if (error.status === 404) {
      return "目前帳號尚未建立 API key profile，可直接按 Create API Key。";
    }

    if (error.status === 409) {
      return "你已經有 active API key，可改用 Rotate API Key。";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "登入流程發生未知錯誤。";
};
