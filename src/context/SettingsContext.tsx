import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface SystemSettings {
  currency: 'IDR' | 'USD' | 'EUR' | 'SGD' | 'GBP' | 'JPY';
  currencySymbol: string;
  language: 'id' | 'en' | 'ar';
  fontFamily: 'Inter' | 'Outfit' | 'Space Grotesk' | 'Playfair Display' | 'JetBrains Mono';
  fontSize: 'sm' | 'base' | 'lg';
  systemName: string;
  systemSubName: string;
  logoType: 'school' | 'finance' | 'shield' | 'custom';
  customLogoUrl: string;
  colorTheme: 'original' | 'emerald' | 'indigo' | 'slate' | 'rose' | 'violet';
  invoiceTemplate: 'classic' | 'modern' | 'minimalist';
}

const DEFAULT_SETTINGS: SystemSettings = {
  currency: 'IDR',
  currencySymbol: 'Rp',
  language: 'id',
  fontFamily: 'Inter',
  fontSize: 'base',
  systemName: 'SIA Cendekia Baznas',
  systemSubName: 'Sistem Informasi Akuntansi Nirlaba Sekolah',
  logoType: 'school',
  customLogoUrl: '',
  colorTheme: 'original',
  invoiceTemplate: 'modern',
};

const THEME_COLORS = {
  original: '#5a5a40',
  emerald: '#059669',
  indigo: '#4f46e5',
  slate: '#475569',
  rose: '#e11d48',
  violet: '#7c3aed',
};

export const translations = {
  id: {
    dashboard: 'Dashboard',
    journal: 'Jurnal Umum',
    ledger: 'Buku Besar',
    invoices: 'Faktur / Invoice',
    debts: 'Hutang & Piutang',
    reports: 'Laporan Keuangan',
    coa: 'Daftar Akun (COA)',
    settings: 'Pengaturan Sistem',
    signOut: 'Keluar',
    connected: 'Server Terkoneksi',
    addTransaction: 'Tambah Transaksi',
    save: 'Simpan',
    cancel: 'Batal',
    edit: 'Ubah',
    deletePost: 'Hapus',
    reference: 'Referensi',
    description: 'Keterangan',
    pic: 'Penanggung Jawab (PIC)',
    date: 'Tanggal',
    search: 'Cari transaksi...',
    actions: 'Aksi',
    noData: 'Belum ada data tersedia',
    currency: 'Mata Uang Penggunaan',
    language: 'Bahasa Sistem',
    fontSize: 'Ukuran Huruf',
    fontFamily: 'Jenis Font',
    systemName: 'Nama Lembaga / Sistem',
    systemSlogan: 'Slogan / Deskripsi Sistem',
    customLogo: 'URL Tautan Logo Kustom',
    colorTheme: 'Tema Warna Utama',
    saveSettings: 'Simpan Pengaturan',
    activeTemplate: 'Desain Templat Invoice',
    bulkDelete: 'Hapus Massal',
    asset: 'Aset',
    liability: 'Kewajiban / Liabilitas',
    equity: 'Ekuitas',
    revenue: 'Pendapatan',
    expense: 'Beban',
    settingDescription: 'Konfigurasi mendalam logo, mata uang, bahasa, font, dan template global untuk seluruh akuntansi sekolah.',
    currencyHelp: 'Pilih mata uang dasar pelaporan. Nilai angka akan otomatis beradaptasi ke simbol ini di seluruh interface.',
    logoHelp: 'Gunakan logo standar Cendekia Baznas atau tempel URL logo sekolah kustom.',
    themeHelp: 'Pilih palet warna estetis untuk menyesuaikan panel navigasi dan tombol penjelajah.',
    fontHelp: 'Pilih font display modern & ukuran tulisan yang ramah di mata pembaca laporan.',
  },
  en: {
    dashboard: 'Dashboard',
    journal: 'General Journal',
    ledger: 'General Ledger',
    invoices: 'Invoices & Receipts',
    debts: 'Payable & Receivable',
    reports: 'Financial Reports',
    coa: 'Chart of Accounts',
    settings: 'System Settings',
    signOut: 'Sign Out',
    connected: 'Server Synced',
    addTransaction: 'New Transaction',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    deletePost: 'Delete',
    reference: 'Reference',
    description: 'Description',
    pic: 'Person In Charge (PIC)',
    date: 'Date',
    search: 'Search transactions...',
    actions: 'Actions',
    noData: 'No data yet',
    currency: 'Operating Currency',
    language: 'System Language',
    fontSize: 'Font Size',
    fontFamily: 'Font Typography',
    systemName: 'Institution / App Name',
    systemSlogan: 'Slogan / App Description',
    customLogo: 'Custom Logo URL Link',
    colorTheme: 'Primary Palette Theme',
    saveSettings: 'Save Settings',
    activeTemplate: 'Invoice Style Sheet',
    bulkDelete: 'Bulk Removal',
    asset: 'Asset',
    liability: 'Liability',
    equity: 'Equity',
    revenue: 'Revenue',
    expense: 'Expense',
    settingDescription: 'Deep customization of branding assets, baseline currency, translations, font displays, and sheets across the ledger.',
    currencyHelp: 'Select baseline currency. The interface formats ledger and invoice numbers with this option automatically.',
    logoHelp: 'Pick preloaded theme vector icons or paste your school brand logo link directly.',
    themeHelp: 'Adapt UI colors to align perfectly with your organizational guidelines or mood.',
    fontHelp: 'Set highly legible modern font types and size dimensions optimized for reading financial lists.',
  },
  ar: {
    dashboard: 'لوحة القيادة',
    journal: 'دفتر اليومية العامة',
    ledger: 'دفتر الأستاذ العام',
    invoices: 'الفواتير والإيصالات',
    debts: 'الحسابات الدائنة والمدينة',
    reports: 'التقارير المالية',
    coa: 'دليل الحسابات (COA)',
    settings: 'إعدادات النظام عموماً',
    signOut: 'تسجيل الخروج',
    connected: 'تم الاتصال بالخادم',
    addTransaction: 'إضافة معاملة جديدة',
    save: 'حفظ',
    cancel: 'إلغاء المعاملة',
    edit: 'تعديل البيانات',
    deletePost: 'حذف',
    reference: 'الرقم المرجعي',
    description: 'البيان / الشرح',
    pic: 'الشخص المسؤول (PIC)',
    date: 'تاريخ القيد',
    search: 'البحث في القيود...',
    actions: 'الإجراءات المتوفرة',
    noData: 'لا تتوفر أي بيانات حالياً',
    currency: 'عملة معاملة النظام',
    language: 'لغة واجهة المستخدم',
    fontSize: 'حجم خط العرض',
    fontFamily: 'نوع الخط المحدد',
    systemName: 'اسم المنشأة أو المؤسسة',
    systemSlogan: 'شعار أو تفاصيل المؤسسة',
    customLogo: 'رابط الشعار المخصص',
    colorTheme: 'اللون الرئيسي للنظام',
    saveSettings: 'حفظ كل التغييرات',
    activeTemplate: 'شكل قالب الفاتورة المعتمد',
    bulkDelete: 'مسح شامل دفعة واحدة',
    asset: 'الأصول',
    liability: 'الالتزامات / الخصوم',
    equity: 'حقوق الملكية / رأس المال',
    revenue: 'الإيرادات المستلمة',
    expense: 'المصروفات التشغيلية',
    settingDescription: 'إعدادات تفصيلية للشركة، تحديد العملة، اللغة، نوع الخط، وتغيير الشعار لجميع واجهات المحاسبة.',
    currencyHelp: 'اختر العملة المستخدمة في التقارير والفواتير. سيتم تهيئة الأرقام تلقائياً.',
    logoHelp: 'اختر الشعار الافتراضي للمدرسة أو الصق رابط شعار مخصص مباشرة.',
    themeHelp: 'اختر لون الواجهة المناسب لهوية مؤسستكم أو ذوق العمل المفضل.',
    fontHelp: 'اختر نوع الخط وحجمه لتسهيل قراءة الأرقام والموازين بدقة بالغة.',
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface SettingsContextType {
  settings: SystemSettings;
  t: (key: keyof typeof translations.id) => string;
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const local = localStorage.getItem('system_settings');
    if (local) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
      } catch (e) {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });
  const [isLoading, setIsLoading] = useState(true);

  // Sync to database on mount
  useEffect(() => {
    const loadDbSettings = async () => {
      try {
        const docRef = doc(db, 'system_settings', 'global');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const dbData = snap.data() as SystemSettings;
          const merged = { ...DEFAULT_SETTINGS, ...dbData };
          setSettings(merged);
          localStorage.setItem('system_settings', JSON.stringify(merged));
        }
      } catch (e: any) {
        if (e && e.message && (e.message.includes('permission') || e.code === 'permission-denied')) {
          try {
            handleFirestoreError(e, OperationType.GET, 'system_settings/global');
          } catch (thrownErr) {
            console.error('Firestore initialization error:', thrownErr);
          }
        } else {
          console.warn('Could not fetch settings from Firestore, using local fallback:', e);
        }
      } finally {
        setIsLoading(false);
      }
    };
    loadDbSettings();
  }, []);

  // Apply visual configurations dynamically when settings change
  useEffect(() => {
    localStorage.setItem('system_settings', JSON.stringify(settings));

    // 1. Color Themes
    const brandColor = THEME_COLORS[settings.colorTheme] || THEME_COLORS.original;
    document.documentElement.style.setProperty('--color-natural-primary', brandColor);

    // 2. Font family style injection
    let fontStack = '"Inter", ui-sans-serif, system-ui, sans-serif';
    if (settings.fontFamily === 'Outfit') {
      fontStack = '"Outfit", "Inter", sans-serif';
    } else if (settings.fontFamily === 'Space Grotesk') {
      fontStack = '"Space Grotesk", sans-serif';
    } else if (settings.fontFamily === 'Playfair Display') {
      fontStack = '"Playfair Display", Georgia, serif';
    } else if (settings.fontFamily === 'JetBrains Mono') {
      fontStack = '"JetBrains Mono", monospace';
    }
    document.documentElement.style.setProperty('--font-sans', fontStack);

    // 3. Font Size class adjustments
    const htmlEl = document.documentElement;
    if (settings.fontSize === 'sm') {
      htmlEl.style.fontSize = '90%';
    } else if (settings.fontSize === 'lg') {
      htmlEl.style.fontSize = '105%';
    } else {
      htmlEl.style.fontSize = '100%';
    }

    // 4. Set document Direction (RTL support for Arabic!)
    if (settings.language === 'ar') {
      htmlEl.dir = 'rtl';
    } else {
      htmlEl.dir = 'ltr';
    }
  }, [settings]);

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    const updated = { ...settings, ...newSettings };
    
    // Automatically set currency symbol based on currency selection
    if (newSettings.currency) {
      if (newSettings.currency === 'IDR') updated.currencySymbol = 'Rp';
      else if (newSettings.currency === 'USD') updated.currencySymbol = '$';
      else if (newSettings.currency === 'EUR') updated.currencySymbol = '€';
      else if (newSettings.currency === 'SGD') updated.currencySymbol = 'S$';
      else if (newSettings.currency === 'GBP') updated.currencySymbol = '£';
      else if (newSettings.currency === 'JPY') updated.currencySymbol = '¥';
    }

    setSettings(updated);

    try {
      const docRef = doc(db, 'system_settings', 'global');
      await setDoc(docRef, updated, { merge: true });
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, 'system_settings/global');
    }
  };

  const t = (key: keyof typeof translations.id): string => {
    const currentLangDict = translations[settings.language] || translations.id;
    return currentLangDict[key] || translations.id[key] || String(key);
  };

  return (
    <SettingsContext.Provider value={{ settings, t, updateSettings, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used inside high level SettingsProvider');
  }
  return context;
};
