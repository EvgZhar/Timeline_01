import { useQuery } from "@tanstack/react-query";
import { formatDisplay, toDate } from "@timeline/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/api/client";
import { assignBarThickness, assignEventTracks } from "./eventLayout";
import { labelY, layoutLabels } from "./labelLayout";
import { ZoomControls } from "./ZoomControls";
import {
  computeInitialRange,
  generateTicks,
  xForTime,
  timeForX,
  type ViewRange,
} from "./timeScale";

interface TimelineCanvasProps {
  tagFilterIds: number[];
  tagFilterMode: "and" | "or";
  textSearchQuery: string;
  textSearchMode: "name" | "nameAndNotes";
  onEventClick: (eventId: number) => void;
  onEmptyClick: (date: string, timelineId: number) => void;
  initialRange?: ViewRange | null;
  onRangeChange?: (range: ViewRange) => void;
}

const TRACK_COLORS = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];

function trackColor(idx: number): string {
  return TRACK_COLORS[Math.min(idx, TRACK_COLORS.length - 1)];
}

function lightenColor(hex: string, mix: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const toHex = (n: number) => Math.round(n).toString(16).padStart(2, "0");
  return `#${[
    r + (255 - r) * mix,
    g + (255 - g) * mix,
    b + (255 - b) * mix,
  ].map(toHex).join("")}`;
}

export function TimelineCanvas({ tagFilterIds, tagFilterMode, textSearchQuery, textSearchMode, onEventClick, onEmptyClick, initialRange, onRangeChange }: TimelineCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 600 });
  const [range, setRange] = useState<ViewRange | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; range: ViewRange } | null>(null);
  const wasDraggedRef = useRef(false);

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
    if (initialRange) return initialRange;
    return computeInitialRange(
      events.map((e) => ({ start: e.startDate, end: e.endDate })),
    );
  }, [range, initialRange, events]);

  // Notify parent when user changes the range
  useEffect(() => {
    if (range && onRangeChange) {
      onRangeChange(range);
    }
  }, [range, onRangeChange]);

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
    return () => {
      ro.disconnect();
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
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

  const zoomFactor = 1.3;
  const minSpanMs = 30 * 24 * 60 * 60 * 1000;

  const handleZoomIn = () => {
    const span = effectiveRange.endMs - effectiveRange.startMs;
    const center = (effectiveRange.startMs + effectiveRange.endMs) / 2;
    const newSpan = Math.max(span / zoomFactor, minSpanMs);
    setRange({ startMs: center - newSpan / 2, endMs: center + newSpan / 2 });
  };

  const handleZoomOut = () => {
    const span = effectiveRange.endMs - effectiveRange.startMs;
    const center = (effectiveRange.startMs + effectiveRange.endMs) / 2;
    setRange({ startMs: center - span * zoomFactor / 2, endMs: center + span * zoomFactor / 2 });
  };

  const handleScrollBack = () => {
    const span = effectiveRange.endMs - effectiveRange.startMs;
    const shift = span * 0.3;
    setRange({ startMs: effectiveRange.startMs - shift, endMs: effectiveRange.endMs - shift });
  };

  const handleScrollForward = () => {
    const span = effectiveRange.endMs - effectiveRange.startMs;
    const shift = span * 0.3;
    setRange({ startMs: effectiveRange.startMs + shift, endMs: effectiveRange.endMs + shift });
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden"
      style={{
        cursor: isDragging ? "grabbing" : "grab",
      }}
      onWheel={onWheel}
      onMouseDown={(e) => {
        dragRef.current = { x: e.clientX, range: { ...effectiveRange } };
        setIsDragging(true);
        wasDraggedRef.current = false;
      }}
      onMouseMove={(e) => {
        if (!dragRef.current) return;
        const dx = e.clientX - dragRef.current.x;
        if (Math.abs(dx) > 5) wasDraggedRef.current = true;
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
      }}
      onClick={(e) => {
        if (wasDraggedRef.current) return;
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
        <defs>
          {TRACK_COLORS.map((color, i) => (
            <linearGradient key={i} id={`rangeGrad-${i}`} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={lightenColor(color, 0.45)} />
            </linearGradient>
          ))}
        </defs>
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
          const laneEvents = events.filter((ev) => {
            const inTimeline = ev.timelines.some((t) => t.id === tl.id);
            if (!inTimeline) return false;

            // Tag filter
            if (tagFilterIds.length > 0) {
              const tagIds = ev.tags.map((t) => t.id);
              const matchesTags = tagFilterMode === "and"
                ? tagFilterIds.every((id) => tagIds.includes(id))
                : tagFilterIds.some((id) => tagIds.includes(id));
              if (!matchesTags) return false;
            }

            // Text filter
            if (textSearchQuery.trim()) {
              const q = textSearchQuery.toLowerCase();
              const nameMatch = ev.name.toLowerCase().includes(q);
              if (textSearchMode === "name" && !nameMatch) return false;
              if (textSearchMode === "nameAndNotes" && !nameMatch && !(ev.notes ?? "").toLowerCase().includes(q)) return false;
            }

            return true;
          });

          const labels = layoutLabels(
            laneEvents.map((ev) => ({
              id: ev.id,
              x:
                padding.left +
                xForTime(toDate(ev.startDate).getTime(), effectiveRange, innerW),
              text: ev.name,
            })),
          );

          const trackMap = assignEventTracks(laneEvents);
          const thicknessMap = assignBarThickness(laneEvents, trackMap, effectiveRange, innerW);

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
                const isThick = thicknessMap.get(ev.id) === "thick";
                const label = labels.find((l) => l.id === ev.id);
                const ly = label ? labelY(label.row, yMid) : yMid - 20;
                const trackIdx = trackMap.get(ev.id) ?? 0;
                const eventY = yMid + trackIdx * 14;
                const color = trackColor(trackIdx);

                return (
                  <g key={ev.id}>
                    {isPoint ? (
                      <>
                        <circle cx={x1} cy={eventY} r={isHover ? 7 : (isThick ? 6 : 5)} fill={color} />
                        <circle
                          cx={x1}
                          cy={eventY}
                          r={12}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                              hoverTimeoutRef.current = null;
                            }
                            setHovered(ev.id);
                          }}
                          onMouseLeave={() => {
                            hoverTimeoutRef.current = setTimeout(() => {
                              setHovered(null);
                            }, 150);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(ev.id);
                          }}
                        />
                      </>
                    ) : (
                      <>
                        <rect
                          x={Math.min(x1, x2)}
                          y={isThick ? eventY - 5 : eventY - 4}
                          width={Math.max(Math.abs(x2 - x1), 4)}
                          height={isThick ? 10 : 8}
                          fill={`url(#rangeGrad-${trackIdx})`}
                          opacity={isHover ? 1 : 0.85}
                        />
                        <rect
                          x={Math.min(x1, x2)}
                          y={eventY - 7}
                          width={Math.max(Math.abs(x2 - x1), 4)}
                          height={14}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onMouseEnter={() => {
                            if (hoverTimeoutRef.current) {
                              clearTimeout(hoverTimeoutRef.current);
                              hoverTimeoutRef.current = null;
                            }
                            setHovered(ev.id);
                          }}
                          onMouseLeave={() => {
                            hoverTimeoutRef.current = setTimeout(() => {
                              setHovered(null);
                            }, 150);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(ev.id);
                          }}
                        />
                      </>
                    )}
                    {label && (
                      <>
                        <line
                          x1={x1}
                          y1={eventY}
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
                  </g>
                );
              })}
            </g>
          );
        })}
        {hovered !== null && (() => {
          const ev = events.find((e) => e.id === hovered);
          if (!ev) return null;

          const previewDoc = ev.documents.find((d) => d.isPrimary) ?? ev.documents[0];
          const imgUrl = previewDoc?.previewUrl;

          const sy = ev.startDate;
          const ey = ev.endDate;
          const startParts = sy.split("-");
          const endParts = ey.split("-");
          const isEndDec31 = endParts[1] === "12" && endParts[2] === "31";
          const isEndJan1 = endParts[1] === "01" && endParts[2] === "01";
          let dateStr = "";
          if (isEndDec31 || isEndJan1) {
            dateStr = startParts[0] === endParts[0] ? startParts[0] : `${startParts[0]} - ${endParts[0]}`;
          } else {
            dateStr = `${formatDisplay(sy)} - ${formatDisplay(ey)}`;
          }

          const notes = ev.notes ?? "";
          const truncated = notes.length > 120 ? notes.slice(0, 120) + "…" : notes;
          const hasTags = ev.tags.length > 0;

          const cx = padding.left + xForTime(toDate(ev.startDate).getTime(), effectiveRange, innerW);
          const tlIdx = visibleTimelines.findIndex((tl) => ev.timelines.some((t) => t.id === tl.id));
          const laneIdx = tlIdx >= 0 ? tlIdx : 0;
          const yMid = padding.top + laneIdx * laneH + laneH / 2;
          const ly = yMid - 20;

          const tooltipW = 230;
          const tooltipH = 115 + (hasTags ? 28 : 0);
          const tooltipX = Math.max(padding.left + 4, cx - tooltipW / 2);
          const tooltipY = Math.max(padding.top + 4, ly - tooltipH - 14);

          return (
            <foreignObject x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH}>
              <div
                onMouseEnter={() => {
                  if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                  }
                  setHovered(ev.id);
                }}
                onMouseLeave={() => {
                  hoverTimeoutRef.current = setTimeout(() => {
                    setHovered(null);
                  }, 150);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(ev.id);
                }}
                style={{
                background: "white",
                border: "1px solid #d1d5db",
                borderRadius: "12px",
                padding: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                fontSize: "12px",
                lineHeight: 1.4,
                color: "#1e293b",
                fontFamily: "system-ui, sans-serif",
                width: "100%",
                height: "100%",
                boxSizing: "border-box",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}>
                <div style={{
                  fontWeight: 600,
                  fontSize: "12px",
                  lineHeight: 1.3,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  flexShrink: 0,
                }}>
                  {ev.name}
                </div>
                <div style={{
                  display: "flex",
                  flexDirection: "row",
                  gap: "8px",
                  flex: 1,
                  minHeight: 0,
                }}>
                  {imgUrl && (
                    <img src={imgUrl} style={{
                      width: "50px",
                      height: "50px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      flexShrink: 0,
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ color: "#475569", wordBreak: "break-word", fontWeight: 600, fontStyle: "italic" }}>
                      {dateStr}
                    </div>
                    {notes && (
                      <div style={{ color: "#64748b", wordBreak: "break-word", fontSize: "10px" }}>
                        {truncated}
                      </div>
                    )}
                  </div>
                </div>
                {hasTags && (
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "3px",
                    flexShrink: 0,
                  }}>
                    {ev.tags.map((tag) => {
                      const tagHex = tag.color.toString(16).padStart(6, "0");
                      return (
                        <span key={tag.id} style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "2px",
                          borderRadius: "4px",
                          border: "1px solid #e2e8f0",
                          padding: tag.previewUrl ? "1px" : "1px 5px",
                          fontSize: "9px",
                          lineHeight: "16px",
                          color: "#475569",
                        }}>
                          {tag.previewUrl ? (
                            <img
                              src={tag.previewUrl}
                              alt={tag.name}
                              title={tag.name}
                              style={{
                                width: "16px",
                                height: "16px",
                                objectFit: "cover",
                                borderRadius: "3px",
                                flexShrink: 0,
                              }}
                            />
                          ) : (
                            <>
                              <span style={{
                                display: "inline-block",
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                backgroundColor: `#${tagHex}`,
                              }} />
                              <span style={{ marginLeft: "3px", fontSize: "9px" }}>{tag.name}</span>
                            </>
                          )}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </foreignObject>
          );
        })()}
      </svg>
      <ZoomControls
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onScrollBack={handleScrollBack}
        onScrollForward={handleScrollForward}
      />
    </div>
  );
}
