import type { Context } from 'hono'
import httpStatus from 'http-status'
import db from '@/db'
import {
  buildKiraPayCallbackPayload,
  buildKiraPayCallbackRedirectUrl,
  enrichKiraPayPaymentPayload,
  extractKiraPayLinkIdFromUrl,
  getWebhookEventName,
  normalizeWebhookStatus,
  parseWebhookPayload
} from '@/services/payments/kirapay.helpers'
import {
  findKiraPayTransactionByReferences,
  findInvoiceById,
  findInvoiceByIdentifier,
  persistSuccessfulPayment,
  syncInvoicePaymentWithKiraPay
} from '@/services/payments/kirapay.session.service'
import type { DbExecutor } from '@/services/payments/payments.types'
import { firstStringValue } from '@/services/payments/payments.utils'
import { ApiError } from '@/utils/ApiError'
import { logger } from '@/utils/logger'

const log = logger()

async function findMatchedInvoiceFromWebhook(executor: DbExecutor, payload: unknown) {
  const customOrderId = firstStringValue(payload, [
    'customOrderId',
    'custom_order_id',
    'sessionId',
    'session_id',
    'invoiceId',
    'invoice_id',
    'orderId',
    'order_id',
    'summary.customOrderId',
    'data.customOrderId',
    'data.custom_order_id',
    'data.sessionId',
    'data.invoiceId',
    'data.summary.customOrderId',
    'data.metadata.customOrderId',
    'data.payment.customOrderId',
    'data.paymentLink.customOrderId',
    'metadata.customOrderId',
    'payment.customOrderId',
    'payload.customOrderId'
  ])

  if (customOrderId) {
    const invoice = await findInvoiceById(executor, customOrderId)
    if (invoice) {
      return {
        invoice,
        matchedBy: 'customOrderId'
      }
    }
  }

  const identifiers = new Set<string>()
  const linkId = firstStringValue(payload, [
    'id',
    'code',
    'linkCode',
    'link_code',
    'linkId',
    'link_id',
    'paymentLinkId',
    'summary.code',
    'data.id',
    'data.code',
    'data.linkCode',
    'data.linkId',
    'data.link_id',
    'data.paymentLinkId',
    'data.summary.code',
    'data.paymentLink.id',
    'data.paymentLink._id',
    'data.paymentLink.code',
    'payment.id',
    'payment.linkId',
    'payload.id'
  ])
  const directUrl = firstStringValue(payload, [
    'url',
    'data.url',
    'data.paymentLink.url',
    'payment.url',
    'payload.url',
    'checkoutUrl'
  ])

  if (linkId) {
    identifiers.add(linkId)
  }

  if (directUrl) {
    const extractedId = extractKiraPayLinkIdFromUrl(directUrl)
    if (extractedId) {
      identifiers.add(extractedId)
    }
  }

  for (const identifier of identifiers) {
    const invoice = await findInvoiceByIdentifier(executor, identifier)
    if (invoice) {
      return {
        invoice,
        matchedBy: 'identifierInUsd'
      }
    }
  }

  return {
    invoice: null,
    matchedBy: null
  }
}

export async function handleKiraPayRedirectCallback(c: Context) {
  const rawBody = c.req.method === 'POST' ? await c.req.text() : ''
  const payload = buildKiraPayCallbackPayload(c, rawBody)
  let result = await handleKiraPayWebhook(c, payload)

  const sessionId = payload.customOrderId || payload.sessionId || payload.invoiceId
  if (sessionId && !result.paymentId) {
    const invoice = await findInvoiceById(db('primary'), sessionId)
    if (invoice && !invoice.paid) {
      const syncedResult = await syncInvoicePaymentWithKiraPay(invoice).catch((error) => {
        log.error({
          error,
          invoiceId: invoice.id,
          message: 'Failed to sync KiraPay payment during redirect callback'
        })
        return null
      })

      if (syncedResult) {
        result = syncedResult
      }
    }
  }

  const redirectUrl = buildKiraPayCallbackRedirectUrl(payload, result)

  log.info({
    message: 'KiraPay redirect callback processed',
    payload,
    redirectUrl,
    result
  })

  return {
    redirectUrl,
    result
  }
}

export async function handleKiraPayWebhook(_c: Context, rawPayload: unknown) {
  const parsedPayload =
    typeof rawPayload === 'string' ? parseWebhookPayload(rawPayload) : (rawPayload as unknown)

  if (!parsedPayload) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid KiraPay payload')
  }

  const eventName = getWebhookEventName(parsedPayload)
  log.info({
    eventName,
    message: 'KiraPay webhook received (raw)',
    payload: parsedPayload
  })

  const payload = await enrichKiraPayPaymentPayload(
    parsedPayload,
    findKiraPayTransactionByReferences
  ).catch((error) => {
    log.warn({
      error,
      message: 'Failed to enrich KiraPay webhook payload — continuing with raw payload'
    })
    return parsedPayload
  })

  const { rawStatus, status } = normalizeWebhookStatus(payload)
  log.info({
    eventName,
    message: 'KiraPay webhook enriched',
    payload,
    rawStatus,
    status
  })

  const result = await db('primary').transaction(async (tx: DbExecutor) => {
    const { invoice, matchedBy } = await findMatchedInvoiceFromWebhook(tx, payload)

    if (!invoice) {
      log.warn({
        eventName,
        message: 'KiraPay webhook could not be matched to any invoice — dropping',
        payload,
        rawStatus,
        status
      })
      return {
        acknowledged: true,
        matched: false,
        matchedBy: null,
        paymentId: null,
        status,
        webhookEvent: eventName
      }
    }

    if (status !== 'success') {
      return {
        acknowledged: true,
        invoiceId: invoice.id,
        matched: true,
        matchedBy,
        paymentId: null,
        status: status || 'pending',
        webhookEvent: eventName
      }
    }
    return persistSuccessfulPayment(tx, invoice, payload, matchedBy, eventName)
  })

  log.info({
    eventName,
    message: 'KiraPay webhook processed',
    rawStatus,
    result,
    status
  })

  return result
}
