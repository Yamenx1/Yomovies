import { action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Open-ended AI recommendations: Gemini names real movies for ANY feeling
// (no mood taxonomy), then each title is verified against TMDB — only films
// that actually exist, with posters, reach the client. Exact-text repeats
// are served from the aiCache table.
const TMDB_BASE = "https://api.themoviedb.org/3";

const movieValidator = v.object({
  id: v.number(),
  title: v.string(),
  poster_path: v.optional(v.string()),
  release_date: v.optional(v.string()),
  vote_average: v.optional(v.number()),
  overview: v.optional(v.string()),
  genre_ids: v.array(v.number()),
});

async function tmdbSearch(apiKey, title, year) {
  const tryFetch = async (params) => {
    const url = new URL(`${TMDB_BASE}/search/movie`);
    for (const [k, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(k, String(value));
      }
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return await res.json();
  };
  // Prefer the year-qualified match, fall back to title-only
  for (const params of [
    { api_key: apiKey, query: title, year, include_adult: "false" },
    { api_key: apiKey, query: title, include_adult: "false" },
  ]) {
    const data = await tryFetch(params);
    const hit = (data.results ?? []).find((m) => m.poster_path);
    if (hit) return hit;
  }
  return null;
}

export const recommend = action({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const query = args.text.trim().slice(0, 500);
    if (!query) throw new Error("Empty search");

    // Exact-repeat cache (case-insensitive)
    const key = query.toLowerCase();
    const cached = await ctx.runQuery(internal.aiRecommend.getCached, { text: key });
    if (cached) {
      return { movies: cached.movies, reason: cached.reason ?? null, cached: true };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("AI not configured");
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) throw new Error("Movie database not configured");
    const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

    const prompt =
      `Recommend movies for someone's current feeling. The person says: "${query}"\n\n` +
      `Pick 12 REAL, well-known movies that fit — mix eras and styles, no repeats. ` +
      `Output ONLY a JSON object and absolutely nothing else — no preamble, no markdown, no explanation: ` +
      `{"movies": [{"title": "<exact film title>", "year": <release year>}], ` +
      `"reason": "<one short friendly line explaining the picks>"}`;

    const generationConfig = {
      responseMimeType: "application/json",
      maxOutputTokens: 1000,
      temperature: 0.7,
      // Lite models reject thinkingConfig; full models need the cap so the
      // thinking trace doesn't eat the JSON budget
      ...(!model.includes("lite") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    };

    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig,
          }),
        }
      );
    } catch {
      throw new Error("AI unreachable — try Surprise me instead");
    }
    if (!res.ok) throw new Error("AI hiccup — try again or hit Surprise me");

    let raw = "";
    try {
      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts ?? [];
      raw = parts.map((p) => p.text ?? "").join("\n");
    } catch {
      throw new Error("AI hiccup — try again or hit Surprise me");
    }

    let parsed;
    try {
      const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("no-json");
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new Error("AI hiccup — try again or hit Surprise me");
    }

    const picks = Array.isArray(parsed.movies) ? parsed.movies.slice(0, 12) : [];
    const movies = [];
    const seenIds = new Set();
    for (const pick of picks) {
      if (!pick?.title || movies.length >= 12) continue;
      try {
        const hit = await tmdbSearch(tmdbKey, pick.title, pick.year);
        if (hit && !seenIds.has(hit.id)) {
          seenIds.add(hit.id);
          movies.push({
            id: hit.id,
            title: hit.title,
            poster_path: hit.poster_path ?? undefined,
            release_date: hit.release_date ?? undefined,
            vote_average: hit.vote_average ?? undefined,
            overview: hit.overview ?? undefined,
            genre_ids: hit.genre_ids ?? [],
          });
        }
      } catch {
        // Skip unresolvable titles — never fail the whole batch for one miss
      }
    }
    if (movies.length === 0) {
      throw new Error("Couldn't match those to real films — rephrase and try again");
    }

    const reason =
      typeof parsed.reason === "string" && parsed.reason.length > 0
        ? parsed.reason
        : "Picked for exactly that feeling.";

    await ctx.runMutation(internal.aiRecommend.storeCached, {
      text: key,
      movies,
      reason,
    });

    return { movies, reason, cached: false };
  },
});

export const getCached = internalQuery({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiCache")
      .withIndex("by_text", (q) => q.eq("text", args.text))
      .first();
  },
});

export const storeCached = internalMutation({
  args: {
    text: v.string(),
    movies: v.array(movieValidator),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiCache", {
      text: args.text,
      movies: args.movies,
      reason: args.reason,
      createdAt: Date.now(),
    });
  },
});
