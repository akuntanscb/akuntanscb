import { getAccounts } from './accountService';
import { getJournalEntries } from './journalService';
import { Account, JournalLine } from '../types';

export interface AccountBalance extends Account {
  balance: number;
}

export const getAccountBalances = async (): Promise<AccountBalance[]> => {
  const accounts = await getAccounts();
  const entries = await getJournalEntries();

  const balances: Record<string, number> = {};
  accounts.forEach(acc => {
    balances[acc.id] = acc.initialBalance || 0;
  });

  entries.forEach(entry => {
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

export const getFinancialReports = async () => {
  const balances = await getAccountBalances();

  const sortAccounts = (accs: AccountBalance[]) => {
    return [...accs].sort((a, b) => {
      const orderA = a.order !== undefined ? a.order : 9999;
      const orderB = b.order !== undefined ? b.order : 9999;
      if (orderA !== orderB) return orderA - orderB;
      return a.code.localeCompare(b.code);
    });
  };

  const visibleBalances = balances.filter(b => b.hideOnReport !== true);

  const aset = sortAccounts(visibleBalances.filter(b => b.category === 'Aset'));
  const liabilitas = sortAccounts(visibleBalances.filter(b => b.category === 'Liabilitas'));
  const ekuitas = sortAccounts(visibleBalances.filter(b => b.category === 'Ekuitas'));
  const pendapatan = sortAccounts(visibleBalances.filter(b => b.category === 'Pendapatan'));
  const beban = sortAccounts(visibleBalances.filter(b => b.category === 'Beban'));

  // Calculate totals from visible accounts to preserve consistency in report grids
  const totalAset = aset.reduce((s, a) => s + a.balance, 0);
  const totalLiabilitas = liabilitas.reduce((s, a) => s + a.balance, 0);
  const totalEkuitas = ekuitas.reduce((s, a) => s + a.balance, 0);
  const totalPendapatan = pendapatan.reduce((s, a) => s + a.balance, 0);
  const totalBeban = beban.reduce((s, a) => s + a.balance, 0);

  const surplusDefisit = totalPendapatan - totalBeban;

  // ==========================================
  // DIRECT CASH FLOW CALCULATIONS
  // ==========================================
  const cashAccounts = balances.filter(b => 
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

  const totalSawalKas = cashAccounts.reduce((acc, c) => acc + (c.initialBalance || 0), 0);
  const totalSakhirKas = cashAccounts.reduce((acc, c) => acc + c.balance, 0);

  let oprPenerimaanSiswa = 0; 
  let oprPenerimaanLain = 0;
  let oprPengeluaranBeban = 0; 
  let oprPengeluaranLain = 0;

  let invPenerimaanAset = 0;
  let invPengeluaranAset = 0;

  let penPenerimaanHutang = 0;
  let penPengeluaranHutang = 0;

  const entries = await getJournalEntries();

  entries.forEach(entry => {
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
          const acc = balances.find(b => b.id === line.accountId);
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
          const acc = balances.find(b => b.id === line.accountId);
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

  return {
    neraca: { aset, liabilitas, ekuitas, totalAset, totalLiabilitas, totalEkuitas, surplusDefisit },
    aktivitas: { pendapatan, beban, totalPendapatan, totalBeban, surplusDefisit },
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
    balances
  };
};
