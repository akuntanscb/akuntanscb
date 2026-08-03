import { getAccounts } from './accountService';
import { getJournalEntries } from './journalService';
import { Account, JournalLine } from '../types';

export interface AccountBalance extends Account {
  balance: number;
}

export const getAccountBalances = async (
  schoolUnit?: string,
  startDate?: string,
  endDate?: string,
  includeInitialBalance: boolean = true
): Promise<AccountBalance[]> => {
  const accounts = await getAccounts();
  const entries = await getJournalEntries();

  const balances: Record<string, number> = {};
  accounts.forEach(acc => {
    if (includeInitialBalance) {
      if (schoolUnit && schoolUnit !== 'all' && schoolUnit !== 'Gabungan') {
        if (schoolUnit === 'SMP') {
          balances[acc.id] = acc.initialBalanceSMP !== undefined ? acc.initialBalanceSMP : 0;
        } else if (schoolUnit === 'SMA') {
          balances[acc.id] = acc.initialBalanceSMA !== undefined ? acc.initialBalanceSMA : 0;
        } else if (schoolUnit === 'Umum') {
          balances[acc.id] = acc.initialBalanceUmum !== undefined ? acc.initialBalanceUmum : 0;
        } else {
          balances[acc.id] = 0;
        }
      } else {
        balances[acc.id] = acc.initialBalance || 0;
      }
    } else {
      balances[acc.id] = 0;
    }
  });

  const filteredEntries = entries.filter(entry => {
    if (schoolUnit && schoolUnit !== 'all' && schoolUnit !== 'Gabungan' && entry.schoolUnit !== schoolUnit) {
      return false;
    }
    
    const entryDate = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
    const y = entryDate.getFullYear();
    const m = String(entryDate.getMonth() + 1).padStart(2, '0');
    const d = String(entryDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    
    return true;
  });

  filteredEntries.forEach(entry => {
    entry.lines.forEach(line => {
      const acc = accounts.find(a => a.id === line.accountId);
      if (acc) {
        // Accounting math:
        // Aset & Beban: Balance = Debit - Credit
        // Liab, Equity, Income: Balance = Credit - Debit
        if (acc.category === 'Aset' || acc.category === 'Beban') {
          balances[acc.id] += (line.debit - line.credit);
        } else {
          balances[acc.id] += (line.credit - line.debit);
        }
      }
    });
  });

  return accounts.map(acc => ({
    ...acc,
    balance: balances[acc.id]
  }));
};

export const getFinancialReports = async (
  schoolUnit?: string,
  startDate?: string,
  endDate?: string
) => {
  // 1. Neraca: Cumulative balances up to endDate
  const neracaBalances = await getAccountBalances(schoolUnit, undefined, endDate, true);

  // 2. Laporan Aktivitas (Income Statement): within [startDate, endDate]
  const aktivitasBalances = await getAccountBalances(schoolUnit, startDate, endDate, false);

  const sortAccounts = (accs: AccountBalance[]) => {
    return [...accs].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 9999;
      const orderB = b.order !== undefined ? b.order : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return a.code.localeCompare(b.code);
    });
  };

  const visibleNeracaBalances = neracaBalances.filter(b => b.hideOnReport !== true);
  const visibleAktivitasBalances = aktivitasBalances.filter(b => b.hideOnReport !== true);

  const aset = sortAccounts(visibleNeracaBalances.filter(b => b.category === 'Aset'));
  const asetLancar = aset.filter(acc => {
    const subCat = (acc.subCategory || '').toLowerCase();
    const name = acc.name.toLowerCase();
    return !(
      subCat.includes('tetap') || 
      name.includes('aset tetap') || 
      name.includes('peralatan') ||
      name.includes('akumulasi penyusutan') || 
      name.includes('akum. penyusutan')
    );
  });
  const asetTetap = aset.filter(acc => {
    const subCat = (acc.subCategory || '').toLowerCase();
    const name = acc.name.toLowerCase();
    return (
      subCat.includes('tetap') || 
      name.includes('aset tetap') || 
      name.includes('peralatan') ||
      name.includes('akumulasi penyusutan') || 
      name.includes('akum. penyusutan')
    );
  });

  const liabilitas = sortAccounts(visibleNeracaBalances.filter(b => b.category === 'Liabilitas'));
  const ekuitas = sortAccounts(visibleNeracaBalances.filter(b => b.category === 'Ekuitas'));
  const pendapatan = sortAccounts(visibleAktivitasBalances.filter(b => b.category === 'Pendapatan'));
  const beban = sortAccounts(visibleAktivitasBalances.filter(b => b.category === 'Beban'));

  // Calculate totals from visible accounts to preserve consistency in report grids
  const totalAset = aset.reduce((s, a) => s + a.balance, 0);
  const totalAsetLancar = asetLancar.reduce((s, a) => s + a.balance, 0);
  const totalAsetTetap = asetTetap.reduce((s, a) => s + a.balance, 0);
  const totalLiabilitas = liabilitas.reduce((s, a) => s + a.balance, 0);
  const totalEkuitas = ekuitas.reduce((s, a) => s + a.balance, 0);
  const totalPendapatan = pendapatan.reduce((s, a) => s + a.balance, 0);
  const totalBeban = beban.reduce((s, a) => s + a.balance, 0);

  // For Laporan Aktivitas: surplus/defisit is for the filtered period
  const surplusDefisitAktivitas = totalPendapatan - totalBeban;

  // For Neraca: surplus/defisit is cumulative up to the endDate so that the Balance Sheet holds
  const cumulativePendapatan = neracaBalances.filter(b => b.category === 'Pendapatan' && b.hideOnReport !== true).reduce((s, a) => s + a.balance, 0);
  const cumulativeBeban = neracaBalances.filter(b => b.category === 'Beban' && b.hideOnReport !== true).reduce((s, a) => s + a.balance, 0);
  const surplusDefisitNeraca = cumulativePendapatan - cumulativeBeban;

  // ==========================================
  // DIRECT CASH FLOW CALCULATIONS
  // ==========================================
  const cashAccounts = neracaBalances.filter(b => 
    b.category === 'Aset' && (
      b.subCategory?.toLowerCase().includes('kas') || 
      b.subCategory?.toLowerCase().includes('bank') || 
      b.subCategory?.toLowerCase().includes('e-wallet') || 
      b.name.toLowerCase().includes('kas') || 
      b.name.toLowerCase().includes('bank') || 
      b.name.toLowerCase().includes('dompet') || 
      b.code.startsWith('1-1') || 
      b.code.startsWith('110')
    )
  );

  const entries = await getJournalEntries();

  // Filter cash entries prior to startDate to calculate Saldo Awal Kas
  const entriesPriorToStart = entries.filter(e => {
    if (schoolUnit && schoolUnit !== 'all' && schoolUnit !== 'Gabungan' && e.schoolUnit !== schoolUnit) {
      return false;
    }
    const entryDate = e.date?.toDate ? e.date.toDate() : new Date(e.date);
    const y = entryDate.getFullYear();
    const m = String(entryDate.getMonth() + 1).padStart(2, '0');
    const d = String(entryDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    if (startDate && dateStr >= startDate) return false;
    return true;
  });

  // Calculate cash changes prior to startDate
  let cashChangesPrior = 0;
  entriesPriorToStart.forEach(entry => {
    entry.lines.forEach(line => {
      const isCash = cashAccounts.some(c => c.id === line.accountId);
      if (isCash) {
        cashChangesPrior += (line.debit - line.credit);
      }
    });
  });

  const totalSawalKas = cashAccounts.reduce((acc, c) => {
    if (schoolUnit && schoolUnit !== 'all' && schoolUnit !== 'Gabungan') {
      if (schoolUnit === 'SMP') return acc + (c.initialBalanceSMP !== undefined ? c.initialBalanceSMP : 0);
      if (schoolUnit === 'SMA') return acc + (c.initialBalanceSMA !== undefined ? c.initialBalanceSMA : 0);
      if (schoolUnit === 'Umum') return acc + (c.initialBalanceUmum !== undefined ? c.initialBalanceUmum : 0);
    }
    return acc + (c.initialBalance || 0);
  }, 0) + cashChangesPrior;

  let oprPenerimaanSiswa = 0; 
  let oprPenerimaanLain = 0;
  let oprPengeluaranBeban = 0; 
  let oprPengeluaranLain = 0;

  let invPenerimaanAset = 0;
  let invPengeluaranAset = 0;

  let penPenerimaanHutang = 0;
  let penPengeluaranHutang = 0;

  const filteredEntriesForCashFlow = entries.filter(e => {
    if (schoolUnit && schoolUnit !== 'all' && schoolUnit !== 'Gabungan' && e.schoolUnit !== schoolUnit) {
      return false;
    }
    const entryDate = e.date?.toDate ? e.date.toDate() : new Date(e.date);
    const y = entryDate.getFullYear();
    const m = String(entryDate.getMonth() + 1).padStart(2, '0');
    const d = String(entryDate.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    if (startDate && dateStr < startDate) return false;
    if (endDate && dateStr > endDate) return false;
    
    return true;
  });

  filteredEntriesForCashFlow.forEach(entry => {
    let cashDebit = 0;
    let cashCredit = 0;

    entry.lines.forEach(line => {
      const isCash = cashAccounts.some(c => c.id === line.accountId);
      if (isCash) {
        cashDebit += line.debit;
        cashCredit += line.credit;
      }
    });

    const netCashChange = cashDebit - cashCredit;
    if (netCashChange === 0) return; 

    if (netCashChange > 0) {
      const nonCashCredits = entry.lines.filter(line => 
        !cashAccounts.some(c => c.id === line.accountId) && line.credit > 0
      );

      if (nonCashCredits.length > 0) {
        nonCashCredits.forEach(line => {
          const acc = neracaBalances.find(b => b.id === line.accountId);
          if (acc) {
            if (acc.category === 'Pendapatan') {
              if (acc.name.toLowerCase().includes('spp') || acc.name.toLowerCase().includes('siswa') || acc.name.toLowerCase().includes('bulanan')) {
                oprPenerimaanSiswa += line.credit;
              } else {
                oprPenerimaanLain += line.credit;
              }
            } else if (acc.category === 'Liabilitas' || acc.category === 'Ekuitas') {
              penPenerimaanHutang += line.credit;
            } else if (acc.category === 'Aset') {
              if (acc.name.toLowerCase().includes('piutang')) {
                oprPenerimaanLain += line.credit;
              } else {
                invPenerimaanAset += line.credit;
              }
            } else {
              oprPenerimaanLain += line.credit;
            }
          } else {
            oprPenerimaanLain += line.credit;
          }
        });
      } else {
        oprPenerimaanLain += netCashChange;
      }
    } else {
      const absoluteOutflow = Math.abs(netCashChange);
      const nonCashDebits = entry.lines.filter(line => 
        !cashAccounts.some(c => c.id === line.accountId) && line.debit > 0
      );

      if (nonCashDebits.length > 0) {
        nonCashDebits.forEach(line => {
          const acc = neracaBalances.find(b => b.id === line.accountId);
          if (acc) {
            if (acc.category === 'Beban') {
              oprPengeluaranBeban += line.debit;
            } else if (acc.category === 'Liabilitas' || acc.category === 'Ekuitas') {
              penPengeluaranHutang += line.debit;
            } else if (acc.category === 'Aset') {
              if (acc.name.toLowerCase().includes('piutang') || acc.name.toLowerCase().includes('uang muka')) {
                oprPengeluaranLain += line.debit;
              } else {
                invPengeluaranAset += line.debit;
              }
            } else {
              oprPengeluaranLain += line.debit;
            }
          } else {
            oprPengeluaranLain += line.debit;
          }
        });
      } else {
        oprPengeluaranBeban += absoluteOutflow;
      }
    }
  });

  const totalOprInflow = oprPenerimaanSiswa + oprPenerimaanLain;
  const totalOprOutflow = oprPengeluaranBeban + oprPengeluaranLain;
  const netOprCashFlow = totalOprInflow - totalOprOutflow;

  const netInvCashFlow = invPenerimaanAset - invPengeluaranAset;
  const netPenCashFlow = penPenerimaanHutang - penPengeluaranHutang;

  const netCashFlowChange = netOprCashFlow + netInvCashFlow + netPenCashFlow;
  const totalSakhirKas = totalSawalKas + netCashFlowChange;

  return {
    neraca: { aset, asetLancar, asetTetap, totalAsetLancar, totalAsetTetap, liabilitas, ekuitas, totalAset, totalLiabilitas, totalEkuitas, surplusDefisit: surplusDefisitNeraca },
    aktivitas: { pendapatan, beban, totalPendapatan, totalBeban, surplusDefisit: surplusDefisitAktivitas },
    arusKas: {
      details: {
        oprPenerimaanSiswa,
        oprPenerimaanLain,
        oprPengeluaranBeban,
        oprPengeluaranLain,
        totalOprInflow,
        totalOprOutflow,
        netOprCashFlow,
        
        invPenerimaanAset,
        invPengeluaranAset,
        netInvCashFlow,
        
        penPenerimaanHutang,
        penPengeluaranHutang,
        netPenCashFlow,
        
        totalSawalKas,
        totalSakhirKas,
        netCashFlowChange
      },
      cashAccounts
    },
    balances: neracaBalances
  };
};
