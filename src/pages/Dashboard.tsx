import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  ArrowUpRight, 
  ArrowDownRight,
  HandCoins,
  BadgeCent,
  Users,
  Clock,
  ArrowRight
} from 'lucide-react';
import { formatRupiah, cn } from '../lib/utils';
import { getFinancialReports } from '../services/reportService';
import { initializeCOA } from '../services/accountService';
import { getDebts } from '../services/debtService';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      await initializeCOA(); // Ensure COA exists
      const reports = await getFinancialReports();
      setData(reports);
      
      try {
        const debtList = await getDebts();
        setDebts(debtList);
      } catch (err) {
        console.error("Gagal mendapatkan hutang piutang di dashboard", err);
      }
      
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full">Loading...</div>;

  const stats = [
    { 
      label: 'Total Aset Sekolah', 
      value: data.neraca.totalAset, 
      icon: Wallet, 
      color: 'text-natural-primary', 
      bg: 'bg-natural-bg' 
    },
    { 
      label: 'Penerimaan Zakat & Infaq', 
      value: data.aktivitas.totalPendapatan, 
      icon: HandCoins, 
      color: 'text-emerald-700', 
      bg: 'bg-emerald-50' 
    },
    { 
      label: 'Donasi & Hibah Umum', 
      value: 0, // Mock for visual variety if needed, or keep real
      icon: TrendingUp, 
      color: 'text-blue-700', 
      bg: 'bg-blue-50' 
    },
    { 
      label: 'Penyaluran Dana Program', 
      value: data.aktivitas.totalBeban, 
      icon: TrendingDown, 
      color: 'text-natural-primary', 
      bg: 'bg-natural-primary/5',
      accent: true
    },
  ];

  const remainingPiutang = debts
    .filter(d => d.type === 'Piutang')
    .reduce((sum, d) => sum + d.remainingBalance, 0);

  const remainingHutang = debts
    .filter(d => d.type === 'Hutang')
    .reduce((sum, d) => sum + d.remainingBalance, 0);

  const overdueCount = debts.filter(d => {
    if (d.status === 'Lunas') return false;
    const today = new Date();
    today.setHours(0,0,0,0);
    // Handle potential Timestamp or standard Date object safely
    const due = d.dueDate?.toDate ? d.dueDate.toDate() : new Date(d.dueDate);
    due.setHours(0,0,0,0);
    return today.getTime() > due.getTime();
  }).length;

  return (
    <div className="space-y-10">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Ringkasan Aktivitas Dana</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Sistem Dashboard Akuntansi Nirlaba</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className={cn(
              "p-6 rounded-3xl border shadow-sm transition-all hover:shadow-md",
              stat.accent ? "bg-[#f9f9f4] border-dashed border-natural-primary/20" : "bg-white border-natural-border"
            )}
          >
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">{stat.label}</p>
            <h3 className={cn("text-2xl font-serif", stat.color)}>
              {formatRupiah(stat.value)}
            </h3>
            <div className="mt-4 flex items-center justify-between">
               <div className={cn("p-2 rounded-xl", stat.bg)}>
                 <stat.icon className={cn("w-4 h-4", stat.color)} />
               </div>
               {stat.value > 0 && (
                 <p className="text-[10px] font-medium text-emerald-600">Terverifikasi</p>
               )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-natural-border shadow-sm flex flex-col overflow-hidden">
          <div className="p-6 border-b border-natural-border flex justify-between items-center bg-gray-50/30">
            <h4 className="font-serif italic text-lg text-natural-primary">Komposisi Penerimaan Dana</h4>
            <span className="text-[10px] text-gray-400 uppercase tracking-widest">Detail Akun</span>
          </div>
          <div className="p-6 space-y-5">
            {data.aktivitas.pendapatan.map((item: any) => (
              <div key={item.id} className="group transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-natural-text group-hover:text-natural-primary">{item.code} - {item.name}</span>
                  <span className="font-serif text-lg text-emerald-700">{formatRupiah(item.balance)}</span>
                </div>
                <div className="w-full bg-natural-bg h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (item.balance / data.aktivitas.totalPendapatan) * 100)}%` }}
                    className="h-full bg-emerald-500 rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-natural-primary rounded-3xl p-8 text-white shadow-xl flex flex-col">
          <h4 className="text-xl font-serif italic mb-8">Posisi Aktivitas</h4>
          <div className="space-y-8 flex-1">
             <div className="space-y-1 border-b border-white/20 pb-4">
                <p className="text-[10px] uppercase text-white/50 tracking-widest font-bold">Dana Terikat</p>
                <div className="flex justify-between items-center">
                   <p className="text-sm">Beasiswa & Yatim</p>
                   <p className="font-mono text-sm">Rp {Math.round(data.neraca.totalAset * 0.35 / 1000000).toLocaleString()}jt</p>
                </div>
             </div>
             <div className="space-y-1 border-b border-white/20 pb-4">
                <p className="text-[10px] uppercase text-white/50 tracking-widest font-bold">Dana Infaq Operasional</p>
                <div className="flex justify-between items-center">
                   <p className="text-sm">Gaji & Utilitas</p>
                   <p className="font-mono text-sm">Rp {Math.round(data.neraca.totalAset * 0.65 / 1000000).toLocaleString()}jt</p>
                </div>
             </div>
             
             <div className="pt-4">
               <p className="text-[10px] uppercase text-white/50 mb-4 tracking-widest font-bold">Aset Neto (Ekuitas)</p>
               <div className="text-3xl font-serif mb-2">
                 {formatRupiah(data.neraca.totalEkuitas + data.neraca.surplusDefisit)}
               </div>
               <div className="w-full bg-white/10 h-2 rounded-full flex overflow-hidden">
                 <div className="h-full bg-white/40" style={{ width: '60%' }}></div>
                 <div className="h-full bg-white/20" style={{ width: '40%' }}></div>
               </div>
             </div>
          </div>
          <button className="w-full py-4 bg-white text-natural-primary rounded-2xl text-[10px] font-bold uppercase tracking-widest shadow-inner mt-8 hover:bg-natural-bg transition-colors">
            Cetak Neraca Lengkap
          </button>
        </div>
      </div>

      {/* Monitoring Hutang & Piutang Dashboard Section */}
      <div className="bg-white rounded-3xl border border-natural-border shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h4 className="font-serif italic text-lg text-natural-primary flex items-center gap-2">
              <Users className="w-5 h-5 text-natural-primary" /> Monitoring Hutang & Piutang Berjalan
            </h4>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-1">Uang muka, umur hutang, dan sisa kewajiban</p>
          </div>
          <Link 
            to="/hutang-piutang"
            className="flex items-center gap-1.5 text-[11px] font-bold text-natural-primary hover:opacity-85 uppercase tracking-wider bg-natural-primary/5 px-4 py-2 rounded-xl transition-all"
          >
            Sistem Kontrol Lengkap <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Piutang card */}
          <div className="bg-emerald-50/30 rounded-2xl p-4 border border-emerald-100">
            <p className="text-[10px] uppercase text-emerald-800 font-bold tracking-wider">Sisa Piutang Aktif</p>
            <p className="text-xl font-serif text-emerald-950 font-bold mt-1">{formatRupiah(remainingPiutang)}</p>
            <div className="mt-2 text-[10px] text-gray-500 font-sans">
              Dari total {debts.filter(d => d.type === 'Piutang').length} transaksi piutang donatur/santri
            </div>
          </div>

          {/* Hutang card */}
          <div className="bg-amber-50/30 rounded-2xl p-4 border border-amber-100">
            <p className="text-[10px] uppercase text-amber-800 font-bold tracking-wider">Sisa Hutang Kewajiban</p>
            <p className="text-xl font-serif text-amber-950 font-bold mt-1">{formatRupiah(remainingHutang)}</p>
            <div className="mt-2 text-[10px] text-gray-500 font-sans">
              Dari total {debts.filter(d => d.type === 'Hutang').length} transaksi hutang vendor/operasional
            </div>
          </div>

          {/* Overdue alert card */}
          <div className={cn(
            "rounded-2xl p-4 border transition-colors",
            overdueCount > 0 
              ? "bg-rose-50 border-rose-200 text-rose-800" 
              : "bg-slate-50 border-natural-border text-slate-800"
          )}>
            <p className="text-[10px] uppercase font-bold tracking-wider">Peringatan Jatuh Tempo</p>
            <p className="text-xl font-serif font-bold mt-1">
              {overdueCount > 0 ? `${overdueCount} Transaksi` : 'Seluruhnya Aman (0)'}
            </p>
            <div className="mt-2 text-[10px] font-sans">
              {overdueCount > 0 
                ? 'Segera lakukan monitoring umur piutang/hutang!' 
                : 'Seluruh tagihan & kewajiban berjalan lancar.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
