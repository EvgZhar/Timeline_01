import { randomBytes } from "node:crypto";
import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  sysExternalLoginTable,
  sysUserTable,
  sysDataAreaTable,
  sysUserDataArea,
  sysUserSettingsTable,
} from "../db/schema.js";
import { jwtService } from "../services/auth/jwt.js";
import { oauthProviders } from "../services/auth/oauth/index.js";
import { passwordService } from "../services/auth/password.js";

export const oauthRouter = Router();

// In-memory store for temporary OAuth codes (short-lived)
const tempCodeStore = new Map<string, { jwt: string; expiresAt: number }>();

function generateTempCode(jwt: string): string {
  const code = randomBytes(16).toString("hex");
  tempCodeStore.set(code, { jwt, expiresAt: Date.now() + 60_000 }); // 1 minute
  return code;
}

// Clean expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [code, data] of tempCodeStore) {
    if (now > data.expiresAt) tempCodeStore.delete(code);
  }
}, 300_000);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// GET /auth/oauth/:provider — redirect to OAuth provider
oauthRouter.get("/oauth/:provider", (req, res) => {
  const provider = oauthProviders[req.params.provider];
  if (!provider) {
    res.status(404).json({ error: "Провайдер не найден" });
    return;
  }

  const state = randomBytes(16).toString("hex");
  const authUrl = provider.getAuthUrl(state);
  res.redirect(authUrl);
});

// GET /auth/oauth/:provider/callback — OAuth provider redirects here after user authorizes
oauthRouter.get("/oauth/:provider/callback", async (req, res, next) => {
  try {
    const provider = oauthProviders[req.params.provider];
    if (!provider) {
      res.status(404).json({ error: "Провайдер не найден" });
      return;
    }

    const { code, state } = req.query as { code?: string; state?: string };

    if (!code) {
      res.status(400).json({ error: "Отсутствует код авторизации" });
      return;
    }

    // Exchange code for access token
    const accessToken = await provider.exchangeCode(code);

    // Get user info from provider
    const userInfo = await provider.getUserInfo(accessToken);

    // Check if external login exists
    const [existingExternal] = await db
      .select()
      .from(sysExternalLoginTable)
      .where(
        and(
          eq(sysExternalLoginTable.provider, userInfo.provider),
          eq(sysExternalLoginTable.providerId, userInfo.providerId),
        ),
      )
      .limit(1);

    let userId: number;

    if (existingExternal) {
      userId = existingExternal.userId;
    } else {
      // Try to find user by email
      let [user] = await db
        .select()
        .from(sysUserTable)
        .where(eq(sysUserTable.email, userInfo.email))
        .limit(1);

      if (user) {
        userId = user.id;
      } else {
        // Create new user
        const loginBase = userInfo.email.split("@")[0] || `user-${userInfo.providerId.slice(0, 8)}`;
        let login = loginBase;
        let suffix = 1;
        while (true) {
          const [existing] = await db
            .select()
            .from(sysUserTable)
            .where(eq(sysUserTable.login, login))
            .limit(1);
          if (!existing) break;
          login = `${loginBase}${suffix}`;
          suffix++;
        }

        const [personalArea] = await db
          .insert(sysDataAreaTable)
          .values({
            name: `user-${login}-personal`,
            description: `Личная область пользователя ${login}`,
            isPersonal: true,
          })
          .returning();

        const randomPassword = passwordService.hash(randomBytes(32).toString("hex"));

        [user] = await db
          .insert(sysUserTable)
          .values({
            login,
            email: userInfo.email,
            passwordHash: randomPassword,
            firstName: userInfo.firstName || null,
            lastName: userInfo.lastName || null,
            defaultDataAreaId: personalArea.id,
            emailConfirmed: true,
          })
          .returning();

        await db.insert(sysUserDataArea).values({
          userId: user.id,
          dataAreaId: personalArea.id,
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
        });

        await db.insert(sysUserSettingsTable).values({
          userId: user.id,
          currentDataAreaId: personalArea.id,
        });

        userId = user.id;
      }

      // Link external account
      await db.insert(sysExternalLoginTable).values({
        userId,
        provider: userInfo.provider,
        providerId: userInfo.providerId,
      });
    }

    // Generate JWT
    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      res.redirect(`${FRONTEND_URL}/login?error=blocked`);
      return;
    }

    const token = jwtService.sign({ userId: user.id, login: user.login });
    const tempCode = generateTempCode(token);

    // Redirect to frontend with temp code
    res.redirect(`${FRONTEND_URL}/auth/callback?code=${encodeURIComponent(tempCode)}`);
  } catch (e) {
    next(e);
  }
});

// POST /auth/exchange-oauth-code — exchange temp code for JWT
oauthRouter.post("/exchange-oauth-code", (req, res) => {
  const { code } = req.body as { code?: string };
  if (!code) {
    res.status(400).json({ error: "Отсутствует код" });
    return;
  }

  const data = tempCodeStore.get(code);
  if (!data || Date.now() > data.expiresAt) {
    tempCodeStore.delete(code);
    res.status(400).json({ error: "Недействительный или истёкший код" });
    return;
  }

  tempCodeStore.delete(code);

  // Decode JWT to get user info for the response
  const payload = jwtService.verify(data.jwt);
  if (!payload) {
    res.status(401).json({ error: "Недействительный токен" });
    return;
  }

  res.json({ token: data.jwt, userId: payload.userId, login: payload.login });
});
