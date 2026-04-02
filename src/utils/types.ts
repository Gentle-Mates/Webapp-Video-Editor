import type { ReactNode } from 'react';

type TranscriptionStatus = 'idle' | 'extracting' | 'uploading' | 'transcribing' | 'done' | 'error';

type TranslationMode = 'mix' | 'fr' | 'en';

type SubtitleView = 'original' | TranslationMode;

interface Subtitle {
    id: number;
    start: number;
    end: number;
    text: string;
}

interface SubtitleTrack {
    id: SubtitleView;
    label: string;
    subtitles: Subtitle[];
    icon?: ReactNode;
}

export type { TranscriptionStatus, TranslationMode, SubtitleView, Subtitle, SubtitleTrack };
