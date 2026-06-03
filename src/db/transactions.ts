// ============================================================
// Dependor — Transactions DB Queries
// ============================================================
import { getDatabase } from './database';
import { Transaction, TransactionItem, TransactionWithItems, CartItem } from '../types';
import { increaseStock } from './products';
import { generateInvoiceNumber } from '../utils/currency';

// ── READ ─────────────────────────────────────────────────────

export async function getActiveTransactions(): Promise<Transaction[]> {
  const db = getDatabase();
  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
}

export async function getDeletedTransactions(): Promise<Transaction[]> {
  const db = getDatabase();
  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
  );
}

export async function getTransactionItems(transactionId: number): Promise<TransactionItem[]> {
  const db = getDatabase();
  return db.getAllAsync<TransactionItem>(
    `SELECT ti.*, p.name AS product_name, p.sku AS product_sku
     FROM transaction_items ti
     LEFT JOIN products p ON p.id = ti.product_id
     WHERE ti.transaction_id = ?`,
    [transactionId]
  );
}

export async function getTransactionWithItems(
  transactionId: number
): Promise<TransactionWithItems | null> {
  const db = getDatabase();
  const txn = await db.getFirstAsync<Transaction>(
    `SELECT * FROM transactions WHERE id = ?`,
    [transactionId]
  );
  if (!txn) return null;
  const items = await getTransactionItems(transactionId);
  return { ...txn, items };
}

export async function getRecentTransactions(limit = 10): Promise<Transaction[]> {
  const db = getDatabase();
  return db.getAllAsync<Transaction>(
    `SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

// ── CREATE ────────────────────────────────────────────────────

/**
 * Create a complete transaction from cart items.
 * Decreases product stock for each item.
 */
export async function createTransaction(
  cartItems: CartItem[]
): Promise<{ transactionId: number; invoiceNumber: string }> {
  const db = getDatabase();
  const invoiceNumber = generateInvoiceNumber();

  let totalItems = 0;
  let grossAmount = 0;
  let netProfit = 0;

  for (const item of cartItems) {
    totalItems += item.quantity;
    grossAmount += item.product.fix_price * item.quantity;
    netProfit +=
      (item.product.fix_price - item.product.buy_price) * item.quantity;
  }

  // Insert transaction header
  const txnResult = await db.runAsync(
    `INSERT INTO transactions (invoice_number, total_items, gross_amount, net_profit, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [invoiceNumber, totalItems, grossAmount, netProfit]
  );

  const transactionId = txnResult.lastInsertRowId;

  // Insert transaction items and decrease stock
  for (const item of cartItems) {
    await db.runAsync(
      `INSERT INTO transaction_items (transaction_id, product_id, quantity, buy_price, sell_price, fix_price)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        transactionId,
        item.product.id,
        item.quantity,
        item.product.buy_price,
        item.product.sell_price,
        item.product.fix_price,
      ]
    );

    // Decrease stock and update product's updated_at
    await db.runAsync(
      `UPDATE products
       SET stock = stock - ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND deleted_at IS NULL`,
      [item.quantity, item.product.id]
    );
  }

  return { transactionId, invoiceNumber };
}

// ── VOID (SOFT DELETE) ────────────────────────────────────────

/**
 * Void a transaction:
 * 1. Sets deleted_at + updated_at on the transaction
 * 2. Reverses stock for all linked products (each gets updated_at refreshed)
 */
export async function voidTransaction(transactionId: number): Promise<void> {
  const db = getDatabase();

  // 1. Get items before voiding
  const items = await getTransactionItems(transactionId);

  // 2. Soft-delete the transaction
  await db.runAsync(
    `UPDATE transactions
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [transactionId]
  );

  // 3. Reverse stock for each product
  for (const item of items) {
    if (item.product_id) {
      await increaseStock(item.product_id, item.quantity);
    }
  }
}

// ── RESTORE ───────────────────────────────────────────────────

/**
 * Restore a voided transaction:
 * 1. Clears deleted_at, updates updated_at
 * 2. Re-decreases stock for all linked products
 */
export async function restoreTransaction(transactionId: number): Promise<void> {
  const db = getDatabase();

  const items = await getTransactionItems(transactionId);

  // Restore transaction header
  await db.runAsync(
    `UPDATE transactions
     SET deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [transactionId]
  );

  // Re-apply stock decrease
  for (const item of items) {
    if (item.product_id) {
      await db.runAsync(
        `UPDATE products
         SET stock = stock - ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }
  }
}

// ── HARD DELETE ───────────────────────────────────────────────

export async function hardDeleteTransaction(transactionId: number): Promise<void> {
  const db = getDatabase();
  // transaction_items will cascade delete
  await db.runAsync(`DELETE FROM transactions WHERE id = ?`, [transactionId]);
}

// ── DUMP (for export) ─────────────────────────────────────────

export async function getAllTransactionsForDump(): Promise<Transaction[]> {
  const db = getDatabase();
  return db.getAllAsync<Transaction>(`SELECT * FROM transactions ORDER BY id ASC`);
}

export async function getAllTransactionItemsForDump(): Promise<TransactionItem[]> {
  const db = getDatabase();
  return db.getAllAsync<TransactionItem>(`SELECT * FROM transaction_items ORDER BY id ASC`);
}
