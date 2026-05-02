'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useMotionValue, useSpring, type Variant } from 'framer-motion'

// ─── FadeIn ───────────────────────────────────────────────────────────────────
// Scroll-reveal wrapper: fade + translateY when element enters viewport.
// Use delay to stagger siblings (delay={0.1 * index}).

interface FadeInProps {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  y?: number
  once?: boolean
}

export function FadeIn({
  children,
  className,
  delay = 0,
  duration = 0.6,
  y = 20,
  once = true,
}: FadeInProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once, margin: '-60px 0px' })

  const variants: Record<string, Variant> = {
    hidden: { opacity: 0, y },
    visible: { opacity: 1, y: 0 },
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={variants}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      transition={{ duration, delay, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  )
}

// ─── AnimatedCounter ──────────────────────────────────────────────────────────
// Counts from 0 to `to` when it enters the viewport. Prefix/suffix for units.

interface AnimatedCounterProps {
  to: number
  prefix?: string
  suffix?: string
  duration?: number
  className?: string
}

export function AnimatedCounter({
  to,
  prefix = '',
  suffix = '',
  duration = 1.5,
  className,
}: AnimatedCounterProps) {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, margin: '-40px 0px' })
  const motionValue = useMotionValue(0)
  const springValue = useSpring(motionValue, { duration: duration * 1000, bounce: 0 })
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (isInView) motionValue.set(to)
  }, [isInView, motionValue, to])

  useEffect(() => {
    const unsub = springValue.on('change', (v) => setDisplay(Math.round(v)))
    return unsub
  }, [springValue])

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  )
}

// ─── HoverCard ────────────────────────────────────────────────────────────────
// Lifts the card 4px + grows shadow on hover. Wraps any card element.

interface HoverCardProps {
  children: React.ReactNode
  className?: string
}

export function HoverCard({ children, className }: HoverCardProps) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -4, transition: { duration: 0.2, ease: 'easeOut' } }}
    >
      {children}
    </motion.div>
  )
}
