# 🏪 POS PowerPlay

**Aplikasi Mobile POS (Point of Sale) & Manajemen Inventori** yang berjalan sepenuhnya offline, dibangun dengan React Native (Expo) + TypeScript + SQLite.

---

## ✨ Fitur Utama

### 📊 Dashboard Analytics
- Filter tanggal: Hari Ini, Minggu Ini, Bulan Ini
- KPI Cards: Laba Kotor, Laba Bersih, Total Produk, Nilai Aset, Total Transaksi
- Daftar transaksi terbaru
- Kalkulasi Net Profit: `(Pendapatan - HPP) + Pemasukan Non-Penjualan - Pengeluaran`

### 🛒 Kasir (POS)
- Grid produk dengan search
- Keranjang belanja dengan kontrol qty
- Checkout otomatis kurangi stok
- Nota/receipt digital

### 📦 Inventori & Produk
- CRUD produk lengkap dengan kategori
- Auto-kalkulasi `fix_price = sell_price - discount`
- Generator SKU otomatis
- **Tampilkan barcode** (Code-128B SVG) per produk
- **Download barcode** sebagai gambar PNG
- **Ekspor ke Excel** (.xlsx) dengan sheet: Produk, Barcode SKU, Ringkasan

### 💰 Arus Kas
- Pencatatan pemasukan & pengeluaran operasional
- Summary total net flow
- Filter by jenis (Semua / Pemasukan / Pengeluaran)

### 🗑️ Tempat Sampah
- 3 tab: Produk Dihapus | Transaksi Dibatalkan | Arus Kas Dihapus
- Pulihkan item (restore) atau hapus permanen
- Void transaksi otomatis membalikkan stok

### ⚙️ Pengaturan & Migrasi Data
- Ekspor JSON (backup lengkap dengan semua timestamp)
- Ekspor file .db (raw SQLite untuk migrasi perangkat)
- Ekspor Excel produk
- Impor dari JSON

---

## 🛠️ Tech Stack

| Layer | Library | Versi |
|---|---|---|
| Framework | React Native + Expo | SDK 54 |
| Router | Expo Router | v4 |
| Database | expo-sqlite | v14 |
| Barcode Scanner | expo-camera | v16 |
| Barcode Generator | react-native-svg | v15 |
| Excel Export | xlsx (SheetJS) | v0.18 |
| Image Capture | react-native-view-shot | v4 |
| Icons | @expo/vector-icons | v14 |
| Toast | react-native-toast-message | v2 |

---

## 📋 Prasyarat

- Node.js ≥ 18
- npm ≥ 9
- Android Studio (untuk emulator) ATAU perangkat Android fisik + kabel USB
- Expo CLI: `npm install -g expo-cli`

---

## 🚀 Instalasi & Menjalankan

```bash
# 1. Clone / masuk ke direktori project
cd pos_powerplay

# 2. Install dependencies
npm install

# 3. Jalankan di perangkat Android (USB)
npm run android

# Atau jalankan di emulator
npx expo run:android
```

> ⚠️ **Catatan**: Aplikasi ini menggunakan **Development Build** (bukan Expo Go) karena menggunakan native modules seperti expo-camera dan expo-sqlite. Sambungkan perangkat Android via USB dengan Developer Mode aktif.

---

## 🗄️ Database Schema (Ringkasan)

| Tabel | Keterangan |
|---|---|
| `categories` | Kategori produk |
| `products` | Produk dengan SKU, harga, stok |
| `transactions` | Header transaksi penjualan |
| `transaction_items` | Detail item per transaksi |
| `cashflow` | Pemasukan & pengeluaran non-penjualan |

**Semua tabel memiliki:** `created_at`, `updated_at`, `deleted_at` (soft delete)

Lihat diagram lengkap di [`docs/database-schema.md`](./docs/database-schema.md)

---

## 🧹 Soft Delete & Timestamp Tracking

- Semua data yang dihapus menggunakan **soft delete** (`deleted_at = CURRENT_TIMESTAMP`)
- Setiap modifikasi data otomatis update `updated_at = CURRENT_TIMESTAMP`
- Query aktif selalu menggunakan `WHERE deleted_at IS NULL`
- Void transaksi → stok produk dikembalikan otomatis

---

## 📂 Struktur Folder

Lihat [`AGENT.md`](./AGENT.md) untuk dokumentasi teknis lengkap.

---

## 👨‍💻 Pengembangan

```bash
# TypeScript check
npx tsc --noEmit

# Build production APK
npx expo build:android
```

---

## 📄 Lisensi

MIT License — Dibuat untuk UMKM Indonesia 🇮🇩
