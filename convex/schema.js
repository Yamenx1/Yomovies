import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// Full per-user data for YoMovies. Every table is scoped by Clerk userId
// (ctx.auth.getUserIdentity().subject) and never exposes other users' rows.
export default defineSchema({
  // Theme + last mood per user
  preferences: defineTable({
    userId: v.string(),
    theme: v.optional(v.string()),
    lastMood: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // "Already seen" / excluded titles (replaces the local excluded Set)
  watched: defineTable({
    userId: v.string(),
    tmdbId: v.number(),
    title: v.optional(v.string()),
    addedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_tmdb", ["userId", "tmdbId"]),

  // Favorite titles (heart button on cards)
  favorites: defineTable({
    userId: v.string(),
    tmdbId: v.number(),
    title: v.string(),
    posterPath: v.optional(v.string()),
    addedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_tmdb", ["userId", "tmdbId"]),

  // Every mood pick, for history / recommendations later
  moodActivity: defineTable({
    userId: v.string(),
    moodId: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Server-side daily snapshots: one pick-list per mood per day (UTC).
  // Written by the midnight cron + backfillable via snapshots:fetchAndStore.
  // Clients read today's snapshot first, fall back to live TMDB if missing.
  dailySnapshots: defineTable({
    moodId: v.string(),
    date: v.string(), // YYYY-MM-DD (UTC)
    movies: v.array(
      v.object({
        id: v.number(),
        title: v.string(),
        poster_path: v.optional(v.string()),
        release_date: v.optional(v.string()),
        vote_average: v.optional(v.number()),
        overview: v.optional(v.string()),
        genre_ids: v.array(v.number()),
      })
    ),
    createdAt: v.number(),
  }).index("by_mood_date", ["moodId", "date"]),
});
