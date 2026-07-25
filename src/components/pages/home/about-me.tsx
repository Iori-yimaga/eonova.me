'use client'

import { motion, useInView } from 'motion/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'

import { useRef } from 'react'
import { buttonVariants } from '~/components/base/button'
import { cn } from '~/utils'
import Connect from './connect'
import FavoriteFramework from './favorite-framework'
import StacksCard from './stacks-card'

const LocationCard = dynamic(() => import('./location-card'), { ssr: false, loading: () => <div className="shadow-feature-card h-60 rounded-xl animate-pulse bg-muted" /> })
const CodingHours = dynamic(() => import('./coding-hours'), { ssr: false, loading: () => <div className="shadow-feature-card h-24 rounded-xl animate-pulse bg-muted" /> })

const variants = {
  initial: {
    y: 40,
    opacity: 0,
  },
  animate: {
    y: 0,
    opacity: 1,
  },
}

function AboutMe() {
  const cardsRef = useRef<HTMLDivElement>(null)
  const isInView = useInView(cardsRef, { once: true, margin: '-100px' })

  return (
    <motion.div
      initial="initial"
      animate={isInView ? 'animate' : 'initial'}
      variants={variants}
      ref={cardsRef}
      transition={{
        duration: 0.5,
      }}
      className="relative my-24"
    >
      <motion.h2
        className="font-title text-center text-3xl font-bold sm:text-4xl"
        initial={{
          y: 30,
          opacity: 0,
        }}
        animate={{
          y: 0,
          opacity: 1,
        }}
        transition={{
          duration: 0.3,
        }}
      >
        关于我
      </motion.h2>
      <motion.div
        className="mt-12 grid gap-4 md:grid-cols-2"
        initial={{
          y: 40,
          opacity: 0,
        }}
        animate={{
          y: 0,
          opacity: 1,
        }}
        transition={{
          duration: 0.3,
        }}
      >
        <div className="grid gap-4">
          <LocationCard />
          <StacksCard />
        </div>
        <div className="grid gap-4">
          <Connect />
          <div className="grid gap-4 [@media(min-width:450px)]:grid-cols-2">
            <CodingHours />
            <FavoriteFramework />
          </div>
        </div>
      </motion.div>
      <div className="my-8 flex items-center justify-center">
        <Link href="/about" className={cn(buttonVariants({ variant: 'outline' }), 'rounded-xl')}>
          进一步了解我
        </Link>
      </div>
    </motion.div>
  )
}

export default AboutMe
