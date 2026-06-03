// ============================================================
// Dependor — Dashboard KPI Queries
// All queries strictly filter WHERE deleted_at IS NULL
// ============================================================
import { getDatabase } from './database';
import { DashboardMetrics } from '../types';

interface RawMetricRow {
  value: number;
}

/**
 * Build a safe date filter clause for SQL.
 * Returns parameterized WHERE fragment and values.
 */
function buildDateFilter(
  start: string | null,
  end: string | null
): { clause: string; params: string[] } {
  if (start && end) {
    return {
      clause: `AND DATE(created_at) >= DATE(?) AND DATE(created_at) <= DATE(?)`,
      params: [start, end],
    };
  }
  return { clause: '', params: [] };
}

/**
 * Get all KPI metrics for the dashboard.
 *
 * @param start - ISO date string (YYYY-MM-DD) or null for all time
 * @param end   - ISO date string (YYYY-MM-DD) or null for all time
 */
export async function getDashboardMetrics(
  start: string | null,
  end: string | null
): Promise<DashboardMetrics> {
  const db = getDatabase();
  const { clause: dateClause, params: dateParams } = buildDateFilter(start, end);

  // ── Gross Revenue (sum of fix_price amounts from active transactions) ──
  const grossRow = await db.getFirstAsync<RawMetricRow>(
    `SELECT COALESCE(SUM(gross_amount), 0) AS value
     FROM transactions
     WHERE deleted_at IS NULL ${dateClause}`,
    dateParams
  );
  const grossProfit = grossRow?.value ?? 0;

  // ── Net Profit: (Sales Revenue - COGS from active txns)
  //               + Active Non-Sales Income
  //               - Active Operational Expenses
  // ── Step 1: Net from sales (using net_profit column) ──────────────────
  const netSalesRow = await db.getFirstAsync<RawMetricRow>(
    `SELECT COALESCE(SUM(net_profit), 0) AS value
     FROM transactions
     WHERE deleted_at IS NULL ${dateClause}`,
    dateParams
  );
  const netSales = netSalesRow?.value ?? 0;

  // ── Step 2: Non-sales INCOME ─────────────────────────────────────────
  const incomeRow = await db.getFirstAsync<RawMetricRow>(
    `SELECT COALESCE(SUM(amount), 0) AS value
     FROM cashflow
     WHERE deleted_at IS NULL AND type = 'INCOME' ${dateClause}`,
    dateParams
  );
  const income = incomeRow?.value ?? 0;

  // ── Step 3: EXPENSE ───────────────────────────────────────────────────
  const expenseRow = await db.getFirstAsync<RawMetricRow>(
    `SELECT COALESCE(SUM(amount), 0) AS value
     FROM cashflow
     WHERE deleted_at IS NULL AND type = 'EXPENSE' ${dateClause}`,
    dateParams
  );
  const expense = expenseRow?.value ?? 0;

  const netProfit = netSales + income - expense;

  // ── Total Active Products ─────────────────────────────────────────────
  const productsRow = await db.getFirstAsync<RawMetricRow>(
    `SELECT COUNT(*) AS value FROM products WHERE deleted_at IS NULL`
  );
  const totalProducts = productsRow?.value ?? 0;

  // ── Accumulated Assets (buy_price × stock, active only) ──────────────
  const assetsRow = await db.getFirstAsync<RawMetricRow>(
    `SELECT COALESCE(SUM(buy_price * stock), 0) AS value
     FROM products
     WHERE deleted_at IS NULL`
  );
  const totalAssets = assetsRow?.value ?? 0;

  // ── Total Active Transactions ─────────────────────────────────────────
  const txnRow = await db.getFirstAsync<RawMetricRow>(
    `SELECT COUNT(*) AS value
     FROM transactions
     WHERE deleted_at IS NULL ${dateClause}`,
    dateParams
  );
  const totalTransactions = txnRow?.value ?? 0;

  return {
    grossProfit,
    netProfit,
    totalProducts,
    totalAssets,
    totalTransactions,
  };
}

/**
 * Get recent transactions (active, non-void) ordered by newest first.
 * Imported by the Dashboard screen.
 */
export async function getRecentTransactions(limit = 10): Promise<import('../types').Transaction[]> {
  const db = getDatabase();
  return db.getAllAsync<import('../types').Transaction>(
    `SELECT * FROM transactions WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT ?`,
    [limit]
  );
}

/**
 * Get daily revenue data for chart (last 7 days)
 */
export async function getDailyRevenue(): Promise<
  Array<{ date: string; amount: number }>
> {
  const db = getDatabase();
  const rows = await db.getAllAsync<{ date: string; amount: number }>(
    `SELECT DATE(created_at) AS date, COALESCE(SUM(gross_amount), 0) AS amount
     FROM transactions
     WHERE deleted_at IS NULL
       AND DATE(created_at) >= DATE('now', '-6 days')
     GROUP BY DATE(created_at)
     ORDER BY date ASC`
  );
  return rows;
}

/**
 * Get top selling products (by quantity sold, active transactions only)
 */
export async function getTopProducts(limit = 5): Promise<
  Array<{ name: string; sku: string; total_sold: number; revenue: number }>
> {
  const db = getDatabase();
  return db.getAllAsync(
    `SELECT p.name, p.sku,
            SUM(ti.quantity) AS total_sold,
            SUM(ti.fix_price * ti.quantity) AS revenue
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id AND t.deleted_at IS NULL
     JOIN products p ON p.id = ti.product_id
     WHERE p.deleted_at IS NULL
     GROUP BY ti.product_id
     ORDER BY total_sold DESC
     LIMIT ?`,
    [limit]
  );
}
