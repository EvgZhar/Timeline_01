import { useQuery } from "@tanstack/react-query";
import { formatDisplay, toDate } from "@timeline/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/api/client";
import { labelY, layoutLabels } from "./labelLayout";
import {
  computeInitialRange,
  generateTicks,
  xForTime,
  timeForX,
  type ViewRange,
} from "./timeScale";

interface TimelineCanvasProps {
  onEventClick: (eventId: number) => void;
  onEmptyClick: (date: string, timelineId: number) => void;
}

export function TimelineCanvas({ onEventClick, onEmptyClick }: TimelineCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 600 });
  const [range, setRange] = useState<ViewRange | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [nearAxis, setNearAxis] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; range: ViewRange } | null>(null);

  const { data: timelines = [] } = useQuery({
    queryKey: ["timelines"],
    queryFn: api.timelines.list,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: () => api.events.list(),
  });

  const visibleTimelines = useMemo(
    () => timelines.filter((t) => t.visible).sort((a, b) => a.sortIndex - b.sortIndex),
    [timelines],
  );

  const effectiveRange = useMemo(() => {
    if (range) return range;
    return computeInitialRange(
      events.map((e) => ({ start: e.startDate, end: e.endDate })),
    );
  }, [range, events]);

  const padding = { left: 48, right: 24, top: 48, bottom: 48 };
  const innerW = size.w - padding.left - padding.right;
  const laneCount = Math.max(visibleTimelines.length, 1);
  const laneH = (size.h - padding.top - padding.bottom) / laneCount;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const span = effectiveRange.endMs - effectiveRange.startMs;
    const factor = e.shiftKey || e.ctrlKey ? (e.deltaY > 0 ? 1.15 : 1 / 1.15) : 1;
    if (factor !== 1) {
      const center = (effectiveRange.startMs + effectiveRange.endMs) / 2;
      const newSpan = Math.max(span * factor, 30 * 24 * 60 * 60 * 1000);
      setRange({
        startMs: center - newSpan / 2,
        endMs: center + newSpan / 2,
      });
    } else {
      const shift = (span * e.deltaY) / 500;
      setRange({
        startMs: effectiveRange.startMs + shift,
        endMs: effectiveRange.endMs + shift,
      });
    }
  };

  const ticks = generateTicks(effectiveRange, innerW);

  const checkNearAxis = (clientY: number): boolean => {
    if (!containerRef.current) return false;
    const rect = containerRef.current.getBoundingClientRect();
    const yRel = clientY - rect.top;
    for (let li = 0; li < laneCount; li++) {
      const y0 = padding.top + li * laneH;
      const yMid = y0 + laneH / 2;
      if (Math.abs(yRel - yMid) <= 12) {
        return true;
      }
    }
    return false;
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
      style={{
        cursor: isDragging ? "grabbing" : nearAxis ? "grab" : "default",
      }}
      onWheel={onWheel}
      onMouseDown={(e) => {
        if (checkNearAxis(e.clientY)) {
          dragRef.current = { x: e.clientX, range: { ...effectiveRange } };
          setIsDragging(true);
        }
      }}
      onMouseMove={(e) => {
        setNearAxis(checkNearAxis(e.clientY));
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.x;
        const span = dragRef.current.range.endMs - dragRef.current.range.startMs;
        const msPerPx = span / innerW;
        setRange({
          startMs: dragRef.current.range.startMs - dx * msPerPx,
          endMs: dragRef.current.range.endMs - dx * msPerPx,
        });
      }}
      onMouseUp={() => {
        dragRef.current = null;
        setIsDragging(false);
      }}
      onMouseLeave={() => {
        dragRef.current = null;
        setIsDragging(false);
        setNearAxis(false);
      }}
      onClick={(e) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const xRel = e.clientX - rect.left;
        const yRel = e.clientY - rect.top;
        if (xRel < padding.left || xRel > padding.left + innerW) return;

        let targetTimelineId: number | null = null;
        for (let li = 0; li < laneCount; li++) {
          const y0 = padding.top + li * laneH;
          const yMid = y0 + laneH / 2;
          if (Math.abs(yRel - yMid) <= 12) {
            targetTimelineId = visibleTimelines[li].id;
            break;
          }
        }
        if (targetTimelineId === null) return;

        const innerX = xRel - padding.left;
        const ms = timeForX(innerX, effectiveRange, innerW);
        const d = new Date(Math.round(ms));
        const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        const displayDate = formatDisplay(iso);
        onEmptyClick(displayDate, targetTimelineId);
      }}
    >
      <svg width={size.w} height={size.h} className="select-none">
        <rect width={size.w} height={size.h} fill="white" />
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padding.left + t.x}
              y1={padding.top}
              x2={padding.left + t.x}
              y2={size.h - padding.bottom}
              stroke="#e2e8f0"
            />
            <text
              x={padding.left + t.x}
              y={padding.top - 8}
              textAnchor="middle"
              fontSize={11}
              fill="#64748b"
            >
              {t.label}
            </text>
          </g>
        ))}

        {visibleTimelines.map((tl, li) => {
          const y0 = padding.top + li * laneH;
          const yMid = y0 + laneH / 2;
          const laneEvents = events.filter((ev) =>
            ev.timelines.some((t) => t.id === tl.id),
          );

          const labels = layoutLabels(
            laneEvents.map((ev) => ({
              id: ev.id,
              x:
                padding.left +
                xForTime(toDate(ev.startDate).getTime(), effectiveRange, innerW),
              text: ev.name,
            })),
          );

          return (
            <g key={tl.id}>
              <rect
                x={padding.left}
                y={y0}
                width={innerW}
                height={laneH}
                fill={hovered && laneEvents.some((e) => e.id === hovered) ? "#eff6ff" : "#fafafa"}
                stroke="#e2e8f0"
              />
              {tl.iconUrl ? (
                <image
                  href={tl.iconUrl}
                  x={4}
                  y={yMid - 40}
                  width={80}
                  height={80}
                  preserveAspectRatio="xMidYMid meet"
                />
              ) : null}
              <text
                x={8}
                y={yMid + (tl.iconUrl ? 50 : 4)}
                fontSize={14}
                fontWeight="bold"
                fill="#0f172a"
                opacity={0.5}
              >
                {tl.name}
              </text>
              <line
                x1={padding.left}
                y1={yMid}
                x2={padding.left + innerW}
                y2={yMid}
                stroke="#cbd5e1"
              />

              {laneEvents.map((ev) => {
                const x1 =
                  padding.left +
                  xForTime(toDate(ev.startDate).getTime(), effectiveRange, innerW);
                const x2 =
                  padding.left +
                  xForTime(toDate(ev.endDate).getTime(), effectiveRange, innerW);
                const isPoint = ev.startDate === ev.endDate;
                const isHover = hovered === ev.id;
                const label = labels.find((l) => l.id === ev.id);
                const ly = label ? labelY(label.row, yMid) : yMid - 20;

                return (
                  <g
                    key={ev.id}
                    onMouseEnter={() => setHovered(ev.id)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(ev.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    {isPoint ? (
                      <>
                        <circle cx={x1} cy={yMid} r={16} fill="transparent" />
                        <circle cx={x1} cy={yMid} r={isHover ? 7 : 5} fill="#2563eb" />
                      </>
                    ) : (
                      <>
                        <rect
                          x={Math.min(x1, x2)}
                          y={yMid - 18}
                          width={Math.max(Math.abs(x2 - x1), 4)}
                          height={36}
                          fill="transparent"
                        />
                        <rect
                          x={Math.min(x1, x2)}
                          y={yMid - 4}
                          width={Math.max(Math.abs(x2 - x1), 4)}
                          height={8}
                          fill="#2563eb"
                          opacity={0.85}
                        />
                      </>
                    )}
                    {label && (
                      <>
                        <line
                          x1={x1}
                          y1={yMid}
                          x2={x1}
                          y2={ly + 12}
                          stroke="#94a3b8"
                          strokeWidth={isHover ? 2 : 1}
                        />
                        <rect
                          x={x1 - 60}
                          y={ly - 10}
                          width={120}
                          height={20}
                          fill="transparent"
                        />
                        <text
                          x={x1}
                          y={ly}
                          textAnchor="middle"
                          fontSize={12}
                          fontWeight={isHover ? "bold" : "normal"}
                          fill="#0f172a"
                        >
                          {label.text}
                        </text>
                      </>
                    )}
                    {isHover && ev.documents[0]?.previewUrl && (
                      <image
                        href={ev.documents[0].previewUrl}
                        x={x1 - 50}
                        y={ly - 110}
                        width={100}
                        height={100}
                        preserveAspectRatio="xMidYMid slice"
                      />
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
