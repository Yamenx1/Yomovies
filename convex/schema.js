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

  // Favorite titles (heart button on cards). genre_ids powers the
  // "For you" taste profile.
  favorites: defineTable({
    userId: v.string(),
    tmdbId: v.number(),
    title: v.string(),
    posterPath: v.optional(v.string()),
    kind: v.optional(v.string()),
    genre_ids: v.optional(v.array(v.number())),
    addedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_tmdb", ["userId", "tmdbId"]),

  // Watch-later titles (bookmark button on cards + details)
  watchlist: defineTable({
    userId: v.string(),
    tmdbId: v.number(),
    title: v.string(),
    posterPath: v.optional(v.string()),
    kind: v.optional(v.string()),
    genre_ids: v.optional(v.array(v.number())),
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

  // AI search cache: exact-text repeats return instantly
  // without new AI/TMDB calls
  aiCache: defineTable({
    text: v.string(), // normalized (lowercased, trimmed) user input
    movies: v.array(
      v.object({
        id: v.number(),
        kind: v.optional(v.string()),
        title: v.string(),
        poster_path: v.optional(v.string()),
        release_date: v.optional(v.string()),
        vote_average: v.optional(v.number()),
        overview: v.optional(v.string()),
        genre_ids: v.array(v.number()),
      })
    ),
    reason: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_text", ["text"]),

  // Recent searches per user (signed-out visitors use localStorage instead)
  recentSearches: defineTable({
    userId: v.string(),
    text: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // JustWatch deep-link cache: per-title provider URLs scraped from
  // JustWatch SA pages (free, keyless). Refreshed on miss only.
  jwCache: defineTable({
    tmdbId: v.number(),
    kind: v.string(), // 'movie' | 'tv'
    links: v.array(v.object({ provider: v.string(), url: v.string() })),
    createdAt: v.number(),
  }).index("by_tmdb", ["tmdbId", "kind"]),

  // Personal star ratings + optional mini-reviews. High ratings amplify
  // the taste profile, low ratings push those genres down.
  ratings: defineTable({
    userId: v.string(),
    tmdbId: v.number(),
    title: v.string(),
    posterPath: v.optional(v.string()),
    kind: v.optional(v.string()),
    genre_ids: v.optional(v.array(v.number())),
    rating: v.number(), // 1–5
    review: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_tmdb", ["userId", "tmdbId"]),
});
