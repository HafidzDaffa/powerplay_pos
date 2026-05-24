# AGENT.md — POS PowerPlay Codebase Guide for AI Agents

> Baca file ini terlebih dahulu sebelum memodifikasi kode apapun.
> This file is the primary reference for AI agents to understand the codebase quickly.

---

## 🏗️ Project Overview

**POS PowerPlay** adalah aplikasi Mobile POS (Point of Sale) dan Manajemen Inventori berbasis React Native + Expo yang berjalan **sepenuhnya offline** menggunakan SQLite. Bahasa UI: **Indonesia**. Mata uang: **Rupiah (Rp)**.

| Atribut | Detail |
|---|---|
| Platform | Android (Development Build, kabel USB) |
| Framework | React Native + Expo SDK 54 |
| Router | Expo Router (file-based) |
| Database | expo-sqlite v2 (async API) |
| Bahasa | TypeScript |
| Styling | React Native StyleSheet (dark theme manual) |

---

## 📁 Struktur Direktori

```
pos_powerplay/
├── app/                          # Expo Router screens
│   ├── _layout.tsx               # Root: init DB, StatusBar, Stack navigator
│   ├── (tabs)/
│   │   ├── _layout.tsx           # Tab bar (5 tabs)
│   │   ├── index.tsx             # 📊 Dashboard — KPI, date filter, recent txns
│   │   ├── pos.tsx               # 🛒 Kasir — product grid, cart, checkout
│   │   ├── inventory.tsx         # 📦 Inventori — product list, barcode, export Excel
│   │   ├── cashflow.tsx          # 💰 Arus Kas — income/expense ledger
│   │   └── settings.tsx          # ⚙️ Pengaturan — export/import/trash
│   └── modals/
│       ├── product-form.tsx      # Add/Edit product (with auto fix_price calc)
│       ├── barcode-view.tsx      # View & download barcode PNG (ViewShot)
│       ├── checkout.tsx          # Receipt after successful transaction
│       ├── cashflow-form.tsx     # Add/Edit cashflow entry
│       └── trash.tsx             # 3-tab trash: Products | Transactions | Cashflows
├── src/
│   ├── db/                       # SQLite query layer
│   │   ├── database.ts           # initDatabase(), resetDatabase(), getDatabase()
│   │   ├── products.ts           # Product CRUD + stock management
│   │   ├── categories.ts         # Category CRUD
│   │   ├── transactions.ts       # Transaction + void (stock reversal)
│   │   ├── cashflow.ts           # Cashflow CRUD
│   │   └── dashboard.ts          # KPI queries, daily revenue, top products
│   ├── services/
│   │   ├── exportService.ts      # JSON export, .db export, Excel export, barcode PNG
│   │   ├── importService.ts      # JSON import with full timestamp preservation
│   │   └── barcodeService.ts     # ViewShot capture → PNG share
│   ├── components/
│   │   ├── KPICard.tsx           # Metric card with icon + trend
│   │   ├── ProductCard.tsx       # Product card with barcode action buttons
│   │   ├── CartItem.tsx          # Cart row with qty controls
│   │   ├── BarcodeGenerator.tsx  # SVG Code128-B barcode renderer (forwardRef)
│   │   ├── EmptyState.tsx        # Empty state placeholder
│   │   └── ConfirmModal.tsx      # Reusable confirmation dialog
│   ├── types/
│   │   └── index.ts              # All TypeScript interfaces
│   ├── constants/
│   │   └── theme.ts              # Colors, Fonts, Spacing, Radius, Shadow
│   └── utils/
│       └── currency.ts           # formatIDR(), formatIDRCompact(), generateSKU(), etc.
├── assets/                       # App icons and splash
├── app.json                      # Expo config (permissions, plugins, package name)
├── AGENT.md                      # ← You are here
├── README.md                     # Setup & run guide
└── docs/
    └── database-schema.md        # ERD diagram and table documentation
```

---

## 🗄️ Database Rules (WAJIB DIIKUTI)

### Soft Delete Pattern
Setiap tabel memiliki `deleted_at DATETIME DEFAULT NULL`.

- **Active query**: selalu tambahkan `WHERE deleted_at IS NULL`
- **Soft delete**: `SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP`
- **Restore**: `SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP`
- **Hard delete**: hanya dari Trash screen (`DELETE FROM table WHERE id = ?`)

### updated_at Pattern
Setiap `UPDATE` query HARUS menyertakan `updated_at = CURRENT_TIMESTAMP` secara eksplisit.

### Void Transaction (KRITIS)
Saat transaksi di-void (`voidTransaction(id)`):
1. Transaction header: `deleted_at = CURRENT_TIMESTAMP`, `updated_at = CURRENT_TIMESTAMP`
2. **Setiap product terkait**: `stock = stock + quantity`, `updated_at = CURRENT_TIMESTAMP`

### fix_price Calculation
`fix_price = sell_price - discount` (dihitung di application layer, bukan trigger SQL)

---

## 💡 Key Business Logic

| Feature | File | Function |
|---|---|---|
| Buat transaksi + kurangi stok | `src/db/transactions.ts` | `createTransaction(cartItems)` |
| Void transaksi + kembalikan stok | `src/db/transactions.ts` | `voidTransaction(id)` |
| Soft delete produk | `src/db/products.ts` | `softDeleteProduct(id)` |
| Restore produk | `src/db/products.ts` | `restoreProduct(id)` |
| KPI dashboard | `src/db/dashboard.ts` | `getDashboardMetrics(start, end)` |
| Export ke Excel | `src/services/exportService.ts` | `exportProductsToExcel()` |
| Export JSON backup | `src/services/exportService.ts` | `exportDatabaseAsJSON()` |
| Import dari JSON | `src/services/importService.ts` | `importDatabaseFromJSON()` |
| Download barcode PNG | `app/modals/barcode-view.tsx` | `handleDownload()` via ViewShot |

---

## 🎨 Design System

Semua warna, ukuran, dan shadow ada di `src/constants/theme.ts`.

```typescript
// Contoh penggunaan
import { Colors, Fonts, Spacing, Radius, Shadow } from '../constants/theme';

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,    // #1E1E35
    borderRadius: Radius.lg,         // 16
    padding: Spacing.base,           // 16
    ...Shadow.md,                    // elevation 6 + shadow
  },
});
```

**Color palette utama:**
- Background: `#0F0F1A`
- Surface: `#1A1A2E`
- Primary (brand): `#6C63FF` (violet)
- Success/hijau: `#00D9A3`
- Error/merah: `#FF6B6B`
- Warning/oranye: `#FF9F43`

---

## 💰 Currency Formatting

```typescript
import { formatIDR, formatIDRCompact, generateSKU } from '../utils/currency';

formatIDR(150000)         // → "Rp 150.000"
formatIDRCompact(1500000) // → "Rp 1,5 Jt"
generateSKU('Kopi')       // → "KOPI-AB3C2D"
```

---

## 🔄 Navigation

- Tab navigation: `app/(tabs)/_layout.tsx`
- Modals dibuka dengan: `router.push('/modals/barcode-view')` atau dengan params
- Modals ditutup dengan: `router.back()`
- Kirim params via: `router.push({ pathname: '/modals/product-form', params: { productId: 5 } })`
- Terima params di modal: `const { productId } = useLocalSearchParams<{ productId: string }>()`

---

## ⚡ Performance Notes

- Database menggunakan `PRAGMA journal_mode = WAL` untuk concurrent reads
- Semua query menggunakan prepared statements (parameterized)
- Partial indexes pada `deleted_at IS NULL` untuk filter aktif yang cepat
- `useCallback` digunakan pada semua data loader functions

---

## 🚫 Anti-Patterns (JANGAN DILAKUKAN)

1. ❌ Query tanpa `WHERE deleted_at IS NULL` pada tabel yang memiliki soft-delete
2. ❌ `UPDATE` tanpa menyertakan `updated_at = CURRENT_TIMESTAMP`
3. ❌ Hard delete langsung (kecuali dari Trash screen)
4. ❌ Void transaksi tanpa reversing stock
5. ❌ Fix price di-hardcode tanpa `sell_price - discount`
6. ❌ Langsung modifikasi SQLite file tanpa melalui `src/db/` layer
