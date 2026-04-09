'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface ContextWordsModalProps {
    words: string[];
    maxWords: number;
    onAdd: (word: string) => boolean;
    onRemove: (word: string) => void;
    onClose: () => void;
}

export default function ContextWordsModal({ words, maxWords, onAdd, onRemove, onClose }: ContextWordsModalProps) {
    const [input, setInput] = useState('');

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onPointerDown={onClose}
        >
            <div
                className="w-full max-w-md rounded-2xl border border-white/10 bg-[#141416] p-6 shadow-2xl"
                onPointerDown={e => e.stopPropagation()}
            >
                <div className="mb-1 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Mots de contexte</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/5 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <p className="mb-4 text-xs text-white/40">Aide la transcription a mieux reconnaître ces mots.</p>

                <form
                    className="mb-4 flex gap-2"
                    onSubmit={e => {
                        e.preventDefault();

                        if (onAdd(input)) {
                            setInput('');
                        }
                    }}
                >
                    <input
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="Ajouter un mot..."
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none transition-all focus:border-white/20"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || words.length >= maxWords}
                        className="rounded-lg bg-primary/85 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        Ajouter
                    </button>
                </form>

                <div className="max-h-64 flex flex-wrap gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
                    {words.map(word => (
                        <div
                            key={word}
                            className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 transition-all hover:bg-white/10"
                        >
                            <span className="text-[11px] text-white/80">{word}</span>
                            <button
                                onClick={() => onRemove(word)}
                                className="ml-0.5 rounded-full p-0.5 text-white/30 transition-all hover:bg-white/10 hover:text-red-400"
                            >
                                <X className="h-2.5 w-2.5" strokeWidth={2.5} />
                            </button>
                        </div>
                    ))}
                    {words.length === 0 && <p className="py-4 text-center text-xs text-white/30">Aucun mot de contexte</p>}
                </div>

                <div className="mt-4 text-right text-[10px] text-white/30">
                    {words.length} / {maxWords} mots
                </div>
            </div>
        </div>
    );
}
