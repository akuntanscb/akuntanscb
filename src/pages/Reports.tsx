import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Printer, Download, Filter, FileBarChart } from 'lucide-react';
import { getFinancialReports } from '../services/reportService';
import { formatRupiah, cn } from '../lib/utils';

export default function Reports() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'neraca' | 'aktivitas'>('neraca');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const reports = await getFinancialReports();
    setData(reports);
    setLoading(false);
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
          <button className="p-3 bg-white border border-natural-border hover:bg-natural-bg rounded-xl text-natural-primary transition-all shadow-sm">
            <Printer className="w-5 h-5" />
          </button>
          <button className="p-3 bg-white border border-natural-border hover:bg-natural-bg rounded-xl text-natural-primary transition-all shadow-sm">
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
    </div>
  );
}
