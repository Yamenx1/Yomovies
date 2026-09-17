import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Personal ratings + mini-reviews. Signed-out callers get [] (guests keep
// a local map instead).
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("ratings")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const set = mutation({
  args: {
    tmdbId: v.number(),
    title: v.string(),
    posterPath: v.optional(v.string()),
    kind: v.optional(v.string()),
    genreIds: v.optional(v.array(v.number())),
    rating: v.number(),
    review: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (args.rating < 1 || args.rating > 5) throw new Error("Rating must be 1–5");
    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_user_tmdb", (q) =>
        q.eq("userId", identity.subject).eq("tmdbId", args.tmdbId)
      )
      .first();
    const doc = {
      userId: identity.subject,
      tmdbId: args.tmdbId,
      title: args.title,
      posterPath: args.posterPath,
      kind: args.kind,
      genre_ids: args.genreIds,
      rating: args.rating,
      review: args.review?.slice(0, 500),
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, doc);
      return existing._id;
    }
    return await ctx.db.insert("ratings", doc);
  },
});

export const remove = mutation({
  args: { tmdbId: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("ratings")
      .withIndex("by_user_tmdb", (q) =>
        q.eq("userId", identity.subject).eq("tmdbId", args.tmdbId)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});
