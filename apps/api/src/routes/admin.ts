import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  sysUserTable,
  sysDataAreaTable,
  sysUserDataArea,
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
    const users = await db.select().from(sysUserTable).orderBy(sysUserTable.login);
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
    if (password) values.passwordHash = passwordService.hash(password);

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

// GET /admin/data-areas
adminRouter.get("/data-areas", async (_req, res, next) => {
  try {
    const areas = await db.select().from(sysDataAreaTable).orderBy(sysDataAreaTable.name);
    res.json(areas);
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
