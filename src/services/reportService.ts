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

  const aset = balances.filter(b => b.category === 'Aset');
  const liabilitas = balances.filter(b => b.category === 'Liabilitas');
  const ekuitas = balances.filter(b => b.category === 'Ekuitas');
  const pendapatan = balances.filter(b => b.category === 'Pendapatan');
  const beban = balances.filter(b => b.category === 'Beban');

  const totalAset = aset.reduce((s, a) => s + a.balance, 0);
  const totalLiabilitas = liabilitas.reduce((s, a) => s + a.balance, 0);
  const totalEkuitas = ekuitas.reduce((s, a) => s + a.balance, 0);
  const totalPendapatan = pendapatan.reduce((s, a) => s + a.balance, 0);
  const totalBeban = beban.reduce((s, a) => s + a.balance, 0);

  const surplusDefisit = totalPendapatan - totalBeban;

  return {
    neraca: { aset, liabilitas, ekuitas, totalAset, totalLiabilitas, totalEkuitas, surplusDefisit },
    aktivitas: { pendapatan, beban, totalPendapatan, totalBeban, surplusDefisit },
    arusKas: { /* Logic for cash flow could be complex, keeping it basic for now */ }
  };
};
