import { useState } from 'react';

import { extractAudioFromVideo } from '@/utils/audio';
import type { Subtitle, TranscriptionStatus } from '@/utils/types';

export default function useTranscription() {
    const [status, setStatus] = useState<TranscriptionStatus>('idle');
    const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
    const [error, setError] = useState<string | null>(null);

    async function transcribe(file: File) {
        setStatus('extracting');
        setError(null);
        setSubtitles([]);

        try {
            const formData = new FormData();

            formData.append('file', await extractAudioFromVideo(file));

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

            const data = await response.json();

            const subs: Subtitle[] = data.segments.map((seg: { start: number; end: number; text: string }, i: number) => ({
                id: i + 1,
                start: seg.start,
                end: seg.end,
                text: seg.text.trim()
            }));

            setSubtitles(subs);
            setStatus('done');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setStatus('error');
        }
    }

    function updateSubtitle(id: number, patch: Partial<Pick<Subtitle, 'text' | 'start' | 'end'>>) {
        setSubtitles(prev => prev.map(sub => (sub.id === id ? { ...sub, ...patch } : sub)));
    }

    function reset() {
        setStatus('idle');
        setSubtitles([]);
        setError(null);
    }

    return { status, subtitles, error, transcribe, reset, updateSubtitle };
}
