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
  AlertCircle
} from 'lucide-react';
import { cn, formatRupiah } from '../lib/utils';
import { 
  getDebts, 
  createDebt, 
  addDebtPayment, 
  updateDebtDetails, 
  deleteDebt 
} from '../services/debtService';
import { DebtReceivable, DebtPayment } from '../types';
import { auth } from '../lib/firebase';

export default function HutangPiutang() {
  const [debts, setDebts] = useState<DebtReceivable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<'All' | 'Hutang' | 'Piutang'>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All'); // All, Lunas, Belum Lunas, Sebagian, Overdue
  const [sortBy, setSortBy] = useState<'date-desc' | 'date-asc' | 'remaining-desc' | 'dueDate-asc'>('date-desc');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  
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

  // Form Fields for Payment
  const [payDate, setPayDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNotes, setPayNotes] = useState<string>('');

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getDebts();
      setDebts(data);
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

    debts.forEach((d) => {
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
  }, [debts]);

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
    if (formDownPayment < 0) {
      setFormError('Uang muka tidak boleh negatif!');
      return;
    }
    if (formDownPayment > formTotal) {
      setFormError('Uang muka tidak boleh melebihi nilai nominal transaksi!');
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
          downPayment: formDownPayment,
          remarks: formRemarks
        });
        showToast('Berhasil mengubah data transaksi.');
      } else {
        await createDebt(
          formType,
          formName,
          dDate,
          dDueDate,
          formTotal,
          formDownPayment,
          formRemarks,
          userId
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
    setFormError('');
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
        payNotes
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

  // Processing, filtering & sorting list
  const filteredAndSortedDebts = React.useMemo(() => {
    return debts
      .filter((d) => {
        const matchesQuery = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             (d.remarks && d.remarks.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesType = filterType === 'All' ? true : d.type === filterType;
        
        let matchesStatus = true;
        if (filterStatus === 'Lunas') matchesStatus = d.status === 'Lunas';
        else if (filterStatus === 'Belum Lunas') matchesStatus = d.status === 'Belum Lunas';
        else if (filterStatus === 'Sebagian') matchesStatus = d.status === 'Sebagian';
        else if (filterStatus === 'Overdue') matchesStatus = isOverdue(d);

        return matchesQuery && matchesType && matchesStatus;
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
  }, [debts, searchQuery, filterType, filterStatus, sortBy]);

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
        <button 
          onClick={() => { resetForm(); setIsAddEditOpen(true); }}
          className="bg-natural-primary hover:opacity-90 text-white px-6 py-2.5 rounded-full flex items-center gap-2 transition-all font-semibold shadow-sm text-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> Catat Transaksi Baru
        </button>
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
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 italic font-sans text-xs">
                    Memuat data monitoring hutang & piutang...
                  </td>
                </tr>
              ) : filteredAndSortedDebts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-400 italic font-sans text-xs">
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
                      <td className="px-6 py-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase",
                            item.type === 'Piutang' ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                          )}>
                            {item.type}
                          </span>
                          {isPastDue && (
                            <span className="bg-rose-50 border border-rose-200 text-rose-600 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Jatuh Tempo
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-slate-800 text-sm font-sans">{item.name}</p>
                        <p className="text-[10px] text-gray-400 font-sans max-w-xs truncate">{item.remarks || 'Tanpa keterangan'}</p>
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
                            className="p-2 border border-natural-border hover:bg-slate-50 rounded-xl text-slate-500 transition-colors"
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

                {/* Down payment DP */}
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
                        <p className="text-[9px] text-gray-400 flex items-center gap-1 pt-1">
                          <Calendar className="w-3 h-3 text-slate-300" />
                          {toJSDate(p.date || selectedDebt.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
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

    </div>
  );
}
