import JSZip from 'jszip'
import { Item } from '@/hooks/useItems'

export async function downloadItemsAsZip(
  items: Item[],
  onProgress?: (current: number, total: number) => void
) {
  const zip = new JSZip()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  // Only include items that have photos
  const itemsWithPhotos = items.filter(i => i.photos.length > 0)
  let fetched = 0
  const total = itemsWithPhotos.reduce((sum, i) => sum + i.photos.length, 0)

  for (const item of itemsWithPhotos) {
    // Folder name: SKU — falls back to item name if no SKU
    const folderName = (item.sku.trim() || item.id)
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/-+/g, '-')
      .trim()
    const folder = zip.folder(folderName)!

    for (let i = 0; i < item.photos.length; i++) {
      const res = await fetch(item.photos[i].url)
      const blob = await res.blob()
      folder.file(`${folderName}_${i + 1}.jpg`, blob)
      fetched++
      onProgress?.(fetched, total)
    }
  }

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = `stagr-${today}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
