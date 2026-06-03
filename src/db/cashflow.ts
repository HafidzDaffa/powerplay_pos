// ============================================================
// Dependor — Cashflow DB Queries
// ============================================================
import { getDatabase } from './database';
import { Cashflow, CashflowFormData } from '../types';

export async function getActiveCashflows(): Promise<Cashflow[]> {
  const db = getDatabase();
  return db.getAllAsync<Cashflow>(
    `SELECT * FROM cashflow WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
}

export async function getDeletedCashflows(): Promise<Cashflow[]> {
  const db = getDatabase();
  return db.getAllAsync<Cashflow>(
    `SELECT * FROM cashflow WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`
  );
}

export async function getAllCashflowsForDump(): Promise<Cashflow[]> {
  const db = getDatabase();
  return db.getAllAsync<Cashflow>(`SELECT * FROM cashflow ORDER BY id ASC`);
}

export async function insertCashflow(data: CashflowFormData): Promise<number> {
  const db = getDatabase();
  const result = await db.runAsync(
    `INSERT INTO cashflow (type, title, amount, notes, updated_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [data.type, data.title, parseFloat(data.amount) || 0, data.notes || null]
  );
  return result.lastInsertRowId;
}

export async function updateCashflow(
  id: number,
  data: CashflowFormData
): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE cashflow
     SET type       = ?,
         title      = ?,
         amount     = ?,
         notes      = ?,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [data.type, data.title, parseFloat(data.amount) || 0, data.notes || null, id]
  );
}

export async function softDeleteCashflow(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE cashflow
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

export async function restoreCashflow(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    `UPDATE cashflow
     SET deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [id]
  );
}

export async function hardDeleteCashflow(id: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(`DELETE FROM cashflow WHERE id = ?`, [id]);
}
