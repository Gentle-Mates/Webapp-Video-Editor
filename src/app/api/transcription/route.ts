import { auth } from '@/lib/auth';
import { signToken } from '@/lib/jwt';

const API_URL = process.env.API_URL!;

async function POST(request: Request) {
    const session = await auth();

    if (!session?.user?.email) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const token = await signToken(session.user.email);
        const formData = await request.formData();

        const response = await fetch(`${API_URL}/transcription`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });

        const data = await response.json();

        return Response.json(data, { status: response.status });
    } catch (err) {
        console.error('Transcription error:', err);

        return Response.json({ error: 'Internal error during transcription' }, { status: 500 });
    }
}

export { POST };
