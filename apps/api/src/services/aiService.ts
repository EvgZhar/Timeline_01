import { getSettings } from "./settings/settingsService.js";

const YANDEXGPT_API_KEY = process.env.YANDEXGPT_API_KEY ?? "";
const YANDEXGPT_FOLDER_ID = process.env.YANDEXGPT_FOLDER_ID ?? "";
const MODEL_URI = YANDEXGPT_FOLDER_ID
  ? `gpt://${YANDEXGPT_FOLDER_ID}/yandexgpt-5-lite`
  : "yandexgpt-5-lite";

interface AiResponse {
  text: string;
}

export async function generateEventSummary(eventName: string): Promise<AiResponse> {
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

  const userPrompt = userTemplate.replace("{eventName}", eventName);

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
  const text = data.choices?.[0]?.message?.content ?? "";
  return { text };
}
