import { z } from "zod";
import { compareIso } from "./dates.js";

export const timelineCreateSchema = z.object({
  name: z.string().min(3, "Минимум 3 символа").max(60),
  description: z.string().max(255).optional(),
  iconUrl: z.string().url().max(2000).optional().nullable(),
});

export const timelineUpdateSchema = timelineCreateSchema.partial();

function isoYear(iso: string): number {
  return Number(iso.split("-")[0]);
}

export const eventCreateSchema = z
  .object({
    name: z.string().min(1).max(255),
    startDate: z.string().regex(/^-?\d{1,5}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^-?\d{1,5}-\d{2}-\d{2}$/).optional().nullable(),
    notes: z.string().optional().nullable(),
    timelineIds: z.array(z.number().int().positive()).min(1),
    tagIds: z.array(z.number().int().positive()).optional().default([]),
  })
  .refine(
    (d) => !d.endDate || compareIso(d.endDate, d.startDate) >= 0,
    { message: "Дата окончания должна быть ≥ даты начала", path: ["endDate"] },
  );

export const eventUpdateSchema = eventCreateSchema;

export const tagCreateSchema = z.object({
  name: z.string().min(1).max(40),
  color: z.number().int(),
  previewUrl: z.string().max(2000).optional().nullable(),
});

export const documentCreateUrlSchema = z.object({
  eventId: z.number().int().positive(),
  description: z.string().min(1).max(255),
  originalLink: z.string().url().max(1200),
  resourceType: z.enum(["image", "video", "pdf"]).optional(),
});

export const settingsUpdateSchema = z.object({
  settings: z.record(z.string().nullable()),
});

export const reorderTimelinesSchema = z.object({
  orderedIds: z.array(z.number().int().positive()),
});

export const loginSchema = z.object({
  login: z.string().min(1, "Логин обязателен"),
  password: z.string().min(1, "Пароль обязателен"),
});

export const registerSchema = z.object({
  login: z.string().min(3, "Минимум 3 символа").max(50),
  email: z.string().email("Некорректный email"),
  password: z.string().min(4, "Минимум 4 символа"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
});

export const authSettingsSchema = z.object({
  currentDataAreaId: z.number().int().positive(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Некорректный email"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
  password: z.string().min(4, "Минимум 4 символа"),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Токен обязателен"),
});

export const resendVerificationSchema = z.object({
  email: z.string().email("Некорректный email"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z.string().min(4, "Минимум 4 символа"),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
});

export type TimelineCreate = z.infer<typeof timelineCreateSchema>;
export type EventCreate = z.infer<typeof eventCreateSchema>;
export type TagCreate = z.infer<typeof tagCreateSchema>;
export type Login = z.infer<typeof loginSchema>;
export type Register = z.infer<typeof registerSchema>;
