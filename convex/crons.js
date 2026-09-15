import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Fresh picks for every mood, shortly after midnight UTC.
crons.daily(
  "fetch daily movie snapshots",
  { hourUTC: 0, minuteUTC: 5 },
  internal.snapshots.fetchAndStore
);

export default crons;
