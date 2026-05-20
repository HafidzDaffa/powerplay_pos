// ============================================================
// POS PowerPlay — TypeScript Type Definitions
// ============================================================

export interface Category {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  category_id: number | null;
  category_name?: string; // joined from categories
  buy_price: number;
  sell_price: number;
  discount: number;
  fix_price: number;
  stock: number;
  picture: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Transaction {
  id: number;
  invoice_number: string;
  total_items: number;
  gross_amount: number;
  net_profit: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TransactionItem {
  id: number;
  transaction_id: number;
  product_id: number | null;
  product_name?: string; // joined
  product_sku?: string;  // joined
  quantity: number;
  buy_price: number;
  sell_price: number;
  fix_price: number;
}

export interface TransactionWithItems extends Transaction {
  items: TransactionItem[];
}

export type CashflowType = 'INCOME' | 'EXPENSE';

export interface Cashflow {
  id: number;
  type: CashflowType;
  title: string;
  amount: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ---- Dashboard / KPI ----
export type DateRangeFilter = 'today' | 'week' | 'month' | 'custom';

export interface DateRange {
  start: string; // ISO date string YYYY-MM-DD
  end: string;
}

export interface DashboardMetrics {
  grossProfit: number;       // total revenue from active transactions
  netProfit: number;         // (sales revenue - COGS) + income - expenses
  totalProducts: number;     // active product count
  totalAssets: number;       // SUM(buy_price * stock) active products
  totalTransactions: number; // count of active transactions
}

// ---- Cart (in-memory, not persisted) ----
export interface CartItem {
  product: Product;
  quantity: number;
}

// ---- Forms ----
export interface ProductFormData {
  sku: string;
  name: string;
  category_id: number | null;
  buy_price: string;
  sell_price: string;
  discount: string;
  fix_price: string;
  stock: string;
  picture: string | null;
}

export interface CashflowFormData {
  type: CashflowType;
  title: string;
  amount: string;
  notes: string;
}

// ---- Export / Import ----
export interface DatabaseDump {
  exported_at: string;
  version: number;
  categories: Category[];
  products: Product[];
  transactions: Transaction[];
  transaction_items: TransactionItem[];
  cashflow: Cashflow[];
}
