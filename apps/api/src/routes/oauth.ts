import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  sysExternalLoginTable,
  sysUserTable,
  sysDataAreaTable,
  sysUserDataArea,
  sysUserSettingsTable,
  sysRefreshTokenTable,
} from "../db/schema.js";
import { jwtService } from "../services/auth/jwt.js";
import { oauthProviders } from "../services/auth/oauth/index.js";
import { passwordService } from "../services/auth/password.js";
import { logAudit } from "../services/auditLog.js";

export const oauthRouter = Router();

const tempCodeStore = new Map<string, { jwt: string; expiresAt: number }>();

function generateTempCode(jwt: string): string {
  const code = randomBytes(16).toString("hex");
  tempCodeStore.set(code, { jwt, expiresAt: Date.now() + 60_000 });
  return code;
}

setInterval(() => {
  const now = Date.now();
  for (const [code, data] of tempCodeStore) {
    if (now > data.expiresAt) tempCodeStore.delete(code);
  }
}, 300_000);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const IS_DEV = process.env.NODE_ENV !== "production";

function setAuthCookies(
  res: import("express").Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: !IS_DEV,
    sameSite: "strict",
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: !IS_DEV,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// GET /auth/oauth/:provider
oauthRouter.get("/oauth/:provider", (req, res) => {
  const provider = oauthProviders[req.params.provider];
  if (!provider) {
    res.status(404).json({ error: "Провайдер не найден" });
    return;
  }

  const state = randomBytes(32).toString("hex");
  res.cookie("oauth_state", state, {
    httpOnly: true,
    secure: !IS_DEV,
    sameSite: "lax",
    maxAge: 10 * 60 * 1000, // 10 minutes
  });

  const authUrl = provider.getAuthUrl(state);
  res.redirect(authUrl);
});

// GET /auth/oauth/:provider/callback
oauthRouter.get("/oauth/:provider/callback", async (req, res, next) => {
  try {
    const provider = oauthProviders[req.params.provider];
    if (!provider) {
      res.status(404).json({ error: "Провайдер не найден" });
      return;
    }

    const { code, state } = req.query as { code?: string; state?: string };
    const storedState = req.cookies?.oauth_state as string | undefined;

    if (!code) {
      res.status(400).json({ error: "Отсутствует код авторизации" });
      return;
    }

    if (!storedState || storedState !== state) {
      res.status(403).json({ error: "Недействительный state" });
      return;
    }

    res.clearCookie("oauth_state", { httpOnly: true, secure: !IS_DEV, sameSite: "lax" });

    const accessToken = await provider.exchangeCode(code);
    const userInfo = await provider.getUserInfo(accessToken);

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
      let [user] = await db
        .select()
        .from(sysUserTable)
        .where(eq(sysUserTable.email, userInfo.email))
        .limit(1);

      if (user) {
        userId = user.id;
      } else {
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

        const randomPassword = await passwordService.hash(randomBytes(32).toString("hex"));

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

      await db.insert(sysExternalLoginTable).values({
        userId,
        provider: userInfo.provider,
        providerId: userInfo.providerId,
      });
    }

    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.id, userId))
      .limit(1);

    if (!user || !user.isActive) {
      res.redirect(`${FRONTEND_URL}/login?error=blocked`);
      return;
    }

    const accessJwt = await jwtService.sign({ userId: user.id, login: user.login }, "access");
    const refreshJwt = await jwtService.sign({ userId: user.id, login: user.login }, "refresh");

    const tokenHash = createHash("sha256").update(refreshJwt).digest("hex");
    await db.insert(sysRefreshTokenTable).values({
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    });

    setAuthCookies(res, accessJwt, refreshJwt);
    await logAudit(user.id, "oauth_login", req, { provider: userInfo.provider });

    const tempCode = generateTempCode(accessJwt);
    res.redirect(`${FRONTEND_URL}/auth/callback?code=${encodeURIComponent(tempCode)}`);
  } catch (e) {
    next(e);
  }
});

const oauthExchangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов, попробуйте позже" },
});

// POST /auth/exchange-oauth-code
oauthRouter.post("/exchange-oauth-code", oauthExchangeLimiter, async (req, res) => {
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

  const payload = await jwtService.verify(data.jwt, "access");
  if (!payload) {
    res.status(401).json({ error: "Недействительный токен" });
    return;
  }

  res.json({ ok: true, userId: payload.userId, login: payload.login });
});
