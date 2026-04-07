import { useState, useEffect } from 'react';

interface Settings {
    allowedEmails: string[];
    contextWords: string[];
}

export default function useSettings() {
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);

        fetch('/api/settings')
            .then(res => {
                if (!res.ok) {
                    throw new Error('Failed to fetch settings');
                }

                return res.json();
            })
            .then((data: Settings) => setSettings(data))
            .catch(err => {
                console.error('Settings fetch error:', err);
                setError('Failed to fetch settings');
            })
            .finally(() => setLoading(false));
    }, []);

    async function updateSettings(patch: Partial<Settings>) {
        setSaving(true);
        setError(null);

        try {
            const res = await fetch('/api/settings', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch)
            });

            if (!res.ok) {
                console.error('Settings update error:', res.status);
                setError('Failed to update settings');

                return false;
            }

            setSettings(await res.json());

            return true;
        } catch (err) {
            console.error('Settings update error:', err);
            setError('Failed to update settings');

            return false;
        } finally {
            setSaving(false);
        }
    }

    return { settings, loading, saving, error, updateSettings };
}
