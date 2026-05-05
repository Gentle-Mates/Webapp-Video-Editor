'use client';

import { useState, useRef, useEffect, useEffectEvent, useMemo } from 'react';
import {
    SlidersHorizontal,
    Settings,
    Video,
    Trash2,
    LogOut,
    Upload,
    VolumeX,
    Volume1,
    Volume2,
    Rewind,
    Pause,
    Play,
    FastForward,
    MessageSquareText,
    Download,
    Check,
    RefreshCw,
    Loader2,
    AlertCircle,
    Type
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import type { DragEvent, ChangeEvent } from 'react';

import { ALL_TRACKS } from '@/components/Tracks';
import { generateSRT, downloadSRT } from '@/utils/srt';
import { formatTime, parseTime } from '@/utils/time';
import { usePendingVideo } from '@/contexts/PendingVideo';
import type { Subtitle, SubtitleView, TranslationMode } from '@/utils/types';

import ScrubInput from '@/components/ScrubInput';
import ContextWordsModal from '@/components/ContextWordsModal';
import SettingsModal from '@/components/SettingsModal';
import useTranscription from '@/hooks/useTranscription';
import useTranslation from '@/hooks/useTranslation';
import useContextWords from '@/hooks/useContextWords';
import useSettings from '@/hooks/useSettings';

const TRACK_IDS = Object.keys(ALL_TRACKS) as SubtitleView[];

export default function ShortPage() {
    const { pendingFile, setPendingFile } = usePendingVideo();

    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoName, setVideoName] = useState<string>('');
    const [words, setWords] = useState<number>(3);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [showExportMenu, setShowExportMenu] = useState(false);
    const [showContextModal, setShowContextModal] = useState(false);
    const [showSettingsModal, setShowSettingsModal] = useState(false);
    const [exportSelection, setExportSelection] = useState<Record<SubtitleView, boolean>>({
        original: true,
        mix: true,
        fr: true,
        en: true
    });
    const [volume, setVolume] = useState(1);

    const videoRef = useRef<HTMLVideoElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const editContainerRef = useRef<HTMLDivElement>(null);
    const subtitleElRefs = useRef<Map<number, HTMLElement>>(new Map());
    const exportMenuRef = useRef<HTMLDivElement>(null);

    const { status, subtitles, error, transcribe, reset, updateSubtitle, deleteSubtitle, restoreSubtitle } = useTranscription();
    const { settings, saving: settingsSaving, updateSettings } = useSettings();
    const settingsContextWords = settings?.contextWords ?? [];
    const { words: contextWords, addWord, removeWord, resetWords, maxWords } = useContextWords(settingsContextWords);
    const {
        translations,
        isTranslating,
        translationError,
        translate,
        syncTimings,
        updateTranslatedSubtitle,
        deleteTranslatedSubtitle,
        restoreTranslatedSubtitles,
        resetTranslations
    } = useTranslation();

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editText, setEditText] = useState('');
    const [editStart, setEditStart] = useState('');
    const [editEnd, setEditEnd] = useState('');
    const [subtitleView, setSubtitleView] = useState<SubtitleView>('original');

    const [undoStack, setUndoStack] = useState<
        {
            original: Subtitle;
            translations: Partial<Record<TranslationMode, Subtitle>>;
        }[]
    >([]);

    const tracks = TRACK_IDS.filter(track => (track === 'original' ? subtitles.length > 0 : translations[track].length > 0));
    const selectedExportCount = tracks.filter(t => exportSelection[t]).length;

    const displayedSubtitles = useMemo(() => {
        const subs = subtitleView === 'original' ? subtitles : translations[subtitleView].length > 0 ? translations[subtitleView] : subtitles;

        return [...subs].sort((a, b) => a.start - b.start);
    }, [subtitleView, subtitles, translations]);
    const activeSubtitle = displayedSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end) ?? null;

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
            resetWords();
            setSubtitleView('original');
            reset();
        }
    }

    const consumePendingFile = useEffectEvent(() => {
        if (pendingFile && !videoFile) {
            handleFileSelect(pendingFile);
            setPendingFile(null);
        }
    });

    useEffect(() => {
        consumePendingFile();
    }, [pendingFile]);

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
        resetWords();
        reset();
    }

    function removeSubtitle(id: number) {
        const original = subtitles.find(s => s.id === id);

        if (original) {
            const subtitleTranslations: Partial<Record<TranslationMode, Subtitle>> = {};

            for (const mode of ['mix', 'fr', 'en'] as const) {
                const trans = translations[mode].find(s => s.id === id);

                if (trans) {
                    subtitleTranslations[mode] = trans;
                }
            }

            setUndoStack(prev => [...prev.slice(-49), { original, translations: subtitleTranslations }]);
        }

        deleteSubtitle(id);
        deleteTranslatedSubtitle(id);

        if (editingId === id) {
            setEditingId(null);
        }
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
            void videoRef.current.play();
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
            void transcribe(videoFile, { mode: 'short', contextWords, words });
        }
    }

    useEffect(() => {
        if (!showExportMenu) {
            return;
        }

        function handleClick(e: MouseEvent) {
            if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
                setShowExportMenu(false);
            }
        }

        document.addEventListener('mousedown', handleClick);

        return () => document.removeEventListener('mousedown', handleClick);
    }, [showExportMenu]);

    function handleExportSRT() {
        const baseName = videoName.replace(/\.[^.]+$/, '');

        tracks
            .filter(t => exportSelection[t])
            .forEach(track => {
                const content = generateSRT([...(track === 'original' ? subtitles : translations[track])].sort((a, b) => a.start - b.start));

                downloadSRT(content, `${baseName}${ALL_TRACKS[track].suffix}.srt`);
            });

        setShowExportMenu(false);
    }

    async function handleTranslate(mode: TranslationMode, forceRefresh = false) {
        setSubtitleView(mode);
        await translate(subtitles, mode, forceRefresh);
    }

    function handleReload() {
        if (subtitleView === 'original') {
            handleTranscribe();
        } else {
            void handleTranslate(subtitleView, true);
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

    const handleUndo = useEffectEvent(() => {
        if (undoStack.length === 0) {
            return;
        }

        const lastDeleted = undoStack[undoStack.length - 1];

        restoreSubtitle(lastDeleted.original);
        restoreTranslatedSubtitles(lastDeleted.translations);
        setUndoStack(prev => prev.slice(0, -1));
    });

    const handleKeyDown = useEffectEvent((e: KeyboardEvent) => {
        if (!videoSrc || !videoRef.current) {
            return;
        }

        const target = e.target as HTMLElement;
        const isEditing = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT';

        if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyZ' || e.key === 'z' || e.key === 'Z') && !isEditing) {
            e.preventDefault();
            handleUndo();

            return;
        }

        if ((e.code === 'ArrowUp' || e.code === 'ArrowDown') && !isEditing && displayedSubtitles.length > 0) {
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
                    void videoRef.current.play();
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
        <div className="flex h-screen flex-col overflow-hidden bg-base">
            {/* Header */}
            <header className="grid h-12 shrink-0 grid-cols-3 items-center border-b border-white/5 bg-base px-5">
                <div className="flex items-center gap-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
                        <Video className="h-4 w-4 text-white" />
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
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div />
                )}
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={() => setShowSettingsModal(true)}
                        className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-xxs font-medium text-white/90 transition-all hover:bg-white/10"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                    </button>
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-xxs font-medium text-white/90 transition-all hover:bg-white/10"
                    >
                        <LogOut className="h-3.5 w-3.5" />
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
                            className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-white/10 bg-white/2 p-14 backdrop-blur-sm transition-all hover:border-primary/50 hover:bg-white/4 cursor-pointer"
                        >
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-white/10">
                                <Upload
                                    className="h-8 w-8 text-primary"
                                    strokeWidth={1.5}
                                />
                            </div>
                            <div className="text-center">
                                <p className="font-medium text-white/90">Importer un short</p>
                                <p className="mt-1.5 text-sm text-white/40">Glissez-déposez ou cliquez pour sélectionner une vidéo 9:16</p>
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
                    /* Editor short — 3 columns */
                    <div className="flex flex-1 overflow-hidden">
                        {/* Right column: Configuration (taille des sous-titres, couleur, etc.) */}
                        <aside className="scrollbar-dark order-3 flex w-96 shrink-0 flex-col gap-5 overflow-y-auto border-l border-white/5 bg-panel p-5">
                            <div>
                                <p className="mb-1 text-xxs font-semibold uppercase tracking-wider text-white/40">Configuration</p>
                                <p className="text-xxs text-white/30">Paramètres de génération</p>
                            </div>

                            {/* Words per subtitle slider */}
                            <div className="flex flex-col gap-2.5 rounded-xl border border-white/5 bg-white/2 p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Type className="h-3.5 w-3.5 text-white/50" />
                                        <span className="text-xxs font-medium text-white/70">Mots par sous-titre</span>
                                    </div>
                                    <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-xxs font-medium text-white">{words}</span>
                                </div>
                                <input
                                    type="range"
                                    min={1}
                                    max={8}
                                    step={1}
                                    value={words}
                                    onChange={e => setWords(Number(e.target.value))}
                                    disabled={isProcessing || subtitles.length > 0}
                                    className="w-full accent-primary disabled:opacity-40"
                                />
                                <div className="flex justify-between text-[9px] text-white/30">
                                    <span>1</span>
                                    <span>8</span>
                                </div>
                            </div>

                            {/* Context words */}
                            <button
                                onClick={() => setShowContextModal(true)}
                                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/2 p-4 text-left transition-all hover:border-white/10 hover:bg-white/4"
                            >
                                <div className="flex items-center gap-2">
                                    <SlidersHorizontal className="h-3.5 w-3.5 text-white/50" />
                                    <span className="text-xxs font-medium text-white/70">Mots de contexte</span>
                                </div>
                                <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-xxs font-medium text-white">
                                    {contextWords.length}
                                </span>
                            </button>

                            {/* Generate button */}
                            <button
                                onClick={handleTranscribe}
                                disabled={isProcessing}
                                className="flex items-center justify-center gap-2 rounded-xl bg-primary/85 px-4 py-3 text-sm font-medium text-white transition-all hover:bg-primary disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        {progressLabel}
                                    </>
                                ) : subtitles.length > 0 ? (
                                    <>
                                        <RefreshCw className="h-4 w-4" />
                                        Régénérer
                                    </>
                                ) : (
                                    <>
                                        <MessageSquareText className="h-4 w-4" />
                                        Générer les sous-titres
                                    </>
                                )}
                            </button>

                            {/* Error */}
                            {status === 'error' && (
                                <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-center">
                                    <AlertCircle className="h-5 w-5 text-red-400" />
                                    <p className="text-xxs text-red-400">{error}</p>
                                    <button
                                        onClick={handleTranscribe}
                                        className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-xxs font-medium text-red-400 transition-all hover:bg-red-500/25"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Réessayer
                                    </button>
                                </div>
                            )}

                            {/* Reload */}
                            {status === 'done' && subtitles.length > 0 && subtitleView !== 'original' && (
                                <button
                                    onClick={handleReload}
                                    disabled={isTranslating || isProcessing}
                                    className="flex items-center justify-center gap-2 rounded-md bg-white/5 px-3 py-2 text-xxs font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {isTranslating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                                    Retraduire
                                </button>
                            )}

                            {/* Export */}
                            {status === 'done' && subtitles.length > 0 && (
                                <div
                                    className="relative"
                                    ref={exportMenuRef}
                                >
                                    <button
                                        onClick={() => setShowExportMenu(v => !v)}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/5 bg-white/2 px-4 py-3 text-sm font-medium text-white/80 transition-all hover:border-white/10 hover:bg-white/4 hover:text-white"
                                    >
                                        <Download className="h-4 w-4" />
                                        Exporter SRT
                                    </button>
                                    {showExportMenu && (
                                        <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-white/10 bg-elevated p-1.5 shadow-xl">
                                            {tracks.map(track => {
                                                const checked = exportSelection[track];

                                                return (
                                                    <button
                                                        key={track}
                                                        onClick={() => setExportSelection(prev => ({ ...prev, [track]: !prev[track] }))}
                                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xxs text-white/70 transition-all hover:bg-white/5"
                                                    >
                                                        <div
                                                            className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${checked ? 'border-secondary bg-secondary/20' : 'border-white/20'}`}
                                                        >
                                                            {checked && (
                                                                <Check
                                                                    className="h-2.5 w-2.5 text-secondary"
                                                                    strokeWidth={3}
                                                                />
                                                            )}
                                                        </div>
                                                        {ALL_TRACKS[track].label}
                                                    </button>
                                                );
                                            })}
                                            <div className="mt-1 pt-1">
                                                <button
                                                    onClick={handleExportSRT}
                                                    disabled={selectedExportCount === 0}
                                                    className="flex w-full items-center justify-center rounded-lg bg-secondary/20 px-3 py-1.5 text-xxs font-medium text-secondary transition-all hover:bg-secondary/30 disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                    Télécharger ({selectedExportCount})
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </aside>

                        {/* Center column: Phone preview */}
                        <section className="order-2 flex flex-1 flex-col overflow-hidden bg-canvas">
                            <div className="flex flex-1 items-center justify-center p-6 min-h-0">
                                <div className="relative aspect-9/16 h-full max-h-full max-w-full overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_0_60px_rgba(0,0,0,0.5)]">
                                    <video
                                        ref={videoRef}
                                        src={videoSrc}
                                        className="h-full w-full object-cover"
                                        onClick={togglePlay}
                                    />

                                    {activeSubtitle && (
                                        <div className="pointer-events-none absolute bottom-16 left-1/2 max-w-[88%] -translate-x-1/2">
                                            <div className="rounded-lg bg-black/75 px-4 py-2 text-center text-sm font-semibold text-white backdrop-blur-sm">
                                                {activeSubtitle.text}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Controls panel */}
                            <div className="shrink-0 border-t border-white/5 bg-panel px-6 py-4">
                                {/* Timeline */}
                                <div className="mb-4">
                                    <div className="group relative flex h-6 cursor-pointer items-center">
                                        <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/10" />
                                        <div
                                            className="absolute h-1.5 rounded-full bg-linear-to-r from-secondary to-primary"
                                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                        />
                                        <div
                                            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 rounded-full bg-white shadow-lg shadow-black/50"
                                            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                                        />
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
                                    <div className="mt-2 flex justify-between font-mono text-xxs font-medium text-white/30">
                                        <span>{formatTime(currentTime)}</span>
                                        <span>{formatTime(duration)}</span>
                                    </div>
                                </div>

                                {/* Control buttons */}
                                <div className="flex items-center justify-between">
                                    {/* Volume */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={toggleMute}
                                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                            title={volume > 0 ? 'Couper le son' : 'Activer le son'}
                                        >
                                            {volume === 0 ? (
                                                <VolumeX className="h-4 w-4" />
                                            ) : volume < 0.5 ? (
                                                <Volume1 className="h-4 w-4" />
                                            ) : (
                                                <Volume2 className="h-4 w-4" />
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
                                                className="absolute inset-0 cursor-pointer opacity-0"
                                            />
                                        </div>
                                    </div>

                                    {/* Center playback */}
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => skip(-5)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                            title="-5s"
                                        >
                                            <Rewind className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={togglePlay}
                                            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/85 text-white transition-all hover:bg-primary"
                                            title={isPlaying ? 'Pause' : 'Play'}
                                        >
                                            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                                        </button>
                                        <button
                                            onClick={() => skip(5)}
                                            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/70 transition-all hover:bg-white/10 hover:text-white"
                                            title="+5s"
                                        >
                                            <FastForward className="h-4 w-4" />
                                        </button>
                                    </div>

                                    <div className="w-31" />
                                </div>
                            </div>
                        </section>

                        {/* Left column: Subtitles */}
                        <aside className="order-1 flex w-80 shrink-0 flex-col border-r border-white/5 bg-panel">
                            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
                                <span className="text-xs font-medium text-white/60">Sous-titres</span>
                                {subtitles.length > 0 && (
                                    <span className="rounded-md bg-white/5 px-2 py-0.5 font-mono text-2xs text-white/60">
                                        {displayedSubtitles.length}
                                    </span>
                                )}
                            </div>

                            {/* View tabs */}
                            {status === 'done' && subtitles.length > 0 && (
                                <div className="flex border-b border-white/5">
                                    {TRACK_IDS.map(trackId => {
                                        const track = ALL_TRACKS[trackId];

                                        return (
                                            <button
                                                key={trackId}
                                                onClick={() => {
                                                    if (trackId === 'original') {
                                                        setSubtitleView('original');
                                                    } else {
                                                        void handleTranslate(trackId);
                                                    }
                                                }}
                                                disabled={isTranslating && trackId !== 'original'}
                                                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-2xs font-medium transition-all disabled:opacity-40 ${
                                                    subtitleView === trackId
                                                        ? 'bg-white/5 text-white'
                                                        : 'text-white/40 hover:bg-white/2 hover:text-white/60'
                                                }`}
                                                title={track.label}
                                            >
                                                {track.icon}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* States */}
                            {isProcessing && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    </div>
                                    <p className="text-xs font-medium text-white/70">{progressLabel}</p>
                                </div>
                            )}

                            {status === 'idle' && !isProcessing && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
                                    <MessageSquareText className="h-6 w-6 text-white/20" />
                                    <p className="text-xs text-white/40">Lance la génération depuis le panneau de gauche</p>
                                </div>
                            )}

                            {isTranslating && subtitleView !== 'original' && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                    </div>
                                    <p className="text-xs font-medium text-white/70">Traduction...</p>
                                </div>
                            )}

                            {!isTranslating && subtitleView !== 'original' && translationError && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
                                    <AlertCircle className="h-5 w-5 text-red-400" />
                                    <p className="text-xs text-red-400">{translationError}</p>
                                    <button
                                        onClick={() => handleTranslate(subtitleView, true)}
                                        className="flex items-center gap-1.5 rounded-md bg-red-500/15 px-3 py-1.5 text-xxs font-medium text-red-400 transition-all hover:bg-red-500/25"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Réessayer
                                    </button>
                                </div>
                            )}

                            {/* Subtitles list */}
                            {status === 'done' &&
                                !isTranslating &&
                                !(subtitleView !== 'original' && translationError) &&
                                displayedSubtitles.length > 0 && (
                                    <div className="scrollbar-dark flex-1 overflow-y-auto p-3">
                                        <div className="flex flex-col gap-1.5">
                                            {displayedSubtitles.map(sub => {
                                                const isActive = activeSubtitle?.id === sub.id;
                                                const isEditing = editingId === sub.id;

                                                return (
                                                    <div
                                                        key={sub.id}
                                                        ref={el => {
                                                            if (el) {
                                                                subtitleElRefs.current.set(sub.id, el);
                                                            }

                                                            return () => {
                                                                subtitleElRefs.current.delete(sub.id);
                                                            };
                                                        }}
                                                        className={`group rounded-xl border p-3 transition-all ${
                                                            isEditing
                                                                ? 'border-primary/50 bg-primary/5'
                                                                : isActive
                                                                  ? 'border-secondary/40 bg-secondary/5'
                                                                  : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/4'
                                                        }`}
                                                    >
                                                        {isEditing ? (
                                                            <div
                                                                ref={editContainerRef}
                                                                className="flex flex-col gap-2"
                                                            >
                                                                <textarea
                                                                    value={editText}
                                                                    onChange={e => setEditText(e.target.value)}
                                                                    rows={2}
                                                                    autoFocus
                                                                    className="w-full resize-none rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none focus:border-white/20"
                                                                />
                                                                <div className="flex flex-col gap-1.5 font-mono text-2xs text-white/60">
                                                                    <ScrubInput
                                                                        value={editStart}
                                                                        onChange={setEditStart}
                                                                        onCommit={saveEdit}
                                                                        onCancel={cancelEdit}
                                                                        label="début"
                                                                        onSetCurrent={() => setEditStart(formatTime(currentTime))}
                                                                    />
                                                                    <ScrubInput
                                                                        value={editEnd}
                                                                        onChange={setEditEnd}
                                                                        onCommit={saveEdit}
                                                                        onCancel={cancelEdit}
                                                                        label="fin"
                                                                        onSetCurrent={() => setEditEnd(formatTime(currentTime))}
                                                                    />
                                                                </div>
                                                                <div className="flex justify-end gap-1.5">
                                                                    <button
                                                                        onClick={cancelEdit}
                                                                        className="rounded-md px-2 py-1 text-2xs text-white/50 hover:bg-white/5 hover:text-white"
                                                                    >
                                                                        Annuler
                                                                    </button>
                                                                    <button
                                                                        onClick={saveEdit}
                                                                        className="rounded-md bg-primary/85 px-2 py-1 text-2xs font-medium text-white hover:bg-primary"
                                                                    >
                                                                        Enregistrer
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => {
                                                                    seekTo(sub.start);
                                                                    startEditing(sub);
                                                                }}
                                                                className="flex w-full flex-col gap-1.5 text-left"
                                                            >
                                                                <div className="flex items-center justify-between gap-2">
                                                                    <span className="font-mono text-2xs text-white/40">
                                                                        {formatTime(sub.start)} → {formatTime(sub.end)}
                                                                    </span>
                                                                    <div
                                                                        role="button"
                                                                        tabIndex={0}
                                                                        onClick={e => {
                                                                            e.stopPropagation();

                                                                            removeSubtitle(sub.id);
                                                                        }}
                                                                        onKeyDown={e => {
                                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();

                                                                                removeSubtitle(sub.id);
                                                                            }
                                                                        }}
                                                                        className="rounded p-1 text-white/30 opacity-0 transition-all hover:bg-red-500/15 hover:text-red-400 group-hover:opacity-100"
                                                                        title="Supprimer"
                                                                    >
                                                                        <Trash2 className="h-3 w-3" />
                                                                    </div>
                                                                </div>
                                                                <span
                                                                    className={`text-[13px] leading-snug ${isActive || isEditing ? 'font-medium text-white' : 'text-white/80'}`}
                                                                >
                                                                    {sub.text || <span className="text-white/30 italic">vide</span>}
                                                                </span>
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                        </aside>
                    </div>
                )}
            </main>

            {showContextModal && (
                <ContextWordsModal
                    words={contextWords}
                    maxWords={maxWords}
                    onAdd={addWord}
                    onRemove={removeWord}
                    onClose={() => setShowContextModal(false)}
                />
            )}

            {showSettingsModal && settings && (
                <SettingsModal
                    allowedEmails={settings.allowedEmails}
                    contextWords={settings.contextWords}
                    saving={settingsSaving}
                    onUpdate={updateSettings}
                    onClose={() => setShowSettingsModal(false)}
                />
            )}
        </div>
    );
}
