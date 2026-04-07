import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const API_URL = process.env.API_URL!;

async function emailAllowed(email: string): Promise<boolean> {
    try {
        const res = await fetch(`${API_URL}/auth/check-email`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email })
        });

        if (!res.ok) {
            return false;
        }

        return await res.json();
    } catch {
        return false;
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [Google],
    pages: {
        signIn: '/login',
        error: '/login/error'
    },
    logger: { error() {} },
    callbacks: {
        authorized({ auth }) {
            return !!auth;
        },
        async signIn({ profile }) {
            const email = profile?.email;

            if (!email) {
                return false;
            }

            return emailAllowed(email);
        }
    }
});
