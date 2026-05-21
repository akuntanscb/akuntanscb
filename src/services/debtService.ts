import { 
  addDoc, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  orderBy, 
  query, 
  Timestamp, 
  where, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DebtReceivable, DebtPayment } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { getAccounts } from './accountService';

const COLLECTION_PATH = 'debts_receivables';

export const generateDpRefNumber = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `UM-${year}${month}${day}-${rand}`;
};

export const getDebts = async (): Promise<DebtReceivable[]> => {
  try {
    const q = query(collection(db, COLLECTION_PATH), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DebtReceivable));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_PATH);
    throw error;
  }
};

export const createDebt = async (
  type: 'Hutang' | 'Piutang',
  name: string,
  date: Date,
  dueDate: Date,
  totalAmount: number,
  downPayment: number,
  remarks: string,
  userId: string,
  isUangMuka: boolean = false,
  picName: string = ''
): Promise<string> => {
  try {
    const remainingBalance = isUangMuka ? totalAmount : (totalAmount - downPayment);
    let status: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Belum Lunas';
    
    if (remainingBalance <= 0) {
      status = 'Lunas';
    } else if (!isUangMuka && downPayment > 0) {
      status = 'Sebagian';
    }

    // 1. Resolve Chart of Accounts to balance the entry
    const accounts = await getAccounts();
    const kasAccount = accounts.find(a => a.category === 'Aset' && a.subCategory.includes('Kas')) || accounts.find(a => a.code === '1101');
    let piutangAccount = accounts.find(a => a.category === 'Aset' && a.subCategory.includes('Piutang')) || accounts.find(a => a.code === '1201');
    let hutangAccount = accounts.find(a => a.category === 'Liabilitas' && a.subCategory.toLowerCase().includes('hutang')) || accounts.find(a => a.code === '2102');
    let revenueAccount = accounts.find(a => a.category === 'Pendapatan') || accounts.find(a => a.code === '4103');
    let expenseAccount = accounts.find(a => a.category === 'Beban') || accounts.find(a => a.code === '5301');

    let uangMukaAccount = accounts.find(a => a.name.toLowerCase().includes('uang muka') || a.name.toLowerCase().includes('panjar') || a.name.toLowerCase().includes('dp'));
    if (!uangMukaAccount) {
      uangMukaAccount = piutangAccount || { id: 'temp-piutang', name: 'Piutang Donatur' } as any;
    }

    const lines: any[] = [];
    const remaining = totalAmount - downPayment;

    if (type === 'Piutang') {
      const pAcc = isUangMuka ? (uangMukaAccount || { id: 'temp-piutang', name: 'Piutang Donatur' }) : (piutangAccount || { id: 'temp-piutang', name: 'Piutang Donatur' });
      const kAcc = kasAccount || { id: 'temp-kas', name: 'Kas Kecil' };
      const rAcc = revenueAccount || { id: 'temp-rev', name: 'Dana Hibah/Donasi' };

      if (isUangMuka) {
        // Disbursement of cash advance (Uang Muka)
        // Debit: Uang Muka Account (receivable aset), Credit: Kas
        lines.push({ accountId: pAcc.id, accountName: pAcc.name, debit: totalAmount, credit: 0 });
        lines.push({ accountId: kAcc.id, accountName: kAcc.name, debit: 0, credit: totalAmount });
      } else {
        if (remaining > 0) {
          lines.push({ accountId: pAcc.id, accountName: pAcc.name, debit: remaining, credit: 0 });
        }
        if (downPayment > 0) {
          lines.push({ accountId: kAcc.id, accountName: kAcc.name, debit: downPayment, credit: 0 });
        }
        lines.push({ accountId: rAcc.id, accountName: rAcc.name, debit: 0, credit: totalAmount });
      }
    } else {
      const hAcc = hutangAccount || { id: 'temp-hutang', name: 'Hutang Operasional' };
      const kAcc = kasAccount || { id: 'temp-kas', name: 'Kas Kecil' };
      const eAcc = expenseAccount || { id: 'temp-exp', name: 'Beban Operasional' };

      lines.push({ accountId: eAcc.id, accountName: eAcc.name, debit: totalAmount, credit: 0 });
      if (remaining > 0) {
        lines.push({ accountId: hAcc.id, accountName: hAcc.name, debit: 0, credit: remaining });
      }
      if (downPayment > 0) {
        lines.push({ accountId: kAcc.id, accountName: kAcc.name, debit: 0, credit: downPayment });
      }
    }

    const refNum = isUangMuka ? generateDpRefNumber() : '';

    // 2. Draft & save automatically balanced Journal entry
    const journalRef = await addDoc(collection(db, 'journal_entries'), {
      date: Timestamp.fromDate(date),
      description: isUangMuka ? `Disbursement Panjar/Uang Muka ke PIC: ${picName || 'Tanpa PIC'} (${remarks || 'Tanpa Keterangan'})` : `Kontrol ${type}: ${name} (${remarks || 'Tanpa Keterangan'})`,
      reference: isUangMuka ? 'UM-AUTO' : (type === 'Piutang' ? 'PT-AUTO' : 'HT-AUTO'),
      lines,
      createdBy: userId,
      createdAt: Timestamp.now(),
      picName: picName || ''
    });

    // 3. Save matching control monitoring sheet entry linking to the journal
    const docData = {
      type,
      name,
      date: Timestamp.fromDate(date),
      dueDate: Timestamp.fromDate(dueDate),
      totalAmount,
      downPayment: isUangMuka ? 0 : downPayment,
      paidAmount: 0,
      remainingBalance,
      remarks: remarks || `Pencatatan ${isUangMuka ? 'Uang Muka' : type} ${name}`,
      status,
      payments: [],
      createdBy: userId,
      createdAt: Timestamp.now(),
      journalId: journalRef.id,
      isUangMuka,
      picName,
      dpRefNumber: refNum
    };

    const docRef = await addDoc(collection(db, COLLECTION_PATH), docData);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_PATH);
    throw error;
  }
};

export const addDebtPayment = async (
  debtId: string,
  paymentDate: Date,
  paymentAmount: number,
  paymentNotes: string
): Promise<void> => {
  const docRef = doc(db, COLLECTION_PATH, debtId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Data Hutang/Piutang tidak ditemukan.');
    }

    const currentData = docSnap.data() as DebtReceivable;
    const payments = currentData.payments || [];

    // 1. Resolve accounting accounts for installment
    const accounts = await getAccounts();
    const kasAccount = accounts.find(a => a.category === 'Aset' && a.subCategory.includes('Kas')) || accounts.find(a => a.code === '1101');
    let piutangAccount = accounts.find(a => a.category === 'Aset' && a.subCategory.includes('Piutang')) || accounts.find(a => a.code === '1201');
    let hutangAccount = accounts.find(a => a.category === 'Liabilitas' && a.subCategory.toLowerCase().includes('hutang')) || accounts.find(a => a.code === '2102');

    const lines: any[] = [];
    if (currentData.type === 'Piutang') {
      const kAcc = kasAccount || { id: 'temp-kas', name: 'Kas Kecil' };
      const pAcc = piutangAccount || { id: 'temp-piutang', name: 'Piutang Donatur' };
      
      lines.push({ accountId: kAcc.id, accountName: kAcc.name, debit: paymentAmount, credit: 0 });
      lines.push({ accountId: pAcc.id, accountName: pAcc.name, debit: 0, credit: paymentAmount });
    } else {
      const hAcc = hutangAccount || { id: 'temp-hutang', name: 'Hutang Operasional' };
      const kAcc = kasAccount || { id: 'temp-kas', name: 'Kas Kecil' };

      lines.push({ accountId: hAcc.id, accountName: hAcc.name, debit: paymentAmount, credit: 0 });
      lines.push({ accountId: kAcc.id, accountName: kAcc.name, debit: 0, credit: paymentAmount });
    }

    // 2. Add as General Journal entry
    const journalRef = await addDoc(collection(db, 'journal_entries'), {
      date: Timestamp.fromDate(paymentDate),
      description: `Angsuran ${currentData.type}: ${currentData.name} (${paymentNotes || 'Tanpa Memo'})`,
      reference: currentData.type === 'Piutang' ? 'PT-BYR' : 'HT-BYR',
      lines,
      createdBy: currentData.createdBy,
      createdAt: Timestamp.now()
    });

    // 3. Register payment history item linking to general ledger
    const newPayment: DebtPayment = {
      id: Math.random().toString(36).substring(2, 9),
      date: Timestamp.fromDate(paymentDate),
      amount: paymentAmount,
      notes: paymentNotes || `Cicilan/Angsuran (Ledger Ref: ${journalRef.id})`
    };
    (newPayment as any).journalId = journalRef.id;

    const updatedPayments = [...payments, newPayment];
    const newPaidAmount = currentData.paidAmount + paymentAmount;
    const newRemainingBalance = currentData.totalAmount - currentData.downPayment - newPaidAmount;

    let newStatus: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Sebagian';
    if (newRemainingBalance <= 0) {
      newStatus = 'Lunas';
    } else if (newPaidAmount === 0 && currentData.downPayment === 0) {
      newStatus = 'Belum Lunas';
    }

    await updateDoc(docRef, {
      payments: updatedPayments,
      paidAmount: newPaidAmount,
      remainingBalance: Math.max(0, newRemainingBalance),
      status: newStatus
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_PATH}/${debtId}`);
    throw error;
  }
};

export const updateDebtDetails = async (
  debtId: string,
  updateData: {
    name: string;
    date: Date;
    dueDate: Date;
    totalAmount: number;
    downPayment: number;
    remarks: string;
    picName?: string;
  }
): Promise<void> => {
  const docRef = doc(db, COLLECTION_PATH, debtId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Data Hutang/Piutang tidak ditemukan.');
    }

    const currentData = docSnap.data() as DebtReceivable;
    const journalId = (currentData as any).journalId;
    const isUangMuka = !!currentData.isUangMuka;

    // 1. If linked to a journal entry, update the journal entry first!
    if (journalId) {
      const journalDocRef = doc(db, 'journal_entries', journalId);
      const journalSnap = await getDoc(journalDocRef);
      if (journalSnap.exists()) {
        const accounts = await getAccounts();
        const kasAccount = accounts.find(a => a.category === 'Aset' && a.subCategory.includes('Kas')) || accounts.find(a => a.code === '1101');
        let piutangAccount = accounts.find(a => a.category === 'Aset' && a.subCategory.includes('Piutang')) || accounts.find(a => a.code === '1201');
        let hutangAccount = accounts.find(a => a.category === 'Liabilitas' && a.subCategory.toLowerCase().includes('hutang')) || accounts.find(a => a.code === '2102');
        let revenueAccount = accounts.find(a => a.category === 'Pendapatan') || accounts.find(a => a.code === '4103');
        let expenseAccount = accounts.find(a => a.category === 'Beban') || accounts.find(a => a.code === '5301');

        let uangMukaAccount = accounts.find(a => a.name.toLowerCase().includes('uang muka') || a.name.toLowerCase().includes('panjar') || a.name.toLowerCase().includes('dp'));
        if (!uangMukaAccount) {
          uangMukaAccount = piutangAccount || { id: 'temp-piutang', name: 'Piutang Donatur' } as any;
        }

        const lines: any[] = [];
        const type = currentData.type;

        if (type === 'Piutang') {
          const pAcc = isUangMuka ? (uangMukaAccount || { id: 'temp-piutang', name: 'Piutang Donatur' }) : (piutangAccount || { id: 'temp-piutang', name: 'Piutang Donatur' });
          const kAcc = kasAccount || { id: 'temp-kas', name: 'Kas Kecil' };
          const rAcc = revenueAccount || { id: 'temp-rev', name: 'Dana Hibah/Donasi' };

          if (isUangMuka) {
            lines.push({ accountId: pAcc.id, accountName: pAcc.name, debit: updateData.totalAmount, credit: 0 });
            lines.push({ accountId: kAcc.id, accountName: kAcc.name, debit: 0, credit: updateData.totalAmount });
          } else {
            const remaining = updateData.totalAmount - updateData.downPayment;
            if (remaining > 0) {
              lines.push({ accountId: pAcc.id, accountName: pAcc.name, debit: remaining, credit: 0 });
            }
            if (updateData.downPayment > 0) {
              lines.push({ accountId: kAcc.id, accountName: kAcc.name, debit: updateData.downPayment, credit: 0 });
            }
            lines.push({ accountId: rAcc.id, accountName: rAcc.name, debit: 0, credit: updateData.totalAmount });
          }
        } else {
          const remaining = updateData.totalAmount - updateData.downPayment;
          const hAcc = hutangAccount || { id: 'temp-hutang', name: 'Hutang Operasional' };
          const kAcc = kasAccount || { id: 'temp-kas', name: 'Kas Kecil' };
          const eAcc = expenseAccount || { id: 'temp-exp', name: 'Beban Operasional' };

          lines.push({ accountId: eAcc.id, accountName: eAcc.name, debit: updateData.totalAmount, credit: 0 });
          if (remaining > 0) {
            lines.push({ accountId: hAcc.id, accountName: hAcc.name, debit: 0, credit: remaining });
          }
          if (updateData.downPayment > 0) {
            lines.push({ accountId: kAcc.id, accountName: kAcc.name, debit: 0, credit: updateData.downPayment });
          }
        }

        await updateDoc(journalDocRef, {
          date: Timestamp.fromDate(updateData.date),
          description: isUangMuka ? `Disbursement Panjar/Uang Muka ke PIC: ${updateData.picName || 'Tanpa PIC'} (${updateData.remarks || 'Tanpa Keterangan'})` : `Kontrol ${type}: ${updateData.name} (${updateData.remarks || 'Tanpa Keterangan'})`,
          lines,
          picName: updateData.picName || ''
        });
      }
    }

    // 2. Recalculate and update the debt control record details
    const totalAmount = updateData.totalAmount;
    const downPayment = isUangMuka ? 0 : updateData.downPayment;
    const paidAmount = currentData.paidAmount || 0;
    const remainingBalance = isUangMuka ? (totalAmount - paidAmount) : (totalAmount - downPayment - paidAmount);
    
    let status: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Belum Lunas';
    if (remainingBalance <= 0) {
      status = 'Lunas';
    } else if (paidAmount > 0 || downPayment > 0) {
      status = 'Sebagian';
    }

    const payload: any = {
      name: updateData.name,
      date: Timestamp.fromDate(updateData.date),
      dueDate: Timestamp.fromDate(updateData.dueDate),
      totalAmount,
      downPayment,
      remainingBalance: Math.max(0, remainingBalance),
      status,
      remarks: updateData.remarks
    };

    if (updateData.picName !== undefined) {
      payload.picName = updateData.picName;
    }

    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_PATH}/${debtId}`);
    throw error;
  }
};

export const deleteDebt = async (debtId: string): Promise<void> => {
  const docRef = doc(db, COLLECTION_PATH, debtId);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const currentData = docSnap.data() as DebtReceivable;
      const journalId = (currentData as any).journalId;
      if (journalId) {
        const journalDocRef = doc(db, 'journal_entries', journalId);
        await deleteDoc(journalDocRef);
      }
    }
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_PATH}/${debtId}`);
    throw error;
  }
};

export const syncJournalToDebtControl = async (journalEntry: any): Promise<void> => {
  try {
    const journalId = journalEntry.id;
    const date = journalEntry.date.toDate ? journalEntry.date.toDate() : new Date(journalEntry.date);
    const description = journalEntry.description || '';
    const reference = journalEntry.reference || '';
    const createdBy = journalEntry.createdBy;

    // 1. Fetch academic/accounting accounts to determine types
    const accounts = await getAccounts();

    // 2. Clear out any previous debt_receivables created by this journal ID to prevent duplication
    const existingQuery = query(collection(db, COLLECTION_PATH), where('journalId', '==', journalId));
    const querySnap = await getDocs(existingQuery);
    for (const docObj of querySnap.docs) {
      await deleteDoc(docObj.ref);
    }

    // 3. Analyze journal lines
    const lines = journalEntry.lines || [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const account = accounts.find((a: any) => a.id === line.accountId);
      if (!account) continue;

      const isPiutangAccount = account.category === 'Aset' && 
        (account.subCategory.toLowerCase().includes('piutang') || 
         account.subCategory.toLowerCase().includes('uang muka') ||
         account.subCategory.toLowerCase().includes('panjar') ||
         account.name.toLowerCase().includes('piutang') ||
         account.name.toLowerCase().includes('uang muka') ||
         account.name.toLowerCase().includes('panjar') ||
         account.name.toLowerCase().includes('dp'));
      
      const isHutangAccount = account.category === 'Liabilitas' && 
        (account.subCategory.toLowerCase().includes('hutang') || account.subCategory.toLowerCase().includes('kewajiban') || account.name.toLowerCase().includes('hutang'));

      // If it's a Piutang account:
      // - Debit > 0: A new Receivable is being recorded!
      if (isPiutangAccount && line.debit > 0) {
        const isUM = account.name.toLowerCase().includes('uang muka') || 
                     account.name.toLowerCase().includes('panjar') || 
                     account.name.toLowerCase().includes('dp') ||
                     account.subCategory.toLowerCase().includes('uang muka') ||
                     account.subCategory.toLowerCase().includes('panjar');

        // Find other complimenting lines to compute possible down payments
        const creditLine = lines.find((l: any) => l.credit > 0 && l.accountId !== line.accountId);
        const totalCredit = creditLine ? creditLine.credit : line.debit;
        
        let downPayment = 0;
        let totalAmount = line.debit;
        
        if (!isUM && totalCredit > line.debit) {
          totalAmount = totalCredit;
          downPayment = totalCredit - line.debit;
        }

        // Check if there is an explicit Cash/Bank line or Uang Muka in the journal representing the down payment
        if (!isUM) {
          const hasDownPaymentLine = lines.find((l: any) => {
            const acc = accounts.find((a: any) => a.id === l.accountId);
            return acc && (acc.name.toLowerCase().includes('uang muka') || acc.name.toLowerCase().includes('dp') || acc.name.toLowerCase().includes('panjar'));
          });
          if (hasDownPaymentLine) {
            downPayment = Math.max(downPayment, hasDownPaymentLine.debit || hasDownPaymentLine.credit || 0);
          }
        }

        const remainingBalance = isUM ? totalAmount : (totalAmount - downPayment);
        let status: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Belum Lunas';
        if (remainingBalance <= 0) {
          status = 'Lunas';
        } else if (!isUM && downPayment > 0) {
          status = 'Sebagian';
        }

        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + 30);

        const refNum = isUM ? generateDpRefNumber() : '';
        const pic = journalEntry.picName || '';

        await addDoc(collection(db, COLLECTION_PATH), {
          type: 'Piutang',
          name: description,
          date: Timestamp.fromDate(date),
          dueDate: Timestamp.fromDate(dueDate),
          totalAmount,
          downPayment: isUM ? 0 : downPayment,
          paidAmount: 0,
          remainingBalance,
          remarks: isUM ? `Uang Muka Otomatis Jurnal (Ref: ${reference})` : `Otomatis dari Jurnal Umum (Ref: ${reference})`,
          status,
          payments: [],
          createdBy,
          createdAt: Timestamp.now(),
          journalId,
          isUangMuka: isUM,
          picName: pic,
          dpRefNumber: refNum
        });
      }

      // If it's a Hutang account:
      // - Credit > 0: A new Liability is being recorded!
      else if (isHutangAccount && line.credit > 0) {
        const debitLine = lines.find((l: any) => l.debit > 0 && l.accountId !== line.accountId);
        const totalDebit = debitLine ? debitLine.debit : line.credit;

        let downPayment = 0;
        let totalAmount = line.credit;

        if (totalDebit > line.credit) {
          totalAmount = totalDebit;
          downPayment = totalDebit - line.credit;
        }

        const hasDownPaymentLine = lines.find((l: any) => {
          const acc = accounts.find((a: any) => a.id === l.accountId);
          return acc && (acc.name.toLowerCase().includes('uang muka') || acc.name.toLowerCase().includes('dp') || acc.name.toLowerCase().includes('panjar'));
        });
        if (hasDownPaymentLine) {
          downPayment = Math.max(downPayment, hasDownPaymentLine.debit || hasDownPaymentLine.credit || 0);
        }

        const remainingBalance = totalAmount - downPayment;
        let status: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Belum Lunas';
        if (remainingBalance <= 0) {
          status = 'Lunas';
        } else if (downPayment > 0) {
          status = 'Sebagian';
        }

        const dueDate = new Date(date);
        dueDate.setDate(dueDate.getDate() + 30);

        await addDoc(collection(db, COLLECTION_PATH), {
          type: 'Hutang',
          name: description,
          date: Timestamp.fromDate(date),
          dueDate: Timestamp.fromDate(dueDate),
          totalAmount,
          downPayment,
          paidAmount: 0,
          remainingBalance,
          remarks: `Otomatis dari Jurnal Umum (Ref: ${reference})`,
          status,
          payments: [],
          createdBy,
          createdAt: Timestamp.now(),
          journalId
        });
      }

      // If it's paying off/clearing:
      // - Credit to a Piutang account (receiving money for Piutang / collected receivable)
      else if (isPiutangAccount && line.credit > 0) {
        const qPiutang = query(
          collection(db, COLLECTION_PATH), 
          where('type', '==', 'Piutang'), 
          where('status', '!=', 'Lunas')
        );
        const activePiutangs = await getDocs(qPiutang);
        
        let matchedDebt: any = null;
        const journalDescLower = description.toLowerCase();
        
        for (const docObj of activePiutangs.docs) {
          const debtData = docObj.data();
          if (journalDescLower.includes(debtData.name.toLowerCase()) || debtData.name.toLowerCase().includes(journalDescLower)) {
            matchedDebt = { id: docObj.id, ...debtData };
            break;
          }
        }

        if (!matchedDebt && !activePiutangs.empty) {
          const sorted = activePiutangs.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .sort((a, b) => a.date.seconds - b.date.seconds);
          matchedDebt = sorted[0];
        }

        if (matchedDebt) {
          const docRef = doc(db, COLLECTION_PATH, matchedDebt.id);
          const payments = matchedDebt.payments || [];
          
          const isAlreadyPaid = payments.some((p: any) => p.journalId === journalId);
          if (!isAlreadyPaid) {
            const newPayment = {
              id: `jpay-${journalId}`,
              date: Timestamp.fromDate(date),
              amount: line.credit,
              notes: `Angsuran via Jurnal (Ref: ${reference} - ${description})`,
              journalId
            };
            const updatedPayments = [...payments, newPayment];
            const newPaidAmount = (matchedDebt.paidAmount || 0) + line.credit;
            const newRemaining = matchedDebt.totalAmount - matchedDebt.downPayment - newPaidAmount;
            
            let newStatus: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Sebagian';
            if (newRemaining <= 0) {
              newStatus = 'Lunas';
            }

            await updateDoc(docRef, {
              payments: updatedPayments,
              paidAmount: newPaidAmount,
              remainingBalance: Math.max(0, newRemaining),
              status: newStatus
            });
          }
        }
      }

      // - Debit to a Hutang account (paying off a debt)
      else if (isHutangAccount && line.debit > 0) {
        const qHutang = query(
          collection(db, COLLECTION_PATH), 
          where('type', '==', 'Hutang'), 
          where('status', '!=', 'Lunas')
        );
        const activeHutangs = await getDocs(qHutang);
        
        let matchedDebt: any = null;
        const journalDescLower = description.toLowerCase();

        for (const docObj of activeHutangs.docs) {
          const debtData = docObj.data();
          if (journalDescLower.includes(debtData.name.toLowerCase()) || debtData.name.toLowerCase().includes(journalDescLower)) {
            matchedDebt = { id: docObj.id, ...debtData };
            break;
          }
        }

        if (!matchedDebt && !activeHutangs.empty) {
          const sorted = activeHutangs.docs
            .map(d => ({ id: d.id, ...d.data() } as any))
            .sort((a, b) => a.date.seconds - b.date.seconds);
          matchedDebt = sorted[0];
        }

        if (matchedDebt) {
          const docRef = doc(db, COLLECTION_PATH, matchedDebt.id);
          const payments = matchedDebt.payments || [];
          
          const isAlreadyPaid = payments.some((p: any) => p.journalId === journalId);
          if (!isAlreadyPaid) {
            const newPayment = {
              id: `jpay-${journalId}`,
              date: Timestamp.fromDate(date),
              amount: line.debit,
              notes: `Angsuran via Jurnal (Ref: ${reference} - ${description})`,
              journalId
            };
            const updatedPayments = [...payments, newPayment];
            const newPaidAmount = (matchedDebt.paidAmount || 0) + line.debit;
            const newRemaining = matchedDebt.totalAmount - matchedDebt.downPayment - newPaidAmount;
            
            let newStatus: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Sebagian';
            if (newRemaining <= 0) {
              newStatus = 'Lunas';
            }

            await updateDoc(docRef, {
              payments: updatedPayments,
              paidAmount: newPaidAmount,
              remainingBalance: Math.max(0, newRemaining),
              status: newStatus
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Error syncing journal to debt control:", error);
  }
};

export const deleteSyncedDebtControl = async (journalId: string): Promise<void> => {
  try {
    // 1. Delete control item created by this journalId
    const q1 = query(collection(db, COLLECTION_PATH), where('journalId', '==', journalId));
    const snap1 = await getDocs(q1);
    for (const docObj of snap1.docs) {
      await deleteDoc(docObj.ref);
    }

    // 2. Also remove any payments synced from this journal entry inside other items
    const q2 = query(collection(db, COLLECTION_PATH));
    const snap2 = await getDocs(q2);
    for (const docObj of snap2.docs) {
      const data = docObj.data() as DebtReceivable;
      const payments = data.payments || [];
      const hasSyncedPayment = payments.some((p: any) => p.journalId === journalId);
      
      if (hasSyncedPayment) {
        const filteredPayments = payments.filter((p: any) => p.journalId !== journalId);
        const newPaidAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
        const newRemaining = data.totalAmount - data.downPayment - newPaidAmount;
        
        let newStatus: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Sebagian';
        if (newRemaining <= 0) {
          newStatus = 'Lunas';
        } else if (newPaidAmount === 0 && data.downPayment === 0) {
          newStatus = 'Belum Lunas';
        }
        
        await updateDoc(docObj.ref, {
          payments: filteredPayments,
          paidAmount: newPaidAmount,
          remainingBalance: Math.max(0, newRemaining),
          status: newStatus
        });
      }
    }
  } catch (error) {
    console.error("Error deleting synced debt control payments:", error);
  }
};
