import React, { useState, useEffect, useRef } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useUserRole } from '../context/UserRoleContext';
import { motion } from 'motion/react';
import { 
  Building2, 
  Coins, 
  Type, 
  Palette, 
  Languages, 
  FileCheck, 
  Link2, 
  Check, 
  Sparkles, 
  School, 
  Receipt, 
  Shield, 
  RefreshCw,
  Eye,
  Upload,
  Trash2,
  Image as ImageIcon,
  X,
  Database,
  Download,
  AlertTriangle,
  Archive,
  FileSpreadsheet
} from 'lucide-react';
import { formatRupiah } from '../lib/utils';
import { getAccounts } from '../services/accountService';
import { getJournalEntries } from '../services/journalService';
import { getInvoices } from '../services/invoiceService';
import { getDebts } from '../services/debtService';
import { getDeletedRecords } from '../services/trashService';
import { getFixedAssets } from '../services/fixedAssetService';
import { 
  exportCompleteDatabase, 
  restoreDatabaseBackup, 
  resetAllTransactionsToDefault, 
  validateBackupSchema 
} from '../services/dbBackupService';

export default function Settings() {
  const { hasPermission } = useUserRole();

  if (!hasPermission('canSettings')) {
    return (
      <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md mx-auto my-12 shadow-sm font-sans">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-slate-500">Anda tidak memiliki hak istimewa (canSettings) untuk mengakses Pengaturan Sistem.</p>
      </div>
    );
  }

  const { settings, t, updateSettings, isLoading } = useSettings();
  
  // Local Form States
  const [systemName, setSystemName] = useState(settings.systemName);
  const [systemSubName, setSystemSubName] = useState(settings.systemSubName);
  const [currency, setCurrency] = useState(settings.currency);
  const [language, setLanguage] = useState(settings.language);
  const [fontFamily, setFontFamily] = useState(settings.fontFamily);
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [logoType, setLogoType] = useState(settings.logoType);
  const [customLogoUrl, setCustomLogoUrl] = useState(settings.customLogoUrl);
  const [colorTheme, setColorTheme] = useState(settings.colorTheme);
  const [invoiceTemplate, setInvoiceTemplate] = useState(settings.invoiceTemplate);

  // Status indicators
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Database Management States
  const [dbStats, setDbStats] = useState({ accounts: 0, journals: 0, invoices: 0, debts: 0, trash: 0, fixedAssets: 0 });
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'overwrite'>('merge');
  const [restoreConfirmText, setRestoreConfirmText] = useState('');
  const [resetConfirmText, setResetConfirmText] = useState('');
  
  const [dbError, setDbError] = useState('');
  const [dbSuccess, setDbSuccess] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDatabaseStats = async () => {
    setIsStatsLoading(true);
    try {
      const [accounts, journals, invoices, debts, trash, fixedAssets] = await Promise.all([
        getAccounts().catch(() => []),
        getJournalEntries().catch(() => []),
        getInvoices().catch(() => []),
        getDebts().catch(() => []),
        getDeletedRecords().catch(() => []),
        getFixedAssets().catch(() => [])
      ]);
      setDbStats({
        accounts: accounts.length,
        journals: journals.length,
        invoices: invoices.length,
        debts: debts.length,
        trash: trash.length,
        fixedAssets: fixedAssets.length
      });
    } catch (error) {
      console.error('Gagal memuat statistik database:', error);
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    loadDatabaseStats();
  }, []);

  const handleExportBackup = async () => {
    setIsExporting(true);
    setDbError('');
    setDbSuccess('');
    try {
      const backupData = await exportCompleteDatabase();
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `BACKUP_SIDANI_SCB_${new Date().toISOString().split('T')[0]}_${backupData.backupMetadata.timestamp.replace(/[:.]/g, '-')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      setDbSuccess('Salinan database berhasil diekspor dan dicadangkan secara lokal!');
    } catch (error: any) {
      setDbError('Gagal melakukan ekspor data: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDbError('');
    setDbSuccess('');
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== 'application/json' && !selected.name.endsWith('.json')) {
        setDbError('Berkas yang dipilih harus berformat JSON (.json)');
        setRestoreFile(null);
        return;
      }
      setRestoreFile(selected);
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) {
      setDbError('Harap pilih berkas JSON backup terlebih dahulu.');
      return;
    }

    if (restoreMode === 'overwrite' && restoreConfirmText.toUpperCase() !== 'PULIHKAN') {
      setDbError('Harap ketik "PULIHKAN" pada kotak konfirmasi untuk melakukan pemulihan total.');
      return;
    }

    setIsImporting(true);
    setDbError('');
    setDbSuccess('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonContent = e.target?.result as string;
        const parsedData = JSON.parse(jsonContent);

        if (!validateBackupSchema(parsedData)) {
          throw new Error('Format berkas backup tidak valid atau rusak.');
        }

        const stats = await restoreDatabaseBackup(parsedData, restoreMode);
        setDbSuccess(`Pemulihan berhasil! Sebanyak ${stats.totalUploaded} record berhasil diunggah ke database.`);
        setRestoreFile(null);
        setRestoreConfirmText('');
        // Reload settings and list statistics
        await loadDatabaseStats();
        // Reload settings context
        await updateSettings({}); // Trigger reload
      } catch (error: any) {
        setDbError('Gagal memulihkan database: ' + (error.message || error));
      } finally {
        setIsImporting(false);
      }
    };

    reader.onerror = () => {
      setDbError('Gagal membaca berkas cadangan.');
      setIsImporting(false);
    };

    reader.readAsText(restoreFile);
  };

  const handleResetDatabase = async () => {
    if (resetConfirmText.toUpperCase() !== 'RESET') {
      setDbError('Harap ketik "RESET" pada kotak konfirmasi untuk menyetujui penghapusan data.');
      return;
    }

    setIsResetting(true);
    setDbError('');
    setDbSuccess('');

    try {
      await resetAllTransactionsToDefault();
      setDbSuccess('Seluruh data transaksi dan jurnal berhasil dikosongkan. Chart of Accounts (COA) telah diatur ulang ke default sistem.');
      setResetConfirmText('');
      await loadDatabaseStats();
    } catch (error: any) {
      setDbError('Gagal mengosongkan data transaksi: ' + (error.message || error));
    } finally {
      setIsResetting(false);
    }
  };

  const handleLogoFile = (file: File) => {
    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError('Tipe file tidak didukung. Harap unggah format gambar (PNG, JPG, JPEG, SVG).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Ukuran gambar terlalu besar (maksimal 5MB).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 160;
        const MAX_HEIGHT = 160;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const base64 = canvas.toDataURL('image/png');
          setCustomLogoUrl(base64);
        } else {
          setCustomLogoUrl(e.target?.result as string);
        }
      };
      img.onerror = () => {
        setUploadError('Gagal memuat gambar. Silakan ganti file gambar lain.');
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleLogoFile(e.dataTransfer.files[0]);
    }
  };

  const fontsList = [
    { name: 'Inter', className: 'font-sans', description: 'Bersih, elegan, modern & universal' },
    { name: 'Outfit', className: '[font-family:Outfit]', description: 'Sudut bulat, ramah & futuristik' },
    { name: 'Space Grotesk', className: '[font-family:"Space_Grotesk"]', description: 'Tegas, modern, geometris & teknis' },
    { name: 'Playfair Display', className: '[font-family:"Playfair_Display"]', description: 'Serif klasik, formal & prestisius' },
    { name: 'JetBrains Mono', className: 'font-mono', description: 'Monospace, presisi data & pembukuan rapi' },
  ];

  const themeOptions = [
    { id: 'original', name: 'Olive Green (Original)', color: '#5a5a40', bg: 'bg-[#5a5a40]' },
    { id: 'emerald', name: 'Emerald', color: '#059669', bg: 'bg-[#059669]' },
    { id: 'indigo', name: 'Royal Indigo', color: '#4f46e5', bg: 'bg-[#4f46e5]' },
    { id: 'slate', name: 'Active Charcoal', color: '#475569', bg: 'bg-[#475569]' },
    { id: 'rose', name: 'Crimson Rose', color: '#e11d48', bg: 'bg-[#e11d48]' },
    { id: 'violet', name: 'Sunset Violet', color: '#7c3aed', bg: 'bg-[#7c3aed]' },
  ];

  const logoPresets = [
    { id: 'school', name: 'Sekolah (School)', icon: School },
    { id: 'finance', name: 'Keuangan (Finance)', icon: Receipt },
    { id: 'shield', name: 'Badge Keamanan', icon: Shield },
    { id: 'custom', name: 'Logo Kustom (Upload)', icon: Upload },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setToastMessage('');

    try {
      await updateSettings({
        systemName,
        systemSubName,
        currency,
        language,
        fontFamily,
        fontSize,
        logoType,
        customLogoUrl,
        colorTheme,
        invoiceTemplate,
      });

      setToastMessage(language === 'en' ? 'Settings compiled & synchronized successfully!' : (language === 'ar' ? 'تم تجميع الإعدادات ومزامنتها بنجاح!' : 'Pengaturan sistem berhasil diperbarui dan disinkronkan!'));
      
      // Auto close toast
      setTimeout(() => {
        setToastMessage('');
      }, 4000);
    } catch (err: any) {
      console.error(err);
      alert('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <RefreshCw className="w-8 h-8 text-natural-primary animate-spin" />
        <span className="text-sm text-slate-500 font-medium">Memuat konfigurasi sistem...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-natural-border shadow-sm">
        <div className="space-y-1">
          <h1 className="text-2xl font-serif italic text-natural-primary font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {t('settings')}
          </h1>
          <p className="text-sm text-slate-500 font-sans max-w-2xl leading-relaxed">
            {t('settingDescription')}
          </p>
        </div>
      </div>

      {toastMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm font-semibold"
        >
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <span>{toastMessage}</span>
        </motion.div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT AREA: Institution Settings & Currency */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Box 1: Identitas Lembaga */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-natural-border shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-md font-serif italic text-slate-900 font-bold">Identitas Lembaga & Sistem</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Branding Configuration</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('systemName')}</label>
                  <input
                    type="text"
                    required
                    value={systemName}
                    onChange={(e) => setSystemName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all font-semibold"
                    placeholder="Contoh: SIDANI Cendekia Baznas"
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('systemSlogan')}</label>
                  <input
                    type="text"
                    required
                    value={systemSubName}
                    onChange={(e) => setSystemSubName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-slate-600"
                    placeholder="Contoh: Sistem Informasi Akuntansi Nirlaba Sekolah"
                  />
                </div>
              </div>
            </div>

            {/* Box 2: Mata Uang & Bahasa */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-natural-border shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-md font-serif italic text-slate-900 font-bold">Mata Uang & Bahasa Akuntansi</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Currency & Locale Core Settings</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Language Selection */}
                <div className="space-y-3 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('language')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'id', name: 'Bahasa (ID)' },
                      { id: 'en', name: 'English (EN)' },
                      { id: 'ar', name: 'العربية (AR)' }
                    ].map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => setLanguage(lang.id as any)}
                        className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          language === lang.id
                            ? 'bg-natural-primary text-white border-transparent'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {lang.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 italic font-sans leading-relaxed">
                    Sistem akan otomatis menyesuaikan visual, keterangan label, arah bacaan (LTR/RTL) serta terjemahan seluruh navigasi.
                  </p>
                </div>

                {/* Currency Selection */}
                <div className="space-y-3 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('currency')}</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full px-4 py-2.5 text-sm border border-slate-200 bg-white rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer font-bold text-slate-800"
                  >
                    <option value="IDR">IDR - Rupiah Indonesia (Rp)</option>
                    <option value="USD">USD - United States Dollar ($)</option>
                    <option value="EUR">EUR - Euro (€)</option>
                    <option value="SGD">SGD - Singapore Dollar (S$)</option>
                    <option value="GBP">GBP - British Pound (£)</option>
                    <option value="JPY">JPY - Japanese Yen (¥)</option>
                  </select>
                  
                  {/* Live Currency format simulation */}
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl flex flex-col justify-center text-left">
                    <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest mb-1 block">Ilustrasi Format Saldo (Live Preview)</span>
                    <span className="font-mono text-sm font-bold text-emerald-700">
                      {currency === 'IDR' && 'Rp1.750.000'}
                      {currency === 'USD' && '$1,750'}
                      {currency === 'EUR' && '€1,750'}
                      {currency === 'SGD' && 'S$1,750'}
                      {currency === 'GBP' && '£1,750'}
                      {currency === 'JPY' && '¥1,750'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Box 3: Font Families */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-natural-border shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-650 flex items-center justify-center shrink-0">
                  <Type className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-md font-serif italic text-slate-900 font-bold">Desain Huruf & Tipografi (Typography)</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Dynamic Font Family Customizer</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Font Family selection */}
                <div className="space-y-3 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('fontFamily')}</label>
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                    {fontsList.map((f) => (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() => setFontFamily(f.name as any)}
                        className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          fontFamily === f.name
                            ? 'bg-slate-50 border-natural-primary text-slate-900 shadow-sm'
                            : 'bg-white border-slate-150 text-slate-650 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className={`${f.className} text-xs font-bold`}>{f.name}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">{f.description}</span>
                        </div>
                        {fontFamily === f.name && (
                          <div className="w-5 h-5 rounded-full bg-natural-primary text-white flex items-center justify-center p-0.5">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font size picker */}
                <div className="space-y-4 text-left">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">{t('fontSize')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'sm', name: 'Ringkas (Kecil)', desc: '90%' },
                      { id: 'base', name: 'Normal', desc: '100%' },
                      { id: 'lg', name: 'Besar (Legible)', desc: '105%' }
                    ].map((size) => (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => setFontSize(size.id as any)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                          fontSize === size.id
                            ? 'bg-natural-primary text-white border-transparent'
                            : 'bg-white border-slate-150 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-xs font-bold">{size.name}</span>
                        <span className="text-[10px] opacity-60 mt-0.5">{size.desc}</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* Tipografi preview box */}
                  <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2 mt-4 text-left">
                    <span className="text-[9px] uppercase text-slate-400 font-bold tracking-widest block flex items-center gap-1">
                      <Eye className="w-3 h-3" /> Simulasi Membaca Jurnal
                    </span>
                    <p className="text-xs text-slate-500 font-sans leading-relaxed">
                      "PIC: <span className="font-bold text-slate-700">Abdul Rahman</span> mencatat pembayaran beban sewa asrama sebesar IDR 4.500.000 dengan referensi JUr-2026."
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* RIGHT AREA: App Themes, Logos & Invoice styles */}
          <div className="space-y-8">
            
            {/* Box 4: Custom logo */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-natural-border shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-md font-serif italic text-slate-900 font-bold">Logo & Ikon Kustom</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Institutional Branding Logo</p>
                </div>
              </div>

              {/* Logo Select buttons */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block text-left">Pilih Bentuk Logo Aplikasi</label>
                <div className="grid grid-cols-2 gap-2">
                  {logoPresets.map((preset) => {
                    const PresetIcon = preset.icon;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setLogoType(preset.id as any)}
                        className={`p-3 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                          logoType === preset.id
                            ? 'bg-natural-primary text-white border-transparent shadow-sm'
                            : 'bg-white border-slate-150 text-slate-750 hover:bg-slate-50'
                        }`}
                      >
                        <PresetIcon className="w-5 h-5 mb-1.5" />
                        <span className="text-[10px] font-bold leading-normal">{preset.name}</span>
                      </button>
                    );
                  })}
                </div>

                {logoType === 'custom' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-3 mt-4 text-left"
                  >
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block">Unggah Berkas Logo Sekolah</label>
                    
                    {/* File Dropzone area */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative border-2 border-dashed rounded-2xl p-6 transition-all text-center flex flex-col items-center justify-center cursor-pointer ${
                        isDragging
                          ? 'border-emerald-500 bg-emerald-50/55 scale-[1.01]'
                          : customLogoUrl
                          ? 'border-slate-200 bg-slate-50/20 hover:bg-slate-50/40'
                          : 'border-slate-200 hover:border-slate-350 bg-white hover:bg-slate-50/20'
                      }`}
                      onClick={() => document.getElementById('school-logo-file')?.click()}
                    >
                      <input
                        type="file"
                        id="school-logo-file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleLogoFile(e.target.files[0]);
                          }
                        }}
                      />

                      {customLogoUrl ? (
                        <div className="flex flex-col items-center space-y-2.5">
                          <div className="relative group">
                            <img
                              src={customLogoUrl}
                              alt="Pratinjau Logo"
                              className="w-20 h-20 object-contain bg-white p-2.5 rounded-2xl border border-slate-250 shadow-sm"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Format+Salah';
                              }}
                              referrerPolicy="no-referrer"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCustomLogoUrl('');
                              }}
                              className="absolute -top-1.5 -right-1.5 p-1 bg-rose-600 text-white rounded-full hover:bg-rose-700 shadow-sm transition-transform hover:scale-110 cursor-pointer"
                              title="Hapus Logo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div>
                            <p className="text-[11px] font-bold text-slate-700 text-center">Logo Sekolah Siap Disimpan</p>
                            <p className="text-[9px] text-emerald-600 font-semibold tracking-wide text-center">Teroptimasi & Kompak (PNG Transparan)</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 py-2">
                          <div className="w-10 h-10 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-450 mx-auto hover:scale-105 transition-all">
                            <Upload className="w-5 h-5 text-slate-550" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-700">Tarik & Lepas file logo di sini, atau klik untuk memilih</p>
                            <p className="text-[10px] text-slate-400 mt-1">Mendukung format PNG, JPG, JPEG atau SVG (Maks. 5MB)</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {uploadError && (
                      <p className="text-xs text-rose-600 font-medium bg-rose-50 border border-rose-100 px-3.5 py-2 rounded-xl mt-1.5">
                        {uploadError}
                      </p>
                    )}

                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      * Logo yang diunggah akan otomatis dipotong, disesuaikan resolusinya agar hemat bandwidth, dan ditayangkan pada navigasi serta templat cetakan faktur/kwitansi.
                    </p>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Box 5: Themes */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-natural-border shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-md font-serif italic text-slate-900 font-bold">Gaya & Tema Warna Aplikasi</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Interactive Palette Schemes</p>
                </div>
              </div>

              {/* Theme circles */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block text-left">{t('colorTheme')}</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {themeOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setColorTheme(opt.id as any)}
                      className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                        colorTheme === opt.id
                          ? 'border-slate-350 bg-slate-50/50 text-slate-900 shadow-sm font-bold'
                          : 'bg-white border-slate-150 text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full ${opt.bg} inline-block shrink-0 border border-slate-100 flex items-center justify-center`}>
                        {colorTheme === opt.id && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="text-xs truncate">{opt.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Box 6: Invoices Designs */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-natural-border shadow-sm space-y-6">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-md font-serif italic text-slate-900 font-bold">Templat Cetak Faktur (Invoice)</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Invoice Output Customizer</p>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block text-left">{t('activeTemplate')}</label>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: 'modern', name: 'Layout Kertas Modern (Emerald & White)', desc: 'Desain bersih dengan background modern, logo, dan tandatangan digital terorganisir.' },
                    { id: 'classic', name: 'Format Klasik (Struk Kasir Tradisional)', desc: 'Format monokrom kompak sederhana untuk penghematan tinta cetak lokal.' },
                    { id: 'minimalist', name: 'Desain Minimalis Elegan', desc: 'Sangat rapi, menggunakan garis tipis abu-abu, proporsional bagi pelaporan donator.' }
                  ].map((temp) => (
                    <button
                      key={temp.id}
                      type="button"
                      onClick={() => setInvoiceTemplate(temp.id as any)}
                      className={`p-3 rounded-xl border flex flex-col transition-all text-left cursor-pointer ${
                        invoiceTemplate === temp.id
                          ? 'border-natural-primary bg-slate-50/50 text-slate-900 font-bold shadow-sm'
                          : 'bg-white border-slate-150 text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">{temp.name}</span>
                        {invoiceTemplate === temp.id && (
                          <span className="px-1.5 py-0.5 bg-natural-primary text-white text-[8px] font-bold rounded uppercase tracking-wider">Aktif</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1 font-normal leading-relaxed">{temp.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>

        {/* BOTTOM SAVE BUTTON */}
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-slate-500 max-w-lg leading-relaxed text-left">
            Menyimpan akan menerapkan perubahan branding, mata uang digital, ukuran font, dan tata bahasa di seluruh aplikasi secara permanen pada server database.
          </p>
          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-650 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 hover:brightness-110 disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: 'var(--color-natural-primary)' }}
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{t('saveSettings')}</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* DATABASE MAINTENANCE SYSTEM */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-natural-border shadow-sm space-y-8 mt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-105 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="text-lg font-serif italic text-slate-900 font-bold">Pemeliharaan & Manajemen Database</h3>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">Backup, Recovery & Data Archiving Utilities</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadDatabaseStats}
            className="text-xs bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-xl border border-slate-200 transition-all flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isStatsLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan Statistik</span>
          </button>
        </div>

        {/* Success / Error Banners */}
        {dbSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-semibold text-left"
          >
            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <Check className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold">Transaksi database Berhasil!</p>
              <p className="text-[10px] text-emerald-700 font-normal mt-0.5">{dbSuccess}</p>
            </div>
            <button onClick={() => setDbSuccess('')} className="ml-auto text-emerald-500 hover:text-emerald-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {dbError && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-rose-50 border border-rose-150 rounded-2xl flex items-center gap-3 text-rose-850 text-xs font-semibold text-left"
          >
            <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <p className="font-bold">Gagal menjalankan aksi database!</p>
              <p className="text-[10px] text-rose-700 font-normal mt-0.5">{dbError}</p>
            </div>
            <button onClick={() => setDbError('')} className="ml-auto text-rose-500 hover:text-rose-700 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* DATABASE STATISTICS GRID */}
        <div className="space-y-3.5">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest text-left">Struktur & Isi Koleksi Aktif</h4>
          {isStatsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center h-20 animate-pulse">
                  <div className="w-4 h-4 bg-slate-200 rounded-full mb-2"></div>
                  <div className="w-12 h-3 bg-slate-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-left">
              <div className="bg-slate-50/50 hover:bg-slate-50 p-4 border border-slate-150 rounded-2xl transition-all">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Daftar Akun (COA)</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-black text-slate-800">{dbStats.accounts}</span>
                  <span className="text-[10px] text-slate-400">klasifikasi</span>
                </div>
              </div>
              <div className="bg-slate-50/50 hover:bg-slate-50 p-4 border border-slate-150 rounded-2xl transition-all">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Jurnal Umum</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-black text-emerald-800">{dbStats.journals}</span>
                  <span className="text-[10px] text-slate-400">transaksi</span>
                </div>
              </div>
              <div className="bg-slate-50/50 hover:bg-slate-50 p-4 border border-slate-150 rounded-2xl transition-all">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Faktur Penerimaan</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-black text-blue-800">{dbStats.invoices}</span>
                  <span className="text-[10px] text-slate-400">tagihan</span>
                </div>
              </div>
              <div className="bg-slate-50/50 hover:bg-slate-50 p-4 border border-slate-150 rounded-2xl transition-all">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Hutang & Piutang</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-black text-orange-850">{dbStats.debts}</span>
                  <span className="text-[10px] text-slate-400">pencatatan</span>
                </div>
              </div>
              <div className="bg-slate-50/50 hover:bg-slate-50 p-4 border border-slate-150 rounded-2xl transition-all">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Aset Tetap</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-black text-indigo-850">{dbStats.fixedAssets}</span>
                  <span className="text-[10px] text-slate-400">inventaris</span>
                </div>
              </div>
              <div className="bg-slate-50/50 hover:bg-slate-50 p-4 border border-slate-150 rounded-2xl transition-all">
                <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 block mb-1">Tempat Sampah</span>
                <div className="flex items-baseline gap-1">
                  <span className="font-mono text-xl font-black text-purple-800">{dbStats.trash}</span>
                  <span className="text-[10px] text-slate-400">record</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ACTIONS TABS PANEL */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pt-4">
          
          {/* COLUMN 1: EXPORT SYSTEM (BACKUP) */}
          <div className="bg-slate-50/40 p-5 rounded-2xl border border-slate-150 flex flex-col justify-between text-left">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-emerald-650" />
                <h4 className="text-sm font-bold text-slate-800">1. Ekspor & Backup Data</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Unduh salinan cadangan digital utuh seluruh database keuangan nirlaba (COA, jurnal, faktur, piutang, dan trash) ke dalam file tunggal berformat <span className="font-medium font-mono text-[10px] bg-slate-100 px-1 py-0.5 rounded text-indigo-700">.json</span>.
              </p>
              <ul className="text-[10px] text-slate-400 space-y-1 list-disc list-inside">
                <li>Kompatibel dengan semua sistem restore</li>
                <li>Mencakup seluruh isi 6 koleksi utama</li>
                <li>Dapat disimpan sebagai arsip offline</li>
              </ul>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-150">
              <button
                type="button"
                onClick={handleExportBackup}
                disabled={isExporting}
                className="w-full py-3 bg-emerald-650 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: 'var(--color-natural-primary)' }}
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Mengekspor...</span>
                  </>
                ) : (
                  <>
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>Cadangkan Data</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* COLUMN 2: IMPORT SYSTEM (RECOVERY) */}
          <div className="bg-indigo-50/20 p-5 rounded-2xl border border-indigo-100 flex flex-col justify-between text-left">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                <h4 className="text-sm font-bold text-indigo-950">2. Impor & Pulihkan (Restore)</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Unggah berkas cadangan <span className="font-mono text-[10px]">.json</span> yang pernah diekspor sebelumnya untuk mengembalikan kondisi keuangan sekolah seketika.
              </p>

              {/* File picker */}
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json"
                  onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`w-full py-2 px-3 border border-dashed rounded-xl text-center text-xs transition-all flex flex-col items-center justify-center cursor-pointer ${
                    restoreFile 
                      ? 'border-indigo-400 bg-indigo-50/50 text-indigo-950 font-semibold' 
                      : 'border-slate-250 bg-white hover:bg-slate-50/60 text-slate-600'
                  }`}
                >
                  {restoreFile ? (
                    <>
                      <span className="text-indigo-750 max-w-full truncate block px-2">📁 {restoreFile.name}</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">({(restoreFile.size / 1024).toFixed(1)} KB) - Klik Ganti</span>
                    </>
                  ) : (
                    <>
                      <span className="font-bold">Pilih Berkas JSON Backup</span>
                      <span className="text-[9px] text-slate-400 mt-0.5">Atau klik untuk menelusuri folder</span>
                    </>
                  )}
                </button>
              </div>

              {/* Mode Selector */}
              {restoreFile && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: 'auto' }} 
                  className="space-y-2 pt-1.5"
                >
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block font-mono">Metode Pengunggahan</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRestoreMode('merge')}
                      className={`py-1.5 px-2 text-[10px] font-bold border rounded-lg transition-all text-center cursor-pointer ${
                        restoreMode === 'merge'
                          ? 'bg-indigo-600 text-white border-transparent'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      Gabung (Merge)
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestoreMode('overwrite')}
                      className={`py-1.5 px-2 text-[10px] font-bold border rounded-lg transition-all text-center cursor-pointer ${
                        restoreMode === 'overwrite'
                          ? 'bg-amber-605 bg-amber-600 text-white border-transparent'
                          : 'bg-white border-slate-200 text-slate-650 hover:bg-slate-50'
                      }`}
                    >
                      Timpa (Overwrite)
                    </button>
                  </div>

                  {restoreMode === 'overwrite' ? (
                    <div className="space-y-1.5 bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                      <p className="text-[9px] leading-relaxed text-amber-850">
                        <strong>⚠️ PERINGATAN TIMPA:</strong> Mode ini akan <strong>menghapus total</strong> seluruh database berjalan lalu menuang 100% data dari file.
                      </p>
                      <input
                        type="text"
                        value={restoreConfirmText}
                        onChange={(e) => setRestoreConfirmText(e.target.value)}
                        placeholder="Ketik PULIHKAN jika setuju"
                        className="w-full px-2 py-1 text-[10px] border border-amber-200 rounded-md focus:ring-1 focus:ring-amber-500 outline-none text-center font-bold bg-white text-amber-950 uppercase"
                      />
                    </div>
                  ) : (
                    <p className="text-[9px] text-slate-400 italic">
                      * Mode Gabung hanya menambahkan transaksi baru berdasarkan keunikan ID dan tidak menghapus data aktif apa pun.
                    </p>
                  )}
                </motion.div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-150">
              <button
                type="button"
                onClick={handleRestoreBackup}
                disabled={isImporting || !restoreFile || (restoreMode === 'overwrite' && restoreConfirmText.toUpperCase() !== 'PULIHKAN')}
                className="w-full py-3 bg-indigo-650 hover:brightness-110 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Memulihkan...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    <span>Mulai Pemulihan</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* COLUMN 3: SYSTEM RESET (START FRESH) */}
          <div className="bg-rose-50/20 p-5 rounded-2xl border border-rose-100 flex flex-col justify-between text-left">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Archive className="w-5 h-5 text-rose-600" />
                <h4 className="text-sm font-bold text-rose-950">3. Bersihkan & Buka Buku Baru</h4>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed font-sans">
                Mengarsipkan transaksi secara aman di tempat ekspor offline, lalu <strong>mengosongkan permanen</strong> seluruh jurnal umum, faktur, piutang, dan trash untuk memulai pembukuan dari angka nol kembali.
              </p>
              <div className="bg-rose-50 border border-rose-100 rounded-xl p-2.5">
                <p className="text-[10px] text-rose-900 leading-relaxed font-semibold">
                  🔑 Pengaruh Aksi Mulai Baru:
                </p>
                <ul className="text-[9px] text-rose-700 list-disc list-inside mt-1 space-y-0.5">
                  <li>Semua transaksi & jurnal dihapus</li>
                  <li>Sistem saldo kembali ke Rp 0</li>
                  <li>Klasifikasi Akun (COA) disetel ulang ke standarnya</li>
                </ul>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-rose-700 uppercase tracking-widest block font-mono">Menyetujui Penghapusan</label>
                <input
                  type="text"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Ketik RESET untuk mengonfirmasi"
                  className="w-full px-3 py-2 text-xs border border-rose-200 rounded-xl focus:ring-2 focus:ring-rose-500 outline-none text-center font-bold bg-white text-rose-900 uppercase"
                />
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-150">
              <button
                type="button"
                onClick={handleResetDatabase}
                disabled={isResetting || resetConfirmText.toUpperCase() !== 'RESET'}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isResetting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Membersihkan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Kosongkan & Mulai Ulang</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </div>

        <div className="bg-slate-50 p-4 rounded-2xl flex items-start gap-2.5 text-[10px] text-slate-400 capitalize-none leading-relaxed text-left">
          <Shield className="w-4 h-4 text-slate-450 shrink-0 mt-0.5" />
          <p>
            * Semua pemeliharaan dikerjakan secara aman pada sisi klien dan langsung diperbarui pada server Firestore. Pastikan Anda telah mengunduh backup secara berkala untuk berjaga-jaga dari kesalahan manusia (human error).
          </p>
        </div>
      </div>
    </div>
  );
}
