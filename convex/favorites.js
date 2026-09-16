import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const add = mutation({
  args: {
    tmdbId: v.number(),
    title: v.string(),
    posterPath: v.optional(v.string()),
    genreIds: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_tmdb", (q) =>
        q.eq("userId", identity.subject).eq("tmdbId", args.tmdbId)
      )
      .first();
    if (existing) {
      // Backfill genres on older rows missing them (taste profile fuel)
      if (!existing.genre_ids && args.genreIds) {
        await ctx.db.patch(existing._id, { genre_ids: args.genreIds });
      }
      return existing._id;
    }
    return await ctx.db.insert("favorites", {
      userId: identity.subject,
      tmdbId: args.tmdbId,
      title: args.title,
      posterPath: args.posterPath,
      genre_ids: args.genreIds,
      addedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { tmdbId: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_tmdb", (q) =>
        q.eq("userId", identity.subject).eq("tmdbId", args.tmdbId)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
