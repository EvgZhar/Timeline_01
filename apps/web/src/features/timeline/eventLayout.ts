export function assignEventTracks(
  events: { id: number; startDate: string; endDate: string }[],
  maxTracks: number = 8,
): Map<number, number> {
  const sorted = [...events]
    .map((ev) => ({
      id: ev.id,
      startMs: new Date(ev.startDate).getTime(),
      endMs: new Date(ev.endDate).getTime(),
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
