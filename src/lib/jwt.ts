import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

async function signToken(email: string): Promise<string> {
    return new SignJWT({ email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

async function signTranscriptionToken(email: string): Promise<string> {
    return new SignJWT({ email, scope: 'transcription' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(secret);
}

export { signToken, signTranscriptionToken }
