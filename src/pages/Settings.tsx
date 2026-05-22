import React, { useState } from 'react';
import { useSettings } from '../context/SettingsContext';
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
  Eye
} from 'lucide-react';
import { formatRupiah } from '../lib/utils';

export default function Settings() {
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
    { id: 'custom', name: 'Logo Sekolah Kustom', icon: Link2 },
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
                    placeholder="Contoh: SIA Cendekia Baznas"
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
                    className="space-y-2 mt-4 text-left"
                  >
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-widest block">{t('customLogo')}</label>
                    <input
                      type="url"
                      value={customLogoUrl}
                      onChange={(e) => setCustomLogoUrl(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-205 rounded-xl mt-1 focus:ring-2 focus:ring-emerald-500 outline-none"
                      placeholder="https://instansi.sch.id/logo.png"
                    />
                    <p className="text-[10px] text-slate-400">Tempel URL tautan logo digital sekolah berformat PNG/JPG transparan.</p>

                    {/* Logo Preview directly */}
                    {customLogoUrl && (
                      <div className="mt-3 flex items-center gap-3 p-3 bg-slate-50 border border-slate-150 rounded-2xl justify-center">
                        <img 
                          src={customLogoUrl} 
                          alt="Pratinjau Logo" 
                          className="w-12 h-12 object-contain bg-white p-1 rounded-lg border shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Invalid';
                          }}
                          referrerPolicy="no-referrer"
                        />
                        <div className="text-left">
                          <p className="text-[10px] font-bold text-slate-700">Logo Teaser</p>
                          <p className="text-[9px] text-emerald-600 font-medium">Resolusi Terkonfigurasi</p>
                        </div>
                      </div>
                    )}
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
    </div>
  );
}
