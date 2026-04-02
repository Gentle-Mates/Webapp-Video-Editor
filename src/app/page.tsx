'use client';

import { useState, useRef, useEffect, useEffectEvent, useMemo } from 'react';
import { signOut } from 'next-auth/react';
import type { DragEvent, ChangeEvent } from 'react';
import type { Subtitle, SubtitleView, TranslationMode } from '@/utils/types';

import Image from 'next/image';

import { generateSRT, downloadSRT } from '@/utils/srt';
import { formatTime, parseTime } from '@/utils/time';

import ScrubInput from '@/components/ScrubInput';
import SubtitleTimeline from '@/components/SubtitleTimeline';
import useTranscription from '@/hooks/useTranscription';
import useTranslation from '@/hooks/useTranslation';

export default function Home() {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoName, setVideoName] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [overlayTracks, setOverlayTracks] = useState<Record<SubtitleView, boolean>>({ original: true, mix: false, fr: false, en: false });
    const [showOverlayMenu, setShowOverlayMenu] = useState(false);
    const [showTimeline, setShowTimeline] = useState(true);
    const [volume, setVolume] = useState(1);

    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const subtitleListRef = useRef<HTMLDivElement>(null);
    const editContainerRef = useRef<HTMLDivElement>(null);
    const subtitleElRefs = useRef<Map<number, HTMLElement>>(new Map());

    const { status, subtitles, error, transcribe, reset, updateSubtitle, addSubtitle, deleteSubtitle } = useTranscription();
    const {
        translations,
        isTranslating,
        translate,
        syncTimings,
        updateTranslatedSubtitle,
        addTranslatedSubtitle,
        deleteTranslatedSubtitle,
        resetTranslations
    } = useTranslation();

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');
    const [subtitleView, setSubtitleView] = useState<SubtitleView>('original');

    const displayedSubtitles = useMemo(() => {
        const subs = subtitleView === 'original' ? subtitles : translations[subtitleView].length > 0 ? translations[subtitleView] : subtitles;

        return [...subs].sort((a, b) => a.start - b.start);
    }, [subtitleView, subtitles, translations]);
    const activeSubtitle = displayedSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end) ?? null;

    function toggleOverlayTrack(track: SubtitleView) {
        setOverlayTracks(prev => ({ ...prev, [track]: !prev[track] }));
    }

    const activeOverlayTracks = useMemo(() => {
        return (Object.keys(overlayTracks) as SubtitleView[])
            .filter(track => overlayTracks[track])
            .map(track => {
                const subs = track === 'original' ? subtitles : translations[track].length > 0 ? translations[track] : null;

                if (!subs) {
                    return null;
                }

                const active = subs.find(sub => currentTime >= sub.start && currentTime <= sub.end);

                return active ? { track, text: active.text } : null;
            })
            .filter((s): s is { track: SubtitleView; text: string } => s !== null);
    }, [overlayTracks, subtitles, translations, currentTime]);

    function startEditing(sub: { id: number; text: string; start: number; end: number }) {
        setEditingId(sub.id);
        setEditText(sub.text);
        setEditStart(formatTime(sub.start));
        setEditEnd(formatTime(sub.end));
    }

    function saveEdit() {
        if (editingId === null) {
            return;
        }

        const start = parseTime(editStart);
        const end = parseTime(editEnd);
        const timingUpdates = { ...(start ? { start } : {}), ...(end ? { end } : {}) };

        if (subtitleView === 'original') {
            updateSubtitle(editingId, { text: editText, ...timingUpdates });
        } else {
            updateSubtitle(editingId, timingUpdates);
            updateTranslatedSubtitle(subtitleView, editingId, { text: editText, ...timingUpdates });
        }

        syncTimings(editingId, timingUpdates);
        setEditingId(null);
    }

    const onSaveEdit = useEffectEvent(() => {
        saveEdit();
    });

    function cancelEdit() {
        setEditingId(null);
    }

    function handleFileSelect(file: File) {
        if (file && file.type.startsWith('video/')) {
            if (videoSrc) {
                URL.revokeObjectURL(videoSrc);
            }

            setVideoSrc(URL.createObjectURL(file));
            setVideoFile(file);
            setVideoName(file.name);
            setIsPlaying(false);
            setCurrentTime(0);
            resetTranslations();
            setSubtitleView('original');
            reset();
        }
    }

    function deleteVideo() {
        if (videoSrc) {
            URL.revokeObjectURL(videoSrc);
        }

        setVideoSrc(null);
        setVideoFile(null);
        setVideoName('');
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setEditingId(null);
        setSubtitleView('original');
        resetTranslations();
        reset();
    }

    function removeSubtitle(id: number) {
        deleteSubtitle(id);
        deleteTranslatedSubtitle(id);

        if (editingId === id) {
            setEditingId(null);
        }
    }

    function addNewSubtitle(start: number, end: number) {
        addSubtitle(start, end, '');

        const sub: Subtitle = { id: subtitles.reduce((max, sub) => Math.max(max, sub.id), 0) + 1, start, end, text: '' };

        addTranslatedSubtitle(sub);
        startEditing(sub);
    }

    function handleTimelineSubtitleUpdate(id: number, patch: Partial<Pick<Subtitle, 'start' | 'end'>>) {
        updateSubtitle(id, patch);

        if (subtitleView !== 'original') {
            updateTranslatedSubtitle(subtitleView, id, patch);
        }

        syncTimings(id, patch);
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();

        const file = e.dataTransfer.files[0];

        if (file) {
            handleFileSelect(file);
        }
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
    }

    function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];

        if (file) {
            handleFileSelect(file);
        }
    }

    function togglePlay() {
        if (!videoRef.current) {
            return;
        }

        if (isPlaying) {
            videoRef.current.pause();
        } else {
            videoRef.current.play();
        }

        setIsPlaying(!isPlaying);
    }

    function skip(seconds: number) {
        if (!videoRef.current) {
            return;
        }

        videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
    }

    function seekTo(time: number) {
        if (!videoRef.current) {
            return;
        }

        videoRef.current.currentTime = time;

        setCurrentTime(time);
    }

    function changeVolume(value: number) {
        setVolume(value);

        if (videoRef.current) {
            videoRef.current.volume = value * value;
        }
    }

    function toggleMute() {
        changeVolume(volume > 0 ? 0 : 1);
    }

    function handleTimelineChange(e: ChangeEvent<HTMLInputElement>) {
        if (!videoRef.current) {
            return;
        }

        const time = parseFloat(e.target.value);

        videoRef.current.currentTime = time;

        setCurrentTime(time);
    }

    function handleTimelineMouseDown() {
        setIsDragging(true);
    }

    function handleTimelineMouseUp() {
        setIsDragging(false);
    }

    function handleTranscribe() {
        if (videoFile) {
            resetTranslations();
            setSubtitleView('original');
            transcribe(videoFile).then(() => {});
        }
    }

    function handleExportSRT() {
        if (displayedSubtitles.length === 0) {
            return;
        }

        downloadSRT(
            generateSRT(displayedSubtitles),
            `${videoName.replace(/\.[^.]+$/, '')}${subtitleView !== 'original' ? ` - ${subtitleView.toUpperCase()}` : ''}.srt`
        );
    }

    async function handleTranslate(mode: TranslationMode, forceRefresh = false) {
        setSubtitleView(mode);

        await translate(subtitles, mode, forceRefresh);
    }

    function handleReload() {
        if (subtitleView === 'original') {
            handleTranscribe();
        } else {
            handleTranslate(subtitleView, true).then(() => null);
        }
    }

    useEffect(() => {
        const video = videoRef.current;

        if (!video) {
            return;
        }

        const handleTimeUpdate = () => {
            if (!isDragging) {
                setCurrentTime(video.currentTime);
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
        };

        const handleDurationChange = () => {
            if (video.duration && !isNaN(video.duration)) {
                setDuration(video.duration);
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('durationchange', handleDurationChange);
        video.addEventListener('ended', handleEnded);

        if (video.duration && !isNaN(video.duration)) {
            setDuration(video.duration);
        }

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('durationchange', handleDurationChange);
            video.removeEventListener('ended', handleEnded);
        };
    }, [isDragging, videoSrc]);

    const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
        if (!videoSrc || !videoRef.current) {
            return;
        }

        const target = e.target as HTMLElement;

        if (
            (e.code === 'ArrowUp' || e.code === 'ArrowDown') &&
            !(target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') &&
            displayedSubtitles.length > 0
        ) {
            e.preventDefault();

            const currentIndex = editingId
                ? displayedSubtitles.findIndex(s => s.id === editingId)
                : activeSubtitle
                  ? displayedSubtitles.findIndex(s => s.id === activeSubtitle.id)
                  : -1;

            const nextIndex =
                e.code === 'ArrowUp'
                    ? currentIndex <= 0
                        ? 0
                        : currentIndex - 1
                    : currentIndex < 0
                      ? 0
                      : Math.min(currentIndex + 1, displayedSubtitles.length - 1);

            const nextSub = displayedSubtitles[nextIndex];

            if (nextSub) {
                if (editingId !== null) {
                    onSaveEdit();
                }

                startEditing(nextSub);
                seekTo(nextSub.start);
            }

            return;
        }

        if (editingId) {
            return;
        }

        switch (e.code) {
            case 'Space':
                e.preventDefault();

                if (videoRef.current.paused) {
                    videoRef.current.play();

                    setIsPlaying(true);
                } else {
                    videoRef.current.pause();

                    setIsPlaying(false);
                }

                break;

            case 'ArrowLeft':
                e.preventDefault();
                skip(-5);

                break;

            case 'ArrowRight':
                e.preventDefault();
                skip(5);

                break;
        }
    });

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleClickOutside = useEffectEvent((e: MouseEvent) => {
        if (editContainerRef.current && !editContainerRef.current.contains(e.target as Node)) {
            onSaveEdit();
        }
    });

    useEffect(() => {
        if (!editingId) {
            return;
        }

        document.addEventListener('mousedown', handleClickOutside);

        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [editingId]);

    useEffect(() => {
        const id = editingId ?? activeSubtitle?.id;

        if (!id) {
            return;
        }

        const el = subtitleElRefs.current.get(id);

        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [activeSubtitle, editingId]);

    const isProcessing = status === 'extracting' || status === 'uploading' || status === 'transcribing';
    const progressLabel = status === 'extracting' ? 'Envoi...' : status === 'uploading' || status === 'transcribing' ? 'Traitement...' : '';

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-[#09090b]">
            {/* Header */}
            <header className="grid h-12 shrink-0 grid-cols-3 items-center border-b border-white/5 bg-[#09090b] px-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                        <svg
                            className="h-4 w-4 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"
                            />
                        </svg>
                    </div>
                    <span className="text-sm font-medium text-white/90">Video Editor</span>
                </div>
                {videoName ? (
                    <div className="flex items-center justify-center gap-2 min-w-0">
                        <span className="text-sm text-white/90 truncate">{videoName}</span>
                        <button
                            onClick={deleteVideo}
                            className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-white/50 transition-all hover:bg-red-500/15 hover:text-red-400"
                            title="Supprimer la vidéo"
                        >
                            <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={2}
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                                />
                            </svg>
                        </button>
                    </div>
                ) : (
                    <div />
                )}
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition-all hover:bg-white/10"
                    >
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
                                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                            />
                        </svg>
                        Déconnexion
                    </button>
                </div>
            </header>

            <main className="flex flex-1 flex-col overflow-hidden">
                {!videoSrc ? (
                    /* Upload zone */
                    <div
                        className="flex flex-1 items-center justify-center p-6"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                    >
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-white/[0.02] p-14 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-white/[0.04] cursor-pointer"
                        >
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-white/10">
                                <svg
                                    className="h-8 w-8 text-primary"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={1.5}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                                    />
                                </svg>
                            </div>
                            <div className="text-center">
                                <p className="text-base font-medium text-white/90">Importer une vidéo</p>
                                <p className="mt-1.5 text-sm text-white/40">Glissez-déposez ou cliquez pour sélectionner</p>
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="video/*"
                                onChange={handleInputChange}
                                className="hidden"
                            />
                        </div>
                    </div>
                ) : (
                    /* Video editor */
                    <div className="flex flex-1 overflow-hidden">
                        {/* Video */}
                        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
                            <div className="relative flex flex-1 items-center justify-center bg-black min-h-0">
                                <video
                                    ref={videoRef}
                                    src={videoSrc}
                                    className="h-full w-full object-contain"
                                    onClick={togglePlay}
                                />

                                {activeOverlayTracks.length > 0 && (
                                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 max-w-[80%] flex flex-col items-center gap-1">
                                        {activeOverlayTracks.map(({ track, text }) => (
                                            <p
                                                key={track}
                                                className={`rounded-lg px-4 py-2 text-center text-sm font-medium backdrop-blur-sm ${
                                                    activeOverlayTracks.length > 1 ? 'bg-black/60 text-white/80' : 'bg-black/70 text-white'
                                                }`}
                                            >
                                                {text}
                                            </p>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Controls panel */}
                            <div className="shrink-0 border-t border-white/5 bg-[#0c0c0e] px-6 py-4">
                                {/* Timeline */}
                                <div className="mb-5">
                                    <div className="group relative flex h-6 cursor-pointer items-center">
                                        {/* Track */}
                                        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />

                                        {/* Progress */}
                                        <div
                                            className="absolute h-1.5 rounded-full bg-gradient-to-r from-secondary to-primary"
                                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                        />

                                        {/* Thumb */}
                                        <div
                                            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow-lg shadow-black/50"
                                            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                        />

                                        {/* Slider input */}
                                        <input
                                            type="range"
                                            min={0}
                                            max={duration || 1}
                                            step={0.01}
                                            value={currentTime}
                                            onChange={handleTimelineChange}
                                            onMouseDown={handleTimelineMouseDown}
                                            onMouseUp={handleTimelineMouseUp}
                                            onTouchStart={handleTimelineMouseDown}
                                            onTouchEnd={handleTimelineMouseUp}
                                            className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                        />
                                    </div>

                                    {/* Time display */}
                                    <div className="mt-2 flex justify-between text-[11px] font-medium text-white/30 font-mono">
                                        <span>{formatTime(currentTime)}</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>

                                {/* Control buttons */}
                                <div className="flex items-center justify-between">
                                    {/* Left: Volume */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleMute}
                                            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                            title={volume > 0 ? 'Couper le son' : 'Activer le son'}
                                        >
                                            {volume === 0 ? (
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                                    />
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                                                    />
                                                </svg>
                                            ) : volume < 0.5 ? (
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                                    />
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M15.536 8.464a5 5 0 010 7.072"
                                                    />
                                                </svg>
                                            ) : (
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                                                    />
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728"
                                                    />
                                                </svg>
                                            )}
                                        </button>
                                        <div className="relative flex h-6 w-20 items-center">
                                            <div className="absolute inset-x-0 h-1 rounded-full bg-white/10" />
                                            <div
                                                className="absolute h-1 rounded-full bg-white/30"
                                                style={{ width: `${volume * 100}%` }}
                                            />
                                            <input
                                                type="range"
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={volume}
                                                onChange={e => changeVolume(parseFloat(e.target.value))}
                                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                            />
                                        </div>
                                    </div>

                                    {/* Center: Back/Skip & Play */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => skip(-5)}
                                            className="group flex h-10 items-center gap-1.5 rounded-full bg-white/5 px-4 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                            title="Reculer de 5 secondes"
                                        >
                                            <svg
                                                className="h-4 w-4"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
                                            </svg>
                                            <span className="text-xs font-medium">5s</span>
                                        </button>

                                        <button
                                            onClick={togglePlay}
                                            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/85 text-white transition-all hover:bg-primary"
                                            title={isPlaying ? 'Pause' : 'Lecture'}
                                        >
                                            {isPlaying ? (
                                                <svg
                                                    className="h-5 w-5"
                                                    fill="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                                                </svg>
                                            ) : (
                                                <svg
                                                    className="h-5 w-5 ml-0.5"
                                                    fill="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path d="M8 5v14l11-7z" />
                                                </svg>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => skip(5)}
                                            className="group flex h-10 items-center gap-1.5 rounded-full bg-white/5 px-4 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                            title="Avancer de 5 secondes"
                                        >
                                            <span className="text-xs font-medium">5s</span>
                                            <svg
                                                className="h-4 w-4"
                                                fill="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
                                            </svg>
                                        </button>
                                    </div>

                                    {/* Right: Timeline toggle + Subtitle overlay */}
                                    <div
                                        className="flex items-center justify-end gap-2"
                                        style={{ width: '148px' }}
                                    >
                                        {/* Timeline toggle */}
                                        <button
                                            onClick={() => setShowTimeline(v => !v)}
                                            className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                                                subtitles.length === 0
                                                    ? 'bg-white/5 text-white/10 cursor-not-allowed'
                                                    : showTimeline
                                                      ? 'bg-violet-500/10 text-secondary'
                                                      : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
                                            }`}
                                            disabled={subtitles.length === 0}
                                            title={showTimeline ? 'Masquer la timeline' : 'Afficher la timeline'}
                                        >
                                            <svg
                                                className="h-4 w-4"
                                                fill="none"
                                                viewBox="0 0 24 24"
                                                stroke="currentColor"
                                                strokeWidth={2}
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-2.625 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5c0 .621-.504 1.125-1.125 1.125m1.5 0h12m-12 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m12-3.75c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5m1.5 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m0-3.75h-12"
                                                />
                                            </svg>
                                        </button>

                                        {/* Subtitle overlay */}
                                        <div className="relative">
                                            <button
                                                onClick={() => subtitles.length > 0 && setShowOverlayMenu(v => !v)}
                                                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                                                    subtitles.length === 0
                                                        ? 'bg-white/5 text-white/10 cursor-not-allowed'
                                                        : Object.values(overlayTracks).some(Boolean)
                                                          ? 'bg-violet-500/10 text-secondary'
                                                          : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
                                                }`}
                                                title="Sous-titres sur la vidéo"
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                                                    />
                                                </svg>
                                            </button>

                                            {showOverlayMenu && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onPointerDown={() => setShowOverlayMenu(false)}
                                                    />
                                                    <div className="absolute bottom-full right-0 z-20 mb-2 min-w-[140px] rounded-xl border border-white/10 bg-[#141416] p-1.5 shadow-xl">
                                                        {(['original', 'mix', 'fr', 'en'] as const).map(track => {
                                                            const available =
                                                                track === 'original' ? subtitles.length > 0 : translations[track].length > 0;

                                                            if (!available) {
                                                                return null;
                                                            }

                                                            const active = overlayTracks[track];
                                                            const label =
                                                                track === 'original' ? 'Original' : track === 'mix' ? 'Mix' : track.toUpperCase();

                                                            return (
                                                                <button
                                                                    key={track}
                                                                    onClick={() => toggleOverlayTrack(track)}
                                                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:bg-white/5 ${
                                                                        active ? 'text-secondary' : 'text-white/50 hover:text-white/80'
                                                                    }`}
                                                                >
                                                                    <span
                                                                        className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                                                                            active ? 'border-secondary bg-secondary/20' : 'border-white/20'
                                                                        }`}
                                                                    >
                                                                        {active && (
                                                                            <svg
                                                                                className="h-2.5 w-2.5"
                                                                                fill="none"
                                                                                viewBox="0 0 24 24"
                                                                                stroke="currentColor"
                                                                                strokeWidth={3}
                                                                            >
                                                                                <path
                                                                                    strokeLinecap="round"
                                                                                    strokeLinejoin="round"
                                                                                    d="M4.5 12.75l6 6 9-13.5"
                                                                                />
                                                                            </svg>
                                                                        )}
                                                                    </span>
                                                                    {label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Subtitle Timeline */}
                                {showTimeline && status === 'done' && displayedSubtitles.length > 0 && (
                                    <div className="mt-4 rounded-lg border border-white/5 bg-white/[0.02]">
                                        <SubtitleTimeline
                                            subtitles={displayedSubtitles}
                                            duration={duration}
                                            currentTime={currentTime}
                                            activeSubtitleId={activeSubtitle?.id ?? null}
                                            onSeek={seekTo}
                                            onSubtitleUpdate={handleTimelineSubtitleUpdate}
                                            onSubtitleTextEdit={startEditing}
                                            onSubtitlesDelete={ids => ids.forEach(removeSubtitle)}
                                            onSubtitleAdd={addNewSubtitle}
                                        />
                                    </div>
                                )}

                                {/* Keyboard shortcuts hint */}
                                <div className="mt-4 flex justify-center gap-6 text-[10px] text-white/20">
                                    <span className="flex items-center gap-1.5">
                                        <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/40">&larr;</kbd>
                                        <span>-5s</span>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/40">Space</kbd>
                                        <span>Play</span>
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/40">&rarr;</kbd>
                                        <span>+5s</span>
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Subtitles panel */}
                        <div className="flex w-80 shrink-0 flex-col border-l border-white/5 bg-[#0c0c0e]">
                            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                                <span className="text-xs font-medium text-white/60">Sous-titres</span>
                                <div className="flex items-center gap-2">
                                    {status === 'done' && subtitles.length > 0 && (
                                        <>
                                            <button
                                                onClick={handleExportSRT}
                                                className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                                title="Exporter SRT"
                                            >
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                                                    />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={handleReload}
                                                disabled={isTranslating}
                                                className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                                title={subtitleView === 'original' ? 'Regénérer les sous-titres' : 'Retraduire'}
                                            >
                                                {isTranslating ? (
                                                    <svg
                                                        className="h-4 w-4 animate-spin"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <circle
                                                            className="opacity-25"
                                                            cx="12"
                                                            cy="12"
                                                            r="10"
                                                            stroke="currentColor"
                                                            strokeWidth="4"
                                                        />
                                                        <path
                                                            className="opacity-75"
                                                            fill="currentColor"
                                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                                        />
                                                    </svg>
                                                ) : (
                                                    <svg
                                                        className="h-4 w-4"
                                                        fill="none"
                                                        viewBox="0 0 24 24"
                                                        stroke="currentColor"
                                                        strokeWidth={2}
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                                                        />
                                                    </svg>
                                                )}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* View tabs */}
                            {status === 'done' && subtitles.length > 0 && (
                                <div className="flex border-b border-white/5">
                                    {/* Original */}
                                    <button
                                        onClick={() => setSubtitleView('original')}
                                        className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-all ${
                                            subtitleView === 'original'
                                                ? 'text-white bg-white/5'
                                                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
                                        }`}
                                        title="Original"
                                    >
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
                                    </button>

                                    {/* Mix */}
                                    <button
                                        onClick={() => handleTranslate('mix')}
                                        disabled={isTranslating}
                                        className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-all disabled:opacity-40 ${
                                            subtitleView === 'mix'
                                                ? 'text-white bg-white/5'
                                                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
                                        }`}
                                        title="Mix (FR↔EN)"
                                    >
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
                                    </button>

                                    {/* FR */}
                                    <button
                                        onClick={() => handleTranslate('fr')}
                                        disabled={isTranslating}
                                        className={`flex flex-1 items-center justify-center py-2 text-[10px] font-bold transition-all disabled:opacity-40 ${
                                            subtitleView === 'fr'
                                                ? 'text-white bg-white/5'
                                                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
                                        }`}
                                        title="Français"
                                    >
                                        <Image
                                            src="/flags/FR.svg"
                                            alt="FR"
                                            width={21}
                                            height={14}
                                            className="h-3 w-auto"
                                            unoptimized
                                        />
                                    </button>

                                    {/* EN */}
                                    <button
                                        onClick={() => handleTranslate('en')}
                                        disabled={isTranslating}
                                        className={`flex flex-1 items-center justify-center py-2 text-[10px] font-bold transition-all disabled:opacity-40 ${
                                            subtitleView === 'en'
                                                ? 'text-white bg-white/5'
                                                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.02]'
                                        }`}
                                        title="English"
                                    >
                                        <Image
                                            src="/flags/US.svg"
                                            alt="EN"
                                            width={21}
                                            height={14}
                                            className="h-3 w-auto"
                                            unoptimized
                                        />
                                    </button>
                                </div>
                            )}

                            {/* Processing state */}
                            {isProcessing && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                        <svg
                                            className="h-6 w-6 animate-spin text-primary"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            shapeRendering="geometricPrecision"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                            />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium text-white/80">{progressLabel}</p>
                                </div>
                            )}

                            {/* Error state */}
                            {status === 'error' && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                                        <svg
                                            className="h-6 w-6 text-red-400"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                                            />
                                        </svg>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-red-400">Erreur</p>
                                        <p className="mt-1 text-xs text-white/40">{error}</p>
                                    </div>
                                    <button
                                        onClick={handleTranscribe}
                                        className="mt-2 flex items-center gap-2 rounded-full bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20"
                                    >
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                                            />
                                        </svg>
                                        Réessayer
                                    </button>
                                </div>
                            )}

                            {/* Idle state */}
                            {status === 'idle' && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <button
                                        onClick={handleTranscribe}
                                        className="flex items-center gap-2 rounded-lg bg-primary/85 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary"
                                    >
                                        <svg
                                            className="h-4 w-4"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth={2}
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
                                            />
                                        </svg>
                                        Générer les sous-titres
                                    </button>
                                </div>
                            )}

                            {/* Translating state */}
                            {isTranslating && subtitleView !== 'original' && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                        <svg
                                            className="h-6 w-6 animate-spin text-primary"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            shapeRendering="geometricPrecision"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                            />
                                        </svg>
                                    </div>
                                    <p className="text-sm font-medium text-white/80">Traduction...</p>
                                </div>
                            )}

                            {/* Subtitles list */}
                            {status === 'done' && !isTranslating && displayedSubtitles.length > 0 && (
                                <div className="flex flex-1 flex-col overflow-hidden">
                                    <div
                                        ref={subtitleListRef}
                                        className="flex-1 overflow-y-auto scrollbar-dark"
                                    >
                                        {displayedSubtitles.map(sub =>
                                            editingId === sub.id ? (
                                                <div
                                                    ref={el => {
                                                        editContainerRef.current = el;

                                                        if (el) {
                                                            subtitleElRefs.current.set(sub.id, el);
                                                        } else {
                                                            subtitleElRefs.current.delete(sub.id);
                                                        }
                                                    }}
                                                    key={sub.id}
                                                    className="w-full px-4 py-3 border-b border-white/5 bg-violet-500/10"
                                                >
                                                    {/* Time editing */}
                                                    <div className="flex flex-col gap-1.5 mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <ScrubInput
                                                                label="Début"
                                                                value={editStart}
                                                                onChange={setEditStart}
                                                                onCommit={saveEdit}
                                                                onCancel={cancelEdit}
                                                                onSetCurrent={() => setEditStart(formatTime(currentTime))}
                                                            />
                                                            <div className="ml-auto flex items-center gap-1.5">
                                                                <button
                                                                    onClick={() => removeSubtitle(sub.id)}
                                                                    className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-all hover:bg-red-500/15 hover:text-red-400"
                                                                    title="Supprimer le sous-titre"
                                                                >
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        viewBox="0 0 20 20"
                                                                        fill="currentColor"
                                                                        className="size-3.5"
                                                                    >
                                                                        <path
                                                                            fillRule="evenodd"
                                                                            d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.519.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
                                                                            clipRule="evenodd"
                                                                        />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={cancelEdit}
                                                                    className="h-6 rounded bg-red-600 px-2.5 text-[10px] font-medium text-white transition-all hover:bg-red-500"
                                                                >
                                                                    Annuler
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <ScrubInput
                                                            label="Fin"
                                                            value={editEnd}
                                                            onChange={setEditEnd}
                                                            onCommit={saveEdit}
                                                            onCancel={cancelEdit}
                                                            onSetCurrent={() => setEditEnd(formatTime(currentTime))}
                                                        />

                                                        {/* Duration indicator */}
                                                        {(() => {
                                                            const start = parseTime(editStart);
                                                            const end = parseTime(editEnd);
                                                            const duration = start && end ? end - start : null;
                                                            const isInvalid = duration && duration <= 0;

                                                            return (
                                                                <div className="flex items-center gap-1.5 ml-10">
                                                                    <span
                                                                        className={`text-[10px] font-mono ${isInvalid ? 'text-red-400' : 'text-white/40'}`}
                                                                    >
                                                                        Durée: {duration ? (isInvalid ? 'invalide' : `${duration.toFixed(2)}s`) : '—'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>

                                                    <textarea
                                                        value={editText}
                                                        onChange={e => setEditText(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                                e.preventDefault();
                                                                saveEdit();
                                                            }

                                                            if (e.key === 'Escape') {
                                                                cancelEdit();
                                                            }
                                                        }}
                                                        rows={1}
                                                        className="w-full [field-sizing:content] resize-none rounded border-none bg-white/10 px-2 py-1 text-xs leading-relaxed text-white outline-none focus:ring-1 focus:ring-inset focus:ring-primary"
                                                    />
                                                </div>
                                            ) : (
                                                <button
                                                    ref={el => {
                                                        if (el) {
                                                            subtitleElRefs.current.set(sub.id, el);
                                                        } else {
                                                            subtitleElRefs.current.delete(sub.id);
                                                        }
                                                    }}
                                                    key={sub.id}
                                                    onClick={() => seekTo(sub.start)}
                                                    onDoubleClick={() => startEditing(sub)}
                                                    className={`w-full text-left px-4 py-3 border-b border-white/5 transition-all hover:bg-white/5 ${
                                                        activeSubtitle?.id === sub.id ? 'bg-violet-500/10' : ''
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-[10px] font-mono text-white/30">{formatTime(sub.start)}</span>
                                                        <span className="text-[10px] text-white/20">&rarr;</span>
                                                        <span className="text-[10px] font-mono text-white/30">{formatTime(sub.end)}</span>
                                                    </div>
                                                    <p
                                                        className={`text-xs leading-relaxed ${activeSubtitle?.id === sub.id ? 'text-white' : 'text-white/60'}`}
                                                    >
                                                        {sub.text}
                                                    </p>
                                                </button>
                                            )
                                        )}
                                    </div>
                                    <div className="px-4 py-2">
                                        <button
                                            onClick={() => {
                                                const start = currentTime;
                                                const end = Math.min(start + 1, duration);

                                                addNewSubtitle(start, end);
                                            }}
                                            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-white/5 py-2 text-[11px] font-medium text-white/50 transition-all hover:bg-white/10 hover:text-white/80"
                                            title="Ajouter un sous-titre"
                                        >
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
                                                    d="M12 4.5v15m7.5-7.5h-15"
                                                />
                                            </svg>
                                            Ajouter
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
