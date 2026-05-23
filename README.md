# Stagr

Mobile-first reseller inventory app — a staging area between purchase and eBay listing.

## Files

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout: dark theme, Inter font, 480px max-width, mounts BottomNav |
| `app/page.tsx` | Queue screen: Prepped and Drafted item sections |
| `app/add/page.tsx` | Add Item screen: form with SKU, name, category, status, photo placeholder |
| `app/listed/page.tsx` | Listed screen: history of items marked as listed, sorted newest first |
| `components/BottomNav.tsx` | Fixed bottom nav bar with Queue, Add (+), and Listed tabs |
| `components/ItemCard.tsx` | Tappable card showing item details and thumbnail in the queue |
| `hooks/useItems.ts` | Custom hook: loads/saves items to localStorage, exposes CRUD + moveToListed |
