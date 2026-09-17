/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as aiRecommend from "../aiRecommend.js";
import type * as crons from "../crons.js";
import type * as favorites from "../favorites.js";
import type * as preferences from "../preferences.js";
import type * as ratings from "../ratings.js";
import type * as recent from "../recent.js";
import type * as tmdb from "../tmdb.js";
import type * as watchLinks from "../watchLinks.js";
import type * as watched from "../watched.js";
import type * as watchlist from "../watchlist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  aiRecommend: typeof aiRecommend;
  crons: typeof crons;
  favorites: typeof favorites;
  preferences: typeof preferences;
  ratings: typeof ratings;
  recent: typeof recent;
  tmdb: typeof tmdb;
  watchLinks: typeof watchLinks;
  watched: typeof watched;
  watchlist: typeof watchlist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
