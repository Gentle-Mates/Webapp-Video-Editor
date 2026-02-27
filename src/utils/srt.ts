import type { Subtitle } from '@/utils/types';

function formatSRTTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);

    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
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

export { generateSRT, downloadSRT };
