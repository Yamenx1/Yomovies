import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    return await ctx.db
      .query("watched")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
  },
});

export const add = mutation({
  args: { tmdbId: v.number(), title: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("watched")
      .withIndex("by_user_tmdb", (q) =>
        q.eq("userId", identity.subject).eq("tmdbId", args.tmdbId)
      )
      .first();
    if (existing) return existing._id;
    return await ctx.db.insert("watched", {
      userId: identity.subject,
      tmdbId: args.tmdbId,
      title: args.title,
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
      .query("watched")
      .withIndex("by_user_tmdb", (q) =>
        q.eq("userId", identity.subject).eq("tmdbId", args.tmdbId)
      )
      .first();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const clear = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const rows = await ctx.db
      .query("watched")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    await Promise.all(rows.map((r) => ctx.db.delete(r._id)));
  },
});
