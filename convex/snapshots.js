import { internalAction, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Mirror of src/config/moods.js (server copy so the cron can fetch TMDB
// without a client). Keep genreIds/sort in sync when moods change.
const MOODS = [
  { id: "cozy", genreIds: [10751, 35, 16], sortBy: "vote_average.desc", voteCountMin: 200 },
  { id: "heartbroken", genreIds: [18, 10749], sortBy: "vote_average.desc", voteCountMin: 300 },
  { id: "stressed", genreIds: [16, 35, 14], sortBy: "popularity.desc", voteCountMin: 100 },
  { id: "hyped", genreIds: [28, 53], sortBy: "popularity.desc", voteCountMin: 200 },
  { id: "romantic", genreIds: [10749], sortBy: "vote_average.desc", voteCountMin: 150 },
  { id: "adventurous", genreIds: [12, 28], sortBy: "popularity.desc", voteCountMin: 200 },
  { id: "nostalgic", genreIds: [18, 10751], sortBy: "vote_average.desc", voteCountMin: 200, releaseDateBefore: "2005-12-31" },
  { id: "mindbend", genreIds: [878, 9648, 53], sortBy: "vote_average.desc", voteCountMin: 200 },
  { id: "angry", genreIds: [28, 80, 53], sortBy: "popularity.desc", voteCountMin: 200 },
];

const BASE_URL = "https://api.themoviedb.org/3";

function dayOfYearUTC(d) {
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86400000);
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function tmdb(path, params) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(k, String(value));
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status} on ${path}`);
  return await res.json();
}

// Fetches all moods from TMDB and stores today's snapshot (idempotent).
// Called by the midnight cron; also runnable once via
// `npx convex run snapshots:fetchAndStore` for backfills.
export const fetchAndStore = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("Missing TMDB_API_KEY env var");
    const now = new Date();
    const date = now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    // Rotate pages daily so snapshots visibly change day to day.
    // 3 pages per mood form the day's pool — clients deal a random
    // 20 from it on every page load.
    const basePage = (dayOfYearUTC(now) % 5) + 1;
    const seed = Number(date.replaceAll("-", ""));
    const rand = mulberry32(seed);

    for (const mood of MOODS) {
      // Gather up to 3 pages, then dedupe by TMDB id
      const seen = new Map();
      for (let p = 0; p < 3; p++) {
        const page = ((basePage - 1 + p) % 5) + 1;
        let data;
        if (mood.useTrending) {
          data = await tmdb("/trending/movie/week", {
            api_key: apiKey,
            language: "en-US",
            page,
          });
        } else {
          data = await tmdb("/discover/movie", {
            api_key: apiKey,
            language: "en-US",
            with_genres: mood.genreIds.join("|"),
            sort_by: mood.sortBy,
            "vote_count.gte": mood.voteCountMin,
            "release_date.lte": mood.releaseDateBefore ?? "",
            page,
          });
        }
        for (const m of data.results ?? []) {
          if (m.poster_path && !seen.has(m.id)) seen.set(m.id, m);
        }
      }
      const withPosters = [...seen.values()];
      // Seeded shuffle, then store the pool (up to 60)
      const shuffled = [...withPosters];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const movies = shuffled.slice(0, 60).map((m) => ({
        id: m.id,
        title: m.title,
        poster_path: m.poster_path ?? undefined,
        release_date: m.release_date ?? undefined,
        vote_average: m.vote_average ?? undefined,
        overview: m.overview ?? undefined,
        genre_ids: m.genre_ids ?? [],
      }));
      await ctx.runMutation(internal.snapshots.store, {
        moodId: mood.id,
        date,
        movies,
      });
    }
    return date;
  },
});

export const store = internalMutation({
  args: {
    moodId: v.string(),
    date: v.string(),
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
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("dailySnapshots")
      .withIndex("by_mood_date", (q) =>
        q.eq("moodId", args.moodId).eq("date", args.date)
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        movies: args.movies,
        createdAt: Date.now(),
      });
      return existing._id;
    }
    return await ctx.db.insert("dailySnapshots", {
      moodId: args.moodId,
      date: args.date,
      movies: args.movies,
      createdAt: Date.now(),
    });
  },
});

// Public: snapshots are the same for everyone, no auth needed.
export const get = query({
  args: { moodId: v.string(), date: v.string() },
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("dailySnapshots")
      .withIndex("by_mood_date", (q) =>
        q.eq("moodId", args.moodId).eq("date", args.date)
      )
      .first();
    return doc?.movies ?? null;
  },
});

// Public: past snapshot days for a mood (newest first).
export const history = query({
  args: { moodId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("dailySnapshots")
      .withIndex("by_mood_date", (q) => q.eq("moodId", args.moodId))
      .order("desc")
      .take(args.limit ?? 7);
    return rows.map((r) => ({ date: r.date, count: r.movies.length }));
  },
});
