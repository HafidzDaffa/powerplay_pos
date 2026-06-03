// ============================================================
// Dependor — IDR Currency Formatter
// ============================================================

/**
 * Format number to Indonesian Rupiah
 * Example: 150000 → "Rp 150.000"
 */
export function formatIDR(amount: number): string {
  if (isNaN(amount)) return 'Rp 0';
  return (
    'Rp ' +
    Math.round(amount)
      .toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
  );
}

/**
 * Parse IDR string back to number
 * Example: "Rp 150.000" → 150000
 */
export function parseIDR(value: string): number {
  const cleaned = value.replace(/[^0-9]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

/**
 * Format compact IDR for KPI cards
 * Example: 1500000 → "Rp 1,5 Jt"
 */
export function formatIDRCompact(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `Rp ${(amount / 1_000_000_000).toFixed(1)} M`;
  }
  if (amount >= 1_000_000) {
    return `Rp ${(amount / 1_000_000).toFixed(1)} Jt`;
  }
  if (amount >= 1_000) {
    return `Rp ${(amount / 1_000).toFixed(0)} Rb`;
  }
  return formatIDR(amount);
}

/**
 * Generate a unique invoice number
 * Format: INV-YYYYMMDD-XXXXX
 */
export function generateInvoiceNumber(): string {
  const now = new Date();
  const date = now
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const random = Math.floor(10000 + Math.random() * 90000);
  return `INV-${date}-${random}`;
}

/**
 * Generate a unique SKU
 * Format: SKU-XXXXXXXXXX (10 char hex)
 */
export function generateSKU(productName?: string): string {
  const prefix = productName
    ? productName.toUpperCase().replace(/\s+/g, '').slice(0, 4)
    : 'SKU';
  const rand = Math.random().toString(36).toUpperCase().slice(2, 8);
  return `${prefix}-${rand}`;
}

/**
 * Format date to Indonesian locale
 */
export function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Get ISO date string for SQL queries (YYYY-MM-DD)
 */
export function toSQLDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Get date range boundaries
 */
export function getDateRange(filter: 'today' | 'week' | 'month'): {
  start: string;
  end: string;
} {
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const start = new Date();
  start.setHours(0, 0, 0, 0);

  if (filter === 'today') {
    return { start: toSQLDate(start), end: toSQLDate(today) };
  }
  if (filter === 'week') {
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    return { start: toSQLDate(start), end: toSQLDate(today) };
  }
  // month
  start.setDate(1);
  return { start: toSQLDate(start), end: toSQLDate(today) };
}
