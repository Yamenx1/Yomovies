import { action } from "./_generated/server";
import { v } from "convex/values";

// Server-side mood detection via Gemini. The API key stays in the Convex
// environment (GEMINI_API_KEY) — browsers only ever see { moodId,
// confidence, reason }. Keyword matching in the client remains the fallback.
const MOODS = [
  { id: "cozy", label: "Cozy & comforted", hint: "warm, low-stakes, familiar" },
  { id: "heartbroken", label: "Need a good cry", hint: "cathartic, tender, sad-but-good" },
  { id: "stressed", label: "Overwhelmed", hint: "gentle, undemanding, soothing" },
  { id: "hyped", label: "Wired & restless", hint: "fast, loud, kinetic" },
  { id: "romantic", label: "In the mood for love", hint: "swoony, tender, hopeful" },
  { id: "adventurous", label: "Craving adventure", hint: "big world, high stakes, wonder" },
  { id: "nostalgic", label: "Feeling nostalgic", hint: "warm memory, coming-of-age, older films" },
  { id: "mindbend", label: "Want my mind bent", hint: "twisty, strange, thought-provoking" },
  { id: "angry", label: "Need to let off steam", hint: "sharp, cathartic, a little vicious" },
];

export const detectMood = action({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { moodId: null, error: "AI_MISSING_KEY" };

    const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash";
    const moodList = MOODS.map((m) => `- ${m.id}: ${m.label} (${m.hint})`).join("\n");
    const basePrompt =
      `You classify what kind of movie fits someone's current feeling.\n\n` +
      `Moods:\n${moodList}\n\n` +
      `The user says: "${args.text.slice(0, 500)}"\n\n` +
      `Output ONLY a JSON object and absolutely nothing else — no preamble, ` +
      `no markdown, no explanation, just the object: ` +
      `{"moodId": "<exactly one of the ids above>", "confidence": <0-100>, "reason": "<one short friendly line>"}`;

    // Two attempts: if the first reply isn't parseable JSON, ask once more.
    for (let attempt = 0; attempt < 2; attempt++) {
      const prompt =
        attempt === 0
          ? basePrompt
          : `Your previous reply was not valid JSON. Reply again with ONLY the JSON object, nothing else.\n\n${basePrompt}`;

      let res;
      try {
        res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                maxOutputTokens: 500,
                temperature: 0,
                // Thinking tokens eat the output budget and truncate the
                // JSON — this classification needs no reasoning trace
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          }
        );
      } catch {
        return { moodId: null, error: "AI_NETWORK" };
      }
      if (!res.ok) return { moodId: null, error: `AI_HTTP_${res.status}` };

      let raw = "";
      try {
        const data = await res.json();
        // Join ALL parts: the model often puts preamble in parts[0]
        // and the JSON in a later part
        const parts = data.candidates?.[0]?.content?.parts ?? [];
        raw = parts.map((p) => p.text ?? "").join("\n");
      } catch {
        return { moodId: null, error: "AI_BAD_RESPONSE" };
      }

      let parsed;
      try {
        // Tolerate markdown fences / prose around the JSON object
        let text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");
        if (start === -1 || end === -1) throw new Error("no-json");
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        if (attempt === 1) return { moodId: null, error: "AI_BAD_JSON" };
        continue;
      }
      if (!MOODS.some((m) => m.id === parsed.moodId)) {
        return { moodId: null, error: "AI_UNKNOWN_MOOD" };
      }
      return {
        moodId: parsed.moodId,
        confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
        reason: typeof parsed.reason === "string" ? parsed.reason : null,
      };
    }
    return { moodId: null, error: "AI_BAD_JSON" };
  },
});
