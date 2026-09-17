import { action } from "./_generated/server";
import { v } from "convex/values";

// TMDB proxy: the API key lives ONLY here (Convex env). Browsers call
// this action instead of api.themoviedb.org, so the key never ships in
// the JS bundle. Only allowlisted endpoint shapes pass through.
const BASE = "https://api.themoviedb.org/3";

const RULES = [
  /^\/trending\/(movie|tv)\/(day|week)$/,
  /^\/search\/(movie|tv|person)$/,
  /^\/discover\/(movie|tv)$/,
  /^\/movie\/\d+$/,
  /^\/movie\/\d+\/(credits|videos|similar|reviews)$/,
  /^\/movie\/\d+\/watch\/providers$/,
  /^\/tv\/\d+$/,
  /^\/tv\/\d+\/(credits|videos|similar|reviews)$/,
  /^\/tv\/\d+\/watch\/providers$/,
  /^\/person\/\d+\/(movie_credits|tv_credits|combined_credits)$/,
  /^\/genre\/(movie|tv)\/list$/,
];

export const call = action({
  args: { endpoint: v.string(), params: v.optional(v.any()) },
  handler: async (ctx, args) => {
    if (!RULES.some((re) => re.test(args.endpoint))) {
      throw new Error("Blocked endpoint");
    }
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("Movie database not configured");
    const url = new URL(`${BASE}${args.endpoint}`);
    url.searchParams.set("api_key", apiKey);
    const params = args.params ?? {};
    if (typeof params === "object") {
      for (const [k, val] of Object.entries(params)) {
        if (k === "api_key" || k === "key") continue; // never accept keys
        if (val !== undefined && val !== null && val !== "") {
          url.searchParams.set(k, String(val).slice(0, 200));
        }
      }
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return await res.json();
  },
});
