import { useRef, useState } from 'react';

import { extractAudioFromVideo } from '@/utils/audio';
import { applyCheckup } from '@/utils/checkup';
import type { Subtitle, TranscriptionStatus } from '@/utils/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;

const ENDPOINTS = {
    subtitles: { validate: '/api/transcription/validate', api: `${API_URL}/transcription` },
    short: { validate: '/api/speech-to-text/validate', api: `${API_URL}/speech-to-text` }
} as const;

type TranscribeOptions =
    | { mode?: 'subtitles'; contextWords?: string[] }
    | { mode: 'short'; contextWords?: string[]; maxGap?: number; words?: number; chars?: number };

export default function useTranscription() {
    const [status, setStatus] = useState<TranscriptionStatus>('idle');
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [error, setError] = useState<string | null>(null);

    const nextId = useRef(1);

    async function transcribe(file: File, options: TranscribeOptions = {}) {
        const { mode = 'subtitles', contextWords } = options;

        const endpoints = ENDPOINTS[mode];

        setStatus('extracting');
        setError(null);
        setSubtitles([]);
        nextId.current = 1;

        try {
            const validateResponse = await fetch(endpoints.validate);

            if (!validateResponse.ok) {
                const data = await validateResponse.json();

                setError(data.error || 'Unauthorized');
                setStatus('error');

                return;
            }

            const { token } = await validateResponse.json();

            const formData = new FormData();

            formData.append('file', await extractAudioFromVideo(file));

            if (contextWords && contextWords.length > 0) {
                formData.append('context_bias', JSON.stringify(contextWords));
            }

            if (options.mode === 'short') {
                if (options.maxGap) {
                    formData.append('max_gap', String(options.maxGap));
                }

                if (options.words) {
                    formData.append('words', String(options.words));
                }

                if (options.chars) {
                    formData.append('chars', String(options.chars));
                }
            }

            setStatus('uploading');

            const response = await fetch(endpoints.api, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });

            if (!response.ok) {
                const data = await response.json();

                setError(data.error || 'Error transcription');
                setStatus('error');

                return;
            }

            setStatus('transcribing');

            const subs: Subtitle[] = (await response.json()).map((seg: { start: number; end: number; text: string }, i: number) => ({
                id: i + 1,
                start: seg.start,
                end: seg.end,
                text: applyCheckup(seg.text.trim())
            }));

            setSubtitles(subs);
            nextId.current = subs.length + 1;
            setStatus('done');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setStatus('error');
        }
    }

    function updateSubtitle(id: number, patch: Partial<Pick<Subtitle, 'text' | 'start' | 'end'>>) {
        setSubtitles(prev => prev.map(sub => (sub.id === id ? { ...sub, ...patch } : sub)));
    }

    function addSubtitle(start: number, end: number, text = '') {
        const sub: Subtitle = { id: nextId.current++, start, end, text };

        setSubtitles(prev => [...prev, sub].sort((a, b) => a.start - b.start));
    }

    function deleteSubtitle(id: number) {
        setSubtitles(prev => prev.filter(sub => sub.id !== id));
    }

    function restoreSubtitle(subtitle: Subtitle) {
        setSubtitles(prev => {
            if (prev.some(s => s.id === subtitle.id)) {
                return prev;
            }

            return [...prev, subtitle].sort((a, b) => a.start - b.start);
        });
    }

    function reset() {
        setStatus('idle');
        setSubtitles([]);
        nextId.current = 1;
        setError(null);
    }

    return { status, subtitles, error, transcribe, reset, updateSubtitle, addSubtitle, deleteSubtitle, restoreSubtitle };
}
