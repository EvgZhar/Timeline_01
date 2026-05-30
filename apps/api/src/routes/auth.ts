import { randomBytes, createHash } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { and, eq, gt } from "drizzle-orm";
import {
  registerSchema,
  loginSchema,
  authSettingsSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "@timeline/shared";
import { db } from "../db/index.js";
import {
  sysUserTable,
  sysDataAreaTable,
  sysUserDataArea,
  sysUserSettingsTable,
  sysRefreshTokenTable,
} from "../db/schema.js";
import { passwordService } from "../services/auth/password.js";
import { jwtService } from "../services/auth/jwt.js";
import { emailService } from "../services/auth/email.js";
import { authenticate } from "../middleware/authenticate.js";
import { logAudit } from "../services/auditLog.js";

export const authRouter = Router();

const ACCESS_COOKIE_MAX_AGE = 15 * 60 * 1000; // 15 minutes
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days
const IS_DEV = process.env.NODE_ENV !== "production";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов, попробуйте позже" },
});

const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Слишком много запросов, попробуйте позже" },
});

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function setAuthCookies(
  res: import("express").Response,
  accessToken: string,
  refreshToken: string,
) {
  res.cookie("accessToken", accessToken, {
    httpOnly: true,
    secure: !IS_DEV,
    sameSite: "strict",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: !IS_DEV,
    sameSite: "strict",
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearAuthCookies(res: import("express").Response) {
  res.clearCookie("accessToken", { httpOnly: true, secure: !IS_DEV, sameSite: "strict" });
  res.clearCookie("refreshToken", { httpOnly: true, secure: !IS_DEV, sameSite: "strict" });
}

async function createRefreshToken(userId: number, token: string, req: import("express").Request): Promise<void> {
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_COOKIE_MAX_AGE);
  await db.insert(sysRefreshTokenTable).values({
    userId,
    tokenHash,
    expiresAt,
    ipAddress: req.ip || null,
    userAgent: req.headers["user-agent"] || null,
  });
}

async function rotateRefreshToken(
  oldTokenHash: string,
  userId: number,
  newToken: string,
  req: import("express").Request,
): Promise<void> {
  const tokenHash = hashToken(newToken);
  const expiresAt = new Date(Date.now() + REFRESH_COOKIE_MAX_AGE);
  await db.transaction(async (tx) => {
    await tx
      .update(sysRefreshTokenTable)
      .set({ revokedAt: new Date() })
      .where(eq(sysRefreshTokenTable.tokenHash, oldTokenHash));
    await tx.insert(sysRefreshTokenTable).values({
      userId,
      tokenHash,
      expiresAt,
      ipAddress: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    });
  });
}

async function revokeRefreshToken(tokenHash: string): Promise<void> {
  await db
    .update(sysRefreshTokenTable)
    .set({ revokedAt: new Date() })
    .where(eq(sysRefreshTokenTable.tokenHash, tokenHash));
}

async function buildUserResponse(userId: number) {
  const [user] = await db
    .select()
    .from(sysUserTable)
    .where(eq(sysUserTable.id, userId))
    .limit(1);
  if (!user) return null;
  const [settings] = await db
    .select()
    .from(sysUserSettingsTable)
    .where(eq(sysUserSettingsTable.userId, userId))
    .limit(1);
  const currentDataAreaId = settings?.currentDataAreaId ?? user.defaultDataAreaId;
  return {
    user: {
      id: user.id,
      login: user.login,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      emailConfirmed: user.emailConfirmed,
      defaultDataAreaId: user.defaultDataAreaId,
      createdAt: user.createdAt,
    },
    currentDataAreaId,
  };
}

// POST /auth/register
authRouter.post("/register", loginLimiter, async (req, res, next) => {
  try {
    const body = registerSchema.parse(req.body);

    const [existing] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.login, body.login))
      .limit(1);
    if (existing) {
      res.status(409).json({ error: "Логин уже занят" });
      return;
    }

    const [emailExisting] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.email, body.email))
      .limit(1);
    if (emailExisting) {
      res.status(409).json({ error: "Email уже используется" });
      return;
    }

    const [personalArea] = await db
      .insert(sysDataAreaTable)
      .values({
        name: `user-${body.login}-personal`,
        description: `Личная область пользователя ${body.login}`,
        isPersonal: true,
      })
      .returning();

    const passwordHash = await passwordService.hash(body.password);
    const confirmToken = generateToken();
    const confirmTokenHash = hashToken(confirmToken);
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const [user] = await db
      .insert(sysUserTable)
      .values({
        login: body.login,
        email: body.email,
        passwordHash,
        firstName: body.firstName,
        lastName: body.lastName,
        defaultDataAreaId: personalArea.id,
        emailConfirmed: false,
        emailConfirmationTokenHash: confirmTokenHash,
        emailTokenExpiresAt: tokenExpiresAt,
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

    emailService.sendVerificationEmail(body.email, confirmToken).catch(console.error);

    const accessToken = await jwtService.sign({ userId: user.id, login: user.login }, "access");
    const refreshToken = await jwtService.sign({ userId: user.id, login: user.login }, "refresh");
    await createRefreshToken(user.id, refreshToken, req);

    setAuthCookies(res, accessToken, refreshToken);
    await logAudit(user.id, "register", req);

    res.status(201).json({
      user: {
        id: user.id,
        login: user.login,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isActive: user.isActive,
        emailConfirmed: user.emailConfirmed,
        defaultDataAreaId: user.defaultDataAreaId,
        createdAt: user.createdAt,
      },
      currentDataAreaId: personalArea.id,
    });
  } catch (e) {
    next(e);
  }
});

// POST /auth/login
authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.login, body.login))
      .limit(1);

    if (!user || !(await passwordService.verify(body.password, user.passwordHash))) {
      await logAudit(user?.id ?? null, "login_fail", req, { reason: "invalid_credentials", login: body.login });
      res.status(401).json({ error: "Неверный логин или пароль" });
      return;
    }

    if (!user.isActive) {
      await logAudit(user.id, "login_fail", req, { reason: "user_blocked" });
      res.status(403).json({ error: "Пользователь заблокирован" });
      return;
    }

    const accessToken = await jwtService.sign({ userId: user.id, login: user.login }, "access");
    const refreshToken = await jwtService.sign({ userId: user.id, login: user.login }, "refresh");
    await createRefreshToken(user.id, refreshToken, req);

    setAuthCookies(res, accessToken, refreshToken);
    await logAudit(user.id, "login_success", req);

    const response = await buildUserResponse(user.id);
    res.json(response);
  } catch (e) {
    next(e);
  }
});

// POST /auth/logout
authRouter.post("/logout", async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (refreshToken) {
      const payload = await jwtService.verify(refreshToken, "refresh");
      if (payload) {
        const tokenHash = hashToken(refreshToken);
        await revokeRefreshToken(tokenHash);
        await logAudit(payload.userId, "logout", req);
      }
    }
    clearAuthCookies(res);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /auth/refresh
authRouter.post("/refresh", refreshLimiter, async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) {
      res.status(401).json({ error: "Требуется авторизация" });
      return;
    }

    const payload = await jwtService.verify(refreshToken, "refresh");
    if (!payload) {
      clearAuthCookies(res);
      res.status(401).json({ error: "Недействительный токен" });
      return;
    }

    const tokenHash = hashToken(refreshToken);
    const [stored] = await db
      .select()
      .from(sysRefreshTokenTable)
      .where(
        and(
          eq(sysRefreshTokenTable.tokenHash, tokenHash),
          eq(sysRefreshTokenTable.userId, payload.userId),
          gt(sysRefreshTokenTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored || stored.revokedAt) {
      clearAuthCookies(res);
      res.status(401).json({ error: "Недействительный токен" });
      return;
    }

    const newAccessToken = await jwtService.sign(
      { userId: payload.userId, login: payload.login },
      "access",
    );
    const newRefreshToken = await jwtService.sign(
      { userId: payload.userId, login: payload.login },
      "refresh",
    );
    await rotateRefreshToken(tokenHash, payload.userId, newRefreshToken, req);

    setAuthCookies(res, newAccessToken, newRefreshToken);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /auth/verify-email
authRouter.post("/verify-email", async (req, res, next) => {
  try {
    const body = verifyEmailSchema.parse(req.body);
    const tokenHash = hashToken(body.token);

    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.emailConfirmationTokenHash, tokenHash))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "Недействительный токен" });
      return;
    }

    if (user.emailTokenExpiresAt && new Date() > user.emailTokenExpiresAt) {
      res.status(400).json({ error: "Срок действия токена истёк" });
      return;
    }

    await db
      .update(sysUserTable)
      .set({
        emailConfirmed: true,
        emailConfirmationTokenHash: null,
        emailTokenExpiresAt: null,
      })
      .where(eq(sysUserTable.id, user.id));

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /auth/resend-verification
authRouter.post("/resend-verification", async (req, res, next) => {
  try {
    const body = resendVerificationSchema.parse(req.body);

    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.email, body.email))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }

    if (user.emailConfirmed) {
      res.status(400).json({ error: "Email уже подтверждён" });
      return;
    }

    const confirmToken = generateToken();
    const confirmTokenHash = hashToken(confirmToken);
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db
      .update(sysUserTable)
      .set({
        emailConfirmationTokenHash: confirmTokenHash,
        emailTokenExpiresAt: tokenExpiresAt,
      })
      .where(eq(sysUserTable.id, user.id));

    emailService.sendVerificationEmail(user.email, confirmToken).catch(console.error);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /auth/forgot-password
authRouter.post("/forgot-password", async (req, res, next) => {
  try {
    const body = forgotPasswordSchema.parse(req.body);

    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.email, body.email))
      .limit(1);

    if (!user) {
      res.json({ ok: true });
      return;
    }

    const resetToken = generateToken();
    const resetTokenHash = hashToken(resetToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db
      .update(sysUserTable)
      .set({
        passwordResetTokenHash: resetTokenHash,
        passwordResetExpiresAt: expiresAt,
      })
      .where(eq(sysUserTable.id, user.id));

    emailService.sendPasswordResetEmail(user.email, resetToken).catch(console.error);

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// POST /auth/reset-password
authRouter.post("/reset-password", async (req, res, next) => {
  try {
    const body = resetPasswordSchema.parse(req.body);
    const tokenHash = hashToken(body.token);

    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.passwordResetTokenHash, tokenHash))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "Недействительный токен" });
      return;
    }

    if (user.passwordResetExpiresAt && new Date() > user.passwordResetExpiresAt) {
      res.status(400).json({ error: "Срок действия токена истёк" });
      return;
    }

    const passwordHash = await passwordService.hash(body.password);

    await db
      .update(sysUserTable)
      .set({
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
      })
      .where(eq(sysUserTable.id, user.id));

    // Revoke all refresh tokens for this user after password reset
    await db
      .update(sysRefreshTokenTable)
      .set({ revokedAt: new Date() })
      .where(eq(sysRefreshTokenTable.userId, user.id));

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// GET /auth/me
authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const response = await buildUserResponse(req.user!.userId);
    if (!response) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }
    res.json(response.user);
  } catch (e) {
    next(e);
  }
});

// GET /auth/settings
authRouter.get("/settings", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;

    const [settings] = await db
      .select()
      .from(sysUserSettingsTable)
      .where(eq(sysUserSettingsTable.userId, userId))
      .limit(1);

    const permissions = await db
      .select({
        dataAreaId: sysUserDataArea.dataAreaId,
        name: sysDataAreaTable.name,
      })
      .from(sysUserDataArea)
      .innerJoin(sysDataAreaTable, eq(sysUserDataArea.dataAreaId, sysDataAreaTable.id))
      .where(
        and(eq(sysUserDataArea.userId, userId), eq(sysUserDataArea.canCreate, true)),
      );

    let currentDataAreaId = settings?.currentDataAreaId ?? null;

    if (permissions.length > 0 && (!currentDataAreaId || !permissions.some((p) => p.dataAreaId === currentDataAreaId))) {
      currentDataAreaId = permissions[0].dataAreaId;
      if (settings) {
        await db
          .update(sysUserSettingsTable)
          .set({ currentDataAreaId })
          .where(eq(sysUserSettingsTable.userId, userId));
      }
    }

    res.json({
      currentDataAreaId,
      availableAreas: permissions.map((p) => ({
        id: p.dataAreaId,
        name: p.name,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// PUT /auth/settings
authRouter.put("/settings", authenticate, async (req, res, next) => {
  try {
    const userId = req.user!.userId;
    const body = authSettingsSchema.parse(req.body);

    const [perm] = await db
      .select()
      .from(sysUserDataArea)
      .where(
        and(
          eq(sysUserDataArea.userId, userId),
          eq(sysUserDataArea.dataAreaId, body.currentDataAreaId),
          eq(sysUserDataArea.canCreate, true),
        ),
      )
      .limit(1);
    if (!perm) {
      res.status(403).json({ error: "Нет права на создание в указанной области" });
      return;
    }

    const [existing] = await db
      .select()
      .from(sysUserSettingsTable)
      .where(eq(sysUserSettingsTable.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(sysUserSettingsTable)
        .set({ currentDataAreaId: body.currentDataAreaId })
        .where(eq(sysUserSettingsTable.userId, userId));
    } else {
      await db
        .insert(sysUserSettingsTable)
        .values({ userId, currentDataAreaId: body.currentDataAreaId });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
