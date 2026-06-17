"use client"

import { useEffect, useState } from "react"
import { nextOperationalDayStart, operationalDay } from "./utils"

export function useOperationalDay(): Date | null {
  const [day, setDay] = useState<Date | null>(null)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined

    const sync = () => {
      const now = new Date()
      setDay(operationalDay(now))
      const delay = nextOperationalDayStart(now).getTime() - now.getTime() + 1000
      timeout = setTimeout(sync, Math.max(1000, delay))
    }

    sync()
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  return day
}
