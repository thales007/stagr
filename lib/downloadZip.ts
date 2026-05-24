import JSZip from 'jszip'
import { Item } from '@/hooks/useItems'

export async function downloadItemsAsZip(
  items: Item[],
  onProgress?: (current: number, total: number) => void
) {
  const zip = new JSZip()
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

  const itemsWithPhotos = items.filter(i => i.photos.length > 0)
  let fetched = 0
  const total = itemsWithPhotos.reduce((sum, i) => sum + i.photos.length, 0)

  const manifestItems = []

  for (const item of itemsWithPhotos) {
    const folderName = (item.sku.trim() || item.id)
      .replace(/[/\\:*?"<>|]/g, '-')
      .replace(/-+/g, '-')
      .trim()
    const folder = zip.folder(folderName)!

    const photoNames: string[] = []
    for (let i = 0; i < item.photos.length; i++) {
      const photoName = `${folderName}_${i + 1}.jpg`
      photoNames.push(photoName)

      const res = await fetch(item.photos[i].url)
      const blob = await res.blob()
      folder.file(photoName, blob)
      fetched++
      onProgress?.(fetched, total)
    }

    manifestItems.push({
      id: item.id,
      sku: item.sku,
      dateAdded: item.dateAdded,
      folder: folderName,
      photos: photoNames,
    })
  }

  // Manifest lets the browser extension read item details without parsing filenames
  zip.file(
    'manifest.json',
    JSON.stringify({ version: 1, exportDate: today, items: manifestItems }, null, 2)
  )

  const content = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(content)
  const a = document.createElement('a')
  a.href = url
  a.download = `stagr-${today}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
