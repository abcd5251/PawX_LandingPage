import {
  searchKeywordMonitors as sharedSearchKeywordMonitors,
  searchResults as sharedSearchResults,
  twitterUsers as sharedTwitterUsers,
  tweets as sharedTweets
} from '@yidongw/pawx-schemas'
import { count, desc, or, eq, sum, and, gt, lt, sql } from 'drizzle-orm'
import { LRUCache } from 'lru-cache'
import { ApiError } from '../utils/ApiError'
import db from '@/db'
import { withDbError } from '@/utils/db'
import { logger } from '@/utils/logger'

const searchKeywordMonitors: any = sharedSearchKeywordMonitors
const searchResults: any = sharedSearchResults
const twitterUsers: any = sharedTwitterUsers
const tweets: any = sharedTweets

// Cache setup for search keyword monitors
const monitorsCache = new LRUCache<
  string,
  {
    data: any
    timestamp: number
  }
>({
  max: 100, // Store up to 100 different cache entries
  ttl: 10 * 60 * 1000 // Cache for 10 minutes
})

/**
 * Parse a slug into handle and counter
 * Examples: "solana-pump" -> { handle: "solana-pump", counter: 0 }
 *          "solana-pump-1" -> { handle: "solana-pump", counter: 1 }
 */
function parseSlug(slug: string): { handle: string; counter: number } {
  const parts = slug.split('-')
  const lastPart = parts[parts.length - 1]

  // Check if the last part is a number
  const counterMatch = lastPart.match(/^\d+$/)
  if (counterMatch && parts.length > 1) {
    const counter = parseInt(lastPart, 10)
    const handle = parts.slice(0, -1).join('-')
    return { handle, counter }
  }

  // No counter found, treat entire string as handle with counter 0
  return { handle: slug, counter: 0 }
}

/**
 * Create a slug from handle and counter (opposite of parseSlug)
 * Examples: { handle: "solana-pump", counter: 0 } -> "solana-pump"
 *          { handle: "solana-pump", counter: 1 } -> "solana-pump-1"
 */
function createSlug(handle: string, counter: number): string {
  return counter > 0 ? `${handle}-${counter}` : handle
}

/**
 * Get monitor ID from slug
 */
async function getMonitorIdFromSlug(slug: string): Promise<number | null> {
  const { handle, counter } = parseSlug(slug)

  const monitor = await withDbError(
    db()
      .select({ id: searchKeywordMonitors.id })
      .from(searchKeywordMonitors)
      .where(
        or(
          and(eq(searchKeywordMonitors.handle, handle), eq(searchKeywordMonitors.counter, counter)),
          and(eq(searchKeywordMonitors.handle, slug), eq(searchKeywordMonitors.counter, 0))
        )
      )
      .limit(1)
  )

  return monitor.length > 0 ? monitor[0].id : null
}

/**
 * Validate and reserve a code for use
 */
// async function validateAndReserveCode(codeString: string): Promise<{ id: number } | null> {
//   try {
//     // Mark the code as used
//     const code = await withDbError(
//       db()
//         .update(codes)
//         .set({
//           used: true
//         })
//         .where(and(eq(codes.code, codeString), eq(codes.used, false)))
//         .returning()
//     )

//     return code[0]
//   } catch (error) {
//     logger().error(error, 'Failed to validate and reserve code')
//     return null
//   }
// }

export async function addSearchKeywordMonitor(data: {
  name: string
  keywords: string[]
  code?: string
  rewardAmount?: number | null
  rewardTicker?: string | null
  rewardChain?: string | null
  rewardTokenAddress?: string | null
}) {
  try {
    // First, validate and reserve the code
    // const codeRecord = await validateAndReserveCode(data.code)
    // if (!codeRecord) {
    //   throw new Error('Invalid or already used code')
    // }

    // Generate base handle from name
    const baseHandle = data.name
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .trim()

    // Find the highest counter for this handle
    const existingHandles = await withDbError(
      db('primary')
        .select({ counter: searchKeywordMonitors.counter })
        .from(searchKeywordMonitors)
        .where(eq(searchKeywordMonitors.handle, baseHandle))
        .orderBy(desc(searchKeywordMonitors.counter))
        .limit(1)
    )

    // Determine the counter to use
    const counter = existingHandles.length > 0 ? existingHandles[0].counter + 1 : 0

    const result = await withDbError(
      db()
        .insert(searchKeywordMonitors)
        .values({
          name: data.name,
          handle: baseHandle,
          counter: counter,
          keywords: data.keywords,
          rewardAmount: data.rewardAmount || null,
          rewardTicker: data.rewardTicker || null,
          rewardChain: data.rewardChain || null,
          rewardTokenAddress: data.rewardTokenAddress || null,
          createdAt: new Date(),
          updatedAt: new Date(),
          nextSearchAt: new Date() // Start searching immediately
        })
        .returning()
    )

    const monitor = result[0]
    return {
      ...monitor,
      slug: createSlug(monitor.handle, monitor.counter)
    }
  } catch (error) {
    logger().error(error, 'Failed to add search keyword monitor')
    throw error
  }
}

/**
 * Get all search keyword monitors with statistics
 */
export async function getSearchKeywordMonitors() {
  try {
    // Fetch all monitors with materialized counts (no joins needed!)
    const monitors = await withDbError(
      db('primary')
        .select({
          id: searchKeywordMonitors.id,
          name: searchKeywordMonitors.name,
          status: searchKeywordMonitors.status,
          handle: searchKeywordMonitors.handle,
          counter: searchKeywordMonitors.counter,
          keywords: searchKeywordMonitors.keywords,
          createdAt: searchKeywordMonitors.createdAt,
          endAt: searchKeywordMonitors.endAt,
          rewardAmount: searchKeywordMonitors.rewardAmount,
          rewardTicker: searchKeywordMonitors.rewardTicker,
          rewardChain: searchKeywordMonitors.rewardChain,
          rewardTokenAddress: searchKeywordMonitors.rewardTokenAddress,
          tweetCount: sql<number>`COUNT(DISTINCT ${searchResults.tweetId})`,
          userCount: sql<number>`COUNT(DISTINCT ${searchResults.userId})`
        })
        .from(searchKeywordMonitors)
        .leftJoin(searchResults, eq(searchKeywordMonitors.id, searchResults.monitorId))
        .groupBy(searchKeywordMonitors.id)
        .orderBy(desc(searchKeywordMonitors.createdAt))
    )

    // Add slug to each monitor
    const monitorsWithSlug = monitors.map(({ handle, counter, ...rest }) => ({
      ...rest,
      tweetCount: Number(rest.tweetCount || 0),
      userCount: Number(rest.userCount || 0),
      slug: createSlug(handle, counter)
    }))

    return monitorsWithSlug
  } catch (error) {
    logger().error(error, 'Failed to get search keyword monitors')
    throw error
  }
}

/**
 * Get all search keyword monitors with statistics
 */
export async function getSearchKeywordMonitor(slug: string) {
  const { handle, counter } = parseSlug(slug)

  try {
    // Fetch monitor with materialized counts (no joins needed!)
    const monitors = await withDbError(
      db()
        .select({
          id: searchKeywordMonitors.id,
          name: searchKeywordMonitors.name,
          status: searchKeywordMonitors.status,
          handle: searchKeywordMonitors.handle,
          counter: searchKeywordMonitors.counter,
          keywords: searchKeywordMonitors.keywords,
          createdAt: searchKeywordMonitors.createdAt,
          endAt: searchKeywordMonitors.endAt,
          rewardAmount: searchKeywordMonitors.rewardAmount,
          rewardTicker: searchKeywordMonitors.rewardTicker,
          rewardChain: searchKeywordMonitors.rewardChain,
          rewardTokenAddress: searchKeywordMonitors.rewardTokenAddress,
          tweetCount: sql<number>`COUNT(DISTINCT ${searchResults.tweetId})`,
          userCount: sql<number>`COUNT(DISTINCT ${searchResults.userId})`
        })
        .from(searchKeywordMonitors)
        .where(
          or(
            and(
              eq(searchKeywordMonitors.handle, handle),
              eq(searchKeywordMonitors.counter, counter)
            ),
            and(eq(searchKeywordMonitors.handle, slug), eq(searchKeywordMonitors.counter, 0))
          )
        )
        .leftJoin(searchResults, eq(searchKeywordMonitors.id, searchResults.monitorId))
        .groupBy(searchKeywordMonitors.id)
        .orderBy(desc(searchKeywordMonitors.createdAt))
    )
    // Convert counts to numbers and add slug
    const monitorsWithNumericCounts = monitors.map(({ handle, counter, ...rest }) => ({
      ...rest,
      tweetCount: Number(rest.tweetCount || 0),
      userCount: Number(rest.userCount || 0),
      slug: createSlug(handle, counter)
    }))

    if (!monitorsWithNumericCounts[0]) {
      throw new ApiError(404, `Monitor with slug "${slug}" not found`)
    }

    return monitorsWithNumericCounts[0]
  } catch (error) {
    logger().error(error, 'Failed to get search keyword monitors')
    throw error
  }
}

/**
 * Get tweets for a specific search keyword monitor by slug with date filtering
 */
export async function getSearchKeywordMonitorTweets(
  slug: string,
  createdAfter?: Date,
  createdBefore?: Date,
  limit: number = 20
) {
  try {
    const monitorId = await getMonitorIdFromSlug(slug)
    if (!monitorId) {
      throw new ApiError(404, `Monitor with slug "${slug}" not found`)
    }

    // Get tweets with date filtering
    const tweetResults = await withDbError(
      db()
        .select({
          // Tweet fields
          id: tweets.id,
          text: tweets.text,
          entities: tweets.entities,
          medias: tweets.medias,
          inReplyToStatusIdStr: tweets.inReplyToStatusIdStr,
          inReplyToUserIdStr: tweets.inReplyToUserIdStr,
          inReplyToUserScreenName: tweets.inReplyToUserScreenName,
          quotedStatusIdStr: tweets.quotedStatusIdStr,
          quotedUserScreenName: tweets.quotedUserScreenName,
          retweetedStatusIdStr: tweets.retweetedStatusIdStr,
          retweetedUserIdStr: tweets.retweetedUserIdStr,
          retweetedUserScreenName: tweets.retweetedUserScreenName,
          retweetedStatusCreatedAt: tweets.retweetedStatusCreatedAt,
          favoriteCount: tweets.favoriteCount,
          bookmarkCount: tweets.bookmarkCount,
          viewCount: tweets.viewCount,
          quoteCount: tweets.quoteCount,
          replyCount: tweets.replyCount,
          retweetCount: tweets.retweetCount,
          fullText: tweets.fullText,
          notetweetEntities: tweets.notetweetEntities,
          createdAt: tweets.createdAt,
          analysis: searchResults.analysis,

          // User fields
          user: {
            id: twitterUsers.id,
            name: twitterUsers.name,
            screenName: twitterUsers.screenName,
            description: twitterUsers.description,
            location: twitterUsers.location,
            website: twitterUsers.website,
            followersCount: twitterUsers.followersCount,
            friendsCount: twitterUsers.friendsCount,
            profileImageUrlHttps: twitterUsers.profileImageUrlHttps,
            profileBannerUrl: twitterUsers.profileBannerUrl,
            kolFollowersCount: twitterUsers.kolFollowersCount
          }
        })
        .from(searchResults)
        .innerJoin(tweets, eq(searchResults.tweetId, tweets.id))
        .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
        .where(
          and(
            eq(searchResults.monitorId, monitorId),
            createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
            createdBefore ? lt(tweets.createdAt, createdBefore) : undefined
          )
        )
        .orderBy(desc(tweets.createdAt))
        .limit(limit)
    )

    return tweetResults
  } catch (error) {
    logger().error(error, `Failed to get tweets for search keyword monitor slug ${slug}`)
    throw error
  }
}

/**
 * Get top users for a specific search keyword monitor by slug
 */
export async function getSearchKeywordMonitorUsers(slug: string, useCache: boolean = true) {
  const cacheKey = `monitor_users_${slug}`

  // Try to get from cache if useCache is true
  if (useCache) {
    const cached = monitorsCache.get(cacheKey)
    if (cached) {
      return cached.data
    }
  }

  try {
    const monitorId = await getMonitorIdFromSlug(slug)
    if (!monitorId) {
      throw new ApiError(404, `Monitor with slug "${slug}" not found`)
    }

    // First, get the total score for this monitor
    const totalScoreResult = await withDbError(
      db()
        .select({
          totalScore: sum(searchResults.score).mapWith(Number)
        })
        .from(searchResults)
        .where(eq(searchResults.monitorId, monitorId))
    )
    const totalScore = totalScoreResult[0]?.totalScore || 0

    // Then get top 50 users ranked by their total score
    const users = await withDbError(
      db()
        .select({
          userId: searchResults.userId,
          name: twitterUsers.name,
          screenName: twitterUsers.screenName,
          description: twitterUsers.description,
          website: twitterUsers.website,
          location: twitterUsers.location,
          followersCount: twitterUsers.followersCount,
          friendsCount: twitterUsers.friendsCount,
          profileImageUrlHttps: twitterUsers.profileImageUrlHttps,
          profileBannerUrl: twitterUsers.profileBannerUrl,
          kolFollowersCount: twitterUsers.kolFollowersCount,
          totalScore: sum(searchResults.score).mapWith(Number),
          tweetCount: count(searchResults.tweetId).mapWith(Number)
        })
        .from(searchResults)
        .leftJoin(twitterUsers, eq(searchResults.userId, twitterUsers.id))
        .where(eq(searchResults.monitorId, monitorId))
        .groupBy(
          searchResults.userId,
          twitterUsers.name,
          twitterUsers.screenName,
          twitterUsers.description,
          twitterUsers.website,
          twitterUsers.location,
          twitterUsers.followersCount,
          twitterUsers.friendsCount,
          twitterUsers.profileImageUrlHttps,
          twitterUsers.profileBannerUrl,
          twitterUsers.kolFollowersCount
        )
        .orderBy(desc(sum(searchResults.score)))
        .limit(50)
    )
    // Calculate percentage for each user
    const result = users.map(({ totalScore: userScore, ...rest }) => ({
      ...rest,
      percentage: totalScore > 0 ? Math.round((userScore / totalScore) * 10000) / 100 : 0
    }))

    // Cache the result
    monitorsCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    })

    return result
  } catch (error) {
    logger().error(error, `Failed to get users for search keyword monitor slug ${slug}`)
    throw error
  }
}

/**
 * Force refresh the cache for a specific monitor's users by slug
 */
export async function refreshSearchKeywordMonitorUsersCache(slug: string) {
  const cacheKey = `monitor_users_${slug}`

  // Delete existing cache entry
  monitorsCache.delete(cacheKey)

  // Start refreshing the cache in the background
  void getSearchKeywordMonitorUsers(slug, false)

  // Return immediately to not block the caller
  return { success: true, message: 'Cache refresh initiated' }
}
