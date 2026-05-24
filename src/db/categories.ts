// ============================================================
// POS PowerPlay — Categories DB Queries
// ============================================================
import { getDatabase } from './database';
import { Category } from '../types';

export async function getActiveCategories(): Promise<Category[]> {
  const db = getDatabase();
  return db.getAllAsync<Category>(
    `SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY name ASC`
  );
}

export async function getAllCategoriesForDump(): Promise<Category[]> {
  const db = getDatabase();
  return db.getAllAsync<Category>(`SELECT * FROM categories ORDER BY id ASC`);
}

export async function insertCategory(name: string): Promise<number> {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO categories (name, updated_at) VALUES (?, CURRENT_TIMESTAMP)`,
    [name]
  );
  return result.lastInsertRowId;
}

export async function updateCategory(id: number, name: string): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [name, id]
  );
}

export async function softDeleteCategory(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE categories
     SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

export async function restoreCategory(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE categories
     SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

export async function hardDeleteCategory(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
}
