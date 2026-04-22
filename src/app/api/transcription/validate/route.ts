import { auth } from '@/lib/auth';
import { signTranscriptionToken } from '@/lib/jwt';

async function GET() {
    const session = await auth();

    if (!session?.user?.email) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const token = await signTranscriptionToken(session.user.email);

        return Response.json({ token });
    } catch (err) {
        console.error('Transcription validate error:', err);

        return Response.json({ error: 'Internal error during validation' }, { status: 500 });
    }
}

export { GET };
