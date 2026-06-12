import { useQuery } from "@tanstack/react-query";
import { formatCenturyYear, formatDisplay, fromStorage, toDate } from "@timeline/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/api/client";
import { assignBarThickness, assignEventTracks } from "./eventLayout";
import { labelY, layoutLabels } from "./labelLayout";
import { ZoomControls } from "./ZoomControls";
import { MarkdownView } from "@/components/MarkdownView";
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
  const GAP = 6;
  const laneH = (size.h - padding.top - padding.bottom - GAP * Math.max(0, laneCount - 1)) / laneCount;

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
          const y0 = padding.top + li * (laneH + GAP);
          const y1 = y0 + laneH;
          if (yRel >= y0 && yRel <= y1) {
            targetTimelineId = visibleTimelines[li].id;
            break;
          }
        }
        if (targetTimelineId === null) return;

        const innerX = xRel - padding.left;
        const ms = timeForX(innerX, effectiveRange, innerW);
        const d = new Date(Math.round(ms));
        const y = d.getUTCFullYear();
        const yStr = y < 0 ? "-" + String(-y).padStart(4, "0") : String(y).padStart(4, "0");
        const iso = `${yStr}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
        const displayDate = (() => {
          try { return formatDisplay(iso); } catch { return iso; }
        })();
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
          <text
            key={i}
            x={padding.left + t.x}
            y={padding.top - 8}
            textAnchor="middle"
            fontSize={11}
            fill="#64748b"
          >
            {t.label}
          </text>
        ))}

        {visibleTimelines.map((tl, li) => {
          const y0 = padding.top + li * (laneH + GAP);
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
              {li < visibleTimelines.length - 1 && (
                <rect
                  x={padding.left}
                  y={y0 + laneH}
                  width={innerW}
                  height={GAP}
                  fill="#ffffff"
                  stroke="#cbd5e1"
                />
              )}
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

              {ticks.map((t, gi) => (
                <line
                  key={gi}
                  x1={padding.left + t.x}
                  y1={y0}
                  x2={padding.left + t.x}
                  y2={y0 + laneH + (li < visibleTimelines.length - 1 ? GAP : 0)}
                  stroke="#94a3b8"
                  strokeWidth={0.5}
                  opacity={0.2}
                />
              ))}
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
                        {isHover && (
                          <circle
                            cx={x1}
                            cy={eventY}
                            r={(isHover ? 7 : (isThick ? 6 : 5)) + 4}
                            fill="none"
                            stroke="#9ca3af"
                            strokeWidth={1.5}
                            strokeDasharray="6 4"
                          />
                        )}
                        <circle cx={x1} cy={eventY} r={isHover ? 7 : (isThick ? 6 : 5)} fill={isHover ? "#f97316" : color} />
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
                        {isHover && (
                          <rect
                            x={Math.min(x1, x2) - 4}
                            y={(isThick ? eventY - 5 : eventY - 4) - 4}
                            width={Math.max(Math.abs(x2 - x1), 4) + 8}
                            height={(isThick ? 10 : 8) + 8}
                            fill="none"
                            stroke="#9ca3af"
                            strokeWidth={1.5}
                            strokeDasharray="6 4"
                          />
                        )}
                        <rect
                          x={Math.min(x1, x2)}
                          y={isThick ? eventY - 5 : eventY - 4}
                          width={Math.max(Math.abs(x2 - x1), 4)}
                          height={isThick ? 10 : 8}
                          fill={isHover ? "#f97316" : `url(#rangeGrad-${trackIdx})`}
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
        {/* Connection lines for dependencies */}
        {hovered !== null && (() => {
          const ev = events.find((e) => e.id === hovered);
          if (!ev) return null;

          const cx = padding.left + xForTime(toDate(ev.startDate).getTime(), effectiveRange, innerW);
          const tlIdx = visibleTimelines.findIndex((tl) => ev.timelines.some((t) => t.id === tl.id));
          const laneIdx = tlIdx >= 0 ? tlIdx : 0;
          const yMid = padding.top + laneIdx * (laneH + GAP) + laneH / 2;

          return (
            <g key="dep-lines">
              {(ev.dependencies ?? []).map((dep) => {
                const depEv = events.find((e) => e.id === dep.depEventId);
                if (!depEv) return null;
                const depTlIdx = visibleTimelines.findIndex((tl) => depEv.timelines.some((t) => t.id === tl.id));
                if (depTlIdx < 0) return null;
                const depYMid = padding.top + depTlIdx * (laneH + GAP) + laneH / 2;
                const depX = padding.left + xForTime(toDate(depEv.startDate).getTime(), effectiveRange, innerW);
                const mx = (cx + depX) / 2;
                const isComposition = dep.dependencyType === "part_of" || dep.dependencyType === "contains";
                const color = isComposition ? "#2563eb" : "#d97706";
                const dash = isComposition ? "none" : "6 4";

                return (
                  <path
                    key={dep.depEventId}
                    d={`M ${cx} ${yMid} Q ${mx} ${(yMid + depYMid) / 2} ${depX} ${depYMid}`}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray={dash}
                    opacity={0.7}
                    style={{ pointerEvents: "none" }}
                  />
                );
              })}
            </g>
          );
        })()}
        {hovered !== null && (() => {
          const ev = events.find((e) => e.id === hovered);
          if (!ev) return null;

          const previewDoc = ev.documents.find((d) => d.isPrimary && d.resourceType === "image");
          const imgUrl = previewDoc?.previewUrl;

          const sy = ev.startDate;
          const ey = ev.endDate;
          const startDate = fromStorage(sy);
          const endDate = fromStorage(ey);
          const isEndDec31 = endDate.month === 12 && endDate.day === 31;
          const isEndJan1 = endDate.month === 1 && endDate.day === 1;
          let dateStr = "";
          if (isEndDec31 || isEndJan1) {
            const sya = startDate.year;
            const eya = endDate.year;
            const yr = (y: number) => y < 0 ? `${-y} г днэ` : `${y} г`;
            const startIsJan1 = startDate.month === 1 && startDate.day === 1;
            const endIsJan1 = endDate.month === 1 && endDate.day === 1;
            const startCentury = startIsJan1 ? formatCenturyYear(startDate.year) : null;
            const endCentury = endIsJan1 ? formatCenturyYear(endDate.year) : null;
            if (startCentury && endCentury && sya === eya) {
              dateStr = startCentury;
            } else if (startCentury && endCentury) {
              dateStr = `${startCentury} - ${endCentury}`;
            } else if (startCentury && !endCentury) {
              dateStr = `${startCentury} - ${yr(eya)}`;
            } else if (!startCentury && endCentury) {
              dateStr = `${yr(sya)} - ${endCentury}`;
            } else {
              dateStr = sya === eya ? yr(sya) : `${yr(sya)} - ${yr(eya)}`;
            }
          } else {
            dateStr = sy === ey ? formatDisplay(sy) : `${formatDisplay(sy)} - ${formatDisplay(ey)}`;
          }

          const notes = ev.notes ?? "";
          const hasTags = ev.tags.length > 0;

          const cx = padding.left + xForTime(toDate(ev.startDate).getTime(), effectiveRange, innerW);
          const tlIdx = visibleTimelines.findIndex((tl) => ev.timelines.some((t) => t.id === tl.id));
          const laneIdx = tlIdx >= 0 ? tlIdx : 0;
          const yMid = padding.top + laneIdx * (laneH + GAP) + laneH / 2;
          const ly = yMid - 20;

          const tooltipW = 345;
          const tooltipH = 230 + (hasTags ? 21 : 0);
          const workspaceMid = padding.left + innerW / 2;
          const tooltipX = cx < workspaceMid
            ? Math.max(padding.left + 4, cx + 100)
            : Math.min(cx - tooltipW - 100, padding.left + innerW - tooltipW - 4);
          const tooltipY = Math.min(
            Math.max(padding.top + 4, ly - tooltipH - 14),
            padding.top + laneIdx * (laneH + GAP) + laneH - tooltipH - 4,
          );

          const lineX = tooltipX + tooltipW / 2;
          const lineY1 = tooltipY + tooltipH;
          const lineY2 = ly;

          return (
            <>
              {/* Connecting line */}
              <line
                x1={lineX} y1={lineY1}
                x2={lineX} y2={lineY2}
                stroke="#94a3b8"
                strokeWidth={1}
                strokeDasharray="3 3"
                style={{ animation: "tooltip-in 0.2s ease-out forwards" }}
              />
            <foreignObject x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH}>
              <div
                className="tooltip-enter"
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
                  fontSize: "14px",
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
                      <div style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 10,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}>
                        <MarkdownView content={notes} compact />
                      </div>
                    )}
                  </div>
                </div>
                <div style={{
                  flexShrink: 0,
                  borderTop: hasTags ? "1px solid #e2e8f0" : "none",
                  paddingTop: hasTags ? "4px" : 0,
                  marginTop: "auto",
                }}>
                  {hasTags && (
                    <div style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "3px",
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
              </div>
            </foreignObject>
          </>
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
