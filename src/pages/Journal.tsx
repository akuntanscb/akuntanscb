import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Trash2, Save, AlertCircle, Edit2, X } from 'lucide-react';
import { getAccounts } from '../services/accountService';
import { createJournalEntry, getJournalEntries, updateJournalEntry, deleteJournalEntry } from '../services/journalService';
import { getDebts } from '../services/debtService';
import { Account, JournalLine, JournalEntry, DebtReceivable } from '../types';
import { auth } from '../lib/firebase';
import { formatRupiah, cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Journal() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [debts, setDebts] = useState<DebtReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [picName, setPicName] = useState('');
  const [selectedDpRef, setSelectedDpRef] = useState('');
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', accountName: '', debit: 0, credit: 0 },
    { accountId: '', accountName: '', debit: 0, credit: 0 },
  ]);
  const [error, setError] = useState('');

  // Edit & Delete States
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [accs, jurs, debtsList] = await Promise.all([getAccounts(), getJournalEntries(), getDebts()]);
    setAccounts(accs);
    setEntries(jurs);
    setDebts(debtsList);
    setLoading(false);
  };

  const handleAddLine = () => {
    setLines([...lines, { accountId: '', accountName: '', debit: 0, credit: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
    const newLines = [...lines];
    if (field === 'accountId') {
      const acc = accounts.find(a => a.id === value);
      newLines[index].accountId = value;
      newLines[index].accountName = acc?.name || '';
    } else {
      newLines[index][field] = Number(value);
    }
    setLines(newLines);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setIsEditingMode(false);
    setEditingEntry(null);
    setDescription('');
    setReference('');
    setPicName('');
    setSelectedDpRef('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setLines([
      { accountId: '', accountName: '', debit: 0, credit: 0 },
      { accountId: '', accountName: '', debit: 0, credit: 0 },
    ]);
    setError('');
  };

  const handleEditClick = (entry: JournalEntry) => {
    setIsEditingMode(true);
    setEditingEntry(entry);
    setDescription(entry.description);
    setReference(entry.reference);
    setPicName((entry as any).picName || '');
    setSelectedDpRef((entry as any).dpRefNumber || '');
    setDate(format(entry.date.toDate(), 'yyyy-MM-dd'));
    setLines(entry.lines.map(line => ({
      accountId: line.accountId,
      accountName: line.accountName,
      debit: line.debit,
      credit: line.credit
    })));
    setShowForm(true);
    setError('');
  };

  const handleDeleteClick = (entry: JournalEntry) => {
    setEntryToDelete(entry);
    setDeleteError('');
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    setIsDeletingLoading(true);
    setDeleteError('');
    try {
      await deleteJournalEntry(entryToDelete.id);
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || 'Gagal menghapus entri jurnal.');
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (!auth.currentUser) throw new Error('Anda harus masuk untuk mencatat jurnal.');
      if (!description) throw new Error('Keterangan harus diisi.');
      
      if (isEditingMode && editingEntry) {
        await updateJournalEntry(
          editingEntry.id,
          description,
          reference,
          lines,
          new Date(date),
          editingEntry.createdBy,
          editingEntry.createdAt,
          picName,
          selectedDpRef
        );
      } else {
        await createJournalEntry(description, reference, lines, auth.currentUser.uid, new Date(date), picName, selectedDpRef);
      }
      
      handleCancelForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const hasCreditUangMuka = lines.some((line) => {
    if (!line.accountId || !line.credit || line.credit <= 0) return false;
    const acc = accounts.find((a) => a.id === line.accountId);
    if (!acc) return false;
    const name = acc.name.toLowerCase();
    return name.includes('uang muka') || name.includes('panjar') || name.includes('dp');
  });

  // Automatically reset selectedDpRef if hasCreditUangMuka becomes false
  useEffect(() => {
    if (!hasCreditUangMuka) {
      setSelectedDpRef('');
    }
  }, [hasCreditUangMuka]);

  const handleSelectDpRef = (refNum: string) => {
    setSelectedDpRef(refNum);
    if (!refNum) return;
    const um = debts.find((d) => d.dpRefNumber === refNum);
    if (um) {
      if (um.picName) {
        setPicName(um.picName);
      }
      const originalRemarks = um.remarks || 'Uang Muka';
      setDescription(`Laporan Pertanggungjawaban ${originalRemarks} [Ref: ${um.dpRefNumber}]`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Jurnal Umum</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Pencatatan transaksi harian sekolah</p>
        </div>
        <button 
          onClick={() => {
            if (showForm) {
              handleCancelForm();
            } else {
              setShowForm(true);
            }
          }}
          className={cn(
            "px-6 py-2.5 rounded-full flex items-center gap-2 transition-all font-semibold shadow-sm",
            showForm ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-natural-primary text-white hover:opacity-90"
          )}
        >
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Batal' : 'Entri Jurnal'}
        </button>
      </div>

      {showForm && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl border border-natural-border shadow-xl"
        >
          {isEditingMode && (
            <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-sm flex justify-between items-center">
              <div>
                <h3 className="font-serif italic font-semibold text-amber-900 text-base">Ubah Jurnal Umum</h3>
                <p className="text-xs text-amber-700">Sedang memperbarui entri jurnal yang dipilih. Pastikan total debit dan kredit seimbang sebelum disimpan.</p>
              </div>
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-full font-bold text-xs"
              >
                Batal Edit
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence>
              {hasCreditUangMuka && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-emerald-50/70 border border-emerald-150 p-4 rounded-xl space-y-2 mb-2">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Pilih Uang Muka yang Diselesaikan</span>
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        Cash Basis Sync
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <select
                          value={selectedDpRef}
                          onChange={(e) => handleSelectDpRef(e.target.value)}
                          className="w-full px-4 py-2 border border-emerald-250 bg-white rounded-lg text-sm text-emerald-950 font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                        >
                          <option value="">-- Hubungkan Nomor Referensi Uang Muka --</option>
                          {debts
                            .filter((d) => d.isUangMuka && d.status !== 'Lunas')
                            .map((d) => (
                              <option key={d.id} value={d.dpRefNumber}>
                                {d.dpRefNumber} - {d.picName || 'Tanpa PIC'} (Sisa: {formatRupiah(d.remainingBalance)})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="text-xs text-emerald-700 leading-relaxed font-sans flex items-center pr-2">
                        Memilih referensi akan otomatis mengisi nama Penanggung Jawab (PIC) dan menyusun keterangan jurnal penyelesaian laporan uang muka secara otomatis.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tanggal</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nomor Referensi</label>
                <input 
                  type="text" 
                  placeholder="Mis: BM-001"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Keterangan</label>
                <input 
                  type="text" 
                  placeholder="Deskripsi transaksi"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between">
                  <span>PIC (Penanggung Jawab DP)</span>
                  <span className="text-[10px] text-gray-400 font-normal uppercase select-none">Opsional</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Nama PIC Uang Muka"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
                <div className="col-span-6">Nama Akun</div>
                <div className="col-span-2 text-right">Debit</div>
                <div className="col-span-2 text-right">Kredit</div>
                <div className="col-span-2"></div>
              </div>
              
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-6">
                    <select 
                      value={line.accountId}
                      onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Pilih Akun...</option>
                      {accounts.sort((a,b) => a.code.localeCompare(b.code)).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      value={line.debit || ''}
                      placeholder="0"
                      onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      value={line.credit || ''}
                      placeholder="0"
                      onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2 text-center">
                    <button 
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-xl">
              <button 
                type="button"
                onClick={handleAddLine}
                className="text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Tambah Baris
              </button>
              
              <div className="text-right space-y-1">
                <div className="flex gap-8 text-sm">
                  <span className="text-slate-500">Total Debit:</span>
                  <span className="font-bold">{formatRupiah(totalDebit)}</span>
                </div>
                <div className="flex gap-8 text-sm">
                  <span className="text-slate-500">Total Kredit:</span>
                  <span className="font-bold">{formatRupiah(totalCredit)}</span>
                </div>
                {!isBalanced && totalDebit + totalCredit > 0 && (
                  <p className="text-red-500 text-xs flex items-center gap-1 justify-end">
                    <AlertCircle className="w-3 h-3" /> Jurnal Tidak Seimbang
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <div className="flex justify-end pt-4">
              <button 
                type="submit"
                disabled={!isBalanced || totalDebit === 0}
                className="bg-natural-primary hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-white px-10 py-3 rounded-full font-bold transition-all shadow-lg flex items-center gap-2"
              >
                <Save className="w-5 h-5" /> {isEditingMode ? 'Perbarui Jurnal' : 'Simpan Jurnal'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Journal Table */}
      <div className="bg-white rounded-3xl border border-natural-border shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-natural-border">
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tanggal</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Referensi</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Keterangan</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Akun</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Debit</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Kredit</th>
              <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <React.Fragment key={entry.id}>
                {entry.lines.map((line, lIdx) => (
                  <tr key={`${entry.id}-${lIdx}`} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-3 text-sm text-slate-500">
                      {lIdx === 0 ? format(entry.date.toDate(), 'dd/MM/yyyy') : ''}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-500">
                      {lIdx === 0 ? entry.reference : ''}
                    </td>
                    <td className="px-6 py-3 text-sm text-slate-700 font-medium">
                      {lIdx === 0 ? (
                        <div>
                          <div>{entry.description}</div>
                          {(entry as any).picName && (
                            <div className="mt-1 text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-150 px-2 py-0.5 rounded-full inline-flex items-center gap-1 font-semibold uppercase tracking-wider">
                              PIC: {(entry as any).picName}
                            </div>
                          )}
                        </div>
                      ) : ''}
                    </td>
                    <td className={cn("px-6 py-3 text-sm text-slate-600", line.credit > 0 && "pl-12")}>
                      <span className="inline-flex items-center gap-2">
                        <span className="font-mono text-xs text-natural-primary/70 bg-natural-primary/5 px-1.5 py-0.5 rounded border border-natural-border">
                          {accounts.find(a => a.id === line.accountId)?.code || ''}
                        </span>
                        <span className="font-medium text-slate-750">
                          {accounts.find(a => a.id === line.accountId)?.name || line.accountName}
                        </span>
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-mono text-emerald-600">
                      {line.debit > 0 ? formatRupiah(line.debit) : ''}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-mono text-rose-600">
                      {line.credit > 0 ? formatRupiah(line.credit) : ''}
                    </td>
                    {lIdx === 0 && (
                      <td className="px-6 py-3 text-center border-l border-slate-100" rowSpan={entry.lines.length}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleEditClick(entry)}
                            className="p-1.5 hover:bg-natural-bg rounded-lg text-natural-primary hover:scale-105 transition-all shadow-sm border border-neutral-100 bg-white inline-flex animate-none"
                            title="Edit Jurnal"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(entry)}
                            className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-600 hover:scale-105 transition-all shadow-sm border border-neutral-100 bg-white inline-flex animate-none"
                            title="Hapus Jurnal"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-slate-400">Belum ada transaksi jurnal.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal overlay */}
      <AnimatePresence>
        {deleteConfirmOpen && entryToDelete && (
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
                  <h3 className="text-lg font-serif italic text-rose-700">Konfirmasi Penghapusan Jurnal</h3>
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
                  Apakah Anda benar-benar yakin ingin menghapus entri jurnal ini secara permanen dari database keuangan? 
                </p>

                <div className="bg-natural-bg/60 border border-natural-border p-4 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Keterangan Jurnal</p>
                  <p className="font-medium text-slate-800 text-sm">
                    {entryToDelete.description}
                  </p>
                  {entryToDelete.reference && (
                    <p className="text-xs text-slate-500">
                      Ref: <span className="font-mono">{entryToDelete.reference}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tanggal: {format(entryToDelete.date.toDate(), 'dd/MM/yyyy')}
                  </p>
                </div>

                <div className="pt-4 border-t border-natural-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setEntryToDelete(null);
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
                    {isDeletingLoading ? 'Menghapus...' : 'Hapus Jurnal'}
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
