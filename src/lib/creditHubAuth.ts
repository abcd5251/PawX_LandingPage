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
  telegramId: string;
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
  twitterId?: string;
  telegramAuth: TelegramAuthPayload;
  referralCode?: string;
}

export interface ReferralStats {
  peopleReferred: number;
  paidReferrals: number;
  referralPaymentCount: number;
  creditsEarned: number;
  claimableAmountUsd: string;
}

export interface ReferralItem {
  telegramId: string;
  telegramUsername: string;
  telegramPhotoUrl: string;
  paymentCount: number;
  hasPaid: boolean;
  claimableAmountUsd: string;
  latestPaidAt: string;
  createdAt: string;
}

export interface ReferralProfile {
  referralCode: string;
  referralLink: string;
  peopleReferred: number;
  paidReferrals: number;
  referralPaymentCount: number;
  creditsEarned: number;
  claimableAmountUsd: string;
  stats: ReferralStats;
  referrals: ReferralItem[];
}

export interface ReferralCodeResolution {
  referralCode: string;
  isValid: boolean;
  inviterName: string;
  inviterHandle: string;
  message: string;
}

export type PaymentPlanId = "Starter" | "Standard" | "Advanced";
export type PaymentSessionStatus = "pending" | "success" | "expired";

export interface PaymentTokenOut {
  chainId: string;
  address: string;
}

export interface CreatePaymentSessionRequest {
  planId: PaymentPlanId;
  tokenOut: PaymentTokenOut;
  redirectUrl?: string;
}

export interface PaymentSessionPlan {
  id: PaymentPlanId;
  amount: number;
  credits: number;
}

export interface PaymentSession {
  id: string;
  customOrderId: string;
  plan: PaymentSessionPlan;
  amount: number;
  checkoutUrl: string;
  qrCodeValue: string;
  identifierInUsd: string;
  status: PaymentSessionStatus;
  paid: boolean;
  createdAt: string;
  expiresAt: string | null;
  paidAt: string | null;
  paymentId: string | null;
  paymentMatched: boolean;
  paymentRecordedAt: string | null;
  paymentTxHash: string | null;
  webhookReceived: boolean;
  telegramId: string | null;
  twitterId: string | null;
  creditsToAdd: number;
  redirectUrl: string;
  providerPrice: number;
  providerOriginalPrice: number;
}

export interface PaymentSessionStatusResult {
  id: string;
  sessionId: string;
  planId: PaymentPlanId;
  status: PaymentSessionStatus;
  paid: boolean;
  paidAt: string | null;
  paymentId: string | null;
  paymentMatched: boolean;
  paymentRecordedAt: string | null;
  paymentTxHash: string | null;
  creditsToAdd: number;
  telegramId: string | null;
  twitterId: string | null;
  webhookReceived: boolean;
}

export type UsageRange = "7d" | "30d";
export type CreditHistoryRange = "7d" | "30d" | "all";
export type CreditHistorySource = "all" | "topup" | "signup" | "telegram" | "referral" | "other";
export type CreditHistoryItemSource = "topup" | "signup" | "referral" | "telegram" | "other";
export type CreditsDirection = "all" | "added" | "deducted";

export interface GetCreditsHistoryQuery {
  range?: CreditHistoryRange;
  source?: CreditHistorySource;
  direction?: CreditsDirection;
  page?: number;
  pageSize?: number;
}

export interface CreditsHistoryFilters {
  direction: CreditsDirection;
  page: number;
  pageSize: number;
  range: CreditHistoryRange;
  source: CreditHistorySource;
}

export interface CreditsHistoryCards {
  topUpCredits: number;
  signupBonus: number;
  telegramBonus: number;
  referralBonus: number;
}

export interface CreditsHistoryFlowSummary {
  currentBalance: number;
  visibleCreditsAdded: number;
  visibleCreditsDeducted: number;
  visibleEntries: number;
}

export interface CreditsHistoryChartEntry {
  date: string;
  addedCredits: number;
  deductedCredits: number;
  netCredits: number;
  entryCount: number;
}

export interface CreditsHistorySummary {
  filteredCredits: number;
  totalAddedCredits: number;
  topupCredits: number;
  signupCredits: number;
  telegramCredits: number;
  referralCredits: number;
}

export interface CreditsHistoryItem {
  id: string;
  apiKeyId: string | null;
  amount: number;
  change: number;
  balanceAfter: number;
  createdAt: string;
  eventType: string;
  source: CreditHistoryItemSource;
  sourceLabel: string;
}

export interface CreditsHistoryPagination {
  hasNextPage: boolean;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface CreditsHistoryResponse {
  apiKeyType: string;
  twitterId: string;
  telegramId: string;
  accountStatus: string;
  currentBalance: number;
  filters: CreditsHistoryFilters;
  cards: CreditsHistoryCards;
  flowSummary: CreditsHistoryFlowSummary;
  chart: CreditsHistoryChartEntry[];
  summary: CreditsHistorySummary;
  events: CreditsHistoryItem[];
  history: CreditsHistoryItem[];
  items: CreditsHistoryItem[];
  pagination: CreditsHistoryPagination;
}

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
export const REFERRAL_CODE_STORAGE_KEY = "pawx_referral_code";

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

const hasPathValue = (source: unknown, path: string[]) => {
  const value = readPath(source, path);
  return value !== undefined && value !== null && value !== "";
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

const readNullableString = (source: unknown, paths: string[][]) => {
  const value = pickFirst(source, paths);
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
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
const unwrapData = (payload: unknown) => readPath(payload, ["data"]) ?? payload;

const normalizeHandle = (value: string, twitterId: string) => {
  if (!value) {
    return `@${twitterId}`;
  }

  return value.startsWith("@") ? value : `@${value}`;
};

const normalizeOptionalHandle = (value: string) => {
  if (!value) {
    return "";
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

export const getAppBaseUrl = () => trimTrailingSlash(trimEnvValue(import.meta.env.VITE_PAWX_APP_URL));
export const getPaymentReturnUrl = () => {
  const configuredAppUrl = getAppBaseUrl();
  const origin = configuredAppUrl || (typeof window === "undefined" ? "" : window.location.origin);
  return origin ? `${origin}/payment/result` : "/payment/result";
};

export const getTelegramBotUsername = () => trimEnvValue(import.meta.env.VITE_TELEGRAM_BOT_USERNAME);

export const getXAuthorizationUrl = () => `${getApiBaseUrl()}/api/v1/auth/x/start`;

export const persistReferralCodeFromUrl = (search?: string) => {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(search ?? window.location.search);
  const referralCode = params.get("ref")?.trim();

  if (!referralCode) {
    return null;
  }

  window.localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, referralCode);
  return referralCode;
};

export const buildPathWithReferralCode = (path: string, search?: string) => {
  const [pathname, rawQuery = ""] = path.split("?", 2);
  const params = new URLSearchParams(rawQuery);
  const referralCode = persistReferralCodeFromUrl(search) ?? getStoredReferralCode();

  if (!referralCode || params.has("ref")) {
    return rawQuery ? `${pathname}?${params.toString()}` : pathname;
  }

  params.set("ref", referralCode);
  return `${pathname}?${params.toString()}`;
};

export const getStoredReferralCode = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(REFERRAL_CODE_STORAGE_KEY)?.trim() || null;
};

export const clearStoredReferralCode = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(REFERRAL_CODE_STORAGE_KEY);
};

export const normalizeUsageRange = (value?: string): UsageRange => {
  const normalized = value?.trim().toLowerCase();
  return normalized === "30" || normalized === "30d" ? "30d" : "7d";
};

export const normalizeCreditHistoryRange = (value?: string): CreditHistoryRange => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "7" || normalized === "7d") {
    return "7d";
  }
  if (normalized === "all") {
    return "all";
  }
  return "30d";
};

export const normalizeCreditHistorySource = (value?: string): CreditHistorySource => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "topup" || normalized === "signup" || normalized === "telegram" || normalized === "referral" || normalized === "other") {
    return normalized;
  }
  return "all";
};

export const normalizeCreditsDirection = (value?: string): CreditsDirection => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "added" || normalized === "deducted") {
    return normalized;
  }
  return "all";
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

export const buildEmptyCreditsHistory = (query: GetCreditsHistoryQuery = {}): CreditsHistoryResponse => {
  const filters = {
    direction: normalizeCreditsDirection(query.direction),
    page: Math.max(1, query.page ?? 1),
    pageSize: Math.max(1, query.pageSize ?? 10),
    range: normalizeCreditHistoryRange(query.range),
    source: normalizeCreditHistorySource(query.source),
  };

  return {
    apiKeyType: "",
    twitterId: "",
    telegramId: "",
    accountStatus: "",
    currentBalance: 0,
    filters,
    cards: {
      topUpCredits: 0,
      signupBonus: 0,
      telegramBonus: 0,
      referralBonus: 0,
    },
    flowSummary: {
      currentBalance: 0,
      visibleCreditsAdded: 0,
      visibleCreditsDeducted: 0,
      visibleEntries: 0,
    },
    chart: [],
    summary: {
      filteredCredits: 0,
      totalAddedCredits: 0,
      topupCredits: 0,
      signupCredits: 0,
      telegramCredits: 0,
      referralCredits: 0,
    },
    events: [],
    history: [],
    items: [],
    pagination: {
      hasNextPage: false,
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems: 0,
      totalPages: 0,
    },
  };
};

const sumCreditsHistoryBySource = (items: CreditsHistoryItem[], source: CreditHistoryItemSource) =>
  items.filter((item) => item.source === source && item.amount > 0).reduce((sum, item) => sum + item.amount, 0);

const getCreditHistorySourceLabel = (value: CreditHistoryItemSource) => {
  if (value === "topup") {
    return "Top Up";
  }
  if (value === "signup") {
    return "Signup";
  }
  if (value === "telegram") {
    return "Telegram";
  }
  if (value === "referral") {
    return "Referral";
  }
  return "Other";
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

const normalizeCreditHistoryItemSource = (value?: string, eventType?: string): CreditHistoryItemSource => {
  if (eventType === "telegram_bind_bonus") {
    return "telegram";
  }
  if (eventType === "signup_bonus") {
    return "signup";
  }
  if (eventType === "referral_bonus") {
    return "referral";
  }
  if (value === "signup" || value === "referral") {
    return value;
  }
  if (
    value === "topup" ||
    value === "starter_topup" ||
    value === "standard_topup" ||
    value === "advanced_topup"
  ) {
    return "topup";
  }
  if (value === "telegram" || value === "telegram_bonus" || value === "telegram_bind_bonus" || value === "telegram_bind") {
    return "telegram";
  }
  return "other";
};

export const toCreditsHistoryResponse = (payload: unknown, request: GetCreditsHistoryQuery = {}): CreditsHistoryResponse => {
  const data = unwrapData(payload);
  const filtersPayload = readPath(data, ["filters"]);
  const cardsPayload = readPath(data, ["cards"]);
  const flowSummaryPayload = readPath(data, ["flowSummary"]);
  const summaryPayload = readPath(data, ["summary"]);
  const paginationPayload = readPath(data, ["pagination"]);
  const fallback = buildEmptyCreditsHistory(request);
  const items = readArray(data, [["events"], ["items"], ["history"]]).map((entry) => {
    const eventType = readString(entry, [["eventType"], ["event_type"], ["type"], ["event"], ["label"]], "Credit event");
    const source = normalizeCreditHistoryItemSource(readString(entry, [["source"], ["category"]], "other"), eventType);
    const change = readNumber(entry, [["change"], ["amount"], ["credits"], ["value"], ["delta"]], 0);
    return {
      id: readString(entry, [["id"]]),
      apiKeyId: readNullableString(entry, [["apiKeyId"], ["api_key_id"]]),
      amount: change,
      change,
      balanceAfter: readNumber(entry, [["balanceAfter"], ["balance_after"], ["currentBalance"]], 0),
      createdAt: readString(entry, [["createdAt"], ["created_at"], ["timestamp"]]),
      eventType,
      source,
      sourceLabel: readString(entry, [["sourceLabel"], ["source_label"]], getCreditHistorySourceLabel(source)),
    };
  });

  const filters = {
    direction: normalizeCreditsDirection(readString(filtersPayload, [["direction"]], fallback.filters.direction)),
    page: Math.max(1, readNumber(filtersPayload, [["page"]], fallback.filters.page)),
    pageSize: Math.max(1, readNumber(filtersPayload, [["pageSize"], ["limit"]], fallback.filters.pageSize)),
    range: normalizeCreditHistoryRange(readString(filtersPayload, [["range"]], fallback.filters.range)),
    source: normalizeCreditHistorySource(readString(filtersPayload, [["source"]], fallback.filters.source)),
  };

  const pagination = {
    hasNextPage: readBoolean(paginationPayload, [["hasNextPage"]], false),
    page: Math.max(1, readNumber(paginationPayload, [["page"]], filters.page)),
    pageSize: Math.max(1, readNumber(paginationPayload, [["pageSize"], ["limit"]], filters.pageSize)),
    totalItems: Math.max(0, readNumber(paginationPayload, [["totalItems"], ["count"]], items.length)),
    totalPages: Math.max(0, readNumber(paginationPayload, [["totalPages"]], items.length ? 1 : 0)),
  };

  const itemTopupCredits = sumCreditsHistoryBySource(items, "topup");
  const itemSignupCredits = sumCreditsHistoryBySource(items, "signup");
  const itemTelegramCredits = sumCreditsHistoryBySource(items, "telegram");
  const itemReferralCredits = sumCreditsHistoryBySource(items, "referral");
  const summaryTopupCredits = readNumber(summaryPayload, [["topupCredits"]], itemTopupCredits);
  const summarySignupCredits = readNumber(summaryPayload, [["signupCredits"]], itemSignupCredits);
  const summaryTelegramCredits = readNumber(summaryPayload, [["telegramCredits"], ["telegramBonusCredits"], ["telegramBindCredits"]], itemTelegramCredits);
  const summaryReferralCredits = readNumber(summaryPayload, [["referralCredits"]], itemReferralCredits);
  const shouldSplitSignupAndTelegramFromItems =
    !hasPathValue(cardsPayload, ["signupBonus"]) &&
    !hasPathValue(cardsPayload, ["telegramBonus"]) &&
    !hasPathValue(summaryPayload, ["telegramCredits"]) &&
    !hasPathValue(summaryPayload, ["telegramBonusCredits"]) &&
    !hasPathValue(summaryPayload, ["telegramBindCredits"]) &&
    itemSignupCredits > 0 &&
    itemTelegramCredits > 0;

  const topupCredits = readNumber(cardsPayload, [["topUpCredits"], ["topupCredits"]], summaryTopupCredits);
  const telegramCredits = readNumber(
    cardsPayload,
    [["telegramBonus"], ["telegramCredits"], ["telegramBonusCredits"], ["telegramBindCredits"]],
    shouldSplitSignupAndTelegramFromItems ? itemTelegramCredits : summaryTelegramCredits,
  );
  const signupCredits = readNumber(
    cardsPayload,
    [["signupBonus"], ["signupCredits"]],
    shouldSplitSignupAndTelegramFromItems ? itemSignupCredits : summarySignupCredits,
  );
  const referralCredits = readNumber(cardsPayload, [["referralBonus"], ["referralCredits"]], summaryReferralCredits);
  const currentBalance = readNumber(data, [["currentBalance"], ["balance"], ["credits", "remaining"]], 0);
  const flowSummary = {
    currentBalance: readNumber(flowSummaryPayload, [["currentBalance"]], currentBalance),
    visibleCreditsAdded: readNumber(
      flowSummaryPayload,
      [["visibleCreditsAdded"]],
      items.filter((item) => item.amount > 0).reduce((sum, item) => sum + item.amount, 0),
    ),
    visibleCreditsDeducted: readNumber(
      flowSummaryPayload,
      [["visibleCreditsDeducted"]],
      items.filter((item) => item.amount < 0).reduce((sum, item) => sum + item.amount, 0),
    ),
    visibleEntries: Math.max(0, readNumber(flowSummaryPayload, [["visibleEntries"]], items.length)),
  };
  const chart = readArray(data, [["chart"]]).map((entry) => ({
    date: readString(entry, [["date"], ["createdAt"], ["created_at"]]),
    addedCredits: readNumber(entry, [["addedCredits"], ["positiveAmount"]], 0),
    deductedCredits: readNumber(entry, [["deductedCredits"], ["negativeAmount"]], 0),
    netCredits: readNumber(entry, [["netCredits"]], 0),
    entryCount: Math.max(0, readNumber(entry, [["entryCount"], ["events"]], 0)),
  }));
  const summary = {
    filteredCredits: flowSummary.visibleCreditsAdded + flowSummary.visibleCreditsDeducted,
    totalAddedCredits: topupCredits + signupCredits + telegramCredits + referralCredits,
    topupCredits,
    signupCredits,
    telegramCredits,
    referralCredits,
  };

  return {
    apiKeyType: readString(data, [["apiKeyType"], ["meta", "apiKeyType"]]),
    twitterId: readString(data, [["twitterId"], ["meta", "twitterId"]]),
    telegramId: readString(data, [["telegramId"], ["meta", "telegramId"]]),
    accountStatus: readString(data, [["accountStatus"], ["status"], ["meta", "accountStatus"]]),
    currentBalance: flowSummary.currentBalance,
    filters,
    cards: {
      topUpCredits: topupCredits,
      signupBonus: signupCredits,
      telegramBonus: telegramCredits,
      referralBonus: referralCredits,
    },
    flowSummary,
    chart,
    summary,
    events: items,
    history: items,
    items,
    pagination,
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
  telegramId: "",
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

const buildReferralLink = (referralCode: string, explicitReferralLink = "") => {
  if (explicitReferralLink) {
    return explicitReferralLink;
  }

  if (!referralCode) {
    return "";
  }

  const configuredAppUrl = getAppBaseUrl();
  const origin = configuredAppUrl || (typeof window === "undefined" ? "" : window.location.origin);
  const path = `/?ref=${encodeURIComponent(referralCode)}`;
  return origin ? `${origin}${path}` : path;
};

const normalizePaymentPlanId = (value: string): PaymentPlanId => {
  if (value === "Standard" || value === "Advanced") {
    return value;
  }

  return "Starter";
};

const normalizePaymentSessionStatus = (value: string): PaymentSessionStatus => {
  if (value === "success" || value === "expired") {
    return value;
  }

  return "pending";
};

export const toPaymentSession = (payload: unknown): PaymentSession => {
  const data = unwrapData(payload);
  const planPayload = readPath(data, ["plan"]);
  const planId = normalizePaymentPlanId(readString(planPayload, [["id"], ["planId"]], readString(data, [["planId"]], "Starter")));
  const amount = readNumber(data, [["amount"]], readNumber(planPayload, [["amount"]], 0));
  const creditsToAdd = readNumber(data, [["creditsToAdd"]], readNumber(planPayload, [["credits"]], 0));
  const status = normalizePaymentSessionStatus(readString(data, [["status"], ["invoiceStatus"], ["paymentStatus"]], "pending"));
  const paid = readBoolean(data, [["paid"]], status === "success");
  const paymentMatched = readBoolean(data, [["paymentMatched"], ["matched"]], false);
  const webhookReceived = readBoolean(data, [["webhookReceived"]], paymentMatched);

  return {
    id: readString(data, [["id"], ["sessionId"], ["customOrderId"]]),
    customOrderId: readString(data, [["customOrderId"], ["id"], ["sessionId"]]),
    plan: {
      id: planId,
      amount: readNumber(planPayload, [["amount"]], amount),
      credits: readNumber(planPayload, [["credits"]], creditsToAdd),
    },
    amount,
    checkoutUrl: readString(data, [["checkoutUrl"], ["url"], ["paymentUrl"]]),
    qrCodeValue: readString(data, [["qrCodeValue"], ["qrCode"], ["checkoutUrl"]]),
    identifierInUsd: readString(data, [["identifierInUsd"], ["identifier"], ["invoiceIdentifier"]]),
    status,
    paid,
    createdAt: readString(data, [["createdAt"]]),
    expiresAt: readString(data, [["expiresAt"]]) || null,
    paidAt: readString(data, [["paidAt"]]) || null,
    paymentId: readString(data, [["paymentId"]]) || null,
    paymentMatched,
    paymentRecordedAt: readString(data, [["paymentRecordedAt"]]) || null,
    paymentTxHash: readString(data, [["paymentTxHash"], ["txHash"]]) || null,
    webhookReceived,
    telegramId: readString(data, [["telegramId"]]) || null,
    twitterId: readString(data, [["twitterId"]]) || null,
    creditsToAdd,
    redirectUrl: readString(data, [["redirectUrl"]]),
    providerPrice: readNumber(data, [["providerPrice"]], amount),
    providerOriginalPrice: readNumber(data, [["providerOriginalPrice"]], amount),
  };
};

export const toPaymentSessionStatusResult = (payload: unknown): PaymentSessionStatusResult => {
  const data = unwrapData(payload);
  const sessionId = readString(data, [["sessionId"], ["id"]]);
  const status = normalizePaymentSessionStatus(readString(data, [["status"], ["invoiceStatus"], ["paymentStatus"]], "pending"));
  const paymentMatched = readBoolean(data, [["paymentMatched"], ["matched"]], false);
  const webhookReceived = readBoolean(data, [["webhookReceived"]], paymentMatched);

  return {
    id: sessionId,
    sessionId,
    planId: normalizePaymentPlanId(readString(data, [["planId"], ["plan", "id"]], "Starter")),
    status,
    paid: readBoolean(data, [["paid"]], status === "success"),
    paidAt: readString(data, [["paidAt"]]) || null,
    paymentId: readString(data, [["paymentId"]]) || null,
    paymentMatched,
    paymentRecordedAt: readString(data, [["paymentRecordedAt"]]) || null,
    paymentTxHash: readString(data, [["paymentTxHash"], ["txHash"]]) || null,
    creditsToAdd: readNumber(data, [["creditsToAdd"]], 0),
    telegramId: readString(data, [["telegramId"]]) || null,
    twitterId: readString(data, [["twitterId"]]) || null,
    webhookReceived,
  };
};

const readReferralCode = (payload: unknown, fallback = "") =>
  readString(payload, [["referralCode"], ["code"], ["referral", "code"], ["data", "referralCode"], ["data", "code"]], fallback);

export const toReferralProfile = (payload: unknown): ReferralProfile => {
  const referralCode = readReferralCode(payload);
  const referralLink = buildReferralLink(
    referralCode,
    readString(payload, [["referralLink"], ["link"], ["referral", "link"], ["data", "referralLink"], ["data", "link"]]),
  );
  const peopleReferred = readNumber(
    payload,
    [["peopleReferred"], ["referralCount"], ["stats", "peopleReferred"], ["referral", "count"], ["data", "stats", "peopleReferred"]],
    0,
  );
  const paidReferrals = readNumber(payload, [["paidReferrals"], ["stats", "paidReferrals"], ["data", "stats", "paidReferrals"]], 0);
  const referralPaymentCount = readNumber(
    payload,
    [["referralPaymentCount"], ["stats", "referralPaymentCount"], ["data", "stats", "referralPaymentCount"]],
    0,
  );
  const creditsEarned = readNumber(
    payload,
    [["creditsEarned"], ["referralBonus"], ["stats", "creditsEarned"], ["referral", "creditsEarned"], ["data", "stats", "creditsEarned"]],
    0,
  );
  const claimableAmountUsd =
    readString(
      payload,
      [["claimableAmountUsd"], ["stats", "claimableAmountUsd"], ["data", "stats", "claimableAmountUsd"]],
      "",
    ) || "0";
  const referrals = readArray(payload, [["referrals"], ["items"], ["data", "referrals"], ["data", "items"]]).map((item) => ({
    telegramId: readString(item, [["telegramId"], ["telegram_id"]]),
    telegramUsername: readString(item, [["telegramUsername"], ["telegram_username"], ["username"]]),
    telegramPhotoUrl: readString(item, [["telegramPhotoUrl"], ["telegram_photo_url"], ["photoUrl"], ["photo_url"]]),
    paymentCount: readNumber(item, [["paymentCount"], ["payment_count"]], 0),
    hasPaid: readBoolean(item, [["hasPaid"], ["has_paid"]], false),
    claimableAmountUsd: readString(item, [["claimableAmountUsd"], ["claimable_amount_in_usd"]], "") || "0",
    latestPaidAt: readString(item, [["latestPaidAt"], ["latest_paid_at"]]),
    createdAt: readString(item, [["createdAt"], ["created_at"]]),
  }));

  const stats: ReferralStats = {
    peopleReferred,
    paidReferrals,
    referralPaymentCount,
    creditsEarned,
    claimableAmountUsd,
  };

  return {
    referralCode,
    referralLink,
    peopleReferred,
    paidReferrals,
    referralPaymentCount,
    creditsEarned,
    claimableAmountUsd,
    stats,
    referrals,
  };
};

export const toReferralCodeResolution = (
  payload: unknown,
  fallbackReferralCode = "",
  fallbackIsValid = false,
): ReferralCodeResolution => ({
  referralCode: readReferralCode(payload, fallbackReferralCode),
  isValid: readBoolean(
    payload,
    [["isValid"], ["valid"], ["ok"], ["exists"], ["found"], ["data", "isValid"], ["data", "valid"]],
    fallbackIsValid,
  ),
  inviterName: readString(
    payload,
    [
      ["inviterName"],
      ["inviter", "name"],
      ["invitedBy", "name"],
      ["referralOwner", "name"],
      ["owner", "name"],
      ["referrerName"],
      ["referrer", "name"],
      ["referrerUsername"],
      ["referrer", "username"],
    ],
  ),
  inviterHandle: normalizeOptionalHandle(
    readString(
      payload,
      [
        ["inviterHandle"],
        ["inviter", "handle"],
        ["inviter", "username"],
        ["invitedBy", "handle"],
        ["invitedBy", "username"],
        ["referrerHandle"],
        ["referrer", "handle"],
        ["referrerUsername"],
        ["referrer", "username"],
      ],
    ),
  ),
  message: readString(payload, [["message"], ["detail"], ["error"], ["data", "message"]]),
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
  const telegramId = readString(payload, [["telegramId"], ["user", "telegramId"], ["telegram", "id"]]);
  const referralCode = readString(payload, [["referralCode"], ["user", "referralCode"], ["referral", "code"]]);

  return {
    twitterId,
    name,
    handle,
    avatar,
    profileUrl,
    telegramId,
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
      Boolean(telegramUsername || telegramId || telegramBonus > 0),
    ),
    telegramUsername,
    referralCode,
    referralCount: readNumber(payload, [["referralCount"], ["referral", "count"], ["user", "referralCount"]], 0),
    statusLabel:
      readString(payload, [["status"], ["accountStatus"], ["user", "status"], ["apiKey", "status"]]) ||
      (hasActiveApiKey ? "API key active" : "Signed in"),
  };
};

export const fetchXSession = async (ott?: string | null) => {
  try {
    const path = ott ? `/api/v1/auth/x/session?ott=${encodeURIComponent(ott)}` : "/api/v1/auth/x/session";
    const payload = await apiRequest<unknown>(path, { method: "GET" });
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

export const fetchReferralProfile = async () => {
  const payload = await apiRequest<unknown>("/api/v1/twitterUsers/api-keys/referral", { method: "GET" });
  return toReferralProfile(payload);
};

export const resolveReferralCode = async (referralCode: string) => {
  const response = await fetch(
    `${getApiBaseUrl()}/api/v1/twitterUsers/api-keys/referral/resolve?ref=${encodeURIComponent(referralCode)}`,
    {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if (response.status === 404) {
    return toReferralCodeResolution(await readResponseBody(response), referralCode, false);
  }

  if (!response.ok) {
    throw await buildErrorMessage(response);
  }

  return toReferralCodeResolution(await readResponseBody(response), referralCode, true);
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

export const fetchCreditsHistory = async (query: GetCreditsHistoryQuery = {}) => {
  const normalizedQuery = {
    direction: normalizeCreditsDirection(query.direction),
    page: Math.max(1, query.page ?? 1),
    pageSize: Math.max(1, query.pageSize ?? 10),
    range: normalizeCreditHistoryRange(query.range),
    source: normalizeCreditHistorySource(query.source),
  };
  const searchParams = new URLSearchParams({
    direction: normalizedQuery.direction,
    page: String(normalizedQuery.page),
    pageSize: String(normalizedQuery.pageSize),
    range: normalizedQuery.range,
    source: normalizedQuery.source,
  });
  const payload = await apiRequest<unknown>(`/api/v1/twitterUsers/api-keys/credits-events?${searchParams.toString()}`, {
    method: "GET",
  });

  return toCreditsHistoryResponse(payload, normalizedQuery);
};

export const createApiKey = async (sessionUser: XSessionUser, rotateExisting = false): Promise<ApiKeyMutationResult> => {
  const payload = await apiRequest<unknown>("/api/v1/twitterUsers/api-keys", {
    method: "POST",
    body: JSON.stringify(rotateExisting ? { rotateExisting: true } : {}),
  });
  const apiKey = readApiKeyValue(payload);

  if (!apiKey) {
    throw new Error("The backend did not return a new API key. Please verify the create or rotate API response format.");
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

export const createPaymentSession = async (request: CreatePaymentSessionRequest) => {
  const payload = await apiRequest<unknown>("/api/v1/payments/sessions", {
    method: "POST",
    body: JSON.stringify({
      ...request,
      redirectUrl: request.redirectUrl || getPaymentReturnUrl(),
    }),
  });

  return toPaymentSession(payload);
};

export const fetchPaymentSession = async (sessionId: string) => {
  const payload = await apiRequest<unknown>(`/api/v1/payments/sessions/${encodeURIComponent(sessionId)}`, {
    method: "GET",
  });

  return toPaymentSession(payload);
};

export const fetchPaymentSessionStatus = async (sessionId: string) => {
  const payload = await apiRequest<unknown>(`/api/v1/payments/sessions/${encodeURIComponent(sessionId)}/status`, {
    method: "GET",
  });

  return toPaymentSessionStatusResult(payload);
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
      return "X sign-in is incomplete or the session has expired. Please click Sign in with X again.";
    }

    if (error.status === 403) {
      return "The current sign-in state was rejected by the backend. Please verify the httpOnly cookie, CORS, and session configuration.";
    }

    if (error.status === 404) {
      return "No API key profile exists for this account yet. You can create one with Create API Key.";
    }

    if (error.status === 409) {
      return "This Telegram account has already been registered.";
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unknown error occurred during the sign-in flow.";
};
