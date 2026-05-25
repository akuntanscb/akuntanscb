import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, Download, Filter, FileBarChart, Settings2, Sliders, ChevronUp, ChevronDown, Eye, EyeOff, X, Save, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { getFinancialReports } from '../services/reportService';
import { getAccounts, updateAccount } from '../services/accountService';
import { Account, AccountCategory } from '../types';
import { formatRupiah, cn } from '../lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper to convert modern oklch() color syntax to universally supported hsla() format
function oklchToHsl(oklchStr: string): string {
  const match = oklchStr.match(/oklch\(([^)]+)\)/);
  if (!match) return oklchStr;
  
  const content = match[1].trim();
  // Standardize delimiters by replacing "/" with " " and removing commas
  const cleanContent = content.replace(/\//g, ' ').replace(/,/g, ' ');
  const parts = cleanContent.split(/\s+/).filter(Boolean);
  
  if (parts.length < 3) return oklchStr;
  
  const lVal = parts[0];
  const cVal = parts[1];
  const hVal = parts[2];
  const aVal = parts[3] || '1';
  
  // Parse Lightness (L)
  let l = parseFloat(lVal);
  if (lVal.includes('%')) {
    l = parseFloat(lVal) / 100;
  }
  
  // Parse Chroma (C)
  let c = parseFloat(cVal);
  if (cVal.includes('%')) {
    c = parseFloat(cVal) / 100;
  }
  
  // Parse Hue (H)
  let h = parseFloat(hVal);
  if (hVal.includes('deg')) {
    h = parseFloat(hVal);
  } else if (hVal.includes('rad')) {
    h = (parseFloat(hVal) * 180) / Math.PI;
  } else if (hVal.includes('turn')) {
    h = parseFloat(hVal) * 360;
  }
  
  if (isNaN(l) || isNaN(c) || isNaN(h)) return 'rgba(255, 255, 255, 1)';
  
  // Convert OKLCH to approximate HSL:
  // Lightness translates almost directly (e.g. L = 0.9 -> 90%)
  const hslLightness = Math.round(l * 100);
  
  // Saturation can be approximated from Chroma.
  // Maximum Chroma in OKLCH is around 0.4 but typically around 0.1-0.2.
  // We scale it: Saturation = Math.min(100, Math.round(c * 250))
  const hslSaturation = Math.min(100, Math.round(c * 250));
  const hslHue = Math.round(h % 360);
  
  return `hsla(${hslHue}, ${hslSaturation}%, ${hslLightness}%, ${aVal})`;
}

export default function Reports() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'neraca' | 'aktivitas' | 'arusKas' | 'calk'>('neraca');

  // Layout Configuration states
  const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
  const [editorAccounts, setEditorAccounts] = useState<Account[]>([]);
  const [editorCategory, setEditorCategory] = useState<AccountCategory>('Aset');
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [layoutSuccessMsg, setLayoutSuccessMsg] = useState('');
  const [layoutErrorMsg, setLayoutErrorMsg] = useState('');

  // CALK Dynamic States
  const [calkKepalaSekolah, setCalkKepalaSekolah] = useState('');
  const [calkBendahara, setCalkBendahara] = useState('');
  const [calkCatatanTambahan, setCalkCatatanTambahan] = useState('');
  const [calkSuccessMsg, setCalkSuccessMsg] = useState('');

  useEffect(() => {
    fetchData();
    // Load CALK local persistence values
    setCalkKepalaSekolah(localStorage.getItem('calk_kepsek') || 'H. Kamaludin, M.Pd.');
    setCalkBendahara(localStorage.getItem('calk_bendahara') || 'Siti Aminah, S.E.');
    setCalkCatatanTambahan(localStorage.getItem('calk_catatan') || 
      `1. Sekolah Cendekia Baznas (SCB) mempersiapkan laporan keuangan sesuai dengan PSAK 45 / ISAK 35 tentang Pelaporan Keuangan Entitas Nir Laba.\n2. Sumber pendanaan utama sekolah bersumber dari penyaluran Dana ZIS (Zakat, Infak, Sedekah) yang dikelola oleh BAZNAS Pusat.\n3. Saldo Aset Neto Sekolah di akhir tahun berjalan menunjukkan rasio likuiditas yang sehat guna mendukung beasiswa penuh bagi seluruh santri dhuafa.`
    );
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const reports = await getFinancialReports();
    setData(reports);
    setLoading(false);
  };

  const handleSaveCalk = () => {
    localStorage.setItem('calk_kepsek', calkKepalaSekolah);
    localStorage.setItem('calk_bendahara', calkBendahara);
    localStorage.setItem('calk_catatan', calkCatatanTambahan);
    setCalkSuccessMsg('Catatan atas Laporan Keuangan (CALK) berhasil disimpan!');
    setTimeout(() => setCalkSuccessMsg(''), 3000);
  };

  const formatAccounting = (val: number) => {
    if (val < 0) {
      return `(${formatRupiah(Math.abs(val))})`;
    }
    return formatRupiah(val);
  };

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPDF = async () => {
    const element = document.getElementById('report-print-area');
    if (!element) return;
    
    setPdfLoading(true);
    // Introduce a short delay so React can toggle hidden elements before taking screen snapshot
    await new Promise((resolve) => setTimeout(resolve, 200));
    
    const stylesheetBackups: { node: HTMLElement; originalDisabled: boolean }[] = [];
    let tempStyleEl: HTMLStyleElement | null = null;
    
    try {
      // 1. Gather all CSS rules from existing stylesheets and convert oklch to hsla
      let combinedCss = '';
      for (const sheet of Array.from(document.styleSheets)) {
        const node = sheet.ownerNode as HTMLElement;
        if (!node) continue;
        
        let sheetCss = '';
        if (node instanceof HTMLStyleElement) {
          sheetCss = node.textContent || '';
        } else {
          try {
            const rules = Array.from(sheet.cssRules || sheet.rules);
            sheetCss = rules.map(rule => rule.cssText).join('\n');
          } catch (e) {
            console.warn("Could not read stylesheet rules. Falling back:", e);
          }
        }
        
        if (sheetCss) {
          combinedCss += sheetCss + '\n';
          stylesheetBackups.push({
            node,
            originalDisabled: (node as any).disabled || false
          });
          // Temporarily disable original stylesheets so html2canvas doesn't try to parse them
          (node as any).disabled = true;
        }
      }

      // 2. Perform the regex replacement to convert all oklch(...) occurrences inside CSS
      const replacedCss = combinedCss.replace(/oklch\(([^)]+)\)/g, (match) => {
        return oklchToHsl(match);
      });

      // 3. Inject the sanitized style sheet
      tempStyleEl = document.createElement('style');
      tempStyleEl.id = 'temp-pdf-style-sanitized';
      tempStyleEl.textContent = replacedCss;
      document.head.appendChild(tempStyleEl);

      // Temporarily remove borders and shadows for a pristine document feel
      const originalShadow = element.style.boxShadow;
      const originalBorder = element.style.border;
      const originalRadius = element.style.borderRadius;
      
      element.style.boxShadow = 'none';
      element.style.border = 'none';
      element.style.borderRadius = '0px';

      const canvas = await html2canvas(element, {
        scale: 2, // 2x scale for sharp text and beautiful graphics
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1200 // Lock width for desktop-style rendering columns
      });
      
      // Restore styles
      element.style.boxShadow = originalShadow;
      element.style.border = originalBorder;
      element.style.borderRadius = originalRadius;

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 12; // 12mm page margin
      const contentWidth = pdfWidth - (margin * 2); // 186mm
      const pageViewHeight = pdfHeight - (margin * 2); // 273mm
      
      const imgHeight = (canvas.height * contentWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = margin;
      
      // First page
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
      heightLeft -= pageViewHeight;
      
      // Multi-page layout
      while (heightLeft > 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
        heightLeft -= pageViewHeight;
      }
      
      let fileName = 'Laporan_Keuangan';
      if (activeTab === 'neraca') fileName = 'Laporan_Neraca';
      else if (activeTab === 'aktivitas') fileName = 'Laporan_Aktivitas';
      else if (activeTab === 'arusKas') fileName = 'Laporan_Arus_Kas';
      else if (activeTab === 'calk') fileName = 'Laporan_CALK';
      
      pdf.save(`${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error('Gagal merender PDF:', error);
    } finally {
      // 4. Always tear down the temporary style sheet and restore the original sheets
      if (tempStyleEl && tempStyleEl.parentNode) {
        tempStyleEl.parentNode.removeChild(tempStyleEl);
      }
      for (const backup of stylesheetBackups) {
        (backup.node as any).disabled = backup.originalDisabled;
      }
      setPdfLoading(false);
    }
  };

  const handleDownloadActiveReport = () => {
    if (!data) return;
    let title = '';
    let text = '=======================================\n';
    text += 'SEKOLAH CENDEKIA BAZNAS - LAPORAN KEUANGAN\n';
    text += `Tanggal: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}\n`;
    text += '=======================================\n\n';

    if (activeTab === 'neraca') {
      title = 'Laporan_Neraca';
      text += 'LAPORAN POSISI KEUANGAN (NERACA)\n\n';
      text += '*** ASET ***\n';
      data.neraca.aset.forEach((a: any) => {
        text += `${a.code} - ${a.name}: ${formatRupiah(a.balance)}\n`;
      });
      text += `TOTAL ASET: ${formatRupiah(data.neraca.totalAset)}\n\n`;
      text += '*** LIABILITAS ***\n';
      data.neraca.liabilitas.forEach((l: any) => {
        text += `${l.code} - ${l.name}: ${formatRupiah(l.balance)}\n`;
      });
      text += `TOTAL LIABILITAS: ${formatRupiah(data.neraca.totalLiabilitas)}\n\n`;
      text += '*** EKUITAS ***\n';
      data.neraca.ekuitas.forEach((e: any) => {
        text += `${e.code} - ${e.name}: ${formatRupiah(e.balance)}\n`;
      });
      text += `Surplus/Defisit Berjalan: ${formatRupiah(data.neraca.surplusDefisit)}\n`;
      text += `TOTAL EKUITAS: ${formatRupiah(data.neraca.totalEkuitas + data.neraca.surplusDefisit)}\n\n`;
      text += `TOTAL LIABILITAS & EKUITAS: ${formatRupiah(data.neraca.totalLiabilitas + data.neraca.totalEkuitas + data.neraca.surplusDefisit)}\n`;
    } else if (activeTab === 'aktivitas') {
      title = 'Laporan_Aktivitas';
      text += 'LAPORAN AKTIVITAS\n\n';
      text += '*** PENDAPATAN ***\n';
      data.aktivitas.pendapatan.forEach((p: any) => {
        text += `${p.name}: ${formatRupiah(p.balance)}\n`;
      });
      text += `TOTAL PENDAPATAN: ${formatRupiah(data.aktivitas.totalPendapatan)}\n\n`;
      text += '*** BEBAN ***\n';
      data.aktivitas.beban.forEach((b: any) => {
        text += `${b.name}: ${formatRupiah(b.balance)}\n`;
      });
      text += `TOTAL BEBAN: ${formatRupiah(data.aktivitas.totalBeban)}\n\n`;
      text += `SURPLUS/DEFISIT AKTIVITAS: ${formatRupiah(data.aktivitas.surplusDefisit)}\n`;
    } else if (activeTab === 'arusKas') {
      title = 'Laporan_Arus_Kas';
      text += 'LAPORAN ARUS KAS (DIRECT METHOD)\n\n';
      text += '1. ARUS KAS AKTIVITAS OPERASIONAL\n';
      text += `Penerimaan Siswa SPP: ${formatRupiah(data.arusKas.details.oprPenerimaanSiswa)}\n`;
      text += `Penerimaan Operasional Lainnya: ${formatRupiah(data.arusKas.details.oprPenerimaanLain)}\n`;
      text += `Total Penerimaan Opr: ${formatRupiah(data.arusKas.details.totalOprInflow)}\n`;
      text += `Pengeluaran Gaji & Beban Opr: ${formatRupiah(data.arusKas.details.oprPengeluaranBeban)}\n`;
      text += `Pengeluaran Operasional Lainnya: ${formatRupiah(data.arusKas.details.oprPengeluaranLain)}\n`;
      text += `Total Pengeluaran Opr: ${formatRupiah(data.arusKas.details.totalOprOutflow)}\n`;
      text += `Arus Kas Bersih Operasional: ${formatAccounting(data.arusKas.details.netOprCashFlow)}\n\n`;
      
      text += '2. ARUS KAS AKTIVITAS INVESTASI\n';
      text += `Penerimaan Divestasi/Aset: ${formatRupiah(data.arusKas.details.invPenerimaanAset)}\n`;
      text += `Pengeluaran Pembelian Aset/Renovasi: ${formatRupiah(data.arusKas.details.invPengeluaranAset)}\n`;
      text += `Arus Kas Bersih Investasi: ${formatAccounting(data.arusKas.details.netInvCashFlow)}\n\n`;

      text += '3. ARUS KAS AKTIVITAS PENDANAAN\n';
      text += `Penerimaan Pinjaman/Lainnya: ${formatRupiah(data.arusKas.details.penPenerimaanHutang)}\n`;
      text += `Pengeluaran Pelunasan Pinjaman: ${formatRupiah(data.arusKas.details.penPengeluaranHutang)}\n`;
      text += `Arus Kas Bersih Pendanaan: ${formatAccounting(data.arusKas.details.netPenCashFlow)}\n\n`;

      text += `KENAIKAN/(PENURUNAN) BERSIH KAS: ${formatAccounting(data.arusKas.details.netCashFlowChange)}\n`;
      text += `Saldo Awal Kas: ${formatRupiah(data.arusKas.details.totalSawalKas)}\n`;
      text += `Saldo Akhir Kas: ${formatRupiah(data.arusKas.details.totalSakhirKas)}\n`;
    } else {
      title = 'Laporan_CALK';
      text += 'CATATAN ATAS LAPORAN KEUANGAN (CALK)\n\n';
      text += 'BAB I. GAMBARAN UMUM ENTITAS\n';
      text += 'Sekolah Cendekia Baznas (SCB) beroperasi di Cibungbulang, Bogor.\n';
      text += `Kepala Sekolah: ${calkKepalaSekolah}\n`;
      text += `Bendahara: ${calkBendahara}\n\n`;
      text += 'BAB II. KEBIJAKAN AKUNTANSI SIGNIFIKAN\nKombinasi basis kas & akrual, mata uang rupiah.\n\n';
      text += 'BAB III. RINCIAN POS-POS LAPORAN KEUANGAN\n';
      text += `Total Aset: ${formatRupiah(data.neraca.totalAset)}\n`;
      text += `Surplus/Defisit Berjalan: ${formatRupiah(data.aktivitas.surplusDefisit)}\n\n`;
      text += 'BAB IV. KETERANGAN & CATATAN KHUSUS AKTIVITAS\n';
      text += calkCatatanTambahan + '\n';
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openLayoutEditor = async () => {
    try {
      const accounts = await getAccounts();
      
      // Initialize an order field if not present based on category/index
      const sortedAccs = [...accounts].sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 9999;
        const orderB = b.order !== undefined ? b.order : 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.code.localeCompare(b.code);
      });
      
      setEditorAccounts(sortedAccs);
      setIsLayoutEditorOpen(true);
    } catch (err) {
      console.error('Gagal mengambil daftar akun:', err);
    }
  };

  const moveAccount = (index: number, direction: 'up' | 'down') => {
    const categoryAccs = editorAccounts
      .filter(a => a.category === editorCategory)
      .sort((a, b) => {
        const oA = a.order !== undefined ? a.order : 9999;
        const oB = b.order !== undefined ? b.order : 9999;
        if (oA !== oB) return oA - oB;
        return a.code.localeCompare(b.code);
      });
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === categoryAccs.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    const item1 = categoryAccs[index];
    const item2 = categoryAccs[targetIndex];

    // Swap their orders
    const order1 = item1.order !== undefined ? item1.order : index * 10;
    const order2 = item2.order !== undefined ? item2.order : targetIndex * 10;
    
    // Set swapped orders
    item1.order = order2;
    item2.order = order1;

    // Resolve any tie-breaker
    if (item1.order === item2.order) {
      if (direction === 'up') {
        item1.order = order2 - 1;
      } else {
        item1.order = order2 + 1;
      }
    }

    // Map modifications back to editorAccounts
    const newEditorAccounts = editorAccounts.map(acc => {
      if (acc.id === item1.id) return { ...item1 };
      if (acc.id === item2.id) return { ...item2 };
      return acc;
    });

    // Make sure we have strict sequential order for all items in that category to avoid conflicts
    const categoryFilteredAndSorted = newEditorAccounts
      .filter(a => a.category === editorCategory)
      .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));
    
    // Re-assign integer sequential indexes scaled by 10 to leave space, just in case
    categoryFilteredAndSorted.forEach((acc, idx) => {
      acc.order = idx * 10;
    });

    const finalEditorAccounts = newEditorAccounts.map(acc => {
      const updated = categoryFilteredAndSorted.find(x => x.id === acc.id);
      return updated ? updated : acc;
    });

    setEditorAccounts(finalEditorAccounts);
  };

  const toggleVisibility = (accountId: string) => {
    const updated = editorAccounts.map(acc => {
      if (acc.id === accountId) {
        return { ...acc, hideOnReport: !acc.hideOnReport };
      }
      return acc;
    });
    setEditorAccounts(updated);
  };

  const saveLayout = async () => {
    setIsSavingLayout(true);
    setLayoutErrorMsg('');
    setLayoutSuccessMsg('');
    try {
      const promises = editorAccounts.map(acc => {
        const payload: { order: number; hideOnReport: boolean } = {
          order: acc.order !== undefined ? acc.order : 9999,
          hideOnReport: acc.hideOnReport === true
        };
        return updateAccount(acc.id, payload);
      });
      await Promise.all(promises);
      setLayoutSuccessMsg('Tata letak laporan keuangan berhasil disimpan!');
      await fetchData(); // Refresh report metrics
      setTimeout(() => {
        setIsLayoutEditorOpen(false);
        setLayoutSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setLayoutErrorMsg(err.message || 'Gagal menyimpan perubahan tata letak.');
    } finally {
      setIsSavingLayout(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full">Memuat Laporan...</div>;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white/40 p-1 rounded-2xl">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Laporan Keuangan</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Laporan otomatis berbasis posting jurnal</p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={openLayoutEditor}
            className="px-4 py-2.5 bg-white border border-natural-border hover:bg-natural-bg rounded-xl text-natural-primary hover:text-natural-primary/90 transition-all font-semibold text-xs flex items-center gap-2 shadow-sm cursor-pointer select-none"
          >
            <Sliders className="w-4 h-4 text-natural-primary" />
            Atur Tata Letak
          </button>
          <button 
            onClick={() => window.print()}
            className="p-3 bg-white border border-natural-border hover:bg-natural-bg rounded-xl text-slate-700 hover:text-indigo-600 transition-all shadow-sm cursor-pointer"
            title="Cetak Laporan Keuangan"
          >
            <Printer className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDownloadActiveReport}
            className="p-3 bg-white border border-natural-border hover:bg-natural-bg rounded-xl text-slate-700 hover:text-indigo-600 transition-all shadow-sm cursor-pointer"
            title="Unduh Laporan Aktif sebagai Text"
          >
            <Download className="w-5 h-5" />
          </button>
          <button 
            onClick={handleDownloadPDF}
            disabled={pdfLoading}
            className={cn(
              "px-4 py-2.5 rounded-xl transition-all font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer select-none border border-transparent",
              pdfLoading 
                ? "bg-slate-100 text-slate-450 cursor-not-allowed" 
                : "bg-red-650 hover:bg-red-700 text-white bg-red-600"
            )}
            title="Unduh Laporan Aktif Berformat PDF"
          >
            {pdfLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <span>Memproses PDF...</span>
              </>
            ) : (
              <>
                <span className="bg-white/20 p-0.5 rounded text-[10px] font-extrabold uppercase tracking-tight px-1 mr-0.5">PDF</span>
                <span>Unduh PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="flex border-b border-natural-border overflow-x-auto whitespace-nowrap scrollbar-none">
        <button 
          onClick={() => setActiveTab('neraca')}
          className={cn(
            "px-6 sm:px-8 py-4 font-semibold text-xs sm:text-sm transition-all relative cursor-pointer select-none shrink-0",
            activeTab === 'neraca' ? "text-natural-primary font-bold" : "text-gray-400 hover:text-slate-600"
          )}
        >
          Laporan Neraca
          {activeTab === 'neraca' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('aktivitas')}
          className={cn(
            "px-6 sm:px-8 py-4 font-semibold text-xs sm:text-sm transition-all relative cursor-pointer select-none shrink-0",
            activeTab === 'aktivitas' ? "text-natural-primary font-bold" : "text-gray-400 hover:text-slate-600"
          )}
        >
          Laporan Aktivitas
          {activeTab === 'aktivitas' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('arusKas')}
          className={cn(
            "px-6 sm:px-8 py-4 font-semibold text-xs sm:text-sm transition-all relative cursor-pointer select-none shrink-0",
            activeTab === 'arusKas' ? "text-natural-primary font-bold" : "text-gray-400 hover:text-slate-600"
          )}
        >
          Laporan Arus Kas
          {activeTab === 'arusKas' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('calk')}
          className={cn(
            "px-6 sm:px-8 py-4 font-semibold text-xs sm:text-sm transition-all relative cursor-pointer select-none shrink-0",
            activeTab === 'calk' ? "text-natural-primary font-bold" : "text-gray-400 hover:text-slate-600"
          )}
        >
          Catatan Atas Laporan Keuangan (CALK)
          {activeTab === 'calk' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
        </button>
      </div>

      <div id="report-print-area" className="bg-white rounded-[2rem] border border-natural-border shadow-sm p-12 print:p-0 print:border-none print:shadow-none">
        <div className="text-center mb-16 space-y-2">
          <h2 className="text-2xl font-serif text-natural-primary uppercase tracking-tight">Sekolah Cendekia Baznas</h2>
          <p className="text-gray-400 uppercase tracking-[0.2em] text-xs font-bold">
            {activeTab === 'neraca' 
              ? 'LAPORAN POSISI KEUANGAN (NERACA)' 
              : activeTab === 'aktivitas' 
              ? 'LAPORAN AKTIVITAS' 
              : activeTab === 'arusKas'
              ? 'LAPORAN ARUS KAS (DIRECT METHOD)'
              : 'CATATAN ATAS LAPORAN KEUANGAN (CALK)'}
          </p>
          <div className="w-12 h-1 bg-natural-primary/20 mx-auto rounded-full mt-4" />
          <p className="text-gray-400 text-[11px] font-medium pt-2 uppercase">Per {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
        </div>

        {activeTab === 'neraca' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="font-bold text-slate-800 border-b pb-2 text-left">ASET</h3>
              {data.neraca.aset.map((a: any) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span>{a.code} - {a.name}</span>
                  <span className="font-mono">{formatRupiah(a.balance)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t-2 pt-2 font-bold text-slate-900">
                <span>TOTAL ASET</span>
                <span className="font-mono">{formatRupiah(data.neraca.totalAset)}</span>
              </div>
            </div>

            <div className="space-y-12">
              <div className="space-y-6">
                <h3 className="font-bold text-slate-800 border-b pb-2 text-left">LIABILITAS</h3>
                {data.neraca.liabilitas.map((l: any) => (
                  <div key={l.id} className="flex justify-between text-sm">
                    <span>{l.code} - {l.name}</span>
                    <span className="font-mono">{formatRupiah(l.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total Liabilitas</span>
                  <span className="font-mono">{formatRupiah(data.neraca.totalLiabilitas)}</span>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="font-bold text-slate-800 border-b pb-2 text-left">EKUITAS (ASET NETO)</h3>
                {data.neraca.ekuitas.map((e: any) => (
                  <div key={e.id} className="flex justify-between text-sm flex-row">
                    <span>{e.code} - {e.name}</span>
                    <span className="font-mono">{formatRupiah(e.balance)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm italic">
                  <span>Surplus (Defisit) Semester Berjalan</span>
                  <span className="font-mono">{formatRupiah(data.neraca.surplusDefisit)}</span>
                </div>
                <div className="flex justify-between border-t pt-2 font-bold">
                  <span>Total Ekuitas</span>
                  <span className="font-mono">{formatRupiah(data.neraca.totalEkuitas + data.neraca.surplusDefisit)}</span>
                </div>
              </div>

              <div className="flex justify-between border-t-2 pt-2 font-bold text-slate-900 bg-slate-50 p-2 rounded">
                <span>TOTAL LIABILITAS & EKUITAS</span>
                <span className="font-mono">{formatRupiah(data.neraca.totalLiabilitas + data.neraca.totalEkuitas + data.neraca.surplusDefisit)}</span>
              </div>
            </div>
          </div>
        ) : activeTab === 'aktivitas' ? (
          <div className="max-w-2xl mx-auto space-y-8">
             <div className="space-y-4">
               <h3 className="font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded text-left">PENDAPATAN / PENERIMAAN</h3>
               {data.aktivitas.pendapatan.map((p: any) => (
                 <div key={p.id} className="flex justify-between px-4 text-sm">
                   <span>{p.name}</span>
                   <span className="font-mono">{formatRupiah(p.balance)}</span>
                 </div>
               ))}
               <div className="flex justify-between px-4 pt-2 border-t font-bold text-slate-900">
                 <span>TOTAL PENDAPATAN</span>
                 <span className="font-mono">{formatRupiah(data.aktivitas.totalPendapatan)}</span>
               </div>
             </div>

             <div className="space-y-4">
               <h3 className="font-bold text-rose-700 bg-rose-50 px-4 py-2 rounded text-left flex-row select-none">BEBAN PENGELUARAN</h3>
               {data.aktivitas.beban.map((b: any) => (
                 <div key={b.id} className="flex justify-between px-4 text-sm">
                   <span>{b.name}</span>
                   <span className="font-mono">{formatRupiah(b.balance)}</span>
                 </div>
               ))}
               <div className="flex justify-between px-4 pt-2 border-t font-bold text-slate-900">
                 <span>TOTAL BEBAN</span>
                 <span className="font-mono">{formatRupiah(data.aktivitas.totalBeban)}</span>
               </div>
             </div>

             <div className="flex justify-between px-4 py-4 bg-slate-900 text-white rounded-xl font-bold">
               <span>SURPLUS (DEFISIT) AKTIVITAS</span>
               <span className="font-mono uppercase">{formatRupiah(data.aktivitas.surplusDefisit)}</span>
             </div>
          </div>
        ) : activeTab === 'arusKas' ? (
          <div className="max-w-3xl mx-auto space-y-10 text-left">
            {/* Arus Kas Operasional */}
            <div className="space-y-4">
              <h3 className="font-bold text-indigo-900 bg-indigo-50 px-4 py-2.5 rounded-xl text-sm flex justify-between items-center shadow-sm">
                <span>I. ARUS KAS DARI AKTIVITAS OPERASIONAL</span>
                <span className="font-mono">{formatAccounting(data.arusKas.details.netOprCashFlow)}</span>
              </h3>
              <div className="px-4 space-y-3.5 text-sm">
                <div className="flex justify-between pl-4 text-slate-600">
                  <span>Penerimaan SPP & dana bulanan santri/siswa</span>
                  <span className="font-mono text-emerald-600 font-semibold">+{formatRupiah(data.arusKas.details.oprPenerimaanSiswa)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-600">
                  <span>Penerimaan dana ZIS & hibah operasional lainnya</span>
                  <span className="font-mono text-emerald-600 font-semibold">+{formatRupiah(data.arusKas.details.oprPenerimaanLain)}</span>
                </div>
                <div className="flex justify-between pl-4 font-semibold text-slate-700 border-b border-dashed pb-1.5 pt-0.5">
                  <span>Subtotal Arus Kas Masuk Operasional</span>
                  <span className="font-mono text-slate-800">{formatRupiah(data.arusKas.details.totalOprInflow)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-600">
                  <span>Pengeluaran gaji pengajar & beban operasional sekolah</span>
                  <span className="font-mono text-rose-600">-{formatRupiah(data.arusKas.details.oprPengeluaranBeban)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-600">
                  <span>Pembayaran penunjang operasional, ATK, & kepesantrenan</span>
                  <span className="font-mono text-rose-600">-{formatRupiah(data.arusKas.details.oprPengeluaranLain)}</span>
                </div>
                <div className="flex justify-between pl-4 font-semibold text-slate-700 border-b border-dashed pb-1.5 pt-0.5">
                  <span>Subtotal Arus Kas Keluar Operasional</span>
                  <span className="font-mono text-slate-800">({formatRupiah(data.arusKas.details.totalOprOutflow)})</span>
                </div>
                <div className="flex justify-between pl-4 font-bold text-indigo-700 bg-indigo-50/40 p-2.5 rounded-lg border border-indigo-100/40">
                  <span>Arus Kas Bersih Penyediaan dari Aktivitas Operasional</span>
                  <span className="font-mono">{formatAccounting(data.arusKas.details.netOprCashFlow)}</span>
                </div>
              </div>
            </div>

            {/* Arus Kas Investasi */}
            <div className="space-y-4">
              <h3 className="font-bold text-amber-900 bg-amber-50 px-4 py-2.5 rounded-xl text-sm flex justify-between items-center shadow-sm">
                <span>II. ARUS KAS DARI AKTIVITAS INVESTASI</span>
                <span className="font-mono">{formatAccounting(data.arusKas.details.netInvCashFlow)}</span>
              </h3>
              <div className="px-4 space-y-3.5 text-sm">
                <div className="flex justify-between pl-4 text-slate-600">
                  <span>Penerimaan dari divestasi/pelepasan aset sarana asrama</span>
                  <span className="font-mono text-emerald-600 font-semibold">+{formatRupiah(data.arusKas.details.invPenerimaanAset)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-600">
                  <span>Pengeluaran pengadaan alat lab, laptop komputer, & renovasi gedung</span>
                  <span className="font-mono text-rose-600">-{formatRupiah(data.arusKas.details.invPengeluaranAset)}</span>
                </div>
                <div className="flex justify-between pl-4 font-bold text-amber-700 bg-amber-50/40 p-2.5 rounded-lg border border-amber-100/40">
                  <span>Arus Kas Bersih Digunakan dalam Aktivitas Investasi</span>
                  <span className="font-mono">{formatAccounting(data.arusKas.details.netInvCashFlow)}</span>
                </div>
              </div>
            </div>

            {/* Arus Kas Pendanaan */}
            <div className="space-y-4">
              <h3 className="font-bold text-blue-900 bg-blue-50 px-4 py-2.5 rounded-xl text-sm flex justify-between items-center shadow-sm">
                <span>III. ARUS KAS DARI AKTIVITAS PENDANAAN / PEMBIAYAAN</span>
                <span className="font-mono">{formatAccounting(data.arusKas.details.netPenCashFlow)}</span>
              </h3>
              <div className="px-4 space-y-3.5 text-sm">
                <div className="flex justify-between pl-4 text-slate-600">
                  <span>Penerimaan dari dana pinjaman, kupon ZIS sukuk, & modal lembaga</span>
                  <span className="font-mono text-emerald-600 font-semibold">+{formatRupiah(data.arusKas.details.penPenerimaanHutang)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-600">
                  <span>Pembayaran hutang jangka panjang, pinjaman sarana, & komitmen</span>
                  <span className="font-mono text-rose-600">-{formatRupiah(data.arusKas.details.penPengeluaranHutang)}</span>
                </div>
                <div className="flex justify-between pl-4 font-bold text-blue-700 bg-blue-50/40 p-2.5 rounded-lg border border-blue-100/40">
                  <span>Arus Kas Bersih yang Terjadi dari Aktivitas Pendanaan</span>
                  <span className="font-mono">{formatAccounting(data.arusKas.details.netPenCashFlow)}</span>
                </div>
              </div>
            </div>

            {/* Rekonsiliasi Kas */}
            <div className="border-t-2 border-double border-slate-300 pt-8 space-y-4">
              <div className="flex justify-between font-bold text-base text-slate-900 bg-slate-100/80 px-4 py-3 rounded-xl border border-slate-200">
                <span>KENAIKAN / (PENURUNAN) BERSIH KAS & SETARA KAS</span>
                <span className="font-mono text-indigo-700">{formatAccounting(data.arusKas.details.netCashFlowChange)}</span>
              </div>
              <div className="px-4 space-y-3.5 text-sm">
                <div className="flex justify-between pl-4 text-slate-500 font-medium">
                  <span>Saldo Kas dan Setara Kas pada Awal Periode</span>
                  <span className="font-mono text-slate-700 font-bold">{formatRupiah(data.arusKas.details.totalSawalKas)}</span>
                </div>
                <div className="flex justify-between pl-4 text-slate-500 font-medium border-b pb-3.5 flex-row">
                  <span>Selisih Kurs & Kenaikan Kas Berjalan</span>
                  <span className="font-mono text-indigo-600 font-bold">{formatAccounting(data.arusKas.details.netCashFlowChange)}</span>
                </div>
                <div className="flex justify-between pl-4 font-bold text-base text-emerald-800 bg-emerald-50 px-5 py-4 rounded-xl border border-emerald-100 shadow-sm">
                  <span>SALDO KAS DAN SETARA KAS PADA AKHIR PERIODE (REKONSILIASI)</span>
                  <span className="font-mono text-emerald-700 text-lg font-bold">{formatRupiah(data.arusKas.details.totalSakhirKas)}</span>
                </div>
              </div>
            </div>

            {/* Rekonsiliasi Cash accounts table */}
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-natural-border space-y-3 mt-4 print:hidden">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 font-mono select-none">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" /> TABEL INDIKATOR AKUN REKONSILIATOR KAS (COA):
              </h4>
              <div className="divide-y divide-slate-100">
                {data.arusKas.cashAccounts.map((c: any) => (
                  <div key={c.id} className="flex justify-between items-center py-2 text-xs text-slate-600 font-sans">
                    <span className="font-medium">{c.code} - {c.name}</span>
                    <span className="font-mono font-bold text-slate-700 bg-white border border-slate-200/80 px-2 py-0.5 rounded-md">{formatRupiah(c.balance)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-12 text-left text-slate-800">
            {calkSuccessMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-2 shadow-sm font-sans"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{calkSuccessMsg}</span>
              </motion.div>
            )}

            {/* I. General Information */}
            <div className="space-y-4">
              <h3 className="font-serif italic font-bold text-indigo-900 border-b pb-2 text-base uppercase tracking-wider">
                BAB I. GAMBARAN UMUM ENTITAS
              </h3>
              <div className="text-sm leading-relaxed text-slate-650 space-y-3 font-sans">
                <p>
                  <strong>Sekolah Cendekia Baznas (SCB)</strong> merupakan model sekolah bebas biaya berasrama yang diinisiasi oleh Badan Amil Zakat Nasional (BAZNAS) untuk membina santri dari latar belakang mustahik/dhuafa berprestasi dari seluruh penjuru Indonesia. 
                </p>
                <p>
                  Sekolah beralamat lengkap di Jl. Terusan Babakan Madang, Desa Cemplang, Kecamatan Cibungbulang, Kabupaten Bogor, Jawa Barat. Laporan Keuangan ini disiapkan sebagai bentuk tata kelola pilar akuntabilitas publik yang transparan (<i>Aman Syar'i, Aman Regulasi, Aman NKRI</i>).
                </p>
                
                {/* School Administrative Editable Inputs */}
                {!pdfLoading && (
                  <div className="bg-slate-550/5 p-5 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 mt-2 print:border-none print:bg-transparent print:p-0">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Kepala Sekolah (SCB)</label>
                      <input 
                        type="text" 
                        value={calkKepalaSekolah}
                        onChange={(e) => setCalkKepalaSekolah(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-sans focus:outline-none focus:border-indigo-500 print:border-none print:px-0"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Bendahara / PJ Keuangan</label>
                      <input 
                        type="text" 
                        value={calkBendahara}
                        onChange={(e) => setCalkBendahara(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-sans focus:outline-none focus:border-indigo-500 print:border-none print:px-0"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* II. Accounting Policies */}
            <div className="space-y-4">
              <h3 className="font-serif italic font-bold text-indigo-900 border-b pb-2 text-base uppercase tracking-wider">
                BAB II. KEBIJAKAN AKUNTANSI SIGNIFIKAN
              </h3>
              <div className="text-sm leading-relaxed text-slate-650 space-y-3 font-sans">
                <div>
                  <span className="font-semibold text-slate-700 block text-xs uppercase tracking-wider mb-1">1. Basis Pengukuran Laporan Keuangan</span>
                  <p>
                    Laporan keuangan disusun berdasarkan kombinasi basis kas dan akrual dalam pencatatan transaksi pembukuan berpasangan. Pendapatan diakui pada saat kas diterima secara riil dari donasi/ZIS, sementara beban diakui saat timbulnya kewajiban atau realisasi pengeluaran kas operasional.
                  </p>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 block text-xs uppercase tracking-wider mb-1">2. Penyajian Laporan Sesuai Regulasi Sekolah</span>
                  <p>
                    Klasifikasi akun mengacu pada sistem bagan akun standar (COA) Sekolah Cendekia Baznas. Mata uang pelaporan yang digunakan adalah mata uang rupiah Republik Indonesia (IDR) secara utuh tanpa pembulatan jutaan untuk menjaga keakuratan detail pelaporan santri.
                  </p>
                </div>
              </div>
            </div>

            {/* III. Breakdown & Analysis */}
            <div className="space-y-4">
              <h3 className="font-serif italic font-bold text-indigo-900 border-b pb-2 text-base uppercase tracking-wider">
                BAB III. RINCIAN POS-POS LAPORAN KEUANGAN
              </h3>
              
              <div className="space-y-6 font-sans text-sm">
                {/* 1. Pos Aset */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-slate-800 bg-slate-50 p-2.5 rounded">
                    <span>1. ANALISIS POS ASET</span>
                    <span className="font-mono">{formatRupiah(data.neraca.totalAset)}</span>
                  </div>
                  <p className="text-xs text-slate-500 italic leading-relaxed">
                    Aset Sekolah Cendekia Baznas terdiri dari Kas, Bank, Piutang Operasional serta Peralatan/Aset Tetap Sekolah. Rincian nominal dan kontribusi masing-masing pos as follows:
                  </p>
                  <div className="divide-y divide-slate-100 pl-4">
                    {data.neraca.aset.map((a: any) => {
                      const pct = data.neraca.totalAset > 0 ? (a.balance / data.neraca.totalAset) * 100 : 0;
                      return (
                        <div key={a.id} className="flex justify-between py-2 text-xs">
                          <span className="text-slate-600 font-medium">{a.code} - {a.name}</span>
                          <span className="font-mono text-slate-500 font-semibold">
                            {formatRupiah(a.balance)} <span className="text-[10px] text-gray-400 ml-2 font-normal">({pct.toFixed(1)}%)</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Pos Pendapatan & Beban */}
                <div className="space-y-2">
                  <div className="flex justify-between font-bold text-slate-800 bg-slate-50 p-2.5 rounded">
                    <span>2. EVALUASI POS PENERIMAAN & BEBAN (AKTIVITAS)</span>
                    <span className="font-mono">{formatRupiah(data.aktivitas.surplusDefisit)} (Surplus)</span>
                  </div>
                  <p className="text-xs text-slate-500 italic leading-relaxed">
                    Total penerimaan periodik tercatat sebesar <b className="text-emerald-700 font-semibold font-sans">{formatRupiah(data.aktivitas.totalPendapatan)}</b> disalurkan secara efisien untuk mendukung biaya asrama serta pengajaran santri dengan total penyerapan beban sebesar <b className="text-rose-700 font-semibold font-sans">{formatRupiah(data.aktivitas.totalBeban)}</b>.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3">
                    <div className="space-y-1 bg-emerald-50/45 p-3.5 rounded-xl border border-emerald-100/60 text-left">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 select-none">Penerimaan Kontributor Tertinggi:</h4>
                      {data.aktivitas.pendapatan.length > 0 ? (
                        (() => {
                          const topInc = [...data.aktivitas.pendapatan].sort((a,b) => b.balance - a.balance)[0];
                          return (
                            <div className="text-xs font-medium text-slate-600 pt-1">
                              {topInc.name} sebesar <span className="font-bold font-mono text-emerald-700">{formatRupiah(topInc.balance)}</span>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-xs text-gray-400 italic pt-1">Belum ada pendapatan terekam</div>
                      )}
                    </div>

                    <div className="space-y-1 bg-rose-50/45 p-3.5 rounded-xl border border-rose-100/60 text-left">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-rose-800 select-none">Penyerapan Beban Terbesar:</h4>
                      {data.aktivitas.beban.length > 0 ? (
                        (() => {
                          const topExp = [...data.aktivitas.beban].sort((a,b) => b.balance - a.balance)[0];
                          return (
                            <div className="text-xs font-medium text-slate-600 pt-1">
                              {topExp.name} sebesar <span className="font-bold font-mono text-rose-700">{formatRupiah(topExp.balance)}</span>
                            </div>
                          );
                        })()
                      ) : (
                        <div className="text-xs text-gray-400 italic pt-1">Belum ada beban operasional terekam</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* IV. Narrative Comments Editor */}
            <div className="space-y-4">
              <h3 className="font-serif italic font-bold text-indigo-900 border-b pb-2 text-base uppercase tracking-wider flex justify-between items-center select-none">
                <span>BAB IV. KETERANGAN & CATATAN KHUSUS AKTIVITAS</span>
              </h3>
              <div className="text-sm font-sans space-y-3">
                {!pdfLoading && (
                  <p className="text-xs text-slate-500 leading-relaxed italic print:hidden">
                    Gunakan kolom editor di bawah ini untuk menambahkan narasi penjelas khusus (misalnya: rincian utang piutang santri, hambatan operasional, catatan hibah) yang akan langsung ikut terekam saat dokumen dicetak atau diprinter:
                  </p>
                )}
                
                {pdfLoading ? (
                  <div className="w-full text-xs font-sans text-slate-700 leading-relaxed whitespace-pre-wrap py-2 min-h-[120px]">
                    {calkCatatanTambahan}
                  </div>
                ) : (
                  <textarea 
                    rows={8}
                    value={calkCatatanTambahan}
                    onChange={(e) => setCalkCatatanTambahan(e.target.value)}
                    placeholder="Ketik catatan tambahan laporan di sini..."
                    className="w-full p-4 text-xs font-sans text-slate-700 bg-white border border-slate-300 rounded-2xl focus:outline-none focus:border-indigo-500 shadow-inner leading-relaxed print:border-none print:bg-transparent print:p-0 print:shadow-none"
                  />
                )}

                {!pdfLoading && (
                  <div className="flex justify-end pt-1 print:hidden">
                    <button
                      type="button"
                      onClick={handleSaveCalk}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-md flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> Simpan Narasi Catatan
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Administrative Signature Block */}
            <div className="pt-12 grid grid-cols-2 text-center text-sm font-sans">
              <div className="space-y-16">
                <div>
                  <p className="text-slate-400 font-medium">Disiapkan Oleh,</p>
                  <p className="text-slate-800 font-bold uppercase tracking-wider text-xs pt-1">PJ KEUANGAN SEKOLAH</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700 underline">{calkBendahara || '(Belum Diatur)'}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none font-semibold pt-1">Staf Keuangan SCB</p>
                </div>
              </div>
              
              <div className="space-y-16">
                <div>
                  <p className="text-slate-400 font-medium font-sans font-medium">Mengetahui & Menyetujui,</p>
                  <p className="text-slate-800 font-bold uppercase tracking-wider text-xs pt-1">KEPALA SEKOLAH SCB</p>
                </div>
                <div>
                  <p className="font-bold text-slate-700 underline">{calkKepalaSekolah || '(Belum Diatur)'}</p>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest leading-none font-semibold pt-1 font-sans">Pimpinan Lembaga</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Layout Editor Configurator Modal */}
      <AnimatePresence>
        {isLayoutEditorOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden text-slate-800"
            >
              {/* Header */}
              <div className="p-6 border-b border-natural-border bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-natural-primary/10 flex items-center justify-center text-natural-primary shrink-0">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif italic text-natural-primary font-semibold">Atur Tata Letak Laporan</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-sans">Atur susunan & visibilitas akun di laporan keuangan</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLayoutEditorOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Category Tabs */}
              <div className="flex border-b border-natural-border bg-slate-50/20 px-6 gap-2">
                {(['Aset', 'Liabilitas', 'Ekuitas', 'Pendapatan', 'Beban'] as AccountCategory[]).map(cat => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setEditorCategory(cat)}
                    className={cn(
                      "px-4 py-3 font-semibold text-xs transition-all border-b-2 uppercase tracking-wider relative",
                      editorCategory === cat ? "border-natural-primary text-natural-primary" : "border-transparent text-gray-400 hover:text-slate-600"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Body / List */}
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {layoutSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{layoutSuccessMsg}</span>
                  </div>
                )}
                {layoutErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{layoutErrorMsg}</span>
                  </div>
                )}

                <div className="space-y-2">
                  {editorAccounts
                    .filter(acc => acc.category === editorCategory)
                    .sort((a, b) => {
                      const oA = a.order !== undefined ? a.order : 9999;
                      const oB = b.order !== undefined ? b.order : 9999;
                      if (oA !== oB) return oA - oB;
                      return a.code.localeCompare(b.code);
                    })
                    .map((acc, index, filteredArr) => (
                      <div
                        key={acc.id}
                        className={cn(
                          "p-3.5 bg-white border rounded-2xl flex items-center justify-between transition-all hover:bg-slate-50 group",
                          acc.hideOnReport ? "border-slate-200/60 bg-slate-50/40 text-slate-400 opacity-75" : "border-natural-border shadow-sm text-slate-800"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-xs font-semibold px-2 py-1 bg-slate-100 rounded-md text-slate-500">
                            {acc.code}
                          </span>
                          <div className="text-left">
                            <p className="font-medium text-sm font-sans">{acc.name}</p>
                            <p className="text-[10px] text-gray-400 font-sans tracking-wide">
                              {acc.subCategory} {acc.hideOnReport ? '• Tersembunyi' : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {/* Reordering buttons */}
                          <button
                            type="button"
                            onClick={() => moveAccount(index, 'up')}
                            disabled={index === 0}
                            className={cn(
                              "p-1.5 rounded-lg border text-slate-500 hover:bg-white bg-slate-50 transition-colors shadow-sm",
                              index === 0 ? "opacity-30 cursor-not-allowed" : "hover:text-natural-primary"
                            )}
                            title="Pindahkan ke atas"
                          >
                            <ChevronUp className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveAccount(index, 'down')}
                            disabled={index === filteredArr.length - 1}
                            className={cn(
                              "p-1.5 rounded-lg border text-slate-500 hover:bg-white bg-slate-50 transition-colors shadow-sm",
                              index === filteredArr.length - 1 ? "opacity-30 cursor-not-allowed" : "hover:text-natural-primary"
                            )}
                            title="Pindahkan ke bawah"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>

                          {/* Visibility Toggle Button */}
                          <button
                            type="button"
                            onClick={() => toggleVisibility(acc.id)}
                            className={cn(
                              "p-1.5 rounded-lg border transition-colors shadow-sm",
                              acc.hideOnReport
                                ? "bg-rose-50 border-rose-200 text-rose-500 hover:bg-rose-100"
                                : "bg-emerald-50 border-emerald-110 text-emerald-600 hover:bg-emerald-100"
                            )}
                            title={acc.hideOnReport ? "Tampilkan kembali di laporan" : "Sembunyikan dari laporan"}
                          >
                            {acc.hideOnReport ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    ))}

                  {editorAccounts.filter(acc => acc.category === editorCategory).length === 0 && (
                    <div className="text-center py-12 text-slate-400 italic text-sm">
                      Belum ada daftar akun dalam kategori ini.
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-6 border-t border-natural-border bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <p className="text-[11px] text-slate-400 italic font-sans text-left">
                  Urutan dan visibilitas di atas akan langsung diterapkan pada Laporan Keuangan Neraca & Aktivitas.
                </p>
                <div className="flex gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsLayoutEditorOpen(false)}
                    disabled={isSavingLayout}
                    className="px-5 py-2 border border-natural-border rounded-full text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={saveLayout}
                    disabled={isSavingLayout}
                    className="px-6 py-2 bg-natural-primary hover:opacity-90 disabled:opacity-50 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all font-sans"
                  >
                    {isSavingLayout ? (
                      <>Menyimpan...</>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" /> Simpan Susunan
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
