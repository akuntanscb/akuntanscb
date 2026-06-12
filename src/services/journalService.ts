import { addDoc, collection, doc, getDoc, getDocs, orderBy, query, Timestamp, where, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { JournalEntry, JournalLine } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { backupDeletedRecord } from './trashService';
import { syncJournalToDebtControl, deleteSyncedDebtControl } from './debtService';

export const createJournalEntry = async (
  description: string,
  reference: string,
  lines: JournalLine[],
  userId: string,
  date: Date = new Date(),
  picName?: string,
  dpRefNumber?: string,
  schoolUnit?: 'SMP' | 'SMA' | 'Umum'
) => {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Jurnal tidak seimbang! Total Debit harus sama dengan Total Kredit.');
  }

  const path = 'journal_entries';
  try {
    const createdAtTime = Timestamp.now();
    const docData: any = {
      date: Timestamp.fromDate(date),
      description,
      reference,
      lines,
      createdBy: userId,
      createdAt: createdAtTime,
      picName: picName || '',
      dpRefNumber: dpRefNumber || '',
      schoolUnit: schoolUnit || 'Umum'
    };
    const docRef = await addDoc(collection(db, path), docData);

    const journalId = docRef.id;
    try {
      await syncJournalToDebtControl({
        id: journalId,
        date: Timestamp.fromDate(date),
        description,
        reference,
        lines,
        createdBy: userId,
        createdAt: createdAtTime,
        picName: picName || '',
        dpRefNumber: dpRefNumber || '',
        schoolUnit: schoolUnit || 'Umum'
      });
    } catch (syncErr) {
      console.error("Gagal melakukan sinkronisasi kontrol hutang piutang:", syncErr);
    }

    return journalId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const getJournalEntries = async (): Promise<JournalEntry[]> => {
  const path = 'journal_entries';
  try {
    const q = query(collection(db, path), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
};

export const getLedgerForAccount = async (accountId: string): Promise<any[]> => {
  const allEntries = await getJournalEntries();
  const ledgerLines: any[] = [];
  
  allEntries.forEach(entry => {
    entry.lines.forEach(line => {
      if (line.accountId === accountId) {
        ledgerLines.push({
          date: entry.date,
          description: entry.description,
          reference: entry.reference,
          debit: line.debit,
          credit: line.credit,
          schoolUnit: entry.schoolUnit || 'Umum'
        });
      }
    });
  });

  return ledgerLines.sort((a, b) => a.date.seconds - b.date.seconds);
};

export const updateJournalEntry = async (
  id: string,
  description: string,
  reference: string,
  lines: JournalLine[],
  date: Date,
  createdBy: string,
  createdAt: any,
  picName?: string,
  dpRefNumber?: string,
  schoolUnit?: 'SMP' | 'SMA' | 'Umum'
) => {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum+ line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Jurnal tidak seimbang! Total Debit harus sama dengan Total Kredit.');
  }

  const path = `journal_entries/${id}`;
  try {
    const docRef = doc(db, 'journal_entries', id);
    await updateDoc(docRef, {
      date: Timestamp.fromDate(date),
      description,
      reference,
      lines,
      createdBy,
      createdAt,
      picName: picName || '',
      dpRefNumber: dpRefNumber || '',
      schoolUnit: schoolUnit || 'Umum'
    });

    try {
      await syncJournalToDebtControl({
        id,
        date: Timestamp.fromDate(date),
        description,
        reference,
        lines,
        createdBy,
        createdAt,
        picName: picName || '',
        dpRefNumber: dpRefNumber || '',
        schoolUnit: schoolUnit || 'Umum'
      });
    } catch (syncErr) {
      console.error("Gagal memperbarui sinkronisasi kontrol hutang piutang:", syncErr);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
};

export const deleteJournalEntry = async (id: string) => {
  const path = `journal_entries/${id}`;
  try {
    const docRef = doc(db, 'journal_entries', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await backupDeletedRecord('journal_entries', id, snap.data(), auth.currentUser?.uid || 'system');
    }

    await deleteDoc(docRef);

    try {
      await deleteSyncedDebtControl(id);
    } catch (syncErr) {
      console.error("Gagal menghapus sinkronisasi kontrol hutang piutang:", syncErr);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};
