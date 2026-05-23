'use client'

import { useState, useEffect, useRef } from 'react'

export interface Photo {
  url: string
  publicId: string
}

export interface Item {
  id: string
  sku: string
  name: string
  category: string
  status: 'prepped' | 'drafted' | 'listed'
  dateAdded: string
  dateListed: string | null
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

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)
  const pendingPush = useRef<ReturnType<typeof setTimeout> | null>(null)

  // On mount: show localStorage immediately, then fetch server data
  useEffect(() => {
    const local = readLocalStorage()
    if (local.length > 0) setItems(local)

    fetchItemsFromServer().then(serverItems => {
      if (serverItems !== null) {
        setItems(serverItems)
        writeLocalStorage(serverItems)
      }
      setLoaded(true)
    })
  }, [])

  // Whenever items change after load: write to localStorage and debounce push to server
  useEffect(() => {
    if (!loaded) return
    writeLocalStorage(items)

    if (pendingPush.current) clearTimeout(pendingPush.current)
    pendingPush.current = setTimeout(() => {
      pushItemsToServer(items)
    }, 800)
  }, [items, loaded])

  function addItem(data: { sku: string; name: string; category: string; photos?: Photo[] }) {
    const newItem: Item = {
      id: crypto.randomUUID(),
      sku: data.sku,
      name: data.name,
      category: data.category,
      status: 'prepped',
      dateAdded: new Date().toISOString(),
      dateListed: null,
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
      return prev.filter(i => i.id !== id)
    })
  }

  function moveToDrafted(id: string) {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, status: 'drafted' as const } : i)))
  }

  async function moveToListed(id: string) {
    const item = items.find(i => i.id === id)
    if (item && item.photos.length > 0) {
      await Promise.all(item.photos.map(p => deletePhotoFromCloudinary(p.publicId)))
    }
    setItems(prev =>
      prev.map(i =>
        i.id === id
          ? { ...i, status: 'listed' as const, dateListed: new Date().toISOString(), photos: [] }
          : i
      )
    )
  }

  return { items, loaded, addItem, updateItem, deleteItem, moveToDrafted, moveToListed }
}
