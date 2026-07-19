import * as z from 'zod'

// 网易云音乐 /api/v1/play/record 新版 API 响应 Schema
// type=0 返回 allData（全部时间排行），type=1 返回 weekData（本周排行）
export const NetEasePlayRecordSchema = z.object({
    code: z.number(),
    allData: z.array(
        z.object({
            playCount: z.number(),
            score: z.number(),
            song: z.object({
                id: z.number(),
                name: z.string(),
                ar: z.array(
                    z.object({
                        name: z.string(),
                    }),
                ),
                al: z.object({
                    name: z.string(),
                    picUrl: z.string().optional(),
                }).optional(),
                dt: z.number(),
            }),
        }),
    ).optional(),
    weekData: z.array(
        z.object({
            playCount: z.number(),
            score: z.number(),
            song: z.object({
                id: z.number(),
                name: z.string(),
                ar: z.array(
                    z.object({
                        name: z.string(),
                    }),
                ),
                al: z.object({
                    name: z.string(),
                    picUrl: z.string().optional(),
                }).optional(),
                dt: z.number(),
            }),
        }),
    ).optional(),
})

const SongSchema = z.object({
    id: z.number(),
    name: z.string(),
    artist: z.string(),
    songUrl: z.string(),
    audioUrl: z.string().nullable(),
    coverUrl: z.string().nullable(),
    duration: z.number().nullable(),
    playCount: z.number(),
})

const PlayingSchema = z.object({
    isPlaying: z.literal(true),
    songUrl: z.string(),
    name: z.string(),
    artist: z.string(),
    coverUrl: z.string().nullable(),
    audioUrl: z.string().nullable(),
    duration: z.number().nullable(),
    topSongs: z.array(SongSchema),
})

export const NotPlayingSchema = z.object({
    isPlaying: z.literal(false),
    songUrl: z.string().nullable(),
    name: z.string().nullable(),
    artist: z.string().nullable(),
})

export const NetEaseStatsOutputSchema = z.discriminatedUnion('isPlaying', [PlayingSchema, NotPlayingSchema])
