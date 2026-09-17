import { action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// True per-provider deep links via JustWatch's server-rendered pages
// (free, keyless). Flow per title: JW search → title page → JSON-LD
// WatchAction urlTemplates (e.g. shahid.mbc.net/.../id-404988).
// Results are cached in jwCache; every failure mode falls back to the
// caller's TMDB/provider-search links — never throws to the client.
const JW = "https://www.justwatch.com";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

// Domain fragment → TMDB-style provider name for matching
const DOMAIN_NAMES = [
  ["shahid.mbc.net", "Shahid"],
  ["netflix.com", "Netflix"],
  ["primevideo.com", "Amazon Prime"],
  ["disneyplus.com", "Disney"],
  ["tv.apple.com", "Apple TV"],
  ["itunes.apple.com", "Apple TV"],
  ["play.google.com", "Google Play"],
  ["youtube.com", "YouTube"],
  ["osnplus.com", "OSN"],
  ["osn.com", "OSN"],
  ["starzplay.com", "STARZPLAY"],
  ["hulu.com", "Hulu"],
  ["play.max.com", "Max"],
  ["max.com", "Max"],
  ["paramountplus.com", "Paramount"],
  ["crunchyroll.com", "Crunchyroll"],
];

function slugify(s) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function nameForUrl(url) {
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  for (const [frag, name] of DOMAIN_NAMES) {
    if (host.includes(frag)) return name;
  }
  return null;
}

export const deepLinks = action({
  args: { tmdbId: v.number(), title: v.string(), kind: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const kind = args.kind === "tv" ? "tv" : "movie";
    const cached = await ctx.runQuery(internal.watchLinks.getCached, {
      tmdbId: args.tmdbId,
      kind,
    });
    if (cached) return { links: cached.links, cached: true };

    const links = [];
    try {
      // 1. Search JustWatch SA for the title page
      const searchRes = await fetch(
        `${JW}/sa/search?q=${encodeURIComponent(args.title)}`,
        { headers: { "User-Agent": UA } }
      );
      if (!searchRes.ok) return { links, cached: false };
      const searchHtml = await searchRes.text();
      const slugRe = /\/sa\/(movie|tv-show)\/[a-z0-9-]+/g;
      const found = [];
      let m;
      while ((m = slugRe.exec(searchHtml)) !== null && found.length < 6) {
        if (!found.includes(m[0])) found.push(m[0]);
      }
      if (found.length === 0) return { links, cached: false };

      // Prefer the kind-consistent, slug-matching result
      const wantType = kind === "tv" ? "tv-show" : "movie";
      const wantSlug = slugify(args.title);
      const pick =
        found.find((p) => p.startsWith(`/sa/${wantType}/`) && p.endsWith(`/${wantSlug}`)) ??
        found.find((p) => p.startsWith(`/sa/${wantType}/`)) ??
        found[0];

      // 2. Title page → JSON-LD WatchAction deep links
      const pageRes = await fetch(`${JW}${pick}`, { headers: { "User-Agent": UA } });
      if (!pageRes.ok) return { links, cached: false };
      const html = await pageRes.text();
      const urlRe = /"urlTemplate":"(.*?)"/g;
      const seen = new Set();
      let u;
      while ((u = urlRe.exec(html)) !== null && links.length < 10) {
        const url = u[1].replace(/\\\//g, "/");
        const name = nameForUrl(url);
        if (name && !seen.has(name)) {
          seen.add(name);
          links.push({ provider: name, url });
        }
      }
    } catch {
      return { links, cached: false };
    }

    await ctx.runMutation(internal.watchLinks.storeCached, {
      tmdbId: args.tmdbId,
      kind,
      links,
    });
    return { links, cached: false };
  },
});

export const getCached = internalQuery({
  args: { tmdbId: v.number(), kind: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("jwCache")
      .withIndex("by_tmdb", (q) =>
        q.eq("tmdbId", args.tmdbId).eq("kind", args.kind)
      )
      .first();
    return doc ?? null;
  },
});

export const storeCached = internalMutation({
  args: {
    tmdbId: v.number(),
    kind: v.string(),
    links: v.array(v.object({ provider: v.string(), url: v.string() })),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("jwCache")
      .withIndex("by_tmdb", (q) =>
        q.eq("tmdbId", args.tmdbId).eq("kind", args.kind)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { links: args.links, createdAt: Date.now() });
      return existing._id;
    }
    return await ctx.db.insert("jwCache", {
      tmdbId: args.tmdbId,
      kind: args.kind,
      links: args.links,
      createdAt: Date.now(),
    });
  },
});
