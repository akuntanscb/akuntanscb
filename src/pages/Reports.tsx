import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Printer, Download, Filter, FileBarChart, Settings2, Sliders, ChevronUp, ChevronDown, Eye, EyeOff, X, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { getFinancialReports } from '../services/reportService';
import { getAccounts, updateAccount } from '../services/accountService';
import { Account, AccountCategory } from '../types';
import { formatRupiah, cn } from '../lib/utils';

export default function Reports() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'neraca' | 'aktivitas'>('neraca');

  // Layout Configuration states
  const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
  const [editorAccounts, setEditorAccounts] = useState<Account[]>([]);
  const [editorCategory, setEditorCategory] = useState<AccountCategory>('Aset');
  const [isSavingLayout, setIsSavingLayout] = useState(false);
  const [layoutSuccessMsg, setLayoutSuccessMsg] = useState('');
  const [layoutErrorMsg, setLayoutErrorMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const reports = await getFinancialReports();
    setData(reports);
    setLoading(false);
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Laporan Keuangan</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Laporan otomatis berbasis posting jurnal</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={openLayoutEditor}
            className="px-4 py-2.5 bg-white border border-natural-border hover:bg-natural-bg rounded-xl text-natural-primary hover:text-natural-primary/90 transition-all font-semibold text-xs flex items-center gap-2 shadow-sm"
          >
            <Sliders className="w-4 h-4 text-natural-primary" />
            Atur Tata Letak
          </button>
          <button className="p-3 bg-white border border-natural-border hover:bg-natural-bg rounded-xl text-natural-primary transition-all shadow-sm text-slate-700">
            <Printer className="w-5 h-5" />
          </button>
          <button className="p-3 bg-white border border-natural-border hover:bg-natural-bg rounded-xl text-natural-primary transition-all shadow-sm text-slate-700">
            <Download className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex border-b border-natural-border">
        <button 
          onClick={() => setActiveTab('neraca')}
          className={cn(
            "px-8 py-4 font-semibold text-sm transition-all relative",
            activeTab === 'neraca' ? "text-natural-primary" : "text-gray-400"
          )}
        >
          Laporan Neraca
          {activeTab === 'neraca' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
        </button>
        <button 
          onClick={() => setActiveTab('aktivitas')}
          className={cn(
            "px-8 py-4 font-semibold text-sm transition-all relative",
            activeTab === 'aktivitas' ? "text-natural-primary" : "text-gray-400"
          )}
        >
          Laporan Aktivitas
          {activeTab === 'aktivitas' && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-natural-primary" />}
        </button>
      </div>

      <div className="bg-white rounded-[2rem] border border-natural-border shadow-sm p-12">
        <div className="text-center mb-16 space-y-2">
          <h2 className="text-2xl font-serif text-natural-primary uppercase tracking-tight">Sekolah Cendekia Baznas</h2>
          <p className="text-gray-400 uppercase tracking-[0.2em] text-xs font-bold">
            {activeTab === 'neraca' ? 'LAPORAN POSISI KEUANGAN (NERACA)' : 'LAPORAN AKTIVITAS'}
          </p>
          <div className="w-12 h-1 bg-natural-primary/20 mx-auto rounded-full mt-4" />
          <p className="text-gray-400 text-[11px] font-medium pt-2 uppercase">Per {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</p>
        </div>

        {activeTab === 'neraca' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <h3 className="font-bold text-slate-800 border-b pb-2">ASET</h3>
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
                <h3 className="font-bold text-slate-800 border-b pb-2">LIABILITAS</h3>
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
                <h3 className="font-bold text-slate-800 border-b pb-2">EKUITAS (ASET NETO)</h3>
                {data.neraca.ekuitas.map((e: any) => (
                  <div key={e.id} className="flex justify-between text-sm">
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
        ) : (
          <div className="max-w-2xl mx-auto space-y-8">
             <div className="space-y-4">
               <h3 className="font-bold text-emerald-700 bg-emerald-50 px-4 py-2 rounded">PENDAPATAN / PENERIMAAN</h3>
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
               <h3 className="font-bold text-rose-700 bg-rose-50 px-4 py-2 rounded">BEBAN PENGELUARAN</h3>
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
