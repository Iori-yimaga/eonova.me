import type { MusicPlaylist } from '~/config/music'
import { ORPCError } from '@orpc/client'
import { unstable_cache } from 'next/cache'
import { MUSIC_API, musicConfig } from '~/config/music'
import { publicProcedure } from '../root'

// 扁平化数组
function flattenArray(arr: any[]) {
  return arr.reduce((acc, val) => {
    if (Array.isArray(val))
      acc.push(...flattenArray(val))
    else
      acc.push(val)
    return acc
  }, [])
}

async function queryPlaylistSongs(config: MusicPlaylist[]) {
  const handleConfig = await Promise.all(
    config.map(async (playlist) => {
      const playlistSongs = await Promise.all(
        playlist.list.map(async (url) => {
          const id = url.split('=')[1] ?? url.split('/')[5]
          const requestUrl = `${MUSIC_API}?server=netease&type=playlist&id=${id}`
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 15_000) // 15s 超时
          try {
            const res = await fetch(requestUrl, { signal: controller.signal })
            if (!res.ok)
              throw new Error(`Failed to fetch playlist: ${res.statusText}`)
            const data = await res.json()
            return data
          }
          finally {
            clearTimeout(timeout)
          }
        }),
      )

      // 为每首歌预取歌词文本（替代客户端直接请求第三方 API）
      const songsWithLyrics = await Promise.all(
        flattenArray(playlistSongs).map(async (song: any) => {
          if (!song.lrc)
            return song
          try {
            const lrcController = new AbortController()
            const lrcTimeout = setTimeout(() => lrcController.abort(), 10_000)
            const lrcRes = await fetch(song.lrc, { signal: lrcController.signal })
            clearTimeout(lrcTimeout)
            if (lrcRes.ok) {
              const lrcText = await lrcRes.text()
              return { ...song, lrc: lrcText }
            }
          }
          catch {
            // 歌词获取失败，保留原始 URL 作为降级
          }
          return song
        }),
      )

      return {
        title: playlist.title,
        list: songsWithLyrics,
      }
    }),
  )

  return handleConfig
}

const getCachedPlaylistSongs = unstable_cache(
  async () => queryPlaylistSongs(musicConfig),
  ['music-playlist-v2'],
  {
    revalidate: 3600, // 1 hour
    tags: ['music-playlist'],
  },
)

export const listAllPlaylistSongs = publicProcedure.handler(async () => {
  try {
    const songs = await getCachedPlaylistSongs()
    return songs
  }
  catch (error) {
    throw new ORPCError('INTERNAL_SERVER_ERROR', { message: `获取播放列表标题失败: ${error}` })
  }
})
