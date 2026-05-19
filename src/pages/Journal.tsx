import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Plus, Trash2, Save, AlertCircle } from 'lucide-react';
import { getAccounts } from '../services/accountService';
import { createJournalEntry, getJournalEntries } from '../services/journalService';
import { Account, JournalLine, JournalEntry } from '../types';
import { auth } from '../lib/firebase';
import { formatRupiah, cn } from '../lib/utils';
import { format } from 'date-fns';

export default function Journal() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form State
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', accountName: '', debit: 0, credit: 0 },
    { accountId: '', accountName: '', debit: 0, credit: 0 },
  ]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [accs, jurs] = await Promise.all([getAccounts(), getJournalEntries()]);
    setAccounts(accs);
    setEntries(jurs);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (!auth.currentUser) throw new Error('Anda harus masuk untuk mencatat jurnal.');
      if (!description) throw new Error('Keterangan harus diisi.');
      
      await createJournalEntry(description, reference, lines, auth.currentUser.uid, new Date(date));
      
      setShowForm(false);
      setDescription('');
      setReference('');
      setLines([
        { accountId: '', accountName: '', debit: 0, credit: 0 },
        { accountId: '', accountName: '', debit: 0, credit: 0 },
      ]);
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Jurnal Umum</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Pencatatan transaksi harian sekolah</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={cn(
            "px-6 py-2.5 rounded-full flex items-center gap-2 transition-all font-semibold shadow-sm",
            showForm ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-natural-primary text-white hover:opacity-90"
          )}
        >
          {showForm ? <Trash2 className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? 'Batal' : 'Entri Jurnal'}
        </button>
      </div>

      {showForm && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl border border-natural-border shadow-xl"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tanggal</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nomor Referensi</label>
                <input 
                  type="text" 
                  placeholder="Mis: BM-001"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Keterangan</label>
                <input 
                  type="text" 
                  placeholder="Deskripsi transaksi"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
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
                <Save className="w-5 h-5" /> Simpan Jurnal
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
                      {lIdx === 0 ? entry.description : ''}
                    </td>
                    <td className={cn("px-6 py-3 text-sm text-slate-600", line.credit > 0 && "pl-12")}>
                      {line.accountName}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-mono text-emerald-600">
                      {line.debit > 0 ? formatRupiah(line.debit) : ''}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-mono text-rose-600">
                      {line.credit > 0 ? formatRupiah(line.credit) : ''}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Belum ada transaksi jurnal.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
