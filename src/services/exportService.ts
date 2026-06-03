// ============================================================
// Dependor — Export Service (JSON, .db, Excel with barcode)
// Uses expo-file-system/legacy for SDK 54 compatibility
// ============================================================
import {
  documentDirectory,
  writeAsStringAsync,
  readAsStringAsync,
  copyAsync,
  getInfoAsync,
  EncodingType,
} from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { getDatabase } from '../db/database';
import { getAllCategoriesForDump } from '../db/categories';
import { getActiveProducts } from '../db/products';
import { getAllTransactionsForDump, getAllTransactionItemsForDump } from '../db/transactions';
import { getAllCashflowsForDump } from '../db/cashflow';
import { DatabaseDump } from '../types';
import { formatIDR } from '../utils/currency';

// ── JSON Export ──────────────────────────────────────────────────────────────
export async function exportDatabaseAsJSON(): Promise<void> {
  const categories = await getAllCategoriesForDump();
  const db = getDatabase();
  const allProducts = await db.getAllAsync<any>('SELECT * FROM products ORDER BY id ASC');
  const transactions = await getAllTransactionsForDump();
  const items = await getAllTransactionItemsForDump();
  const cashflows = await getAllCashflowsForDump();

  const dump: DatabaseDump = {
    exported_at: new Date().toISOString(),
    version: 1,
    categories,
    products: allProducts,
    transactions,
    transaction_items: items,
    cashflow: cashflows,
  };

  const json = JSON.stringify(dump, null, 2);
  const filename = `pos_backup_${Date.now()}.json`;
  const uri = (documentDirectory ?? '') + filename;

  await writeAsStringAsync(uri, json, { encoding: EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Ekspor Database Dependor',
    });
  }
}

// ── Raw .db File Export ───────────────────────────────────────────────────────
export async function exportDatabaseFile(): Promise<void> {
  // SQLite files stored in SQLite/ subdirectory of documentDirectory
  const dbPath = (documentDirectory ?? '') + 'SQLite/dependor.db';
  const destPath = (documentDirectory ?? '') + `dependor_${Date.now()}.db`;

  const info = await getInfoAsync(dbPath);
  if (!info.exists) {
    throw new Error('File database tidak ditemukan. Coba lakukan satu transaksi terlebih dahulu.');
  }

  await copyAsync({ from: dbPath, to: destPath });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(destPath, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Ekspor File .db Dependor',
    });
  }
}

// ── Excel Export for Products ─────────────────────────────────────────────────
export async function exportProductsToExcel(): Promise<void> {
  const products = await getActiveProducts();

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Product Data
  const headers = [
    'No', 'SKU', 'Nama Produk', 'Kategori', 'Harga Beli (Rp)', 'Harga Jual (Rp)',
    'Diskon (Rp)', 'Harga Fix (Rp)', 'Stok', 'Nilai Aset (Rp)',
    'Dibuat', 'Diperbarui',
  ];

  const rows = products.map((p, i) => [
    i + 1,
    p.sku,
    p.name,
    p.category_name ?? '-',
    p.buy_price,
    p.sell_price,
    p.discount,
    p.fix_price,
    p.stock,
    p.buy_price * p.stock,
    p.created_at,
    p.updated_at,
  ]);

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 18 }, { wch: 30 }, { wch: 15 },
    { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
    { wch: 8 }, { wch: 18 }, { wch: 22 }, { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Produk');

  // ── Sheet 2: Barcode / SKU List
  const barcodeHeaders = ['No', 'SKU', 'Nama Produk', 'Kode Barcode (SKU)'];
  const barcodeRows = products.map((p, i) => [i + 1, p.sku, p.name, p.sku]);
  const wsBarcodes = XLSX.utils.aoa_to_sheet([barcodeHeaders, ...barcodeRows]);
  wsBarcodes['!cols'] = [{ wch: 5 }, { wch: 18 }, { wch: 30 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(wb, wsBarcodes, 'Barcode SKU');

  // ── Sheet 3: Summary
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
  const totalAsset = products.reduce((sum, p) => sum + p.buy_price * p.stock, 0);
  const summaryData = [
    ['Ringkasan Inventori Dependor'],
    [],
    ['Tanggal Ekspor', new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })],
    ['Total Produk Aktif', products.length],
    ['Total Stok', totalStock],
    ['Total Nilai Aset', formatIDR(totalAsset)],
    [],
    ['Catatan:', 'Data diekspor dengan Soft Delete — hanya produk aktif yang ditampilkan'],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // Write to base64 and share
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filename = `inventori_pos_${Date.now()}.xlsx`;
  const uri = (documentDirectory ?? '') + filename;

  await writeAsStringAsync(uri, wbout, { encoding: EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Ekspor Produk ke Excel',
    });
  }
}

// ── Share single barcode PNG ──────────────────────────────────────────────────
export async function shareBarcodePNG(base64: string, sku: string): Promise<void> {
  const filename = `barcode_${sku}_${Date.now()}.png`;
  const uri = (documentDirectory ?? '') + filename;

  await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'image/png',
      dialogTitle: `Barcode ${sku}`,
    });
  }
}

// ── Excel Export for Transactions (filtered list) ──────────────────────────────
export async function exportTransactionsToExcel(transactions: any[]): Promise<void> {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Transactions Data
  const headers = [
    'No', 'Nomor Invoice', 'Tanggal & Waktu', 'Total Item', 'Total Penjualan (Rp)',
    'Laba Bersih (Rp)', 'Status',
  ];

  const rows = transactions.map((t, i) => {
    const status = t.deleted_at ? 'DIBATALKAN / VOID' : 'SUKSES';
    return [
      i + 1,
      t.invoice_number,
      t.created_at,
      t.total_items,
      t.gross_amount,
      t.net_profit,
      status,
    ];
  });

  const wsData = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 5 }, { wch: 22 }, { wch: 22 }, { wch: 12 },
    { wch: 20 }, { wch: 20 }, { wch: 18 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Transaksi');

  // ── Sheet 2: Summary / Ringkasan
  const activeTxns = transactions.filter(t => !t.deleted_at);
  const totalGross = activeTxns.reduce((sum, t) => sum + t.gross_amount, 0);
  const totalNet = activeTxns.reduce((sum, t) => sum + t.net_profit, 0);
  const totalItems = activeTxns.reduce((sum, t) => sum + t.total_items, 0);
  const totalVoid = transactions.length - activeTxns.length;

  const summaryData = [
    ['Laporan Penjualan Dependor'],
    [],
    ['Tanggal Ekspor', new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })],
    ['Total Transaksi Diekspor', transactions.length],
    ['Transaksi Sukses', activeTxns.length],
    ['Transaksi Dibatalkan (Void)', totalVoid],
    ['Total Item Terjual (Sukses)', totalItems],
    ['Total Penjualan Kotor (Sukses)', formatIDR(totalGross)],
    ['Total Laba Bersih (Sukses)', formatIDR(totalNet)],
    [],
    ['Catatan:', 'Laba bersih dihitung dari harga jual dikurangi harga beli awal produk.'],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 32 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan');

  // Write base64 and share
  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const filename = `riwayat_transaksi_${Date.now()}.xlsx`;
  const uri = (documentDirectory ?? '') + filename;

  await writeAsStringAsync(uri, wbout, { encoding: EncodingType.Base64 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Ekspor Riwayat Transaksi ke Excel',
    });
  }
}

