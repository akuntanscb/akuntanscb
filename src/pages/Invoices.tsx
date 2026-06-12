import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Download, 
  CheckCircle2, 
  Clock, 
  X, 
  Trash2, 
  Edit3, 
  Eye, 
  AlertCircle, 
  CalendarDays, 
  FileSpreadsheet, 
  FileText, 
  Receipt,
  PlusCircle,
  Info,
  Calendar,
  DollarSign,
  Shield
} from 'lucide-react';
import { formatRupiah, cn, terbilang } from '../lib/utils';
import { 
  getInvoices, 
  createInvoice, 
  updateInvoice, 
  deleteInvoice, 
  generateInvoiceNumber,
  updateInvoiceStatus
} from '../services/invoiceService';
import { Invoice, InvoiceItem } from '../types';
import { auth } from '../lib/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { useUserRole } from '../context/UserRoleContext';

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

export default function Invoices() {
  const { hasPermission, isUnitAllowed } = useUserRole();

  if (!hasPermission('canInvoices')) {
    return (
      <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md mx-auto my-12 shadow-sm font-sans">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-slate-500">Anda tidak memiliki hak istimewa (canInvoices) untuk melihat atau mengelola Faktur keuangan.</p>
      </div>
    );
  }

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  
  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Draft' | 'Sent' | 'Paid' | 'Cancelled'>('All');
  const [unitFilter, setUnitFilter] = useState<'All' | 'SMP' | 'SMA' | 'Umum'>('All');
  
  // Custom Toast States
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [isToastOpen, setIsToastOpen] = useState<boolean>(false);

  // Form Modal States
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>('');
  
  // Form Fields
  const [formNumber, setFormNumber] = useState<string>('');
  const [formRecipient, setFormRecipient] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formDueDate, setFormDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [formNotes, setFormNotes] = useState<string>('');
  const [formStatus, setFormStatus] = useState<'Draft' | 'Sent' | 'Paid' | 'Cancelled'>('Draft');
  const [formItems, setFormItems] = useState<InvoiceItem[]>([
    { description: '', quantity: 1, price: 0, amount: 0 }
  ]);
  const [formType, setFormType] = useState<'Faktur' | 'Penerimaan' | 'Pengeluaran'>('Faktur');
  const [formSchoolUnit, setFormSchoolUnit] = useState<'SMP' | 'SMA' | 'Umum'>('Umum');

  // Preview Modal States
  const [isPreviewOpen, setIsPreviewOpen] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [previewType, setPreviewType] = useState<'Faktur' | 'Penerimaan' | 'Pengeluaran'>('Faktur');

  // Load Invoices
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error("Gagal memuat invoice:", err);
      showToast("Gagal memuat daftar faktur dari database.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Display toast handler
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setIsToastOpen(true);
    setTimeout(() => {
      setIsToastOpen(false);
    }, 4000);
  };

  // Convert Firebase/mixed dates safely
  const toJSDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp.toDate) return timestamp.toDate();
    if (timestamp instanceof Date) return timestamp;
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
    return new Date();
  };

  // Autocalculate values for items
  const handleItemFieldChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...formItems];
    const item = { ...updatedItems[index] };
    
    if (field === 'quantity') {
      item.quantity = Math.max(1, parseInt(value, 10) || 1);
    } else if (field === 'price') {
      item.price = Math.max(0, parseFloat(value) || 0);
    } else if (field === 'description') {
      item.description = value;
    }
    
    item.amount = item.quantity * item.price;
    updatedItems[index] = item;
    setFormItems(updatedItems);
  };

  // Form helper: Add Item row
  const addFormItem = () => {
    setFormItems([...formItems, { description: '', quantity: 1, price: 0, amount: 0 }]);
  };

  // Form helper: Remove Item row
  const removeFormItem = (index: number) => {
    if (formItems.length === 1) {
      showToast("Faktur harus memiliki minimal satu baris item.", 'error');
      return;
    }
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Calculate Form Total
  const formTotalValue = useMemo(() => {
    return formItems.reduce((sum, item) => sum + item.amount, 0);
  }, [formItems]);

  // Handle dynamically changing type in form
  const handleTypeChange = async (type: 'Faktur' | 'Penerimaan' | 'Pengeluaran') => {
    setFormType(type);
    if (!editId) {
      showToast(`Mengambil nomor seri baru...`, "success");
      try {
        const num = await generateInvoiceNumber(type);
        setFormNumber(num);
      } catch (err) {
        console.error(err);
        const prefix = type === 'Penerimaan' ? 'BKM' : type === 'Pengeluaran' ? 'BKK' : 'INV';
        setFormNumber(`${prefix}/${new Date().getFullYear()}/001`);
      }
    }
  };

  // Handle opening New Invoice Modal (triggers sequential identifier)
  const openNewInvoiceModal = async () => {
    setEditId(null);
    setFormRecipient('');
    setFormDate(new Date().toISOString().split('T')[0]);
    
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setFormDueDate(d.toISOString().split('T')[0]);
    
    setFormNotes('');
    setFormStatus('Draft');
    setFormType('Faktur');
    setFormSchoolUnit('Umum');
    setFormItems([{ description: '', quantity: 1, price: 0, amount: 0 }]);
    setFormError('');
    
    showToast("Menginisialisasi nomor faktur baru...", "success");
    try {
      const num = await generateInvoiceNumber('Faktur');
      setFormNumber(num);
      setIsFormOpen(true);
    } catch (err) {
      console.error(err);
      setFormNumber(`INV/${new Date().getFullYear()}/001`);
      setIsFormOpen(true);
    }
  };

  // Handle opening Edit Modal
  const openEditInvoiceModal = (inv: Invoice) => {
    setEditId(inv.id);
    setFormNumber(inv.invoiceNumber);
    setFormRecipient(inv.recipient);
    setFormDate(toJSDate(inv.date).toISOString().split('T')[0]);
    setFormDueDate(toJSDate(inv.dueDate).toISOString().split('T')[0]);
    setFormNotes(inv.notes || '');
    setFormStatus(inv.status);
    setFormType(inv.type || 'Faktur');
    setFormSchoolUnit(inv.schoolUnit || 'Umum');
    setFormItems(inv.items && inv.items.length > 0 ? inv.items : [{ description: '', quantity: 1, price: 0, amount: 0 }]);
    setFormError('');
    setIsFormOpen(true);
  };

  // Handle Form Submission
  const handleSaveInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formRecipient.trim()) {
      const label = formType === 'Faktur' ? 'Nama Penerima / Donatur' :
                    formType === 'Penerimaan' ? 'Nama Pengirim / Pembayar' :
                    'Nama Penerima Dana';
      setFormError(`${label} wajib diisi.`);
      return;
    }

    // Validate items
    const hasInvalidItem = formItems.some(i => !i.description.trim() || i.price <= 0);
    if (hasInvalidItem) {
      setFormError('Semua baris item wajib memiliki keterangan deskripsi dan nominal harga satuan > 0.');
      return;
    }

    try {
      if (editId) {
        await updateInvoice(
          editId,
          formRecipient,
          new Date(formDate),
          new Date(formDueDate),
          formItems,
          formTotalValue,
          formNotes,
          formStatus,
          formType,
          formSchoolUnit
        );
        const labelText = formType === 'Faktur' ? 'faktur' :
                          formType === 'Penerimaan' ? 'kwitansi penerimaan' :
                          'bukti kas pengeluaran';
        showToast(`Berhasil memperbarui data ${labelText}.`);
      } else {
        await createInvoice(
          formNumber,
          formRecipient,
          new Date(formDate),
          new Date(formDueDate),
          formItems,
          formTotalValue,
          formNotes,
          formStatus,
          formType,
          formSchoolUnit
        );
        const labelText = formType === 'Faktur' ? 'faktur' :
                          formType === 'Penerimaan' ? 'kwitansi penerimaan' :
                          'bukti kas pengeluaran';
        showToast(`Berhasil menyimpan ${labelText} baru ke database.`);
      }
      setIsFormOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      setFormError('Terjadi kesalahan saat menyimpan data. Silakan coba kembali.');
    }
  };

  // Handle Deleting Invoice
  const handleDeleteInvoice = async (id: string, number: string) => {
    if (window.confirm(`Apakah Anda yakin ingin menghapus faktur #${number}?`)) {
      try {
        await deleteInvoice(id);
        showToast(`Faktur #${number} berhasil dihapus.`);
        loadData();
      } catch (err) {
        console.error(err);
        showToast(`Gagal menghapus faktur.`, 'error');
      }
    }
  };

  // Quick state toggling directly from table lists
  const handleToggleStatus = async (id: string, currentStatus: Invoice['status']) => {
    const nextStatusMap: Record<Invoice['status'], Invoice['status']> = {
      'Draft': 'Sent',
      'Sent': 'Paid',
      'Paid': 'Cancelled',
      'Cancelled': 'Draft'
    };
    const next = nextStatusMap[currentStatus];
    try {
      await updateInvoiceStatus(id, next);
      showToast(`Status faktur diperbarui menjadi ${next.toUpperCase()}.`);
      loadData();
    } catch (err) {
      console.error(err);
      showToast("Gagal mengubah status faktur.", "error");
    }
  };

  // High-fidelity PDF Downloader
  const handleDownloadInvoicePDF = async (inv: Invoice) => {
    setSelectedInvoice(inv);
    setPdfLoading(true);
    
    // Give state a fraction of a second to render
    await new Promise((resolve) => setTimeout(resolve, 300));
    const element = document.getElementById('rendered-invoice-pdf-paper');
    if (!element) {
      alert("Gagal menemukan elemen pratinjau cetak.");
      setPdfLoading(false);
      return;
    }

    const stylesheetBackups: { sheet: CSSStyleSheet; node: HTMLElement | null; originalSheetDisabled: boolean; originalNodeDisabled: boolean }[] = [];
    let tempStyleEl: HTMLStyleElement | null = null;
    const originalGetComputedStyle = window.getComputedStyle;
    
    try {
      // 1. Override computed style live for oklch colors parsing errors inside html2canvas library
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

      // 2. Transpile all active stylesheets to generic hex strings
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

      // Replace oklch/oklab rules in CSS string
      const replacedCss = combinedCss
        .replace(/oklch\(([^)]+)\)/gi, (match) => oklchToHsl(match))
        .replace(/oklab\(([^)]+)\)/gi, (match) => oklabToRgb(match));

      // Inject sanitized style tags
      tempStyleEl = document.createElement('style');
      tempStyleEl.id = 'temp-invoice-pdf-style';
      tempStyleEl.textContent = replacedCss;
      document.head.appendChild(tempStyleEl);

      const canvas = await html2canvas(element, {
        scale: 2, // 2x high-resolution rendering
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
      const margin = 12; // 12mm padding margins
      const printableWidth = pdfWidth - (margin * 2);
      const imgWidth = printableWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, 12, imgWidth, imgHeight);

      const pdfType = selectedInvoice?.id === inv.id ? previewType : (inv.type || 'Faktur');
      const prefixClean = pdfType === 'Penerimaan' ? 'KWITANSI_MASUK' : pdfType === 'Pengeluaran' ? 'KAS_KELUAR' : 'FAKTUR';
      const typeLabel = pdfType === 'Penerimaan' ? 'Kwitansi Masuk' : pdfType === 'Pengeluaran' ? 'Kas Keluar' : 'Faktur';
      const formattedNumClean = inv.invoiceNumber.replace(/\//g, '_');
      pdf.save(`${prefixClean}_${formattedNumClean}.pdf`);
      showToast(`Dokumen digital ${typeLabel} ${inv.invoiceNumber} berhasil diunduh.`);
    } catch (err) {
      console.error("Gagal cetak invoice:", err);
      showToast("Gagal mencetak dokumen PDF.", "error");
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
          console.warn("Error restoring stylesheets:", e);
        }
      }
      setPdfLoading(false);
    }
  };

  // Memoized lists handling search & filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      // Unit restriction check
      if (!isUnitAllowed(inv.schoolUnit || 'Umum')) return false;

      const matchSearch = 
        inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
        inv.recipient.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchStatus = statusFilter === 'All' ? true : inv.status === statusFilter;
      const matchUnit = unitFilter === 'All' ? true : (inv.schoolUnit || 'Umum') === unitFilter;
      
      return matchSearch && matchStatus && matchUnit;
    });
  }, [invoices, searchTerm, statusFilter, unitFilter, isUnitAllowed]);

  // Overall Financial stats calculating
  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalUnpaid = 0;
    let totalPaid = 0;

    const baseList = unitFilter === 'All' ? invoices : invoices.filter(i => (i.schoolUnit || 'Umum') === unitFilter);
    const targetList = baseList.filter(inv => isUnitAllowed(inv.schoolUnit || 'Umum'));

    targetList.forEach(inv => {
      totalInvoiced += inv.total || 0;
      if (inv.status === 'Paid') {
        totalPaid += inv.total || 0;
      } else if (inv.status === 'Draft' || inv.status === 'Sent') {
        totalUnpaid += inv.total || 0;
      }
    });

    return { totalInvoiced, totalUnpaid, totalPaid };
  }, [invoices, unitFilter, isUnitAllowed]);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Faktur & Bukti Kas</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Kelola tagihan, pencatatan bukti donasi, dan pengeluaran</p>
        </div>
        <button 
          onClick={openNewInvoiceModal}
          className="w-full sm:w-auto bg-natural-primary hover:opacity-90 text-white px-6 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all font-semibold shadow-sm text-xs cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Buat Faktur Baru
        </button>
      </div>

      {/* KPI METADATA PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-150 flex items-center justify-center text-slate-800 shrink-0">
            <DollarSign className="w-5 h-5 text-slate-500" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Ditagihkan (Kolektif)</p>
            <p className="text-2xl font-serif text-natural-primary mt-0.5">{formatRupiah(stats.totalInvoiced)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sisa Belum Diterima</p>
            <p className="text-2xl font-serif text-amber-600 mt-0.5">{formatRupiah(stats.totalUnpaid)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Sudah Diselesaikan (Diterima)</p>
            <p className="text-2xl font-serif text-emerald-600 mt-0.5">{formatRupiah(stats.totalPaid)}</p>
          </div>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-white p-4 rounded-3xl border border-natural-border shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="relative w-full lg:max-w-xs shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Cari nomor faktur atau nama penerima..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:outline-none transition-all text-xs"
          />
        </div>
        
        <div className="flex flex-wrap lg:flex-nowrap gap-3 items-center w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {/* Unit filters */}
          <div className="flex gap-1.5 shrink-0">
            {(['All', 'SMP', 'SMA', 'Umum'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnitFilter(u)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer",
                  unitFilter === u
                    ? "bg-slate-800 text-white border-slate-800 font-bold"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                )}
              >
                {u === 'All' ? 'Consolidated' : u}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-slate-200 hidden lg:block"></div>

          {/* Status filters scrollable on mobile */}
          <div className="flex gap-1.5 shrink-0">
            {(['All', 'Draft', 'Sent', 'Paid', 'Cancelled'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border",
                  statusFilter === filter
                    ? "bg-natural-primary text-white border-natural-primary"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                )}
              >
                {filter === 'All' ? 'Semua Faktur' : filter.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* INVOICE MASTER TABLE */}
      <div className="bg-white rounded-3xl border border-natural-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center space-y-3">
            <div className="w-10 h-10 border-4 border-natural-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-slate-400 uppercase tracking-widest">Mengambil arsip dokumen...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-16 text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-slate-50 border border-slate-150 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-5 h-5" />
            </div>
            <p className="text-slate-700 font-serif text-lg font-medium">Belum Ada Faktur Terdaftar</p>
            <p className="text-xs text-slate-400 mt-2">
              Tidak ada arsip dokumen yang memenuhi kriteria pencarian atau filter Anda. Klik "Buat Faktur Baru" untuk memulai.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-55 bg-slate-50 border-b border-natural-border text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  <th className="px-6 py-4">Nomor Dokumen</th>
                  <th className="px-6 py-4">Penerima / Donatur / Kontak</th>
                  <th className="px-6 py-4">Tanggal Penerbitan</th>
                  <th className="px-6 py-4">Status & Alur</th>
                  <th className="px-6 py-4 text-right">Total Transaksi</th>
                  <th className="px-6 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 font-mono text-xs">{inv.invoiceNumber}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className={cn(
                          "text-[8.5px] font-bold uppercase w-max px-1.5 py-0.5 rounded-md",
                          inv.type === 'Penerimaan' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                          inv.type === 'Pengeluaran' ? "bg-rose-50 text-rose-700 border border-rose-100" :
                          "bg-blue-50 text-blue-700 border border-blue-100"
                        )}>
                          {inv.type === 'Penerimaan' ? 'Kwitansi Masuk' :
                           inv.type === 'Pengeluaran' ? 'Kas Keluar' :
                           'Faktur'}
                        </span>
                        
                        <span className={cn(
                          "text-[8.5px] font-bold uppercase w-max px-1.5 py-0.5 rounded-md border",
                          (inv.schoolUnit || 'Umum') === 'SMP' ? "bg-sky-50 text-sky-700 border-sky-100" :
                          (inv.schoolUnit || 'Umum') === 'SMA' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                          "bg-slate-50 text-slate-700 border-slate-100"
                        )}>
                          {inv.schoolUnit || 'Umum'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-700 font-semibold text-xs">{inv.recipient}</div>
                      <div className="text-[9px] text-slate-400 font-medium">
                        {inv.type === 'Penerimaan' ? 'Disetor Oleh' :
                         inv.type === 'Pengeluaran' ? 'Diserahkan Ke' :
                         'Ditagihkan Ke'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                      {toJSDate(inv.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        type="button"
                        onClick={() => handleToggleStatus(inv.id, inv.status)}
                        className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-bold uppercase flex items-center gap-1 transition-all hover:scale-[1.03] select-none cursor-pointer",
                          inv.status === 'Paid' ? "bg-emerald-100 text-emerald-800" :
                          inv.status === 'Sent' ? "bg-blue-100 text-blue-800" :
                          inv.status === 'Cancelled' ? "bg-rose-100 text-rose-800" :
                          "bg-amber-100 text-amber-800"
                        )}
                        title="Klik untuk mengubah status cepat"
                      >
                        {inv.status === 'Paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {inv.status === 'Paid' ? 'LUNAS' : 
                         inv.status === 'Sent' ? 'TERKIRIM' : 
                         inv.status === 'Cancelled' ? 'DIBATALKAN' : 'DRAFT'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-slate-900 text-xs">
                      {formatRupiah(inv.total)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        {/* Eye icon for detail preview */}
                        <button 
                          onClick={() => { setSelectedInvoice(inv); setPreviewType(inv.type || 'Faktur'); setIsPreviewOpen(true); }}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 cursor-pointer"
                          title="Pratinjau Cetak"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        
                        {/* Edit icon */}
                        <button 
                          onClick={() => openEditInvoiceModal(inv)}
                          className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 cursor-pointer"
                          title="Ubah Faktur"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Direct print PDF icon */}
                        <button 
                          disabled={pdfLoading}
                          onClick={() => handleDownloadInvoicePDF(inv)}
                          className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 cursor-pointer disabled:opacity-50"
                          title="Unduh PDF Resmi"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        
                        {/* Trash icon for deleting */}
                        <button 
                          onClick={() => handleDeleteInvoice(inv.id, inv.invoiceNumber)}
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-500 cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CRITICAL ACTIONS: FLOATING NOTIFICATIONS (TOASTS) */}
      <AnimatePresence>
        {isToastOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-50 p-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-800 max-w-sm ml-6"
          >
            {toastType === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <p className="text-xs font-sans font-medium line-clamp-2 leading-relaxed">{toastMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 1: FORM PENAMBAHAN & EDITING FAKTUR */}
      <AnimatePresence>
        {isFormOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-3xl w-full my-8 text-slate-800 font-sans overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-natural-border bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      {editId 
                        ? `Ubah ${formType === 'Faktur' ? 'Faktur' : formType === 'Penerimaan' ? 'Kwitansi Masuk' : 'Bukti Kas Keluar'} #${formNumber}` 
                        : `Buat ${formType === 'Faktur' ? 'Faktur' : formType === 'Penerimaan' ? 'Kwitansi Masuk' : 'Bukti Kas Keluar'} Baru`
                      }
                    </h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold mt-0.5">Sistem Penerbitan Dokumen Keuangan Resmi</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveInvoice} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                {formError && (
                  <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-start gap-3 text-xs leading-relaxed">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>{formError}</div>
                  </div>
                )}

                {/* Jenis Dokumen Selector */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kategori Dokumen</span>
                    <p className="text-[11px] text-slate-500 font-medium">Tentukan jenis bukti keuangan yang dicatat</p>
                  </div>
                  <div className="flex gap-1.5 w-full sm:w-auto">
                    {(['Faktur', 'Penerimaan', 'Pengeluaran'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => handleTypeChange(t)}
                        className={cn(
                          "flex-1 sm:flex-initial px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer",
                          formType === t
                            ? t === 'Faktur' ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100" :
                              t === 'Penerimaan' ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-100" :
                              "bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-100"
                            : "bg-white hover:bg-slate-50 text-slate-605 border-slate-200"
                        )}
                      >
                        {t === 'Faktur' ? 'Faktur' : t === 'Penerimaan' ? 'Kwitansi Masuk' : 'Kas Keluar'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Meta Fields */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {formType === 'Faktur' ? 'Nomor Faktur' : formType === 'Penerimaan' ? 'Nomor Bukti Kas Masuk (BKM)' : 'Nomor Bukti Kas Keluar (BKK)'}
                    </label>
                    <input 
                      type="text"
                      disabled
                      value={formNumber}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 font-mono text-xs cursor-not-allowed font-semibold focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Unit Sekolah</label>
                    <select
                      value={formSchoolUnit}
                      onChange={(e) => setFormSchoolUnit(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-natural-primary text-xs cursor-pointer"
                    >
                      <option value="Umum">Umum (Gabungan)</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA">SMA</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tanggal Penerbitan</label>
                    <input 
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-natural-primary text-xs font-mono"
                    />
                  </div>

                  <div className={cn("space-y-1.5", formType === 'Faktur' ? "" : "md:col-span-2")}>
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {formType === 'Faktur' ? 'Nama Penerima / Donatur' :
                       formType === 'Penerimaan' ? 'Diterima Dari (Instansi / Pribadi Pembayar)' :
                       'Diserahkan Kepada (Nama Penerima Dana)'}
                    </label>
                    <input 
                      type="text"
                      placeholder={
                        formType === 'Faktur' ? 'Masukkan nama donatur/institusi...' :
                        formType === 'Penerimaan' ? 'Masukkan nama donatur atau pembayar...' :
                        'Masukkan nama penerima kas/dana...'
                      }
                      value={formRecipient}
                      onChange={(e) => setFormRecipient(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-natural-primary text-xs"
                    />
                  </div>

                  {formType === 'Faktur' && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Tanggal Jatuh Tempo</label>
                      <input 
                        type="date"
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-natural-primary text-xs font-mono"
                      />
                    </div>
                  )}
                </div>

                {/* INVOICE DETAIL ITEMS */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {formType === 'Faktur' ? 'Daftar Keperluan / Item Yang Ditagihkan' :
                       formType === 'Penerimaan' ? 'Rincian Penerimaan Dana / Sumbangan' :
                       'Rincian Pengeluaran Dana / Alokasi Kas'}
                    </label>
                    <button
                      type="button"
                      onClick={addFormItem}
                      className="text-xs text-natural-primary hover:opacity-80 font-bold flex items-center gap-1.5 cursor-pointer bg-slate-50 px-3 py-1 rounded-lg border border-slate-200"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Tambah Baris
                    </button>
                  </div>

                  <div className="space-y-2">
                    {formItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 bg-slate-50 border border-slate-150 rounded-2xl items-center relative pr-10 sm:pr-3">
                        <div className="sm:col-span-5 space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block sm:hidden">Deskripsi</span>
                          <input 
                            type="text"
                            placeholder={
                              formType === 'Faktur' ? 'Deskripsi rincian (e.g., SPP, Donasi Masuk)...' :
                              formType === 'Penerimaan' ? 'Keterangan donasi (e.g., Zakat Mal, Sedekah Dakwah)...' :
                              'Peruntukan belanja (e.g., ATK Kantor, Biaya Logistik)...'
                            }
                            value={item.description}
                            onChange={(e) => handleItemFieldChange(idx, 'description', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 focus:outline-none text-xs"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block sm:hidden">Qty</span>
                          <input 
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleItemFieldChange(idx, 'quantity', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 focus:outline-none text-xs text-center font-mono"
                          />
                        </div>
                        <div className="sm:col-span-3 space-y-1">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block sm:hidden">Harga Satuan (Rp)</span>
                          <input 
                            type="number"
                            placeholder="Harga satuan..."
                            value={item.price || ''}
                            onChange={(e) => handleItemFieldChange(idx, 'price', e.target.value)}
                            className="w-full px-3 py-1.5 rounded-lg bg-white border border-slate-200 focus:outline-none text-xs font-mono"
                          />
                        </div>
                        <div className="sm:col-span-2 text-right">
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold block sm:hidden text-left mb-1">Subtotal</span>
                          <span className="font-mono font-bold text-slate-900 text-xs text-right block pr-2">
                            {formatRupiah(item.amount)}
                          </span>
                        </div>
                        
                        {/* Remove item absolute action */}
                        <button
                          type="button"
                          onClick={() => removeFormItem(idx)}
                          className="absolute right-2 top-2 sm:static p-1 bg-white hover:bg-red-50 border border-slate-150 rounded-lg text-rose-500 cursor-pointer"
                          title="Hapus baris"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Cumulative Total */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex justify-between items-center">
                    <p className="text-xs font-bold text-slate-600">Total Keseluruhan</p>
                    <p className="font-serif font-bold text-lg text-slate-900">{formatRupiah(formTotalValue)}</p>
                  </div>
                </div>

                {/* Additional notes/Status fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Status Faktur</label>
                    <select 
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-natural-primary text-xs"
                    >
                      <option value="Draft">Draft (Arsip Internal)</option>
                      <option value="Sent">Sent (Terkirim Ke Donatur)</option>
                      <option value="Paid">Paid (Sudah Melunasi Pembayaran)</option>
                      <option value="Cancelled">Cancelled (Dibatalkan)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Catatan Tambahan & Informasi Rekening</label>
                    <textarea 
                      placeholder="Tambahkan info memo pembayaran, no rekening bank, atau instruksi donasi kepada penerima..."
                      rows={3}
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 focus:outline-none focus:border-natural-primary text-xs leading-relaxed"
                    />
                  </div>
                </div>

                {/* Action Footer */}
                <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="py-2.5 px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full font-bold text-xs cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-6 bg-natural-primary hover:opacity-90 text-white rounded-full font-bold text-xs cursor-pointer"
                  >
                    Simpan Dokumen
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: PRATINJAU / DETAIL PREVIEW DOKUMEN FAKTUR */}
      <AnimatePresence>
        {isPreviewOpen && selectedInvoice && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-2xl w-full my-8 text-slate-800 font-sans overflow-hidden"
            >
              {/* Header bar controls */}
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-widest font-mono pl-2">
                  Pratinjau Cetak: {selectedInvoice.invoiceNumber}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadInvoicePDF(selectedInvoice)}
                    disabled={pdfLoading}
                    className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{pdfLoading ? 'Menyusun PDF...' : 'Unduh PDF'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPreviewOpen(false)}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer border border-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Template switcher tabs */}
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Format Dokumen Cetak:</span>
                <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
                  {(['Faktur', 'Penerimaan', 'Pengeluaran'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setPreviewType(t)}
                      className={cn(
                        "flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer text-center",
                        previewType === t
                          ? "bg-white text-slate-800 shadow-sm"
                          : "text-slate-500 hover:text-slate-700 font-medium"
                      )}
                    >
                      {t === 'Faktur' ? 'Faktur Resmi' : t === 'Penerimaan' ? 'Kwitansi Masuk (BKM)' : 'Kas Keluar (BKK)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Printable Body Wrap */}
              <div className="p-6 max-h-[60vh] overflow-y-auto bg-slate-100">
                {/* Visual rendering simulation on white paper container */}
                <div 
                  id="rendered-invoice-pdf-paper"
                  className="bg-white border rounded-2xl shadow-md p-8 md:p-10 text-slate-850 space-y-6 text-xs leading-relaxed max-w-[800px] mx-auto min-h-[142mm]"
                >
                  {/* KOP SURAT */}
                  <div className="text-center border-b-2 border-double border-slate-900 pb-5 space-y-1">
                    <h2 className="text-xl font-bold font-serif uppercase tracking-normal text-slate-900">SEKOLAH CENDEKIA BAZNAS</h2>
                    <p className="text-[10px] font-sans text-slate-500 uppercase tracking-widest font-semibold">Sistem Informasi Akuntansi</p>
                    <p className="text-[9px] text-slate-400 font-sans leading-relaxed">Jl. KH. Umar Cirangkong Ds. Cempang No. 14 Kec. Cibungbulang Kab. Bogor.</p>
                  </div>

                  {/* Header Title Information */}
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div className="space-y-1">
                      <p className="font-bold text-sm uppercase text-slate-900 tracking-wider">
                        {previewType === 'Faktur' ? 'FAKTUR TAGIHAN & INVOICE' :
                         previewType === 'Penerimaan' ? 'KWITANSI PENERIMAAN KAS' :
                         'BUKTI PENGELUARAN KAS'}
                      </p>
                      <p className="text-[9px] text-slate-500 flex items-center gap-1">
                        <span>Nomor Dokumen:</span>
                        <span className="font-mono font-bold text-slate-900 text-xs">{selectedInvoice.invoiceNumber}</span>
                      </p>
                      <p className="text-[9px] text-slate-500">
                        Status Pembayaran:&nbsp;
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[8.5px] font-bold uppercase",
                          selectedInvoice.status === 'Paid' ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        )}>
                          {selectedInvoice.status === 'Paid' ? 'LUNAS' : selectedInvoice.status.toUpperCase()}
                        </span>
                      </p>
                    </div>

                    <div className="text-left sm:text-right text-[9px] text-slate-500 space-y-0.5 font-sans">
                      <p>Tanggal Transaksi: <span className="font-bold text-slate-900 font-mono text-xs">{toJSDate(selectedInvoice.date).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></p>
                      {previewType === 'Faktur' && (
                        <p>Jatuh Tempo: <span className="font-bold text-slate-900 font-mono text-xs">{toJSDate(selectedInvoice.dueDate).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span></p>
                      )}
                    </div>
                  </div>

                  {/* Recipient / Payee / Payor Box Info */}
                  <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs font-sans">
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold min-w-[140px] block">
                        {previewType === 'Faktur' ? 'Ditagihkan Kepada:' :
                         previewType === 'Penerimaan' ? 'Telah Diterima Dari:' :
                         'Dibayarkan Kepada:'}
                      </span>
                      <p className="font-bold text-sm text-slate-905">{selectedInvoice.recipient}</p>
                    </div>

                    {(previewType === 'Penerimaan' || previewType === 'Pengeluaran') && (
                      <div className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 pt-2.5 border-t border-slate-100 text-xs font-sans">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold min-w-[140px] block pt-0.5">Uang Sejumlah (Terbilang):</span>
                        <div className="flex-1 bg-emerald-50/50 border border-emerald-100 rounded-xl px-3 py-2 text-emerald-800 font-serif italic text-xs font-semibold leading-relaxed">
                          " {terbilang(selectedInvoice.total)} "
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Items Sub-table rendered */}
                  <table className="w-full text-left border-collapse border border-slate-200">
                    <thead>
                      <tr className="bg-slate-50 text-[9px] font-bold text-slate-700 uppercase tracking-wider border-b border-slate-200">
                        <th className="p-2.5 border-r border-slate-200 text-center w-8">No</th>
                        <th className="p-2.5 border-r border-slate-200">
                          {previewType === 'Faktur' ? 'Deskripsi Detail Keperluan / Rincian Tagihan' :
                           previewType === 'Penerimaan' ? 'Rincian Penerimaan Dana / Sumbangan' :
                           'Rincian Penggunaan Dana / Pos Anggaran'}
                        </th>
                        <th className="p-2.5 border-r border-slate-200 text-center w-12">Qty</th>
                        <th className="p-2.5 border-r border-slate-200 text-right w-28">Harga Satuan</th>
                        <th className="p-2.5 text-right w-28">Total Harga</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 border-b border-slate-250 text-[9px]">
                      {(selectedInvoice.items && selectedInvoice.items.length > 0 ? selectedInvoice.items : []).map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-2.5 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                          <td className="p-2.5 border-r border-slate-200 font-medium text-slate-800">{item.description}</td>
                          <td className="p-2.5 border-r border-slate-200 text-center font-mono">{item.quantity}</td>
                          <td className="p-2.5 border-r border-slate-200 text-right font-mono text-slate-500">
                            {formatRupiah(item.price)}
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {formatRupiah(item.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Cumulative highlighting layout */}
                  <div className="flex justify-end pt-1">
                    <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl flex justify-between items-center gap-6 min-w-[220px]">
                      <span className="text-[9px] uppercase font-bold text-slate-500">TOTAL TRANSAKSI:</span>
                      <span className="font-mono font-bold text-slate-900 text-base">
                        {formatRupiah(selectedInvoice.total)}
                      </span>
                    </div>
                  </div>

                  {/* Notes / Terms */}
                  {selectedInvoice.notes && (
                    <div className="pt-2 border-t border-slate-100">
                      <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider font-sans block mb-1">Keterangan / Catatan Tambahan:</span>
                      <p className="text-[9px] text-slate-500 leading-relaxed font-sans bg-slate-50/50 p-2.5 border border-slate-150 rounded-xl whitespace-pre-line italic">
                        {selectedInvoice.notes}
                      </p>
                    </div>
                  )}

                  {/* Warning / Disclaimers */}
                  <div className="pt-2">
                    <p className="text-[8px] text-slate-400 leading-relaxed font-sans italic">
                      * Dokumen ini sah dan dikeluarkan secara resmi dari basis data Sistem Informasi Akuntansi Sekolah Cendekia Baznas. Tanda tangan di bawah adalah representasi persetujuan administratif internal kepengurusan keuangan sekolah.
                    </p>
                  </div>

                  {/* Signatures */}
                  <div className={cn(
                    "grid gap-12 pt-8 text-center font-sans",
                    previewType === 'Pengeluaran' ? "grid-cols-3" : "grid-cols-2"
                  )}>
                    {previewType === 'Penerimaan' ? (
                      <>
                        <div className="space-y-14">
                          <p className="text-[9px] font-sans font-semibold text-slate-500 uppercase tracking-widest text-center">Penyetor / Pembayar,</p>
                          <div className="space-y-1">
                            <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[130px] text-center">
                              {selectedInvoice.recipient}
                            </p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold text-center">Pihak Luar / Donatur</p>
                          </div>
                        </div>
                        <div className="space-y-14">
                          <p className="text-[9px] font-sans font-semibold text-slate-500 uppercase tracking-widest text-center font-mono">Penerima Kasir,</p>
                          <div className="space-y-1">
                            <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[130px] text-center">
                              {auth.currentUser?.email ? auth.currentUser.email.split('@')[0].toUpperCase() : 'BENDAHARA SEKOLAH'}
                            </p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold text-center">Keuangan SCB</p>
                          </div>
                        </div>
                      </>
                    ) : previewType === 'Pengeluaran' ? (
                      <>
                        <div className="space-y-14">
                          <p className="text-[9px] font-sans font-semibold text-slate-500 uppercase tracking-widest text-center">Penerima Dana,</p>
                          <div className="space-y-1">
                            <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[130px] text-center">
                              {selectedInvoice.recipient}
                            </p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold text-center">Penerima Logistik</p>
                          </div>
                        </div>
                        <div className="space-y-14">
                          <p className="text-[9px] font-sans font-semibold text-slate-500 uppercase tracking-widest text-center">Dibayar Oleh,</p>
                          <div className="space-y-1">
                            <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[130px] text-center">
                              {auth.currentUser?.email ? auth.currentUser.email.split('@')[0].toUpperCase() : 'BENDAHARA SEKOLAH'}
                            </p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold text-center">Bendahara Sekolah</p>
                          </div>
                        </div>
                        <div className="space-y-14">
                          <p className="text-[9px] font-sans font-semibold text-slate-500 uppercase tracking-widest text-center">Disetujui,</p>
                          <div className="space-y-1">
                            <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[130px] text-center">KEPALA SEKOLAH</p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold text-center">Cendekia Baznas</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-14">
                          <p className="text-[9px] font-sans font-semibold text-slate-500 uppercase tracking-widest text-center">Dibuat Oleh,</p>
                          <div className="space-y-1">
                            <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[130px] text-center">
                              {auth.currentUser?.email ? auth.currentUser.email.split('@')[0].toUpperCase() : 'BENDAHARA SEKOLAH'}
                            </p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold text-center">Administrasi Keuangan</p>
                          </div>
                        </div>
                        <div className="space-y-14">
                          <p className="text-[9px] font-sans font-semibold text-slate-500 uppercase tracking-widest text-center">Mengetahui & Menyetujui,</p>
                          <div className="space-y-1">
                            <p className="font-bold border-b border-slate-400 pb-1 inline-block min-w-[130px] text-center">KEPALA SEKOLAH</p>
                            <p className="text-[8px] text-slate-400 uppercase tracking-wider font-semibold text-center">Sekolah Cendekia Baznas</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
