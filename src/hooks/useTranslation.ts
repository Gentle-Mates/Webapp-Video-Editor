import { useState } from 'react';

import type { Subtitle, TranslationMode } from '@/utils/types';

export default function useTranslation() {
    const [translations, setTranslations] = useState<Record<TranslationMode, Subtitle[]>>({ mix: [], fr: [], en: [] });
    const [isTranslating, setIsTranslating] = useState(false);

    async function translate(subtitles: Subtitle[], mode: TranslationMode, forceRefresh = false): Promise<boolean> {
        if (subtitles.length === 0 || isTranslating) {
            return false;
        }

        if (!forceRefresh && translations[mode].length > 0) {
            return true;
        }

        setIsTranslating(true);

        try {
            const response = await fetch('/api/translate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subtitles, mode })
            });

            if (!response.ok) {
                console.error('Translation error:', response.status);

                return false;
            }

            const data: Subtitle[] = await response.json();

            setTranslations(prev => ({ ...prev, [mode]: data }));

            return true;
        } catch (err) {
            console.error('Translation error:', err);

            return false;
        } finally {
            setIsTranslating(false);
        }
    }

    function syncTimings(id: number, updates: { start?: number; end?: number }) {
        if (!updates.start && !updates.end) {
            return;
        }

        setTranslations(prev => {
            const next = { ...prev };

            for (const mode of ['mix', 'fr', 'en'] as const) {
                if (prev[mode].length > 0) {
                    next[mode] = prev[mode].map(sub => (sub.id === id ? { ...sub, ...updates } : sub));
                }
            }

            return next;
        });
    }

    function updateTranslatedSubtitle(mode: TranslationMode, id: number, patch: Partial<Pick<Subtitle, 'text' | 'start' | 'end'>>) {
        setTranslations(prev => ({
            ...prev,
            [mode]: prev[mode].map(sub => (sub.id === id ? { ...sub, ...patch } : sub))
        }));
    }

    function addTranslatedSubtitle(subtitle: Subtitle) {
        setTranslations(prev => {
            const next = { ...prev };

            for (const mode of ['mix', 'fr', 'en'] as const) {
                if (prev[mode].length > 0) {
                    next[mode] = [...prev[mode], subtitle].sort((a, b) => a.start - b.start);
                }
            }

            return next;
        });
    }

    function deleteTranslatedSubtitle(id: number) {
        setTranslations(prev => {
            const next = { ...prev };

            for (const mode of ['mix', 'fr', 'en'] as const) {
                if (prev[mode].length > 0) {
                    next[mode] = prev[mode].filter(sub => sub.id !== id);
                }
            }

            return next;
        });
    }

    function restoreTranslatedSubtitles(mapping: Partial<Record<TranslationMode, Subtitle>>) {
        setTranslations(prev => {
            const next = { ...prev };

            for (const [mode, sub] of Object.entries(mapping)) {
                if (sub) {
                    const typedMode = mode as TranslationMode;

                    if (prev[typedMode].some(s => s.id === sub.id)) {
                        continue;
                    }

                    next[typedMode] = [...prev[typedMode], sub].sort((a, b) => a.start - b.start);
                }
            }

            return next;
        });
    }

    function resetTranslations() {
        setTranslations({ mix: [], fr: [], en: [] });
    }

    return {
        translations,
        isTranslating,
        translate,
        syncTimings,
        updateTranslatedSubtitle,
        addTranslatedSubtitle,
        deleteTranslatedSubtitle,
        restoreTranslatedSubtitles,
        resetTranslations
    };
}
