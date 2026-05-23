'use client'

import { useState, useEffect } from 'react'

export interface Settings {
  defaultCategory: string
}

const DEFAULTS: Settings = {
  defaultCategory: 'Clothing',
}

const SETTINGS_KEY = 'stagr-settings'

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY)
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) })
    } catch { /* noop */ }
    setLoaded(true)
  }, [])

  function updateSettings(updates: Partial<Settings>) {
    setSettings(prev => {
      const next = { ...prev, ...updates }
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)) } catch { /* noop */ }
      return next
    })
  }

  return { settings, updateSettings, loaded }
}
