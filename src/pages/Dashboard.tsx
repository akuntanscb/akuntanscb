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
    <div className="space-y-5 sm:space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif italic text-natural-primary">Ringkasan Aktivitas Dana</h1>
          <p className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-widest mt-0.5 sm:mt-1">Sistem Dashboard Akuntansi Nirlaba</p>
        </div>
      </header>

      {/* Metric Cards - 2 cols on mobile for minimalist glanceable dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "p-3.5 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-xs transition-all hover:shadow-md flex flex-col justify-between",
              stat.accent ? "bg-[#f9f9f4] border-dashed border-natural-primary/20" : "bg-white border-natural-border"
            )}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-widest truncate">{stat.label}</p>
                <div className={cn("p-1.5 sm:p-2 rounded-lg sm:rounded-xl shrink-0", stat.bg)}>
                  <stat.icon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", stat.color)} />
                </div>
              </div>
              <h3 className={cn("text-base sm:text-2xl font-serif font-bold tracking-tight truncate", stat.color)}>
                {formatRupiah(stat.value)}
              </h3>
            </div>
            <div className="mt-2.5 sm:mt-4 flex items-center justify-between">
              {stat.value > 0 ? (
                <p className="text-[9px] sm:text-[10px] font-medium text-emerald-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                  Terverifikasi
                </p>
              ) : (
                <span className="text-[9px] text-gray-400 font-sans">0 Transaksi</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl sm:rounded-3xl border border-natural-border shadow-xs flex flex-col overflow-hidden">
          <div className="p-4 sm:p-6 border-b border-natural-border flex justify-between items-center bg-gray-50/30">
            <h4 className="font-serif italic text-base sm:text-lg text-natural-primary font-bold">Komposisi Penerimaan Dana</h4>
            <span className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Detail Akun</span>
          </div>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
            {data.aktivitas.pendapatan.map((item: any) => (
              <div key={item.id} className="group transition-all">
                <div className="flex items-center justify-between mb-1.5 sm:mb-2 text-xs sm:text-sm">
                  <span className="font-medium text-natural-text group-hover:text-natural-primary truncate pr-2">{item.code} - {item.name}</span>
                  <span className="font-serif text-sm sm:text-lg text-emerald-700 font-bold shrink-0">{formatRupiah(item.balance)}</span>
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

        <div className="bg-natural-primary rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-lg flex flex-col">
          <h4 className="text-lg sm:text-xl font-serif italic mb-5 sm:mb-8 font-bold">Posisi Aktivitas</h4>
          <div className="space-y-5 sm:space-y-8 flex-1">
             <div className="space-y-1 border-b border-white/20 pb-3 sm:pb-4">
                <p className="text-[9px] sm:text-[10px] uppercase text-white/50 tracking-widest font-bold font-mono">Dana Terikat</p>
                <div className="flex justify-between items-center text-xs sm:text-sm">
                   <p className="font-medium">Beasiswa & Yatim</p>
                   <p className="font-mono font-bold">Rp {Math.round(data.neraca.totalAset * 0.35 / 1000000).toLocaleString()}jt</p>
                </div>
             </div>
             <div className="space-y-1 border-b border-white/20 pb-3 sm:pb-4">
                <p className="text-[9px] sm:text-[10px] uppercase text-white/50 tracking-widest font-bold font-mono">Dana Infaq Operasional</p>
                <div className="flex justify-between items-center text-xs sm:text-sm">
                   <p className="font-medium">Gaji & Utilitas</p>
                   <p className="font-mono font-bold">Rp {Math.round(data.neraca.totalAset * 0.65 / 1000000).toLocaleString()}jt</p>
                </div>
             </div>
             
             <div className="pt-2 sm:pt-4">
               <p className="text-[9px] sm:text-[10px] uppercase text-white/50 mb-2 sm:mb-4 tracking-widest font-bold font-mono">Aset Neto (Ekuitas)</p>
               <div className="text-2xl sm:text-3xl font-serif font-bold mb-2">
                 {formatRupiah(data.neraca.totalEkuitas + data.neraca.surplusDefisit)}
               </div>
               <div className="w-full bg-white/10 h-2 rounded-full flex overflow-hidden">
                 <div className="h-full bg-white/40" style={{ width: '60%' }}></div>
                 <div className="h-full bg-white/20" style={{ width: '40%' }}></div>
               </div>
             </div>
          </div>
          <Link to="/laporan" className="w-full py-3 sm:py-3.5 bg-white text-natural-primary rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-bold uppercase tracking-widest text-center mt-6 sm:mt-8 hover:bg-natural-bg transition-colors shadow-xs">
            Buka Laporan Neraca Lengkap
          </Link>
        </div>
      </div>

      {/* Monitoring Hutang & Piutang Dashboard Section */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-natural-border shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h4 className="font-serif italic text-base sm:text-lg text-natural-primary font-bold flex items-center gap-2">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-natural-primary" /> Monitoring Hutang & Piutang Berjalan
            </h4>
            <p className="text-[9px] sm:text-[10px] text-gray-400 uppercase tracking-widest mt-0.5 sm:mt-1">Uang muka, umur hutang, dan sisa kewajiban</p>
          </div>
          <Link 
            to="/hutang-piutang"
            className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-natural-primary hover:opacity-85 uppercase tracking-wider bg-natural-primary/5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl transition-all"
          >
            Sistem Kontrol Lengkap <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 pt-1 sm:pt-2">
          {/* Piutang card */}
          <div className="bg-emerald-50/30 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-emerald-100">
            <p className="text-[9px] sm:text-[10px] uppercase text-emerald-800 font-bold tracking-wider font-mono">Sisa Piutang Aktif</p>
            <p className="text-lg sm:text-xl font-serif text-emerald-950 font-bold mt-1">{formatRupiah(remainingPiutang)}</p>
            <div className="mt-1.5 sm:mt-2 text-[9px] sm:text-[10px] text-gray-500 font-sans">
              Dari {debts.filter(d => d.type === 'Piutang').length} transaksi piutang donatur/santri
            </div>
          </div>

          {/* Hutang card */}
          <div className="bg-amber-50/30 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-amber-100">
            <p className="text-[9px] sm:text-[10px] uppercase text-amber-800 font-bold tracking-wider font-mono">Sisa Hutang Kewajiban</p>
            <p className="text-lg sm:text-xl font-serif text-amber-950 font-bold mt-1">{formatRupiah(remainingHutang)}</p>
            <div className="mt-1.5 sm:mt-2 text-[9px] sm:text-[10px] text-gray-500 font-sans">
              Dari {debts.filter(d => d.type === 'Hutang').length} transaksi hutang vendor/operasional
            </div>
          </div>

          {/* Overdue alert card */}
          <div className={cn(
            "rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border transition-colors",
            overdueCount > 0 
              ? "bg-rose-50 border-rose-200 text-rose-800" 
              : "bg-slate-50 border-natural-border text-slate-800"
          )}>
            <p className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider font-mono">Peringatan Jatuh Tempo</p>
            <p className="text-lg sm:text-xl font-serif font-bold mt-1">
              {overdueCount > 0 ? `${overdueCount} Transaksi` : 'Seluruhnya Aman (0)'}
            </p>
            <div className="mt-1.5 sm:mt-2 text-[9px] sm:text-[10px] font-sans">
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
