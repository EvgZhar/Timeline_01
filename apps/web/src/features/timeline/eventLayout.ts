import { toDate } from "@timeline/shared";
import { xForTime } from "./timeScale";
import type { ViewRange } from "./timeScale";

export function assignEventTracks(
  events: { id: number; startDate: string; endDate: string }[],
  maxTracks: number = 8,
): Map<number, number> {
  const sorted = [...events]
    .map((ev) => ({
      id: ev.id,
      startMs: toDate(ev.startDate).getTime(),
      endMs: toDate(ev.endDate).getTime(),
    }))
    .sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);

  const tracks: { startMs: number; endMs: number }[][] = [];
  const result = new Map<number, number>();

  for (const ev of sorted) {
    let trackIdx = 0;
    for (; trackIdx < tracks.length && trackIdx < maxTracks - 1; trackIdx++) {
      const overlaps = tracks[trackIdx].some(
        (existing) => ev.startMs < existing.endMs && existing.startMs < ev.endMs,
      );
      if (!overlaps) break;
    }
    if (trackIdx === tracks.length) tracks.push([]);
    tracks[trackIdx].push(ev);
    result.set(ev.id, trackIdx);
  }

  return result;
}

export function assignBarThickness(
  events: { id: number; startDate: string; endDate: string }[],
  trackMap: Map<number, number>,
  range: ViewRange,
  width: number,
): Map<number, "normal" | "thick"> {
  const THRESHOLD = 5;
  const result = new Map<number, "normal" | "thick">();
  const trackGroups = new Map<number, { id: number; startX: number; endX: number }[]>();

  for (const ev of events) {
    const trackIdx = trackMap.get(ev.id) ?? 0;
    if (!trackGroups.has(trackIdx)) trackGroups.set(trackIdx, []);
    const startMs = toDate(ev.startDate).getTime();
    const endMs = toDate(ev.endDate).getTime();
    trackGroups.get(trackIdx)!.push({
      id: ev.id,
      startX: xForTime(startMs, range, width),
      endX: xForTime(endMs, range, width),
    });
  }

  for (const [, group] of trackGroups) {
    if (group.length < 2) {
      if (group.length === 1) result.set(group[0].id, "normal");
      continue;
    }
    group.sort((a, b) => a.startX - b.startX);

    let clusterStart = 0;
    for (let i = 1; i <= group.length; i++) {
      const isLast = i === group.length;
      const gap = isLast ? Infinity : group[i].startX - group[i - 1].endX;

      if (gap > THRESHOLD || isLast) {
        const cluster = group.slice(clusterStart, i);
        if (cluster.length >= 2) {
          for (let j = 0; j < cluster.length; j++) {
            result.set(cluster[j].id, j % 2 === 0 ? "normal" : "thick");
          }
        } else {
          result.set(cluster[0].id, "normal");
        }
        clusterStart = i;
      }
    }
  }

  return result;
}
