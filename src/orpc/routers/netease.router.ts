import type * as z from 'zod'
import type { NotPlayingSchema } from '../schemas/netease.schema'

import { env } from '~/lib/env'
import { TraceableError } from '~/lib/errors'

import { publicProcedure } from '../root'
import { NetEasePlayRecordSchema, NetEaseStatsOutputSchema } from '../schemas/netease.schema'

const EMPTY_RESPONSE: z.infer<typeof NotPlayingSchema> = {
  isPlaying: false,
  songUrl: null,
  name: null,
  artist: null,
}

// 将 HTTP 链接升级为 HTTPS，避免 Mixed Content 警告
function ensureHttps(url: string | null): string | null {
  if (!url)
    return null
  return url.replace(/^http:\/\//, 'https://')
}

const NETEASE_COOKIE = env.NETEASE_COOKIE

const HEADERS = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Cookie': NETEASE_COOKIE ?? '',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://music.163.com/',
  'Origin': 'https://music.163.com',
}

const getStats = publicProcedure.output(NetEaseStatsOutputSchema).handler(async () => {
  if (!NETEASE_COOKIE) {
    return EMPTY_RESPONSE
  }

  // 获取用户信息（提取 UID）
  const accountRes = await fetch('https://music.163.com/api/nuser/account/get', {
    method: 'GET',
    headers: HEADERS,
  })

  if (!accountRes.ok) {
    throw new TraceableError('NetEase account API error', {
      status: accountRes.status,
      statusText: accountRes.statusText,
      body: await accountRes.text(),
    })
  }

  const accountData = await accountRes.json()
  const uid = accountData?.profile?.userId

  if (!uid) {
    return EMPTY_RESPONSE
  }

  // 使用新版 API /api/v1/play/record 获取播放排行
  // type=0: 全部时间排行（allData）
  const recordRes = await fetch('https://music.163.com/api/v1/play/record', {
    method: 'POST',
    headers: HEADERS,
    body: new URLSearchParams({
      type: '0',
      limit: '1',
      uid: String(uid),
    }),
  })

  if (!recordRes.ok) {
    throw new TraceableError('NetEase record API error', {
      status: recordRes.status,
      statusText: recordRes.statusText,
      body: await recordRes.text(),
    })
  }

  const recordData = NetEasePlayRecordSchema.parse(await recordRes.json())

  if (recordData.code !== 200) {
    return EMPTY_RESPONSE
  }

  // allData 按播放次数排序，取第一首作为"最近常听"
  const allData = recordData.allData
  if (!allData || !allData.length) {
    return EMPTY_RESPONSE
  }

  const topSongs = allData.slice(0, 10).map((item) => {
    const song = item.song
    const artists = song.ar.map(a => a.name).join(', ')
    return {
      id: song.id,
      name: song.name,
      artist: artists,
      songUrl: `https://music.163.com/#/song?id=${song.id}`,
      audioUrl: null as string | null,
      coverUrl: song.al?.picUrl ?? null,
      duration: song.dt ?? null,
      playCount: item.playCount,
    }
  })

  // 批量获取可播放的音频 URL
  const songIds = topSongs.map(s => s.id)
  if (songIds.length > 0) {
    try {
      const idsParam = JSON.stringify(songIds)
      const playerRes = await fetch('https://music.163.com/api/song/enhance/player/url', {
        method: 'POST',
        headers: HEADERS,
        body: new URLSearchParams({
          ids: idsParam,
          br: '320000',
        }),
      })

      if (playerRes.ok) {
        const playerData = await playerRes.json()
        const urlMap = new Map<number, { url: string | null, size: number }>()
        for (const d of playerData.data ?? []) {
          urlMap.set(d.id, { url: d.url, size: d.size })
        }
        for (const song of topSongs) {
          const info = urlMap.get(song.id)
          if (info?.url) {
            song.audioUrl = info.url
          }
        }
      }
    }
    catch {
      // 静默失败，audioUrl 保持 null，回退到跳转链接
    }
  }

  const firstSong = topSongs[0]
  if (!firstSong) {
    return EMPTY_RESPONSE
  }

  return {
    isPlaying: true,
    songUrl: firstSong.songUrl,
    name: firstSong.name,
    artist: firstSong.artist,
    coverUrl: ensureHttps(firstSong.coverUrl),
    audioUrl: ensureHttps(firstSong.audioUrl),
    duration: firstSong.duration,
    topSongs: topSongs.map(s => ({
      ...s,
      coverUrl: ensureHttps(s.coverUrl),
      audioUrl: ensureHttps(s.audioUrl),
    })),
  }
})

export const neteaseRouter = {
  getStats,
}
