import { SignJWT } from 'jose';

type TranscriptionScope = 'transcription' | 'speech-to-text';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

async function signToken(email: string): Promise<string> {
    return new SignJWT({ email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

async function signScopedToken(email: string, scope: TranscriptionScope): Promise<string> {
    return new SignJWT({ email, scope })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(secret);
}

export { signToken, signScopedToken };
