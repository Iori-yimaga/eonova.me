import { PostHog } from 'posthog-node'

import { env } from '~/lib/env'

let posthogInstance: PostHog | null = null

export function getPostHogServer() {
  // Skip PostHog in development if using placeholder key
  if (!env.NEXT_PUBLIC_POSTHOG_KEY || env.NEXT_PUBLIC_POSTHOG_KEY === 'phc_placeholder') {
    return null
  }

  posthogInstance ??= new PostHog(env.NEXT_PUBLIC_POSTHOG_KEY, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST,
    flushAt: 1,
    flushInterval: 0,
  })

  return posthogInstance
}
