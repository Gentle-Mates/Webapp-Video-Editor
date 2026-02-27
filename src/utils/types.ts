export interface Subtitle {
    id: number;
    start: number;
    end: number;
    text: string;
}

export type TranscriptionStatus = 'idle' | 'extracting' | 'uploading' | 'transcribing' | 'done' | 'error';

export type TranslationMode = 'mix' | 'fr' | 'en';

export type SubtitleView = 'original' | TranslationMode;