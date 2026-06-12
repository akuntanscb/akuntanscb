import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, 
  Search, 
  Plus, 
  Trash2, 
  Save, 
  UserCheck, 
  History, 
  UserPlus, 
  Sliders, 
  AlertCircle, 
  Filter, 
  Download, 
  Info, 
  X, 
  CheckCircle,
  Clock,
  Briefcase
} from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { useUserRole } from '../context/UserRoleContext';
import { 
  getAllUserRoles, 
  saveUserRole, 
  deleteUserRole, 
  DEFAULT_ADMIN_PERMISSIONS, 
  DEFAULT_OPERATOR_PERMISSIONS, 
  DEFAULT_VIEWER_PERMISSIONS 
} from '../services/userRoleService';
import { getActivityLogs, logActivity } from '../services/activityLogService';
import { UserRole, ActivityLog } from '../types';

export default function UserManagement() {
  const { settings } = useSettings();
  const { userRole: currentUserRole, user } = useUserRole();
  const [activeTab, setActiveTab] = useState<'rules' | 'logs'>('rules');

  // Rules tab states
  const [userRolesList, setUserRolesList] = useState<UserRole[]>([]);
  const [isRulesLoading, setIsRulesLoading] = useState(true);
  const [ruleSearch, setRuleSearch] = useState('');
  
  // Selected user for editing/adding
  const [selectedRole, setSelectedRole] = useState<Partial<UserRole> | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [roleSelect, setRoleSelect] = useState<'admin' | 'operator' | 'viewer'>('operator');
  const [permissionsInput, setPermissionsInput] = useState<UserRole['permissions']>({ ...DEFAULT_OPERATOR_PERMISSIONS });
  const [restrictedUnitsInput, setRestrictedUnitsInput] = useState<('SMP' | 'SMA' | 'Umum')[]>([]);

  // Logs tab states
  const [logsList, setLogsList] = useState<ActivityLog[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState(true);
  const [logSearch, setLogSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterEmail, setFilterEmail] = useState<string>('all');

  // Alerts
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load Rules Data
  const loadRulesData = async () => {
    setIsRulesLoading(true);
    try {
      const list = await getAllUserRoles();
      setUserRolesList(list);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal memuat aturan hak akses pengguna.');
    } finally {
      setIsRulesLoading(false);
    }
  };

  // Load Logs Data
  const loadLogsData = async () => {
    setIsLogsLoading(true);
    try {
      const logs = await getActivityLogs(500);
      setLogsList(logs);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Gagal memuat riwayat log aktivitas.');
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'rules') {
      loadRulesData();
    } else {
      loadLogsData();
    }
  }, [activeTab]);

  // Show Toast / Message helper
  const triggerSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  // Guard: Only allow admin to access this page
  if (currentUserRole?.role !== 'admin') {
    return (
      <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md mx-auto my-12 shadow-sm">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">Akses Ditolak / Access Denied</h3>
        <p className="text-sm text-slate-500 mb-6">
          {settings.language === 'en' 
            ? 'You do not have administrative privileges to manage user roles and logs.' 
            : 'Anda tidak memiliki hak istimewa administrator untuk mengelola aturan hak akses dan log aktivitas.'}
        </p>
      </div>
    );
  }

  // Handle Role Select Change to prepopulate presets
  const handleRolePresetChange = (role: 'admin' | 'operator' | 'viewer') => {
    setRoleSelect(role);
    if (role === 'admin') {
      setPermissionsInput({ ...DEFAULT_ADMIN_PERMISSIONS });
    } else if (role === 'operator') {
      setPermissionsInput({ ...DEFAULT_OPERATOR_PERMISSIONS });
    } else {
      setPermissionsInput({ ...DEFAULT_VIEWER_PERMISSIONS });
    }
  };

  // Open Edit User Role Panel
  const startEditRole = (roleItem: UserRole) => {
    setSelectedRole(roleItem);
    setIsAddingNew(false);
    setEmailInput(roleItem.email);
    setNameInput(roleItem.name || '');
    setRoleSelect(roleItem.role);
    setPermissionsInput({ ...roleItem.permissions });
    setRestrictedUnitsInput([...roleItem.restrictedUnits]);
  };

  // Open New User Rule Setup
  const startAddNewRule = () => {
    setSelectedRole(null);
    setIsAddingNew(true);
    setEmailInput('');
    setNameInput('');
    setRoleSelect('operator');
    setPermissionsInput({ ...DEFAULT_OPERATOR_PERMISSIONS });
    setRestrictedUnitsInput([]);
  };

  const handleTogglePermission = (key: keyof UserRole['permissions']) => {
    setPermissionsInput(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleToggleRestrictedUnit = (unit: 'SMP' | 'SMA' | 'Umum') => {
    if (restrictedUnitsInput.includes(unit)) {
      setRestrictedUnitsInput(prev => prev.filter(u => u !== unit));
    } else {
      setRestrictedUnitsInput(prev => [...prev, unit]);
    }
  };

  // Save changes
  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) {
      triggerError('Email harus diisi.');
      return;
    }

    const emailLower = emailInput.trim().toLowerCase();
    
    // Prevent locking out primary admin
    if (emailLower === 'keuangan.scb@gmail.com' && roleSelect !== 'admin') {
      triggerError('Akun utama keuangan.scb@gmail.com harus selalu memiliki peran admin.');
      return;
    }

    setIsSaving(true);
    try {
      const dataToSave = {
        email: emailLower,
        name: nameInput.trim() || emailLower.split('@')[0],
        role: roleSelect,
        permissions: permissionsInput,
        restrictedUnits: restrictedUnitsInput,
      };

      await saveUserRole(emailLower, dataToSave);
      
      // Log Action
      const actionDesc = isAddingNew 
        ? `Membuat aturan akses baru untuk ${emailLower} (${roleSelect})` 
        : `Memperbarui aturan akses ${emailLower} (${roleSelect})`;

      const detailsDesc = `Peran: ${roleSelect}. Izin: ${Object.entries(permissionsInput)
        .filter(([_, val]) => val)
        .map(([k]) => k)
        .join(', ')}. Batasan Unit: ${restrictedUnitsInput.join(', ') || 'Tidak ada'}`;

      await logActivity(actionDesc, 'Users', detailsDesc);

      triggerSuccess(`Aturan akses untuk ${emailLower} berhasil disimpan.`);
      setIsAddingNew(false);
      setSelectedRole(null);
      loadRulesData();
    } catch (err: any) {
      console.error(err);
      triggerError('Gagal menyimpan aturan akses.');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete User Role
  const handleDeleteRole = async (roleItem: UserRole) => {
    const emailLower = roleItem.email.toLowerCase();
    if (emailLower === 'keuangan.scb@gmail.com') {
      triggerError('Pengguna utama administrator tidak boleh dihapus.');
      return;
    }

    if (!window.confirm(`Apakah Anda yakin ingin menghapus seluruh aturan dan batasan akses untuk ${roleItem.email}?`)) {
      return;
    }

    try {
      await deleteUserRole(roleItem.email);
      await logActivity(
        `Menghapus aturan akses pengguna: ${roleItem.email}`, 
        'Users', 
        `Aturan operasional dan batasan unit sekolah milik ${roleItem.email} sepenuhnya dihapus dari sistem.`
      );
      triggerSuccess(`Aturan akses untuk ${roleItem.email} didelete.`);
      if (selectedRole?.email === roleItem.email) {
        setSelectedRole(null);
      }
      loadRulesData();
    } catch (err: any) {
      console.error(err);
      triggerError('Gagal menghapus aturan akses.');
    }
  };

  // Export Logs to CSV
  const handleExportLogsCSV = () => {
    if (logsList.length === 0) {
      triggerError('Tidak ada data log untuk diekspor.');
      return;
    }

    try {
      const headers = ['Waktu', 'Pengguna', 'Email', 'Aktivitas', 'Kategori', 'Detail'];
      const csvRows = [headers.join(',')];

      logsList.forEach(log => {
        const timeStr = log.timestamp?.seconds 
          ? new Date(log.timestamp.seconds * 1000).toLocaleString('id-ID') 
          : new Date(log.timestamp).toLocaleString('id-ID');

        const row = [
          `"${timeStr}"`,
          `"${log.userName.replace(/"/g, '""')}"`,
          `"${log.userEmail}"`,
          `"${log.action.replace(/"/g, '""')}"`,
          `"${log.category}"`,
          `"${log.details.replace(/"/g, '""').replace(/\n/g, ' ')}"`
        ];
        csvRows.push(row.join(','));
      });

      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `Log_Aktivitas_SIA_SCB_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logActivity('Ekspor Log Aktivitas', 'Settings', 'Mengekspor riwayat log aktivitas pengguna ke dalam berkas CSV.').catch(() => {});
      triggerSuccess('Log berhasil diekspor ke berkas CSV.');
    } catch (error) {
      console.error('Ekspor log gagal:', error);
      triggerError('Gagal mengekspor log ke CSV.');
    }
  };

  // Search/Filters logic
  const filteredRoles = userRolesList.filter(role => 
    role.email.toLowerCase().includes(ruleSearch.toLowerCase()) || 
    (role.name && role.name.toLowerCase().includes(ruleSearch.toLowerCase()))
  );

  const filteredLogs = logsList.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.details.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(logSearch.toLowerCase()) ||
      log.userName.toLowerCase().includes(logSearch.toLowerCase());

    const matchesCategory = filterCategory === 'all' || log.category === filterCategory;
    const matchesEmail = filterEmail === 'all' || log.userEmail === filterEmail;

    return matchesSearch && matchesCategory && matchesEmail;
  });

  // Extract all unique log emails for filter dropdown
  const uniqueLogEmails = Array.from(new Set(logsList.map(log => log.userEmail)));

  return (
    <div className="space-y-6" style={{ fontFamily: 'var(--font-sans)' }}>
      {/* Banner / Title Panel */}
      <div className="bg-gradient-to-r from-emerald-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
          <Shield className="w-80 h-80 text-white" />
        </div>
        <div className="relative z-10 max-w-4xl">
          <div className="flex items-center gap-3 mb-2.5">
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" /> ADMINISTRATOR SECURITY CONTROL
            </span>
          </div>
          <h1 className="text-3xl font-bold font-serif italic text-emerald-100">Aturan Akses & Audit Log Aktivitas</h1>
          <p className="text-slate-300 text-sm mt-3 leading-relaxed max-w-3xl">
            Sistem manajemen kontrol otorisasi akun pengguna Sekolah Cendekia Baznas. Atur peran (Admin, Operator, Viewer), 
            berikan batasan granular fitur tertentu, batasi visibilitas unit sekolah (SMP/SMA), serta tinjau seluruh rekaman audit aktivitas log demi akuntabilitas kepatuhan pengelolaan dana donasi dan operasional.
          </p>
        </div>
      </div>

      {/* SUCCESS / ERROR TOASTS */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3 text-emerald-800 text-sm"
          >
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </motion.div>
        )}
        {errorMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-800 text-sm"
          >
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs Selector */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-6 py-3.5 font-sans text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'rules'
              ? 'border-emerald-600 text-emerald-950 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-emerald-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          Aturan Hak & Batasan Pengguna
        </button>
        <button
          onClick={() => setActiveTab('logs')}
          className={`px-6 py-3.5 font-sans text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'logs'
              ? 'border-emerald-600 text-emerald-950 bg-emerald-50/50 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-emerald-700'
          }`}
        >
          <History className="w-4 h-4" />
          Log Aktivitas Akun (Audit Trail)
        </button>
      </div>

      {/* RULES TAB CONTENT */}
      {activeTab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* User List Panel (2 Cols on large screens) */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari email atau nama pengguna..."
                  value={ruleSearch}
                  onChange={(e) => setRuleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-sans"
                />
              </div>

              <button
                onClick={startAddNewRule}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all cursor-pointer hover:shadow-md"
              >
                <UserPlus className="w-4 h-4" />
                Tambah Aturan Pengguna
              </button>
            </div>

            {isRulesLoading ? (
              <div className="p-12 text-center text-gray-500 font-sans">
                <RefreshSpinner />
                <p className="mt-2 text-sm font-medium">Memuat data pengguna...</p>
              </div>
            ) : filteredRoles.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Shield className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-semibold">Tidak ditemukan konfigurasi pengguna</p>
                <p className="text-xs text-gray-400 mt-1">Coba gunakan kata kuncari lain atau tambah konfigurasi baru.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-50 border-b border-gray-100 text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                      <th className="p-4">Identitas Pengguna</th>
                      <th className="p-4">Peran (Role)</th>
                      <th className="p-4">Akses Unit</th>
                      <th className="p-4">Izin Fitur</th>
                      <th className="p-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-xs">
                    {filteredRoles.map((role) => (
                      <tr 
                        key={role.email} 
                        className={`hover:bg-slate-50/50 transition-colors ${
                          selectedRole?.email === role.email ? 'bg-emerald-50/20' : ''
                        }`}
                      >
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{role.name || role.email.split('@')[0]}</div>
                          <div className="text-[10px] text-gray-400 font-mono font-medium mt-0.5">{role.email}</div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            role.role === 'admin' 
                              ? 'bg-rose-50 text-rose-700 border border-rose-100' 
                              : role.role === 'operator'
                                ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                : 'bg-gray-50 text-gray-600 border border-gray-100'
                          }`}>
                            {role.role.toUpperCase()}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">
                          {role.restrictedUnits && role.restrictedUnits.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[120px]">
                              {['SMP', 'SMA', 'Umum'].map(unit => (
                                <span 
                                  key={unit} 
                                  className={`px-1.5 py-0.5 rounded text-[9px] ${
                                    role.restrictedUnits.includes(unit as any)
                                      ? 'bg-rose-100 text-rose-800 font-extrabold line-through decoration-rose-500 decoration-1'
                                      : 'bg-emerald-50 text-emerald-800 font-bold'
                                  }`}
                                  title={role.restrictedUnits.includes(unit as any) ? `Unit ${unit} Dibatasi` : `Unit ${unit} Diizinkan`}
                                >
                                  {unit}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded text-[10px]">Semua Unit</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {role.role === 'admin' ? (
                              <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded text-[9px]">Full Access (Admin)</span>
                            ) : (
                              Object.entries(role.permissions || {})
                                .filter(([_, isGranted]) => isGranted)
                                .map(([key]) => {
                                  let friendlyName = key;
                                  if (key === 'canCOA') friendlyName = 'COA';
                                  if (key === 'canJournal') friendlyName = 'Jurnal';
                                  if (key === 'canInvoices') friendlyName = 'Faktur';
                                  if (key === 'canDebt') friendlyName = 'Hutang';
                                  if (key === 'canFixedAssets') friendlyName = 'Aset Tetap';
                                  if (key === 'canSettings') friendlyName = 'Sistem';
                                  if (key === 'canUsers') friendlyName = 'User';
                                  if (key === 'canTrash') friendlyName = 'Sampah';
                                  return (
                                    <span key={key} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[9px] font-semibold">
                                      {friendlyName}
                                    </span>
                                  );
                                })
                            )}
                            {role.role !== 'admin' && Object.values(role.permissions || {}).every(v => !v) && (
                              <span className="text-gray-400 font-semibold italic text-[10px]">Pembatasan Penuh (Viewer Only)</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => startEditRole(role)}
                              className="text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 font-bold px-3 py-1.5 rounded-lg text-[11px] cursor-pointer transition-colors"
                            >
                              Edit Batasan
                            </button>
                            {role.email !== 'keuangan.scb@gmail.com' && (
                              <button
                                onClick={() => handleDeleteRole(role)}
                                className="text-rose-600 hover:bg-rose-50 rounded-lg p-2 cursor-pointer transition-colors"
                                title="Hapus Aturan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="bg-slate-50 p-4 border-t border-gray-100 text-[11px] text-gray-500 font-sans flex items-start gap-2.5">
              <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-700 mb-0.5">Penjelasan Mekanisme Batasan:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-gray-500 font-medium leading-relaxed">
                  <li><strong>Admin</strong>: Seluruh hak akses fitur terbuka dan dapat melipatgandakan data unit.</li>
                  <li><strong>Operator</strong>: Dapat beroperasi mencatat, mengubah, mendelete (sesuai centang kustom), namun secara default dibatasi tidak memiliki akses ke Menu Hapus Permanen (Tempat Sampah), Menu Setelan Global, dan Aturan Hak Akses.</li>
                  <li><strong>Viewer</strong>: Hanya bersifat membaca data laporan dan dashboard tanpa diperkenankan menginput transaksi atau mengubah Chart of Accounts (COA).</li>
                  <li><strong>Batas Unit</strong>: Modul yang tercentang dicoret (misal: SMP dicoret) menandakan pengguna tidak diizinkan mendata, melihat, atau memfilter data keuangan bagi unit sekolah terkait.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Configuration Form Panel */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden lg:sticky lg:top-6">
            <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-400" />
                {isAddingNew ? 'Tambah Akses Pengguna' : selectedRole ? 'Edit Aturan Akses' : 'Pilih Pengguna'}
              </h3>
              {(isAddingNew || selectedRole) && (
                <button 
                  onClick={() => {
                    setIsAddingNew(false);
                    setSelectedRole(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {!(isAddingNew || selectedRole) ? (
              <div className="p-8 text-center text-gray-400">
                <UserCheck className="w-12 h-12 text-gray-200 mx-auto mb-4" />
                <h4 className="font-bold text-slate-700 mb-1 text-sm">Konfigurasi Hak Akses</h4>
                <p className="text-xs leading-relaxed max-w-xs mx-auto">
                  Pilih salah satu pengguna dari tabel di samping untuk mengubah batasan fiturnya, atau klik tombol 
                  <strong> "Tambah Aturan Pengguna"</strong> untuk mendaftarkan kredensial login Google baru.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveRole} className="p-6 space-y-5 font-sans">
                {/* Identitas */}
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Email Akun Google (Kunci Login)</label>
                    <input
                      type="email"
                      required
                      placeholder="contoh: staf.keuangan@gmail.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      disabled={!isAddingNew}
                      className="w-full text-xs font-semibold px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-gray-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Nama Pengguna (Opsional)</label>
                    <input
                      type="text"
                      placeholder="contoh: Budi Setiawan"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="w-full text-xs font-semibold px-3 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                {/* Role Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Peran Utama (Preset Master)</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['admin', 'operator', 'viewer'] as const).map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRolePresetChange(role)}
                        disabled={emailInput.toLowerCase() === 'keuangan.scb@gmail.com' && role !== 'admin'}
                        className={`py-2 text-[10px] font-bold uppercase tracking-wider border rounded-xl transition-all cursor-pointer ${
                          roleSelect === role
                            ? 'bg-emerald-900 border-emerald-900 text-white shadow-sm'
                            : 'bg-white border-gray-250 text-gray-600 hover:bg-slate-50'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Batasan Unit Sekolah */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1 mt-1">BATASI Akses Unit Sekolah</label>
                  <p className="text-[10px] text-slate-400 mb-2 font-medium">Centang unit di bawah untuk <strong>MELARANG</strong> pengguna melihat/mengubah kas unit tersebut:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(['SMP', 'SMA', 'Umum'] as const).map((unit) => {
                      const isRestricted = restrictedUnitsInput.includes(unit);
                      return (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => handleToggleRestrictedUnit(unit)}
                          disabled={roleSelect === 'admin'}
                          className={`py-2 text-[11px] font-bold rounded-xl border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                            roleSelect === 'admin'
                              ? 'bg-slate-50 border-gray-150 text-gray-300 line-through cursor-not-allowed'
                              : isRestricted
                                ? 'bg-rose-50 border-rose-300 text-rose-700 font-extrabold shadow-sm'
                                : 'bg-emerald-50/40 border-emerald-200 text-emerald-800'
                          }`}
                        >
                          {unit} {isRestricted ? '(X Dibatasi)' : '(✓ Aman)'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Granular Permission Toggles (Only editable if not admin) */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Batasan Izin Fitur Granular</label>
                    {roleSelect === 'admin' ? (
                      <span className="text-[9px] bg-rose-50 text-rose-700 font-bold px-1.5 py-0.5 rounded border border-rose-100">FULL ACCESS</span>
                    ) : (
                      <span className="text-[9px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded">CUSTOMIZABLE</span>
                    )}
                  </div>

                  <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-gray-200 text-xs">
                    {[
                      { key: 'canCOA', label: 'Kelola Daftar Akun (COA)' },
                      { key: 'canJournal', label: 'Catat/Ubah Jurnal Umum' },
                      { key: 'canInvoices', label: 'Kelola Faktur & Penerimaan' },
                      { key: 'canDebt', label: 'Kelola Catatan Hutang/Piutang' },
                      { key: 'canFixedAssets', label: 'Kelola Aset Tetap & Susut' },
                      { key: 'canSettings', label: 'Akses Setelan Branding & Lias' },
                      { key: 'canTrash', label: 'Akses Tempat Sampah (Pemulihan)' },
                    ].map((perm) => {
                      const value = permissionsInput[perm.key as keyof UserRole['permissions']];
                      return (
                        <label 
                          key={perm.key} 
                          className={`flex items-center justify-between p-1.5 rounded-lg transition-all ${
                            roleSelect === 'admin' 
                              ? 'opacity-65 cursor-not-allowed' 
                              : 'cursor-pointer hover:bg-white'
                          }`}
                        >
                          <span className="font-semibold text-slate-700 text-[11px]">{perm.label}</span>
                          <input
                            type="checkbox"
                            checked={roleSelect === 'admin' ? true : value}
                            disabled={roleSelect === 'admin'}
                            onChange={() => handleTogglePermission(perm.key as keyof UserRole['permissions'])}
                            className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500/50 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Form Buttons */}
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer hover:shadow-md disabled:bg-slate-300 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  {isSaving ? 'Menyimpan...' : 'Simpan Batasan Akses'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB CONTENT */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden font-sans">
          {/* Filters Bar */}
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/50">
            <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
              {/* Search */}
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari kata kunci log, subjek..."
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Category */}
              <div className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-gray-400 hidden sm:block" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="bg-white border border-gray-200 text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-700 cursor-pointer"
                >
                  <option value="all">Semua Kategori</option>
                  <option value="Auth">Auth & Login</option>
                  <option value="COA">Chart of Accounts</option>
                  <option value="Journal">Jurnal Umum</option>
                  <option value="Invoice">Faktur</option>
                  <option value="Debts">Hutang & Piutang</option>
                  <option value="Assets">Aset Tetap</option>
                  <option value="Users">Manajemen Pengguna</option>
                  <option value="Settings">Sistem Setting</option>
                  <option value="Trash">Tempat Sampah</option>
                </select>
              </div>

              {/* User Email Email */}
              <select
                value={filterEmail}
                onChange={(e) => setFilterEmail(e.target.value)}
                className="bg-white border border-gray-200 text-xs px-2.5 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-700 cursor-pointer max-w-[150px] sm:max-w-none"
              >
                <option value="all">Semua Akun</option>
                {uniqueLogEmails.map(mail => (
                  <option key={mail} value={mail}>{mail}</option>
                ))}
              </select>
            </div>

            {/* Export Logs button */}
            <button
              onClick={handleExportLogsCSV}
              className="bg-slate-900 border border-slate-955 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-all shrink-0 shadow-sm"
              title="Unduh seluruh log aktivitas saat ini ke dalam CSV"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              Ekspor Buku Log (CSV)
            </button>
          </div>

          {/* Logs Table */}
          {isLogsLoading ? (
            <div className="p-12 text-center text-gray-500">
              <RefreshSpinner />
              <p className="mt-2 text-sm font-semibold">Menganalisis berkas log aktivitas...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-bold">Log kosong atau tidak cocok</p>
              <p className="text-xs text-gray-400 mt-1">Belum ada aktivitas terekam untuk kriteria pencarian ini.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100 text-gray-500 font-bold text-[11px] uppercase tracking-wider">
                    <th className="p-4 w-[160px]">Stempel Waktu</th>
                    <th className="p-4 w-[150px]">Akun Keuangan</th>
                    <th className="p-4 w-[100px]">Modul</th>
                    <th className="p-4 w-[250px]">Aktivitas Utama</th>
                    <th className="p-4 w-[350px]">Penjelasan Teknis & Parameter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredLogs.map((log) => {
                    const dateFormatted = log.timestamp?.seconds 
                      ? new Date(log.timestamp.seconds * 1000).toLocaleString('id-ID', {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit'
                        })
                      : new Date(log.timestamp).toLocaleString('id-ID');

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/30 transition-colors">
                        {/* Timestamp */}
                        <td className="p-4 text-gray-500 font-mono text-[10px] whitespace-nowrap">
                          {dateFormatted}
                        </td>

                        {/* User identity */}
                        <td className="p-4 overflow-hidden truncate">
                          <div className="font-bold text-slate-900 truncate" title={log.userName}>{log.userName}</div>
                          <div className="text-[9px] text-gray-400 font-mono font-medium truncate mt-0.5" title={log.userEmail}>{log.userEmail}</div>
                        </td>

                        {/* Category Badge */}
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                            log.category === 'Auth'
                              ? 'bg-blue-50 text-blue-700 border border-blue-100'
                              : log.category === 'COA'
                                ? 'bg-slate-50 text-slate-700 border border-slate-100'
                                : log.category === 'Journal'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                                  : log.category === 'Invoice'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                    : log.category === 'Debts'
                                      ? 'bg-amber-50 text-amber-800 border border-amber-100'
                                      : log.category === 'Assets'
                                        ? 'bg-violet-50 text-violet-700 border border-violet-100'
                                        : log.category === 'Users'
                                          ? 'bg-purple-50 text-purple-700 border border-purple-100'
                                          : log.category === 'Trash'
                                            ? 'bg-orange-50 text-orange-700 border border-orange-100'
                                            : 'bg-teal-50 text-teal-700 border border-teal-100'
                          }`}>
                            {log.category}
                          </span>
                        </td>

                        {/* Action Text */}
                        <td className="p-4 font-bold text-slate-800 tracking-wide leading-relaxed">
                          {log.action}
                        </td>

                        {/* Details */}
                        <td className="p-4 text-gray-500 font-medium leading-relaxed font-mono text-[10px] break-words whitespace-normal">
                          {log.details || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RefreshSpinner() {
  return (
    <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
  );
}
