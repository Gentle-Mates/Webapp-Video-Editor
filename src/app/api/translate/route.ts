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
        const body = await request.json();

        const response = await fetch(`${API_URL}/translation`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        return Response.json(data, { status: response.status });
    } catch (err) {
        console.error('Translation error:', err);

        return Response.json({ error: 'Internal error during translation' }, { status: 500 });
    }
}

export { POST };
