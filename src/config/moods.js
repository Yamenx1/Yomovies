// ---------------------------------------------------------------------------
// MOODS — Each mood maps to TMDB genre IDs so we can fetch real movies.
//
// HOW THIS WORKS:
// TMDB assigns every movie one or more genre IDs. For example:
//   Action = 28, Comedy = 35, Drama = 18, Romance = 10749, etc.
//
// When a user picks a mood, we use these genre IDs to call the TMDB
// "discover" endpoint, which returns movies matching those genres.
//
// The `genreIds` array uses OR logic — a movie needs ANY of these genres
// to appear in results, giving us more variety.
// ---------------------------------------------------------------------------

export const MOODS = [
  {
    id: 'cozy',
    label: 'Cozy & comforted',
    blurb: 'warm, low-stakes, familiar',
    genreIds: [10751, 35, 16],       // Family, Comedy, Animation
    sortBy: 'vote_average.desc',
    voteCountMin: 200,
  },
  {
    id: 'heartbroken',
    label: 'Need a good cry',
    blurb: 'cathartic, tender, sad-but-good',
    genreIds: [18, 10749],            // Drama, Romance
    sortBy: 'vote_average.desc',
    voteCountMin: 300,
  },
  {
    id: 'stressed',
    label: 'Overwhelmed',
    blurb: 'gentle, undemanding, soothing',
    genreIds: [16, 35, 14],           // Animation, Comedy, Fantasy
    sortBy: 'popularity.desc',
    voteCountMin: 100,
  },
  {
    id: 'hyped',
    label: 'Wired & restless',
    blurb: 'fast, loud, kinetic',
    genreIds: [28, 53],               // Action, Thriller
    sortBy: 'popularity.desc',
    voteCountMin: 200,
  },
  {
    id: 'romantic',
    label: 'In the mood for love',
    blurb: 'swoony, tender, hopeful',
    genreIds: [10749],                // Romance
    sortBy: 'vote_average.desc',
    voteCountMin: 150,
  },
  {
    id: 'adventurous',
    label: 'Craving adventure',
    blurb: 'big world, high stakes, wonder',
    genreIds: [12, 28],               // Adventure, Action
    sortBy: 'popularity.desc',
    voteCountMin: 200,
  },
  {
    id: 'nostalgic',
    label: 'Feeling nostalgic',
    blurb: 'warm memory, coming-of-age',
    genreIds: [18, 10751],            // Drama, Family
    sortBy: 'vote_average.desc',
    voteCountMin: 200,
    releaseDateBefore: '2005-12-31',  // Older movies for nostalgia
  },
  {
    id: 'mindbend',
    label: 'Want my mind bent',
    blurb: 'twisty, strange, thought-provoking',
    genreIds: [878, 9648, 53],        // Sci-Fi, Mystery, Thriller
    sortBy: 'vote_average.desc',
    voteCountMin: 200,
  },
  {
    id: 'angry',
    label: 'Need to let off steam',
    blurb: 'sharp, cathartic, a little vicious',
    genreIds: [28, 80, 53],           // Action, Crime, Thriller
    sortBy: 'popularity.desc',
    voteCountMin: 200,
  },
];

// ---------------------------------------------------------------------------
// KEYWORDS — Maps free-text input to mood IDs.
// When the user types something like "I'm stressed about work", we scan
// for these keywords to auto-detect the matching mood.
// ---------------------------------------------------------------------------

export const KEYWORDS = {
  cozy: ['cozy', 'comfort', 'safe', 'warm', 'calm', 'chill', 'relax'],
  heartbroken: ['sad', 'cry', 'heartbroken', 'breakup', 'grief', 'down', 'blue'],
  stressed: ['stressed', 'overwhelmed', 'anxious', 'tired', 'exhausted', 'burnt out', 'burned out'],
  hyped: ['hyped', 'energy', 'wired', 'pumped', 'restless', 'adrenaline'],
  romantic: ['romantic', 'love', 'date night', 'swoon'],
  adventurous: ['adventure', 'explore', 'escape', 'travel', 'wanderlust'],
  nostalgic: ['nostalgic', 'nostalgia', 'childhood', 'memory', 'throwback'],
  mindbend: ['confused', 'think', 'smart', 'twist', 'mind', 'philosophical', 'weird plot'],
  angry: ['angry', 'mad', 'furious', 'pissed', 'rage', 'frustrated'],
};

/**
 * Scans free-text input and returns the first matching mood ID.
 * Returns null if no keywords match.
 */
export function matchMoodFromText(text) {
  const lower = text.toLowerCase();
  for (const [moodId, words] of Object.entries(KEYWORDS)) {
    if (words.some((w) => lower.includes(w))) return moodId;
  }
  return null;
}
