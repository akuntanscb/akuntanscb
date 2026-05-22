import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trash2, 
  RotateCcw, 
  Search, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  FileText, 
  Database, 
  Sliders, 
  Eye, 
  X, 
  Clock, 
  Calendar,
  User,
  Activity,
  ArrowRight
} from 'lucide-react';
import { getDeletedRecords, restoreDeletedRecord, wipeTrashRecord, emptyAllRecycleBin, DeletedRecord } from '../services/trashService';
import { useSettings } from '../context/SettingsContext';
import { formatRupiah, cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Trash() {
  const { settings } = useSettings();
  const [records, setRecords] = useState<DeletedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'journal_entries' | 'debts_receivables' | 'accounts'>('all');
  
  // Dialog / Detail viewer states
  const [selectedRecordForDetail, setSelectedRecordForDetail] = useState<DeletedRecord | null>(null);
  const [showConfirmEmpty, setShowConfirmEmpty] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getDeletedRecords();
      setRecords(data);
    } catch (err: any) {
      console.error(err);
      triggerStatus('Gagal memuat data tempat sampah.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const triggerStatus = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  const handleRestore = async (record: DeletedRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProcessingId(record.id);
    try {
      await restoreDeletedRecord(record);
      triggerStatus(`Berhasil memulihkan "${record.metadata.title}". Data telah dikembalikan ke posisi semula.`, 'success');
      // Update local state smoothly
      setRecords(prev => prev.filter(r => r.id !== record.id));
      if (selectedRecordForDetail?.id === record.id) {
        setSelectedRecordForDetail(null);
      }
    } catch (err: any) {
      console.error(err);
      triggerStatus(`Gagal memulihkan data: ${err.message || 'Izin ditolak'}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletePermanently = async (recordId: string, title: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm(`Apakah Anda yakin ingin menghapus "${title}" secara permanen? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }
    setProcessingId(recordId);
    try {
      await wipeTrashRecord(recordId);
      triggerStatus(`"${title}" telah dihapus permanen.`, 'success');
      setRecords(prev => prev.filter(r => r.id !== recordId));
      if (selectedRecordForDetail?.id === recordId) {
        setSelectedRecordForDetail(null);
      }
    } catch (err: any) {
      console.error(err);
      triggerStatus(`Gagal menghapus data: ${err.message || 'Izin ditolak'}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleEmptyBin = async () => {
    setProcessingId('all');
    try {
      await emptyAllRecycleBin(records);
      triggerStatus('Tempat sampah berhasil dikosongkan dengan sukses.', 'success');
      setRecords([]);
      setShowConfirmEmpty(false);
    } catch (err: any) {
      console.error(err);
      triggerStatus(`Gagal mengosongkan tempat sampah: ${err.message || 'Izin ditolak'}`, 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // Filter and search computation
  const filteredRecords = records.filter(record => {
    const matchesFilter = activeFilter === 'all' || record.originalCollection === activeFilter;
    if (!matchesFilter) return false;

    if (!searchTerm) return true;
    const lowerSearch = searchTerm.toLowerCase();
    return (
      record.metadata.title?.toLowerCase().includes(lowerSearch) ||
      record.metadata.subtitle?.toLowerCase().includes(lowerSearch) ||
      record.metadata.details?.toLowerCase().includes(lowerSearch) ||
      record.originalCollection?.toLowerCase().includes(lowerSearch) ||
      record.originalId?.toLowerCase().includes(lowerSearch)
    );
  });

  const getCollectionBadgeAndIcon = (col: string) => {
    switch(col) {
      case 'journal_entries':
        return {
          label: 'Jurnal Umum',
          color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
          icon: FileText
        };
      case 'debts_receivables':
        return {
          label: 'Hutang / Piutang',
          color: 'bg-amber-50 text-amber-700 border-amber-100',
          icon: Database
        };
      case 'accounts':
        return {
          label: 'Akun (COA)',
          color: 'bg-purple-50 text-purple-700 border-purple-100',
          icon: Sliders
        };
      default:
        return {
          label: 'Draft',
          color: 'bg-slate-50 text-slate-700 border-slate-100',
          icon: Clock
        };
    }
  };

  const formatRecordDate = (timestamp: any) => {
    if (!timestamp) return '-';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return format(date, 'dd MMM yyyy, HH:mm');
    } catch (e) {
      return String(timestamp);
    }
  };

  return (
    <div className="space-y-6" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Tempat Sampah & Pemulihan Data</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">
            Fitur keamanan untuk memproteksi data keuangan Anda dari kesalahan penghapusan
          </p>
        </div>
        
        {records.length > 0 && (
          <button 
            disabled={processingId !== null}
            onClick={() => setShowConfirmEmpty(true)}
            className="w-full md:w-auto bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 active:scale-[0.98] disabled:opacity-50 px-5 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all font-semibold text-sm cursor-pointer shadow-sm"
          >
            <Trash2 className="w-4 h-4 shrink-0" /> Kosongkan Tempat Sampah
          </button>
        )}
      </div>

      {/* Info Warning Alert */}
      <div className="bg-amber-50/70 border border-amber-100/80 rounded-3xl p-5 flex gap-4 text-amber-800 text-xs shadow-sm">
        <ShieldAlert className="w-6 h-6 text-amber-600 shrink-0" />
        <div className="space-y-1">
          <p className="font-bold uppercase tracking-wider text-[10px]">Tips Keamanan & Integritas Relasional</p>
          <p className="text-slate-600 leading-relaxed">
            Sistem kami mendukung keamanan relasional: Jika Anda menghapus transaksi <b>Hutang/Piutang</b> yang memiliki <b>Jurnal Umum Otomatis</b>, seluruh transaksi yang terkait dengannya akan otomatis diamankan di Tempat Sampah ini. Pemulihan dari Tempat Sampah akan mengembalikan seluruh relasi transaksi tersebut secara utuh dan seimbang.
          </p>
        </div>
      </div>

      {/* Floating Status Notification Toast */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className={cn(
              "fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-4 rounded-2xl shadow-xl border flex items-center gap-3 text-sm font-semibold max-w-lg w-full shrink-0",
              statusMessage.type === 'success' 
                ? "bg-emerald-50 text-emerald-800 border-emerald-100" 
                : "bg-rose-50 text-rose-800 border-rose-100"
            )}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span className="flex-1 shrink-0">{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Control Area: Filters, Search, Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-center">
        {/* Filter Tabs */}
        <div className="lg:col-span-3 flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'Semua Data' },
            { id: 'journal_entries', label: 'Jurnal Umum' },
            { id: 'debts_receivables', label: 'Hutang / Piutang' },
            { id: 'accounts', label: 'Akun (COA)' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as any)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider border transition-all cursor-pointer",
                activeFilter === tab.id 
                  ? "bg-natural-primary border-natural-primary text-white shadow-sm" 
                  : "bg-white border-natural-border text-slate-500 hover:text-slate-800 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari item terhapus..."
            className="w-full bg-white border border-natural-border focus:border-natural-primary rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-700 outline-none transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5 shrink-0" />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-3xl border border-natural-border shadow-sm p-16 text-center space-y-4">
          <div className="w-10 h-10 border-4 border-natural-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-500 text-sm font-medium">Sedang memindai Tempat Sampah sistem...</p>
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="bg-white rounded-3xl border border-natural-border shadow-md p-16 text-center space-y-4">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400 border border-slate-100">
            <Trash2 className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-serif italic text-natural-primary">Tidak Ada Data Terhapus</h3>
          <p className="text-slate-400 text-slate-400 text-xs max-w-md mx-auto leading-relaxed">
            {searchTerm 
              ? "Tidak berrhasil menemukan data terhapus dengan kata kunci yang Anda masukkan silakan gunakan filter lainnya." 
              : "Semua data aman! Tempat sampah kosong dan tidak ada riwayat data keuangan yang terhapus belakangan ini."}
          </p>
          {searchTerm && (
            <button 
              onClick={() => { setSearchTerm(''); setActiveFilter('all'); }} 
              className="text-xs text-natural-primary hover:opacity-80 font-bold underline uppercase tracking-widest cursor-pointer"
            >
              Bersihkan Filter & Pencarian
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Quick Counter */}
          <div className="text-[10px] text-gray-400 uppercase tracking-widest font-mono">
            Menampilkan <b>{filteredRecords.length}</b> data dari total <b>{records.length}</b> di Tempat Sampah
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredRecords.map((record) => {
                const badgeInfo = getCollectionBadgeAndIcon(record.originalCollection);
                const isProcessing = processingId === record.id;

                return (
                  <motion.div
                    key={record.id}
                    layoutId={record.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                    whileHover={{ y: -2 }}
                    onClick={() => setSelectedRecordForDetail(record)}
                    className="bg-white rounded-3xl border border-natural-border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between cursor-pointer group"
                  >
                    <div>
                      {/* Top Row: Type and Amount */}
                      <div className="flex justify-between items-start gap-4 mb-3.5">
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1.5 w-fit",
                          badgeInfo.color
                        )}>
                          <badgeInfo.icon className="w-3 h-3" />
                          {badgeInfo.label}
                        </span>
                        
                        {record.metadata.amount > 0 && (
                          <span className="text-sm font-mono font-bold text-slate-800">
                            {formatRupiah(record.metadata.amount)}
                          </span>
                        )}
                      </div>

                      {/* Content Row */}
                      <div className="space-y-1 mb-5">
                        <h4 className="font-serif italic font-medium text-slate-900 group-hover:text-natural-primary transition-colors text-base line-clamp-1">
                          {record.metadata.title}
                        </h4>
                        <p className="text-xs text-slate-400 truncate tracking-wide">
                          {record.metadata.subtitle}
                        </p>
                        {record.metadata.details && (
                          <div className="text-[11px] text-slate-500 font-mono italic flex items-center gap-1.5 mt-2 bg-slate-50 px-2.5 py-1 rounded-lg w-fit">
                            <Activity className="w-3 h-3 text-slate-400" />
                            {record.metadata.details}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Row: Metadata info and action buttons */}
                    <div className="pt-4 border-t border-slate-50/80 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                      <div className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Terhapus: {formatRecordDate(record.deletedAt)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleRestore(record)}
                          className="bg-natural-primary/5 hover:bg-natural-primary text-natural-primary hover:text-white disabled:opacity-50 transition-all p-2 rounded-full cursor-pointer"
                          title="Restore / Pulihkan ke Aslinya"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isProcessing}
                          onClick={() => handleDeletePermanently(record.id, record.metadata.title)}
                          className="bg-rose-50/60 hover:bg-rose-600 text-rose-600 hover:text-white disabled:opacity-50 transition-all p-2 rounded-full cursor-pointer"
                          title="Hapus Permanen"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Empty Recycle Bin */}
      <AnimatePresence>
        {showConfirmEmpty && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl p-6 max-w-md w-full border border-natural-border text-center space-y-6"
            >
              <div className="w-14 h-14 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-600 border border-rose-100">
                <ShieldAlert className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-serif italic text-rose-800">Kosongkan Tempat Sampah?</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Tindakan ini akan <b>menghapus seluruh {records.length} riwayat cadangan</b> secara permanen dari server database Firestore. Anda tidak akan dapat memulihkan transaksi ini lagi di kemudian hari.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmEmpty(false)}
                  className="flex-1 bg-white border border-natural-border hover:bg-slate-50 text-slate-700 py-2.5 rounded-xl font-semibold text-sm transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  disabled={processingId === 'all'}
                  onClick={handleEmptyBin}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm transition-all shadow-md cursor-pointer"
                >
                  {processingId === 'all' ? 'Mengosongkan...' : 'Ya, Bersihkan Semua'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail Viewer Slide-over / Modal (Melihat struktur data sebelum restorasi) */}
      <AnimatePresence>
        {selectedRecordForDetail && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-end z-50">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-xl h-full shadow-2xl flex flex-col justify-between border-l border-natural-border"
            >
              {/* Box Header */}
              <div className="p-6 border-b border-natural-border flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-natural-primary/5 border border-natural-primary/10 rounded-xl flex items-center justify-center text-natural-primary">
                    <Activity className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-serif italic font-bold text-slate-900">Inspeksi Data Terhapus</h3>
                    <p className="text-[9px] text-gray-400 uppercase tracking-widest font-sans font-semibold">Tinjau parameters sebelum pemulihan</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedRecordForDetail(null)}
                  className="p-2 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Box Content Scroll */}
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                {/* Meta details banner */}
                <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 space-y-4">
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Judul / Nama Entri</p>
                      <h4 className="text-lg font-serif italic font-bold text-slate-900">{selectedRecordForDetail.metadata.title}</h4>
                      <p className="text-xs text-slate-500">{selectedRecordForDetail.metadata.subtitle}</p>
                    </div>

                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border",
                      getCollectionBadgeAndIcon(selectedRecordForDetail.originalCollection).color
                    )}>
                      {getCollectionBadgeAndIcon(selectedRecordForDetail.originalCollection).label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200/60 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Waktu Dihapus
                      </span>
                      <p className="font-medium text-slate-700">{formatRecordDate(selectedRecordForDetail.deletedAt)}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider">
                        <User className="w-3.5 h-3.5 text-slate-400" /> Petugas Penghapus
                      </span>
                      <p className="font-mono text-slate-700 truncate text-[11px]">{selectedRecordForDetail.deletedBy}</p>
                    </div>
                  </div>
                </div>

                {/* Main Raw payload display */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase font-bold tracking-wider text-slate-400">Ringkasan Nilai Fields Dan Payload Struktur</h4>
                  
                  {/* Particularized UI blocks based on document type for easier review */}
                  {selectedRecordForDetail.originalCollection === 'journal_entries' ? (
                    <div className="border border-natural-border rounded-2xl overflow-hidden bg-white text-xs">
                      <div className="bg-slate-50 p-3 font-semibold border-b border-natural-border text-slate-700 flex justify-between">
                        <span>Skema Jurnal Umum</span>
                        <span className="font-mono">{selectedRecordForDetail.data.reference}</span>
                      </div>
                      <div className="p-4 space-y-3.5">
                        <div className="flex justify-between items-center text-slate-500 pb-2 border-b border-dashed border-slate-100">
                          <span>Tanggal Jurnal</span>
                          <span className="font-semibold text-slate-800">{formatRecordDate(selectedRecordForDetail.data.date)}</span>
                        </div>
                        <div className="space-y-2">
                          <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">Rincian Debet & Kredit</p>
                          <div className="space-y-1.5">
                            {selectedRecordForDetail.data.lines?.map((line: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center bg-slate-5 py-2 px-3 rounded-lg border border-slate-100 text-xs">
                                <div className="space-y-0.5">
                                  <p className="font-bold text-slate-800">{line.accountName}</p>
                                  <p className="text-[10px] text-slate-400 leading-none">ID: {line.accountId}</p>
                                </div>
                                <div className="text-right font-mono font-bold font-semibold shrink-0 text-slate-700">
                                  {line.debit > 0 ? (
                                    <span className="text-emerald-700">D: {formatRupiah(line.debit)}</span>
                                  ) : (
                                    <span className="text-rose-700">K: {formatRupiah(line.credit)}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : selectedRecordForDetail.originalCollection === 'debts_receivables' ? (
                    <div className="border border-natural-border rounded-2xl overflow-hidden bg-white text-xs space-y-4 p-4">
                      <div className="bg-slate-50 -mx-4 -mt-4 p-3 font-semibold border-b border-natural-border text-slate-700 flex justify-between">
                        <span>Pemberian Kontrol • {selectedRecordForDetail.data.type}</span>
                        <span className="font-mono">{selectedRecordForDetail.data.dpRefNumber || 'HT/PT AUTO'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Total Nilai Tagihan</p>
                          <p className="font-mono text-sm font-bold text-slate-800">{formatRupiah(selectedRecordForDetail.data.totalAmount)}</p>
                        </div>
                        <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                          <p className="text-[9px] uppercase font-bold text-slate-400">Sisa Piutang/Hutang</p>
                          <p className="font-mono text-sm font-bold text-slate-800">{formatRupiah(selectedRecordForDetail.data.remainingBalance)}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-slate-600">
                        <div className="flex justify-between py-1 border-b border-slate-100 text-xs">
                          <span>Jatuh Tempo</span>
                          <span className="font-semibold text-slate-800">{formatRecordDate(selectedRecordForDetail.data.dueDate)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 text-xs">
                          <span>Uang Muka Awal</span>
                          <span className="font-semibold text-slate-800">{formatRupiah(selectedRecordForDetail.data.downPayment || 0)}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 text-xs text-xs">
                          <span>Penanggung Jawab (PIC)</span>
                          <span className="font-semibold text-slate-800">{selectedRecordForDetail.data.picName || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100 text-xs">
                          <span>Sebab Penulisan</span>
                          <span className="font-semibold text-slate-800">{selectedRecordForDetail.data.remarks || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 text-xs">
                          <span>Status Terakhir</span>
                          <span className="px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider text-[9px] text-white bg-slate-800" style={{ fontSize: '9px' }}>
                            {selectedRecordForDetail.data.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-slate-900 rounded-2xl p-4 text-slate-300 font-mono text-[11px] overflow-x-auto max-h-80">
                      <pre>{JSON.stringify(selectedRecordForDetail.data, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>

              {/* Box Footer Actions */}
              <div className="p-6 border-t border-natural-border flex gap-3 bg-slate-50/50 shrink-0">
                <button
                  disabled={processingId !== null}
                  onClick={() => handleDeletePermanently(selectedRecordForDetail.id, selectedRecordForDetail.metadata.title)}
                  className="flex-1 border border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 py-3 rounded-xl font-semibold text-xs transition-colors cursor-pointer text-center"
                >
                  Hapus Permanen
                </button>
                <button
                  disabled={processingId !== null}
                  onClick={() => handleRestore(selectedRecordForDetail)}
                  className="flex-1 bg-natural-primary hover:opacity-90 disabled:opacity-50 text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 animate-spin-duration-3000 shrink-0" />
                  Pulihkan Sekarang
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
