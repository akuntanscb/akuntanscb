import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Shell } from './components/layout/Shell';
import { SettingsProvider } from './context/SettingsContext';
import { UserRoleProvider } from './context/UserRoleContext';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Journal = lazy(() => import('./pages/Journal'));
const Ledger = lazy(() => import('./pages/Ledger'));
const Invoices = lazy(() => import('./pages/Invoices'));
const Reports = lazy(() => import('./pages/Reports'));
const COA = lazy(() => import('./pages/COA'));
const HutangPiutang = lazy(() => import('./pages/HutangPiutang'));
const Settings = lazy(() => import('./pages/Settings'));
const Trash = lazy(() => import('./pages/Trash'));
const AsetTetap = lazy(() => import('./pages/AsetTetap'));
const UserManagement = lazy(() => import('./pages/UserManagement'));

export default function App() {
  return (
    <SettingsProvider>
      <UserRoleProvider>
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
                <Route path="/hutang-piutang" element={<HutangPiutang />} />
                <Route path="/aset-tetap" element={<AsetTetap />} />
                <Route path="/pengaturan" element={<Settings />} />
                <Route path="/trash" element={<Trash />} />
                <Route path="/akses-log" element={<UserManagement />} />
              </Routes>
            </Suspense>
          </Shell>
        </BrowserRouter>
      </UserRoleProvider>
    </SettingsProvider>
  );
}
