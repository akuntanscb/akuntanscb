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
  Trash2,
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../lib/utils';
import { auth } from '../../lib/firebase';
import { signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { useSettings } from '../../context/SettingsContext';
import { useUserRole } from '../../context/UserRoleContext';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const { user, userRole, isLoadingRole, hasPermission } = useUserRole();
  const [authError, setAuthError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const location = useLocation();
  const { settings, t } = useSettings();

  // Close mobile drawer on route transition
  useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [location.pathname]);


  const handleLogin = async () => {
    if (isLoggingIn) return;
    setIsLoggingIn(true);
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.log('Firebase Auth Error Captured:', error);
      if (error && (error.code === 'auth/cancelled-popup-request' || error.message?.includes('cancelled-popup-request'))) {
        // Ignored gracefully since it is dual request
        console.warn('Login popup request was superseded or cancelled.');
      } else if (error && (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup-closed-by-user'))) {
        setAuthError(
          settings.language === 'en' 
            ? 'Sign-in window was closed before completion. Please try again.' 
            : (settings.language === 'ar' 
              ? 'تم إغلاق نافذة تسجيل الدخول قبل الإكمال. يرجى المحاولة مرة أخرى.' 
              : 'Jendela masuk ditutup sebelum selesai. Silakan coba lagi.')
        );
      } else if (error && (error.code === 'auth/popup-blocked' || error.message?.includes('popup-blocked'))) {
        setAuthError(
          settings.language === 'en' 
            ? 'Sign-in popup was blocked by your browser. Please allow popups for this site.' 
            : (settings.language === 'ar' 
              ? 'تم حظر نافذة تسجيل الدخول المنبثقة بواسطة متصفحك. يرجى السماح بالنوافذ المنبثقة.' 
              : 'Popup masuk diblokir oleh browser Anda. Silakan izinkan popup untuk situs ini.')
        );
      } else {
        setAuthError(error.message || String(error));
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  const rawNavItems = [
    { name: t('dashboard'), path: '/', icon: LayoutDashboard, visible: true },
    { name: t('journal'), path: '/jurnal', icon: BookOpen, visible: hasPermission('canJournal') },
    { name: t('ledger'), path: '/buku-besar', icon: Database, visible: hasPermission('canJournal') || hasPermission('canCOA') },
    { name: t('invoices'), path: '/faktur', icon: Receipt, visible: hasPermission('canInvoices') },
    { name: t('debts'), path: '/hutang-piutang', icon: Users, visible: hasPermission('canDebt') },
    { 
      name: settings.language === 'en' ? 'Fixed Assets' : (settings.language === 'ar' ? 'الأصول الثابتة' : 'Aset Tetap'), 
      path: '/aset-tetap', 
      icon: TrendingDown,
      visible: hasPermission('canFixedAssets')
    },
    { name: t('reports'), path: '/laporan', icon: PieChart, visible: true },
    { name: t('coa'), path: '/coa', icon: Sliders, visible: hasPermission('canCOA') },
    { name: t('settings'), path: '/pengaturan', icon: Settings, visible: hasPermission('canSettings') },
    { 
      name: settings.language === 'en' ? 'Recycle Bin' : (settings.language === 'ar' ? 'سلة المهملات' : 'Tempat Sampah'), 
      path: '/trash', 
      icon: Trash2,
      visible: hasPermission('canTrash')
    },
    {
      name: settings.language === 'en' ? 'Access & Logs' : (settings.language === 'ar' ? 'الصلاحيات والعمليات' : 'Aturan & Log'),
      path: '/akses-log',
      icon: Shield,
      visible: userRole?.role === 'admin'
    }
  ];

  const navItems = rawNavItems.filter(item => item.visible);

  if (user && isLoadingRole) {
    return (
      <div className="min-h-screen bg-neutral-bg flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-natural-primary border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--color-natural-primary) transparent var(--color-natural-primary) transparent' }}></div>
          <p className="text-sm font-semibold text-gray-500">
            {settings.language === 'en' ? 'Checking access rules...' : (settings.language === 'ar' ? 'جاري التحقق من الصلاحيات...' : 'Memuat aturan hak akses...')}
          </p>
        </div>
      </div>
    );
  }

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

          {authError && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs text-center font-semibold leading-relaxed">
              {authError}
            </div>
          )}

          <button 
            onClick={handleLogin}
            disabled={isLoggingIn}
            className={cn(
              "w-full text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-[0.98]",
              isLoggingIn ? "bg-slate-350 cursor-not-allowed opacity-60" : "hover:brightness-110"
            )}
            style={{ backgroundColor: isLoggingIn ? '#94a3b8' : 'var(--color-natural-primary)' }}
          >
            {isLoggingIn ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{settings.language === 'en' ? 'Connecting...' : (settings.language === 'ar' ? 'جاري الاتصال...' : 'Menghubungkan...')}</span>
              </>
            ) : (
              settings.language === 'en' ? 'Sign In with Google' : (settings.language === 'ar' ? 'تسجيل الدخول باستخدام جوجل' : 'Masuk dengan Google')
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-bg flex text-natural-text" style={{ fontFamily: 'var(--font-sans)', direction: settings.language === 'ar' ? 'rtl' : 'ltr' }}>
      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "bg-natural-primary hidden md:flex flex-col text-white shadow-2xl transition-all duration-300 z-20 shrink-0 print:hidden",
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

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
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

      {/* Mobile Slide-Over Drawer Modal */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 md:hidden flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Drawer Panel */}
            <motion.div
              initial={{ x: settings.language === 'ar' ? '100%' : '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: settings.language === 'ar' ? '100%' : '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 280 }}
              className="relative w-4/5 max-w-xs bg-natural-primary text-white flex flex-col h-full shadow-2xl z-10"
              style={{ textAlign: settings.language === 'ar' ? 'right' : 'left' }}
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                    {settings.logoType === 'custom' && settings.customLogoUrl ? (
                      <img src={settings.customLogoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : settings.logoType === 'finance' ? (
                      <Receipt className="w-4 h-4 text-white" />
                    ) : settings.logoType === 'shield' ? (
                      <Shield className="w-4 h-4 text-white" />
                    ) : (
                      <School className="w-4 h-4 text-white" />
                    )}
                  </div>
                  <div className="overflow-hidden">
                    <h1 className="text-xs font-bold leading-tight truncate uppercase tracking-wide">{settings.systemName}</h1>
                    <p className="text-[8px] text-white/50 tracking-wider uppercase truncate">{settings.systemSubName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Navigation */}
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto no-scrollbar">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setIsMobileDrawerOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all border border-transparent",
                      location.pathname === item.path 
                        ? "bg-white/15 text-white border-white/15 shadow-xs font-bold" 
                        : "text-white/75 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className={cn(
                      "w-4 h-4 shrink-0",
                      location.pathname === item.path ? "text-white" : "text-white/50"
                    )} />
                    <span className="truncate">{item.name}</span>
                  </Link>
                ))}
              </nav>

              {/* Drawer User Profile & Logout */}
              <div className="p-3 border-t border-white/10 shrink-0">
                <div className="bg-white/10 rounded-xl p-3">
                  <div className="flex items-center gap-2.5">
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName} 
                      className="w-8 h-8 rounded-full border border-white/20 bg-white/10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate text-white/90">{user.displayName}</p>
                      <p className="text-[9px] text-emerald-300 font-medium truncate">{user.email}</p>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout} 
                    className="w-full mt-2.5 pt-2 border-t border-white/10 flex items-center justify-center gap-1.5 text-xs text-white/60 hover:text-rose-300 transition-colors font-medium cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('signOut')}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative" style={{ textAlign: settings.language === 'ar' ? 'right' : 'left' }}>
        {/* Top Header */}
        <header className="h-14 sm:h-16 bg-white border-b border-natural-border flex items-center justify-between px-3.5 sm:px-6 shrink-0 print:hidden">
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Desktop Collapse Toggle */}
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden md:flex p-1.5 hover:bg-natural-bg rounded-lg text-natural-primary transition-colors cursor-pointer border border-transparent hover:border-natural-border"
              title="Toggle Sidebar"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Mobile Drawer Trigger */}
            <button 
              onClick={() => setIsMobileDrawerOpen(true)}
              className="md:hidden p-2 -ml-1 text-natural-primary hover:bg-slate-100 rounded-xl transition-colors cursor-pointer active:scale-95"
              aria-label="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-serif italic text-natural-primary font-bold truncate">
                {navItems.find(i => i.path === location.pathname)?.name || t('settings')}
              </h2>
              <p className="text-[8px] sm:text-[9px] text-gray-400 uppercase tracking-widest font-sans font-semibold truncate">
                {settings.systemName}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2.5 sm:gap-4">
             <div className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-wider font-bold font-mono hidden sm:block bg-slate-50 border border-natural-border px-3 py-1 rounded-full">
               {new Date().toLocaleDateString(
                 settings.language === 'en' ? 'en-US' : (settings.language === 'ar' ? 'ar-SA' : 'id-ID'), 
                 { month: 'short', year: 'numeric' }
               )}
             </div>
             <button
               onClick={() => setIsMobileDrawerOpen(true)}
               className="md:cursor-default"
               title={user.displayName}
             >
               <img 
                 src={user.photoURL} 
                 alt={user.displayName} 
                 className="w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-natural-border shadow-xs bg-white"
               />
             </button>
          </div>
        </header>

        {/* Page Content Scroll Container */}
        <section className="flex-1 overflow-y-auto bg-natural-bg/50 scroll-smooth">
          <div className="max-w-7xl mx-auto p-3 sm:p-6 lg:p-8 pb-20 md:pb-8">
            {children}
          </div>
        </section>

        {/* Minimalist Mobile Bottom Navigation Bar */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-natural-border/80 px-2 py-1.5 safe-bottom flex items-center justify-around shadow-lg print:hidden">
          <Link
            to="/"
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all",
              location.pathname === '/' 
                ? "text-natural-primary font-bold bg-natural-primary/10" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Dashboard</span>
          </Link>

          {hasPermission('canJournal') && (
            <Link
              to="/jurnal"
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all",
                location.pathname === '/jurnal' 
                  ? "text-natural-primary font-bold bg-natural-primary/10" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Jurnal</span>
            </Link>
          )}

          {(hasPermission('canJournal') || hasPermission('canCOA')) && (
            <Link
              to="/buku-besar"
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all",
                location.pathname === '/buku-besar' 
                  ? "text-natural-primary font-bold bg-natural-primary/10" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Database className="w-4 h-4" />
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Buku Besar</span>
            </Link>
          )}

          {hasPermission('canDebt') && (
            <Link
              to="/hutang-piutang"
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all",
                location.pathname === '/hutang-piutang' 
                  ? "text-natural-primary font-bold bg-natural-primary/10" 
                  : "text-slate-400 hover:text-slate-600"
              )}
            >
              <Users className="w-4 h-4" />
              <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Hutang/Piutang</span>
            </Link>
          )}

          {/* Menu Drawer Toggle */}
          <button
            type="button"
            onClick={() => setIsMobileDrawerOpen(true)}
            className={cn(
              "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all cursor-pointer",
              ['/laporan', '/faktur', '/coa', '/aset-tetap', '/pengaturan', '/trash', '/akses-log'].includes(location.pathname)
                ? "text-natural-primary font-bold bg-natural-primary/10" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <div className="relative">
              <Sliders className="w-4 h-4" />
              {['/laporan', '/faktur', '/coa', '/aset-tetap', '/pengaturan', '/trash', '/akses-log'].includes(location.pathname) && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-natural-primary" />
              )}
            </div>
            <span className="text-[10px] tracking-tight mt-0.5 whitespace-nowrap">Menu</span>
          </button>
        </nav>

        {/* Desktop Footer */}
        <footer className="hidden md:flex px-6 py-3 bg-white/50 border-t border-natural-border justify-between items-center text-[9px] shrink-0 font-medium print:hidden">
          <p className="text-gray-400">
            {settings.language === 'en' ? 'Accounting Support SAK ETAP & PSAK 109 • Nonprofit School Ledger System' : (settings.language === 'ar' ? 'دعم المحاسبة معايير SAK ETAP و PSAK 109 • النظام المالي المدرسي' : 'Bantuan Akuntansi SAK ETAP & PSAK 109 • Sistem Dashboard Akuntansi Sekolah')}
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
