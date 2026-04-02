import { useRef, useState, useEffect, useMemo, useCallback, memo, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';

import { formatTime } from '@/utils/time';
import type { Subtitle } from '@/utils/types';

type DragState = {
    subtitleId: number;
    edge: 'left' | 'right' | 'move';
    startX: number;
    originalStart: number;
    originalEnd: number;
};

type LassoState = {
    startX: number;
    startY: number;
    startScrollLeft: number;
    currentX: number;
    currentY: number;
    left: number;
    top: number;
    width: number;
    height: number;
};

const MIN_SUBTITLE_DURATION = 0.1;
const TRACK_HEIGHT = 36;
const RULER_HEIGHT = 24;
const TIMELINE_PADDING = 16;
const TIMELINE_OFFSET = TIMELINE_PADDING / 2;

function startDrag(cursor: string, onMove: (e: globalThis.MouseEvent) => void, onUp: () => void) {
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    const cleanup = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
    };

    const handleMouseUp = () => {
        cleanup();
        onUp();
    };

    document.body.style.cursor = cursor;
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', handleMouseUp);
}

type ResizeEdge = 'left' | 'right';

interface SubtitleBlockProps {
    sub: Subtitle;
    pps: number;
    isActive: boolean;
    isSelected: boolean;
    isDragging: boolean;
    draggingEdge?: DragState['edge'];
    hoveredEdge?: ResizeEdge;
    onDragStart: (e: MouseEvent, sub: Subtitle, edge: 'left' | 'right' | 'move') => void;
    onHover: (id: number, edge?: ResizeEdge) => void;
    onEdit: (sub: Subtitle) => void;
}

const SubtitleBlock = memo(function SubtitleBlock(props: SubtitleBlockProps) {
    const { sub, pps, isActive, isSelected, isDragging, draggingEdge, hoveredEdge, onDragStart, onHover, onEdit } = props;

    const left = sub.start * pps + TIMELINE_OFFSET;
    const width = (sub.end - sub.start) * pps;

    return (
        <div
            className={`absolute flex items-center rounded-md border select-none transition-colors ${
                isDragging
                    ? 'bg-violet-500/35 border-violet-400/60 z-10'
                    : isSelected
                      ? 'bg-violet-500/20 border-violet-400/50'
                      : isActive
                        ? 'bg-violet-500/25 border-violet-400/40'
                        : 'bg-white/[0.07] border-white/10 hover:bg-white/12 hover:border-white/20'
            }`}
            style={{ left: `${left}px`, width: `${Math.max(width, 4)}px`, top: RULER_HEIGHT + 2, height: TRACK_HEIGHT }}
        >
            <div
                className={`absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize rounded-l-md ${
                    hoveredEdge === 'left' || (isDragging && draggingEdge === 'left') ? 'bg-primary/60' : 'bg-transparent'
                }`}
                onMouseDown={e => onDragStart(e, sub, 'left')}
                onMouseEnter={() => onHover(sub.id, 'left')}
                onMouseLeave={() => onHover(sub.id)}
            />
            <div
                className="flex-1 min-w-0 px-2 cursor-grab active:cursor-grabbing h-full flex items-center"
                onMouseDown={e => onDragStart(e, sub, 'move')}
                onDoubleClick={e => {
                    e.stopPropagation();
                    onEdit(sub);
                }}
            >
                {width > 30 && <p className="truncate text-[10px] leading-none text-white/70">{sub.text}</p>}
            </div>
            <div
                className={`absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize rounded-r-md ${
                    hoveredEdge === 'right' || (isDragging && draggingEdge === 'right') ? 'bg-primary/60' : 'bg-transparent'
                }`}
                onMouseDown={e => onDragStart(e, sub, 'right')}
                onMouseEnter={() => onHover(sub.id, 'right')}
                onMouseLeave={() => onHover(sub.id)}
            />
        </div>
    );
});

interface ContextMenuState {
    x: number;
    y: number;
    time: number;
}

interface SubtitleTimelineProps {
    subtitles: Subtitle[];
    duration: number;
    currentTime: number;
    activeSubtitleId: number | null;
    onSeek: (time: number) => void;
    onSubtitleUpdate: (id: number, patch: Partial<Pick<Subtitle, 'start' | 'end'>>) => void;
    onSubtitleTextEdit: (sub: Subtitle) => void;
    onSubtitlesDelete?: (ids: number[]) => void;
    onSubtitleAdd?: (start: number, end: number) => void;
}

export default function SubtitleTimeline({
    subtitles,
    duration,
    currentTime,
    activeSubtitleId,
    onSeek,
    onSubtitleUpdate,
    onSubtitleTextEdit,
    onSubtitlesDelete,
    onSubtitleAdd
}: SubtitleTimelineProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const ppsRef = useRef(80);
    const minPpsRef = useRef(20);
    const dragRef = useRef<DragState | null>(null);
    const seekingRef = useRef(false);
    const isZoomingRef = useRef(false);
    const lassoRef = useRef<LassoState | null>(null);
    const selectedOriginalsRef = useRef<Map<number, { start: number; end: number }>>(new Map());
    const skipNextClickRef = useRef(false);

    const [pixelsPerSecond, setPixelsPerSecond] = useState(80);
    const [containerWidth, setContainerWidth] = useState(0);
    const [dragState, setDragState] = useState<DragState | null>(null);
    const [isSeeking, setIsSeeking] = useState(false);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [hoveredEdge, setHoveredEdge] = useState<{ id: number; edge: 'left' | 'right' } | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [lasso, setLasso] = useState<LassoState | null>(null);

    useEffect(() => {
        if (!contextMenu) {
            return;
        }

        const close = () => setContextMenu(null);

        document.addEventListener('click', close);
        document.addEventListener('contextmenu', close);

        return () => {
            document.removeEventListener('click', close);
            document.removeEventListener('contextmenu', close);
        };
    }, [contextMenu]);

    useEffect(() => {
        const minPps = (containerWidth - TIMELINE_PADDING) / duration;

        minPpsRef.current = Math.max(0.1, minPps);

        if (ppsRef.current < minPpsRef.current) {
            const newPps = minPpsRef.current;

            ppsRef.current = newPps;
            setPixelsPerSecond(newPps);
        }
    }, [containerWidth, duration]);

    useEffect(() => {
        if (!onSubtitlesDelete) {
            return;
        }

        function handleKeyDown(e: KeyboardEvent) {
            if (e.key !== 'Delete' && e.key !== 'Backspace') {
                return;
            }

            const tag = (e.target as HTMLElement).tagName;

            if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) {
                return;
            }

            if (selectedIds.size > 0) {
                e.preventDefault();
                onSubtitlesDelete!([...selectedIds]);
                setSelectedIds(new Set());
            } else if (activeSubtitleId) {
                e.preventDefault();
                onSubtitlesDelete!([activeSubtitleId]);
            }
        }

        document.addEventListener('keydown', handleKeyDown);

        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onSubtitlesDelete, activeSubtitleId, selectedIds]);

    const totalWidth = duration * pixelsPerSecond + TIMELINE_PADDING;
    const sortedSubtitles = useMemo(() => [...subtitles].sort((a, b) => a.start - b.start), [subtitles]);

    const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

    const updateWithPush = useCallback(
        (id: number, start: number, end: number) => {
            const index = sortedSubtitles.findIndex(sub => sub.id === id);

            if (index === -1) {
                return;
            }

            const previous = sortedSubtitles[index - 1];
            const next = sortedSubtitles[index + 1];

            if (previous && start < previous.end) {
                onSubtitleUpdate(previous.id, {
                    end: Math.max(previous.start + MIN_SUBTITLE_DURATION, start)
                });
            }

            if (next && end > next.start) {
                onSubtitleUpdate(next.id, {
                    start: Math.min(next.end - MIN_SUBTITLE_DURATION, end)
                });
            }

            onSubtitleUpdate(id, { start, end });
        },
        [sortedSubtitles, onSubtitleUpdate]
    );

    const snapTime = useCallback(
        (time: number, excludeId: number, ignoreEdge?: 'start' | 'end') => {
            let bestTime = time;
            let bestDistance = 6 / ppsRef.current;
            let snapped = false;

            for (const sub of subtitles) {
                if (sub.id === excludeId) {
                    continue;
                }

                if (ignoreEdge !== 'start') {
                    const distance = Math.abs(time - sub.start);

                    if (distance < bestDistance) {
                        bestTime = sub.start;
                        bestDistance = distance;
                        snapped = true;
                    }
                }

                if (ignoreEdge !== 'end') {
                    const distance = Math.abs(time - sub.end);

                    if (distance < bestDistance) {
                        bestTime = sub.end;
                        bestDistance = distance;
                        snapped = true;
                    }
                }
            }

            return { time: bestTime, snapped };
        },
        [subtitles]
    );

    useEffect(() => {
        const container = containerRef.current;

        if (!container || dragRef.current || seekingRef.current) {
            return;
        }

        const playheadX = currentTime * pixelsPerSecond + TIMELINE_OFFSET;

        if (!(playheadX < container.scrollLeft + containerWidth * 0.15 || playheadX > container.scrollLeft + containerWidth * 0.85)) {
            return;
        }

        container.scrollLeft = playheadX - containerWidth / 3;
    }, [currentTime, pixelsPerSecond, containerWidth]);

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const updateWidth = () => {
            setContainerWidth(container.clientWidth);
        };

        const handleResize: ResizeObserverCallback = ([entry]) => {
            setContainerWidth(entry.contentRect.width);
        };

        const handleScroll = () => {
            if (!isZoomingRef.current) {
                setScrollLeft(container.scrollLeft);
            }
        };

        updateWidth();

        const observer = new ResizeObserver(handleResize);

        observer.observe(container);
        container.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            observer.disconnect();
            container.removeEventListener('scroll', handleScroll);
        };
    }, []);

    useEffect(() => {
        const container = containerRef.current;

        if (!container) {
            return;
        }

        const getMaxScroll = (pps: number) => Math.max(0, duration * pps + TIMELINE_PADDING - container.clientWidth);

        const scrollHorizontally = (delta: number) => {
            container.scrollLeft = clamp(container.scrollLeft + delta, 0, getMaxScroll(ppsRef.current));
        };

        const zoomAtCursor = (e: WheelEvent) => {
            const rect = container.getBoundingClientRect();
            const cursorX = e.clientX - rect.left;
            const currentPps = ppsRef.current;
            const nextPps = clamp(currentPps * (e.deltaY < 0 ? 1.15 : 1 / 1.15), minPpsRef.current, Math.max(minPpsRef.current, 600));

            if (nextPps === currentPps) {
                return;
            }

            const timeAtCursor = (cursorX + container.scrollLeft - TIMELINE_OFFSET) / currentPps;
            const nextScroll = clamp(timeAtCursor * nextPps + TIMELINE_OFFSET - cursorX, 0, getMaxScroll(nextPps));

            ppsRef.current = nextPps;
            isZoomingRef.current = true;

            flushSync(() => {
                setPixelsPerSecond(nextPps);
                setScrollLeft(nextScroll);
            });

            container.scrollLeft = nextScroll;
            isZoomingRef.current = false;
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();

            if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || e.shiftKey) {
                scrollHorizontally(e.shiftKey ? e.deltaY : e.deltaX);
                return;
            }

            zoomAtCursor(e);
        };

        container.addEventListener('wheel', onWheel, { passive: false });

        return () => container.removeEventListener('wheel', onWheel);
    }, [duration]);

    const handleSubtitleMouseDown = useCallback(
        (e: MouseEvent, sub: Subtitle, edge: 'left' | 'right' | 'move') => {
            e.stopPropagation();
            e.preventDefault();

            let newSelected: Set<number>;

            if (!(e.shiftKey || e.ctrlKey || e.metaKey)) {
                newSelected = selectedIds.has(sub.id) ? selectedIds : new Set([sub.id]);
            } else {
                newSelected = new Set(selectedIds);

                if (selectedIds.has(sub.id)) {
                    newSelected.delete(sub.id);
                } else {
                    newSelected.add(sub.id);
                }
            }

            setSelectedIds(newSelected);

            const isMultiDrag = edge === 'move' && newSelected.size > 1 && newSelected.has(sub.id);

            if (isMultiDrag) {
                const originals = new Map<number, { start: number; end: number }>();

                for (const s of subtitles) {
                    if (newSelected.has(s.id)) {
                        originals.set(s.id, { start: s.start, end: s.end });
                    }
                }

                selectedOriginalsRef.current = originals;
            }

            const state: DragState = {
                subtitleId: sub.id,
                edge,
                startX: e.clientX,
                originalStart: sub.start,
                originalEnd: sub.end
            };

            dragRef.current = state;
            setDragState(state);
            setHoveredEdge(null);

            startDrag(
                edge === 'move' ? 'grabbing' : 'ew-resize',
                ev => {
                    const current = dragRef.current;

                    if (!current) {
                        return;
                    }

                    const dt = (ev.clientX - current.startX) / ppsRef.current;

                    if (current.edge === 'left') {
                        updateWithPush(
                            current.subtitleId,
                            snapTime(
                                Math.max(0, Math.min(current.originalEnd - MIN_SUBTITLE_DURATION, current.originalStart + dt)),
                                current.subtitleId,
                                'start'
                            ).time,
                            current.originalEnd
                        );
                    } else if (current.edge === 'right') {
                        updateWithPush(
                            current.subtitleId,
                            current.originalStart,
                            snapTime(
                                Math.max(current.originalStart + MIN_SUBTITLE_DURATION, Math.min(duration, current.originalEnd + dt)),
                                current.subtitleId,
                                'end'
                            ).time
                        );
                    } else if (isMultiDrag) {
                        const originals = selectedOriginalsRef.current;
                        const selectedIdSet = new Set(originals.keys());

                        const getGroupBounds = () => {
                            let min = Infinity;
                            let max = -Infinity;

                            for (const { start, end } of originals.values()) {
                                min = Math.min(min, start);
                                max = Math.max(max, end);
                            }

                            return { min, max };
                        };

                        const findSnapDelta = (baseDt: number, threshold: number) => {
                            let bestDist = threshold;
                            let bestDelta = 0;

                            for (const orig of originals.values()) {
                                const movedStart = orig.start + baseDt;
                                const movedEnd = orig.end + baseDt;

                                for (const sub of subtitles) {
                                    if (selectedIdSet.has(sub.id)) {
                                        continue;
                                    }

                                    for (const edge of [sub.start, sub.end]) {
                                        const startDist = Math.abs(movedStart - edge);
                                        const endDist = Math.abs(movedEnd - edge);

                                        if (startDist < bestDist) {
                                            bestDist = startDist;
                                            bestDelta = edge - movedStart;
                                        }

                                        if (endDist < bestDist) {
                                            bestDist = endDist;
                                            bestDelta = edge - movedEnd;
                                        }
                                    }
                                }
                            }

                            return bestDist < threshold ? bestDelta : 0;
                        };

                        const { min: groupMin, max: groupMax } = getGroupBounds();

                        let clampedDt = Math.max(-groupMin, Math.min(duration - groupMax, dt));
                        const snapDelta = findSnapDelta(clampedDt, 6 / ppsRef.current);

                        if (snapDelta !== 0 && groupMin + clampedDt + snapDelta >= 0 && groupMax + clampedDt + snapDelta <= duration) {
                            clampedDt += snapDelta;
                        }

                        for (const [id, orig] of originals) {
                            onSubtitleUpdate(id, {
                                start: orig.start + clampedDt,
                                end: orig.end + clampedDt
                            });
                        }
                    } else {
                        const dur = current.originalEnd - current.originalStart;
                        let nS = Math.max(0, Math.min(duration - dur, current.originalStart + dt));
                        let nE = nS + dur;
                        const snapS = snapTime(nS, current.subtitleId);

                        if (snapS.snapped) {
                            nS = snapS.time;
                            nE = nS + dur;
                        } else {
                            const snapE = snapTime(nE, current.subtitleId);

                            if (snapE.snapped) {
                                nE = snapE.time;
                                nS = nE - dur;
                            }
                        }

                        updateWithPush(current.subtitleId, nS, nE);
                    }
                },
                () => {
                    dragRef.current = null;
                    setDragState(null);
                    selectedOriginalsRef.current = new Map();
                    skipNextClickRef.current = true;
                }
            );
        },
        [duration, snapTime, updateWithPush, selectedIds, subtitles, onSubtitleUpdate]
    );

    const handleSubtitleHover = useCallback((id: number, edge?: ResizeEdge) => {
        if (dragRef.current) {
            return;
        }

        setHoveredEdge(edge ? { id, edge } : null);
    }, []);

    const handleSubtitleEdit = useCallback(
        (sub: Subtitle) => {
            onSubtitleTextEdit(sub);
        },
        [onSubtitleTextEdit]
    );

    const rulerTicks = useMemo(() => {
        if (!containerWidth) {
            return null;
        }

        const interval = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300].find(i => i >= 80 / pixelsPerSecond) ?? 300;
        const start = Math.floor(Math.max(0, scrollLeft - TIMELINE_OFFSET) / pixelsPerSecond / interval) * interval;
        const end = (scrollLeft + containerWidth) / pixelsPerSecond + interval;

        return Array.from({ length: Math.ceil((end - start) / interval) }, (_, i) => start + i * interval)
            .filter(t => t >= 0 && t <= duration)
            .map(t => (
                <div
                    key={t}
                    className="absolute top-0 flex flex-col items-center"
                    style={{ left: `${t * pixelsPerSecond + TIMELINE_OFFSET}px`, height: RULER_HEIGHT }}
                >
                    <div className="h-2.5 w-px bg-white/20" />
                    <span className="mt-0.5 text-[9px] font-mono text-white/30 select-none whitespace-nowrap">{formatTime(t)}</span>
                </div>
            ));
    }, [scrollLeft, duration, pixelsPerSecond, containerWidth]);

    const getTimeFromClientX = (clientX: number) => {
        const container = containerRef.current;

        if (!container) {
            return 0;
        }

        const rect = container.getBoundingClientRect();
        const x = clientX - rect.left + container.scrollLeft - TIMELINE_OFFSET;

        return clamp(x / ppsRef.current, 0, duration);
    };

    const handleTimelineClick = (e: MouseEvent<HTMLDivElement>) => {
        if (skipNextClickRef.current) {
            skipNextClickRef.current = false;
            return;
        }

        if (dragRef.current || seekingRef.current || lassoRef.current) {
            return;
        }

        setSelectedIds(new Set());
        onSeek(getTimeFromClientX(e.clientX));
    };

    const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
        if (!onSubtitleAdd) {
            return;
        }

        e.preventDefault();

        const time = getTimeFromClientX(e.clientX);

        if (subtitles.some(sub => time >= sub.start && time <= sub.end)) {
            return;
        }

        setContextMenu({ x: e.clientX, y: e.clientY, time });
    };

    const handlePlayheadMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        e.preventDefault();

        seekingRef.current = true;
        setIsSeeking(true);

        startDrag(
            'ew-resize',
            ev => onSeek(getTimeFromClientX(ev.clientX)),
            () => {
                seekingRef.current = false;
                setIsSeeking(false);
            }
        );
    };

    const handleTrackMouseDown = (e: MouseEvent<HTMLDivElement>) => {
        if (e.button !== 0 || dragRef.current || seekingRef.current) {
            return;
        }

        const container = containerRef.current;

        if (!container) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        const state: LassoState = {
            startX: e.clientX,
            startY: e.clientY,
            startScrollLeft: container.scrollLeft,
            currentX: e.clientX,
            currentY: e.clientY,
            left: 0,
            top: 0,
            width: 0,
            height: 0
        };

        lassoRef.current = state;
        setLasso(state);

        startDrag(
            'crosshair',
            ev => {
                const current = lassoRef.current;
                const container = containerRef.current;

                if (!current || !container) {
                    return;
                }

                const rect = container.getBoundingClientRect();
                const x1 = current.startX - rect.left + current.startScrollLeft;
                const x2 = ev.clientX - rect.left + container.scrollLeft;
                const y1 = current.startY - rect.top;
                const y2 = ev.clientY - rect.top;

                const updated: LassoState = {
                    ...current,
                    currentX: ev.clientX,
                    currentY: ev.clientY,
                    left: Math.min(x1, x2),
                    top: Math.min(y1, y2),
                    width: Math.abs(x2 - x1),
                    height: Math.abs(y2 - y1)
                };

                lassoRef.current = updated;
                setLasso(updated);

                const timeLeft = Math.min((x1 - TIMELINE_OFFSET) / ppsRef.current, (x2 - TIMELINE_OFFSET) / ppsRef.current);
                const timeRight = Math.max((x1 - TIMELINE_OFFSET) / ppsRef.current, (x2 - TIMELINE_OFFSET) / ppsRef.current);

                setSelectedIds(new Set(subtitles.filter(sub => sub.end > timeLeft && sub.start < timeRight).map(sub => sub.id)));
            },
            () => {
                const current = lassoRef.current;

                lassoRef.current = null;
                setLasso(null);

                if (current && Math.abs(current.currentX - current.startX) >= 3) {
                    skipNextClickRef.current = true;
                } else {
                    setSelectedIds(new Set());
                    onSeek(getTimeFromClientX(current?.startX ?? 0));
                }
            }
        );
    };

    return (
        <div className="flex flex-col">
            <div
                ref={containerRef}
                className="relative overflow-x-auto overflow-y-hidden scrollbar-dark"
                style={{ height: RULER_HEIGHT + TRACK_HEIGHT + 20 }}
                onClick={handleTimelineClick}
                onContextMenu={handleContextMenu}
            >
                <div
                    className="relative"
                    style={{ width: `${totalWidth}px`, height: '100%', minWidth: '100%' }}
                >
                    <div
                        className="absolute inset-x-0 top-0"
                        style={{ height: RULER_HEIGHT }}
                    >
                        {rulerTicks}
                    </div>

                    <div
                        className="absolute rounded bg-white/2"
                        style={{ top: RULER_HEIGHT + 2, height: TRACK_HEIGHT, left: TIMELINE_OFFSET, right: TIMELINE_OFFSET }}
                        onMouseDown={handleTrackMouseDown}
                    />

                    {subtitles.map(sub => (
                        <SubtitleBlock
                            key={sub.id}
                            sub={sub}
                            pps={pixelsPerSecond}
                            isActive={activeSubtitleId === sub.id}
                            isSelected={selectedIds.has(sub.id)}
                            isDragging={dragState?.subtitleId === sub.id}
                            draggingEdge={dragState?.edge}
                            hoveredEdge={hoveredEdge?.id === sub.id ? hoveredEdge.edge : undefined}
                            onDragStart={handleSubtitleMouseDown}
                            onHover={handleSubtitleHover}
                            onEdit={handleSubtitleEdit}
                        />
                    ))}

                    <div
                        className={`absolute top-0 bottom-0 z-20 ${isSeeking ? '' : 'cursor-ew-resize'}`}
                        style={{ left: `${currentTime * pixelsPerSecond + TIMELINE_OFFSET - 7}px`, width: '15px' }}
                        onMouseDown={handlePlayheadMouseDown}
                    >
                        <div
                            className="absolute top-0 w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-primary"
                            style={{ left: '2.5px' }}
                        />
                        <div
                            className="absolute top-0 bottom-0 w-px bg-primary"
                            style={{ left: '7px' }}
                        />
                    </div>

                    {lasso && (
                        <div
                            className="absolute bg-violet-400/10 border border-violet-400/30 rounded-sm pointer-events-none"
                            style={{
                                left: lasso.left,
                                top: lasso.top,
                                width: lasso.width,
                                height: lasso.height
                            }}
                        />
                    )}
                </div>
            </div>

            {contextMenu && (
                <div
                    className="fixed z-50 min-w-45 rounded-lg border border-white/10 bg-[#1a1a1e] py-1 shadow-xl"
                    style={{ left: contextMenu.x, top: contextMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <button
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-xs text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                        onClick={() => {
                            const time = contextMenu.time;
                            const next = [...subtitles].sort((a, b) => a.start - b.start).find(s => s.start > time);

                            setContextMenu(null);
                            onSubtitleAdd!(time, Math.min(time + 1, next ? next.start : duration));
                        }}
                    >
                        <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M12 4.5v15m7.5-7.5h-15"
                            />
                        </svg>
                        Insérer un sous-titre
                    </button>
                </div>
            )}
        </div>
    );
}
