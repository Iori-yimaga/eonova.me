'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

interface AudioPlayerProps {
    src: string
    coverUrl?: string | null
    name?: string
    artist?: string
}

function formatTime(seconds: number): string {
    if (!Number.isFinite(seconds)) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
}

export default function AudioPlayer({ src, coverUrl, name, artist }: AudioPlayerProps) {
    const audioRef = useRef<HTMLAudioElement>(null)
    const [isPlaying, setIsPlaying] = useState(false)
    const [currentTime, setCurrentTime] = useState(0)
    const [duration, setDuration] = useState(0)
    const [isLoading, setIsLoading] = useState(true)

    const togglePlay = useCallback(() => {
        const audio = audioRef.current
        if (!audio) return
        if (audio.paused) {
            audio.play().catch(() => { })
        } else {
            audio.pause()
        }
    }, [])

    useEffect(() => {
        const audio = audioRef.current
        if (!audio) return

        const onPlay = () => setIsPlaying(true)
        const onPause = () => setIsPlaying(false)
        const onTimeUpdate = () => setCurrentTime(audio.currentTime)
        const onLoadedMetadata = () => {
            setDuration(audio.duration)
            setIsLoading(false)
        }
        const onEnded = () => {
            setIsPlaying(false)
            setCurrentTime(0)
        }
        const onCanPlay = () => setIsLoading(false)

        audio.addEventListener('play', onPlay)
        audio.addEventListener('pause', onPause)
        audio.addEventListener('timeupdate', onTimeUpdate)
        audio.addEventListener('loadedmetadata', onLoadedMetadata)
        audio.addEventListener('ended', onEnded)
        audio.addEventListener('canplay', onCanPlay)

        return () => {
            audio.removeEventListener('play', onPlay)
            audio.removeEventListener('pause', onPause)
            audio.removeEventListener('timeupdate', onTimeUpdate)
            audio.removeEventListener('loadedmetadata', onLoadedMetadata)
            audio.removeEventListener('ended', onEnded)
            audio.removeEventListener('canplay', onCanPlay)
        }
    }, [])

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current
        if (!audio || !duration) return
        const rect = e.currentTarget.getBoundingClientRect()
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
        audio.currentTime = ratio * duration
    }, [duration])

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0

    return (
        <div className="flex items-center gap-3 rounded-xl bg-foreground/5 p-3">
            <audio ref={audioRef} src={src} preload="metadata" />

            {/* 封面 */}
            {coverUrl && (
                <img
                    src={coverUrl}
                    alt={name ?? 'cover'}
                    className="h-10 w-10 shrink-0 rounded-md object-cover"
                />
            )}

            <div className="min-w-0 flex-1">
                {/* 歌名 + 歌手 */}
                {(name || artist) && (
                    <div className="mb-1 truncate text-xs text-muted-foreground">
                        {name}
                        {artist && ` · ${artist}`}
                    </div>
                )}

                {/* 进度条 */}
                <div
                    className="group relative h-1.5 w-full cursor-pointer rounded-full bg-foreground/10"
                    onClick={handleSeek}
                >
                    <div
                        className="absolute left-0 top-0 h-full rounded-full bg-primary transition-[width] duration-100"
                        style={{ width: `${progress}%` }}
                    />
                    <div
                        className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary opacity-0 transition-opacity group-hover:opacity-100"
                        style={{ left: `${progress}%` }}
                    />
                </div>

                {/* 时间 */}
                <div className="mt-0.5 flex justify-between text-[10px] text-muted-foreground/70">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* 播放/暂停按钮 */}
            <button
                onClick={togglePlay}
                disabled={isLoading}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                aria-label={isPlaying ? '暂停' : '播放'}
            >
                {isLoading ? (
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                ) : isPlaying ? (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" rx="1" />
                        <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5.14v14.72a1 1 0 001.5.86l11.5-7.36a1 1 0 000-1.72L9.5 4.28A1 1 0 008 5.14z" />
                    </svg>
                )}
            </button>
        </div>
    )
}
