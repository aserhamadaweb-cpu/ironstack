'use client'

import { useEffect, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'

type CountUpProps = {
  value: number
  duration?: number
  formatter?: (value: number) => string
}

/** Animates a number counting up from 0 to `value` on mount. */
export function CountUp({ value, duration = 0.8, formatter }: CountUpProps) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      setDisplay(value)
      return
    }

    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(latest),
    })

    return () => controls.stop()
  }, [value, duration, reduce])

  const rounded = Math.round(display)
  return <>{formatter ? formatter(rounded) : rounded.toLocaleString()}</>
}
