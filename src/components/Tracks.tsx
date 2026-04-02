import type { SubtitleView } from '@/utils/types';
import type { ReactNode } from 'react';

import Image from 'next/image';

const ALL_TRACKS: Record<SubtitleView, { label: string; suffix: string; icon: ReactNode }> = {
    original: {
        label: 'Original',
        suffix: '',
        icon: (
            <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
            </svg>
        )
    },
    mix: {
        label: 'Mix',
        suffix: ' - MIX',
        icon: (
            <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                />
            </svg>
        )
    },
    fr: {
        label: 'Français',
        suffix: ' - FR',
        icon: (
            <Image
                src="/flags/FR.svg"
                alt="FR"
                width={21}
                height={14}
                className="h-3 w-auto"
                unoptimized
            />
        )
    },
    en: {
        label: 'Anglais',
        suffix: ' - EN',
        icon: (
            <Image
                src="/flags/US.svg"
                alt="EN"
                width={21}
                height={14}
                className="h-3 w-auto"
                unoptimized
            />
        )
    }
};

export { ALL_TRACKS };
