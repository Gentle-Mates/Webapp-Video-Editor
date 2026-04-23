import { auth } from '@/lib/auth';
import { signToken } from '@/lib/jwt';
import type { Subtitle, TranslationMode } from '@/utils/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL!;
const CHUNK_SIZE = 100;
const MAX_RETRIES = 5;

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const response = await fetch(url, init);

        if (response.status !== 502 || attempt === MAX_RETRIES) {
            return response;
        }

        await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error('Mistral retry exhausted');
}

async function POST(request: Request) {
    const session = await auth();

    if (!session?.user?.email) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const token = await signToken(session.user.email);

        const { subtitles, mode } = (await request.json()) as { subtitles: Subtitle[]; mode: TranslationMode };

        const chunks: Subtitle[][] = [];

        for (let i = 0; i < subtitles.length; i += CHUNK_SIZE) {
            chunks.push(subtitles.slice(i, i + CHUNK_SIZE));
        }

        const responses = await Promise.all(
            chunks.map(chunk =>
                fetchWithRetry(`${API_URL}/translation`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ subtitles: chunk, mode })
                })
            )
        );

        const failed = responses.find(r => !r.ok);

        if (failed) {
            const errorData = await failed.json().catch(() => ({ error: 'Translation failed' }));

            return Response.json(errorData, { status: failed.status });
        }

        const results = (await Promise.all(responses.map(r => r.json()))) as Subtitle[][];

        return Response.json(results.flat(), { status: 200 });
    } catch (err) {
        console.error('Translation error:', err);

        return Response.json({ error: 'Internal error during translation' }, { status: 500 });
    }
}

export { POST };
