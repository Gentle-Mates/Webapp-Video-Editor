import { SignJWT } from 'jose';

const secret = new TextEncoder().encode(process.env.AUTH_SECRET);

async function signToken(email: string): Promise<string> {
    return new SignJWT({ email })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('1h')
        .sign(secret);
}

export { signToken }
