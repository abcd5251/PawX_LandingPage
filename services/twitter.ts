import {
  followings as sharedFollowings,
  pastUsernames as sharedPastUsernames,
  tweets as sharedTweets,
  TwitterUser as SharedTwitterUserFromDb,
  twitterUsers as sharedTwitterUsers,
  twitterUsersProfileHistory as sharedTwitterUsersProfileHistory,
  type NewTweet,
  type NewTwitterUser,
  userCa as sharedUserCa
} from '@yidongw/pawx-schemas'
import {
  gt,
  or,
  eq,
  sql,
  SQL,
  and,
  asc,
  lte,
  desc,
  isNull,
  inArray,
  isNotNull,
  lt,
  gte
} from 'drizzle-orm'
import { PgTransaction } from 'drizzle-orm/pg-core'
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { ApiError } from '../utils/ApiError'

import db from '@/db'
import {
  batchFetchUsersByIds,
  batchFetchUsersByUsernames283,
  fetchUserTweetsRepliesAdvanced
} from '@/services/rapidapi.service'
import { fetchFullTweetByIds, type FullTwitterStatus } from '@/services/rapidapi.service'
import { chunk } from '@/utils/chunk'
import { withDbError, withRawSqlError } from '@/utils/db'
// await withRawSqlError()
import { logger } from '@/utils/logger'

const tweets: any = sharedTweets
const twitterUsers: any = sharedTwitterUsers
const pastUsernames: any = sharedPastUsernames
const twitterUsersProfileHistory: any = sharedTwitterUsersProfileHistory
const userCa: any = sharedUserCa
const followings: any = sharedFollowings
type TwitterUserFromDb = SharedTwitterUserFromDb

export interface TwitterStatusMedia {
  id_str: string
  type: string
  media_url_https: string
  url: string
  sizes: {
    large: {
      h: number
      w: number
    }
  }
  video_info?: {
    aspect_ratio: number[]
    duration_millis: number
    variants: {
      bitrate?: number
      content_type: string
      url: string
    }[]
  }
}

interface TweetUrl {
  display_url: string // eg. "time.fun"
  expanded_url: string // eg. "http://time.fun"
  indices: number[] // eg. [0, 23]
  url: string // eg. "https://t.co/hLL3K58de4"
}

interface TweetUserMention {
  id_str: string
  indices: number[]
  name: string
  screen_name: string
}

export interface TwitterStatusEntities {
  hashtags: {
    indices: number[]
    text: string
  }[]
  symbols: {
    indices: number[]
    text: string
  }[]
  urls: TweetUrl[]
  user_mentions: TweetUserMention[]
}

export interface LookupStatus {
  id: string
  userId: string
  text: string
  truncated: boolean
  entities: TwitterStatusEntities
  medias: TwitterStatusMedia[] | null
  inReplyToStatusIdStr: string | null
  inReplyToUserIdStr: string | null
  inReplyToUserScreenName: string | null
  quotedStatusIdStr: string | null
  quotedUserScreenName: string | null
  quotedUserIdStr: string | null
  retweetedStatusIdStr: string | null
  retweetedUserIdStr: string | null
  retweetedUserScreenName: string | null
  retweetedStatusCreatedAt: Date | null
  favoriteCount: number
  retweetCount: number
  createdAt: Date
  updatedAt: Date
  quotedStatus?: LookupStatus
}

export interface LookupUser {
  id: string
  name: string
  screenName: string
  location: string
  description: string
  website: string
  friendsCount: number
  profileImageUrlHttps: string
  profileBannerUrl: string
  lastTweetId: string
  followersCount: number
  createdAt: Date
  favouritesCount: number
  verified: boolean
  statusesCount: number
  updatedAt: Date
  deletedAt: Date | null
  protectedAt: Date | null
  status?: LookupStatus | null
  rawStatus?: any
}

export async function upsertTwitterUsers(users: LookupUser[] = []) {
  if (users.length === 0) {
    return []
  }

  // Convert numeric IDs to strings for consistent sorting
  const sortedUsers = [...users].sort((a, b) => String(a.id).localeCompare(String(b.id)))

  // Prepare user data
  const now = new Date()
  const usersData = sortedUsers.map((user) => ({
    id: user.id,
    name: user.name || '',
    screenName: user.screenName,
    location: user.location,
    description: user.description,
    website: user.website,
    followersCount: user.followersCount,
    friendsCount: user.friendsCount,
    createdAt: user.createdAt,
    favouritesCount: user.favouritesCount,
    verified: user.verified,
    statusesCount: user.statusesCount,
    mediaCount: 0,
    profileImageUrlHttps: user.profileImageUrlHttps,
    profileBannerUrl: user.profileBannerUrl,
    isKol: false,
    kolFollowersCount: 0,
    tags: [],
    lastTweetId: user.lastTweetId,
    updatedAt: now,
    deletedAt: null,
    protectedAt: user.protectedAt,
    foundAt: now
  }))

  // Insert in batches of 2000
  const BATCH_SIZE = 2000
  const results = []

  for (let i = 0; i < usersData.length; i += BATCH_SIZE) {
    const batch = usersData.slice(i, i + BATCH_SIZE)

    const query = db()
      .insert(twitterUsers)
      .values(batch)
      .onConflictDoUpdate({
        target: twitterUsers.id,
        set: {
          name: sql`EXCLUDED.name`,
          screenName: sql`EXCLUDED.screen_name`,
          location: sql`EXCLUDED.location`,
          description: sql`EXCLUDED.description`,
          website: sql`EXCLUDED.website`,
          followersCount: sql`EXCLUDED.followers_count`,
          friendsCount: sql`EXCLUDED.friends_count`,
          favouritesCount: sql`EXCLUDED.favourites_count`,
          verified: sql`EXCLUDED.verified`,
          statusesCount: sql`EXCLUDED.statuses_count`,
          profileImageUrlHttps: sql`EXCLUDED.profile_image_url_https`,
          profileBannerUrl: sql`EXCLUDED.profile_banner_url`,
          lastTweetId: sql`EXCLUDED.last_tweet_id`,
          updatedAt: sql`EXCLUDED.updated_at`,
          deletedAt: null,
          protectedAt: sql`EXCLUDED.protected_at`
        }
      })
      .returning()

    const batchResults = await withDbError(query)

    results.push(...batchResults)
  }

  return results
}

export interface UserFollowingDelta {
  userId: string
  friendsCount: number
  currentFriendsIds: string[]
  existingFollowingIds: Set<string>
  deletedFollowingIds: Set<string>
  isFollowingsOrdered: boolean
  followedUserIds: string[]
  unfollowedUserIds: string[]
  refollowedUserIds: string[]
}

/**
 * Bulk save followings for multiple users with their follower counts
 */
export async function bulkSaveFollowingsForMultipleUsers(
  changesByUser: Map<
    string,
    { userId: string; followedUserIds: string[]; unfollowedUserIds: string[] }
  >,
  userFollowersCountMap: Map<string, number>,
  kolFollowersCountMap: Map<string, number>,
  maxPositionMap: Map<string, number>,
  kolUserIdsMap: Map<string, boolean>,
  tx?: any
) {
  // Create a map to track current position for each KOL follower
  const currentPositionMap = new Map(
    Array.from(changesByUser.keys()).map((follower) => [
      follower,
      maxPositionMap.get(follower) || 0
    ])
  )

  // Create a map to track current followeeKeyFollowers for each followee
  const currentFolloweeKeyFollowersMap = new Map(
    Array.from(kolFollowersCountMap.entries()).map(([followee, count]) => [followee, count])
  )

  const now = new Date()
  const allFollowingsToInsert = Array.from(changesByUser.values()).flatMap((change) => {
    const isKol = kolUserIdsMap.get(change.userId) || false

    change.unfollowedUserIds.forEach((unfolloweeId) => {
      if (isKol) {
        // Get and increment followeeKeyFollowers for this followee
        const currentKeyFollowers = currentFolloweeKeyFollowersMap.get(unfolloweeId) || 0
        currentFolloweeKeyFollowersMap.set(unfolloweeId, currentKeyFollowers - 1)
      }
    })

    return change.followedUserIds.map((followeeId) => {
      // Get and increment position for this follower
      const currentPosition = currentPositionMap.get(change.userId) || 0
      currentPositionMap.set(change.userId, currentPosition + 1)
      const followerPosition = currentPosition + 1

      const currentKeyFollowers = currentFolloweeKeyFollowersMap.get(followeeId) || 0
      const followeeKeyFollowers = currentKeyFollowers

      if (isKol) {
        // Get and increment followeeKeyFollowers for this followee
        currentFolloweeKeyFollowersMap.set(followeeId, currentKeyFollowers + 1)
      }

      const isUserFollowersCountProvided = userFollowersCountMap.get(followeeId) !== undefined

      return {
        follower: change.userId,
        followee: followeeId,
        followeeFollowers: isUserFollowersCountProvided
          ? userFollowersCountMap.get(followeeId)!
          : null,
        followeeKeyFollowers: isUserFollowersCountProvided ? followeeKeyFollowers : null,
        followerPosition,
        createdAt: isUserFollowersCountProvided ? now : null
      }
    })
  })

  if (allFollowingsToInsert.length === 0) {
    return []
  }

  const BATCH_SIZE = 1000 // Reduced from 5000 to smaller batches
  let allResults: Array<{
    id: number
    follower: string
    followee: string
    followeeKeyFollowers: number | null
  }> = []

  // Sort allFollowingsToInsert to ensure consistent lock ordering
  allFollowingsToInsert.sort((a, b) => {
    // First compare by follower
    const followerCompare = a.follower.localeCompare(b.follower)
    if (followerCompare !== 0) return followerCompare

    // Then by followee if follower is the same
    return a.followee.localeCompare(b.followee)
  })

  // Split into batches
  for (let i = 0; i < allFollowingsToInsert.length; i += BATCH_SIZE) {
    const batch = allFollowingsToInsert.slice(i, i + BATCH_SIZE)

    const batchResults = await withDbError(
      (tx || db())
        .insert(followings)
        .values(batch)
        .returning({
          id: followings.id,
          follower: followings.follower,
          followee: followings.followee,
          followeeKeyFollowers: followings.followeeKeyFollowers
        })
        .onConflictDoUpdate({
          target: [followings.follower, followings.followee],
          set: {
            followeeFollowers: sql`excluded.followee_followers`,
            followeeKeyFollowers: sql`excluded.followee_key_followers`,
            followerPosition: sql`excluded.follower_position`,
            createdAt: sql`excluded.created_at`,
            deletedAt: null
          }
        })
    )

    allResults = [...allResults, ...(batchResults as any)]
  }

  return allResults
}

export async function deleteUnfollowedUsers(
  unfollowedPairs: Array<{ follower: string; followee: string }>,
  tx?: PostgresJsDatabase
) {
  if (unfollowedPairs.length > 0) {
    await withDbError(
      (tx || db())
        .update(followings)
        .set({
          deletedAt: new Date()
        })
        .where(
          or(
            ...unfollowedPairs.map((pair) =>
              and(
                eq(followings.follower, pair.follower),
                eq(followings.followee, pair.followee),
                isNull(followings.deletedAt)
              )
            )
          )
        )
    )
  }
}

export async function bulkRestoreFollowings(
  refollowedPairs: {
    follower: string
    followee: string
  }[],
  tx?: PgTransaction<any, any, any>
) {
  logger().info(
    `Restoring ${refollowedPairs.length} refollowed pairs: ${JSON.stringify(refollowedPairs)}`
  )

  if (refollowedPairs.length > 0) {
    // Update all refollowed pairs to clear their deletedAt
    await withDbError(
      (tx || db())
        .update(followings)
        .set({
          deletedAt: null
        })
        .where(
          or(
            ...refollowedPairs.map((pair) =>
              and(
                eq(followings.follower, pair.follower),
                eq(followings.followee, pair.followee),
                isNotNull(followings.deletedAt)
              )
            )
          )
        )
        .returning({
          follower: followings.follower,
          followee: followings.followee,
          createdAt: followings.createdAt
        })
    )
  }

  return refollowedPairs
}

export interface TweetUserForUpdate {
  id: string
  name: string
  screenName: string
  location: string
  description: string
  website: string
  friendsCount: number
  statusesCount: number
  profileImageUrlHttps: string
  profileBannerUrl: string
  lastTweetId: string
  protectedAt?: Date | null
}

export async function bulkSaveFollowingChanges(
  followingChangesData: Array<{
    userId: string
    oldFollowings: number
    newFollowings: number
    source: string
  }>,
  tx?: PostgresJsDatabase
): Promise<TwitterUserFromDb[]> {
  if (followingChangesData.length === 0) {
    return []
  }

  // Prepare the values string with proper escaping
  const valuesStrings = followingChangesData.map((change) => {
    // Properly escape string values
    const escapedUserId = change.userId.replace(/'/g, "''")
    const escapedSource = change.source.replace(/'/g, "''")

    return `('${escapedUserId}', ${change.oldFollowings}, ${change.newFollowings}, '${escapedSource}', 'pending')`
  })

  // Join all value sets with commas
  const valuesClause = valuesStrings.join(', ')

  // Construct the entire SQL query as a string
  const query = `
    INSERT INTO following_changes (user_id, old_followings, new_followings, source, core_status)
    VALUES ${valuesClause}
    ON CONFLICT (user_id) WHERE core_status = 'pending'
    DO UPDATE SET 
      new_followings = EXCLUDED.new_followings
  `

  // Execute the raw SQL query
  await withRawSqlError(sql.raw(query), tx)

  return []
}

export async function bulkSaveStatusesCountChanges(
  statusesCountChangesData: Array<{
    userId: string
    oldStatusesCount: number
    oldStatusesCountTimestamp: Date
    newStatusesCount: number
  }>,
  tx?: PostgresJsDatabase
): Promise<TwitterUserFromDb[]> {
  if (statusesCountChangesData.length === 0) {
    return []
  }

  // Prepare the values string with proper escaping
  const valuesStrings = statusesCountChangesData.map((change) => {
    // Properly escape string values
    const escapedUserId = change.userId.replace(/'/g, "''")

    return `('${escapedUserId}', ${change.oldStatusesCount}, '${change.oldStatusesCountTimestamp.toISOString()}'::timestamp, ${change.newStatusesCount}, 'pending')`
  })

  // Join all value sets with commas
  const valuesClause = valuesStrings.join(', ')

  // Construct the entire SQL query as a string
  const query = `
    INSERT INTO statuses_count_changes (user_id, old_statuses_count, old_statuses_count_timestamp, new_statuses_count, core_status)
    VALUES ${valuesClause}
    ON CONFLICT (user_id) WHERE core_status = 'pending'
    DO UPDATE SET
      new_statuses_count = EXCLUDED.new_statuses_count,
      new_statuses_count_timestamp = now()
  `

  // Execute the raw SQL query
  await withRawSqlError(sql.raw(query), tx)

  return []
}

export async function bulkSaveTweetUsers(
  users: TweetUserForUpdate[],
  tx?: PostgresJsDatabase
): Promise<TwitterUserFromDb[]> {
  const usersMap: Record<string, TweetUserForUpdate> = {}
  const ids: string[] = []
  users.forEach((user) => {
    usersMap[user.id] = user
    ids.push(user.id)
  })

  const updateFields = Object.keys(users[0]).filter((key) => key !== 'id')
  const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase())

  // Fields that have NOT NULL constraints and should default to empty string
  const notNullStringFields = new Set([
    'name',
    'screenName',
    'location',
    'description',
    'website',
    'profileBannerUrl',
    'profileImageUrlHttps',
    'lastTweetId'
  ])

  // Prepare arrays
  const idArray = `ARRAY['${ids.join("','")}']`
  const valueArrays = updateFields.map((field) => {
    const dbField = toSnakeCase(field)
    const isTimestampField = dbField.endsWith('_at') || dbField === 'tweets_fetched_since'

    const values = ids.map((id) => {
      const val = usersMap[id][field as keyof TweetUserForUpdate]
      if (val === null || val === undefined) {
        if (isTimestampField) {
          return 'NULL::timestamp'
        }
        // For string fields that have NOT NULL constraints, return empty string
        if (notNullStringFields.has(field)) {
          return "''"
        }
        return 'NULL'
      }
      if (typeof val === 'boolean') return val
      if (typeof val === 'number') return val
      if ((val as any) instanceof Date) {
        return `'${(val as any as Date).toISOString()}'::timestamp`
      }
      if (typeof val === 'string') {
        if (isTimestampField && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
          return `'${val}'::timestamp`
        }
        return `'${val.replace(/'/g, "''")}'`
      }
      return `'${String(val).replace(/'/g, "''")}'`
    })

    const arr = `ARRAY[${values.join(',')}]`
    return isTimestampField ? `${arr}::timestamp[]` : arr
  })

  const dbFields = updateFields.map(toSnakeCase)

  // Build and execute query
  const query = sql.raw(`
    UPDATE "twitter_users"
    SET (${dbFields.join(', ')}) = (
      SELECT ${dbFields.map((f) => `v.${f}`).join(', ')}
      FROM unnest(
        ${idArray}, 
        ${valueArrays.join(', ')}
      ) AS v(id, ${dbFields.join(', ')})
      WHERE "twitter_users".id = v.id
    )
    WHERE id = ANY(${idArray})
    RETURNING *
  `)

  const result = await withRawSqlError(query, tx)

  // Convert snake_case fields to camelCase
  return result.map((row: any) => {
    const converted: any = {}
    for (const [key, value] of Object.entries(row)) {
      converted[toCamelCase(key)] = value
    }
    return converted as TwitterUserFromDb
  })
}

export async function bulkSaveTwitterUsersProfileHistory(
  profileHistoryData: Array<{
    userId: string
    changes: Record<string, { old: any; new: any }>
    createdAt?: Date
  }>,
  tx?: PgTransaction<any, any, any>
): Promise<any[]> {
  if (profileHistoryData.length === 0) {
    return []
  }
  const dbInstance = tx || db()

  // Flatten the changes into individual records
  const recordsToInsert = profileHistoryData.flatMap((item) => {
    const { userId, changes, createdAt = new Date() } = item

    return Object.entries(changes).map(([key, value]) => {
      const isProtected = key === 'protectedAt'
      const fmt = (b: any) => (b ? 'true' : 'false')

      const normalizedKey = isProtected ? 'protected' : key
      const from = isProtected ? fmt(value.old) : String(value.old)
      const to = isProtected ? fmt(value.new) : String(value.new)

      const text = `Changed ${normalizedKey} from "${from}" to "${to}"`

      return {
        userId,
        key: normalizedKey,
        text,
        from,
        to,
        createdAt
      }
    })
  })

  if (recordsToInsert.length === 0) {
    return []
  }

  // Use Drizzle's insert API
  const result = await withDbError(
    dbInstance
      .insert(twitterUsersProfileHistory)
      .values(recordsToInsert)
      // .onConflictDoNothing({
      //   target: [
      //     twitterUsersProfileHistory.userId,
      //     twitterUsersProfileHistory.key,
      //     twitterUsersProfileHistory.createdAt
      //   ]
      // })
      .returning()
  )

  return result
}

export async function bulkSavePastUsernames(
  pastUsernamesData: Array<{
    userId: string
    screenName: string
    changedAt?: Date
  }>,
  tx?: PgTransaction<any, any, any>
): Promise<any[]> {
  if (pastUsernamesData.length === 0) {
    return []
  }
  const dbInstance = tx || db()

  // Use Drizzle's insert API
  const result = await withDbError(
    dbInstance
      .insert(pastUsernames)
      .values(pastUsernamesData)
      .onConflictDoNothing({
        target: [pastUsernames.userId, pastUsernames.screenName]
      })
      .returning()
  )

  return result
}

export async function bulkSaveUserCas(
  caRecords: Array<{
    userId: string
    ca: string
    tweetId: string
  }>,
  tx?: PgTransaction<any, any, any>
): Promise<any[]> {
  if (caRecords.length === 0) {
    return []
  }
  const dbInstance = tx || db()

  // Deduplicate by userId+ca combination
  const uniqueRecords = Array.from(
    new Map(caRecords.map((record) => [`${record.userId}:${record.ca}`, record])).values()
  )

  // Use Drizzle's insert API
  const result = await withDbError(
    dbInstance
      .insert(userCa)
      .values(uniqueRecords)
      .onConflictDoUpdate({
        target: [userCa.userId, userCa.ca],
        set: { tweetId: sql`EXCLUDED.tweet_id` }
      })
      .returning()
  )

  return result
}

type TweetLookupResult = {
  id: string
  inReplyToStatusIdStr: string | null
  conversationId: string | null
}

type ConversationIdLookupResult = {
  conversationIdMap: Map<string, string | null>
  needsSecondLookup: Map<string, string> // parentTweetId -> parentTweet.inReplyToStatusIdStr
}

/**
 * Processes conversation ID lookup for a batch of tweets
 * @param tweetToParentMap Map of tweet ID -> parent tweet ID to look up
 * @param tx Optional transaction to use
 * @returns Object with conversationIdMap and map of parent tweets needing second lookup
 */
async function processConversationIdLookup(
  tweetToParentMap: Map<string, string>,
  tx?: PgTransaction<any, any, any>
): Promise<ConversationIdLookupResult> {
  const dbInstance = tx || db()
  const conversationIdMap = new Map<string, string | null>()
  const needsSecondLookup = new Map<string, string>()

  if (tweetToParentMap.size === 0) {
    return { conversationIdMap, needsSecondLookup }
  }

  // Get unique parent tweet IDs to look up
  const parentTweetIds = [...new Set(tweetToParentMap.values())]

  // Batch lookup: Get all parent tweets
  const parentTweets = await withDbError(
    dbInstance
      .select({
        id: tweets.id,
        inReplyToStatusIdStr: tweets.inReplyToStatusIdStr,
        conversationId: tweets.conversationId
      })
      .from(tweets)
      .where(inArray(tweets.id, parentTweetIds))
  )

  const parentTweetMap = new Map<string, TweetLookupResult>()
  parentTweets.forEach((tweet) => {
    parentTweetMap.set(tweet.id, tweet)
  })

  // Process each tweet needing lookup
  tweetToParentMap.forEach((parentTweetId, tweetId) => {
    const parentTweet = parentTweetMap.get(parentTweetId)

    if (!parentTweet) {
      // Parent not found
      conversationIdMap.set(tweetId, null)
    } else if (!parentTweet.inReplyToStatusIdStr) {
      // Parent is the root
      conversationIdMap.set(tweetId, parentTweet.id)
    } else if (parentTweet.conversationId) {
      // Parent has conversationId
      conversationIdMap.set(tweetId, parentTweet.conversationId)
    } else {
      // Need second lookup - store parent's parent relationship
      needsSecondLookup.set(parentTweet.id, parentTweet.inReplyToStatusIdStr)
      conversationIdMap.set(tweetId, null) // Placeholder
    }
  })

  return { conversationIdMap, needsSecondLookup }
}

/**
 * Creates conversation ID map for tweets that need it
 * @param tweetsToProcess Array of tweets to process
 * @param tx Optional transaction to use
 * @returns Map of tweetId -> conversationId
 */
export async function createConversationIdMap(
  tweetsToProcess: Array<NewTweet>,
  tx?: PgTransaction<any, any, any>
): Promise<Map<string, string | null>> {
  // Initialize map for all tweets that need conversation IDs
  const conversationIdMap = new Map<string, string | null>()

  // For tweets that are not replies and don't have conversationId, set it to their own ID
  // Also include retweets (retweetedStatusIdStr is not null) as they should have their own conversation ID
  const tweetsNeedingSelfId = tweetsToProcess.filter(
    (tweet) => (!tweet.inReplyToStatusIdStr && !tweet.conversationId) || tweet.retweetedStatusIdStr
  )
  tweetsNeedingSelfId.forEach((tweet) => {
    conversationIdMap.set(tweet.id, tweet.id)
  })

  // Find tweets that need conversation ID lookup (reply tweets, but not retweets)
  const tweetsNeedingConversationId = tweetsToProcess.filter(
    (tweet) => tweet.inReplyToStatusIdStr && !tweet.conversationId && !tweet.retweetedStatusIdStr
  )

  if (tweetsNeedingConversationId.length === 0) {
    return conversationIdMap
  }

  // Create initial tweet ID -> parent tweet ID map
  const firstLookupMap = new Map<string, string>()
  tweetsNeedingConversationId.forEach((tweet) => {
    firstLookupMap.set(tweet.id, tweet.inReplyToStatusIdStr!)
  })

  // First call: Look up direct parent tweets
  const { conversationIdMap: lookupResults, needsSecondLookup } = await processConversationIdLookup(
    firstLookupMap,
    tx
  )

  // Merge lookup results into our main map
  lookupResults.forEach((conversationId, tweetId) => {
    conversationIdMap.set(tweetId, conversationId)
  })

  // Second call: Look up grandparent tweets if needed
  if (needsSecondLookup.size > 0) {
    const { conversationIdMap: secondMap } = await processConversationIdLookup(
      needsSecondLookup,
      tx
    )

    // Merge results from second lookup - update tweets that still have null conversation IDs
    conversationIdMap.forEach((conversationId, tweetId) => {
      if (conversationId === null) {
        // Find the parent tweet ID for this tweet
        const parentTweetId = firstLookupMap.get(tweetId)
        if (parentTweetId) {
          // Get the conversation ID found for the parent tweet
          const parentConversationId = secondMap.get(parentTweetId)
          if (parentConversationId !== null && parentConversationId !== undefined) {
            conversationIdMap.set(tweetId, parentConversationId)
          }
        }
      }
    })
  }

  const foundCount = Array.from(conversationIdMap.values()).filter((id) => id !== null).length
  const totalTweetsProcessed = tweetsNeedingSelfId.length + tweetsNeedingConversationId.length
  if (totalTweetsProcessed > 0) {
    logger().info(
      `createConversationIdMap: Set conversation IDs for ${foundCount}/${totalTweetsProcessed} tweets (${tweetsNeedingSelfId.length} self-IDs, ${tweetsNeedingConversationId.length} reply lookups)`
    )
  }

  return conversationIdMap
}

export async function bulkSaveTweets(
  newTweets: Array<NewTweet>,
  isKol: boolean = false,
  tx?: PgTransaction<any, any, any>
): Promise<any[]> {
  if (newTweets.length === 0) {
    return []
  }

  // Deduplicate tweets by ID (later one overrides earlier one)
  const tweetMap = new Map<string, NewTweet>()
  for (const tweet of newTweets) {
    const existingTweet = tweetMap.get(tweet.id)
    if (existingTweet) {
      const error = new Error(
        'Duplicate tweet ID found in newTweets array, later one will override'
      )
      logger().error(
        {
          oldTweet: existingTweet,
          newTweet: tweet,
          stack: error.stack
        },
        'Duplicate tweet ID found in newTweets array, later one will override'
      )
    }
    tweetMap.set(tweet.id, tweet)
  }
  const deduplicatedTweets = Array.from(tweetMap.values())

  const BATCH_SIZE = 1000
  const results: any[] = []

  // Process tweets in batches
  for (let i = 0; i < deduplicatedTweets.length; i += BATCH_SIZE) {
    const batchTweets = deduplicatedTweets.slice(i, i + BATCH_SIZE)

    // Get conversation ID map for this batch
    const conversationIdMap = await createConversationIdMap(batchTweets, tx)

    const batch = batchTweets.map((tweet) => ({
      ...tweet,
      isKol: isKol || tweet.isKol, // Set isKol to true if parameter is true, otherwise preserve existing value
      conversationId: tweet.conversationId || conversationIdMap.get(tweet.id) || undefined
    }))

    // Use Drizzle's insert API with onConflictDoUpdate
    const batchResult = await withDbError(
      (tx || db())
        .insert(tweets)
        .values(batch)
        .onConflictDoUpdate({
          target: tweets.id,
          set: {
            inReplyToStatusIdStr: sql`EXCLUDED.in_reply_to_status_id_str`,
            inReplyToUserIdStr: sql`EXCLUDED.in_reply_to_user_id_str`,
            inReplyToUserScreenName: sql`EXCLUDED.in_reply_to_user_screen_name`,

            quotedStatusIdStr: sql`EXCLUDED.quoted_status_id_str`,
            quotedUserScreenName: sql`EXCLUDED.quoted_user_screen_name`,
            quotedUserIdStr: sql`EXCLUDED.quoted_user_id_str`,

            retweetedStatusIdStr: sql`EXCLUDED.retweeted_status_id_str`,
            retweetedUserIdStr: sql`EXCLUDED.retweeted_user_id_str`,
            retweetedUserScreenName: sql`EXCLUDED.retweeted_user_screen_name`,
            retweetedStatusCreatedAt: sql`EXCLUDED.retweeted_status_created_at`,

            favoriteCount: sql`EXCLUDED.favorite_count`,
            bookmarkCount: sql`EXCLUDED.bookmark_count`,
            viewCount: sql`EXCLUDED.view_count`,
            quoteCount: sql`EXCLUDED.quote_count`,
            replyCount: sql`EXCLUDED.reply_count`,
            retweetCount: sql`EXCLUDED.retweet_count`,

            fullText: sql`EXCLUDED.full_text`,
            notetweetEntities: sql`EXCLUDED.note_tweet_entities`,
            truncated: sql`EXCLUDED.truncated`,
            isKol: sql`EXCLUDED.is_kol`,
            conversationId: sql`CASE WHEN EXCLUDED.conversation_id IS NOT NULL THEN EXCLUDED.conversation_id ELSE ${tweets.conversationId} END`,

            updatedAt: sql`NOW()`
          }
        })
        .returning()
    )

    results.push(...batchResult)
  }

  return results
}

export async function bulkSaveTwitterUsers(
  users: Array<NewTwitterUser>,
  tx?: PgTransaction<any, any, any>
): Promise<any[]> {
  if (users.length === 0) {
    return []
  }

  // Deduplicate users by ID
  const uniqueUsers = Array.from(new Map(users.map((user) => [user.id, user])).values())

  // Use Drizzle's insert API with onConflictDoUpdate
  const result = await withDbError(
    (tx || db()).insert(twitterUsers).values(uniqueUsers).onConflictDoNothing().returning()
  )

  return result
}

export interface SimplifiedTweet {
  tweet_id: string
  user_id: string
  text: string
  favorite_count: number
  quote_count: number
  reply_count: number
  retweet_count: number
  bookmark_count: number
  view_count: number
  created_at: string
  user: {
    id_str: string
    name: string
    screen_name: string
    location: string
    description: string
    followers_count: number
    created_at: string
    verified: boolean
    is_kol: boolean | null
    kol_followers_count: number | null
    tags: string[]
  }
}

// Base function that handles the CA counting logic
async function getBaseCaCount(whereClause: SQL): Promise<number> {
  try {
    const result = await withRawSqlError(sql`
      SELECT COUNT(DISTINCT ca) as "caCount"
      FROM (
        SELECT unnest(contract_addresses) as ca
        FROM tweets
        JOIN twitter_users ON tweets.user_id = twitter_users.id
        WHERE ${whereClause}
        AND array_length(contract_addresses, 1) > 0
      ) as subquery
    `)

    return Number(result[0]?.caCount || 0)
  } catch (error) {
    logger().error(error, 'Error getting contract address count')
    throw error
  }
}

// Get CA count by user ID
export async function getUserCaCountById(userId: string): Promise<number> {
  return getBaseCaCount(eq(tweets.userId, userId))
}

// Get CA count by screen name
export async function getUserCaCountByScreenName(screenName: string): Promise<number> {
  return getBaseCaCount(eq(sql`LOWER(${twitterUsers.screenName})`, screenName.toLowerCase()))
}

export async function getTopTwitterUsers() {
  const topUsers = await withDbError(
    db()
      .select({
        id: twitterUsers.id,
        name: twitterUsers.name,
        screenName: twitterUsers.screenName,
        location: twitterUsers.location,
        description: twitterUsers.description,
        website: twitterUsers.website,
        followersCount: twitterUsers.followersCount,
        friendsCount: twitterUsers.friendsCount,
        createdAt: twitterUsers.createdAt,
        statusesCount: twitterUsers.statusesCount,
        profileBannerUrl: twitterUsers.profileBannerUrl,
        profileImageUrlHttps: twitterUsers.profileImageUrlHttps,
        isKol: twitterUsers.isKol,
        kolFollowersCount: twitterUsers.kolFollowersCount,
        tags: twitterUsers.tags
      })
      .from(twitterUsers)
      .where(isNull(twitterUsers.deletedAt))
      .orderBy(desc(twitterUsers.kolFollowersCount))
      .limit(50)
  )

  return topUsers
}

const KOL_FOLLOWER_INFLUENCE_INNER_POWER = 0.8
const KOL_FOLLOWER_INFLUENCE_OUTER_POWER = 0.65

interface UserInfluenceData {
  avgKolFollowerInfluence: number
  scaledKolFollowerInfluence: number
}

// Helper function to calculate KOL follower influence metrics
export async function calculateKolFollowerInfluence(userId: string): Promise<UserInfluenceData> {
  try {
    const kolFollowers = await withDbError(
      db()
        .select({
          kolFollowersCount: twitterUsers.kolFollowersCount
        })
        .from(followings)
        .innerJoin(twitterUsers, eq(followings.follower, twitterUsers.id))
        .where(
          and(
            eq(followings.followee, userId),
            isNull(followings.deletedAt),
            eq(twitterUsers.isKol, true)
          )
        )
    )

    let avgResult: number
    let scaledResult: number

    if (kolFollowers.length === 0) {
      avgResult = 0
      scaledResult = 0
    } else {
      // Calculate average
      const totalInfluence = kolFollowers.reduce(
        (sum, kol) => sum + (kol.kolFollowersCount || 0),
        0
      )
      avgResult = Math.round(totalInfluence / kolFollowers.length)

      // Calculate scaled: (sum(each kol's kolFollowersCount^INNER_POWER))^OUTER_POWER
      const sumOfPowered = kolFollowers.reduce(
        (sum, kol) =>
          sum + Math.pow(kol.kolFollowersCount || 0, KOL_FOLLOWER_INFLUENCE_INNER_POWER),
        0
      )
      scaledResult = Math.round(Math.pow(sumOfPowered, KOL_FOLLOWER_INFLUENCE_OUTER_POWER))
    }

    const result: UserInfluenceData = {
      avgKolFollowerInfluence: avgResult,
      scaledKolFollowerInfluence: scaledResult
    }

    return result
  } catch (error) {
    logger().error(`Error calculating KOL follower influence for user ${userId}:`, error)
    return { avgKolFollowerInfluence: -1, scaledKolFollowerInfluence: -1 }
  }
}

export async function getUsersByUsernamesAndIds(usernames: string[] = [], userIds: string[] = []) {
  const results = []

  const [usernameUsers, idUsers] = await Promise.all([
    usernames.length > 0 ? ensureTweetUsersByUsernames(usernames) : Promise.resolve([]),
    userIds.length > 0 ? ensureTweetUsersByUserIds(userIds) : Promise.resolve([])
  ])

  results.push(...usernameUsers, ...idUsers)

  // Remove duplicates based on user ID
  const uniqueUsers = Array.from(new Map(results.map((user) => [user.id, user])).values())

  // For each user, calculate the KOL follower influence metrics
  const usersWithInfluence = await Promise.all(
    uniqueUsers.map(async (user) => {
      const influence = await calculateKolFollowerInfluence(user.id)
      return {
        id: user.id,
        name: user.name,
        screenName: user.screenName,
        location: user.location,
        description: user.description,
        website: user.website,
        followersCount: user.followersCount,
        friendsCount: user.friendsCount,
        createdAt: user.createdAt,
        favouritesCount: user.favouritesCount,
        verified: user.verified,
        statusesCount: user.statusesCount,
        mediaCount: user.mediaCount,
        profileBannerUrl: user.profileBannerUrl,
        profileImageUrlHttps: user.profileImageUrlHttps,
        isKol: user.isKol,
        kolFollowersCount: user.kolFollowersCount,
        deletedAt: user.deletedAt,
        protectedAt: user.protectedAt,
        avgKolFollowerInfluence: influence.avgKolFollowerInfluence,
        scaledKolFollowerInfluence: influence.scaledKolFollowerInfluence
      }
    })
  )

  return usersWithInfluence
}

export async function getUserByUsername(username: string) {
  const user = await withDbError(
    db()
      .select({
        user: {
          id: twitterUsers.id,
          name: twitterUsers.name,
          screenName: twitterUsers.screenName,
          location: twitterUsers.location,
          description: twitterUsers.description,
          website: twitterUsers.website,
          followersCount: twitterUsers.followersCount,
          friendsCount: twitterUsers.friendsCount,
          createdAt: twitterUsers.createdAt,
          statusesCount: twitterUsers.statusesCount,
          profileBannerUrl: twitterUsers.profileBannerUrl,
          profileImageUrlHttps: twitterUsers.profileImageUrlHttps,
          isKol: twitterUsers.isKol,
          kolFollowersCount: twitterUsers.kolFollowersCount,
          tags: twitterUsers.tags
        },
        statusHistory: sql<any[]>`
      (
        SELECT json_agg(t) 
        FROM (
          SELECT 
            followers_count as "followersCount",
            friends_count as "friendsCount",
            statuses_count as "statusesCount",
            kol_followers_count as "kolFollowersCount",
            created_at as "createdAt"
          FROM twitter_users_status_history
          WHERE user_id = twitter_users.id
          ORDER BY created_at DESC
          LIMIT 14
        ) t
      )`,
        profileHistory: sql<any[]>`
      (
        SELECT json_agg(t)
        FROM (
          SELECT 
            key,
            "from",
            "to",
            created_at as "createdAt"
          FROM twitter_users_profile_history
          WHERE user_id = twitter_users.id
          ORDER BY created_at DESC
          LIMIT 5
        ) t
      )`,
        pastUsernames: sql<any[]>`
      (
        SELECT json_agg(t)
        FROM (
          SELECT 
            screen_name as "screenName",
            changed_at as "changedAt"
          FROM past_usernames
          WHERE user_id = twitter_users.id
          ORDER BY changed_at DESC
          LIMIT 3
        ) t
      )`,
        userCas: sql<any[]>`
      (
        SELECT json_agg(t)
        FROM (
          SELECT 
            ca,
            tweet_id as "tweetId",
            chain_ids as "chainIds",
            name,
            symbol
          FROM user_ca
          WHERE user_id = twitter_users.id
            AND is_token = true
          ORDER BY id DESC
          LIMIT 5
        ) t
      )`,
        followings: sql<any[]>`
      (
        SELECT json_agg(t)
        FROM (
          SELECT 
            tu.screen_name as "followeeScreenName",
            tu.name as "followeeName",
            tu.description as "followeeDescription",
            tu.profile_image_url_https as "followeeProfileImageUrl",
            tu.kol_followers_count as "kolFollowersCount",
            f.followee as "followeeId",
            f.followee_followers as "followeeFollowers",
            f.followee_key_followers as "followeeKeyFollowers",
            f.created_at as "createdAt"
          FROM followings f
          INNER JOIN twitter_users tu ON f.followee = tu.id
          WHERE f.follower = twitter_users.id
          ORDER BY f.follower_position DESC NULLS LAST
          LIMIT 20
        ) t
      )`,
        followers: sql<any[]>`
      (
        SELECT json_agg(t)
        FROM (
          SELECT 
            tu.screen_name as "followerScreenName",
            tu.name as "followerName",
            tu.description as "followerDescription",
            tu.profile_image_url_https as "followerProfileImageUrl",
            tu.kol_followers_count as "kolFollowersCount",
            f.follower as "followerId",
            f.followee_followers as "followeeFollowers",
            f.followee_key_followers as "followeeKeyFollowers",
            f.created_at as "createdAt"
          FROM followings f
          INNER JOIN twitter_users tu ON f.follower = tu.id
          WHERE f.followee = twitter_users.id
            AND tu.kol_followers_count > 0
          ORDER BY tu.kol_followers_count DESC NULLS LAST
          LIMIT 20
        ) t
      )`,
        followersCount: sql<number>`
      (
        SELECT COUNT(*)
        FROM followings f
        INNER JOIN twitter_users tu ON f.follower = tu.id
        WHERE f.followee = twitter_users.id
          AND tu.kol_followers_count > 0
      )`,
        statusHistoryCount: sql<number>`
        (SELECT COUNT(*)
        FROM twitter_users_status_history
        WHERE user_id = twitter_users.id)
      `,
        profileHistoryCount: sql<number>`
        (SELECT COUNT(*)
        FROM twitter_users_profile_history
        WHERE user_id = twitter_users.id)
      `,
        pastUsernamesCount: sql<number>`
        (SELECT COUNT(*)
        FROM past_usernames
        WHERE user_id = twitter_users.id)
      `,
        userCasCount: sql<number>`
        (SELECT COUNT(*)
        FROM user_ca
        WHERE user_id = twitter_users.id
        AND is_token = true)
      `
      })
      .from(twitterUsers)
      // we may need to add isNull(twitterUsers.deletedAt) here
      .where(eq(sql`lower(${twitterUsers.screenName})`, username.toLowerCase()))
      .limit(1)
  )
  if (!user || user.length === 0) {
    return null
  }

  // Return combined result
  return {
    ...user[0].user,
    statusHistory: user[0].statusHistory || [],
    profileHistory: user[0].profileHistory || [],
    pastUsernames: user[0].pastUsernames || [],
    userCas: user[0].userCas || [],
    followings: user[0].followings || [],
    followers: user[0].followers || [],
    counts: {
      statusHistory: Number(user[0].statusHistoryCount),
      profileHistory: Number(user[0].profileHistoryCount),
      pastUsernames: Number(user[0].pastUsernamesCount),
      userCas: Number(user[0].userCasCount),
      followers: Number(user[0].followersCount)
    }
  }
}

export async function fetchAndSyncTwitterUserDeletionsById(
  inputUserIds: string[] = [],
  deletedUserIds: string[] = []
) {
  // Sort IDs to ensure consistent lock ordering
  const userIds = [...new Set([...inputUserIds, ...deletedUserIds])].sort()

  // Return early if both arrays are empty
  if (userIds.length === 0) {
    return []
  }

  // Fetch all users at once
  // const fetchedUsers = await batchFetchUserLookup([], userIds)
  const fetchedUsers = await batchFetchUsersByIds(userIds)

  const fetchedUserIds = new Set(fetchedUsers.map((user) => user.id))

  // Mark as deleted: users in input but not fetched
  const toDeleteIds = userIds.filter((id) => !fetchedUserIds.has(id))

  // Restore: users in deletedUserIds but now fetched
  // Sort IDs to ensure consistent lock ordering
  const toRestoreIds = deletedUserIds.filter((id) => fetchedUserIds.has(id)).sort()

  // Mark as deleted (set deletedAt) - Process in batches of 2000
  const actuallyDeletedUsers: { id: string }[] = []
  if (toDeleteIds.length > 0) {
    const BATCH_SIZE = 2000
    const deleteChunks = chunk(toDeleteIds, BATCH_SIZE)

    for (const deleteChunk of deleteChunks) {
      const batchResult = await withDbError(
        db()
          .update(twitterUsers)
          .set({ deletedAt: new Date() })
          .where(
            and(
              inArray(twitterUsers.id, deleteChunk),
              isNull(twitterUsers.deletedAt) // Only update if deletedAt is currently null
            )
          )
          .returning({ id: twitterUsers.id })
      )
      actuallyDeletedUsers.push(...batchResult)
    }

    if (actuallyDeletedUsers.length > 0) {
      logger().info(
        `Marked ${actuallyDeletedUsers.length} users as deleted: ${actuallyDeletedUsers
          .map((user: { id: string }) => user.id)
          .join(', ')}`
      )
    }
  }

  // Restore users (set deletedAt to null) - Process in batches of 2000
  const actuallyRestoredUsers: { id: string }[] = []
  if (toRestoreIds.length > 0) {
    const BATCH_SIZE = 2000
    const restoreChunks = chunk(toRestoreIds, BATCH_SIZE)

    for (const restoreChunk of restoreChunks) {
      const batchResult = await withDbError(
        db()
          .update(twitterUsers)
          .set({ deletedAt: null })
          .where(
            and(
              inArray(twitterUsers.id, restoreChunk),
              isNotNull(twitterUsers.deletedAt) // Only update if deletedAt is currently NOT null
            )
          )
          .returning({ id: twitterUsers.id })
      )
      actuallyRestoredUsers.push(...batchResult)
    }

    if (actuallyRestoredUsers.length > 0) {
      logger().info(
        `Restored ${actuallyRestoredUsers.length} users: ${actuallyRestoredUsers
          .map((user: { id: string }) => user.id)
          .join(', ')}`
      )
    }
  }

  // Prepare history records only for users that were actually updated
  const now = new Date()
  const historyRecords = [
    ...actuallyDeletedUsers.map((user) => ({
      userId: user.id,
      key: 'deleted',
      text: 'Changed deleted from false to true',
      from: 'false',
      to: 'true',
      createdAt: now
    })),
    ...actuallyRestoredUsers.map((user) => ({
      userId: user.id,
      key: 'deleted',
      text: 'Changed deleted from true to false',
      from: 'true',
      to: 'false',
      createdAt: now
    }))
  ]

  // Insert history records in batches of 2000
  if (historyRecords.length > 0) {
    const BATCH_SIZE = 2000
    const historyChunks = chunk(historyRecords, BATCH_SIZE)

    for (const historyChunk of historyChunks) {
      await withDbError(db().insert(twitterUsersProfileHistory).values(historyChunk))
    }

    logger().info(`Recorded ${historyRecords.length} deletion status changes in history`)
  }

  return fetchedUsers
}

export async function fetchAndSyncTwitterUserDeletionsByUsername(
  inputUsernames: string[] = [],
  deletedUsernames: string[] = []
) {
  const usernames = [...new Set(inputUsernames.map((u) => u.toLowerCase()))]
  const deletedUsernamesLower = deletedUsernames.map((u) => u.toLowerCase())

  // Return early if empty
  if (usernames.length === 0) {
    return []
  }

  // Fetch all users at once
  // const fetchedUsers = await batchFetchUserLookup(usernames, [])
  const fetchedUsers = await batchFetchUsersByUsernames283(usernames)
  const fetchedUsernames = new Set(fetchedUsers.map((user) => user.screenName.toLowerCase()))

  // Mark as deleted: usernames in input but not fetched
  const toDeleteUsernames = usernames.filter((u) => !fetchedUsernames.has(u))

  // Restore: usernames in deletedUsernames but now fetched
  const toRestoreUsernames = deletedUsernamesLower.filter((u) => fetchedUsernames.has(u))

  // Mark as deleted (set deletedAt)
  if (toDeleteUsernames.length > 0) {
    const deletedUsers = await withDbError(
      db()
        .update(twitterUsers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            inArray(sql`LOWER(${twitterUsers.screenName})`, toDeleteUsernames),
            isNull(twitterUsers.deletedAt) // Only update if deletedAt is currently null
          )
        )
        .returning({ screenName: twitterUsers.screenName })
    )
    if (deletedUsers.length > 0) {
      logger().info(
        `Marked ${deletedUsers.length} users as deleted: ${deletedUsers.map((u) => u.screenName).join(', ')}`
      )
    }
  }

  // Restore users (set deletedAt to null)
  if (toRestoreUsernames.length > 0) {
    const restoredUsers = await withDbError(
      db()
        .update(twitterUsers)
        .set({ deletedAt: null })
        .where(
          and(
            inArray(
              sql`LOWER(${twitterUsers.screenName})`,
              toRestoreUsernames.map((u) => u.toLowerCase())
            ),
            isNotNull(twitterUsers.deletedAt) // Only update if deletedAt is currently NOT null
          )
        )
        .returning({ screenName: twitterUsers.screenName })
    )

    if (restoredUsers.length > 0) {
      logger().info(
        `Restored ${restoredUsers.length} users: ${restoredUsers.map((u) => u.screenName).join(', ')}`
      )
    }
  }

  return fetchedUsers
}

export async function ensureTweetUsersByUsernames(usernames: string[]) {
  if (usernames.length === 0) {
    return []
  }

  try {
    const lowerUsernames = usernames.map((u) => u.toLowerCase())

    // Get all users with these usernames (case-insensitive)
    const allUsers = await withDbError(
      db('primary')
        .select()
        .from(twitterUsers)
        .where(inArray(sql`LOWER(${twitterUsers.screenName})`, lowerUsernames))
    )

    // Split into deleted and not deleted
    const existingUsers = allUsers.filter((user) => !user.deletedAt && Boolean(user.name))

    const existingUsernames = new Set(existingUsers.map((user) => user.screenName.toLowerCase()))
    const deletedUsernames = allUsers
      .filter((user) => user.deletedAt)
      .map((user) => user.screenName)
    const missingUsernames = lowerUsernames.filter((username) => !existingUsernames.has(username))

    if (missingUsernames.length > 0) {
      const fetchedUsers = await fetchAndSyncTwitterUserDeletionsByUsername(
        missingUsernames,
        deletedUsernames
      )

      const users = await upsertTwitterUsers(fetchedUsers)

      return [...existingUsers, ...users]
    }

    return [...existingUsers]
  } catch (error) {
    logger().error(error, `Failed to ensure tweet users by usernames: ${usernames.join(', ')}`)
    throw error
  }
}

export type TweetUsersWithApiFallback = {
  id: string
  name: string
  screenName: string
  description: string
  followersCount: number

  location: string
  friendsCount: number
  createdAt: Date
  favouritesCount: number
  verified: boolean
  statusesCount: number
  profileImageUrlHttps: string
  profileBannerUrl: string
  lastTweetId: string
  updatedAt: Date
  website: string
  deletedAt: Date | null
  protectedAt: Date | null
}

export async function getTweetUsersWithApiFallback(
  userIds: string[]
): Promise<TweetUsersWithApiFallback[]> {
  if (userIds.length === 0) {
    return []
  }

  try {
    // Split userIds into batches of 2000
    const BATCH_SIZE = 2000
    const batches = []
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      batches.push(userIds.slice(i, i + BATCH_SIZE))
    }

    // Execute all batch queries in parallel
    const batchResults = await Promise.all(
      batches.map((batch) =>
        withDbError(
          db('primary').select().from(twitterUsers).where(inArray(twitterUsers.id, batch))
        )
      )
    )

    // Flatten all results
    const allUsers = batchResults.flat() as TweetUsersWithApiFallback[]

    // Split into deleted and not deleted
    const existingUsers = allUsers.filter((user) => !user.deletedAt && Boolean(user.name))
    const existingUserIds = new Set(existingUsers.map((user) => user.id))
    const missingUserIds = userIds.filter((userId) => !existingUserIds.has(userId))

    if (missingUserIds.length > 0) {
      // const fetchedUsers = await batchFetchUserLookup([], missingUserIds)
      const fetchedUsers = await batchFetchUsersByIds(missingUserIds)

      // Remove status field from fetched users
      const cleanedFetchedUsers: TweetUsersWithApiFallback[] = fetchedUsers.map(
        ({ status: _status, ...user }) => user
      )

      return [...allUsers, ...cleanedFetchedUsers]
    }

    // Return both existing (not deleted) users and fetched users
    return [...allUsers]
  } catch (error) {
    logger().error(error, `Failed to get tweet users with api fallback: ${userIds.join(', ')}`)
    throw error
  }
}

export async function ensureTweetUsersByUserIds(userIds: string[]) {
  if (userIds.length === 0) {
    return []
  }

  try {
    // Get all users with these IDs
    const allUsers = await withDbError(
      db('primary').select().from(twitterUsers).where(inArray(twitterUsers.id, userIds))
    )

    // Split into deleted and not deleted
    const existingUsers = allUsers.filter((user) => !user.deletedAt && Boolean(user.name))
    const existingUserIds = new Set(existingUsers.map((user) => user.id))
    const deletedUserIds = allUsers.filter((user) => user.deletedAt).map((user) => user.id)
    const deletedUserIdsSet = new Set(deletedUserIds)

    // missing user ids include missing user ids and user without name (but exclude deleted users)
    const missingUserIds = userIds.filter(
      (userId) => !existingUserIds.has(userId) && !deletedUserIdsSet.has(userId)
    )

    if (missingUserIds.length > 0 || deletedUserIds.length > 0) {
      const fetchedUsers = await fetchAndSyncTwitterUserDeletionsById(
        missingUserIds,
        deletedUserIds
      )

      const fetchedMissingUsers = fetchedUsers.filter((user) => !existingUserIds.has(user.id))
      const fetchedDeletedUsers = fetchedUsers.filter((user) => deletedUserIds.includes(user.id))

      const users = await upsertTwitterUsers(fetchedMissingUsers)

      if (deletedUserIds.length > 0) {
        logger().info(
          `${fetchedDeletedUsers.length} users were restored with IDs: ${fetchedDeletedUsers.map((u) => u.id).join(', ')}, from deleted user IDs: ${deletedUserIds.join(', ')}`
        )
      }

      if (missingUserIds.length > 0) {
        logger().info(
          `${fetchedMissingUsers.length} users were added with IDs: ${fetchedMissingUsers.map((u) => u.id).join(', ')}, from missing user IDs: ${missingUserIds.join(', ')}`
        )
      }

      return [...existingUsers, ...users]
    }

    // Return both existing (not deleted) users and fetched users
    return [...existingUsers]
  } catch (error) {
    logger().error(error, `Failed to ensure tweet users by user IDs: ${userIds.join(', ')}`)
    throw error
  }
}

export async function getRecentFollowings(afterTime?: Date, cursor?: number, limit: number = 50) {
  const followingRecords = await withDbError(
    db()
      .select({
        following: {
          id: followings.id,
          createdAt: followings.createdAt
        },
        follower: {
          id: sql<string>`f_user.id`,
          name: sql<string>`f_user.name`,
          screenName: sql<string>`f_user.screen_name`,
          location: sql<string>`f_user.location`,
          description: sql<string>`f_user.description`,
          website: sql<string>`f_user.website`,
          followersCount: sql<number>`f_user.followers_count`,
          friendsCount: sql<number>`f_user.friends_count`,
          createdAt: sql<string>`f_user.created_at`,
          statusesCount: sql<number>`f_user.statuses_count`,
          profileBannerUrl: sql<string>`f_user.profile_banner_url`,
          profileImageUrlHttps: sql<string>`f_user.profile_image_url_https`,
          isKol: sql<boolean>`f_user.is_kol`,
          kolFollowersCount: sql<number>`f_user.kol_followers_count`,
          tags: sql<string[]>`f_user.tags`
        },
        followee: {
          id: sql<string>`e_user.id`,
          name: sql<string>`e_user.name`,
          screenName: sql<string>`e_user.screen_name`,
          location: sql<string>`e_user.location`,
          description: sql<string>`e_user.description`,
          website: sql<string>`e_user.website`,
          followersCount: sql<number>`e_user.followers_count`,
          friendsCount: sql<number>`e_user.friends_count`,
          createdAt: sql<string>`e_user.created_at`,
          statusesCount: sql<number>`e_user.statuses_count`,
          profileBannerUrl: sql<string>`e_user.profile_banner_url`,
          profileImageUrlHttps: sql<string>`e_user.profile_image_url_https`,
          isKol: sql<boolean>`e_user.is_kol`,
          kolFollowersCount: sql<number>`e_user.kol_followers_count`,
          tags: sql<string[]>`e_user.tags`,
          followingCounts: sql<{ day1: number; day7: number; day15: number; day30: number }>`
          json_build_object(
            'day1', (
              SELECT COUNT(*)::int 
              FROM followings f2 
              WHERE f2.followee = e_user.id 
              AND f2.created_at >= NOW() - INTERVAL '1 day' 
              AND f2.deleted_at IS NULL
            ),
            'day7', (
              SELECT COUNT(*)::int 
              FROM followings f2 
              WHERE f2.followee = e_user.id 
              AND f2.created_at >= NOW() - INTERVAL '7 days' 
              AND f2.deleted_at IS NULL
            ),
            'day30', (
              SELECT COUNT(*)::int 
              FROM followings f2 
              WHERE f2.followee = e_user.id 
              AND f2.created_at >= NOW() - INTERVAL '30 days' 
              AND f2.deleted_at IS NULL
            )
          )
        `,
          isRecentlyRestored: sql<boolean>`EXISTS (
          SELECT 1 
          FROM ${twitterUsersProfileHistory} ph 
          WHERE ph.user_id = e_user.id 
          AND ph.key = 'deleted' 
          AND ph.to = 'false'
          AND ph.created_at >= NOW() - INTERVAL '30 days'
        )`
        }
      })
      .from(followings)
      .innerJoin(sql`${twitterUsers} as f_user`, eq(followings.follower, sql`f_user.id`))
      .innerJoin(sql`${twitterUsers} as e_user`, eq(followings.followee, sql`e_user.id`))
      .where(
        and(
          isNull(followings.deletedAt),
          isNotNull(followings.createdAt),
          afterTime ? gt(followings.createdAt, afterTime) : undefined,
          cursor ? gt(followings.id, cursor) : undefined
        )
      )
      .orderBy(desc(followings.createdAt), desc(followings.id))
      .limit(limit + 1)
  )

  const hasNextPage = followingRecords.length > limit
  const records = hasNextPage ? followingRecords.slice(0, -1) : followingRecords
  const nextCursor = hasNextPage ? followingRecords[limit - 1].following.id : null

  return {
    records,
    pageInfo: {
      hasNextPage,
      nextCursor
    }
  }
}

type TimePeriod = 'day1' | 'day7' | 'day30'

export async function getTopFolloweesByPeriod(
  period: TimePeriod = 'day1',
  page: number = 1,
  limit: number = 50,
  beforeTime?: Date
) {
  const timePoint = beforeTime || sql`NOW()`
  const offset = (page - 1) * limit

  // Calculate the start time based on period
  const periodStart = sql`${timePoint} - INTERVAL ${sql.raw(
    `'${period === 'day1' ? '1 day' : period === 'day7' ? '7 days' : '30 days'}'`
  )}`

  const followees = await withDbError(
    db()
      .select({
        followee: {
          id: sql<string>`e_user.id`,
          name: sql<string>`e_user.name`,
          screenName: sql<string>`e_user.screen_name`,
          location: sql<string>`e_user.location`,
          description: sql<string>`e_user.description`,
          website: sql<string>`e_user.website`,
          followersCount: sql<number>`e_user.followers_count`,
          friendsCount: sql<number>`e_user.friends_count`,
          createdAt: sql<string>`e_user.created_at`,
          statusesCount: sql<number>`e_user.statuses_count`,
          profileBannerUrl: sql<string>`e_user.profile_banner_url`,
          profileImageUrlHttps: sql<string>`e_user.profile_image_url_https`,
          isKol: sql<boolean>`e_user.is_kol`,
          kolFollowersCount: sql<number>`e_user.kol_followers_count`,
          tags: sql<string[]>`e_user.tags`,
          followingCounts: sql<{ day1: number; day7: number; day15: number; day30: number }>`
          json_build_object(
            'day1', (
              SELECT COUNT(*)::int 
              FROM followings f2 
              WHERE f2.followee = e_user.id 
              AND f2.created_at >= ${timePoint} - INTERVAL '1 day'
              AND f2.deleted_at IS NULL
            ),
            'day7', (
              SELECT COUNT(*)::int 
              FROM followings f2 
              WHERE f2.followee = e_user.id 
              AND f2.created_at >= ${timePoint} - INTERVAL '7 days'
              AND f2.deleted_at IS NULL
            ),
            'day30', (
              SELECT COUNT(*)::int 
              FROM followings f2 
              WHERE f2.followee = e_user.id 
              AND f2.created_at >= ${timePoint} - INTERVAL '30 days'
              AND f2.deleted_at IS NULL
            )
          )
        `,
          periodCount: sql<number>`top_followees.period_count`,
          isRecentlyRestored: sql<boolean>`EXISTS (
          SELECT 1 
          FROM ${twitterUsersProfileHistory} ph 
          WHERE ph.user_id = e_user.id 
          AND ph.key = 'deleted' 
          AND ph.to = 'false'
          AND ph.created_at >= ${timePoint} - INTERVAL '30 days'
        )`
        }
      })
      .from(
        sql`(
        SELECT 
          followings.followee,
          COUNT(*)::int as period_count
        FROM followings
        WHERE followings.deleted_at IS NULL 
          AND followings.created_at >= ${periodStart}
          AND followings.created_at <= ${timePoint}
        GROUP BY followings.followee
        ORDER BY COUNT(*) DESC, followee ASC
        LIMIT ${limit}
        OFFSET ${offset}
      ) top_followees`
      )
      .innerJoin(sql`${twitterUsers} as e_user`, eq(sql`top_followees.followee`, sql`e_user.id`))
      .orderBy(desc(sql`top_followees.period_count`), asc(sql`e_user.id`))
  )
  // Get total count for pagination info
  const countResult = await withDbError(
    db()
      .select({
        count: sql<number>`COUNT(DISTINCT followee)`
      })
      .from(followings)
      .where(
        and(
          isNull(followings.deletedAt),
          gt(followings.createdAt, periodStart),
          lte(followings.createdAt, timePoint)
        )
      )
  )
  const totalCount = countResult[0]?.count || 0

  return {
    records: followees,
    pageInfo: {
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
      hasNextPage: offset + limit < totalCount
    }
  }
}

export async function getTweets(
  afterDate?: Date,
  beforeDate?: Date,
  limit: number = 10,
  contractAddress?: string,
  onlyKol?: boolean
) {
  const tweetRecords = await withDbError(
    db()
      .select({
        tweet: {
          processedText: tweets.processedText,
          text: tweets.text,
          contractAddresses: tweets.contractAddresses,
          createdAt: tweets.createdAt
        },
        user: {
          name: twitterUsers.name,
          screenName: twitterUsers.screenName,
          location: twitterUsers.location,
          description: twitterUsers.description,
          website: twitterUsers.website,
          followersCount: twitterUsers.followersCount,
          friendsCount: twitterUsers.friendsCount,
          kolFollowersCount: twitterUsers.kolFollowersCount,
          tags: twitterUsers.tags
        },
        token: {
          ca: userCa.ca,
          chainIds: userCa.chainIds,
          name: userCa.name,
          symbol: userCa.symbol
        }
      })
      .from(tweets)
      .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
      .innerJoin(userCa, eq(tweets.id, userCa.tweetId))
      .where(
        and(
          onlyKol ? eq(twitterUsers.isKol, true) : undefined,
          eq(userCa.isToken, true),
          afterDate ? gt(tweets.createdAt, new Date(afterDate)) : undefined,
          beforeDate ? lt(tweets.createdAt, new Date(beforeDate)) : undefined,
          contractAddress ? eq(userCa.ca, contractAddress) : undefined
        )
      )
      .orderBy(desc(tweets.createdAt))
      .limit(limit)
  )

  const result = tweetRecords
    .map((record) => ({
      text: record.tweet.processedText || record.tweet.text,
      contractAddresses: record.tweet.contractAddresses,
      createdAt: record.tweet.createdAt,
      user: record.user,
      token: record.token
    }))
    .filter((record) => {
      const text = record.text.toLowerCase()
      const wordsToFilter = [
        'gmgn',
        'axiom',
        'smart',
        'kol',
        'fdv',
        '交易',
        'flip',
        'holder',
        'volume'
      ]
      return !wordsToFilter.some((word) => text.includes(word.toLowerCase()))
    })

  // Always return in ascending order
  return afterDate ? result : result.reverse()
}

export async function getUserTweetTimestamps(
  userId: string,
  createdAfter?: Date,
  createdBefore?: Date,
  limit: number = 50
) {
  const tweetRecords = await withDbError(
    db()
      .select({
        id: tweets.id,
        createdAt: tweets.createdAt
      })
      .from(tweets)
      .where(
        and(
          eq(tweets.userId, userId),
          createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
          createdBefore ? lt(tweets.createdAt, createdBefore) : undefined
        )
      )
      .orderBy(desc(tweets.createdAt))
      .limit(limit)
  )

  return tweetRecords
}

export async function getUserTweetHourlyDistribution(
  userId: string,
  createdAfter?: Date,
  createdBefore?: Date
) {
  // Query to get hourly distribution using SQL EXTRACT function
  const hourlyData = await withDbError(
    db()
      .select({
        hour: sql<number>`EXTRACT(HOUR FROM ${tweets.createdAt})::integer`,
        count: sql<number>`COUNT(*)::integer`
      })
      .from(tweets)
      .where(
        and(
          eq(tweets.userId, userId),
          createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
          createdBefore ? lt(tweets.createdAt, createdBefore) : undefined
        )
      )
      .groupBy(sql`EXTRACT(HOUR FROM ${tweets.createdAt})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${tweets.createdAt})`)
  )

  // Calculate total tweets
  const totalTweets = hourlyData.reduce((sum, item) => sum + item.count, 0)

  // Create a map for quick lookup
  const hourlyMap = new Map(hourlyData.map((item) => [item.hour, item.count]))

  // Build complete 24-hour distribution with percentages
  const distribution = Array.from({ length: 24 }, (_, hour) => {
    const count = hourlyMap.get(hour) || 0
    const percentage = totalTweets > 0 ? (count / totalTweets) * 100 : 0
    // Format hour as UTC time string (e.g., "00:00 UTC", "01:00 UTC", "23:00 UTC")
    const hourStartUtc = `${hour.toString().padStart(2, '0')}:00 UTC`
    return {
      hourStartUtc,
      count,
      percentage: Math.round(percentage * 100) / 100 // Round to 2 decimal places
    }
  })

  return {
    totalTweets,
    distribution
  }
}

export async function getUserTopInteractedWith(
  userId: string,
  createdAfter?: Date,
  createdBefore?: Date,
  limit: number = 20,
  offset: number = 0
) {
  // Get all tweets by the user and collect interaction targets (limit to latest 100k)
  const userTweets = await withDbError(
    db()
      .select({
        inReplyToUserIdStr: tweets.inReplyToUserIdStr,
        quotedUserIdStr: tweets.quotedUserIdStr,
        retweetedUserIdStr: tweets.retweetedUserIdStr
      })
      .from(tweets)
      .where(
        and(
          eq(tweets.userId, userId),
          createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
          createdBefore ? lt(tweets.createdAt, createdBefore) : undefined
        )
      )
      .orderBy(desc(tweets.createdAt))
      .limit(100000)
  )

  // Count interactions per user
  const interactionCounts = new Map<string, { replies: number; quotes: number; retweets: number }>()

  for (const tweet of userTweets) {
    if (tweet.inReplyToUserIdStr) {
      const existing = interactionCounts.get(tweet.inReplyToUserIdStr) || {
        replies: 0,
        quotes: 0,
        retweets: 0
      }
      existing.replies++
      interactionCounts.set(tweet.inReplyToUserIdStr, existing)
    }
    if (tweet.quotedUserIdStr) {
      const existing = interactionCounts.get(tweet.quotedUserIdStr) || {
        replies: 0,
        quotes: 0,
        retweets: 0
      }
      existing.quotes++
      interactionCounts.set(tweet.quotedUserIdStr, existing)
    }
    if (tweet.retweetedUserIdStr) {
      const existing = interactionCounts.get(tweet.retweetedUserIdStr) || {
        replies: 0,
        quotes: 0,
        retweets: 0
      }
      existing.retweets++
      interactionCounts.set(tweet.retweetedUserIdStr, existing)
    }
  }

  // Calculate totals and sort
  const interactions = Array.from(interactionCounts.entries()).map(([targetUserId, counts]) => ({
    targetUserId,
    replies: counts.replies,
    quotes: counts.quotes,
    retweets: counts.retweets,
    total: counts.replies + counts.quotes + counts.retweets
  }))

  interactions.sort((a, b) => b.total - a.total)

  const totalInteractions = interactions.reduce((sum, item) => sum + item.total, 0)
  const totalUsers = interactions.length

  // Get user details for paginated interactions
  const topInteractions = interactions.slice(offset, offset + limit)
  const targetUserIds = topInteractions.map((i) => i.targetUserId)

  const targetUsers =
    targetUserIds.length > 0
      ? await withDbError(
          db()
            .select({
              id: twitterUsers.id,
              name: twitterUsers.name,
              screenName: twitterUsers.screenName,
              followersCount: twitterUsers.followersCount,
              isKol: twitterUsers.isKol,
              kolFollowersCount: twitterUsers.kolFollowersCount
            })
            .from(twitterUsers)
            .where(inArray(twitterUsers.id, targetUserIds))
        )
      : []

  const userMap = new Map(targetUsers.map((u) => [u.id, u]))

  return {
    totalInteractions,
    totalUsers,
    interactions: topInteractions.map((interaction) => ({
      user: userMap.get(interaction.targetUserId) || null,
      replies: interaction.replies,
      quotes: interaction.quotes,
      retweets: interaction.retweets,
      total: interaction.total,
      percentage:
        totalInteractions > 0
          ? Math.round((interaction.total / totalInteractions) * 10000) / 100
          : 0
    }))
  }
}

export async function getUserTopInteractedBy(
  userId: string,
  createdAfter?: Date,
  createdBefore?: Date,
  limit: number = 20,
  offset: number = 0
) {
  // Use UNION ALL approach for better index usage instead of OR
  // Fetch all 3 interaction types in parallel using Promise.all
  const limitPerType = Math.ceil(30000 / 3) // Distribute limit across 3 query types

  const [replies, quotes, retweets] = await Promise.all([
    // Get replies
    withDbError(
      db()
        .select({
          userId: tweets.userId,
          inReplyToUserIdStr: tweets.inReplyToUserIdStr,
          quotedUserIdStr: tweets.quotedUserIdStr,
          retweetedUserIdStr: tweets.retweetedUserIdStr,
          createdAt: tweets.createdAt
        })
        .from(tweets)
        .where(
          and(
            eq(tweets.inReplyToUserIdStr, userId),
            createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
            createdBefore ? lt(tweets.createdAt, createdBefore) : undefined
          )
        )
        .orderBy(desc(tweets.createdAt))
        .limit(limitPerType)
    ),

    // Get quotes
    withDbError(
      db()
        .select({
          userId: tweets.userId,
          inReplyToUserIdStr: tweets.inReplyToUserIdStr,
          quotedUserIdStr: tweets.quotedUserIdStr,
          retweetedUserIdStr: tweets.retweetedUserIdStr,
          createdAt: tweets.createdAt
        })
        .from(tweets)
        .where(
          and(
            eq(tweets.quotedUserIdStr, userId),
            createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
            createdBefore ? lt(tweets.createdAt, createdBefore) : undefined
          )
        )
        .orderBy(desc(tweets.createdAt))
        .limit(limitPerType)
    ),

    // Get retweets
    withDbError(
      db()
        .select({
          userId: tweets.userId,
          inReplyToUserIdStr: tweets.inReplyToUserIdStr,
          quotedUserIdStr: tweets.quotedUserIdStr,
          retweetedUserIdStr: tweets.retweetedUserIdStr,
          createdAt: tweets.createdAt
        })
        .from(tweets)
        .where(
          and(
            eq(tweets.retweetedUserIdStr, userId),
            createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
            createdBefore ? lt(tweets.createdAt, createdBefore) : undefined
          )
        )
        .orderBy(desc(tweets.createdAt))
        .limit(limitPerType)
    )
  ])

  // Combine all results
  const mentioningTweets = [...replies, ...quotes, ...retweets]

  // Calculate hourly interval interaction sums
  const hourlyInteractions = new Map<
    string,
    { replies: number; quotes: number; retweets: number }
  >()

  for (const tweet of mentioningTweets) {
    if (!tweet.createdAt) continue

    // Round down to the nearest hour
    const hourTimestamp = new Date(tweet.createdAt)
    hourTimestamp.setMinutes(0, 0, 0)
    const hourKey = hourTimestamp.toISOString()

    const existing = hourlyInteractions.get(hourKey) || { replies: 0, quotes: 0, retweets: 0 }

    if (tweet.inReplyToUserIdStr === userId) {
      existing.replies++
    }
    if (tweet.quotedUserIdStr === userId) {
      existing.quotes++
    }
    if (tweet.retweetedUserIdStr === userId) {
      existing.retweets++
    }

    hourlyInteractions.set(hourKey, existing)
  }

  // Count interactions per user
  const interactionCounts = new Map<string, { replies: number; quotes: number; retweets: number }>()

  for (const tweet of mentioningTweets) {
    const sourceUserId = tweet.userId
    const existing = interactionCounts.get(sourceUserId) || { replies: 0, quotes: 0, retweets: 0 }

    if (tweet.inReplyToUserIdStr === userId) {
      existing.replies++
    }
    if (tweet.quotedUserIdStr === userId) {
      existing.quotes++
    }
    if (tweet.retweetedUserIdStr === userId) {
      existing.retweets++
    }

    interactionCounts.set(sourceUserId, existing)
  }

  // Calculate totals and sort
  const interactions = Array.from(interactionCounts.entries()).map(([sourceUserId, counts]) => ({
    sourceUserId,
    replies: counts.replies,
    quotes: counts.quotes,
    retweets: counts.retweets,
    total: counts.replies + counts.quotes + counts.retweets
  }))

  interactions.sort((a, b) => b.total - a.total)

  const totalInteractions = interactions.reduce((sum, item) => sum + item.total, 0)
  const totalUsers = interactions.length

  // Get user details for paginated interactions
  const topInteractions = interactions.slice(offset, offset + limit)
  const sourceUserIds = topInteractions.map((i) => i.sourceUserId)

  const sourceUsers =
    sourceUserIds.length > 0
      ? await withDbError(
          db()
            .select({
              id: twitterUsers.id,
              name: twitterUsers.name,
              screenName: twitterUsers.screenName,
              followersCount: twitterUsers.followersCount,
              isKol: twitterUsers.isKol,
              kolFollowersCount: twitterUsers.kolFollowersCount
            })
            .from(twitterUsers)
            .where(inArray(twitterUsers.id, sourceUserIds))
        )
      : []

  const userMap = new Map(sourceUsers.map((u) => [u.id, u]))

  // Format hourly interactions as sorted array
  const hourlyInteractionsArray = Array.from(hourlyInteractions.entries())
    .map(([timestamp, counts]) => ({
      timestamp,
      replies: counts.replies,
      quotes: counts.quotes,
      retweets: counts.retweets,
      total: counts.replies + counts.quotes + counts.retweets
    }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  return {
    totalInteractions,
    totalUsers,
    interactions: topInteractions.map((interaction) => ({
      user: userMap.get(interaction.sourceUserId) || null,
      replies: interaction.replies,
      quotes: interaction.quotes,
      retweets: interaction.retweets,
      total: interaction.total,
      percentage:
        totalInteractions > 0
          ? Math.round((interaction.total / totalInteractions) * 10000) / 100
          : 0
    })),
    hourlyInteractions: hourlyInteractionsArray
  }
}

export async function getTweetsReferencingUser(
  userId: string,
  createdAfter?: Date,
  createdBefore?: Date,
  minKolFollowers: number = 0,
  limit: number = 50
) {
  const tweetRecords = await withDbError(
    db()
      .select({
        tweet: {
          id: tweets.id,
          text: tweets.text,
          fullText: tweets.fullText,
          entities: tweets.entities,
          medias: tweets.medias,
          favoriteCount: tweets.favoriteCount,
          bookmarkCount: tweets.bookmarkCount,
          viewCount: tweets.viewCount,
          quoteCount: tweets.quoteCount,
          replyCount: tweets.replyCount,
          retweetCount: tweets.retweetCount,
          createdAt: tweets.createdAt,
          inReplyToStatusIdStr: tweets.inReplyToStatusIdStr,
          inReplyToUserIdStr: tweets.inReplyToUserIdStr,
          quotedStatusIdStr: tweets.quotedStatusIdStr,
          quotedUserIdStr: tweets.quotedUserIdStr,
          retweetedStatusIdStr: tweets.retweetedStatusIdStr,
          retweetedUserIdStr: tweets.retweetedUserIdStr
        },
        user: {
          id: twitterUsers.id,
          name: twitterUsers.name,
          screenName: twitterUsers.screenName,
          location: twitterUsers.location,
          description: twitterUsers.description,
          website: twitterUsers.website,
          followersCount: twitterUsers.followersCount,
          friendsCount: twitterUsers.friendsCount,
          kolFollowersCount: twitterUsers.kolFollowersCount,
          isKol: twitterUsers.isKol,
          tags: twitterUsers.tags
        }
      })
      .from(tweets)
      .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
      .where(
        and(
          or(
            and(eq(tweets.inReplyToUserIdStr, userId), isNull(tweets.retweetedStatusIdStr)),
            and(eq(tweets.quotedUserIdStr, userId), isNull(tweets.retweetedStatusIdStr)),
            eq(tweets.retweetedUserIdStr, userId)
          ),
          createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
          createdBefore ? lt(tweets.createdAt, createdBefore) : undefined,
          minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
        )
      )
      .orderBy(desc(tweets.createdAt))
      .limit(limit)
  )

  return tweetRecords
}

// Check if user exists in database by userId
async function checkUserExistsById(userId: string): Promise<boolean> {
  try {
    const user = await withDbError(
      db()
        .select({ id: twitterUsers.id })
        .from(twitterUsers)
        .where(eq(twitterUsers.id, userId))
        .limit(1)
    )

    return user.length > 0
  } catch (error) {
    logger().error(error, `Failed to check if user exists by ID: ${userId}`)
    return false
  }
}

// Check if user exists in database by username
async function checkUserExistsByUsername(username: string): Promise<string> {
  try {
    const user = await withDbError(
      db()
        .select({ id: twitterUsers.id })
        .from(twitterUsers)
        .where(eq(sql`lower(${twitterUsers.screenName})`, username.toLowerCase()))
        .limit(1)
    )

    return user.length > 0 ? user[0].id : ''
  } catch (error) {
    logger().error(error, `Failed to check if user exists by username: ${username}`)
    return ''
  }
}

export async function getUserTweets(
  userId: string,
  createdAfter?: Date,
  createdBefore?: Date,
  limit?: number
) {
  // Check if user exists in database
  const userExists = await checkUserExistsById(userId)
  if (!userExists) {
    throw new ApiError(404, `User with ID "${userId}" not found in database`)
  }

  const allTimelines = await fetchUserTweetsRepliesAdvanced(userId, {
    sinceTimestamp: createdAfter,
    maxTimestamp: createdBefore,
    count: limit
  })

  // const tweets = allTimelines.map((timeline) =>
  //   transformTwitterStatusToLookupStatus(timeline, timeline.user!.id_str || '')
  // )

  // // Only fetch full tweets for tweets that are truncated
  // const truncatedTweetIds = tweets.filter((tweet) => tweet.truncated).map((tweet) => tweet.id)

  // const fullTweets =
  //   truncatedTweetIds.length > 0 ? await fetchFullTweetByIds(truncatedTweetIds) : []

  // // Create a map of full tweets by ID for quick lookup
  // const fullTweetsMap = new Map(fullTweets.map((fullTweet) => [fullTweet.id, fullTweet]))

  // // Merge tweets with full tweets, maintaining the original order
  // const result = tweets.map((tweet) => {
  //   if (tweet.truncated && fullTweetsMap.has(tweet.id)) {
  //     // Return the full tweet if available
  //     return fullTweetsMap.get(tweet.id)!
  //   }
  //   // Return the original tweet if not truncated or no full tweet available
  //   return tweet
  // })

  // Save tweets to database
  if (allTimelines.length > 0) {
    try {
      await bulkSaveTweets(allTimelines)
      logger().info(`Saved ${allTimelines.length} tweets from getUserTweets`)
    } catch (error) {
      logger().error(error, 'Failed to save tweets in getUserTweets')
      // Don't throw error, just log it and continue
    }
  }

  return allTimelines
}

export async function getUserTweetsByUsername(
  username: string,
  createdAfter?: Date,
  createdBefore?: Date,
  limit?: number
) {
  // Check if user exists in database
  const userId = await checkUserExistsByUsername(username)
  if (!userId) {
    throw new ApiError(404, `User with username "${username}" not found in database`)
  }

  const allTimelines = await fetchUserTweetsRepliesAdvanced(userId, {
    sinceTimestamp: createdAfter,
    maxTimestamp: createdBefore,
    count: limit
  })

  // const tweets = allTimelines.map((timeline) =>
  //   transformTwitterStatusToLookupStatus(timeline, timeline.user!.id_str || '')
  // )

  // // Only fetch full tweets for tweets that are truncated
  // const truncatedTweetIds = tweets.filter((tweet) => tweet.truncated).map((tweet) => tweet.id)

  // const fullTweets =
  //   truncatedTweetIds.length > 0 ? await fetchFullTweetByIds(truncatedTweetIds) : []

  // // Create a map of full tweets by ID for quick lookup
  // const fullTweetsMap = new Map(fullTweets.map((fullTweet) => [fullTweet.id, fullTweet]))

  // // Merge tweets with full tweets, maintaining the original order
  // const result = tweets.map((tweet) => {
  //   if (tweet.truncated && fullTweetsMap.has(tweet.id)) {
  //     // Return the full tweet if available
  //     return fullTweetsMap.get(tweet.id)!
  //   }
  //   // Return the original tweet if not truncated or no full tweet available
  //   return tweet
  // })

  // Save tweets to database
  if (allTimelines.length > 0) {
    try {
      await bulkSaveTweets(allTimelines)
      logger().info(`Saved ${allTimelines.length} tweets from getUserTweetsByUsername`)
    } catch (error) {
      logger().error(error, 'Failed to save tweets in getUserTweetsByUsername')
      // Don't throw error, just log it and continue
    }
  }

  return allTimelines
}

export async function getUserStoredTweets(
  username: string[],
  userId: string[],
  createdAfter?: Date,
  createdBefore?: Date
) {
  const twitterUsersIds = username?.length
    ? await withDbError(
        db()
          .select({ id: twitterUsers.id })
          .from(twitterUsers)
          .where(inArray(twitterUsers.screenName, username))
      )
    : []

  const byUsernameIds = twitterUsersIds.map((r) => r.id)
  const allUserIds = Array.from(new Set([...(userId || []), ...byUsernameIds]))

  const rows = await withDbError(
    db()
      .select({
        tweet: {
          id: tweets.id,
          conversationId: tweets.conversationId,
          text: tweets.text,
          entities: tweets.entities,
          medias: tweets.medias,

          inReplyToStatusIdStr: tweets.inReplyToStatusIdStr,
          inReplyToUserIdStr: tweets.inReplyToUserIdStr,
          inReplyToUserScreenName: tweets.inReplyToUserScreenName,

          quotedStatusIdStr: tweets.quotedStatusIdStr,
          quotedUserScreenName: tweets.quotedUserScreenName,
          quotedUserIdStr: tweets.quotedUserIdStr,

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

          createdAt: tweets.createdAt
        },
        user: {
          id: twitterUsers.id,
          name: twitterUsers.name,
          screenName: twitterUsers.screenName,
          location: twitterUsers.location,
          description: twitterUsers.description,
          website: twitterUsers.website,
          followersCount: twitterUsers.followersCount,
          friendsCount: twitterUsers.friendsCount,
          kolFollowersCount: twitterUsers.kolFollowersCount,
          isKol: twitterUsers.isKol,
          tags: twitterUsers.tags
        }
      })
      .from(tweets)
      .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
      .where(
        and(
          allUserIds?.length ? inArray(tweets.userId, allUserIds) : undefined,
          createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
          createdBefore ? lt(tweets.createdAt, createdBefore) : undefined
        )
      )
      .orderBy(desc(tweets.createdAt))
  )

  return rows
}

export async function getTweetsReferencingTweet(
  tweetId: string,
  createdAfter?: Date,
  createdBefore?: Date,
  minKolFollowers: number = 0,
  limit: number = 50
) {
  const tweetRecords = await withDbError(
    db()
      .select({
        tweet: {
          id: tweets.id,
          text: tweets.text,
          fullText: tweets.fullText,
          entities: tweets.entities,
          medias: tweets.medias,
          favoriteCount: tweets.favoriteCount,
          bookmarkCount: tweets.bookmarkCount,
          viewCount: tweets.viewCount,
          quoteCount: tweets.quoteCount,
          replyCount: tweets.replyCount,
          retweetCount: tweets.retweetCount,
          createdAt: tweets.createdAt,
          inReplyToStatusIdStr: tweets.inReplyToStatusIdStr,
          quotedStatusIdStr: tweets.quotedStatusIdStr,
          retweetedStatusIdStr: tweets.retweetedStatusIdStr
        },
        user: {
          id: twitterUsers.id,
          name: twitterUsers.name,
          screenName: twitterUsers.screenName,
          location: twitterUsers.location,
          description: twitterUsers.description,
          website: twitterUsers.website,
          followersCount: twitterUsers.followersCount,
          friendsCount: twitterUsers.friendsCount,
          kolFollowersCount: twitterUsers.kolFollowersCount,
          isKol: twitterUsers.isKol,
          tags: twitterUsers.tags
        }
      })
      .from(tweets)
      .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
      .where(
        and(
          or(
            and(eq(tweets.inReplyToStatusIdStr, tweetId), isNull(tweets.retweetedStatusIdStr)),
            and(eq(tweets.quotedStatusIdStr, tweetId), isNull(tweets.retweetedStatusIdStr)),
            eq(tweets.retweetedStatusIdStr, tweetId)
          ),
          createdAfter ? gt(tweets.createdAt, createdAfter) : undefined,
          createdBefore ? lt(tweets.createdAt, createdBefore) : undefined,
          minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
        )
      )
      .orderBy(desc(tweets.createdAt))
      .limit(limit)
  )

  return tweetRecords
}

export async function getTweetReferencingCounts(tweetId: string, minKolFollowers: number = 0) {
  // Execute all three count queries in parallel
  const [repliesCount, quoteRetweetsCount, retweetsCount] = await Promise.all([
    // Get replies count (inReplyToStatusIdStr matches and not a retweet)
    withDbError(
      db()
        .select({ count: sql<number>`count(DISTINCT ${tweets.userId})` })
        .from(tweets)
        .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
        .where(
          and(
            eq(tweets.inReplyToStatusIdStr, tweetId),
            isNull(tweets.retweetedStatusIdStr),
            minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
          )
        )
    ),

    // Get quote tweets count (quotedStatusIdStr matches and not a retweet)
    withDbError(
      db()
        .select({ count: sql<number>`count(DISTINCT ${tweets.userId})` })
        .from(tweets)
        .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
        .where(
          and(
            eq(tweets.quotedStatusIdStr, tweetId),
            isNull(tweets.retweetedStatusIdStr),
            minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
          )
        )
    ),

    // Get retweets count (retweetedStatusIdStr matches)
    withDbError(
      db()
        .select({ count: sql<number>`count(DISTINCT ${tweets.userId})` })
        .from(tweets)
        .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
        .where(
          and(
            eq(tweets.retweetedStatusIdStr, tweetId),
            minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
          )
        )
    )
  ])

  const replies = Number(repliesCount[0]?.count) || 0
  const quoteRetweets = Number(quoteRetweetsCount[0]?.count) || 0
  const retweets = Number(retweetsCount[0]?.count) || 0

  return {
    replies,
    quoteRetweets,
    retweets,
    total: replies + quoteRetweets + retweets
  }
}

/**
 * Get referencing counts for multiple tweets in batch
 */
export async function getBatchTweetReferencingCounts(
  tweetIds: string[],
  minKolFollowers: number = 0
): Promise<
  Map<
    string,
    {
      replies: number
      quoteRetweets: number
      retweets: number
      total: number
    }
  >
> {
  if (tweetIds.length === 0) {
    return new Map()
  }

  try {
    // Execute all three count queries in parallel for all tweet IDs
    const [repliesCount, quoteRetweetsCount, retweetsCount] = await Promise.all([
      // Get replies count for all tweets
      withDbError(
        db()
          .select({
            tweetId: tweets.inReplyToStatusIdStr,
            count: sql<number>`count(DISTINCT ${tweets.userId})`
          })
          .from(tweets)
          .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
          .where(
            and(
              sql`${tweets.inReplyToStatusIdStr} = ANY(${tweetIds})`,
              isNull(tweets.retweetedStatusIdStr),
              minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
            )
          )
          .groupBy(tweets.inReplyToStatusIdStr)
      ),

      // Get quote tweets count for all tweets
      withDbError(
        db()
          .select({
            tweetId: tweets.quotedStatusIdStr,
            count: sql<number>`count(DISTINCT ${tweets.userId})`
          })
          .from(tweets)
          .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
          .where(
            and(
              sql`${tweets.quotedStatusIdStr} = ANY(${tweetIds})`,
              isNull(tweets.retweetedStatusIdStr),
              minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
            )
          )
          .groupBy(tweets.quotedStatusIdStr)
      ),

      // Get retweets count for all tweets
      withDbError(
        db()
          .select({
            tweetId: tweets.retweetedStatusIdStr,
            count: sql<number>`count(DISTINCT ${tweets.userId})`
          })
          .from(tweets)
          .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
          .where(
            and(
              sql`${tweets.retweetedStatusIdStr} = ANY(${tweetIds})`,
              minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
            )
          )
          .groupBy(tweets.retweetedStatusIdStr)
      )
    ])

    // Create maps for easy lookup
    const repliesMap = new Map(repliesCount.map((r) => [r.tweetId, Number(r.count) || 0]))
    const quoteRetweetsMap = new Map(
      quoteRetweetsCount.map((q) => [q.tweetId, Number(q.count) || 0])
    )
    const retweetsMap = new Map(retweetsCount.map((r) => [r.tweetId, Number(r.count) || 0]))

    // Build result map for all tweet IDs
    const resultMap = new Map()
    for (const tweetId of tweetIds) {
      const replies = repliesMap.get(tweetId) || 0
      const quoteRetweets = quoteRetweetsMap.get(tweetId) || 0
      const retweets = retweetsMap.get(tweetId) || 0

      resultMap.set(tweetId, {
        replies,
        quoteRetweets,
        retweets,
        total: replies + quoteRetweets + retweets
      })
    }

    return resultMap
  } catch (error) {
    logger().error({ error, tweetIds }, 'Failed to get batch tweet referencing counts')
    // Return empty map with zero counts for all tweets
    const emptyCounts = { replies: 0, quoteRetweets: 0, retweets: 0, total: 0 }
    const emptyMap = new Map()
    tweetIds.forEach((tweetId) => emptyMap.set(tweetId, emptyCounts))
    return emptyMap
  }
}

/**
 * Get quality engagement metrics for multiple tweets in batch
 */
export async function getBatchTweetQualityEngagementMetrics(
  tweetIds: string[],
  minKolFollowers: number = 0
): Promise<
  Map<
    string,
    {
      qualityCm: number
      qualityRt: number
      qualityQt: number
      qualityEngagementScore: number
    }
  >
> {
  if (tweetIds.length === 0) {
    return new Map()
  }

  // Execute all three count queries in parallel for all tweet IDs
  const [repliesCount, quoteRetweetsCount, retweetsCount] = await Promise.all([
    // Get replies count for all tweets
    withDbError(
      db()
        .select({
          tweetId: tweets.inReplyToStatusIdStr,
          count: sql<number>`count(DISTINCT ${tweets.userId})`
        })
        .from(tweets)
        .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
        .where(
          and(
            sql`${tweets.inReplyToStatusIdStr} = ANY(${tweetIds})`,
            isNull(tweets.retweetedStatusIdStr),
            minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
          )
        )
        .groupBy(tweets.inReplyToStatusIdStr)
    ),

    // Get quote tweets count for all tweets
    withDbError(
      db()
        .select({
          tweetId: tweets.quotedStatusIdStr,
          count: sql<number>`count(DISTINCT ${tweets.userId})`
        })
        .from(tweets)
        .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
        .where(
          and(
            sql`${tweets.quotedStatusIdStr} = ANY(${tweetIds})`,
            isNull(tweets.retweetedStatusIdStr),
            minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
          )
        )
        .groupBy(tweets.quotedStatusIdStr)
    ),

    // Get retweets count for all tweets
    withDbError(
      db()
        .select({
          tweetId: tweets.retweetedStatusIdStr,
          count: sql<number>`count(DISTINCT ${tweets.userId})`
        })
        .from(tweets)
        .innerJoin(twitterUsers, eq(tweets.userId, twitterUsers.id))
        .where(
          and(
            sql`${tweets.retweetedStatusIdStr} = ANY(${tweetIds})`,
            minKolFollowers > 0 ? gte(twitterUsers.kolFollowersCount, minKolFollowers) : undefined
          )
        )
        .groupBy(tweets.retweetedStatusIdStr)
    )
  ])

  // Create maps for easy lookup
  const repliesMap = new Map(repliesCount.map((r) => [r.tweetId, Number(r.count) || 0]))
  const quoteRetweetsMap = new Map(quoteRetweetsCount.map((q) => [q.tweetId, Number(q.count) || 0]))
  const retweetsMap = new Map(retweetsCount.map((r) => [r.tweetId, Number(r.count) || 0]))

  // Build result map with quality engagement metrics for all tweet IDs
  const resultMap = new Map()
  for (const tweetId of tweetIds) {
    const qualityCm = repliesMap.get(tweetId) || 0
    const qualityRt = retweetsMap.get(tweetId) || 0
    const qualityQt = quoteRetweetsMap.get(tweetId) || 0
    const qualityEngagementScore = qualityCm + qualityRt * 2 + qualityQt * 3

    resultMap.set(tweetId, {
      qualityCm,
      qualityRt,
      qualityQt,
      qualityEngagementScore
    })
  }

  return resultMap
}

export async function getTweetStatusByIds(tweetIds: string[]) {
  if (tweetIds.length === 0) {
    return []
  }

  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000) // 1 hour ago

  // First, check which tweets already exist in the database and are fresh (updated within the last hour)
  const existingTweets = await withDbError(
    db()
      .select({
        id: tweets.id,
        userId: tweets.userId,
        text: tweets.text,
        entities: tweets.entities,
        medias: tweets.medias,
        inReplyToStatusIdStr: tweets.inReplyToStatusIdStr,
        inReplyToUserIdStr: tweets.inReplyToUserIdStr,
        inReplyToUserScreenName: tweets.inReplyToUserScreenName,
        quotedStatusIdStr: tweets.quotedStatusIdStr,
        quotedUserScreenName: tweets.quotedUserScreenName,
        quotedUserIdStr: tweets.quotedUserIdStr,
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
        updatedAt: tweets.updatedAt
      })
      .from(tweets)
      .where(inArray(tweets.id, tweetIds))
  )

  // Separate fresh tweets from stale/missing ones
  const freshTweets = existingTweets.filter(
    (tweet) => tweet.updatedAt > oneHourAgo && tweet.replyCount !== null
  )
  const freshTweetIds = new Set(freshTweets.map((tweet) => tweet.id))
  const tweetsToFetch = tweetIds.filter((id) => !freshTweetIds.has(id))

  let newlyFetchedTweets: FullTwitterStatus[] = []

  // Fetch missing/stale tweets if any
  if (tweetsToFetch.length > 0) {
    newlyFetchedTweets = await fetchFullTweetByIds(tweetsToFetch)

    // Convert FullTwitterStatus to NewTweet format and save to database
    if (newlyFetchedTweets.length > 0) {
      const tweetsToSave: NewTweet[] = newlyFetchedTweets
      await bulkSaveTwitterUsers(
        newlyFetchedTweets.map((tweet) => ({
          ...tweet.user!
        }))
      )
      // Save to database
      await bulkSaveTweets(tweetsToSave)

      // If fullText is missing, mark truncated=false
      const noFullTextIds = newlyFetchedTweets.filter((t) => t.fullText == null).map((t) => t.id)
      if (noFullTextIds.length > 0) {
        await withDbError(
          db()
            .update(tweets)
            .set({ truncated: false, updatedAt: new Date() })
            .where(inArray(tweets.id, noFullTextIds))
        )
      }
    }
  }

  // Convert fresh tweets to FullTwitterStatus format for consistency
  const freshTweetsAsFullStatus: FullTwitterStatus[] = freshTweets.map((tweet) => ({
    ...tweet,
    id: tweet.id,
    userId: tweet.userId,
    text: tweet.text,
    truncated: false, // We don't store this, assume false
    entities: tweet.entities as any,
    medias: tweet.medias as any,
    bookmarkCount: tweet.bookmarkCount ?? undefined,
    viewCount: tweet.viewCount ?? undefined,
    quoteCount: tweet.quoteCount ?? undefined,
    replyCount: tweet.replyCount ?? undefined,
    fullText: tweet.fullText ?? undefined,
    notetweetEntities: (tweet.notetweetEntities as any) ?? undefined
  }))

  // Combine fresh tweets and newly fetched tweets, maintaining the original order
  const allTweets = [...freshTweetsAsFullStatus, ...newlyFetchedTweets]

  // Sort to match the original order of requested tweet IDs
  const tweetMap = new Map(allTweets.map((tweet) => [tweet.id, tweet]))
  const orderedTweets = tweetIds
    .map((id) => tweetMap.get(id))
    .filter(Boolean) as FullTwitterStatus[]

  return orderedTweets
}
