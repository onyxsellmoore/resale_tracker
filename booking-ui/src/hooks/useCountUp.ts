import { useState, useEffect, useRef } from 'react'

export function useCountUp(target: number, duration = 600): number {
  const [value, setValue] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (target === 0 || duration === 0) {
      setValue(target)
      return
    }

    setValue(0)
    const stepTime = 16 // ~60fps
    const steps = Math.ceil(duration / stepTime)
    let step = 0

    intervalRef.current = setInterval(() => {
      step++
      const progress = Math.min(step / steps, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased * 100) / 100)

      if (progress >= 1) {
        setValue(target)
        if (intervalRef.current) clearInterval(intervalRef.current)
      }
    }, stepTime)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [target, duration])

  return value
}
