import { Geist, Geist_Mono } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin']
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin']
});

export const metadata: Metadata = {
    title: 'Subtitles Editor',
    description: 'Éditeur de sous-titres vidéo'
};

export default function RootLayout({
    children
}: Readonly<{
    children: ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
                <SessionProvider>{children}</SessionProvider>
            </body>
        </html>
    );
}
