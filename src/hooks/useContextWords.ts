import { useState } from 'react';

const MAX_WORDS = 100;

export default function useContextWords(initialWords: string[]) {
    const [removedDefaults, setRemovedDefaults] = useState<Set<string>>(new Set());
    const [customWords, setCustomWords] = useState<string[]>([]);

    const activeDefaults = initialWords.filter(w => !removedDefaults.has(w));
    const words = [...activeDefaults, ...customWords];

    function addWord(word: string) {
        const trimmed = word.trim().replace(/\s+/g, '');

        if (!trimmed || words.length >= MAX_WORDS || words.some(w => w.toLowerCase() === trimmed.toLowerCase())) {
            return false;
        }

        const matchingDefault = initialWords.find(w => w.toLowerCase() === trimmed.toLowerCase());

        if (matchingDefault && removedDefaults.has(matchingDefault)) {
            setRemovedDefaults(prev => {
                const next = new Set(prev);

                next.delete(matchingDefault);

                return next;
            });
        } else {
            setCustomWords(prev => [...prev, trimmed]);
        }

        return true;
    }

    function removeWord(word: string) {
        if (initialWords.includes(word)) {
            setRemovedDefaults(prev => new Set(prev).add(word));
        } else {
            setCustomWords(prev => prev.filter(w => w !== word));
        }
    }

    function resetWords() {
        setRemovedDefaults(new Set());
        setCustomWords([]);
    }

    function isDefault(word: string) {
        return initialWords.includes(word);
    }

    return { words, addWord, removeWord, resetWords, isDefault, maxWords: MAX_WORDS };
}
