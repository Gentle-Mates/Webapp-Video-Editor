import { applyCheckup } from '@/utils/checkup';
import type { Subtitle } from '@/utils/types';

function formatSRTTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

function parseSRTTime(str: string): number | null {
    const match = str.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})$/);

    if (!match) {
        return null;
    }

    const [, h, m, s, ms] = match;

    return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
}

function parseSRT(content: string): Subtitle[] {
    const normalized = content.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();

    if (!normalized) {
        throw new Error('Fichier SRT vide');
    }

    const blocks = normalized.split(/\n{2,}/);
    const subs: Subtitle[] = [];

    for (const block of blocks) {
        const lines = block.split('\n').filter(l => l.trim() !== '');

        if (lines.length < 2) {
            continue;
        }

        const timingLineIdx = lines[0].includes('-->') ? 0 : 1;
        const timingLine = lines[timingLineIdx];
        const timingMatch = timingLine.match(/(\S+)\s*-->\s*(\S+)/);

        if (!timingMatch) {
            continue;
        }

        const start = parseSRTTime(timingMatch[1]);
        const end = parseSRTTime(timingMatch[2]);

        if (start === null || end === null) {
            continue;
        }

        const text = lines.slice(timingLineIdx + 1).join('\n').trim();

        if (!text) {
            continue;
        }

        subs.push({
            id: subs.length + 1,
            start,
            end,
            text: applyCheckup(text)
        });
    }

    if (subs.length === 0) {
        throw new Error('Fichier SRT invalide');
    }

    return subs;
}

function generateSRT(subtitles: Subtitle[]): string {
    return subtitles
        .map((sub, i) => {
            return `${i + 1}\n${formatSRTTime(sub.start)} --> ${formatSRTTime(sub.end)}\n${sub.text}`;
        })
        .join('\n\n');
}

function downloadSRT(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = filename.replace(/\.[^.]+$/, '.srt');
    a.click();
    URL.revokeObjectURL(url);
}

export { generateSRT, downloadSRT, parseSRT };
