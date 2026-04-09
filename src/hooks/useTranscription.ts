import { useRef, useState } from 'react';

import { extractAudioFromVideo } from '@/utils/audio';
import type { Subtitle, TranscriptionStatus } from '@/utils/types';

export default function useTranscription() {
    const [status, setStatus] = useState<TranscriptionStatus>('idle');
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [error, setError] = useState<string | null>(null);

    const nextId = useRef(1);

    async function transcribe(file: File, contextWords?: string[]) {
        setStatus('extracting');
        setError(null);
        setSubtitles([]);
        nextId.current = 1;

        try {
            const formData = new FormData();

            formData.append('file', await extractAudioFromVideo(file));

            if (contextWords && contextWords.length > 0) {
                formData.append('context_bias', JSON.stringify(contextWords));
            }

            setStatus('uploading');

            const response = await fetch('/api/transcription', {
                method: 'POST',
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
                text: seg.text.trim()
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
