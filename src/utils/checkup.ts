function applyCheckup(text: string): string {
    return text.replace(/\bgentle\s*mates?\b/gi, 'Gentle Mates').replace(/\bgentlem[ae]n\b/gi, 'Gentle Mates');
}

export { applyCheckup };
