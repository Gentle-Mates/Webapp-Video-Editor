import type { ReactNode } from 'react';
import { FileText, ArrowLeftRight } from 'lucide-react';

import Image from 'next/image';

import type { SubtitleView } from '@/utils/types';

const ALL_TRACKS: Record<SubtitleView, { label: string; suffix: string; icon: ReactNode }> = {
    original: {
        label: 'Original',
        suffix: '',
        icon: <FileText className="h-3.5 w-3.5" />
    },
    mix: {
        label: 'Mix',
        suffix: ' - MIX',
        icon: <ArrowLeftRight className="h-3.5 w-3.5" />
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
