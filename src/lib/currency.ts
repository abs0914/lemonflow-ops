/**
 * Currency formatting utilities for Philippine Peso (PHP)
 */

/**
 * Format a number as Philippine Peso currency
 * @param amount - The amount to format
 * @param options - Optional formatting options
 * @returns Formatted currency string (e.g., "₱1,234.56")
 */
export function formatCurrency(
  amount: number,
  options?: {
    showSymbol?: boolean;
    decimals?: number;
  }
): string {
  const { showSymbol = true, decimals = 2 } = options || {};
  
  const formatted = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
  
  if (!showSymbol) {
    return formatted.replace('₱', '').trim();
  }
  
  return formatted;
}

/**
 * Format a number as Philippine Peso without the currency symbol
 * Useful for input fields or contexts where the symbol is separate
 */
export function formatAmount(amount: number, decimals: number = 2): string {
  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount);
}

/**
 * Parse a formatted currency string back to a number
 */
export function parseCurrency(value: string): number {
  const cleaned = value.replace(/[₱,\s]/g, '');
  return parseFloat(cleaned) || 0;
}
