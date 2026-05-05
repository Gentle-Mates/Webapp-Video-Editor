'use client';

import { useEffect, useRef } from 'react';
import { Film, Smartphone } from 'lucide-react';

import type { EditorMode } from '@/utils/types';

interface ModeSelectionModalProps {
    onSelect: (mode: EditorMode) => void;
}

export default function ModeSelectionModal({ onSelect }: ModeSelectionModalProps) {
    const defaultButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        defaultButtonRef.current?.focus();
    }, []);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-elevated p-6 shadow-2xl">
                <h2 className="mb-1 text-sm font-semibold text-white">Que veux-tu faire ?</h2>
                <p className="mb-5 text-xs text-white/40">Choisis le format de ta vidéo.</p>

                <div className="grid grid-cols-2 gap-3">
                    <button
                        ref={defaultButtonRef}
                        onClick={() => onSelect('subtitles')}
                        className="group flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/2 p-5 transition-all hover:border-primary/50 hover:bg-white/4 focus-visible:border-primary focus-visible:bg-white/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-white/10">
                            <Film
                                className="h-7 w-7 text-primary"
                                strokeWidth={1.5}
                            />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-white/90">Sous-titrage</p>
                            <p className="mt-1 text-xxs text-white/40">Format 16:9</p>
                        </div>
                    </button>

                    <button
                        onClick={() => onSelect('short')}
                        className="group flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/2 p-5 transition-all hover:border-primary/50 hover:bg-white/4 focus-visible:border-primary focus-visible:bg-white/4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-white/10">
                            <Smartphone
                                className="h-7 w-7 text-primary"
                                strokeWidth={1.5}
                            />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-white/90">Short</p>
                            <p className="mt-1 text-xxs text-white/40">Format 9:16</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
