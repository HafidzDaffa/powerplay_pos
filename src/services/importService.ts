// ============================================================
// Dependor — Import Service
// Uses expo-file-system/legacy for SDK 54 compatibility
// ============================================================
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import { getDatabase, resetDatabase } from '../db/database';
import { DatabaseDump } from '../types';

export async function importDatabaseFromJSON(): Promise<string> {
  // Pick file
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return 'Import dibatalkan.';
  }

  const fileUri = result.assets[0].uri;
  const jsonStr = await readAsStringAsync(fileUri, {
    encoding: EncodingType.UTF8,
  });

  let dump: DatabaseDump;
  try {
    dump = JSON.parse(jsonStr);
  } catch {
    throw new Error('File JSON tidak valid atau rusak.');
  }

  if (!dump.products || !dump.transactions) {
    throw new Error('Struktur file backup tidak dikenali.');
  }

  // Reset and recreate schema
  await resetDatabase();

  const db = getDatabase();

  // Re-insert all data preserving timestamps
  for (const cat of dump.categories ?? []) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, created_at, updated_at, deleted_at) VALUES (?,?,?,?,?)`,
      [cat.id, cat.name, cat.created_at, cat.updated_at, cat.deleted_at]
    );
  }

  for (const p of dump.products ?? []) {
    await db.runAsync(
      `INSERT OR IGNORE INTO products
       (id, sku, name, category_id, buy_price, sell_price, discount, fix_price, stock, picture, created_at, updated_at, deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        p.id, p.sku, p.name, p.category_id, p.buy_price, p.sell_price,
        p.discount, p.fix_price, p.stock, p.picture, p.created_at, p.updated_at, p.deleted_at,
      ]
    );
  }

  for (const t of dump.transactions ?? []) {
    await db.runAsync(
      `INSERT OR IGNORE INTO transactions
       (id, invoice_number, total_items, gross_amount, net_profit, type, status, customer_name, customer_phone, customer_address, shipping_fee, created_at, updated_at, deleted_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        t.id, t.invoice_number, t.total_items, t.gross_amount, t.net_profit,
        t.type ?? 'OFFLINE', t.status ?? 'SUCCESS', t.customer_name, t.customer_phone, t.customer_address,
        t.shipping_fee ?? 0, t.created_at, t.updated_at, t.deleted_at
      ]
    );
  }

  for (const ti of dump.transaction_items ?? []) {
    await db.runAsync(
      `INSERT OR IGNORE INTO transaction_items
       (id, transaction_id, product_id, quantity, buy_price, sell_price, fix_price)
       VALUES (?,?,?,?,?,?,?)`,
      [ti.id, ti.transaction_id, ti.product_id, ti.quantity, ti.buy_price, ti.sell_price, ti.fix_price]
    );
  }

  for (const c of dump.cashflow ?? []) {
    await db.runAsync(
      `INSERT OR IGNORE INTO cashflow
       (id, type, title, amount, notes, created_at, updated_at, deleted_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [c.id, c.type, c.title, c.amount, c.notes, c.created_at, c.updated_at, c.deleted_at]
    );
  }

  return `Import berhasil! ${dump.products.length} produk, ${dump.transactions.length} transaksi dipulihkan.`;
}
