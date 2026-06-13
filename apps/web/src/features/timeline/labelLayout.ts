export interface LabelItem {
  id: number;
  x: number;
  text: string;
  row: number;
}

const ROW_HEIGHT = 18;
const CHAR_WIDTH = 7;

export function layoutLabels(
  items: { id: number; x: number; text: string; trackIdx: number }[],
): LabelItem[] {
  const sorted = [...items].sort((a, b) => a.trackIdx - b.trackIdx || a.x - b.x);
  const rows: { endX: number }[] = [];
  const result: LabelItem[] = [];
  let lastTrack = -1;

  for (const item of sorted) {
    if (item.trackIdx !== lastTrack) {
      rows.length = 0;
      lastTrack = item.trackIdx;
    }
    const width = item.text.length * CHAR_WIDTH + 8;
    let row = 0;
    for (; row < rows.length; row++) {
      if (item.x >= rows[row].endX + 4) break;
    }
    if (row === rows.length) rows.push({ endX: 0 });
    rows[row].endX = item.x + width;
    result.push({ ...item, row });
  }
  return result;
}

export function labelY(row: number, baseY: number, trackIdx: number = 0): number {
  return baseY - 24 - row * ROW_HEIGHT + trackIdx * 14;
}
