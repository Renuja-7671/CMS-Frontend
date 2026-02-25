/**
 * Format a number as Sri Lankan Rupees (LKR) with cents
 * @param amount - The amount to format
 * @returns Formatted currency string (e.g., "LKR 1,234.56")
 */
export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) {
    return 'LKR 0.00';
  }

  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

/**
 * Format a number as Sri Lankan Rupees (LKR) with cents - compact version without currency symbol
 * Useful for input fields or when space is limited
 * @param amount - The amount to format
 * @returns Formatted number string (e.g., "1,234.56")
 */
export const formatCurrencyCompact = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) {
    return '0.00';
  }

  return new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};
