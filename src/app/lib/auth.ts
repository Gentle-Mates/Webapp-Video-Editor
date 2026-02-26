import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

export const { handlers, auth, signIn, signOut } = NextAuth({
    providers: [Google],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth }) {
            return !!auth;
        },
        signIn({ profile }) {
            return profile?.email?.endsWith('@gentlemates.com') ?? false;
        },
    },
});
