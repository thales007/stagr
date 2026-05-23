'use client'

import { useState, useEffect } from 'react'

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
    console.error('Failed to delete photo from Cloudinary:', err)
  }
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setItems(JSON.parse(stored))
      }
    } catch {
      // localStorage unavailable
    }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // localStorage unavailable
    }
  }, [items, loaded])

  function addItem(data: { sku: string; name: string; category: string; status: 'prepped' | 'drafted'; photos?: Photo[] }) {
    const newItem: Item = {
      id: crypto.randomUUID(),
      sku: data.sku,
      name: data.name,
      category: data.category,
      status: data.status,
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
      if (item) {
        Promise.all(item.photos.map(p => deletePhotoFromCloudinary(p.publicId)))
      }
      return prev.filter(i => i.id !== id)
    })
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

  return { items, addItem, updateItem, deleteItem, moveToListed }
}
