function formatTime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);

    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

function parseTime(str: string): number | null {
    const parts = str.split(':');
    let seconds = 0;

    for (const part of parts) {
        const n = parseFloat(part);

        if (isNaN(n)) {
            return null;
        }

        seconds = seconds * 60 + n;
    }

    return seconds >= 0 ? seconds : null;
}

export { formatTime, parseTime };
