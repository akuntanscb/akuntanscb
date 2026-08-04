import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  User, 
  CheckCircle, 
  ArrowUpDown, 
  History, 
  Edit2, 
  Trash2, 
  Coins, 
  Info,
  CalendarDays,
  X,
  PlusCircle,
  AlertCircle,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  Shield
} from 'lucide-react';
import { cn, formatRupiah } from '../lib/utils';
import { useUserRole } from '../context/UserRoleContext';
import { 
  getDebts, 
  createDebt, 
  addDebtPayment, 
  updateDebtDetails, 
  deleteDebt 
} from '../services/debtService';
import { getAccounts } from '../services/accountService';
import { DebtReceivable, DebtPayment, Account } from '../types';
import { auth } from '../lib/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Helper to convert modern oklch() color syntax to universally supported hsla() format
function oklchToHsl(oklchStr: string): string {
  const match = oklchStr.match(/oklch\(([^)]+)\)/);
  if (!match) return oklchStr;
  
  const content = match[1].trim();
  const cleanContent = content.replace(/\//g, ' ').replace(/,/g, ' ');
  const parts = cleanContent.split(/\s+/).filter(Boolean);
  
  if (parts.length < 3) return oklchStr;
  
  const lVal = parts[0];
  const cVal = parts[1];
  const hVal = parts[2];
  const aVal = parts[3] || '1';
  
  let l = parseFloat(lVal);
  if (lVal.includes('%')) {
    l = parseFloat(lVal) / 100;
  }
  
  let c = parseFloat(cVal);
  if (cVal.includes('%')) {
    c = parseFloat(cVal) / 100;
  }
  
  let h = parseFloat(hVal);
  if (hVal.includes('deg')) {
    h = parseFloat(hVal);
  } else if (hVal.includes('rad')) {
    h = (parseFloat(hVal) * 180) / Math.PI;
  } else if (hVal.includes('turn')) {
    h = parseFloat(hVal) * 360;
  }
  
  if (isNaN(l) || isNaN(c) || isNaN(h)) return 'rgba(255, 255, 255, 1)';
  
  const hslLightness = Math.round(l * 100);
  const hslSaturation = Math.min(100, Math.round(c * 250));
  const hslHue = Math.round(h % 360);
  
  return `hsla(${hslHue}, ${hslSaturation}%, ${hslLightness}%, ${aVal})`;
}

// Helper to convert modern oklab() color syntax to universally supported rgba() format
function oklabToRgb(oklabStr: string): string {
  const match = oklabStr.match(/oklab\(([^)]+)\)/);
  if (!match) return oklabStr;
  
  const content = match[1].trim();
  const cleanContent = content.replace(/\//g, ' ').replace(/,/g, ' ');
  const parts = cleanContent.split(/\s+/).filter(Boolean);
  
  if (parts.length < 3) return oklabStr;
  
  const lVal = parts[0];
  const aVal = parts[1];
  const bVal = parts[2];
  const alphaVal = parts[3] || '1';
  
  let L = parseFloat(lVal);
  if (lVal.includes('%')) {
    L = parseFloat(lVal) / 100;
  }
  
  let a = parseFloat(aVal);
  if (aVal.includes('%')) {
    a = parseFloat(aVal) / 100;
  }
  let b = parseFloat(bVal);
  if (bVal.includes('%')) {
    b = parseFloat(bVal) / 100;
  }
  
  if (isNaN(L) || isNaN(a) || isNaN(b)) return 'rgba(255, 255, 255, 1)';
  
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855414 * b;
  
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  
  let r_lin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  let g_lin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  let b_lin = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  
  const toSRGB = (x: number) => {
    if (x <= 0.0031308) {
      return Math.max(0, Math.min(255, Math.round(12.92 * x * 255)));
    }
    return Math.max(0, Math.min(255, Math.round((1.055 * Math.pow(x, 1 / 2.4) - 0.055) * 255)));
  };
  
  const r = toSRGB(r_lin);
  const g = toSRGB(g_lin);
  const blue = toSRGB(b_lin);
  
  return `rgba(${r}, ${g}, ${blue}, ${alphaVal})`;
}

// Global helper to replace all oklch() and oklab() style values with safe fallback strings
function sanitizeColorString(text: string): string {
  if (typeof text !== 'string') return text;
  
  let result = text;
  result = result.replace(/oklch\(([^)]+)\)/gi, (match) => oklchToHsl(match));
  result = result.replace(/oklab\(([^)]+)\)/gi, (match) => oklabToRgb(match));
  return result;
}

export default function HutangPiutang() {
  const { hasPermission, isUnitAllowed, userRole } = useUserRole();
  const isViewer = userRole?.role === 'viewer';

  if (!hasPermission('canDebt')) {
    return (
      <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md mx-auto my-12 shadow-sm font-sans">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-slate-500">Anda tidak memiliki hak istimewa (canDebt) untuk melihat atau mengelola Hutang & Piutang.</p>
      </div>
    );
  }

  const [debts, setDebts] = useState<DebtReceivable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'All' | 'Hutang' | 'Piutang'>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All'); // All, Lunas, Belum Lunas, Sebagian, Overdue
  const [unitFilter, setUnitFilter] = useState<'All' | 'SMP' | 'SMA' | 'Umum'>('All');
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'remaining-desc' | 'dueDate-asc'>('date-desc');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  
  // Download Modal states
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState<boolean>(false);
  const [downloadReportType, setDownloadReportType] = useState<'all' | 'piutang_aktif' | 'hutang_aktif'>('piutang_aktif');
  const [downloadPdfLoading, setDownloadPdfLoading] = useState<boolean>(false);
  
  // Selected items for operations
  const [selectedDebt, setSelectedDebt] = useState<DebtReceivable | null>(null);
  const [formError, setFormError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Form Fields for Add/Edit Debt
  const [formType, setFormType] = useState<'Hutang' | 'Piutang'>('Piutang');
  const [formName, setFormName] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [formTotal, setFormTotal] = useState<number>(0);
  const [formDownPayment, setFormDownPayment] = useState<number>(0);
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [editId, setEditId] = useState<string | null>(null);
  const [isUangMuka, setIsUangMuka] = useState<boolean>(false);
  const [picName, setPicName] = useState<string>('');
  const [formSchoolUnit, setFormSchoolUnit] = useState<'SMP' | 'SMA' | 'Umum'>('Umum');

  // Form Fields for Payment
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNotes, setPayNotes] = useState<string>('');
  const [cashAccounts, setCashAccounts] = useState<Account[]>([]);
  const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>('');
  const [formCashAccountId, setFormCashAccountId] = useState<string>('');

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDebts();
      setDebts(data);

      const accountsList = await getAccounts();
      const cashList = accountsList.filter(
        a => a.category === 'Aset' && 
        (a.subCategory.toLowerCase().includes('kas') || a.subCategory.toLowerCase().includes('bank'))
      );
      setCashAccounts(cashList);
      if (cashList.length > 0) {
        setSelectedCashAccountId(prev => prev || cashList[0].id);
        setFormCashAccountId(prev => prev || cashList[0].id);
      }
    } catch (err) {
      console.error("Gagal mengambil data hutang/piutang", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper date conversions
  const toJSDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
    return new Date();
  };

  // Dynamic Aging Calculation
  const getAgingDays = (txDate: any): number => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const date = toJSDate(txDate);
    date.setHours(0,0,0,0);
    const diffTime = today.getTime() - date.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  const getAgingLabelAndColor = (txDate: any, isPaid: boolean) => {
    if (isPaid) return { label: 'Lunas', color: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
    const days = getAgingDays(txDate);
    if (days <= 30) {
      return { label: `0 - 30 Hari (${days} hari)`, color: 'bg-emerald-50 text-emerald-800 border-emerald-100' };
    } else if (days <= 60) {
      return { label: `31 - 60 Hari (${days} hari)`, color: 'bg-amber-50 text-amber-800 border-amber-100' };
    } else if (days <= 90) {
      return { label: `61 - 90 Hari (${days} hari)`, color: 'bg-orange-50 text-orange-800 border-orange-100' };
    } else {
      return { label: `> 90 Hari (${days} hari)`, color: 'bg-rose-50 text-rose-800 border-rose-100 animate-pulse' };
    }
  };

  const isOverdue = (debt: DebtReceivable): boolean => {
    if (debt.status === 'Lunas') return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    const due = toJSDate(debt.dueDate);
    due.setHours(0,0,0,0);
    return today.getTime() > due.getTime();
  };

  // Calculations for Monitoring Dashboard
  const stats = React.useMemo(() => {
    let piutangTotal = 0;
    let piutangPaid = 0;
    let piutangRemaining = 0;
    let piutangOverdue = 0;
    
    let hutangTotal = 0;
    let hutangPaid = 0;
    let hutangRemaining = 0;
    let hutangOverdue = 0;

    let totalDp = 0;

    // Aging Buckets totals
    let aging0to30 = 0;
    let aging31to60 = 0;
    let aging61to90 = 0;
    let agingAbove90 = 0;

    const baseList = unitFilter === 'All' ? debts : debts.filter(d => (d.schoolUnit || 'Umum') === unitFilter);
    const targetedDebts = baseList.filter(d => isUnitAllowed(d.schoolUnit || 'Umum'));

    targetedDebts.forEach((d) => {
      const activePending = d.status !== 'Lunas';
      totalDp += d.downPayment || 0;

      if (d.type === 'Piutang') {
        piutangTotal += d.totalAmount;
        piutangPaid += d.downPayment + d.paidAmount;
        piutangRemaining += d.remainingBalance;
        if (isOverdue(d)) {
          piutangOverdue += d.remainingBalance;
        }
      } else {
        hutangTotal += d.totalAmount;
        hutangPaid += d.downPayment + d.paidAmount;
        hutangRemaining += d.remainingBalance;
        if (isOverdue(d)) {
          hutangOverdue += d.remainingBalance;
        }
      }

      if (activePending) {
        const days = getAgingDays(d.date);
        if (days <= 30) aging0to30 += d.remainingBalance;
        else if (days <= 60) aging31to60 += d.remainingBalance;
        else if (days <= 90) aging61to90 += d.remainingBalance;
        else agingAbove90 += d.remainingBalance;
      }
    });

    return {
      piutangTotal,
      piutangPaid,
      piutangRemaining,
      piutangOverdue,
      hutangTotal,
      hutangPaid,
      hutangRemaining,
      hutangOverdue,
      totalDp,
      aging0to30,
      aging31to60,
      aging61to90,
      agingAbove90
    };
  }, [debts, unitFilter]);

  // Handle Save (Add/Edit)
  const handleSaveDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('Nama debitur/kreditur wajib diisi!');
      return;
    }
    if (formTotal <= 0) {
      setFormError('Nominal transaksi harus lebih besar dari Rp 0!');
      return;
    }
    if (!isUangMuka && formDownPayment < 0) {
      setFormError('Uang muka tidak boleh negatif!');
      return;
    }
    if (!isUangMuka && formDownPayment > formTotal) {
      setFormError('Uang muka tidak boleh melebihi nilai nominal transaksi!');
      return;
    }
    if (isUangMuka && !picName.trim()) {
      setFormError('Nama PIC Penerima Uang Muka wajib diisi untuk transaksi Uang Muka!');
      return;
    }

    try {
      const userId = auth.currentUser?.uid || 'guest-user';
      const dDate = new Date(formDate);
      const dDueDate = new Date(formDueDate);

       if (editId) {
        await updateDebtDetails(editId, {
          name: formName,
          date: dDate,
          dueDate: dDueDate,
          totalAmount: formTotal,
          downPayment: isUangMuka ? 0 : formDownPayment,
          remarks: formRemarks,
          picName: isUangMuka ? picName : '',
          schoolUnit: formSchoolUnit
        });
        showToast('Berhasil mengubah data transaksi.');
      } else {
        await createDebt(
          formType,
          formName,
          dDate,
          dDueDate,
          formTotal,
          isUangMuka ? 0 : formDownPayment,
          formRemarks,
          userId,
          isUangMuka,
          isUangMuka ? picName : '',
          formCashAccountId,
          formSchoolUnit
        );
        showToast('Berhasil mencatat transaksi hutang-piutang baru.');
      }
      setIsAddEditOpen(false);
      resetForm();
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error ketika menyimpan data. Silakan coba lagi.');
    }
  };

  // Resets
  const resetForm = () => {
    setFormType('Piutang');
    setFormName('');
    setFormDate(new Date().toISOString().split('T')[0]);
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setFormDueDate(d.toISOString().split('T')[0]);
    setFormTotal(0);
    setFormDownPayment(0);
    setFormRemarks('');
    setEditId(null);
    setIsUangMuka(false);
    setPicName('');
    setFormSchoolUnit('Umum');
    setFormError('');
    if (cashAccounts.length > 0) {
      setFormCashAccountId(cashAccounts[0].id);
    }
  };

  // Open Edit Dialog
  const openEdit = (debt: DebtReceivable) => {
    setEditId(debt.id);
    setFormType(debt.type);
    setFormName(debt.name);
    setFormDate(toJSDate(debt.date).toISOString().split('T')[0]);
    setFormDueDate(toJSDate(debt.dueDate).toISOString().split('T')[0]);
    setFormTotal(debt.totalAmount);
    setFormDownPayment(debt.downPayment || 0);
    setFormRemarks(debt.remarks || '');
    setIsUangMuka(!!debt.isUangMuka);
    setPicName((debt as any).picName || '');
    setFormSchoolUnit(debt.schoolUnit || 'Umum');
    if (debt.cashAccountId) {
      setFormCashAccountId(debt.cashAccountId);
    }
    setIsAddEditOpen(true);
  };

  // Submit Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedDebt) return;
    if (payAmount <= 0) {
      setFormError('Nominal pembayaran harus lebih besar dari Rp 0!');
      return;
    }
    if (payAmount > selectedDebt.remainingBalance) {
      setFormError(`Pembayaran melebihi sisa hutang/piutang (${formatRupiah(selectedDebt.remainingBalance)})!`);
      return;
    }

    try {
      await addDebtPayment(
        selectedDebt.id,
        new Date(payDate),
        payAmount,
        payNotes,
        selectedCashAccountId
      );
      showToast(`Berhasil mencatat pembayaran sebesar ${formatRupiah(payAmount)}`);
      setIsPaymentOpen(false);
      setSelectedDebt(null);
      setPayAmount(0);
      setPayNotes('');
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Gagal menambahkan pembayaran.');
    }
  };

  // Delete Handler
  const handleDelete = async (debtId: string) => {
    if (window.confirm('Apakah Anda yakin ingin menghapus data hutang/piutang ini? Tindakan ini tidak dapat dibatalkan.')) {
      try {
        await deleteDebt(debtId);
        showToast('Data transaksi berhasil dihapus.');
        loadData();
      } catch (err) {
        console.error("Gagal menghapus data", err);
      }
    }
  };

  // Toast handler
  const showToast = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage('');
    }, 4500);
  };

  // CSV Downloader
  const handleDownloadCSV = () => {
    let listToExport = debts;
    if (downloadReportType === 'piutang_aktif') {
      listToExport = debts.filter(d => d.type === 'Piutang' && d.status !== 'Lunas');
    } else if (downloadReportType === 'hutang_aktif') {
      listToExport = debts.filter(d => d.type === 'Hutang' && d.status !== 'Lunas');
    } else {
      listToExport = filteredAndSortedDebts;
    }

    if (listToExport.length === 0) {
      alert("Tidak ada data untuk diunduh!");
      return;
    }

    const headers = [
      "No",
      "Nomor Referensi",
      "Nama Debitur/Kreditur",
      "Tipe Transaksi",
      "Nominal Total",
      "Uang Muka (DP)",
      "Jumlah Terbayar",
      "Sisa Tagihan",
      "Status",
      "Umur Transaksi (Hari)",
      "Umur Kategori",
      "Tanggal Mulai/Pencatatan",
      "Tanggal Jatuh Tempo",
      "Uang Muka Saja?",
      "PIC Penerima",
      "Catatan/Memo"
    ];

    const rows = listToExport.map((item, index) => {
      const days = getAgingDays(item.date);
      const agingLabel = getAgingLabelAndColor(item.date, item.status === 'Lunas').label;
      const amountPaid = (item.downPayment || 0) + item.paidAmount;
      const isDP = item.isUangMuka ? "Ya" : "Tidak";
      const pic = (item as any).picName || "";
      const remarks = item.remarks || "";
      const refNum = item.dpRefNumber || "";

      return [
        index + 1,
        `"${refNum.replace(/"/g, '""')}"`,
        `"${item.name.replace(/"/g, '""')}"`,
        item.type,
        item.totalAmount,
        item.downPayment || 0,
        amountPaid,
        item.remainingBalance,
        item.status,
        days,
        `"${agingLabel.replace(/"/g, '""')}"`,
        toJSDate(item.date).toISOString().split('T')[0],
        toJSDate(item.dueDate).toISOString().split('T')[0],
        isDP,
        `"${pic.replace(/"/g, '""')}"`,
        `"${remarks.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = [
      "\ufeff" + headers.join(","), // UTF-8 BOM representation for Excel
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().split('T')[0];
    const fileNameTitle = downloadReportType === 'piutang_aktif' ? 'Daftar_Tagihan_Piutang_Aktif' :
                          downloadReportType === 'hutang_aktif' ? 'Daftar_Sisa_Hutang_Vendor' :
                          'Laporan_Hutang_Piutang';
    link.setAttribute("download", `${fileNameTitle}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Berhasil mengunduh dokumen CSV.');
    setIsDownloadModalOpen(false);
  };

  // PDF Downloader (With background layout simulation for clean high-contrast render)
  const handleDownloadPDF = async () => {
    const element = document.getElementById('piutang-print-template');
    if (!element) return;
    
    setDownloadPdfLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    
    const stylesheetBackups: { sheet: CSSStyleSheet; node: HTMLElement | null; originalSheetDisabled: boolean; originalNodeDisabled: boolean }[] = [];
    let tempStyleEl: HTMLStyleElement | null = null;
    const originalGetComputedStyle = window.getComputedStyle;
    
    try {
      // Override getComputedStyle to sanitize any returned colors on the fly for html2canvas
      const styleProxyCache = new Map();
      window.getComputedStyle = function (el, pseudoElt) {
        const style = originalGetComputedStyle(el, pseudoElt);
        if (styleProxyCache.has(style)) {
          return styleProxyCache.get(style);
        }
        
        const proxy = new Proxy(style, {
          get(target, prop) {
            if (prop === 'getPropertyValue') {
              return function (propertyName: string) {
                const val = target.getPropertyValue(propertyName);
                if (typeof val === 'string' && (val.toLowerCase().includes('oklab') || val.toLowerCase().includes('oklch'))) {
                  return sanitizeColorString(val);
                }
                return val;
              };
            }
            
            const val = Reflect.get(target, prop);
            if (typeof val === 'string' && (val.toLowerCase().includes('oklab') || val.toLowerCase().includes('oklch'))) {
              return sanitizeColorString(val);
            }
            return typeof val === 'function' ? val.bind(target) : val;
          }
        });
        
        styleProxyCache.set(style, proxy);
        return proxy;
      };

      // 1. Gather all CSS rules from existing stylesheets and convert oklch and oklab to fallback colors
      let combinedCss = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const node = sheet.ownerNode as HTMLElement;
          let sheetCss = '';
          
          if (node && node instanceof HTMLStyleElement) {
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
          }
          
          stylesheetBackups.push({
            sheet,
            node: node || null,
            originalSheetDisabled: sheet.disabled,
            originalNodeDisabled: node ? (node as any).disabled : false
          });
          
          sheet.disabled = true;
          if (node) {
            (node as any).disabled = true;
          }
        } catch (e) {
          console.warn("Error processing stylesheet for PDF render:", e);
        }
      }

      // 2. Perform the regex replacement to convert all oklch(...) and oklab(...) occurrences inside CSS
      const replacedCss = combinedCss
        .replace(/oklch\(([^)]+)\)/gi, (match) => oklchToHsl(match))
        .replace(/oklab\(([^)]+)\)/gi, (match) => oklabToRgb(match));

      // 3. Inject the sanitized style sheet
      tempStyleEl = document.createElement('style');
      tempStyleEl.id = 'temp-pdf-style-sanitized-hp';
      tempStyleEl.textContent = replacedCss;
      document.head.appendChild(tempStyleEl);

      const canvas = await html2canvas(element, {
        scale: 2, // 2x scale for high-quality printing
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const margin = 10; // margin in mm
      const printableWidth = pdfWidth - (margin * 2);
      const imgWidth = printableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = margin;

      pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - margin * 2);

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
        heightLeft -= (pdfHeight - margin * 2);
      }

      const fileTitle = downloadReportType === 'piutang_aktif' ? 'Lampiran_Tagihan_Piutang_Aktif' :
                        downloadReportType === 'hutang_aktif' ? 'Lampiran_Sisa_Hutang_Vendor' :
                        'Lampiran_Rekap_Hutang_Piutang';
      
      const dateStr = new Date().toISOString().split('T')[0];
      pdf.save(`${fileTitle}_${dateStr}.pdf`);
      showToast('Laporan PDF resmi berhasil diunduh.');
      setIsDownloadModalOpen(false);
    } catch (error) {
      console.error('Gagal merender PDF:', error);
      alert('Gagal menghasilkan file PDF. Gunakan ekspor CSV atau hubungi administrator.');
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      
      if (tempStyleEl && tempStyleEl.parentNode) {
        tempStyleEl.parentNode.removeChild(tempStyleEl);
      }
      for (const backup of stylesheetBackups) {
        try {
          backup.sheet.disabled = backup.originalSheetDisabled;
          if (backup.node) {
            (backup.node as any).disabled = backup.originalNodeDisabled;
          }
        } catch (e) {
          console.warn("Error restoring stylesheet during cleanup:", e);
        }
      }
      setDownloadPdfLoading(false);
    }
  };

  // Processing, filtering & sorting list
  const filteredAndSortedDebts = React.useMemo(() => {
    return debts
      .filter((d) => {
        // Unit restriction check
        if (!isUnitAllowed(d.schoolUnit || 'Umum')) return false;

        const matchesQuery = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (d.remarks && d.remarks.toLowerCase().includes(searchQuery.toLowerCase())) ||
                             (d.dpRefNumber && d.dpRefNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
                             ((d as any).picName && (d as any).picName.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesType = filterType === 'All' ? true : d.type === filterType;
        const matchesUnit = unitFilter === 'All' ? true : (d.schoolUnit || 'Umum') === unitFilter;
        
        let matchesStatus = true;
        if (filterStatus === 'Lunas') matchesStatus = d.status === 'Lunas';
        else if (filterStatus === 'Belum Lunas') matchesStatus = d.status === 'Belum Lunas';
        else if (filterStatus === 'Sebagian') matchesStatus = d.status === 'Sebagian';
        else if (filterStatus === 'Overdue') matchesStatus = isOverdue(d);

        return matchesQuery && matchesType && matchesStatus && matchesUnit;
      })
      .sort((a, b) => {
        if (sortBy === 'date-desc') {
          return toJSDate(b.date).getTime() - toJSDate(a.date).getTime();
        } else if (sortBy === 'date-asc') {
          return toJSDate(a.date).getTime() - toJSDate(b.date).getTime();
        } else if (sortBy === 'remaining-desc') {
          return b.remainingBalance - a.remainingBalance;
        } else if (sortBy === 'dueDate-asc') {
          return toJSDate(a.dueDate).getTime() - toJSDate(b.dueDate).getTime();
        }
        return 0;
      });
  }, [debts, searchQuery, filterType, filterStatus, sortBy, unitFilter, isUnitAllowed]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-24 right-8 bg-emerald-600 border border-emerald-500 text-white px-6 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 z-50 font-sans max-w-sm"
          >
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-semibold">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Hutang & Piutang</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Sistem kontrol, umur piutang/hutang, dan manajemen uang muka</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0 w-full sm:w-auto">
          <button 
            type="button"
            onClick={() => setIsDownloadModalOpen(true)}
            className="flex-1 sm:flex-none border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-sans px-5 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all font-semibold text-xs shadow-sm cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" /> Ekspor & Cetak Laporan
          </button>
          
          {!isViewer && (
            <button 
              type="button"
              onClick={() => { resetForm(); setIsAddEditOpen(true); }}
              className="flex-1 sm:flex-none bg-natural-primary hover:opacity-90 text-white px-6 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all font-semibold shadow-sm text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Catat Transaksi Baru
            </button>
          )}
        </div>
      </div>

      {/* Monitoring Panels Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main PIUTANG (Receivables) Metrics Card */}
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-100">
              <TrendingUp className="w-3.5 h-3.5" /> Piutang (Tagihan)
            </span>
            <span className="text-xs font-mono font-bold text-gray-400">AKTIVA</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Total Sisa Piutang Aktif</p>
            <p className="text-3xl font-serif text-emerald-800 font-bold mt-1">
              {formatRupiah(stats.piutangRemaining)}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-400 text-[10px] uppercase">Terdaftar</p>
              <p className="font-semibold text-slate-700">{formatRupiah(stats.piutangTotal)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] uppercase">Sudah Dibayar</p>
              <p className="font-semibold text-emerald-600">{formatRupiah(stats.piutangPaid)}</p>
            </div>
          </div>
          {stats.piutangOverdue > 0 && (
            <div className="bg-rose-50 border border-rose-100 text-rose-800 text-[11px] p-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{formatRupiah(stats.piutangOverdue)} Melebihi Jatuh Tempo!</span>
            </div>
          )}
        </div>

        {/* Main HUTANG (Payables) Metrics Card */}
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full flex items-center gap-1.5 border border-amber-100">
              <TrendingDown className="w-3.5 h-3.5" /> Hutang (Kewajiban)
            </span>
            <span className="text-xs font-mono font-bold text-gray-400">PASIVA</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400">Total Sisa Hutang Aktif</p>
            <p className="text-3xl font-serif text-amber-800 font-bold mt-1">
              {formatRupiah(stats.hutangRemaining)}
            </p>
          </div>
          <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-400 text-[10px] uppercase">Terdaftar</p>
              <p className="font-semibold text-slate-700">{formatRupiah(stats.hutangTotal)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-[10px] uppercase">Sudah Dibayar</p>
              <p className="font-semibold text-amber-600">{formatRupiah(stats.hutangPaid)}</p>
            </div>
          </div>
          {stats.hutangOverdue > 0 && (
            <div className="bg-red-50 border border-red-100 text-red-800 text-[11px] p-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formatRupiah(stats.hutangOverdue)} Hutang Jatuh Tempo!</span>
            </div>
          )}
        </div>

        {/* Monitoring Aging Card */}
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-neutral-primary uppercase tracking-widest bg-slate-50 border border-natural-border px-3 py-1 rounded-full flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Umur Piutang & Hutang
            </span>
            <span className="text-xs font-mono font-bold text-gray-400">MONITOR</span>
          </div>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>0 - 30 Hari:</span>
              <span className="font-mono font-bold text-slate-800">{formatRupiah(stats.aging0to30)}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full" 
                style={{ width: `${stats.piutangRemaining + stats.hutangRemaining > 0 ? (stats.aging0to30 / (stats.piutangRemaining + stats.hutangRemaining)) * 105 : 0}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>31 - 60 Hari:</span>
              <span className="font-mono font-bold text-amber-700">{formatRupiah(stats.aging31to60)}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-amber-500 h-full" 
                style={{ width: `${stats.piutangRemaining + stats.hutangRemaining > 0 ? (stats.aging31to60 / (stats.piutangRemaining + stats.hutangRemaining)) * 105 : 0}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>61 - 90 Hari:</span>
              <span className="font-mono font-bold text-orange-700">{formatRupiah(stats.aging61to90)}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-orange-500 h-full" 
                style={{ width: `${stats.piutangRemaining + stats.hutangRemaining > 0 ? (stats.aging61to90 / (stats.piutangRemaining + stats.hutangRemaining)) * 105 : 0}%` }}
              ></div>
            </div>

            <div className="flex justify-between items-center text-slate-600">
              <span>&gt; 90 Hari:</span>
              <span className="font-mono font-bold text-rose-700">{formatRupiah(stats.agingAbove90)}</span>
            </div>
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-rose-500 h-full" 
                style={{ width: `${stats.piutangRemaining + stats.hutangRemaining > 0 ? (stats.agingAbove90 / (stats.piutangRemaining + stats.hutangRemaining)) * 105 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Controls & Filters */}
      <div className="bg-white p-5 rounded-3xl border border-natural-border shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari nama debitur, kreditur, memo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
          />
        </div>

        <div className="flex flex-wrap lg:flex-nowrap gap-3 w-full md:w-auto items-center justify-end">
          {/* Type Filter */}
          <div className="flex bg-slate-100 rounded-xl p-0.5 border border-natural-border text-xs">
            {(['All', 'Hutang', 'Piutang'] as const).map(type => (
              <button
                type="button"
                key={type}
                onClick={() => setFilterType(type)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all uppercase tracking-wider",
                  filterType === type ? "bg-white text-natural-primary shadow-sm" : "text-gray-400 hover:text-slate-600"
                )}
              >
                {type === 'All' ? 'Semua' : type}
              </button>
            ))}
          </div>

          {/* Unit Filter */}
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value as any)}
            className="bg-white border border-natural-border rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary cursor-pointer font-bold"
          >
            <option value="All">Unit: Consolidated</option>
            <option value="SMP">Unit: SMP</option>
            <option value="SMA">Unit: SMA</option>
            <option value="Umum">Unit: Umum</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-white border border-natural-border rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary"
          >
            <option value="All">Semua Status</option>
            <option value="Belum Lunas">Belum Lunas</option>
            <option value="Sebagian">Sebagian Dibayar</option>
            <option value="Lunas">Lunas</option>
            <option value="Overdue">Jatuh Tempo ⚠️</option>
          </select>

          {/* Sort selection */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-white border border-natural-border rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary flex items-center"
          >
            <option value="date-desc">Tanggal Terkini</option>
            <option value="date-asc">Tanggal Terlama</option>
            <option value="remaining-desc">Sisa Terbesar</option>
            <option value="dueDate-asc">Tempo Terdekat</option>
          </select>
        </div>
      </div>

      {/* Main Table List */}
      <div className="bg-white rounded-3xl border border-natural-border shadow-sm overflow-hidden text-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-natural-border text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-4">Tipe & Nama</th>
                <th className="px-6 py-4">Sisa Tagihan / Total</th>
                <th className="px-6 py-4">Uang Muka (DP)</th>
                <th className="px-6 py-4">Umur Piutang/Hutang</th>
                <th className="px-6 py-4">Jatuh Tempo</th>
                {!isViewer && <th className="px-6 py-4 text-center">Aksi</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={isViewer ? 5 : 6} className="text-center py-12 text-gray-400 italic font-sans text-xs">
                    Memuat data monitoring hutang & piutang...
                  </td>
                </tr>
              ) : filteredAndSortedDebts.length === 0 ? (
                <tr>
                  <td colSpan={isViewer ? 5 : 6} className="text-center py-12 text-gray-400 italic font-sans text-xs">
                    Tidak ada data transaksi yang sesuai dengan kriteria filter Anda.
                  </td>
                </tr>
              ) : (
                filteredAndSortedDebts.map((item) => {
                  const agingInfo = getAgingLabelAndColor(item.date, item.status === 'Lunas');
                  const isPastDue = isOverdue(item);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name & Type Column */}
                      <td className="px-6 py-4 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                            item.type === 'Piutang' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                          )}>
                            {item.type}
                          </span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border",
                            (item.schoolUnit || 'Umum') === 'SMP' ? "bg-sky-50 text-sky-700 border-sky-100" :
                            (item.schoolUnit || 'Umum') === 'SMA' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                            "bg-slate-50 text-slate-600 border-slate-100"
                          )}>
                            {item.schoolUnit || 'Umum'}
                          </span>
                          {item.isUangMuka && (
                            <span className="bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                              Uang Muka (DP)
                            </span>
                          )}
                          {item.journalId && (
                            <span className="bg-blue-50 border border-blue-200 text-blue-600 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                              Synced Jurnal
                            </span>
                          )}
                          {isPastDue && (
                            <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Jatuh Tempo
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-850 text-sm font-sans">{item.name}</p>
                          <p className="text-[10px] text-gray-400 font-sans max-w-xs truncate">{item.remarks || 'Tanpa keterangan'}</p>
                        </div>
                        {(item.dpRefNumber || (item as any).picName || item.isUangMuka) && (
                          <div className="flex flex-wrap items-center gap-2 mt-1 select-none">
                            {item.dpRefNumber && (
                              <span className="font-mono text-[9px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-semibold uppercase">
                                Ref: {item.dpRefNumber}
                              </span>
                            )}
                            {(item as any).picName && (
                              <span className="text-[9px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200 font-medium inline-flex items-center gap-1">
                                <User className="w-3 h-3 text-slate-400 shrink-0" /> PIC: {(item as any).picName}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Amounts Breakdown Column */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="text-sm font-bold font-mono text-slate-900">{formatRupiah(item.remainingBalance)}</p>
                          <p className="text-[10px] text-gray-400 font-sans">
                            dari <span className="font-mono">{formatRupiah(item.totalAmount)}</span>
                          </p>
                        </div>
                      </td>

                      {/* Down Payment Column */}
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-mono font-medium text-slate-700">
                            {formatRupiah(item.downPayment || 0)}
                          </p>
                          {(item.downPayment || 0) > 0 && (
                            <p className="text-[9px] text-emerald-600 font-sans uppercase font-bold tracking-wider">
                              Disetor di Awal
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Dynamic Aging Column */}
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2.5 py-1 text-[10px] rounded-lg border font-semibold inline-block font-sans",
                          agingInfo.color
                        )}>
                          {agingInfo.label}
                        </span>
                      </td>

                      {/* Due Date Column */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-sans">
                          <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                          <span>{toJSDate(item.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </td>

                      {/* Interactive Operations Column */}
                      {!isViewer && (
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* Payment Registration */}
                            {item.status !== 'Lunas' ? (
                              <button
                                type="button"
                                onClick={() => { setSelectedDebt(item); setPayAmount(item.remainingBalance); setIsPaymentOpen(true); }}
                                className="px-3 py-1.5 bg-natural-primary/10 text-natural-primary hover:bg-natural-primary hover:text-white transition-all rounded-xl text-[10px] font-bold tracking-wider uppercase flex items-center gap-1"
                                title="Catat Angsuran / Pelunasan"
                              >
                                <Coins className="w-3 h-3" /> Bayar
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-widest bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center gap-1">
                                <CheckCircle className="w-3.5 h-3.5" /> Lunas
                              </span>
                            )}

                            {/* Historical logs */}
                            <button
                              type="button"
                              onClick={() => { setSelectedDebt(item); setIsHistoryOpen(true); }}
                              className="p-2 border border-natural-border hover:bg-slate-55 rounded-xl text-slate-500 transition-colors"
                              title="Riwayat Angsuran"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit Details */}
                            <button
                              type="button"
                              onClick={() => openEdit(item)}
                              className="p-2 border border-natural-border hover:bg-slate-50 rounded-xl text-slate-500 hover:text-natural-primary transition-colors"
                              title="Detail / Ubah"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Item */}
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="p-2 border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-xl transition-colors"
                              title="Hapus Transaksi"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADD & EDIT TRANSACTION MODAL */}
      <AnimatePresence>
        {isAddEditOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-800"
            >
              {/* Header */}
              <div className="p-6 border-b border-natural-border bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-natural-primary/10 flex items-center justify-center text-natural-primary shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-serif italic text-natural-primary font-semibold">
                      {editId ? 'Ubah Transaksi' : 'Catat Transaksi Baru'}
                    </h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-sans">
                      Hutang vendor, piutang donatur, serta setoran uang muka
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddEditOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveDebt} className="flex-1 overflow-y-auto p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {selectedDebt?.journalId && (
                  <div className="p-3 bg-blue-50 border border-blue-150 text-blue-800 text-xs rounded-xl flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Transaksi Otomatis (Terhubung)</p>
                      <p className="text-[10px] text-blue-600 leading-relaxed mt-0.5">
                        Data ini terintegrasi secara otomatis dari entri Jurnal Umum. Jika mengubah nilai nominal, kami sangat menyarankan mengupdate-nya langsung melalui tabel Jurnal Umum untuk menjaga konsistensi buku besar.
                      </p>
                    </div>
                  </div>
                )}

                {/* Type Selection */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1.5">Tipe Transaksi</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={!!editId}
                      onClick={() => setFormType('Piutang')}
                      className={cn(
                        "py-3 rounded-2xl border font-semibold text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-2",
                        formType === 'Piutang' 
                          ? "bg-emerald-50 border-emerald-300 text-emerald-800" 
                          : "bg-white border-natural-border text-slate-400 hover:text-slate-600 disabled:opacity-50"
                      )}
                    >
                      <TrendingUp className="w-4 h-4" /> Piutang (Aktiva)
                    </button>
                    <button
                      type="button"
                      disabled={!!editId}
                      onClick={() => setFormType('Hutang')}
                      className={cn(
                        "py-3 rounded-2xl border font-semibold text-xs transition-all uppercase tracking-wider flex items-center justify-center gap-2",
                        formType === 'Hutang' 
                          ? "bg-amber-50 border-amber-300 text-amber-800" 
                          : "bg-white border-natural-border text-slate-400 hover:text-slate-600 disabled:opacity-50"
                      )}
                    >
                      <TrendingDown className="w-4 h-4" /> Hutang (Liabilitas)
                    </button>
                  </div>
                </div>

                 {/* Unit Sekolah Select */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                    Unit Sekolah
                  </label>
                  <select
                    value={formSchoolUnit}
                    onChange={(e) => setFormSchoolUnit(e.target.value as any)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary cursor-pointer"
                  >
                    <option value="Umum">Umum (Gabungan)</option>
                    <option value="SMP">SMP</option>
                    <option value="SMA">SMA</option>
                  </select>
                </div>

                {/* Client / Vendor Name */}
                <div>
                  <label htmlFor="formName" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                    Nama Debitur / Kreditur
                  </label>
                  <input
                    id="formName"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Contoh: Baznas Provinsi, CV ATK Mandiri, Tenant Kantin..."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                  />
                </div>

                {/* Trans Date & Due Date Row */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="formDate" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                      Tanggal Mulai
                    </label>
                    <input
                      id="formDate"
                      type="date"
                      required
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-natural-border rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    />
                  </div>
                  <div>
                    <label htmlFor="formDueDate" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                      Jatuh Tempo
                    </label>
                    <input
                      id="formDueDate"
                      type="date"
                      required
                      value={formDueDate}
                      onChange={(e) => setFormDueDate(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-natural-border rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    />
                  </div>
                </div>

                {/* Total amount */}
                <div>
                  <label htmlFor="formTotal" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                    Nominal Transaksi Asli (Rp)
                  </label>
                  <input
                    id="formTotal"
                    type="number"
                    min={0}
                    step={1000}
                    required
                    placeholder="Nominal rupiah yang tertagih / terhutang keseluruhan"
                    value={formTotal || ''}
                    onChange={(e) => setFormTotal(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl font-mono text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Format: {formatRupiah(formTotal)}</p>
                </div>

                {/* Uang Muka Toggle for Piutang */}
                {formType === 'Piutang' && (
                  <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/70 space-y-3">
                    <div className="flex items-center gap-2">
                      <input 
                        id="isUangMuka"
                        type="checkbox"
                        checked={isUangMuka}
                        onChange={(e) => {
                          setIsUangMuka(e.target.checked);
                          if (e.target.checked) {
                            setFormDownPayment(0);
                          }
                        }}
                        className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 accent-emerald-650 cursor-pointer"
                      />
                      <label htmlFor="isUangMuka" className="text-xs font-semibold text-emerald-900 cursor-pointer select-none">
                        Jadikan sebagai Transaksi Uang Muka / Panjar (Cash Basis)
                      </label>
                    </div>

                    {isUangMuka && (
                      <div className="space-y-1.5 pl-6">
                        <label htmlFor="formPicName" className="block text-[10px] uppercase tracking-widest text-emerald-800 font-bold mb-1">
                          Nama PIC Penerima Uang Muka
                        </label>
                        <input 
                          id="formPicName"
                          type="text"
                          required={isUangMuka}
                          placeholder="Masukkan nama penanggung jawab / PIC (Mis: Agus Prasetyo)"
                          value={picName}
                          onChange={(e) => setPicName(e.target.value)}
                          className="w-full px-4 py-2.5 border border-emerald-200 rounded-xl bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                        <p className="text-[10px] text-emerald-700 font-sans leading-relaxed">
                          Nomor referensi uang muka akan di-generate otomatis untuk pelaporan & integrasi penutupan kas basis.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Down payment DP (Hidden if isUangMuka is true) */}
                {!isUangMuka && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label htmlFor="formDownPayment" className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                        Setoran Uang Muka / Panjar (DP)
                      </label>
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-wide">
                        Uang Muka
                      </span>
                    </div>
                    <input
                      id="formDownPayment"
                      type="number"
                      min={0}
                      step={1000}
                      placeholder="Kosongkan jika tidak ada setoran panjar (DP) diawal"
                      value={formDownPayment || ''}
                      onChange={(e) => setFormDownPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl font-mono text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Sisa saldo awal tertunggak: <span className="font-bold font-mono text-slate-700">{formatRupiah(formTotal - formDownPayment)}</span></p>
                  </div>
                )}

                {/* Cash/Bank selector for DP or Uang Muka in creation modal */}
                {(isUangMuka || (formDownPayment > 0 && !isUangMuka)) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1"
                  >
                    <label htmlFor="formCashAccountId" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                      {formType === 'Piutang' ? (isUangMuka ? 'Sumber Kas / Bank Pembayar (Kredit)' : 'Tujuan Kas / Bank DP (Debit)') : 'Sumber Kas / Bank DP (Kredit)'}
                    </label>
                    <select
                      id="formCashAccountId"
                      required
                      value={formCashAccountId}
                      onChange={(e) => setFormCashAccountId(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary cursor-pointer font-sans"
                    >
                      {cashAccounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          [{acc.code}] - {acc.name}
                        </option>
                      ))}
                    </select>
                  </motion.div>
                )}

                {/* Remarks/Keterangan */}
                <div>
                  <label htmlFor="formRemarks" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                    Deskripsi / Memo / Keterangan tambahan
                  </label>
                  <textarea
                    id="formRemarks"
                    rows={3}
                    maxLength={200}
                    placeholder="Keterangan peruntukan, nomor invoice asli, nomor kontrak atau nomor PO..."
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none"
                  ></textarea>
                </div>

                {/* Footer Buttons inside Scroll view if content overlaps */}
                <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddEditOpen(false)}
                    className="px-5 py-2 border border-natural-border rounded-full text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-natural-primary text-white rounded-full text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-sm transition-all"
                  >
                    {editId ? 'Simpan Perubahan' : 'Catat Transaksi'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: ADD PAYMENT INSTALMENT MODAL */}
      <AnimatePresence>
        {isPaymentOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-md w-full overflow-hidden text-slate-800"
            >
              <div className="p-6 border-b border-natural-border bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Catat Pembayaran</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">{selectedDebt.type} - {selectedDebt.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleAddPayment} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-2xl border border-natural-border space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Total Nominal Awal:</span>
                    <span className="font-mono font-bold">{formatRupiah(selectedDebt.totalAmount)}</span>
                  </div>
                  {selectedDebt.downPayment > 0 && (
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Uang Muka Disetorkan:</span>
                      <span className="font-mono">{formatRupiah(selectedDebt.downPayment)}</span>
                    </div>
                  )}
                  {selectedDebt.paidAmount > 0 && (
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Cicilan Sebelumnya:</span>
                      <span className="font-mono text-emerald-600">+{formatRupiah(selectedDebt.paidAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-800 border-t border-slate-200/80 pt-2 font-bold">
                    <span>Sisa Tunggakan:</span>
                    <span className="font-mono text-slate-900">{formatRupiah(selectedDebt.remainingBalance)}</span>
                  </div>
                </div>

                {/* Amount to pay */}
                <div>
                  <label htmlFor="payAmount" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                    Jumlah Pembayaran / Cicilan (Rp)
                  </label>
                  <input
                    id="payAmount"
                    type="number"
                    min={1}
                    max={selectedDebt.remainingBalance}
                    required
                    placeholder="Masukkan nominal pelunasan atau cicilan..."
                    value={payAmount || ''}
                    onChange={(e) => setPayAmount(Math.min(selectedDebt.remainingBalance, parseFloat(e.target.value) || 0))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl font-mono text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>Maksimum: {formatRupiah(selectedDebt.remainingBalance)}</span>
                    <button 
                      type="button" 
                      onClick={() => setPayAmount(selectedDebt.remainingBalance)} 
                      className="text-natural-primary font-bold hover:underline"
                    >
                      Bayar Lunas
                    </button>
                  </div>
                </div>

                {/* Cash/Bank Account Source Option */}
                <div>
                  <label htmlFor="selectedCashAccountId" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                    {selectedDebt.type === 'Piutang' ? 'Tujuan Kas / Bank (Debit)' : 'Sumber Kas / Bank (Kredit)'}
                  </label>
                  <select
                    id="selectedCashAccountId"
                    required
                    value={selectedCashAccountId}
                    onChange={(e) => setSelectedCashAccountId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary cursor-pointer font-sans"
                  >
                    {cashAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        [{acc.code}] - {acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Date */}
                <div>
                  <label htmlFor="payDate" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                    Tanggal Bayar
                  </label>
                  <input
                    id="payDate"
                    type="date"
                    required
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-natural-border rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary"
                  />
                </div>

                {/* Notes/Memo */}
                <div>
                  <label htmlFor="payNotes" className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">
                    Memo Pembayaran / Lampiran Buku Kas
                  </label>
                  <input
                    id="payNotes"
                    type="text"
                    maxLength={100}
                    placeholder="Contoh: Pembayaran asuransi cicilan ke-2, pelunasan transfer Bank..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                  />
                </div>

                <div className="pt-4 flex gap-3 justify-end border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => { setIsPaymentOpen(false); setSelectedDebt(null); }}
                    className="px-5 py-2 border border-natural-border rounded-full text-xs font-bold uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 bg-emerald-600 text-white rounded-full text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 shadow-sm transition-all"
                  >
                    Konfirmasi Bayar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: PAYMENTS HISTORY LOG MODAL */}
      <AnimatePresence>
        {isHistoryOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-md w-full overflow-hidden text-slate-800"
            >
              <div className="p-6 border-b border-natural-border bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-natural-border flex items-center justify-center text-slate-500 shrink-0">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Riwayat Pembayaran</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest">{selectedDebt.type} - {selectedDebt.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setIsHistoryOpen(false); setSelectedDebt(null); }}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Initial Info */}
                <div className="grid grid-cols-2 gap-4 text-xs pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-gray-400">Total Nominal:</p>
                    <p className="font-bold font-mono text-slate-800">{formatRupiah(selectedDebt.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Sisa Tunggakan:</p>
                    <p className="font-bold font-mono text-rose-700">{formatRupiah(selectedDebt.remainingBalance)}</p>
                  </div>
                </div>

                {/* List of Payments */}
                <div className="space-y-3 max-h-60 overflow-y-auto">
                  
                  {/* Ledger of Initial DP */}
                  {selectedDebt.downPayment > 0 && (
                    <div className="p-3 bg-emerald-50/40 border border-emerald-100/60 rounded-xl space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase bg-emerald-100 px-2 py-0.5 rounded">
                          UANG MUKA (DP)
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-800">
                          {formatRupiah(selectedDebt.downPayment)}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400">Penyetoran awal sebagai jaminan / panjar transaksi</p>
                      <p className="text-[9px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-300" />
                        {toJSDate(selectedDebt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}

                  {/* List of instalment payments */}
                  {selectedDebt.payments && selectedDebt.payments.length > 0 ? (
                    selectedDebt.payments.map((p, index) => (
                      <div key={p.id} className="p-3 bg-white border border-slate-100 hover:border-slate-200 rounded-xl space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-800 font-sans">Pembayaran #{index + 1}</span>
                          <span className="font-mono font-bold text-emerald-600">+{formatRupiah(p.amount)}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 italic">“{p.notes || 'Tanpa keterangan memo'}”</p>
                        <div className="flex justify-between items-center text-[9px] text-gray-400 pt-1 border-t border-slate-50 mt-1">
                          <p className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-300" />
                            {toJSDate(p.date || selectedDebt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                          {p.cashAccountName && (
                            <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-semibold text-[8px] tracking-wider uppercase border border-emerald-100">
                              {p.cashAccountName}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    (!selectedDebt.downPayment || selectedDebt.downPayment === 0) && (
                      <div className="text-center py-6 text-slate-400 text-xs italic">
                        Belum ada riwayat angsuran pembayaran untuk transaksi ini.
                      </div>
                    )
                  )}

                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => { setIsHistoryOpen(false); setSelectedDebt(null); }}
                    className="px-6 py-2 bg-slate-800 text-white rounded-full text-xs font-bold uppercase tracking-wider hover:bg-slate-700 transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
 
      {/* MODAL 4: DOWNLOAD & EXPORT MODAL */}
      <AnimatePresence>
        {isDownloadModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-lg w-full overflow-hidden text-slate-800 font-sans"
            >
              {/* Header */}
              <div className="p-6 border-b border-natural-border bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <Download className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">Ekspor & Laporan Keuangan</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mt-0.5">Hutang Piutang & Manajemen Tagihan</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* 1. Report Type Selection */}
                <div className="space-y-2">
                  <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-bold">Pilih Jenis Data / Laporan</label>
                  <div className="space-y-2">
                    <label className={cn(
                      "flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer",
                      downloadReportType === 'piutang_aktif' 
                        ? "bg-emerald-50/50 border-emerald-300 ring-1 ring-emerald-300" 
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    )}>
                      <input 
                        type="radio" 
                        name="downloadReportType" 
                        value="piutang_aktif"
                        checked={downloadReportType === 'piutang_aktif'}
                        onChange={() => setDownloadReportType('piutang_aktif')}
                        className="mt-1 accent-emerald-600 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <span>Piutang Donatur & Santri (Aktif / Outstanding)</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-normal px-2 py-0.5 rounded-full">Rekomendasi Penagihan</span>
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">
                          Menyaring khusus seluruh piutang donatur/santri yang belum lunas (sisa tagihan &gt; 0). Cocok digunakan sebagai lampiran resmi dan dasar penagihan.
                        </p>
                      </div>
                    </label>

                    <label className={cn(
                      "flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer",
                      downloadReportType === 'hutang_aktif' 
                        ? "bg-amber-50/50 border-amber-300 ring-1 ring-amber-300" 
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    )}>
                      <input 
                        type="radio" 
                        name="downloadReportType" 
                        value="hutang_aktif"
                        checked={downloadReportType === 'hutang_aktif'}
                        onChange={() => setDownloadReportType('hutang_aktif')}
                        className="mt-1 accent-amber-600 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-amber-950">
                          Hutang & Liabilitas Vendor (Aktif / Outstanding)
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">
                          Menyaring khusus hutang madrasah ke vendor atau pihak ketiga yang masih memiliki tunggakan/belum lunas (sisa hutang &gt; 0).
                        </p>
                      </div>
                    </label>

                    <label className={cn(
                      "flex items-start gap-3 p-3.5 rounded-2xl border transition-all cursor-pointer",
                      downloadReportType === 'all' 
                        ? "bg-slate-50 border-slate-300 ring-1 ring-slate-300" 
                        : "bg-white border-slate-200 hover:bg-slate-50"
                    )}>
                      <input 
                        type="radio" 
                        name="downloadReportType" 
                        value="all"
                        checked={downloadReportType === 'all'}
                        onChange={() => setDownloadReportType('all')}
                        className="mt-1 accent-slate-800 cursor-pointer"
                      />
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          Seluruh Data Yang Sedang Terfilter ({filteredAndSortedDebts.length} Baris)
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1 leading-relaxed font-sans">
                          Menyimpan kompilasi data yang saat ini tampil di tabel dashboard sesuai dengan filter, pencarian kata kunci, dan pengurutan aktif Anda.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Info Note */}
                <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-2.5 text-[10px] text-blue-800 leading-relaxed font-sans">
                  <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block mb-0.5">Format PDF Resmi Khusus Penagihan</span>
                    <p className="text-slate-500">
                      Untuk keperluan penagihan piutang, gunakan format <strong>Unduh PDF Resmi</strong>. Dokumen PDF akan ter-render otomatis menyertakan KOP Sekolah Keuangan Sosial, rekapitulasi data umur piutang, penanggung jawab (PIC), memo peruntukan, serta lembar otorisasi tanda tangan Bendahara & Yayasan.
                    </p>
                  </div>
                </div>

                {/* 2. Download Buttons */}
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleDownloadCSV}
                    className="py-3 px-4 border border-emerald-200 hover:bg-emerald-50 bg-white text-emerald-800 rounded-2xl transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Unduh CSV (Excel)</span>
                  </button>

                  <button
                    type="button"
                    disabled={downloadPdfLoading}
                    onClick={handleDownloadPDF}
                    className={cn(
                      "py-3 px-4 text-white rounded-2xl transition-all font-bold text-xs flex items-center justify-center gap-2 shadow-sm cursor-pointer",
                      downloadPdfLoading 
                        ? "bg-slate-400 cursor-wait" 
                        : "bg-natural-primary hover:opacity-95"
                    )}
                  >
                    <Printer className="w-4 h-4" />
                    <span>{downloadPdfLoading ? 'Menyusun PDF...' : 'Unduh PDF Resmi'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* OFF-SCREEN PRINT TEMPLATE FOR HIGH-FIDELITY PDF GENERATION */}
      <div 
        id="piutang-print-template" 
        className="fixed -left-[9999px] top-0 bg-white text-slate-900 p-12 space-y-6 font-sans text-xs"
        style={{ width: '800px' }}
      >
        {/* Header (KOP SURAT) */}
        <div className="text-center border-b-2 border-double border-slate-900 pb-5 space-y-1">
          <h2 className="text-xl font-bold font-serif uppercase tracking-normal text-slate-1000">SEKOLAH CENDEKIA BAZNAS</h2>
          <p className="text-[10px] font-sans text-slate-500 uppercase tracking-widest font-semibold">Sistem Informasi Akuntansi</p>
          <p className="text-[9px] text-slate-500 font-sans">Jl. KH. Umar Cirangkong Ds. Cempang No. 14 Kec. Cibungbulang Kab. Bogor.</p>
        </div>

        {/* Title & Date */}
        <div className="flex justify-between items-end pt-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              {downloadReportType === 'piutang_aktif' ? 'Laporan Umur Piutang Donatur & Santri (Penagihan)' : 
               downloadReportType === 'hutang_aktif' ? 'Laporan Umur Hutang & Liabilitas Vendor' : 
               'Laporan Rekapitulasi Hutang & Piutang'}
            </h3>
            <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-1">
              <span>Status Dokumen:</span>
              <span className="font-semibold text-rose-700 capitalize">Outstanding / Tunggakan Belum Lunas</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500">
              Tanggal Cetak: <span className="font-semibold text-slate-900">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </p>
            <p className="text-[9px] text-slate-400 font-mono">Dibuat oleh: {auth.currentUser?.email || 'Bendahara Keuangan'}</p>
          </div>
        </div>

        {/* Financial Summary Box */}
        <div className="grid grid-cols-3 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Total Transaksi</p>
            <p className="text-xs font-semibold font-mono text-slate-800">
              {formatRupiah(
                debts
                  .filter(d => {
                    if (downloadReportType === 'piutang_aktif') return d.type === 'Piutang' && d.status !== 'Lunas';
                    if (downloadReportType === 'hutang_aktif') return d.type === 'Hutang' && d.status !== 'Lunas';
                    return true;
                  })
                  .reduce((sum, d) => sum + d.totalAmount, 0)
              )}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Sudah Terbayar</p>
            <p className="text-xs font-semibold font-mono text-slate-800">
              {formatRupiah(
                debts
                  .filter(d => {
                    if (downloadReportType === 'piutang_aktif') return d.type === 'Piutang' && d.status !== 'Lunas';
                    if (downloadReportType === 'hutang_aktif') return d.type === 'Hutang' && d.status !== 'Lunas';
                    return true;
                  })
                  .reduce((sum, d) => sum + (d.downPayment + d.paidAmount), 0)
              )}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider text-rose-500 font-bold">Total Sisa Tunggakan (SISA)</p>
            <p className="text-xs font-bold font-mono text-rose-700">
              {formatRupiah(
                debts
                  .filter(d => {
                    if (downloadReportType === 'piutang_aktif') return d.type === 'Piutang' && d.status !== 'Lunas';
                    if (downloadReportType === 'hutang_aktif') return d.type === 'Hutang' && d.status !== 'Lunas';
                    return true;
                  })
                  .reduce((sum, d) => sum + d.remainingBalance, 0)
              )}
            </p>
          </div>
        </div>

        {/* Invoice Table list */}
        <table className="w-full text-left border-collapse border border-slate-200">
          <thead>
            <tr className="bg-slate-50 text-[9px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-250">
              <th className="p-2 border-r border-slate-200 text-center w-8">No</th>
              <th className="p-2 border-r border-slate-200">Nama Lengkap Donatur/Debitur/Kreditur</th>
              <th className="p-2 border-r border-slate-200 text-center">Tanggal Mulai</th>
              <th className="p-2 border-r border-slate-200 text-right">Sisa Tunggakan</th>
              <th className="p-2 border-r border-slate-200 text-center">Kategori Umur (Aging)</th>
              <th className="p-2 text-center">Jatuh Tempo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 border-b border-slate-200 text-[9px]">
            {debts
              .filter(d => {
                if (downloadReportType === 'piutang_aktif') return d.type === 'Piutang' && d.status !== 'Lunas';
                if (downloadReportType === 'hutang_aktif') return d.type === 'Hutang' && d.status !== 'Lunas';
                return true;
              })
              .map((item, idx) => {
                const agingInfo = getAgingLabelAndColor(item.date, item.status === 'Lunas');
                return (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="p-2 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-200">
                      <div>
                        <p className="font-bold text-slate-900">{item.name}</p>
                        {item.remarks && <p className="text-[8.5px] text-slate-550 italic mt-0.5 leading-relaxed">Memo: {item.remarks}</p>}
                        {(item as any).picName && <p className="text-[8.5px] text-emerald-800 mt-0.5 font-medium">PIC: {(item as any).picName}</p>}
                      </div>
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center font-mono">
                      {toJSDate(item.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                      {formatRupiah(item.remainingBalance)}
                    </td>
                    <td className="p-2 border-r border-slate-200 text-center font-sans font-semibold text-slate-700">
                      {agingInfo.label}
                    </td>
                    <td className="p-2 text-center font-mono text-slate-600">
                      {toJSDate(item.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            {debts.filter(d => {
              if (downloadReportType === 'piutang_aktif') return d.type === 'Piutang' && d.status !== 'Lunas';
              if (downloadReportType === 'hutang_aktif') return d.type === 'Hutang' && d.status !== 'Lunas';
              return true;
            }).length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                  Tidak ada data outstanding yang ditemukan untuk kategori laporan ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer info/Penjelasan hukum */}
        <div className="pt-2 font-sans">
          <p className="text-[8.5px] text-slate-500 leading-relaxed italic">
            * Rekapitulasi daftar umur piutang/hutang ini ditarik secara langsung dari basis data Sistem Kas & Buku Besar Madrasah yang terpusat. Lembaran rekap laporan ini sah dilampirkan sebagai dasar utama kelayakan administratif untuk penagihan piutang donatur/tunggakan santri yang bersangkutan demi tertib administrasi keuangan yayasan.
          </p>
        </div>

        {/* Signature lines */}
        <div className="grid grid-cols-2 gap-12 pt-12 text-center font-sans">
          <div className="space-y-16">
            <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest animate-pulse">Dibuat Oleh,</p>
            <div className="space-y-1">
              <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[140px]">
                {auth.currentUser?.email ? auth.currentUser.email.split('@')[0].toUpperCase() : 'BENDAHARA MADRASAH'}
              </p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Staf Administrasi Keuangan</p>
            </div>
          </div>
          <div className="space-y-16">
            <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-widest">Mengetahui & Menyetujui,</p>
            <div className="space-y-1">
              <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[140px]">KEPALA MADRASAH / YAYASAN</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Pimpinan Lembaga Pajak & Sosial</p>
            </div>
          </div>
        </div>
      </div>
 
    </div>
  );
}
