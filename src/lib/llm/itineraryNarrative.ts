export type ItineraryNarrativeDay = {
  day: number;
  title: string;
  summary: string;
  mealIdeas: string[];
};

export type ItineraryNarrative = {
  tripIntro: string;
  days: ItineraryNarrativeDay[];
};

const MODEL = process.env.OPENAI_ITINERARY_MODEL || "gpt-4o-mini";

/**
 * LLM copy only — must not invent places. Skips when OPENAI_API_KEY is unset.
 */
export async function buildItineraryNarrative(input: {
  destinationLabel: string;
  placesByDay: string[][];
  interests?: string[];
}): Promise<ItineraryNarrative | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key?.trim()) return null;

  const { destinationLabel, placesByDay, interests = [] } = input;
  const payload = {
    destination: destinationLabel,
    interests,
    days: placesByDay.map((names, i) => ({
      day: i + 1,
      stopNames: names,
    })),
  };

  const system = `You are a travel editor. Output ONLY valid JSON, no markdown.
Rules:
- Do not add, remove, or rename stops. Use only the stop names given per day.
- tripIntro: 1-2 sentences about the trip theme (no new venue names).
- For each day: title (short), summary (2-3 sentences referring only to given stops), mealIdeas (0-2 strings; generic e.g. "lunch near today's route" is OK — no fabricated restaurant names unless widely generic).
- If unsure, use shorter text or empty mealIdeas array.

Schema:
{"tripIntro":"string","days":[{"day":number,"title":"string","summary":"string","mealIdeas":["string"]}]}`;

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
      }),
    });

    if (!res.ok) {
      console.warn("[itineraryNarrative] OpenAI error", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ItineraryNarrative;
    if (
      typeof parsed?.tripIntro !== "string" ||
      !Array.isArray(parsed.days)
    ) {
      return null;
    }
    return parsed;
  } catch (e) {
    console.warn("[itineraryNarrative]", e);
    return null;
  }
}
