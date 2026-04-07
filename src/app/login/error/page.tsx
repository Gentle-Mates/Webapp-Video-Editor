import Link from 'next/link';

export default function AuthErrorPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
            <div className="flex flex-col items-center gap-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20">
                    <svg
                        className="h-7 w-7 text-red-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                        />
                    </svg>
                </div>

                <div className="flex flex-col items-center gap-2">
                    <h1 className="text-xl font-semibold text-white/90">Accès refusé</h1>
                    <p className="text-sm text-white/40">Vous n&apos;êtes pas autorisé à utiliser cette application.</p>
                </div>

                <Link
                    href="/login"
                    className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-medium text-white/70 transition-all hover:bg-white/15 hover:text-white"
                >
                    Retour
                </Link>
            </div>
        </div>
    );
}
