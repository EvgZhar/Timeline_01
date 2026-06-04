import { createRequire } from "node:module";
import { and, asc, eq, ilike, inArray, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "../db/index.js";
import { eventTable, eventTimelineLink, tagEventLink, tagTable, timelineTable } from "../db/schema.js";
import { eventCreateSchema, toStorage } from "@timeline/shared";
import type { ImportResult } from "@timeline/shared";
import * as eventsService from "./eventsService.js";
import { checkPermission } from "./permissionService.js";

const require = createRequire(import.meta.url);
const ExcelJS = require("exceljs");

const PG_BCE_RE = /^(\d{4}-\d{2}-\d{2}) BC$/;
const EXCEL_DATE_RE = /^-?\d{1,5}-\d{2}-\d{2}$/;

function fromDbDate(dbVal: string): string {
  const m = PG_BCE_RE.exec(dbVal);
  return m ? `-${m[1]}` : dbVal;
}

function toDbDate(iso: string): string {
  if (iso.startsWith("-")) {
    return `${iso.slice(1)} BC`;
  }
  return iso;
}

function styleHeader(sheet: any): void {
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FF333333" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
}


export interface ExportFilters {
  tagFilterIds?: number[];
  tagFilterMode?: "and" | "or";
  textSearchQuery?: string;
  textSearchMode?: "name" | "nameAndNotes";
  dateFrom?: string;
  dateTo?: string;
}

async function getFilteredEventIds(
  dataAreaIds: number[],
  filters: ExportFilters,
): Promise<number[]> {
  const conditions: SQL[] = [
    inArray(eventTable.dataAreaId, dataAreaIds),
  ];

  // Tag filtering
  if (filters.tagFilterIds && filters.tagFilterIds.length > 0) {
    if (filters.tagFilterMode === "and") {
      const matching = await db
        .select({ eventId: tagEventLink.eventId })
        .from(tagEventLink)
        .where(inArray(tagEventLink.tagId, filters.tagFilterIds))
        .groupBy(tagEventLink.eventId)
        .having(sql`count(distinct ${tagEventLink.tagId}) = ${filters.tagFilterIds.length}`);
      const ids = matching.map((r) => r.eventId);
      conditions.push(inArray(eventTable.id, ids));
    } else {
      const matching = await db
        .select({ eventId: tagEventLink.eventId })
        .from(tagEventLink)
        .where(inArray(tagEventLink.tagId, filters.tagFilterIds));
      const ids = [...new Set(matching.map((r) => r.eventId))];
      conditions.push(inArray(eventTable.id, ids));
    }
  }

  // Text search
  if (filters.textSearchQuery?.trim()) {
    const q = `%${filters.textSearchQuery.toLowerCase()}%`;
    if (filters.textSearchMode === "nameAndNotes") {
      conditions.push(or(ilike(eventTable.name, q), ilike(eventTable.notes ?? "", q))!);
    } else {
      conditions.push(ilike(eventTable.name, q));
    }
  }

  // Date range
  if (filters.dateFrom) {
    conditions.push(sql`${eventTable.startDate} >= ${toDbDate(filters.dateFrom)}`);
  }
  if (filters.dateTo) {
    conditions.push(sql`${eventTable.startDate} <= ${toDbDate(filters.dateTo)}`);
  }

  const rows = await db
    .select({ id: eventTable.id })
    .from(eventTable)
    .where(and(...conditions))
    .orderBy(asc(eventTable.startDate));
  return rows.map((r) => r.id);
}

export async function generateExportXlsx(
  dataAreaIds: number[],
  filters: ExportFilters,
): Promise<Buffer> {
  const [timelines, tags] = await Promise.all([
    db.select().from(timelineTable).where(inArray(timelineTable.dataAreaId, dataAreaIds)).orderBy(timelineTable.sortIndex),
    db.select().from(tagTable).where(inArray(tagTable.dataAreaId, dataAreaIds)).orderBy(tagTable.name),
  ]);

  const eventIdFilter = await getFilteredEventIds(dataAreaIds, filters);
  const events = eventIdFilter.length > 0
    ? await db.select().from(eventTable).where(inArray(eventTable.id, eventIdFilter)).orderBy(asc(eventTable.startDate))
    : [];

  const eventIds = events.map((e) => e.id);

  const [eventTimelineRows, eventTagRows] = eventIds.length > 0
    ? await Promise.all([
        db
          .select({ eventId: eventTimelineLink.eventId, name: timelineTable.name })
          .from(eventTimelineLink)
          .innerJoin(timelineTable, eq(eventTimelineLink.timelineId, timelineTable.id))
          .where(inArray(eventTimelineLink.eventId, eventIds)),
        db
          .select({ eventId: tagEventLink.eventId, name: tagTable.name })
          .from(tagEventLink)
          .innerJoin(tagTable, eq(tagEventLink.tagId, tagTable.id))
          .where(inArray(tagEventLink.eventId, eventIds)),
      ])
    : [[], []];

  const tlByEvent = new Map<number, string[]>();
  for (const r of eventTimelineRows) {
    const arr = tlByEvent.get(r.eventId) ?? [];
    arr.push(r.name);
    tlByEvent.set(r.eventId, arr);
  }
  const tgByEvent = new Map<number, string[]>();
  for (const r of eventTagRows) {
    const arr = tgByEvent.get(r.eventId) ?? [];
    arr.push(r.name);
    tgByEvent.set(r.eventId, arr);
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Timeline";

  // ── Sheet: Таймлайны ──
  const tlSheet = wb.addWorksheet("Таймлайны");
  tlSheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Название", key: "name", width: 34 },
    { header: "Описание", key: "description", width: 44 },
    { header: "Иконка", key: "iconUrl", width: 34 },
    { header: "Порядок", key: "sortIndex", width: 10 },
  ];
  for (const tl of timelines) {
    tlSheet.addRow({
      id: tl.id,
      name: tl.name,
      description: tl.description ?? "",
      iconUrl: tl.iconUrl ?? "",
      sortIndex: tl.sortIndex,
    });
  }
  styleHeader(tlSheet);

  // ── Sheet: Теги ──
  const tagSheet = wb.addWorksheet("Теги");
  tagSheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Название", key: "name", width: 34 },
    { header: "Цвет", key: "color", width: 14 },
    { header: "Превью", key: "previewUrl", width: 44 },
  ];
  for (const t of tags) {
    tagSheet.addRow({
      id: t.id,
      name: t.name,
      color: "#" + t.color.toString(16).padStart(6, "0"),
      previewUrl: t.previewUrl ?? "",
    });
  }
  styleHeader(tagSheet);

  // ── Sheet: События ──
  const evSheet = wb.addWorksheet("События");
  evSheet.columns = [
    { header: "ID", key: "id", width: 8 },
    { header: "Название", key: "name", width: 44 },
    { header: "ДатаНачала", key: "startDate", width: 16 },
    { header: "ДатаОкончания", key: "endDate", width: 16 },
    { header: "Заметки", key: "notes", width: 54 },
    { header: "Таймлайны", key: "timelines", width: 44 },
    { header: "Теги", key: "tags", width: 44 },
  ];
  for (const ev of events) {
    const start = fromDbDate(ev.startDate);
    const end = fromDbDate(ev.endDate ?? ev.startDate);
    evSheet.addRow({
      id: `${ev.dataAreaId}_${ev.id}`,
      name: ev.name,
      startDate: start,
      endDate: end,
      notes: ev.notes ?? "",
      timelines: (tlByEvent.get(ev.id) ?? []).join("; "),
      tags: (tgByEvent.get(ev.id) ?? []).join("; "),
    });
  }
  styleHeader(evSheet);

  // Format date columns as text so Excel doesn't auto-convert
  for (let r = 2; r <= evSheet.rowCount; r++) {
    const row = evSheet.getRow(r);
    row.getCell(3).numFmt = "@";
    row.getCell(4).numFmt = "@";
  }

  // Auto-filter on events sheet
  const evRowCount = events.length + 1;
  if (evRowCount > 1) {
    evSheet.autoFilter = { from: "A1", to: `G${evRowCount}` };
  }

  const buf = await wb.xlsx.writeBuffer();
  return buf as unknown as Buffer;
}

const COMPOSITE_KEY_RE = /^(\d+)_(\d+)$/;

export async function processImportXlsx(
  buffer: Buffer,
  dataAreaId: number,
  userId: number,
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const evSheet = wb.getWorksheet("События");
  if (!evSheet) {
    result.errors.push({ row: 0, message: "Лист «События» не найден" });
    return result;
  }

  const tlSheet = wb.getWorksheet("Таймлайны");
  const tagSheet = wb.getWorksheet("Теги");

  // ── Step 1: resolve/create справочники ──
  const timelineMap = new Map<string, number>();
  if (tlSheet) {
    const names: string[] = [];
    tlSheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;
      const name = String(row.getCell(2).value ?? "").trim();
      if (name) names.push(name);
    });
    for (const name of names) {
      const [existing] = await db
        .select({ id: timelineTable.id })
        .from(timelineTable)
        .where(and(ilike(timelineTable.name, name), eq(timelineTable.dataAreaId, dataAreaId)))
        .limit(1);
      if (existing) {
        timelineMap.set(name, existing.id);
      } else {
        const [created] = await db
          .insert(timelineTable)
          .values({ name: name.slice(0, 60), dataAreaId })
          .returning();
        timelineMap.set(name, created.id);
      }
    }
  }

  const tagMap = new Map<string, number>();
  if (tagSheet) {
    const names: string[] = [];
    tagSheet.eachRow((row: any, rowNumber: number) => {
      if (rowNumber === 1) return;
      const name = String(row.getCell(2).value ?? "").trim();
      if (name) names.push(name);
    });
    for (const name of names) {
      const [existing] = await db
        .select({ id: tagTable.id })
        .from(tagTable)
        .where(and(ilike(tagTable.name, name), eq(tagTable.dataAreaId, dataAreaId)))
        .limit(1);
      if (existing) {
        tagMap.set(name, existing.id);
      } else {
        const [created] = await db
          .insert(tagTable)
          .values({ name: name.slice(0, 40), color: 0x6b7280, dataAreaId })
          .returning();
        tagMap.set(name, created.id);
      }
    }
  }

  // ── Step 2: process events ──
  for (let r = 2; r <= evSheet.rowCount; r++) {
    const row = evSheet.getRow(r);
    try {
      const idCell = row.getCell(1).value;
      const name = String(row.getCell(2).value ?? "").trim();
      const startDateRaw = String(row.getCell(3).value ?? "").trim();
      const endDateRaw = String(row.getCell(4).value ?? "").trim();
      const notes = String(row.getCell(5).value ?? "").trim() || null;
      const timelineNamesStr = String(row.getCell(6).value ?? "").trim();
      const tagNamesStr = String(row.getCell(7).value ?? "").trim();

      if (!name || !startDateRaw) {
        result.skipped++;
        continue;
      }

      if (!EXCEL_DATE_RE.test(startDateRaw)) {
        result.errors.push({ row: r, message: `Неверный формат даты: ${startDateRaw}` });
        result.skipped++;
        continue;
      }

      const startDate = startDateRaw.startsWith("-")
        ? startDateRaw
        : startDateRaw;

      let endDate: string;
      if (endDateRaw && EXCEL_DATE_RE.test(endDateRaw)) {
        endDate = endDateRaw;
      } else {
        endDate = startDate;
      }

      const timelineIds: number[] = [];
      if (timelineNamesStr) {
        for (const tName of timelineNamesStr.split(";").map((s) => s.trim()).filter(Boolean)) {
          const id = timelineMap.get(tName);
          if (id && id > 0) timelineIds.push(id);
        }
      }

      const tagIds: number[] = [];
      if (tagNamesStr) {
        for (const tName of tagNamesStr.split(";").map((s) => s.trim()).filter(Boolean)) {
          const id = tagMap.get(tName);
          if (id && id > 0) tagIds.push(id);
        }
      }

      const eventData = {
        name,
        startDate,
        endDate: endDate !== startDate ? endDate : undefined,
        notes,
        timelineIds,
        tagIds,
      };

      eventCreateSchema.parse(eventData);

      const idCellStr = String(idCell ?? "").trim();

      if (!idCellStr) {
        // Пустая ячейка → новое событие в текущей DataArea
        await eventsService.createEvent(eventData, dataAreaId);
        result.created++;
        continue;
      }

      const match = idCellStr.match(COMPOSITE_KEY_RE);
      if (!match) {
        // Не парсится под формат DataAreaId_EventId
        result.errors.push({ row: r, message: `Неверный формат ключа: "${idCellStr}"` });
        result.skipped++;
        continue;
      }

      const parsedDataAreaId = Number(match[1]);
      const parsedEventId = Number(match[2]);

      if (!(await checkPermission(userId, parsedDataAreaId, "canUpdate"))) {
        result.errors.push({ row: r, message: `Нет прав на обновление в области ${parsedDataAreaId} (ключ: ${idCellStr})` });
        result.skipped++;
        continue;
      }

      const [existing] = await db
        .select({ id: eventTable.id, dataAreaId: eventTable.dataAreaId })
        .from(eventTable)
        .where(eq(eventTable.id, parsedEventId))
        .limit(1);

      if (existing && existing.dataAreaId === parsedDataAreaId) {
        await eventsService.updateEventMeta(parsedEventId, {
          name: eventData.name,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          notes: eventData.notes ?? null,
        });
        result.updated++;
      } else {
        result.errors.push({ row: r, message: `Событие с ключом ${idCellStr} не найдено в области ${parsedDataAreaId}` });
        result.skipped++;
      }
    } catch (e) {
      result.errors.push({ row: r, message: String(e) });
      result.skipped++;
    }
  }

  return result;
}
