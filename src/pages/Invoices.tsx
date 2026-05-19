import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, Receipt, Search, Download, CheckCircle2, Clock } from 'lucide-react';
import { formatRupiah, cn } from '../lib/utils';

export default function Invoices() {
  const [invoices] = useState([
    { id: '1', number: 'INV/2026/001', recipient: 'Baznas Pusat', date: '12 Mei 2026', total: 50000000, status: 'Paid' },
    { id: '2', number: 'INV/2026/002', recipient: 'Donatur Hamba Allah', date: '15 Mei 2026', total: 2500000, status: 'Sent' },
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Faktur & Bukti Kas</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Kelola tagihan dan bukti penerimaan dana</p>
        </div>
        <button className="bg-natural-primary hover:opacity-90 text-white px-6 py-2.5 rounded-full flex items-center gap-2 transition-all font-semibold shadow-sm text-sm">
          <Plus className="w-4 h-4" /> Faktur Baru
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Total Ditagihkan</p>
          <p className="text-2xl font-serif text-natural-primary">{formatRupiah(52500000)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Belum Dibayar</p>
          <p className="text-2xl font-serif text-amber-600">{formatRupiah(2500000)}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Sudah Diterima</p>
          <p className="text-2xl font-serif text-emerald-600">{formatRupiah(50000000)}</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-natural-border shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50/50 border-b border-natural-border text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              <th className="px-6 py-4">Nomor</th>
              <th className="px-6 py-4">Penerima/Donatur</th>
              <th className="px-6 py-4">Tanggal</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Total</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 font-bold text-slate-800">{inv.number}</td>
                <td className="px-6 py-4 text-slate-700">{inv.recipient}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{inv.date}</td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit",
                    inv.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {inv.status === 'Paid' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                    {inv.status === 'Paid' ? 'LUNAS' : 'PENDING'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right font-mono font-bold text-slate-900">
                  {formatRupiah(inv.total)}
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                    <Download className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
