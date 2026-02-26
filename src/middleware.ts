export { auth as middleware } from './app/lib/auth';

export const config = {
    matcher: ['/((?!login|api/auth|_next|favicon.ico).*)']
};
