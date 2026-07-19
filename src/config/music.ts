/** 定义合法的播放列表URL前缀 */
type PlaylistUrlPrefix
  = | 'https://y.qq.com/n/ryqq/playlist/'
    | 'https://music.163.com/#/playlist?id='

export interface MusicPlaylist {
  title: string
  list: `${PlaylistUrlPrefix}${string}`[]
}

export const musicConfig: MusicPlaylist[] = [
  {
    title: '我的收藏',
    list: [
      'https://music.163.com/#/playlist?id=163334200',
    ],
  },
  {
    title: '夏日治愈｜海',
    list: [
      'https://music.163.com/#/playlist?id=7348387343',
    ],
  },
  {
    title: ' K！ON',
    list: [
      'https://music.163.com/#/playlist?id=744582007',
    ],
  },
]

export const MUSIC_API = 'https://api.injahow.cn/meting/'
// export const MUSIC_API = 'https://api.i-meto.com/meting/'
