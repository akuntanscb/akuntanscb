import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  BookOpen, 
  FileText, 
  PieChart, 
  Users, 
  Settings, 
  Receipt,
  LogOut,
  Menu,
  X,
  School
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  const handleLogin = () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider);
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Jurnal Umum', path: '/jurnal', icon: BookOpen },
    { name: 'Buku Besar', path: '/buku-besar', icon: BookOpen },
    { name: 'Faktur', path: '/faktur', icon: Receipt },
    { name: 'Hutang & Piutang', path: '/hutang-piutang', icon: Users },
    { name: 'Laporan Keuangan', path: '/laporan', icon: PieChart },
    { name: 'Daftar Akun', path: '/coa', icon: Settings },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <School className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">SIA Cendekia Baznas</h1>
          <p className="text-slate-500 mb-8">Sistem Informasi Akuntansi Nirlaba Sekolah</p>
          <button 
            onClick={handleLogin}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            Masuk dengan Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg flex text-natural-text">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-natural-primary flex flex-col text-white shadow-2xl transition-all duration-300 z-20",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center font-bold text-xl shrink-0">CB</div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-sm font-semibold leading-tight">Sekolah Cendekia</h1>
                <p className="text-[10px] text-white/60 tracking-wider uppercase">Sistem Akuntansi</p>
              </motion.div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all group",
                location.pathname === item.path 
                  ? "bg-white/15 text-white border border-white/10 shadow-sm" 
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 shrink-0 transition-transform group-hover:scale-110",
                location.pathname === item.path ? "text-white" : "text-white/50"
              )} />
              {isSidebarOpen && <span>{item.name}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-6">
          <div className="bg-white/10 rounded-2xl p-4">
            {isSidebarOpen ? (
              <>
                <p className="text-[10px] uppercase text-white/50 mb-1 tracking-widest font-bold">Akun Pengguna</p>
                <p className="text-xs font-semibold truncate">{user.displayName}</p>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                     <p className="text-[10px] text-white/60">Server Terhubung</p>
                  </div>
                  <button onClick={handleLogout} className="text-white/40 hover:text-rose-400 transition-colors">
                    <LogOut className="w-3 h-3" />
                  </button>
                </div>
              </>
            ) : (
              <button onClick={handleLogout} className="flex justify-center w-full text-white/40 hover:text-rose-400">
                <LogOut className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className="h-20 bg-white border-b border-natural-border flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-natural-bg rounded-full text-natural-primary transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-xl font-serif italic text-natural-primary">
                {navItems.find(i => i.path === location.pathname)?.name || 'SIA Baznas'}
              </h2>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                Sekolah Cendekia Baznas
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-[11px] text-gray-400 uppercase tracking-widest font-medium hidden sm:block">
               {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
             </div>
             <img 
               src={user.photoURL} 
               alt={user.displayName} 
               className="w-10 h-10 rounded-full border-2 border-natural-border shadow-sm bg-white"
             />
          </div>
        </header>

        <section className="flex-1 overflow-y-auto bg-natural-bg/50 scroll-smooth">
          <div className="max-w-7xl mx-auto p-8">
            {children}
          </div>
        </section>

        {/* Footer */}
        <footer className="px-8 py-4 bg-white/50 border-t border-natural-border flex justify-between items-center text-[10px] shrink-0">
          <p className="text-gray-400">Bantauan Akuntansi SAK ETAP & PSAK 109 • Sistem Informasi Sekolah</p>
          <div className="flex gap-6 text-natural-primary font-bold opacity-60">
            <span>Status: Sinkron</span>
            <span>Versi 1.0.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
};
