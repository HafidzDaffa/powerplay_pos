// ============================================================
// Dependor — SQLite Database Initialization
// ============================================================
import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('dependor.db');
  }
  return db;
}

/**
 * Initialize the database: create all tables, indexes, and triggers.
 * Must be called once at app startup (in _layout.tsx).
 */
export async function initDatabase(): Promise<void> {
  const database = getDatabase();

  // Enable WAL mode for performance
  await database.execAsync('PRAGMA journal_mode = WAL;');
  await database.execAsync('PRAGMA foreign_keys = ON;');

  // ── Categories ──────────────────────────────────────────────
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL
    );
  `);

  // ── Products ─────────────────────────────────────────────────
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS products (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      sku         TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      category_id INTEGER,
      buy_price   REAL NOT NULL,
      sell_price  REAL NOT NULL,
      discount    REAL DEFAULT 0,
      fix_price   REAL NOT NULL,
      stock       INTEGER DEFAULT 0,
      picture     TEXT,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at  DATETIME DEFAULT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );
  `);

  // ── Transactions ──────────────────────────────────────────────
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      total_items    INTEGER NOT NULL,
      gross_amount   REAL NOT NULL,
      net_profit     REAL NOT NULL,
      created_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at     DATETIME DEFAULT NULL
    );
  `);

  // ── Transaction Items ─────────────────────────────────────────
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS transaction_items (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      product_id     INTEGER,
      quantity       INTEGER NOT NULL,
      buy_price      REAL NOT NULL,
      sell_price     REAL NOT NULL,
      fix_price      REAL NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id)     REFERENCES products(id)     ON DELETE SET NULL
    );
  `);

  // ── Cashflow ──────────────────────────────────────────────────
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS cashflow (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      type       TEXT CHECK(type IN ('INCOME', 'EXPENSE')) NOT NULL,
      title      TEXT NOT NULL,
      amount     REAL NOT NULL,
      notes      TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME DEFAULT NULL
    );
  `);

  // ── Performance Indexes ───────────────────────────────────────
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_products_active
      ON products(id) WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_products_sku_active
      ON products(sku) WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_transactions_active
      ON transactions(id) WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_cashflow_active
      ON cashflow(id) WHERE deleted_at IS NULL;

    CREATE INDEX IF NOT EXISTS idx_transaction_items_txn
      ON transaction_items(transaction_id);
  `);

  console.log('[DB] Dependor database initialized ✓');
}

/**
 * Drop and recreate all tables (used during JSON import).
 * WARNING: Destructive — only call during import flow.
 */
export async function resetDatabase(): Promise<void> {
  const database = getDatabase();
  await database.execAsync(`
    DROP TABLE IF EXISTS transaction_items;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS cashflow;
    DROP TABLE IF EXISTS products;
    DROP TABLE IF EXISTS categories;
  `);
  await initDatabase();
}
