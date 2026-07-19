import type { Metadata } from 'next'
import type { AboutPage, WithContext } from 'schema-dts'
import Bento from '~/components/pages/about/bento'
import { Donate } from '~/components/shared/donate'
import PageTitle from '~/components/shared/page-title'
import {
  SITE_DESCRIPTION,
  SITE_GITHUB_URL,
  SITE_INSTAGRAM_URL,
  SITE_NAME,
  SITE_URL,
  SITE_X_URL,
  SITE_YOUTUBE_URL,
} from '~/config/constants'
import { createMetadata } from '~/lib/metadata'
import { getBaseUrl } from '~/utils/get-base-url'

const title = '关于'
const description = '👋 嗨！我是慕乐'
const url = `${SITE_URL}/about`

export async function generateMetadata(): Promise<Metadata> {
  return createMetadata({
    pathname: '/about',
    title,
    description,
    openGraph: {
      type: 'profile',
    },
  })
}

async function Page() {
  const jsonLd: WithContext<AboutPage> = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    'name': title,
    description,
    url,
    'mainEntity': {
      '@type': 'Person',
      'name': SITE_NAME,
      'description': SITE_DESCRIPTION,
      'url': getBaseUrl(),
      'sameAs': [SITE_INSTAGRAM_URL, SITE_X_URL, SITE_GITHUB_URL, SITE_YOUTUBE_URL],
    },
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <PageTitle title={title} description={description} />
      <Bento />
      <div className="mt-16 flex justify-center">
        <Donate />
      </div>
    </>
  )
}

export default Page
