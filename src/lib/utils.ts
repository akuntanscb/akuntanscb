import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number): string {
  try {
    const raw = localStorage.getItem('system_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      const currency = parsed.currency || 'IDR';
      const symbol = parsed.currencySymbol || 'Rp';
      const lang = parsed.language || 'id';

      // Set standard locales based on system language
      const locale = lang === 'en' ? 'en-US' : (lang === 'ar' ? 'ar-SA' : 'id-ID');

      // Setup clean number formatter
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    }
  } catch (e) {
    // Fail silently to default IDR formatting
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}
