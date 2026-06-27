import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { appSettings } from "../../db/schema.js";
import { decrypt, encrypt, hasEncryptionKey } from "./crypto.js";

const SECRET_KEYS = new Set<string>(["SMTP_PASS"]);

const DEFAULTS: Record<string, { value: string; isSecret: boolean }> = {
  DEFAULT_AI_QUOTA: { value: "10", isSecret: false },
  AI_SYSTEM_PROMPT: {
    value: "Ты — исторический ассистент. Напиши краткую справку о событии. Используй Markdown-разметку. Ответ должен быть на русском языке.",
    isSecret: false,
  },
  AI_USER_PROMPT_TEMPLATE: {
    value: 'Напиши краткую историческую справку о событии "{eventName}".',
    isSecret: false,
  },
};

export async function getSettings(): Promise<Record<string, string | { configured: true } | null>> {
  const rows = await db.select().from(appSettings);
  const out: Record<string, string | { configured: true } | null> = {};

  for (const [key, def] of Object.entries(DEFAULTS)) {
    const row = rows.find((r) => r.key === key);
    out[key] = row?.value ?? def.value;
  }

  for (const row of rows) {
    if (DEFAULTS[row.key]) continue;
    if (row.isSecret || SECRET_KEYS.has(row.key)) {
      out[row.key] = row.value ? { configured: true } : null;
    } else {
      out[row.key] = row.value;
    }
  }
  return out;
}

export async function getSecret(key: string): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, key));
  if (!row?.value) return null;
  if (!row.isSecret) return row.value;
  if (!hasEncryptionKey()) return null;
  return decrypt(row.value);
}

export async function putSettings(
  partial: Record<string, string | null>,
): Promise<Record<string, string | { configured: true } | null>> {
  for (const [key, val] of Object.entries(partial)) {
    if (val === null) {
      await db.delete(appSettings).where(eq(appSettings.key, key));
      continue;
    }
    const isSecret = SECRET_KEYS.has(key);
    const stored = isSecret && hasEncryptionKey() ? encrypt(val) : val;
    await db
      .insert(appSettings)
      .values({
        key,
        value: stored,
        isSecret,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: {
          value: stored,
          isSecret,
          updatedAt: new Date(),
        },
      });
  }
  return getSettings();
}


