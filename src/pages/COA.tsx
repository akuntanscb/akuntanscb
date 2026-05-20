import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Tag, Wallet, Edit2, Trash2, X, Save, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../services/accountService';
import { getJournalEntries } from '../services/journalService';
import { Account, AccountCategory } from '../types';
import { formatRupiah, cn } from '../lib/utils';

export default function COA() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AccountCategory>('Aset');
  const [subCategory, setSubCategory] = useState('');
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Delete Confirmation States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const accs = await getAccounts();
      setAccounts(accs.sort((a, b) => a.code.localeCompare(b.code)));
    } catch (err) {
      console.error('Failed to fetch accounts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingAccountId(null);
    setCode('');
    setName('');
    setCategory('Aset');
    setSubCategory('');
    setInitialBalance('0');
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setIsEditing(true);
    setEditingAccountId(acc.id);
    setCode(acc.code);
    setName(acc.name);
    setCategory(acc.category);
    setSubCategory(acc.subCategory || '');
    setInitialBalance(String(acc.initialBalance || 0));
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!code.trim()) {
      setErrorMsg('Kode akun wajib diisi.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Nama akun wajib diisi.');
      return;
    }
    if (!category) {
      setErrorMsg('Kategori akun wajib dipilih.');
      return;
    }

    try {
      // Validate code format (numbers only or standard alphanumeric)
      if (!/^[a-zA-Z0-9_\-]+$/.test(code.trim())) {
        setErrorMsg('Kode akun hanya boleh berisi huruf, angka, strip (-), atau underscore (_).');
        return;
      }

      // Check duplicate code
      const duplicateCode = accounts.some(acc => 
        acc.code === code.trim() && (!isEditing || acc.id !== editingAccountId)
      );
      if (duplicateCode) {
        setErrorMsg(`Kode akun "${code}" sudah dialokasikan untuk akun lain.`);
        return;
      }

      const balanceValue = Number(initialBalance) || 0;

      const accountData = {
        code: code.trim(),
        name: name.trim(),
        category,
        subCategory: subCategory.trim(),
        initialBalance: balanceValue,
        isDeletable: isEditing ? (accounts.find(a => a.id === editingAccountId)?.isDeletable ?? true) : true
      };

      if (isEditing && editingAccountId) {
        await updateAccount(editingAccountId, accountData);
        setSuccessMsg('Akun berhasil diperbarui!');
      } else {
        await createAccount(accountData);
        setSuccessMsg('Akun baru berhasil didaftarkan!');
      }

      // Refresh list and auto close modal after brief delay
      setTimeout(() => {
        setIsModalOpen(false);
        fetchAccounts();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyimpan perubahan akun.');
    }
  };

  const handleDeleteTrigger = async (accId: string, accName: string) => {
    setAccountToDelete({ id: accId, name: accName });
    setDeleteError('');
    setHasTransactions(false);
    setTransactionCount(0);
    setDeleteConfirmOpen(true);

    try {
      const entries = await getJournalEntries();
      let count = 0;
      entries.forEach(entry => {
        if (entry.lines && Array.isArray(entry.lines)) {
          entry.lines.forEach(line => {
            if (line.accountId === accId) {
              count++;
            }
          });
        }
      });
      if (count > 0) {
        setHasTransactions(true);
        setTransactionCount(count);
      }
    } catch (e) {
      console.error('Gagal memeriksa transaksi untuk akun ini:', e);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;
    setIsDeletingLoading(true);
    setDeleteError('');
    try {
      await deleteAccount(accountToDelete.id);
      setSuccessMsg(`Akun "${accountToDelete.name}" berhasil dihapus.`);
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
      fetchAccounts();
      setTimeout(() => {
        setSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || 'Gagal menghapus akun keuangan.');
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const categories = [
    { name: 'Aset', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { name: 'Liabilitas', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { name: 'Ekuitas', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { name: 'Pendapatan', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { name: 'Beban', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    acc.code.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Bagan Akun (COA)</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Struktur database akun keuangan sekolah</p>
        </div>
        <button 
          onClick={handleOpenAdd}
          className="bg-natural-primary hover:opacity-90 text-white px-6 py-2.5 rounded-full flex items-center gap-2 transition-all font-semibold shadow-sm text-sm"
        >
          <Plus className="w-4 h-4" /> Tambah Akun
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-natural-border shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400 ml-2" />
        <input 
          type="text" 
          placeholder="Cari kode atau nama akun..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent outline-none text-natural-text text-sm p-2"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {categories.map(cat => (
          <div key={cat.name} className="bg-white p-5 rounded-2xl border border-natural-border shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{cat.name}</p>
            <p className="text-xl font-serif text-natural-primary">
              {accounts.filter(a => a.category === cat.name).length} <span className="text-[10px] font-sans font-bold text-gray-300 uppercase">Akun</span>
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-natural-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-550 italic">Memuat daftar bagan akun...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-natural-border text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-5">Kode</th>
                <th className="px-6 py-5">Nama Akun</th>
                <th className="px-6 py-5">Kategori</th>
                <th className="px-6 py-5">Sub-Kategori</th>
                <th className="px-6 py-5 text-right">Saldo Awal</th>
                <th className="px-6 py-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-slate-500 font-semibold">{acc.code}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{acc.name}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      categories.find(c => c.name === acc.category)?.color
                    )}>
                      {acc.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{acc.subCategory || '-'}</td>
                  <td className="px-6 py-4 text-right font-mono text-sm text-slate-800">
                    {formatRupiah(acc.initialBalance)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="p-1.5 hover:bg-natural-bg rounded-lg text-natural-primary hover:scale-105 transition-all shadow-sm border border-neutral-100 bg-white inline-flex"
                        title="Edit Akun"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrigger(acc.id, `${acc.code} - ${acc.name}`)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-600 hover:scale-105 transition-all shadow-sm border border-neutral-100 bg-white inline-flex"
                        title="Hapus Akun"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Tidak ada akun yang sesuai pencarian.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Account Input / Edit Modal overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-natural-border bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-serif italic text-natural-primary">
                    {isEditing ? 'Ubah Akun Keuangan' : 'Registrasi Akun Baru'}
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {isEditing ? 'Perbarui Atribut Akun yang Dipilih' : 'Formulir Bagan Akun Baru'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-150 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl flex items-center gap-2 animate-pulse">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                 <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Kode Akun</label>
                    <input
                      type="text"
                      placeholder="Mis: 1104"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Kategori Utama</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as AccountCategory)}
                      className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40"
                    >
                      <option value="Aset">Aset</option>
                      <option value="Liabilitas">Liabilitas</option>
                      <option value="Ekuitas">Ekuitas</option>
                      <option value="Pendapatan">Pendapatan</option>
                      <option value="Beban">Beban</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Nama Akun</label>
                  <input
                    type="text"
                    placeholder="Mis: Dana Kas Operasional"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Sub-Kategori</label>
                    <input
                      type="text"
                      placeholder="Mis: Kas & Bank"
                      value={subCategory}
                      onChange={(e) => setSubCategory(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Saldo Awal (RP)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40 text-right font-mono"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-natural-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 border border-natural-border rounded-full text-xs font-bold uppercase tracking-wider text-slate-550 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-natural-primary hover:opacity-95 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md"
                  >
                    <Save className="w-3.5 h-3.5" /> Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal overlay */}
      <AnimatePresence>
        {deleteConfirmOpen && accountToDelete && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-natural-border bg-rose-50/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif italic text-rose-700">Konfirmasi Penghapusan</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tindakan ini permanen</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {deleteError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <p className="text-sm text-slate-700 leading-relaxed font-sans">
                  Apakah Anda benar-benar yakin ingin menghapus akun keuangan berikut dari database sekolah?
                </p>

                <div className="bg-natural-bg/60 border border-natural-border p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Akun Terpilih</p>
                  <p className="font-serif font-medium text-natural-primary text-base">
                    {accountToDelete.name}
                  </p>
                </div>

                {hasTransactions && (
                  <div className="p-3.5 bg-amber-50 border border-amber-255 text-amber-900 text-xs rounded-xl flex flex-col gap-1.5 font-sans leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-amber-950 uppercase tracking-wider text-[10px]">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>PERINGATAN TRANSAKSI AKTIF</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Akun ini terdeteksi memiliki dan digunakan dalam <strong className="font-bold text-amber-950">{transactionCount} baris jurnal aktif</strong>. 
                      Menghapusnya akan memutus kaitan akun ini dengan transaksi terkait, namun data transaksi historis aslinya akan dipertahankan dengan nama teks cadangannya di Buku Besar dan Laporan lainnya.
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-natural-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setAccountToDelete(null);
                    }}
                    disabled={isDeletingLoading}
                    className="px-5 py-2.5 border border-natural-border rounded-full text-xs font-bold uppercase tracking-wider text-slate-550 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={isDeletingLoading}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-600/10 transition-colors"
                  >
                    {isDeletingLoading ? 'Menghapus...' : 'Hapus Akun'}
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
