// ============================================================
// POS PowerPlay — Products DB Queries
// ============================================================
import { getDatabase } from './database';
import { Product, ProductFormData } from '../types';

// ── READ ─────────────────────────────────────────────────────

/** Get all active (non-deleted) products, with category name joined */
export async function getActiveProducts(): Promise<Product[]> {
  const db = getDatabase();
  const result = await db.getAllAsync<Product>(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id AND c.deleted_at IS NULL
    WHERE p.deleted_at IS NULL
    ORDER BY p.name ASC
  `);
  return result;
}

/** Get all products including soft-deleted (for trash screen) */
export async function getDeletedProducts(): Promise<Product[]> {
  const db = getDatabase();
  return db.getAllAsync<Product>(`
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.deleted_at IS NOT NULL
    ORDER BY p.deleted_at DESC
  `);
}

/** Get single product by ID */
export async function getProductById(id: number): Promise<Product | null> {
  const db = getDatabase();
  const result = await db.getFirstAsync<Product>(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = ?`,
    [id]
  );
  return result ?? null;
}

/** Get active product by SKU */
export async function getProductBySku(sku: string): Promise<Product | null> {
  const db = getDatabase();
  const result = await db.getFirstAsync<Product>(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.sku = ? AND p.deleted_at IS NULL`,
    [sku]
  );
  return result ?? null;
}

/** Search active products by name or SKU */
export async function searchProducts(query: string): Promise<Product[]> {
  const db = getDatabase();
  const q = `%${query}%`;
  return db.getAllAsync<Product>(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.deleted_at IS NULL AND (p.name LIKE ? OR p.sku LIKE ?)
     ORDER BY p.name ASC`,
    [q, q]
  );
}

// ── CREATE ────────────────────────────────────────────────────

export async function insertProduct(data: ProductFormData): Promise<number> {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO products (sku, name, category_id, buy_price, sell_price, discount, fix_price, stock, picture, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      data.sku,
      data.name,
      data.category_id,
      parseFloat(data.buy_price) || 0,
      parseFloat(data.sell_price) || 0,
      parseFloat(data.discount) || 0,
      parseFloat(data.fix_price) || 0,
      parseInt(data.stock) || 0,
      data.picture,
    ]
  );
  return result.lastInsertRowId;
}

// ── UPDATE ────────────────────────────────────────────────────

/**
 * Edit a product — explicitly sets updated_at = CURRENT_TIMESTAMP
 */
export async function updateProduct(
  id: number,
  data: ProductFormData
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE products
     SET sku        = ?,
         name       = ?,
         category_id = ?,
         buy_price  = ?,
         sell_price = ?,
         discount   = ?,
         fix_price  = ?,
         stock      = ?,
         picture    = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      data.sku,
      data.name,
      data.category_id,
      parseFloat(data.buy_price) || 0,
      parseFloat(data.sell_price) || 0,
      parseFloat(data.discount) || 0,
      parseFloat(data.fix_price) || 0,
      parseInt(data.stock) || 0,
      data.picture,
      id,
    ]
  );
}

/**
 * Decrease stock after a sale — updates updated_at
 */
export async function decreaseStock(
  productId: number,
  quantity: number
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE products
     SET stock = stock - ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND deleted_at IS NULL`,
    [quantity, productId]
  );
}

/**
 * Increase stock (e.g., after voiding a transaction)
 */
export async function increaseStock(
  productId: number,
  quantity: number
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE products
     SET stock = stock + ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [quantity, productId]
  );
}

// ── SOFT DELETE ───────────────────────────────────────────────

/**
 * Soft-delete a product: sets deleted_at AND updated_at simultaneously
 */
export async function softDeleteProduct(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE products
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

/**
 * Restore a soft-deleted product: clears deleted_at, updates updated_at
 */
export async function restoreProduct(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE products
     SET deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

/**
 * Permanent (hard) delete — only available from Trash screen
 */
export async function hardDeleteProduct(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM products WHERE id = ?`, [id]);
}
