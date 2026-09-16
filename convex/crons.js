import { cronJobs } from "convex/server";

const crons = cronJobs();

// No scheduled jobs: picks are generated on demand by the aiRecommend
// action (cached per exact search text in aiCache).

export default crons;
