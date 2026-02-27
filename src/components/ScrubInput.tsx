import { useRef, useState, type MouseEvent } from 'react';

import { formatTime, parseTime } from '@/utils/time';

interface ScrubInputProps {
    value: string;
    onChange: (v: string) => void;
    onCommit: () => void;
    onCancel: () => void;
    label: string;
    onSetCurrent: () => void;
}

export default function ScrubInput({ value, onChange, onCommit, onCancel, label, onSetCurrent }: ScrubInputProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const dragStartX = useRef(0);
    const dragStartValue = useRef(0);
    const hasDragged = useRef(false);
    const inputRef = useRef<HTMLInputElement>(null);

    function handleMouseDown(e: MouseEvent) {
        if (isEditing) {
            return;
        }

        const parsed = parseTime(value);
        if (!parsed) {
            return;
        }

        dragStartX.current = e.clientX;
        dragStartValue.current = parsed;
        hasDragged.current = false;

        const handleMouseMove = (ev: globalThis.MouseEvent) => {
            const dx = ev.clientX - dragStartX.current;

            if (!hasDragged.current && Math.abs(dx) < 3) {
                return;
            }

            if (!hasDragged.current) {
                hasDragged.current = true;

                setIsDragging(true);

                document.body.style.cursor = 'ew-resize';
                document.body.style.userSelect = 'none';
            }

            onChange(formatTime(Math.max(0, dragStartValue.current + dx * (ev.shiftKey ? 0.1 : 0.01))));
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            if (!hasDragged.current) {
                setIsEditing(true);
                setTimeout(() => inputRef.current?.select(), 0);
            }

            setIsDragging(false);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    return (
        <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-medium text-white/40 w-8 shrink-0">{label}</span>
            <div
                className="relative group"
                onMouseDown={isEditing ? undefined : handleMouseDown}
            >
                <input
                    ref={inputRef}
                    type="text"
                    value={value}
                    readOnly={!isEditing}
                    onChange={e => onChange(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            setIsEditing(false);
                            onCommit();
                        }

                        if (e.key === 'Escape') {
                            setIsEditing(false);
                            onCancel();
                        }
                    }}
                    onBlur={() => {
                        if (isEditing) {
                            setIsEditing(false);
                        }
                    }}
                    className={`h-6 w-24 rounded border-none px-2 text-center text-[11px] font-mono text-white outline-none transition-all ${
                        isEditing || isDragging
                            ? 'bg-white/15 ring-1 ring-inset ring-primary'
                            : 'bg-white/10 text-white/80 cursor-ew-resize hover:bg-white/15 select-none'
                    }`}
                />

                {/* Drag hint arrows */}
                {!isEditing && (
                    <>
                        <div
                            className={`absolute inset-y-0 left-0.5 flex items-center pointer-events-none transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                        >
                            <svg
                                className="h-2.5 w-2.5 text-white/50"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z" />
                            </svg>
                        </div>
                        <div
                            className={`absolute inset-y-0 right-0.5 flex items-center pointer-events-none transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'}`}
                        >
                            <svg
                                className="h-2.5 w-2.5 text-white/50"
                                fill="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                            </svg>
                        </div>
                    </>
                )}
            </div>

            <button
                onClick={onSetCurrent}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-white/10 text-white/40 transition-all hover:bg-white/15 hover:text-white/70"
                title="Utiliser le temps actuel"
            >
                <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                </svg>
            </button>
        </div>
    );
}
