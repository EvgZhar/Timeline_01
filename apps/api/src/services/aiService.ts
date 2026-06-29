import { getSettings } from "./settings/settingsService.js";

const YANDEXGPT_API_KEY = process.env.YANDEXGPT_API_KEY ?? "";
const YANDEXGPT_FOLDER_ID = process.env.YANDEXGPT_FOLDER_ID ?? "";
const MODEL_URI = YANDEXGPT_FOLDER_ID
  ? `gpt://${YANDEXGPT_FOLDER_ID}/yandexgpt-5-lite`
  : "yandexgpt-5-lite";

interface AvailableTag {
  id: number;
  name: string;
}

interface AiSummaryOptions {
  startDate?: string;
  endDate?: string;
  notes?: string;
  availableTags?: AvailableTag[];
}

export interface AiSummaryResult {
  text: string;
  startDate?: string;
  endDate?: string;
  tagIds?: number[];
}

export async function generateEventSummary(
  eventName: string,
  options?: AiSummaryOptions,
): Promise<AiSummaryResult> {
  if (!YANDEXGPT_API_KEY) {
    throw new Error("YANDEXGPT_API_KEY не настроен");
  }

  const settings = await getSettings();

  const systemPrompt = typeof settings.AI_SYSTEM_PROMPT === "string"
    ? settings.AI_SYSTEM_PROMPT
    : "Ты — исторический ассистент. Напиши краткую справку о событии. Используй Markdown-разметку. Ответ должен быть на русском языке.";

  const userTemplate = typeof settings.AI_USER_PROMPT_TEMPLATE === "string"
    ? settings.AI_USER_PROMPT_TEMPLATE
    : 'Напиши краткую историческую справку о событии "{eventName}".';

  const tagList = options?.availableTags?.length
    ? options.availableTags.map((t) => t.name).join(", ")
    : "нет доступных тегов";

  const userPrompt = userTemplate
    .replace("{eventName}", eventName)
    .replace("{startDate}", options?.startDate ?? "не указана")
    .replace("{endDate}", options?.endDate ?? "не указана")
    .replace("{notes}", options?.notes?.trim() ? options.notes : "не указано")
    .replace("{availableTags}", tagList);

  const body = {
    model: MODEL_URI,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  };

  const res = await fetch("https://ai.api.cloud.yandex.net/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Api-Key ${YANDEXGPT_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`YandexGPT API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    choices: { message: { content: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content ?? "";

  const parsed = tryParseJson(raw);
  if (!parsed) {
    return { text: raw };
  }

  let tagIds: number[] | undefined;
  if (Array.isArray(parsed.tags) && options?.availableTags?.length) {
    const tagMap = new Map(options.availableTags.map((t) => [t.name.toLowerCase(), t.id]));
    tagIds = parsed.tags
      .map((name: unknown) => (typeof name === "string" ? tagMap.get(name.toLowerCase()) : undefined))
      .filter((id: number | undefined): id is number => id !== undefined);
    if (tagIds.length === 0) tagIds = undefined;
  }

  return {
    text: typeof parsed.notes === "string" ? parsed.notes : raw,
    startDate: typeof parsed.startDate === "string" ? parsed.startDate : undefined,
    endDate: typeof parsed.endDate === "string" ? parsed.endDate : undefined,
    tagIds,
  };
}

function tryParseJson(raw: string): Record<string, unknown> | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}
