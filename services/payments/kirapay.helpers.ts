import type { Context } from 'hono'
import httpStatus from 'http-status'
import type {
  InvoiceRow,
  KiraPayTransactionItem,
  KiraPayTransactionStatusResponse,
  KiraPayWebhookResponse
} from './payments.types'
import {
  firstBooleanValue,
  firstNumericValue,
  firstStringValue,
  getNestedValue,
  parseNumeric,
  toDate
} from './payments.utils'
import { config } from '@/config'
import { ApiError } from '@/utils/ApiError'
import { logger } from '@/utils/logger'

const log = logger()
const DEFAULT_KIRAPAY_API_BASE_URL = 'https://api.kira-pay.com/api'
const DEFAULT_KIRAPAY_CHECKOUT_BASE_URL = 'https://checkout.kira-pay.com'
const KIRAPAY_FETCH_TIMEOUT_MS = 10000

function getKiraPayFetchOptions(init?: RequestInit): RequestInit {
  return {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(KIRAPAY_FETCH_TIMEOUT_MS)
  }
}

export function extractKiraPayLinkIdFromUrl(url: string) {
  try {
    const parsedUrl = new URL(url)
    const segments = parsedUrl.pathname.split('/').filter((segment) => segment.length > 0)
    const code = segments.at(-1)
    if (!code) {
      return null
    }
    return code
  } catch {
    return null
  }
}

export function parseWebhookPayload(rawBody: string) {
  const trimmed = rawBody.trim()
  if (!trimmed) {
    return null
  }

  try {
    return JSON.parse(trimmed) as unknown
  } catch {}

  const formData = new URLSearchParams(trimmed)
  const entries = [...formData.entries()]

  if (entries.length === 0) {
    return null
  }

  return Object.fromEntries(entries)
}

export function getRedirectUrl(sessionId: string, requestedRedirectUrl?: string) {
  const baseUrl =
    requestedRedirectUrl || config.appBaseUrl || config.frontendUrl || 'http://localhost:5173'
  const redirectUrl = new URL(baseUrl)
  redirectUrl.searchParams.set('sessionId', sessionId)
  return redirectUrl.toString()
}

function getBackendBaseUrl(c?: Context) {
  const configuredBaseUrl = config.appBaseUrl?.trim()
  if (configuredBaseUrl) {
    return configuredBaseUrl
  }

  const callbackOrigin = firstStringValue(
    {
      xCallbackUrl: config.xCallbackUrl
    },
    ['xCallbackUrl']
  )
  if (callbackOrigin) {
    try {
      return new URL(callbackOrigin).origin
    } catch {}
  }

  if (c) {
    return new URL(c.req.url).origin
  }

  throw new ApiError(
    httpStatus.INTERNAL_SERVER_ERROR,
    'Unable to determine backend base URL for KiraPay integration'
  )
}

export function getKiraPayApiBaseUrl() {
  return config.kirapayApiBaseUrl || DEFAULT_KIRAPAY_API_BASE_URL
}

export function getKiraPayCallbackUrl(
  c: Context,
  sessionId: string,
  requestedRedirectUrl?: string
) {
  const callbackUrl = new URL('/api/v1/payments/callbacks/kirapay', getBackendBaseUrl(c))
  callbackUrl.searchParams.set('sessionId', sessionId)
  callbackUrl.searchParams.set('redirectUrl', getRedirectUrl(sessionId, requestedRedirectUrl))
  return callbackUrl.toString()
}

export function getKiraPayWebhookUrl(c?: Context) {
  return new URL('/api/v1/payments/webhooks/kirapay', getBackendBaseUrl(c)).toString()
}

export function getKiraPayCheckoutUrl(identifierInUsd: string) {
  const baseUrl = (
    config.kirapayCheckoutBaseUrl || DEFAULT_KIRAPAY_CHECKOUT_BASE_URL
  ).replace(/\/$/, '')
  return `${baseUrl}/${identifierInUsd}`
}

export function getDefaultChainName() {
  return 'Base'
}

export function getRequiredKiraPayApiKey() {
  const apiKey = config.kirapayApiKey?.trim()
  if (!apiKey) {
    throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, 'KIRAPAY_API_KEY is missing')
  }
  return apiKey
}

export async function fetchKiraPayApi<T>(
  path: string,
  searchParams?: Record<string, string | number>
) {
  const url = new URL(`${getKiraPayApiBaseUrl().replace(/\/$/, '')}${path}`)

  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    ...getKiraPayFetchOptions(),
    headers: {
      'x-api-key': getRequiredKiraPayApiKey()
    }
  })

  const payload = (await response.json().catch(() => null)) as T | null

  if (!response.ok || !payload) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Failed to fetch KiraPay resource')
  }

  return payload
}

async function fetchKiraPayTransactionStatusByHash(hash: string) {
  const url = new URL(
    `${getKiraPayApiBaseUrl().replace(/\/$/, '')}/wallet/transactions/status/${encodeURIComponent(hash)}`
  )
  const response = await fetch(url, getKiraPayFetchOptions())
  const payload = (await response
    .json()
    .catch(() => null)) as KiraPayTransactionStatusResponse | null

  if (!response.ok || !payload) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Failed to fetch KiraPay transaction status by hash')
  }

  return payload
}

async function fetchKiraPayTransactionById(id: string) {
  const url = new URL(
    `${getKiraPayApiBaseUrl().replace(/\/$/, '')}/wallet/transactions/${encodeURIComponent(id)}`
  )
  const response = await fetch(url, {
    ...getKiraPayFetchOptions(),
    headers: {
      'x-api-key': getRequiredKiraPayApiKey()
    }
  })
  const payload = (await response
    .json()
    .catch(() => null)) as KiraPayTransactionStatusResponse | null

  if (!response.ok || !payload) {
    return null
  }

  return payload
}

const KIRAPAY_CHAIN_ID_TO_NAME: Record<string, string> = {
  '1': 'Ethereum',
  '10': 'OP Mainnet',
  '56': 'BNB Smart Chain',
  '130': 'Unichain',
  '137': 'Polygon',
  '999': 'HyperEVM',
  '1868': 'Soneium',
  '8453': 'Base',
  '42161': 'Arbitrum',
  '43114': 'Avalanche',
  arb: 'Arbitrum',
  arbitrum: 'Arbitrum',
  avalanche: 'Avalanche',
  avax: 'Avalanche',
  base: 'Base',
  bnb: 'BNB Smart Chain',
  bsc: 'BNB Smart Chain',
  eth: 'Ethereum',
  ethereum: 'Ethereum',
  hyperevm: 'HyperEVM',
  matic: 'Polygon',
  op: 'OP Mainnet',
  optimism: 'OP Mainnet',
  polygon: 'Polygon',
  sol: 'Solana',
  solana: 'Solana',
  soneium: 'Soneium',
  unichain: 'Unichain'
}

function pruneUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T]
    }
  }
  return result
}

function resolveKiraPayChainName(chainId: unknown) {
  if (typeof chainId === 'number' && Number.isFinite(chainId)) {
    return KIRAPAY_CHAIN_ID_TO_NAME[String(chainId)] ?? null
  }
  if (typeof chainId === 'string' && chainId.trim().length > 0) {
    const normalized = chainId.trim().toLowerCase()
    return KIRAPAY_CHAIN_ID_TO_NAME[normalized] ?? KIRAPAY_CHAIN_ID_TO_NAME[chainId.trim()] ?? null
  }
  return null
}

async function updateKiraPayWebhook(url: string) {
  const response = await fetch(`${getKiraPayApiBaseUrl().replace(/\/$/, '')}/webhooks`, {
    ...getKiraPayFetchOptions(),
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getRequiredKiraPayApiKey()
    },
    body: JSON.stringify({
      secret: config.sessionSecret || config.jwt.secret,
      url
    })
  })

  const payload = (await response.json().catch(() => null)) as KiraPayWebhookResponse | null

  if (!response.ok || !payload) {
    throw new ApiError(httpStatus.BAD_GATEWAY, 'Failed to update KiraPay webhook endpoint')
  }

  return payload
}

export async function ensureKiraPayWebhookConfigured(c?: Context) {
  const expectedUrl = getKiraPayWebhookUrl(c)
  const existingWebhook = await fetchKiraPayApi<KiraPayWebhookResponse>('/webhooks')
  const currentUrl = existingWebhook.data?.url || existingWebhook.data?.webhookEndpoint?.url || null

  if (currentUrl === expectedUrl) {
    return {
      updated: false,
      url: expectedUrl
    }
  }

  const updatedWebhook = await updateKiraPayWebhook(expectedUrl)

  log.info({
    currentUrl,
    expectedUrl,
    message: 'KiraPay webhook endpoint synchronized',
    updatedUrl: updatedWebhook.data?.url || updatedWebhook.data?.webhookEndpoint?.url || expectedUrl
  })

  return {
    updated: true,
    url: expectedUrl
  }
}

export function getNormalizedSuccessTimestamp(payload: unknown) {
  return toDate(
    firstStringValue(payload, [
      'updatedAt',
      'createdAt',
      'timestamp',
      'data.updatedAt',
      'data.createdAt'
    ]),
    new Date(0)
  ).getTime()
}

export function getKiraPayTransactionHash(payload: unknown) {
  return firstStringValue(payload, [
    'txHash',
    'tx_hash',
    'inputTransactionHash',
    'outTxHash',
    'transactionHash',
    'transaction_hash',
    'hash',
    'data.txHash',
    'data.tx_hash',
    'data.inputTransactionHash',
    'data.outTxHash',
    'data.transactionHash',
    'data.transaction_hash',
    'data.hash',
    'payment.txHash',
    'payment.transactionHash'
  ])
}

export function getKiraPayTransactionReferences(payload: unknown) {
  const values = [
    getKiraPayTransactionHash(payload),
    firstStringValue(payload, [
      '_id',
      'transactionId',
      'transaction',
      'data._id',
      'data.transactionId',
      'data.transaction',
      'payment.transactionId'
    ])
  ]

  return new Set(
    values
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase())
  )
}

export function getKiraPayTransactionReferencesFromItem(transaction: KiraPayTransactionItem) {
  const values = [
    transaction._id,
    transaction.transactionId,
    transaction.txHash,
    transaction.tx_hash,
    transaction.inputTransactionHash,
    transaction.outTxHash,
    transaction.transactionHash,
    transaction.transaction_hash,
    transaction.hash
  ]

  return new Set(
    values
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.trim().toLowerCase())
  )
}

export function extractKiraPayTransactionFromStatusPayload(
  payload: KiraPayTransactionStatusResponse | null
) {
  if (!payload?.data || typeof payload.data !== 'object') {
    return null
  }

  const candidates = [
    payload.data,
    getNestedValue(payload, 'data.transaction'),
    getNestedValue(payload, 'data.details')
  ]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue
    }

    const transaction = candidate as KiraPayTransactionItem
    if (getKiraPayTransactionReferencesFromItem(transaction).size > 0) {
      return transaction
    }
  }

  return null
}

export function buildKiraPayTransactionDetailOverlay(transaction: KiraPayTransactionItem) {
  const txHash =
    transaction.txHash ||
    transaction.tx_hash ||
    transaction.inputTransactionHash ||
    transaction.outTxHash ||
    transaction.transactionHash ||
    transaction.transaction_hash ||
    transaction.hash ||
    null

  const resolvedFrom = firstStringValue(transaction, [
    'fromAddress',
    'from_address',
    'from',
    'sender',
    'senderAddress',
    'sender_address',
    'payer',
    'payerAddress',
    'payer_address',
    'walletAddress',
    'wallet_address',
    'wallet',
    'userWalletAddress',
    'user_wallet_address',
    'userAddress',
    'user_address',
    'summary.sender',
    'summary.from',
    'summary.fromAddress',
    'summary.walletAddress',
    'customer.address',
    'customer.walletAddress',
    'customer.wallet_address',
    'buyer.address',
    'buyer.walletAddress',
    'payment.from',
    'payment.fromAddress',
    'payment.sender',
    'payment.walletAddress'
  ])

  const resolvedTo = firstStringValue(transaction, [
    'toAddress',
    'to_address',
    'to',
    'receiver',
    'recipient',
    'merchantAddress',
    'summary.recipient',
    'summary.to',
    'summary.toAddress',
    'payment.toAddress'
  ])

  const sourceChainHint =
    firstStringValue(transaction, [
      'source',
      'tokenIn.chainId',
      'tokenIn.chainName',
      'tokenIn.network',
      'inChainId',
      'sourceChainId',
      'sourceChain',
      'fromChainId',
      'fromChain',
      'data.source',
      'data.tokenIn.chainId',
      'data.tokenIn.chainName'
    ]) ??
    firstNumericValue(transaction, [
      'tokenIn.chainId',
      'inChainId',
      'sourceChainId',
      'fromChainId',
      'data.tokenIn.chainId'
    ])
  const resolvedChain =
    transaction.chain ??
    transaction.chainName ??
    transaction.network ??
    resolveKiraPayChainName(sourceChainHint) ??
    undefined

  const resolvedToken = firstStringValue(transaction, [
    'tokenOut.symbol',
    'token',
    'tokenSymbol',
    'currency',
    'asset',
    'tokenIn.symbol'
  ])

  const resolvedCustomOrderId = firstStringValue(transaction, [
    'customOrderId',
    'summary.customOrderId',
    'metadata.customOrderId',
    'paymentLink.customOrderId'
  ])
  const resolvedLinkCode = firstStringValue(transaction, [
    'linkCode',
    'code',
    'summary.code',
    'paymentLink.code'
  ])

  return pruneUndefined({
    amount:
      transaction.settlementAmount ??
      transaction.amount ??
      transaction.paidAmount ??
      transaction.price ??
      undefined,
    chain: resolvedChain,
    code: resolvedLinkCode ?? undefined,
    createdAt: transaction.createdAt,
    customOrderId: resolvedCustomOrderId ?? undefined,
    from: resolvedFrom ?? undefined,
    fromAddress: resolvedFrom ?? undefined,
    from_address: resolvedFrom ?? undefined,
    hash: txHash ?? undefined,
    token: resolvedToken ?? undefined,
    tokenSymbol: resolvedToken ?? undefined,
    to: resolvedTo ?? undefined,
    toAddress: resolvedTo ?? undefined,
    to_address: resolvedTo ?? undefined,
    transactionHash: txHash ?? undefined,
    transactionId: transaction.transactionId ?? transaction._id ?? undefined,
    transaction_hash: txHash ?? undefined,
    txHash: txHash ?? undefined,
    tx_hash: txHash ?? undefined,
    updatedAt: transaction.updatedAt ?? undefined
  })
}

export async function enrichKiraPayPaymentPayload(
  payload: unknown,
  findTransactionByReferences: (references: Set<string>) => Promise<KiraPayTransactionItem | null>
) {
  const references = getKiraPayTransactionReferences(payload)
  if (references.size === 0) {
    return payload
  }

  const txHash = getKiraPayTransactionHash(payload)
  let statusPayload: KiraPayTransactionStatusResponse | null = null

  if (txHash) {
    try {
      statusPayload = await fetchKiraPayTransactionStatusByHash(txHash)
    } catch (error) {
      log.warn({
        error,
        message: 'Failed to fetch KiraPay transaction status by hash',
        txHash
      })
    }
  }

  let transactionDetail = extractKiraPayTransactionFromStatusPayload(statusPayload)

  const transactionId = firstStringValue(payload, [
    '_id',
    'transactionId',
    'transaction',
    'data._id',
    'data.transactionId',
    'data.transaction',
    'payment.transactionId'
  ])

  if (!transactionDetail && transactionId) {
    try {
      const detailPayload = await fetchKiraPayTransactionById(transactionId)
      transactionDetail = extractKiraPayTransactionFromStatusPayload(detailPayload)
    } catch (error) {
      log.warn({
        error,
        message: 'Failed to fetch KiraPay transaction by id',
        transactionId
      })
    }
  }

  if (!transactionDetail) {
    try {
      transactionDetail = await findTransactionByReferences(references)
    } catch (error) {
      log.warn({
        error,
        message: 'Failed to fetch KiraPay transaction detail from KiraPay API',
        references: [...references]
      })
    }
  }

  if (!payload || typeof payload !== 'object') {
    return transactionDetail ? buildKiraPayTransactionDetailOverlay(transactionDetail) : payload
  }

  const basePayload = payload as Record<string, unknown>
  const dataPayload =
    basePayload.data && typeof basePayload.data === 'object'
      ? (basePayload.data as Record<string, unknown>)
      : null

  if (!transactionDetail) {
    if (!statusPayload?.data || !dataPayload) {
      return payload
    }

    return {
      ...basePayload,
      data: {
        ...dataPayload,
        status:
          firstStringValue(dataPayload, ['status']) ||
          firstStringValue(statusPayload, ['data.status']) ||
          undefined
      }
    }
  }

  const overlay = buildKiraPayTransactionDetailOverlay(transactionDetail)

  return {
    ...basePayload,
    ...overlay,
    data: {
      ...dataPayload,
      ...overlay,
      status:
        firstStringValue(dataPayload, ['status']) ||
        firstStringValue(statusPayload, ['data.status']) ||
        firstStringValue(basePayload, ['status']) ||
        undefined
    }
  }
}

export function normalizeWebhookStatus(payload: unknown) {
  const successFlag = firstBooleanValue(payload, [
    'success',
    'paid',
    'completed',
    'data.success',
    'data.paid',
    'data.completed',
    'payment.success',
    'payment.paid'
  ])

  if (successFlag === true) {
    return {
      rawStatus: 'success',
      status: 'success' as const
    }
  }

  const rawStatus = firstStringValue(payload, [
    'status',
    'result',
    'state',
    'event',
    'eventName',
    'paymentStatus',
    'type',
    'data.status',
    'data.result',
    'data.state',
    'data.event',
    'data.eventName',
    'data.paymentStatus',
    'payment.status',
    'payment.paymentStatus'
  ])

  const normalized = rawStatus?.trim().toLowerCase() ?? null

  if (
    normalized &&
    ['paid', 'completed', 'confirmed', 'success', 'succeeded'].some((status) =>
      normalized.includes(status)
    )
  ) {
    return {
      rawStatus,
      status: 'success' as const
    }
  }

  if (
    normalized &&
    ['failed', 'cancelled', 'expired', 'voided'].some((status) => normalized.includes(status))
  ) {
    return {
      rawStatus,
      status: 'failed' as const
    }
  }

  if (
    normalized &&
    ['pending', 'processing', 'created'].some((status) => normalized.includes(status))
  ) {
    return {
      rawStatus,
      status: 'pending' as const
    }
  }

  const transactionReference = firstStringValue(payload, [
    'txHash',
    'tx_hash',
    'transactionId',
    'inputTransactionHash',
    'outTxHash',
    'transactionHash',
    'transaction_hash',
    'hash',
    'data.txHash',
    'data.tx_hash',
    'data.transactionId',
    'data.transactionHash',
    'payment.txHash',
    'payment.transactionHash'
  ])

  if (transactionReference) {
    return {
      rawStatus: rawStatus || 'txHash',
      status: 'success' as const
    }
  }

  return {
    rawStatus,
    status: null
  }
}

export function getWebhookEventName(payload: unknown) {
  return firstStringValue(payload, [
    'event',
    'eventName',
    'type',
    'data.event',
    'data.eventName',
    'payment.event'
  ])
}

export function getWebhookPaidAt(payload: unknown) {
  const paidAt = firstStringValue(payload, [
    'paidAt',
    'paid_at',
    'completedAt',
    'confirmedAt',
    'updatedAt',
    'createdAt',
    'timestamp',
    'data.paidAt',
    'data.completedAt',
    'data.updatedAt',
    'data.timestamp',
    'payment.paidAt',
    'payment.completedAt'
  ])

  return paidAt ? toDate(paidAt) : new Date()
}

export function getWebhookPaymentDetails(payload: unknown, invoice: InvoiceRow) {
  const fallbackIdentifier = invoice.identifier_in_usd || invoice.id
  const txHash =
    firstStringValue(payload, [
      'txHash',
      'tx_hash',
      'hash',
      'transactionId',
      'inputTransactionHash',
      'outTxHash',
      'transactionHash',
      'transaction_hash',
      'transaction.hash',
      'transaction.txHash',
      'transaction.tx_hash',
      'data.txHash',
      'data.tx_hash',
      'data.hash',
      'data.transactionId',
      'data.transactionHash',
      'data.transaction.hash',
      'data.transaction.txHash',
      'data.transaction.tx_hash',
      'payment.txHash',
      'payment.transactionHash'
    ]) || `kirapay:${invoice.id}:${fallbackIdentifier}`

  const sourceChainHint =
    firstStringValue(payload, [
      'source',
      'tokenIn.chainId',
      'tokenIn.chainName',
      'tokenIn.network',
      'inChainId',
      'sourceChainId',
      'sourceChain',
      'fromChainId',
      'fromChain',
      'data.source',
      'data.tokenIn.chainId',
      'data.tokenIn.chainName',
      'data.tokenIn.network',
      'data.inChainId',
      'data.sourceChainId',
      'data.sourceChain',
      'data.fromChainId',
      'data.fromChain',
      'transaction.source',
      'transaction.tokenIn.chainId',
      'data.transaction.source',
      'data.transaction.tokenIn.chainId'
    ]) ??
    firstNumericValue(payload, [
      'tokenIn.chainId',
      'inChainId',
      'sourceChainId',
      'fromChainId',
      'data.tokenIn.chainId',
      'data.inChainId',
      'data.sourceChainId',
      'data.fromChainId',
      'transaction.tokenIn.chainId',
      'data.transaction.tokenIn.chainId'
    ])
  const explicitChain = firstStringValue(payload, [
    'chain',
    'chainName',
    'network',
    'transaction.chain',
    'transaction.chainName',
    'transaction.network',
    'data.chain',
    'data.chainName',
    'data.network',
    'data.transaction.chain',
    'data.transaction.chainName',
    'payment.chain'
  ])
  const resolvedSourceChainName = resolveKiraPayChainName(sourceChainHint)
  const chain =
    resolvedSourceChainName ||
    (explicitChain && (resolveKiraPayChainName(explicitChain) || explicitChain)) ||
    getDefaultChainName()

  const amount =
    firstNumericValue(payload, [
      'settlementAmount',
      'data.settlementAmount',
      'transaction.settlementAmount',
      'data.transaction.settlementAmount',
      'amount',
      'paidAmount',
      'price',
      'transaction.amount',
      'transaction.paidAmount',
      'transaction.price',
      'data.amount',
      'data.paidAmount',
      'data.price',
      'data.transaction.amount',
      'data.transaction.paidAmount',
      'payment.amount',
      'payment.price'
    ]) ?? parseNumeric(invoice.amount)

  const token =
    firstStringValue(payload, [
      'tokenOut.symbol',
      'data.tokenOut.symbol',
      'transaction.tokenOut.symbol',
      'data.transaction.tokenOut.symbol',
      'token',
      'tokenSymbol',
      'currency',
      'asset',
      'transaction.token',
      'transaction.tokenSymbol',
      'transaction.currency',
      'transaction.asset',
      'data.token',
      'data.tokenSymbol',
      'data.currency',
      'data.asset',
      'data.transaction.token',
      'data.transaction.tokenSymbol',
      'payment.token'
    ]) || 'USDC'

  const fromAddress =
    firstStringValue(payload, [
      'fromAddress',
      'from_address',
      'from',
      'sender',
      'senderAddress',
      'sender_address',
      'payer',
      'payerAddress',
      'payer_address',
      'walletAddress',
      'wallet_address',
      'wallet',
      'userWalletAddress',
      'user_wallet_address',
      'userAddress',
      'user_address',
      'customer.address',
      'customer.walletAddress',
      'customer.wallet_address',
      'buyer.address',
      'buyer.walletAddress',
      'transaction.fromAddress',
      'transaction.from_address',
      'transaction.from',
      'transaction.sender',
      'transaction.senderAddress',
      'transaction.payer',
      'transaction.payerAddress',
      'transaction.walletAddress',
      'transaction.userWalletAddress',
      'transaction.userAddress',
      'transaction.sourceAddress',
      'data.fromAddress',
      'data.from_address',
      'data.from',
      'data.sender',
      'data.senderAddress',
      'data.payer',
      'data.payerAddress',
      'data.walletAddress',
      'data.userWalletAddress',
      'data.userAddress',
      'data.sourceAddress',
      'data.customer.address',
      'data.customer.walletAddress',
      'data.transaction.fromAddress',
      'data.transaction.from_address',
      'data.transaction.from',
      'data.transaction.sender',
      'data.transaction.payer',
      'data.transaction.walletAddress',
      'data.transaction.userWalletAddress',
      'payment.fromAddress',
      'payment.from',
      'payment.sender',
      'payment.payer',
      'payment.walletAddress'
    ]) || 'unknown'

  const defaultReceiver = config.kirapayReceiverAddress

  const toAddress =
    firstStringValue(payload, [
      'toAddress',
      'to_address',
      'to',
      'receiver',
      'recipient',
      'merchantAddress',
      'transaction.toAddress',
      'transaction.to_address',
      'transaction.to',
      'transaction.receiver',
      'transaction.recipient',
      'transaction.merchantAddress',
      'data.toAddress',
      'data.to_address',
      'data.receiver',
      'data.transaction.toAddress',
      'data.transaction.to_address',
      'data.transaction.to',
      'payment.toAddress'
    ]) ||
    defaultReceiver ||
    'unknown'

  if (fromAddress === 'unknown') {
    log.warn({
      invoiceId: invoice.id,
      message: 'KiraPay payment from_address could not be resolved — dumping payload for diagnosis',
      payload,
      txHash
    })
  }

  return {
    amount: parseNumeric(amount).toFixed(8),
    chain,
    fromAddress,
    toAddress,
    token,
    txHash
  }
}

export function buildKiraPayCallbackPayload(c: Context, rawBody?: string) {
  const queryPayload = c.req.query()
  const parsedBody = rawBody ? parseWebhookPayload(rawBody) : null
  const payload =
    parsedBody && typeof parsedBody === 'object'
      ? {
          ...queryPayload,
          ...parsedBody
        }
      : { ...queryPayload }

  if (!payload.customOrderId && payload.sessionId) {
    payload.customOrderId = payload.sessionId
  }

  return payload
}

export function buildKiraPayCallbackRedirectUrl(
  payload: Record<string, string>,
  result: {
    invoiceId?: string
    matched: boolean
    paymentId: string | null
    status: string | null
  }
) {
  const redirectUrl = payload.redirectUrl
  if (!redirectUrl) {
    return null
  }

  try {
    const targetUrl = new URL(redirectUrl)
    const sessionId = result.invoiceId || payload.sessionId || payload.customOrderId

    if (sessionId) {
      targetUrl.searchParams.set('sessionId', sessionId)
    }

    if (result.status) {
      targetUrl.searchParams.set('paymentStatus', result.status)
    }

    targetUrl.searchParams.set('paymentMatched', String(result.matched))

    if (result.paymentId) {
      targetUrl.searchParams.set('paymentId', result.paymentId)
    }

    const txHash = firstStringValue(payload, [
      'txHash',
      'tx_hash',
      'transactionId',
      'inputTransactionHash',
      'outTxHash',
      'transactionHash',
      'transaction_hash',
      'hash'
    ])

    if (txHash) {
      targetUrl.searchParams.set('txHash', txHash)
    }

    return targetUrl.toString()
  } catch {
    return null
  }
}
