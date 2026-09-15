import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Signed-out browsers can still browse: return null instead of throwing.
export const get = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
  },
});

export const set = mutation({
  args: {
    theme: v.optional(v.string()),
    lastMood: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const existing = await ctx.db
      .query("preferences")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .first();
    const patch = {
      ...(args.theme !== undefined ? { theme: args.theme } : {}),
      ...(args.lastMood !== undefined ? { lastMood: args.lastMood } : {}),
      updatedAt: Date.now(),
    };
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("preferences", {
      userId: identity.subject,
      ...patch,
    });
  },
});
