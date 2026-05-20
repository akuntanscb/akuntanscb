import { addDoc, collection, getDocs, orderBy, query, Timestamp, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { JournalEntry, JournalLine } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

export const createJournalEntry = async (
  description: string,
  reference: string,
  lines: JournalLine[],
  userId: string,
  date: Date = new Date()
) => {
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error('Jurnal tidak seimbang! Total Debit harus sama dengan Total Kredit.');
  }

  const path = 'journal_entries';
  try {
    const docRef = await addDoc(collection(db, path), {
      date: Timestamp.fromDate(date),
      description,
      reference,
      lines,
      createdBy: userId,
      createdAt: Timestamp.now()
    });

    return docRef.id;
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
          credit: line.credit
        });
      }
    });
  });

  return ledgerLines.sort((a, b) => a.date.seconds - b.date.seconds);
};
