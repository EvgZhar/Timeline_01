import { Router } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  sysCounterTable,
  sysUserTable,
  sysDataAreaTable,
  sysUserDataArea,
  sysUserSettingsTable,
} from "../db/schema.js";
import { authenticate } from "../middleware/authenticate.js";
import { passwordService } from "../services/auth/password.js";

export const adminRouter = Router();

adminRouter.use(authenticate);

// Check admin role
adminRouter.use(async (req, res, next) => {
  const [user] = await db
    .select()
    .from(sysUserTable)
    .where(eq(sysUserTable.id, req.user!.userId))
    .limit(1);

  if (!user || user.login !== "admin") {
    res.status(403).json({ error: "Требуются права администратора" });
    return;
  }
  next();
});

// GET /admin/users
adminRouter.get("/users", async (_req, res, next) => {
  try {
    const users = await db.select().from(sysUserTable).orderBy(sysUserTable.id);
    res.json(users.map((u) => ({
      id: u.id,
      login: u.login,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      isActive: u.isActive,
      emailConfirmed: u.emailConfirmed,
      defaultDataAreaId: u.defaultDataAreaId,
      createdAt: u.createdAt,
    })));
  } catch (e) {
    next(e);
  }
});

// GET /admin/users/:id/data-areas
adminRouter.get("/users/:id/data-areas", async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const rows = await db
      .select({ dataAreaId: sysUserDataArea.dataAreaId })
      .from(sysUserDataArea)
      .where(eq(sysUserDataArea.userId, userId));
    res.json(rows.map((r) => r.dataAreaId));
  } catch (e) {
    next(e);
  }
});

// PUT /admin/users/:id
adminRouter.put("/users/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { firstName, lastName, email, isActive, password } = req.body;
    const values: Record<string, unknown> = {};
    if (firstName !== undefined) values.firstName = firstName;
    if (lastName !== undefined) values.lastName = lastName;
    if (email !== undefined) values.email = email;
    if (isActive !== undefined) values.isActive = isActive;
    if (password) values.passwordHash = await passwordService.hash(password);

    const [updated] = await db
      .update(sysUserTable)
      .set(values)
      .where(eq(sysUserTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Пользователь не найден" });
      return;
    }
    res.json({
      id: updated.id,
      login: updated.login,
      email: updated.email,
      firstName: updated.firstName,
      lastName: updated.lastName,
      isActive: updated.isActive,
      emailConfirmed: updated.emailConfirmed,
      defaultDataAreaId: updated.defaultDataAreaId,
      createdAt: updated.createdAt,
    });
  } catch (e) {
    next(e);
  }
});

// GET /admin/next-user-code
adminRouter.get("/next-user-code", async (_req, res, next) => {
  try {
    // Ensure counter row exists
    await db
      .insert(sysCounterTable)
      .values({ name: "user_serial", value: 0 })
      .onConflictDoNothing();

    const [counter] = await db
      .select()
      .from(sysCounterTable)
      .where(eq(sysCounterTable.name, "user_serial"))
      .limit(1);

    const nextVal = (counter?.value ?? 0) + 1;
    const code = `U${String(nextVal).padStart(6, "0")}`;
    res.json({ code, nextSerial: nextVal });
  } catch (e) {
    next(e);
  }
});

// POST /admin/users/create
adminRouter.post("/users/create", async (req, res, next) => {
  try {
    const { firstName, lastName, email, password, dataAreaName } = req.body;

    if (!firstName || !lastName || !email || !password) {
      res.status(400).json({ error: "Заполните все обязательные поля" });
      return;
    }

    const [emailExisting] = await db
      .select()
      .from(sysUserTable)
      .where(eq(sysUserTable.email, email))
      .limit(1);
    if (emailExisting) {
      res.status(409).json({ error: "Email уже используется" });
      return;
    }

    // Ensure counter row exists
    await db
      .insert(sysCounterTable)
      .values({ name: "user_serial", value: 0 })
      .onConflictDoNothing();

    // Atomically increment counter
    const [counter] = await db
      .update(sysCounterTable)
      .set({ value: sql`${sysCounterTable.value} + 1` })
      .where(eq(sysCounterTable.name, "user_serial"))
      .returning({ value: sysCounterTable.value });

    const code = `U${String(counter.value).padStart(6, "0")}`;
    const passwordHash = await passwordService.hash(password);

    // Create personal DataArea
    const [personalArea] = await db
      .insert(sysDataAreaTable)
      .values({
        name: `user-${code}-personal`,
        description: `Личная область пользователя ${code}`,
        isPersonal: true,
      })
      .returning();

    // Create user
    const [user] = await db
      .insert(sysUserTable)
      .values({
        login: code,
        email,
        passwordHash,
        firstName,
        lastName,
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

    // Settings
    await db.insert(sysUserSettingsTable).values({
      userId: user.id,
      currentDataAreaId: personalArea.id,
    });

    // If dataAreaName provided, also grant full rights to that area
    if (dataAreaName) {
      let [area] = await db
        .select()
        .from(sysDataAreaTable)
        .where(eq(sysDataAreaTable.name, dataAreaName))
        .limit(1);

      if (!area) {
        [area] = await db
          .insert(sysDataAreaTable)
          .values({ name: dataAreaName })
          .returning();
      }

      await db.insert(sysUserDataArea).values({
        userId: user.id,
        dataAreaId: area.id,
        canCreate: true,
        canRead: true,
        canUpdate: true,
        canDelete: true,
      });
    }

    res.status(201).json({
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

// GET /admin/data-areas
adminRouter.get("/data-areas", async (_req, res, next) => {
  try {
    const areas = await db.select().from(sysDataAreaTable).orderBy(sysDataAreaTable.name);
    res.json(areas);
  } catch (e) {
    next(e);
  }
});

// POST /admin/data-areas
adminRouter.post("/data-areas", async (req, res, next) => {
  try {
    const { name, description } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: "Название обязательно" });
      return;
    }
    const [area] = await db
      .insert(sysDataAreaTable)
      .values({ name: name.trim(), description: description?.trim() || null })
      .returning();
    res.status(201).json(area);
  } catch (e) {
    next(e);
  }
});

// PUT /admin/data-areas/:id
adminRouter.put("/data-areas/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { name, description } = req.body;
    const values: Record<string, unknown> = {};
    if (name !== undefined) values.name = name.trim();
    if (description !== undefined) values.description = description?.trim() || null;

    const [area] = await db
      .update(sysDataAreaTable)
      .set(values)
      .where(eq(sysDataAreaTable.id, id))
      .returning();
    if (!area) {
      res.status(404).json({ error: "Область не найдена" });
      return;
    }
    res.json(area);
  } catch (e) {
    next(e);
  }
});

// DELETE /admin/data-areas/:id
adminRouter.delete("/data-areas/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);

    const [area] = await db
      .select()
      .from(sysDataAreaTable)
      .where(eq(sysDataAreaTable.id, id))
      .limit(1);
    if (!area) {
      res.status(404).json({ error: "Область не найдена" });
      return;
    }
    if (area.isPersonal) {
      res.status(403).json({ error: "Нельзя удалить личную область" });
      return;
    }

    await db.delete(sysDataAreaTable).where(eq(sysDataAreaTable.id, id));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// GET /admin/data-areas/:id/users
adminRouter.get("/data-areas/:id/users", async (req, res, next) => {
  try {
    const dataAreaId = Number(req.params.id);
    const perms = await db
      .select({
        userId: sysUserDataArea.userId,
        dataAreaId: sysUserDataArea.dataAreaId,
        canCreate: sysUserDataArea.canCreate,
        canRead: sysUserDataArea.canRead,
        canUpdate: sysUserDataArea.canUpdate,
        canDelete: sysUserDataArea.canDelete,
        userLogin: sysUserTable.login,
      })
      .from(sysUserDataArea)
      .innerJoin(sysUserTable, eq(sysUserDataArea.userId, sysUserTable.id))
      .where(eq(sysUserDataArea.dataAreaId, dataAreaId));

    res.json(perms);
  } catch (e) {
    next(e);
  }
});

// POST /admin/user-data-area (create/update permission)
adminRouter.post("/user-data-area", async (req, res, next) => {
  try {
    const { userId, dataAreaId, canCreate, canRead, canUpdate, canDelete } = req.body;

    const [existing] = await db
      .select()
      .from(sysUserDataArea)
      .where(and(
        eq(sysUserDataArea.userId, userId),
        eq(sysUserDataArea.dataAreaId, dataAreaId),
      ))
      .limit(1);

    if (existing) {
      await db
        .update(sysUserDataArea)
        .set({ canCreate, canRead, canUpdate, canDelete })
        .where(and(
          eq(sysUserDataArea.userId, userId),
          eq(sysUserDataArea.dataAreaId, dataAreaId),
        ));
    } else {
      await db
        .insert(sysUserDataArea)
        .values({ userId, dataAreaId, canCreate, canRead, canUpdate, canDelete });
    }

    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// DELETE /admin/user-data-area
adminRouter.delete("/user-data-area", async (req, res, next) => {
  try {
    const { userId, dataAreaId } = req.body;
    await db
      .delete(sysUserDataArea)
      .where(and(
        eq(sysUserDataArea.userId, userId),
        eq(sysUserDataArea.dataAreaId, dataAreaId),
      ));
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});
