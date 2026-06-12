import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Search, Filter, BookOpen, Shield } from 'lucide-react';
import { getAccounts } from '../services/accountService';
import { getLedgerForAccount } from '../services/journalService';
import { Account } from '../types';
import { formatRupiah, cn } from '../lib/utils';
import { format } from 'date-fns';
import { useUserRole } from '../context/UserRoleContext';

export default function Ledger() {
  const { hasPermission, isUnitAllowed } = useUserRole();

  if (!hasPermission('canJournal') && !hasPermission('canCOA')) {
    return (
      <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md mx-auto my-12 shadow-sm font-sans">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-slate-500">Anda tidak memiliki hak istimewa untuk melihat Buku Besar instansi ini.</p>
      </div>
    );
  }

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [ledgerLines, setLedgerLines] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    const accs = await getAccounts();
    setAccounts(accs.sort((a,b) => a.code.localeCompare(b.code)));
    if (accs.length > 0) {
      setSelectedAccountId(accs[0].id);
    }
  };

  useEffect(() => {
    if (selectedAccountId) {
      const fetchLedger = async () => {
        setLoading(true);
        const lines = await getLedgerForAccount(selectedAccountId);
        setLedgerLines(lines);
        setLoading(false);
      };
      fetchLedger();
    }
  }, [selectedAccountId]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Filter out restricted units
  const allowedLedgerLines = ledgerLines.filter(line => isUnitAllowed(line.schoolUnit || 'Umum'));

  // Calc running balance
  let runningBalance = selectedAccount?.initialBalance || 0;
  const processedLines = allowedLedgerLines.map(line => {
    if (selectedAccount?.category === 'Aset' || selectedAccount?.category === 'Beban') {
      runningBalance += (line.debit - line.credit);
    } else {
      runningBalance += (line.credit - line.debit);
    }
    return { ...line, runningBalance };
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center text-natural-text">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Buku Besar</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Rincian mutasi per akun keuangan</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-end bg-white p-6 rounded-3xl border border-natural-border shadow-sm">
        <div className="flex-1 space-y-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Pilih Akun</label>
          <select 
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="w-full px-4 py-3 border border-natural-border rounded-xl outline-none focus:ring-2 focus:ring-natural-primary bg-natural-bg/50"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
            ))}
          </select>
        </div>
        <div className="hidden md:flex flex-col items-end shrink-0">
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Saldo Saat Ini</span>
          <span className="text-2xl font-serif text-natural-primary">
            {formatRupiah(processedLines.length > 0 ? processedLines[processedLines.length-1].runningBalance : (selectedAccount?.initialBalance || 0))}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-natural-border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-natural-border text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">Tanggal</th>
              <th className="px-6 py-4">Keterangan</th>
              <th className="px-6 py-4">Ref</th>
              <th className="px-6 py-4 text-right text-emerald-600">Debit (+)</th>
              <th className="px-6 py-4 text-right text-rose-600">Kredit (-)</th>
              <th className="px-6 py-4 text-right">Saldo Akhir</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
               <td className="px-6 py-4 text-sm text-slate-400">---</td>
               <td className="px-6 py-4 font-bold text-slate-900 italic">Saldo Awal</td>
               <td className="px-6 py-4 text-sm text-slate-400">-</td>
               <td className="px-6 py-4 text-right text-sm text-slate-400">-</td>
               <td className="px-6 py-4 text-right text-sm text-slate-400">-</td>
               <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatRupiah(selectedAccount?.initialBalance || 0)}</td>
            </tr>
            {processedLines.map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4 text-sm text-slate-500">{format(line.date.toDate(), 'dd/MM/yyyy')}</td>
                <td className="px-6 py-4 text-sm text-slate-700">{line.description}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{line.reference}</td>
                <td className="px-6 py-4 text-right font-mono text-emerald-600">{line.debit > 0 ? formatRupiah(line.debit) : '-'}</td>
                <td className="px-6 py-4 text-right font-mono text-rose-600">{line.credit > 0 ? formatRupiah(line.credit) : '-'}</td>
                <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">{formatRupiah(line.runningBalance)}</td>
              </tr>
            ))}
            {processedLines.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-400">Belum ada mutasi pada akun ini.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
