'use client';

import { useState } from 'react';
import { X, Trash2, Plus, Loader2 } from 'lucide-react';

interface SettingsModalProps {
    allowedEmails: string[];
    contextWords: string[];
    saving: boolean;
    onUpdate: (patch: { allowedEmails?: string[]; contextWords?: string[] }) => Promise<boolean>;
    onClose: () => void;
}

function isValidEmail(email: string) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function SettingsModal({ allowedEmails, contextWords, saving, onUpdate, onClose }: SettingsModalProps) {
    const [emails, setEmails] = useState<string[]>(allowedEmails);
    const [words, setWords] = useState<string[]>(contextWords);
    const [emailInput, setEmailInput] = useState('');
    const [wordInput, setWordInput] = useState('');
    const [emailError, setEmailError] = useState('');

    function addEmail() {
        const trimmed = emailInput.trim().toLowerCase();

        setEmailError('');

        if (!trimmed) return;

        if (!isValidEmail(trimmed)) {
            setEmailError("Format d'email invalide");
            return;
        }

        if (emails.includes(trimmed)) {
            setEmailError('Email déjà ajouté');
            return;
        }

        setEmails(prev => [...prev, trimmed]);
        setEmailInput('');
    }

    function removeEmail(email: string) {
        setEmails(prev => prev.filter(e => e !== email));
    }

    function addWord() {
        const trimmed = wordInput.trim();

        if (!trimmed || words.some(w => w.toLowerCase() === trimmed.toLowerCase())) {
            return;
        }

        setWords(prev => [...prev, trimmed]);
        setWordInput('');
    }

    function removeWord(word: string) {
        setWords(prev => prev.filter(w => w !== word));
    }

    async function handleSave() {
        const success = await onUpdate({ allowedEmails: emails, contextWords: words });

        if (success) {
            onClose();
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onPointerDown={onClose}
        >
            <div
                className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#141416] p-6 shadow-2xl [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]"
                onPointerDown={e => e.stopPropagation()}
            >
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Settings</h2>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-white/40 transition-all hover:bg-white/5 hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Allowed Emails */}
                <div className="mb-5">
                    <h3 className="mb-1 text-xs font-medium text-white/80">Allowed Emails</h3>
                    <p className="mb-3 text-[11px] text-white/40">Emails autorisés à se connecter (en plus des comptes @gentlemates.com).</p>

                    <form
                        className="mb-3 flex gap-2"
                        onSubmit={e => {
                            e.preventDefault();
                            addEmail();
                        }}
                    >
                        <div className="flex-1">
                            <input
                                type="email"
                                value={emailInput}
                                onChange={e => {
                                    setEmailInput(e.target.value);
                                    setEmailError('');
                                }}
                                placeholder="email@exemple.com"
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none transition-all focus:border-white/20"
                            />
                            {emailError && <p className="mt-1 text-[10px] text-red-400">{emailError}</p>}
                        </div>
                        <button
                            type="submit"
                            disabled={!emailInput.trim()}
                            className="flex items-center gap-1 self-start rounded-lg bg-primary/85 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className="h-3 w-3" />
                            Ajouter
                        </button>
                    </form>

                    <div className="max-h-36 space-y-1 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
                        {emails.map(email => (
                            <div
                                key={email}
                                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2 transition-all hover:bg-white/5"
                            >
                                <span className="text-xs text-white/70">{email}</span>
                                <button
                                    onClick={() => removeEmail(email)}
                                    className="rounded-md p-1 text-white/20 transition-all hover:bg-white/10 hover:text-red-400"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </button>
                            </div>
                        ))}
                        {emails.length === 0 && <p className="py-4 text-center text-xs text-white/30">Aucun email ajouté</p>}
                    </div>
                </div>

                {/* Context Words */}
                <div>
                    <h3 className="mb-1 text-xs font-medium text-white/80">Context Words</h3>
                    <p className="mb-3 text-[11px] text-white/40">Mots de contexte par défaut pour la transcription.</p>

                    <form
                        className="mb-3 flex gap-2"
                        onSubmit={e => {
                            e.preventDefault();
                            addWord();
                        }}
                    >
                        <input
                            type="text"
                            value={wordInput}
                            onChange={e => setWordInput(e.target.value)}
                            placeholder="Ajouter un mot..."
                            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-white/30 outline-none transition-all focus:border-white/20"
                        />
                        <button
                            type="submit"
                            disabled={!wordInput.trim()}
                            className="flex items-center gap-1 rounded-lg bg-primary/85 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className="h-3 w-3" />
                            Ajouter
                        </button>
                    </form>

                    <div className="max-h-60 flex flex-wrap gap-1.5 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.15)_transparent]">
                        {words.map(word => (
                            <div
                                key={word}
                                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 transition-all hover:bg-white/10"
                            >
                                <span className="text-[11px] text-white/80">{word}</span>
                                <button
                                    onClick={() => removeWord(word)}
                                    className="ml-0.5 rounded-full p-0.5 text-white/30 transition-all hover:bg-white/10 hover:text-red-400"
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </div>
                        ))}
                        {words.length === 0 && <p className="w-full py-4 text-center text-xs text-white/30">Aucun mot de contexte</p>}
                    </div>
                </div>

                <div className="mt-5 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 rounded-lg bg-primary/85 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-primary disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                        Sauvegarder
                    </button>
                </div>
            </div>
        </div>
    );
}
