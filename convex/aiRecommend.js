import { action, internalQuery, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// TMDB genre names for the taste summary injected into the prompt
const GENRE_NAMES = {
  28: "Action", 12: "Adventure", 16: "Animation", 35: "Comedy",
  80: "Crime", 99: "Documentary", 18: "Drama", 10751: "Family",
  14: "Fantasy", 36: "History", 27: "Horror", 10402: "Music",
  9648: "Mystery", 10749: "Romance", 878: "Sci-Fi", 10770: "TV Movie",
  53: "Thriller", 10752: "War", 37: "Western",
  10759: "Action & Adventure", 10762: "Kids", 10763: "News",
  10764: "Reality", 10765: "Sci-Fi & Fantasy", 10766: "Soap",
  10767: "Talk", 10768: "War & Politics",
};

// Open-ended AI recommendations: Gemini names real movies for ANY feeling
// (no mood taxonomy), then each title is verified against TMDB — only films
// that actually exist, with posters, reach the client. Exact-text repeats
// are served from the aiCache table.
const TMDB_BASE = "https://api.themoviedb.org/3";

const movieValidator = v.object({
  id: v.number(),
  kind: v.optional(v.string()),
  title: v.string(),
  poster_path: v.optional(v.string()),
  release_date: v.optional(v.string()),
  vote_average: v.optional(v.number()),
  overview: v.optional(v.string()),
  genre_ids: v.array(v.number()),
});

async function tmdbSearch(apiKey, title, year, language = "en-US", kind = "movie") {
  const tryFetch = async (params) => {
    const url = new URL(`${TMDB_BASE}/search/${kind}`);
    url.searchParams.set("language", language);
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
  args: {
    text: v.string(),
    lang: v.optional(v.string()),
    kind: v.optional(v.string()),
    excludeTitles: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const query = args.text.trim().slice(0, 500);
    if (!query) throw new Error("Empty search");
    // Movies or TV shows — shapes the prompt, endpoints, and cache key
    const kind = args.kind === "tv" ? "tv" : "movie";
    const kindNoun = kind === "tv" ? "TV shows" : "movies";
    const kindNounLower = kind === "tv" ? "shows" : "films";

    // Personalize: this viewer's top genres + loved titles (best-effort,
    // skipped silently for guests)
    let tasteLine = "";
    try {
      const taste = await ctx.runQuery(internal.aiRecommend.userTaste, {});
      const bits = [];
      if (taste.genres.length > 0) {
        bits.push(`top genres: ${taste.genres.join(", ")}`);
      }
      if (taste.loved.length > 0) {
        bits.push(`loved: ${taste.loved.join(", ")}`);
      }
      if (taste.disliked.length > 0) {
        bits.push(`avoid anything like: ${taste.disliked.join(", ")}`);
      }
      if (bits.length > 0) {
        tasteLine = `This viewer (${bits.join("; ")}). Weight picks toward their taste while honoring the feeling. `;
      }
    } catch {
      // Guests / failures: generic picks
    }

    // Load-more: caller passes titles already on screen
    const exclude = (args.excludeTitles ?? []).filter(
      (s) => typeof s === "string" && s.trim().length > 0
    ).slice(0, 40);
    const excludeLine =
      exclude.length > 0
        ? `Do NOT include any of these (already shown): ${exclude.join("; ")}. `
        : "";
    // Arabic UI → Arabic overviews + Arabic reason line
    const tmdbLang = args.lang === "ar" ? "ar-SA" : "en-US";
    const reasonLang = args.lang === "ar" ? "Write the reason in Arabic." : "";

    // Exact-repeat cache (case-insensitive, per kind + language).
    // Load-more queries bypass AND skip the cache (partial top-ups must
    // never poison the full-result entry).
    const key = `${kind}:${tmdbLang}:${query.toLowerCase()}`;
    const cached =
      exclude.length === 0
        ? await ctx.runQuery(internal.aiRecommend.getCached, { text: key })
        : null;
    if (cached) {
      return { movies: cached.movies, reason: cached.reason ?? null, cached: true };
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("AI not configured");
    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) throw new Error("Movie database not configured");
    const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

    const prompt =
      `Recommend ${kindNoun} for someone's current feeling. The person says: "${query}"\n\n` +
      tasteLine +
      excludeLine +
      `Name 20 REAL, well-known ${kindNounLower} that fit, split into two different lists of 10: ` +
      `"movies" (the 10 best fits) and "more_movies" (10 MORE, all different, mix eras and styles, no repeats). ` +
      `For TV mode name series by their exact series title. ` +
      `If they name an actor, director, or character owner (e.g. "DiCaprio", "Nolan films", "more like Dune"), ` +
      `put that person's name in "person" — otherwise null. ` +
      `${reasonLang} ` +
      `Output ONLY a JSON object and absolutely nothing else — no preamble, no markdown, no explanation: ` +
      `{"movies": [{"title": "<exact film title>", "year": <release year>}], ` +
      `"more_movies": [{"title": "<exact film title>", "year": <release year>}], ` +
      `"person": "<name or null>", ` +
      `"reason": "<one short friendly line explaining the picks>"}`;

    const generationConfig = {
      responseMimeType: "application/json",
      maxOutputTokens: 2000,
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

    const picks = [
      ...(Array.isArray(parsed.movies) ? parsed.movies : []),
      ...(Array.isArray(parsed.more_movies) ? parsed.more_movies : []),
    ].slice(0, 20);
    const movies = [];
    const seenIds = new Set();

    const pushHit = (hit) => {
      if (hit && !seenIds.has(hit.id) && movies.length < 20) {
        seenIds.add(hit.id);
        movies.push({
          id: hit.id,
          kind,
          title: hit.title ?? hit.name,
          poster_path: hit.poster_path ?? undefined,
          release_date: hit.release_date ?? hit.first_air_date ?? undefined,
          vote_average: hit.vote_average ?? undefined,
          overview: hit.overview ?? undefined,
          genre_ids: hit.genre_ids ?? [],
        });
      }
    };

    // Person-led half: top films starring/directed by the named person
    let personName = null;
    if (typeof parsed.person === "string" && parsed.person.trim().length > 1) {
      try {
          const url = new URL(`${TMDB_BASE}/search/person`);
          url.searchParams.set("api_key", tmdbKey);
          url.searchParams.set("language", tmdbLang);
          url.searchParams.set("query", parsed.person.trim());
        const pres = await fetch(url);
        if (pres.ok) {
          const pdata = await pres.json();
          const person = (pdata.results ?? [])[0];
          if (person) {
            personName = person.name;
            if (kind === "tv") {
              // discover/tv ignores with_cast — use the person's TV credits.
              // Skip talk/news/reality guest spots (they top popularity charts).
              const NON_SCRIPTED = new Set([10763, 10764, 10766, 10767]);
              const curl = new URL(`${TMDB_BASE}/person/${person.id}/tv_credits`);
              curl.searchParams.set("api_key", tmdbKey);
              curl.searchParams.set("language", tmdbLang);
              const cres = await fetch(curl);
              if (cres.ok) {
                const cdata = await cres.json();
                const cast = (cdata.cast ?? [])
                  .filter((m) => m.poster_path)
                  .filter(
                    (m) => !(m.genre_ids ?? []).some((g) => NON_SCRIPTED.has(g))
                  )
                  .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
                for (const m of cast) {
                  if (movies.length < 6) pushHit(m);
                  else break;
                }
              }
            } else {
              const durl = new URL(`${TMDB_BASE}/discover/movie`);
              durl.searchParams.set("api_key", tmdbKey);
              durl.searchParams.set("language", tmdbLang);
              durl.searchParams.set("with_cast", String(person.id));
              durl.searchParams.set("sort_by", "popularity.desc");
              durl.searchParams.set("vote_count.gte", "50");
              const dres = await fetch(durl);
              if (dres.ok) {
                const ddata = await dres.json();
                for (const m of ddata.results ?? []) {
                  if (m.poster_path && movies.length < 6) pushHit(m);
                }
              }
            }
          }
        }
      } catch {
        // Person lookup is best-effort — AI title picks still stand
      }
    }

    for (const pick of picks) {
      if (!pick?.title || movies.length >= 20) continue;
      try {
        const hit = await tmdbSearch(tmdbKey, pick.title, pick.year, tmdbLang, kind);
        pushHit(hit);
      } catch {
        // Skip unresolvable titles — never fail the whole batch for one miss
      }
    }

    // Second wave: single replies top out around ~12 titles, so explicitly
    // ask for more excluding what we already have (best-effort top-up)
    if (movies.length > 0 && movies.length < 18) {
      const have = movies.map((m) => `"${m.title}"`).join(", ");
      try {
        const res2 = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": geminiKey },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text:
                        `More movies like these, but all DIFFERENT — none of: ${have}. ` +
                        `Feeling was: "${query}". ` +
                        `${reasonLang} ` +
                        `Output ONLY a JSON object and nothing else: ` +
                        `{"movies": [{"title": "<exact film title>", "year": <release year>}], ` +
                        `"more_movies": [], "person": null, "reason": ""}`,
                    },
                  ],
                },
              ],
              generationConfig,
            }),
          }
        );
        if (res2.ok) {
          const data2 = await res2.json();
          const parts2 = data2.candidates?.[0]?.content?.parts ?? [];
          const raw2 = parts2.map((p) => p.text ?? "").join("\n");
          const t2 = raw2.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
          const s2 = t2.indexOf("{");
          const e2 = t2.lastIndexOf("}");
          if (s2 !== -1 && e2 !== -1) {
            const parsed2 = JSON.parse(t2.slice(s2, e2 + 1));
            const extra = [
              ...(Array.isArray(parsed2.movies) ? parsed2.movies : []),
              ...(Array.isArray(parsed2.more_movies) ? parsed2.more_movies : []),
            ];
            for (const pick of extra) {
              if (!pick?.title || movies.length >= 20) break;
              try {
                pushHit(await tmdbSearch(tmdbKey, pick.title, pick.year, tmdbLang, kind));
              } catch {
                // skip misses
              }
            }
          }
        }
      } catch {
        // First wave stands on its own
      }
    }
    if (movies.length === 0) {
      throw new Error("Couldn't match those to real films — rephrase and try again");
    }

    const reason =
      typeof parsed.reason === "string" && parsed.reason.length > 0
        ? parsed.reason
        : "Picked for exactly that feeling.";

    if (exclude.length === 0) {
      await ctx.runMutation(internal.aiRecommend.storeCached, {
        text: key,
        movies,
        reason,
      });
    }

    return { movies, reason, cached: false, person: personName };
  },
});

// Taste summary for prompt personalization: top genres from hearts,
// watchlists and high ratings; loved/disliked titles from ratings.
export const userTaste = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { genres: [], loved: [], disliked: [] };
    const [favs, watch, ratings] = await Promise.all([
      ctx.db
        .query("favorites")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .collect(),
      ctx.db
        .query("watchlist")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .collect(),
      ctx.db
        .query("ratings")
        .withIndex("by_user", (q) => q.eq("userId", identity.subject))
        .collect(),
    ]);
    const weights = {};
    const bump = (ids, w) => {
      for (const g of ids ?? []) weights[g] = (weights[g] ?? 0) + w;
    };
    for (const f of favs) bump(f.genre_ids, 2);
    for (const f of watch) bump(f.genre_ids, 1.5);
    for (const r of ratings) {
      if (r.rating >= 4) bump(r.genre_ids, 2.5);
      else if (r.rating <= 2) bump(r.genre_ids, -1.5);
    }
    const genres = Object.entries(weights)
      .filter(([, w]) => w > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([gid]) => GENRE_NAMES[gid] ?? gid);
    const loved = ratings
      .filter((r) => r.rating >= 4)
      .slice(-5)
      .map((r) => r.title);
    const disliked = ratings
      .filter((r) => r.rating <= 2)
      .slice(-5)
      .map((r) => r.title);
    return { genres, loved, disliked };
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
