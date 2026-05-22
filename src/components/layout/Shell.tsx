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
  School,
  Shield,
  Sliders,
  Database,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useSettings } from '../../context/SettingsContext';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [user, setUser] = useState<any>(null);
  const location = useLocation();
  const { settings, t } = useSettings();

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
    { name: t('dashboard'), path: '/', icon: LayoutDashboard },
    { name: t('journal'), path: '/jurnal', icon: BookOpen },
    { name: t('ledger'), path: '/buku-besar', icon: Database },
    { name: t('invoices'), path: '/faktur', icon: Receipt },
    { name: t('debts'), path: '/hutang-piutang', icon: Users },
    { name: t('reports'), path: '/laporan', icon: PieChart },
    { name: t('coa'), path: '/coa', icon: Sliders },
    { name: t('settings'), path: '/pengaturan', icon: Settings },
    { 
      name: settings.language === 'en' ? 'Recycle Bin' : (settings.language === 'ar' ? 'سلة المهملات' : 'Tempat Sampah'), 
      path: '/trash', 
      icon: Trash2 
    },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" style={{ fontFamily: 'var(--font-sans)' }}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-neutral-100"
        >
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6">
            {settings.logoType === 'custom' && settings.customLogoUrl ? (
              <img src={settings.customLogoUrl} alt="Logo" className="w-16 h-16 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : settings.logoType === 'finance' ? (
              <Receipt className="w-10 h-10 text-emerald-600 animate-pulse animate-duration-2000" />
            ) : settings.logoType === 'shield' ? (
              <Shield className="w-10 h-10 text-emerald-600" />
            ) : (
              <School className="w-10 h-10 text-emerald-600" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2 font-serif italic text-emerald-950">{settings.systemName}</h1>
          <p className="text-slate-500 mb-8 max-w-sm mx-auto text-sm">{settings.systemSubName}</p>
          <button 
            onClick={handleLogin}
            className="w-full text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md hover:brightness-110 active:scale-[0.98]"
            style={{ backgroundColor: 'var(--color-natural-primary)' }}
          >
            {settings.language === 'en' ? 'Sign In with Google' : (settings.language === 'ar' ? 'تسجيل الدخول باستخدام جوجل' : 'Masuk dengan Google')}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg flex text-natural-text" style={{ fontFamily: 'var(--font-sans)', direction: settings.language === 'ar' ? 'rtl' : 'ltr' }}>
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-natural-primary flex flex-col text-white shadow-2xl transition-all duration-300 z-20 shrink-0",
          isSidebarOpen ? "w-64" : "w-19"
        )}
      >
        <div className="p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center font-bold text-lg shrink-0 overflow-hidden">
              {settings.logoType === 'custom' && settings.customLogoUrl ? (
                <img src={settings.customLogoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : settings.logoType === 'finance' ? (
                <Receipt className="w-5 h-5 text-white" />
              ) : settings.logoType === 'shield' ? (
                <Shield className="w-5 h-5 text-white" />
              ) : (
                <School className="w-5 h-5 text-white" />
              )}
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-hidden" style={{ textAlign: settings.language === 'ar' ? 'right' : 'left' }}>
                <h1 className="text-xs font-bold leading-tight truncate uppercase tracking-wide">{settings.systemName}</h1>
                <p className="text-[9px] text-white/50 tracking-wider uppercase truncate">{settings.systemSubName}</p>
              </motion.div>
            )}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all group border border-transparent",
                location.pathname === item.path 
                  ? "bg-white/12 text-white border-white/10 shadow-sm" 
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              )}
            >
              <item.icon className={cn(
                "w-4 h-4 shrink-0 transition-transform group-hover:scale-110",
                location.pathname === item.path ? "text-white animate-pulse" : "text-white/40"
              )} />
              {isSidebarOpen && <span className="truncate">{item.name}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 shrink-0">
          <div className="bg-white/10 rounded-2xl p-4" style={{ textAlign: settings.language === 'ar' ? 'right' : 'left' }}>
            {isSidebarOpen ? (
              <>
                <p className="text-[9px] uppercase text-white/40 mb-1 tracking-widest font-bold font-mono">
                  {settings.language === 'en' ? 'USER PROFILE' : (settings.language === 'ar' ? 'ملف المستخدم' : 'PROFIL PENGGUNA')}
                </p>
                <p className="text-xs font-bold truncate text-white/90">{user.displayName}</p>
                <div className="mt-3.5 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                     <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
                     <p className="text-[10px] text-white/50 truncate font-medium">{t('connected')}</p>
                  </div>
                  <button onClick={handleLogout} className="text-white/40 hover:text-rose-400 transition-colors cursor-pointer shrink-0 p-1 rounded-md hover:bg-white/5" title={t('signOut')}>
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button onClick={handleLogout} className="flex justify-center w-full text-white/40 hover:text-rose-400 cursor-pointer p-1 rounded-md hover:bg-white/5" title={t('signOut')}>
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative" style={{ textAlign: settings.language === 'ar' ? 'right' : 'left' }}>
        <header className="h-16 bg-white border-b border-natural-border flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 hover:bg-natural-bg rounded-lg text-natural-primary transition-colors cursor-pointer border border-transparent hover:border-natural-border"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div>
              <h2 className="text-base font-serif italic text-natural-primary font-bold">
                {navItems.find(i => i.path === location.pathname)?.name || t('settings')}
              </h2>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-sans font-semibold">
                {settings.systemName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-[10px] text-gray-400 uppercase tracking-widest font-bold font-mono hidden sm:block bg-slate-50 border border-natural-border px-3 py-1 rounded-full">
               {new Date().toLocaleDateString(
                 settings.language === 'en' ? 'en-US' : (settings.language === 'ar' ? 'ar-SA' : 'id-ID'), 
                 { month: 'long', year: 'numeric' }
               )}
             </div>
             <img 
               src={user.photoURL} 
               alt={user.displayName} 
               className="w-8 h-8 rounded-full border border-natural-border shadow-sm bg-white"
             />
          </div>
        </header>

        <section className="flex-1 overflow-y-auto bg-natural-bg/50 scroll-smooth">
          <div className="max-w-7xl mx-auto p-6 sm:p-8">
            {children}
          </div>
        </section>

        {/* Footer */}
        <footer className="px-6 py-3 bg-white/50 border-t border-natural-border flex justify-between items-center text-[9px] shrink-0 font-medium">
          <p className="text-gray-400">
            {settings.language === 'en' ? 'Accounting Support SAK ETAP & PSAK 109 • Nonprofit School Ledger System' : (settings.language === 'ar' ? 'دعم المحاسبة معايير SAK ETAP و PSAK 109 • النظام المالي المدرسي' : 'Bantuan Akuntansi SAK ETAP & PSAK 109 • Sistem Informasi Sekolah')}
          </p>
          <div className="flex gap-4 text-natural-primary font-bold opacity-60">
            <span>{settings.language === 'en' ? 'Status: Synced' : (settings.language === 'ar' ? 'الحالة: متزامن' : 'Status: Sinkron')}</span>
            <span>v1.2.0</span>
          </div>
        </footer>
      </main>
    </div>
  );
};
