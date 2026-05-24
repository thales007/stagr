'use client'

import { useState, useEffect, useRef } from 'react'

export interface Photo {
  url: string
  publicId: string
}

export interface Item {
  id: string
  sku: string
  dateAdded: string
  photos: Photo[]
}

const STORAGE_KEY = 'stagr-items'

async function deletePhotoFromCloudinary(publicId: string) {
  try {
    await fetch('/api/delete-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId }),
    })
  } catch (err) {
    console.error('Failed to delete photo:', err)
  }
}

async function fetchItemsFromServer(): Promise<Item[] | null> {
  try {
    const res = await fetch('/api/items')
    const data = await res.json()
    return data.synced ? (data.items as Item[]) : null
  } catch {
    return null
  }
}

async function pushItemsToServer(items: Item[]) {
  try {
    await fetch('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    })
  } catch {
    // best-effort
  }
}

function readLocalStorage(): Item[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Item[]) : []
  } catch { return [] }
}

function writeLocalStorage(items: Item[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) } catch { /* noop */ }
}

// Strip legacy "listed" items (status field from old data model) and
// drop the status/dateListed fields so the data stays clean going forward.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalise(raw: any[]): Item[] {
  return raw
    .filter(i => i.status !== 'listed')
    .map(({ status: _s, dateListed: _d, name: _n, category: _c, ...rest }) => rest as Item)
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)
  const pendingPush = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestItems = useRef<Item[]>([])

  useEffect(() => { latestItems.current = items }, [items])

  // On mount: show local immediately, then reconcile with server
  useEffect(() => {
    const local = normalise(readLocalStorage())
    if (local.length > 0) setItems(local)

    fetchItemsFromServer().then(serverItems => {
      if (serverItems === null) {
        setLoaded(true)
        return
      }

      const freshLocal = normalise(readLocalStorage())
      const serverNorm = normalise(serverItems as unknown as Item[])
      const serverIds = new Set(serverNorm.map(i => i.id))
      const localOnly = freshLocal.filter(i => !serverIds.has(i.id))
      const merged = [...serverNorm, ...localOnly]

      setItems(merged)
      writeLocalStorage(merged)

      if (localOnly.length > 0) {
        pushItemsToServer(merged)
      }

      setLoaded(true)
    })
  }, [])

  // On every change after load: write localStorage + push to server
  useEffect(() => {
    if (!loaded) return
    const current = latestItems.current
    writeLocalStorage(current)

    if (pendingPush.current) clearTimeout(pendingPush.current)
    pendingPush.current = setTimeout(() => {
      pushItemsToServer(latestItems.current)
    }, 300)
  }, [items, loaded])

  function addItem(data: { sku: string; photos?: Photo[] }) {
    const newItem: Item = {
      id: crypto.randomUUID(),
      sku: data.sku,
      dateAdded: new Date().toISOString(),
      photos: data.photos ?? [],
    }
    setItems(prev => [...prev, newItem])
    return newItem
  }

  function updateItem(id: string, updates: Partial<Omit<Item, 'id'>>) {
    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)))
  }

  function deleteItem(id: string) {
    setItems(prev => {
      const item = prev.find(i => i.id === id)
      if (item) Promise.all(item.photos.map(p => deletePhotoFromCloudinary(p.publicId)))
      const next = prev.filter(i => i.id !== id)
      // Write immediately so the queue page sees the change before navigation
      writeLocalStorage(next)
      if (pendingPush.current) clearTimeout(pendingPush.current)
      pendingPush.current = setTimeout(() => pushItemsToServer(next), 300)
      return next
    })
  }

  function refresh() {
    fetchItemsFromServer().then(serverItems => {
      if (serverItems === null) return
      const freshLocal = normalise(readLocalStorage())
      const serverNorm = normalise(serverItems as unknown as Item[])
      const serverIds = new Set(serverNorm.map(i => i.id))
      const localOnly = freshLocal.filter(i => !serverIds.has(i.id))
      const merged = [...serverNorm, ...localOnly]
      setItems(merged)
      writeLocalStorage(merged)
    })
  }

  async function clearAll() {
    const all = latestItems.current
    await Promise.all(all.flatMap(item => item.photos.map(p => deletePhotoFromCloudinary(p.publicId))))
    setItems([])
  }

  return { items, loaded, addItem, updateItem, deleteItem, clearAll, refresh }
}
