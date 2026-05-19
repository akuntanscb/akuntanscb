import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Search, Tag, Wallet } from 'lucide-react';
import { getAccounts } from '../services/accountService';
import { Account } from '../types';
import { formatRupiah, cn } from '../lib/utils';

export default function COA() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    const accs = await getAccounts();
    setAccounts(accs.sort((a, b) => a.code.localeCompare(b.code)));
    setLoading(false);
  };

  const categories = [
    { name: 'Aset', color: 'bg-blue-100 text-blue-700' },
    { name: 'Liabilitas', color: 'bg-amber-100 text-amber-700' },
    { name: 'Ekuitas', color: 'bg-purple-100 text-purple-700' },
    { name: 'Pendapatan', color: 'bg-emerald-100 text-emerald-700' },
    { name: 'Beban', color: 'bg-rose-100 text-rose-700' },
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
        <button className="bg-natural-primary hover:opacity-90 text-white px-6 py-2.5 rounded-full flex items-center gap-2 transition-all font-semibold shadow-sm text-sm">
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
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-natural-border text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-5">Kode</th>
              <th className="px-6 py-5">Nama Akun</th>
              <th className="px-6 py-5">Kategori</th>
              <th className="px-6 py-5 text-right">Saldo Awal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAccounts.map((acc) => (
              <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-mono text-sm text-slate-500">{acc.code}</td>
                <td className="px-6 py-4 font-medium text-slate-900">{acc.name}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-2 py-1 rounded-md text-[10px] font-bold uppercase",
                    categories.find(c => c.name === acc.category)?.color
                  )}>
                    {acc.category}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">{acc.subCategory}</td>
                <td className="px-6 py-4 text-right font-mono text-sm">
                  {formatRupiah(acc.initialBalance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
