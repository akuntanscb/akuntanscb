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

export function terbilang(nominal: number): string {
  const words = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan", "Sepuluh", "Sebelas"];
  
  if (nominal === 0) return "Nol Rupiah";
  
  function konversi(n: number): string {
    if (n < 0) return "";
    if (n < 12) {
      return words[n];
    } else if (n < 20) {
      return (konversi(n - 10) + " Belas").trim();
    } else if (n < 100) {
      return (konversi(Math.floor(n / 10)) + " Puluh " + konversi(n % 10)).trim();
    } else if (n < 200) {
      return ("Seratus " + konversi(n - 100)).trim();
    } else if (n < 1000) {
      return (konversi(Math.floor(n / 100)) + " Ratus " + konversi(n % 100)).trim();
    } else if (n < 2000) {
      return ("Seribu " + konversi(n - 1000)).trim();
    } else if (n < 1000000) {
      return (konversi(Math.floor(n / 1000)) + " Ribu " + konversi(n % 1000)).trim();
    } else if (n < 1000000000) {
      return (konversi(Math.floor(n / 1000000)) + " Juta " + konversi(n % 1000000)).trim();
    } else if (n < 1000000000000) {
      return (konversi(Math.floor(n / 1000000000)) + " Milyar " + konversi(n % 1000000000)).trim();
    } else {
      return (konversi(Math.floor(n / 1000000000000)) + " Triliun " + konversi(n % 1000000000000)).trim();
    }
  }
  
  const kalimat = konversi(Math.floor(nominal)).trim();
  return (kalimat.replace(/\s+/g, " ") + " Rupiah").trim();
}
