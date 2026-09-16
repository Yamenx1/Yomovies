import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const MAX_RECENT = 10;

// Signed-out callers get [] — they use localStorage instead.
export const list = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const rows = await ctx.db
      .query("recentSearches")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .take(MAX_RECENT);
    return rows.map((r) => r.text);
  },
});

export const log = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const text = args.text.trim().slice(0, 200);
    if (!text) return;
    // Move-to-front: drop identical entries, prune oldest past the cap
    // (collect() returns insertion order, so index 0 is the oldest)
    const existing = await ctx.db
      .query("recentSearches")
      .withIndex("by_user", (q) => q.eq("userId", identity.subject))
      .collect();
    for (const row of existing) {
      if (row.text.toLowerCase() === text.toLowerCase()) {
        await ctx.db.delete(row._id);
      }
    }
    const afterDedupe = existing.filter(
      (row) => row.text.toLowerCase() !== text.toLowerCase()
    );
    const overflow = afterDedupe.length - (MAX_RECENT - 1);
    for (let i = 0; i < overflow; i++) {
      await ctx.db.delete(afterDedupe[i]._id);
    }
    await ctx.db.insert("recentSearches", {
      userId: identity.subject,
      text,
      createdAt: Date.now(),
    });
  },
});
