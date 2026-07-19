export const IS_PRODUCTION = process.env.NODE_ENV === 'production'

export const IS_SERVER = typeof window === 'undefined'
export const SITE_URL = IS_PRODUCTION ? 'https://iori-yimaga.site' : 'http://localhost:13000'

export const MY_NAME = '慕乐'
export const GITHUB_USERNAME = 'Iori-yimaga'

export const SITE_NAME = '慕乐の博客'
export const SITE_TITLE = 'Keep learning, Keep growing~'
export const SITE_DESCRIPTION = '慕乐 • Full Stack Developer'
export const SITE_KEYWORDS = [
  'Sakuya',
  'sakuya',
  'Iori-yimaga',
  'Next.js',
  'React',
  'TypeScript',
  'Node.js',
]

export const SITE_GITHUB_URL = 'https://github.com/Iori-yimaga'
export const SITE_INSTAGRAM_URL = 'https://www.instagram.com/Iori-yimaga'
export const SITE_X_URL = 'https://x.com/Iori_yimaga'
export const SITE_YOUTUBE_URL = 'https://www.youtube.com/@Iori-yimaga'

export const OG_IMAGE_WIDTH = 1200
export const OG_IMAGE_HEIGHT = 630
export const OG_IMAGE_TYPE = 'image/png'

export const AVATAR_MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
export const SUPPORTED_AVATAR_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type AvatarMimeType = (typeof SUPPORTED_AVATAR_MIME_TYPES)[number]
