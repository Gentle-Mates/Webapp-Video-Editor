import { auth } from '@/lib/auth';

const apiKey = process.env.MISTRAL_API_KEY;

async function POST(request: Request) {
    const session = await auth();

    if (!session) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!apiKey) {
        return Response.json({ error: 'Missing MISTRAL_API_KEY value' }, { status: 500 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return Response.json({ error: 'No file' }, { status: 400 });
        }

        const mistralForm = new FormData();

        mistralForm.append('file', file);
        mistralForm.append('model', 'voxtral-mini-latest');
        mistralForm.append('response_format', 'verbose_json');
        mistralForm.append('timestamp_granularities[]', 'segment');

        const response = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`
            },
            body: mistralForm
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));

            return Response.json(
                { error: error.message || error.error?.message || `Error Mistral API (${response.status})` },
                { status: response.status }
            );
        }

        const data = await response.json();

        const segments = (data.segments || []).map((seg: { start: number; end: number; text: string }) => ({
            start: seg.start,
            end: seg.end,
            text: seg.text
        }));

        return Response.json({ segments, text: data.text });
    } catch (err) {
        console.error('Transcription error:', err);

        return Response.json({ error: 'Internal error during transcription' }, { status: 500 });
    }
}

export { POST };
