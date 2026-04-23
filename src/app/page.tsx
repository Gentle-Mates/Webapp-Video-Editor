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
    Film,
    MessageSquareText,
    Download,
    Check,
    RefreshCw,
    Loader2,
    AlertCircle,
    Plus
} from 'lucide-react';
import { signOut } from 'next-auth/react';
import type { DragEvent, ChangeEvent } from 'react';

import { ALL_TRACKS } from '@/components/Tracks';
import { generateSRT, downloadSRT } from '@/utils/srt';
import { formatTime, parseTime } from '@/utils/time';
import type { Subtitle, SubtitleView, TranslationMode, SubtitleTrack } from '@/utils/types';

import ScrubInput from '@/components/ScrubInput';
import SubtitleTimeline from '@/components/SubtitleTimeline';
import ContextWordsModal from '@/components/ContextWordsModal';
import SettingsModal from '@/components/SettingsModal';
import useTranscription from '@/hooks/useTranscription';
import useTranslation from '@/hooks/useTranslation';
import useContextWords from '@/hooks/useContextWords';
import useSettings from '@/hooks/useSettings';

export default function Home() {
    const [videoSrc, setVideoSrc] = useState<string | null>(null);
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [videoName, setVideoName] = useState<string>('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [overlayTracks, setOverlayTracks] = useState<Record<SubtitleView | 'showCurrent', boolean>>({
        showCurrent: true,
        original: false,
        mix: false,
        fr: false,
        en: false
    });
    const [showOverlayMenu, setShowOverlayMenu] = useState(false);
    const [timelineTracks, setTimelineTracks] = useState<Record<SubtitleView | 'showCurrent', boolean>>({
        showCurrent: true,
        original: false,
        mix: false,
        fr: false,
        en: false
    });
    const [showTimelineMenu, setShowTimelineMenu] = useState(false);
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
    const subtitleListRef = useRef<HTMLDivElement>(null);
    const editContainerRef = useRef<HTMLDivElement>(null);
    const subtitleElRefs = useRef<Map<number, HTMLElement>>(new Map());
    const exportMenuRef = useRef<HTMLDivElement>(null);

    const { status, subtitles, error, transcribe, reset, updateSubtitle, addSubtitle, deleteSubtitle, restoreSubtitle } = useTranscription();
    const { settings, saving: settingsSaving, updateSettings } = useSettings();
    const settingsContextWords = useMemo(() => settings?.contextWords ?? [], [settings?.contextWords]);
    const { words: contextWords, addWord, removeWord, resetWords, maxWords } = useContextWords(settingsContextWords);
    const {
        translations,
        isTranslating,
        translationError,
        translate,
        syncTimings,
        updateTranslatedSubtitle,
        addTranslatedSubtitle,
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

    const tracks = (Object.keys(ALL_TRACKS) as SubtitleView[]).filter(track =>
        track === 'original' ? subtitles.length > 0 : translations[track].length > 0
    );
    const selectedExportCount = tracks.filter(t => exportSelection[t]).length;

    const displayedSubtitles = useMemo(() => {
        const subs = subtitleView === 'original' ? subtitles : translations[subtitleView].length > 0 ? translations[subtitleView] : subtitles;

        return [...subs].sort((a, b) => a.start - b.start);
    }, [subtitleView, subtitles, translations]);
    const activeSubtitle = displayedSubtitles.find(sub => currentTime >= sub.start && currentTime <= sub.end) ?? null;

    const timelineTracksToDisplay = useMemo(() => {
        const activeTracks: SubtitleTrack[] = timelineTracks.showCurrent
            ? [
                  {
                      id: subtitleView,
                      label: '',
                      subtitles: displayedSubtitles
                  }
              ]
            : [];

        const otherTracks = (Object.keys(ALL_TRACKS) as SubtitleView[])
            .filter(trackId => timelineTracks[trackId] && !(timelineTracks.showCurrent && trackId === subtitleView))
            .map(trackId => {
                const subs = trackId === 'original' ? subtitles : translations[trackId as TranslationMode];
                return {
                    id: trackId,
                    label: ALL_TRACKS[trackId].label,
                    subtitles: subs,
                    icon: ALL_TRACKS[trackId].icon
                };
            })
            .filter(track => track.subtitles.length > 0);

        return [...activeTracks, ...otherTracks];
    }, [timelineTracks, subtitleView, displayedSubtitles, subtitles, translations]);

    function toggleOverlayTrack(track: SubtitleView) {
        setOverlayTracks(prev => ({
            ...prev,
            showCurrent: false,
            [track]: !prev[track]
        }));
    }

    const activeOverlayTracks = useMemo(() => {
        const overlayTracksToProcess: SubtitleView[] = [];

        if (overlayTracks.showCurrent) {
            overlayTracksToProcess.push(subtitleView);
        }

        (Object.keys(overlayTracks) as (SubtitleView | 'showCurrent')[]).forEach(track => {
            if (track !== 'showCurrent' && overlayTracks[track]) {
                if (!(overlayTracks.showCurrent && track === subtitleView)) {
                    overlayTracksToProcess.push(track as SubtitleView);
                }
            }
        });

        return overlayTracksToProcess
            .map(track => {
                const subs = track === 'original' ? subtitles : translations[track].length > 0 ? translations[track] : null;

                if (!subs) {
                    return null;
                }

                const active = subs.find(sub => currentTime >= sub.start && currentTime <= sub.end);

                return active ? { track, text: active.text } : null;
            })
            .filter((s): s is { track: SubtitleView; text: string } => s !== null);
    }, [overlayTracks, subtitleView, subtitles, translations, currentTime]);

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
            videoRef.current.play().then(() => null);
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
            transcribe(videoFile, contextWords).then(() => {});
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
                    videoRef.current.play().then(() => null);

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
                        className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition-all hover:bg-white/10"
                    >
                        <Settings className="h-3.5 w-3.5" />
                        Settings
                    </button>
                    <button
                        onClick={() => signOut()}
                        className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[11px] font-medium text-white/90 transition-all hover:bg-white/10"
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
                                            <div
                                                key={track}
                                                className="flex items-center gap-2 rounded-lg bg-black/70 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur-sm"
                                            >
                                                {' '}
                                                {activeOverlayTracks.length > 1 && (
                                                    <div className="shrink-0 flex items-center justify-center text-white/60">
                                                        {ALL_TRACKS[track].icon}
                                                    </div>
                                                )}
                                                <p>{text}</p>
                                            </div>
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
                                            className="absolute h-1.5 rounded-full bg-linear-to-r from-secondary to-primary"
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
                                            <Rewind
                                                className="h-4 w-4"
                                                fill="currentColor"
                                            />
                                            <span className="text-xs font-medium">5s</span>
                                        </button>

                                        <button
                                            onClick={togglePlay}
                                            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/85 text-white transition-all hover:bg-primary"
                                            title={isPlaying ? 'Pause' : 'Lecture'}
                                        >
                                            {isPlaying ? (
                                                <Pause
                                                    className="h-5 w-5"
                                                    fill="currentColor"
                                                />
                                            ) : (
                                                <Play
                                                    className="h-5 w-5 ml-0.5"
                                                    fill="currentColor"
                                                />
                                            )}
                                        </button>

                                        <button
                                            onClick={() => skip(5)}
                                            className="group flex h-10 items-center gap-1.5 rounded-full bg-white/5 px-4 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                            title="Avancer de 5 secondes"
                                        >
                                            <span className="text-xs font-medium">5s</span>
                                            <FastForward
                                                className="h-4 w-4"
                                                fill="currentColor"
                                            />
                                        </button>
                                    </div>

                                    {/* Right: Timeline toggle + Subtitle overlay */}
                                    <div
                                        className="flex items-center justify-end gap-2"
                                        style={{ width: '148px' }}
                                    >
                                        {/* Timeline toggle */}
                                        <div className="relative">
                                            <button
                                                onClick={() => subtitles.length > 0 && setShowTimelineMenu(v => !v)}
                                                className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                                                    subtitles.length === 0
                                                        ? 'bg-white/5 text-white/10 cursor-not-allowed'
                                                        : showTimelineMenu || Object.values(timelineTracks).some(Boolean)
                                                          ? 'bg-violet-500/10 text-secondary'
                                                          : 'bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/60'
                                                }`}
                                                disabled={subtitles.length === 0}
                                                title="Paramètres de la timeline"
                                            >
                                                <Film className="h-4 w-4" />
                                            </button>

                                            {showTimelineMenu && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onPointerDown={() => setShowTimelineMenu(false)}
                                                    />
                                                    <div className="absolute bottom-full right-0 z-20 mb-2 min-w-40 rounded-xl border border-white/10 bg-[#141416] p-1.5 shadow-xl">
                                                        <button
                                                            onClick={() =>
                                                                setTimelineTracks(prev => ({
                                                                    ...prev,
                                                                    showCurrent: !prev.showCurrent
                                                                }))
                                                            }
                                                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:bg-white/5 ${
                                                                timelineTracks.showCurrent ? 'text-secondary' : 'text-white/50 hover:text-white/80'
                                                            }`}
                                                        >
                                                            <div
                                                                className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                                                                    timelineTracks.showCurrent
                                                                        ? 'border-secondary bg-secondary text-black'
                                                                        : 'border-white/20'
                                                                }`}
                                                            >
                                                                {timelineTracks.showCurrent && (
                                                                    <Check
                                                                        className="h-3 w-3"
                                                                        strokeWidth={3}
                                                                    />
                                                                )}
                                                            </div>
                                                            Track en cours
                                                        </button>

                                                        <div className="my-1 h-px bg-white/5" />

                                                        {(Object.keys(ALL_TRACKS) as SubtitleView[]).map(trackId => {
                                                            const active = timelineTracks[trackId];

                                                            if (!(trackId === 'original' ? subtitles.length > 0 : translations[trackId].length > 0)) {
                                                                return null;
                                                            }

                                                            return (
                                                                <button
                                                                    key={trackId}
                                                                    onClick={() =>
                                                                        setTimelineTracks(prev => ({
                                                                            ...prev,
                                                                            showCurrent: false,
                                                                            [trackId]: !prev[trackId]
                                                                        }))
                                                                    }
                                                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:bg-white/5 ${
                                                                        active ? 'text-secondary' : 'text-white/50 hover:text-white/80'
                                                                    }`}
                                                                >
                                                                    <div
                                                                        className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                                                                            active ? 'border-secondary bg-secondary text-black' : 'border-white/20'
                                                                        }`}
                                                                    >
                                                                        {active && (
                                                                            <Check
                                                                                className="h-3 w-3"
                                                                                strokeWidth={3}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    {ALL_TRACKS[trackId].label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>

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
                                                <MessageSquareText className="h-4 w-4" />
                                            </button>

                                            {showOverlayMenu && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onPointerDown={() => setShowOverlayMenu(false)}
                                                    />
                                                    <div className="absolute bottom-full right-0 z-20 mb-2 min-w-40 rounded-xl border border-white/10 bg-[#141416] p-1.5 shadow-xl">
                                                        <button
                                                            onClick={() =>
                                                                setOverlayTracks(prev => ({
                                                                    ...prev,
                                                                    showCurrent: !prev.showCurrent
                                                                }))
                                                            }
                                                            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:bg-white/5 ${
                                                                overlayTracks.showCurrent ? 'text-secondary' : 'text-white/50 hover:text-white/80'
                                                            }`}
                                                        >
                                                            <div
                                                                className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                                                                    overlayTracks.showCurrent
                                                                        ? 'border-secondary bg-secondary text-black'
                                                                        : 'border-white/20'
                                                                }`}
                                                            >
                                                                {overlayTracks.showCurrent && (
                                                                    <Check
                                                                        className="h-3 w-3"
                                                                        strokeWidth={3}
                                                                    />
                                                                )}
                                                            </div>
                                                            Track en cours
                                                        </button>

                                                        <div className="my-1 h-px bg-white/5" />

                                                        {(Object.keys(ALL_TRACKS) as SubtitleView[]).map(trackId => {
                                                            const active = overlayTracks[trackId];

                                                            if (!(trackId === 'original' ? subtitles.length > 0 : translations[trackId].length > 0)) {
                                                                return null;
                                                            }

                                                            return (
                                                                <button
                                                                    key={trackId}
                                                                    onClick={() => toggleOverlayTrack(trackId)}
                                                                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-all hover:bg-white/5 ${
                                                                        active ? 'text-secondary' : 'text-white/50 hover:text-white/80'
                                                                    }`}
                                                                >
                                                                    <div
                                                                        className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                                                                            active ? 'border-secondary bg-secondary text-black' : 'border-white/20'
                                                                        }`}
                                                                    >
                                                                        {active && (
                                                                            <Check
                                                                                className="h-3 w-3"
                                                                                strokeWidth={3}
                                                                            />
                                                                        )}
                                                                    </div>
                                                                    {ALL_TRACKS[trackId].label}
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
                                {timelineTracksToDisplay.length > 0 && status === 'done' && (
                                    <div className="mt-4 rounded-lg border border-white/5 bg-white/2">
                                        <SubtitleTimeline
                                            tracks={timelineTracksToDisplay}
                                            duration={duration}
                                            currentTime={currentTime}
                                            activeSubtitleId={activeSubtitle?.id ?? null}
                                            onSeek={seekTo}
                                            onSubtitleUpdate={handleTimelineSubtitleUpdate}
                                            onSubtitleTextEdit={(trackId, sub) => {
                                                setSubtitleView(trackId);
                                                startEditing(sub);
                                            }}
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
                                    <span className="flex items-center gap-1.5">
                                        <kbd className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-white/40">Ctrl + Z</kbd>
                                        <span>Undo</span>
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
                                            <div
                                                className="relative"
                                                ref={exportMenuRef}
                                            >
                                                <button
                                                    onClick={() => setShowExportMenu(v => !v)}
                                                    className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                                    title="Exporter SRT"
                                                >
                                                    <Download className="h-4 w-4" />
                                                </button>
                                                {showExportMenu && (
                                                    <div className="absolute right-0 top-full z-20 mt-2 min-w-40 rounded-xl border border-white/10 bg-[#141416] p-1.5 shadow-xl">
                                                        {tracks.map(track => {
                                                            const checked = exportSelection[track];

                                                            return (
                                                                <button
                                                                    key={track}
                                                                    onClick={() => setExportSelection(prev => ({ ...prev, [track]: !prev[track] }))}
                                                                    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] text-white/70 transition-all hover:bg-white/5"
                                                                >
                                                                    <div
                                                                        className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                                                                            checked ? 'border-secondary bg-secondary/20' : 'border-white/20'
                                                                        }`}
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
                                                                className="flex w-full items-center justify-center rounded-lg bg-secondary/20 px-3 py-1.5 text-[11px] font-medium text-secondary transition-all hover:bg-secondary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                                            >
                                                                Télécharger ({selectedExportCount})
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => setShowContextModal(true)}
                                                className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                                title="Mots de contexte"
                                            >
                                                <SlidersHorizontal className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={handleReload}
                                                disabled={isTranslating}
                                                className="flex items-center gap-1.5 rounded-md bg-white/5 px-2.5 py-1.5 text-[10px] font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
                                                title={subtitleView === 'original' ? 'Regénérer les sous-titres' : 'Retraduire'}
                                            >
                                                {isTranslating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* View tabs */}
                            {status === 'done' && subtitles.length > 0 && (
                                <div className="flex border-b border-white/5">
                                    {(Object.keys(ALL_TRACKS) as SubtitleView[]).map(trackId => {
                                        const track = ALL_TRACKS[trackId];

                                        return (
                                            <button
                                                key={trackId}
                                                onClick={() => {
                                                    if (trackId === 'original') {
                                                        setSubtitleView('original');
                                                    } else {
                                                        handleTranslate(trackId).then(() => null);
                                                    }
                                                }}
                                                disabled={isTranslating && trackId !== 'original'}
                                                className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-[10px] font-medium transition-all disabled:opacity-40 ${
                                                    subtitleView === trackId
                                                        ? 'text-white bg-white/5'
                                                        : 'text-white/40 hover:text-white/60 hover:bg-white/2'
                                                }`}
                                                title={track.label}
                                            >
                                                {track.icon}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Processing state */}
                            {isProcessing && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                    <p className="text-sm font-medium text-white/80">{progressLabel}</p>
                                </div>
                            )}

                            {/* Error state */}
                            {status === 'error' && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                                        <AlertCircle className="h-6 w-6 text-red-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-red-400">Erreur</p>
                                        <p className="mt-1 text-xs text-white/40">{error}</p>
                                    </div>
                                    <button
                                        onClick={handleTranscribe}
                                        className="mt-2 flex items-center gap-2 rounded-full bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        Réessayer
                                    </button>
                                </div>
                            )}

                            {/* Idle state */}
                            {status === 'idle' && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleTranscribe}
                                            className="flex items-center gap-2 rounded-lg bg-primary/85 px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary"
                                        >
                                            <MessageSquareText className="h-4 w-4" />
                                            Générer les sous-titres
                                        </button>
                                        <button
                                            onClick={() => setShowContextModal(true)}
                                            className="flex items-center justify-center rounded-lg bg-white/5 p-2.5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                            title="Mots de contexte"
                                        >
                                            <SlidersHorizontal className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Translating state */}
                            {isTranslating && subtitleView !== 'original' && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                    <p className="text-sm font-medium text-white/80">Traduction...</p>
                                </div>
                            )}

                            {/* Translation error state */}
                            {!isTranslating && subtitleView !== 'original' && translationError && (
                                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                                        <AlertCircle className="h-6 w-6 text-red-400" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-medium text-red-400">Erreur de traduction</p>
                                        <p className="mt-1 text-xs text-white/40">{translationError}</p>
                                    </div>
                                    <button
                                        onClick={() => handleTranslate(subtitleView, true)}
                                        className="mt-2 flex items-center gap-2 rounded-full bg-red-500/10 px-5 py-2.5 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20"
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                        Réessayer
                                    </button>
                                </div>
                            )}

                            {/* Subtitles list */}
                            {status === 'done' &&
                                !isTranslating &&
                                !(subtitleView !== 'original' && translationError) &&
                                displayedSubtitles.length > 0 && (
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
                                                                        <Trash2 className="size-3.5" />
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
                                                                            Durée:{' '}
                                                                            {duration ? (isInvalid ? 'invalide' : `${duration.toFixed(2)}s`) : '—'}
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
                                                            className="w-full field-sizing-content resize-none rounded border-none bg-white/10 px-2 py-1 text-xs leading-relaxed text-white outline-none focus:ring-1 focus:ring-inset focus:ring-primary"
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
                                                <Plus className="h-3.5 w-3.5" />
                                                Ajouter
                                            </button>
                                        </div>
                                    </div>
                                )}
                        </div>
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
