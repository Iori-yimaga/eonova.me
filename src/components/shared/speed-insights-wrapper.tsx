'use client'

import dynamic from 'next/dynamic'

const SpeedInsights = process.env.VERCEL
  ? dynamic(() => import('@vercel/speed-insights/next').then(m => m.SpeedInsights), { ssr: false })
  : null

export default function SpeedInsightsWrapper() {
  if (!SpeedInsights)
    return null
  return <SpeedInsights />
}
