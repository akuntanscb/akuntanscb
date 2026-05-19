import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Journal = lazy(() => import('./pages/Journal'));
const Ledger = lazy(() => import('./pages/Ledger'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Reports = lazy(() => import('./pages/Reports'));
const COA = lazy(() => import('./pages/COA'));

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Suspense fallback={<div className="flex items-center justify-center h-full">Memuat halaman...</div>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/jurnal" element={<Journal />} />
            <Route path="/buku-besar" element={<Ledger />} />
            <Route path="/faktur" element={<Invoices />} />
            <Route path="/laporan" element={<Reports />} />
            <Route path="/coa" element={<COA />} />
          </Routes>
        </Suspense>
      </Shell>
    </BrowserRouter>
  );
}
