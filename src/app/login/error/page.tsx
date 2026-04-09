import { Ban } from 'lucide-react';

import Link from 'next/link';

export default function AuthErrorPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
            <div className="flex flex-col items-center gap-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20">
                    <Ban className="h-7 w-7 text-red-400" />
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
