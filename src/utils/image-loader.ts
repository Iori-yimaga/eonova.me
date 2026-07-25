/**
 * Custom image loader for next/image.
 *
 * Uses relative URLs so the browser resolves them against the current page origin,
 * preventing Mixed Content errors (e.g. http:// vs https://) caused by the default
 * SSR loader inheriting an incorrect Host header from reverse proxies.
 */
export default function imageLoader({ src, width, quality }: {
  src: string
  width: number
  quality?: number
}) {
  const q = quality || 75
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${q}`
}
