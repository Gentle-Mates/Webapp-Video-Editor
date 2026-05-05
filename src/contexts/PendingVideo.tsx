'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface PendingVideoContextValue {
    pendingFile: File | null;
    setPendingFile: (file: File | null) => void;
}

const PendingVideo = createContext<PendingVideoContextValue | null>(null);

function PendingVideoProvider({ children }: { children: ReactNode }) {
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    return <PendingVideo.Provider value={{ pendingFile, setPendingFile }}>{children}</PendingVideo.Provider>;
}

function usePendingVideo() {
    const ctx = useContext(PendingVideo);

    if (!ctx) {
        throw new Error('usePendingVideo must be used within PendingVideoProvider');
    }

    return ctx;
}

export { PendingVideoProvider, usePendingVideo };
