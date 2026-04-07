import { useState } from 'react';

import config from '../../config.json';

const MAX_WORDS = 100;

export default function useContextWords() {
    const [defaultWords] = useState<string[]>(config.contextWords ?? []);
    const [removedDefaults, setRemovedDefaults] = useState<Set<string>>(new Set());
    const [customWords, setCustomWords] = useState<string[]>([]);

    const activeDefaults = defaultWords.filter(w => !removedDefaults.has(w));
    const words = [...activeDefaults, ...customWords];

    function addWord(word: string) {
        const trimmed = word.trim().replace(/\s+/g, '');

        if (!trimmed || words.length >= MAX_WORDS) {
            return false;
        }

        if (words.some(w => w.toLowerCase() === trimmed.toLowerCase())) {
            return false;
        }

        if (removedDefaults.has(trimmed)) {
            setRemovedDefaults(prev => {
                const next = new Set(prev);

                next.delete(trimmed);

                return next;
            });
        } else {
            setCustomWords(prev => [...prev, trimmed]);
        }

        return true;
    }

    function removeWord(word: string) {
        if (defaultWords.includes(word)) {
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
        return defaultWords.includes(word);
    }

    return { words, addWord, removeWord, resetWords, isDefault, maxWords: MAX_WORDS };
}
