import { auth } from '@/lib/auth';
import { signToken } from '@/lib/jwt';

const API_URL = process.env.API_URL!;

async function GET() {
    const session = await auth();

    if (!session?.user?.email) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const token = await signToken(session.user.email);

        const response = await fetch(`${API_URL}/settings`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await response.json();

        return Response.json(data, { status: response.status });
    } catch (err) {
        console.error('Settings error:', err);

        return Response.json({ error: 'Internal error get settings' }, { status: 500 });
    }
}

async function PATCH(request: Request) {
    const session = await auth();

    if (!session?.user?.email) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const token = await signToken(session.user.email);
        const body = await request.json();

        const response = await fetch(`${API_URL}/settings`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();

        return Response.json(data, { status: response.status });
    } catch (err) {
        console.error('Settings error:', err);

        return Response.json({ error: 'Internal error update settings' }, { status: 500 });
    }
}

export { GET, PATCH };
