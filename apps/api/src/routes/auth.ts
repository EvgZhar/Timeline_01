import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { registerSchema, loginSchema, authSettingsSchema } from "@timeline/shared";
import { db } from "../db/index.js";
import {
  sysUserTable,
  sysDataAreaTable,
  sysUserDataArea,
  sysUserSettingsTable,
} from "../db/schema.js";
import { passwordService } from "../services/auth/password.js";
import { jwtService } from "../services/auth/jwt.js";
import { authenticate } from "../middleware/authenticate.js";

export const authRouter = Router();

// POST /auth/register
authRouter.post("/register", async (req, res, next) => {
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

    // Create personal DataArea
    const [personalArea] = await db
      .insert(sysDataAreaTable)
      .values({
        name: `user-${body.login}-personal`,
        description: `Личная область пользователя ${body.login}`,
        isPersonal: true,
      })
      .returning();

    // Create user
    const passwordHash = passwordService.hash(body.password);
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
      })
      .returning();

    // Full CRUD rights on personal DataArea
    await db.insert(sysUserDataArea).values({
      userId: user.id,
      dataAreaId: personalArea.id,
      canCreate: true,
      canRead: true,
      canUpdate: true,
      canDelete: true,
    });

    // Settings: current = personal
    await db.insert(sysUserSettingsTable).values({
      userId: user.id,
      currentDataAreaId: personalArea.id,
    });

    const token = jwtService.sign({ userId: user.id, login: user.login });

    res.status(201).json({
      token,
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
authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginSchema.parse(req.body);

    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.login, body.login))
      .limit(1);

    if (!user || !passwordService.verify(body.password, user.passwordHash)) {
      res.status(401).json({ error: "Неверный логин или пароль" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Пользователь заблокирован" });
      return;
    }

    // Get current DataArea from settings or default
    const [settings] = await db
      .select()
      .from(sysUserSettingsTable)
      .where(eq(sysUserSettingsTable.userId, user.id))
      .limit(1);

    const currentDataAreaId = settings?.currentDataAreaId ?? user.defaultDataAreaId;

    const token = jwtService.sign({ userId: user.id, login: user.login });

    res.json({
      token,
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
    });
  } catch (e) {
    next(e);
  }
});

// GET /auth/me
authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const [user] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.id, req.user!.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }

    res.json({
      id: user.id,
      login: user.login,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      emailConfirmed: user.emailConfirmed,
      defaultDataAreaId: user.defaultDataAreaId,
      createdAt: user.createdAt,
    });
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

    // Only areas where user has Create permission
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

    // Auto-correct if current area is not creatable or missing
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

    // Verify user has canCreate on this DataArea
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
