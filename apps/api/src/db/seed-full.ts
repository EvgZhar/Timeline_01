import { db } from "./index.js";
import { eventTable, eventTimelineLink, tagTable, tagEventLink, timelineTable } from "./schema.js";
import { and, eq } from "drizzle-orm";

// ── helpers ──
async function ensureTimeline(name: string, description: string | null, sortIndex: number, iconUrl?: string) {
  const existing = await db.select().from(timelineTable).where(eq(timelineTable.name, name)).limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await db.insert(timelineTable).values({ name, description, sortIndex, iconUrl }).returning();
  console.log(`  + timeline: ${name}`);
  return row;
}

async function ensureTag(name: string, color: number) {
  const existing = await db.select().from(tagTable).where(eq(tagTable.name, name)).limit(1);
  if (existing.length > 0) return existing[0];
  const [row] = await db.insert(tagTable).values({ name, color }).returning();
  console.log(`  + tag: ${name}`);
  return row;
}

async function ensureEvent(name: string, startDate: string, endDate: string, notes: string | null) {
  const existing = await db.select().from(eventTable).where(eq(eventTable.name, name)).limit(1);
  if (existing.length > 0) {
    console.log(`  ~ skip: ${name}`);
    return existing[0];
  }
  const [row] = await db.insert(eventTable).values({ name, startDate, endDate, notes }).returning();
  console.log(`  + event: ${name}`);
  return row;
}

async function linkEventToTimeline(eventId: number, timelineId: number) {
  const existing = await db
    .select()
    .from(eventTimelineLink)
    .where(and(eq(eventTimelineLink.eventId, eventId), eq(eventTimelineLink.timelineId, timelineId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(eventTimelineLink).values({ eventId, timelineId });
}

async function tagEvent(eventId: number, tagId: number) {
  const existing = await db
    .select()
    .from(tagEventLink)
    .where(and(eq(tagEventLink.eventId, eventId), eq(tagEventLink.tagId, tagId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(tagEventLink).values({ eventId, tagId });
}

function hslToInt(h: number, s: number, l: number): number {
  const r = (h / 360) * 255;
  const g = (s / 100) * 255;
  const b = (l / 100) * 255;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

const TAG_COLORS: Record<string, number> = {
  Испания: hslToInt(15, 80, 55),
  Монголия: hslToInt(40, 70, 50),
  Индия: hslToInt(220, 60, 55),
  Китай: hslToInt(0, 70, 50),
  Польша: hslToInt(340, 60, 55),
};

const DATE = (y: number, m = 1, d = 1) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const POINT = (y: number) => ({ startDate: DATE(y), endDate: DATE(y) });
const SPAN = (y1: number, y2: number) => ({ startDate: DATE(y1), endDate: DATE(y2) });

// ── data ──
const WORLD_HISTORY_EVENTS: { name: string; startDate: string; endDate: string; notes: string | null; tags: string[] }[] = [
  { name: "Падение Западной Римской империи", ...POINT(476), notes: "Свержение Ромула Августула", tags: ["Италия"] },
  { name: "Битва при Гастингсе", ...POINT(1066), notes: "Нормандское завоевание Англии", tags: ["Англия"] },
  { name: "Столетняя война", ...SPAN(1337, 1453), notes: "Англо-французский конфликт", tags: ["Франция", "Англия"] },
  { name: "Открытие Америки Колумбом", ...POINT(1492), notes: "Первая экспедиция к берегам Нового Света", tags: ["Испания"] },
  { name: "Начало Реформации", ...POINT(1517), notes: "95 тезисов Мартина Лютера", tags: ["Германия"] },
  { name: "Варфоломеевская ночь", ...POINT(1572), notes: "Резня гугенотов в Париже", tags: ["Франция"] },
  { name: "Английская революция", ...SPAN(1642, 1651), notes: "Гражданская война, казнь Карла I", tags: ["Англия"] },
  { name: "Война за независимость США", ...SPAN(1775, 1783), notes: "Образование Соединённых Штатов", tags: ["США"] },
  { name: "Взятие Бастилии", ...POINT(1789), notes: "Начало Великой французской революции", tags: ["Франция"] },
  { name: "Битва при Ватерлоо", ...POINT(1815), notes: "Окончательное поражение Наполеона", tags: ["Англия", "Франция"] },
  { name: "Гражданская война в США", ...SPAN(1861, 1865), notes: "Север против Юга, отмена рабства", tags: ["США"] },
  { name: "Объединение Германии", ...POINT(1871), notes: "Провозглашение Германской империи", tags: ["Германия"] },
  { name: "Первая мировая война", ...SPAN(1914, 1918), notes: "Великая война", tags: ["Германия", "Франция", "Англия", "Россия"] },
  { name: "Октябрьская революция в России", ...POINT(1917), notes: "Приход большевиков к власти", tags: ["Россия"] },
  { name: "Пакт Молотова — Риббентропа", ...POINT(1939), notes: "Договор о ненападении между СССР и Германией", tags: ["Россия", "Германия"] },
  { name: "Ядерная бомбардировка Хиросимы", ...POINT(1945), notes: "Первое применение ядерного оружия", tags: ["США", "Япония"] },
  { name: "Карибский кризис", ...POINT(1962), notes: "Порог ядерной войны", tags: ["США", "Россия"] },
  { name: "Падение Берлинской стены", ...POINT(1989), notes: "Объединение Германии", tags: ["Германия"] },
  { name: "Распад СССР", ...POINT(1991), notes: "Конец Советского Союза", tags: ["Россия"] },
  { name: "Теракты 11 сентября", ...POINT(2001), notes: "Атака на Всемирный торговый центр", tags: ["США"] },
];

const SCIENCE_EVENTS: { name: string; startDate: string; endDate: string; notes: string | null; tags: string[] }[] = [
  { name: "Гелиоцентрическая система Коперника", ...POINT(1543), notes: "De revolutionibus orbium coelestium", tags: ["Польша"] },
  { name: "Закон всемирного тяготения Ньютона", ...POINT(1687), notes: "Philosophiæ Naturalis Principia Mathematica", tags: ["Англия"] },
  { name: "Паровой двигатель Уатта", ...POINT(1776), notes: "Универсальный паровой двигатель", tags: ["Англия"] },
  { name: "Вакцина от оспы", ...POINT(1796), notes: "Эдвард Дженнер", tags: ["Англия"] },
  { name: "Теория эволюции Дарвина", ...POINT(1859), notes: "Происхождение видов", tags: ["Англия"] },
  { name: "Таблица Менделеева", ...POINT(1869), notes: "Периодическая система химических элементов", tags: ["Россия"] },
  { name: "Телефон Белла", ...POINT(1876), notes: "Изобретение телефона", tags: ["США"] },
  { name: "Лампочка Эдисона", ...POINT(1879), notes: "Угольная лампа накаливания", tags: ["США"] },
  { name: "Открытие радия", ...POINT(1898), notes: "Супруги Кюри", tags: ["Франция"] },
  { name: "Теория относительности Эйнштейна", ...POINT(1905), notes: "Специальная теория относительности", tags: ["Германия"] },
  { name: "Транзистор", ...POINT(1947), notes: "Изобретение транзистора в Bell Labs", tags: ["США"] },
  { name: "Расщепление атома", ...POINT(1938), notes: "Отто Ган и Фриц Штрассман", tags: ["Германия"] },
  { name: "ДНК — двойная спираль", ...POINT(1953), notes: "Уотсон и Крик", tags: ["Англия", "США"] },
  { name: "Вакцина от полиомиелита", ...POINT(1955), notes: "Джонас Солк", tags: ["США"] },
  { name: "Первый искусственный спутник Земли", ...POINT(1957), notes: "Спутник-1", tags: ["Россия"] },
  { name: "Компьютерная мышь", ...POINT(1973), notes: "Xerox Alto", tags: ["США"] },
  { name: "Интернет", ...POINT(1983), notes: "Переход на TCP/IP", tags: ["США"] },
  { name: "Клонирование овцы Долли", ...POINT(1996), notes: "Первое клонированное млекопитающее", tags: ["Англия"] },
  { name: "Расшифровка генома человека", ...POINT(2003), notes: "Завершение проекта «Геном человека»", tags: ["США"] },
  { name: "Гравитационные волны", ...POINT(2015), notes: "Эксперимент LIGO", tags: ["США"] },
];

const RULERS_EVENTS: { name: string; startDate: string; endDate: string; notes: string | null; tags: string[] }[] = [
  { name: "Карл Великий — коронация императором", ...POINT(800), notes: "Император Запада", tags: ["Франция"] },
  { name: "Вильгельм Завоеватель — битва при Гастингсе", ...POINT(1066), notes: "Нормандское завоевание", tags: ["Англия"] },
  { name: "Чингисхан — основание Монгольской империи", ...POINT(1206), notes: "Объединение монгольских племён", tags: ["Монголия"] },
  { name: "Иван Грозный — венчание на царство", ...POINT(1547), notes: "Первый царь всея Руси", tags: ["Россия"] },
  { name: "Елизавета I — коронация", ...POINT(1558), notes: "Золотой век Англии", tags: ["Англия"] },
  { name: "Людовик XIV — начало правления", ...POINT(1643), notes: "Король-Солнце", tags: ["Франция"] },
  { name: "Пётр I — начало правления", ...POINT(1682), notes: "Император Всероссийский", tags: ["Россия"] },
  { name: "Екатерина II — воцарение", ...POINT(1762), notes: "Золотой век Российской империи", tags: ["Россия"] },
  { name: "Наполеон I — коронация императором", ...POINT(1804), notes: "Основание Первой империи", tags: ["Франция"] },
  { name: "Королева Виктория — начало правления", ...POINT(1837), notes: "Викторианская эпоха", tags: ["Англия"] },
  { name: "Александр II — отмена крепостного права", ...POINT(1861), notes: "Великие реформы", tags: ["Россия"] },
  { name: "Отто фон Бисмарк — канцлер Германской империи", ...POINT(1871), notes: "Железный канцлер", tags: ["Германия"] },
  { name: "Хирохито — император Японии", ...POINT(1926), notes: "Эпоха Сёва", tags: ["Япония"] },
  { name: "Махатма Ганди — соляной поход", ...POINT(1930), notes: "Гражданское неповиновение", tags: ["Индия"] },
  { name: "Франклин Рузвельт — Новый курс", ...POINT(1933), notes: "Преодоление Великой депрессии", tags: ["США"] },
  { name: "Уинстон Черчилль — премьер-министр", ...POINT(1940), notes: "Военное руководство Великобританией", tags: ["Англия"] },
  { name: "Конрад Аденауэр — канцлер ФРГ", ...POINT(1949), notes: "Послевоенное восстановление Германии", tags: ["Германия"] },
  { name: "Мао Цзэдун — провозглашение КНР", ...POINT(1949), notes: "Образование Китайской Народной Республики", tags: ["Китай"] },
  { name: "Шарль де Голль — президент Пятой республики", ...POINT(1959), notes: "Основание Пятой республики", tags: ["Франция"] },
  { name: "Маргарет Тэтчер — премьер-министр", ...POINT(1979), notes: "Тэтчеризм", tags: ["Англия"] },
];

// ── main ──
async function seed() {
  console.log("Seeding started…\n");

  // 1. timelines
  const worldTl = await ensureTimeline("Мировая история", "Основная шкала", 1);
  const scienceTl = await ensureTimeline("Наука", null, 0);
  const rulersTl = await ensureTimeline("Правители", null, 2);

  // 2. tags
  const tagMap = new Map<string, number>();
  const existingTags = await db.select().from(tagTable);
  for (const t of existingTags) tagMap.set(t.name, t.id);
  // ensure all needed tags exist
  const neededTags = new Set<string>([
    ...Object.keys(TAG_COLORS),
    ...WORLD_HISTORY_EVENTS.flatMap((e) => e.tags),
    ...SCIENCE_EVENTS.flatMap((e) => e.tags),
    ...RULERS_EVENTS.flatMap((e) => e.tags),
  ]);
  for (const name of neededTags) {
    if (tagMap.has(name)) continue;
    const tag = await ensureTag(name, TAG_COLORS[name] ?? Math.floor(Math.random() * 0xffffff));
    tagMap.set(name, tag.id);
  }

  // 3. events & links
  async function processBatch(timelineId: number, events: typeof WORLD_HISTORY_EVENTS) {
    for (const ev of events) {
      const event = await ensureEvent(ev.name, ev.startDate, ev.endDate, ev.notes);
      await linkEventToTimeline(event.id, timelineId);
      for (const tagName of ev.tags) {
        const tagId = tagMap.get(tagName);
        if (tagId) await tagEvent(event.id, tagId);
      }
    }
  }

  await processBatch(worldTl.id, WORLD_HISTORY_EVENTS);
  await processBatch(scienceTl.id, SCIENCE_EVENTS);
  await processBatch(rulersTl.id, RULERS_EVENTS);

  console.log("\nSeeding complete!");
  console.log(`  Timelines: 3 (Мировая история, Наука, Правители)`);
  console.log(`  Tags: ${tagMap.size}`);
  console.log(`  Events: ~60 (≈20 per timeline)`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
