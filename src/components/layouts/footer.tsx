import Link from 'next/link'
import { memo } from 'react'

import { FOOTER_LINKS } from '~/config/links'
import NowPlaying from './internal/now-playing'

const Footer: React.FC = () => {
  return (
    <footer className="bg-background/30 relative mx-4 mb-6 flex max-w-[900px] flex-col rounded-2xl p-8 shadow-sm saturate-100 backdrop-blur-[10px] sm:w-full md:mx-auto">
      <NowPlaying />
      <div className="mt-12 grid grid-cols-2 sm:grid-cols-3">
        {FOOTER_LINKS.map(list => (
          <div key={list.id} className="mb-10 flex flex-col items-start gap-4 pr-4">
            {list.links.map((link) => {
              const { href, key } = link

              return (
                <Link key={href} href={href}>
                  {key}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-20 flex flex-col items-center justify-between text-sm md:flex-row">
        <div>
          &copy;
          {' '}
          {`2021-${new Date().getFullYear()}`}
          <span className="ml-1">
            慕乐
          </span>
        </div>
      </div>
    </footer>
  )
}

export default memo(Footer)
