import type { ReactNode } from 'react'
import { CodeIcon, LifeBuoy, Lightbulb, Palette, ShieldCheck } from 'lucide-react'

interface ICATEGORIES {
  name: string
  label: string
  icon?: ReactNode
}

export const CATEGORIES: ICATEGORIES[] = [
  {
    name: '技术',
    label: 'tech',
    icon: <CodeIcon className="size-5" />,
  },
  {
    name: '总结',
    label: 'summary',
    icon: <Lightbulb className="size-5" />,
  },
  {
    name: '生活',
    label: 'life',
    icon: <LifeBuoy className="size-5" />,
  },
  {
    name: '设计',
    label: 'design',
    icon: <Palette className="size-5" />,
  },
  {
    name: '安全',
    label: 'ctf',
    icon: <ShieldCheck className="size-5" />,
  },
]

// export const RANDOMIMGAPI = 'http://www.dmoe.cc/random.php'
