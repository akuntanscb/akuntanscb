import { 
  addDoc, 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  orderBy, 
  query, 
  Timestamp, 
  setDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

export interface DeletedRecord {
  id: string;
  originalId: string;
  originalCollection: 'journal_entries' | 'debts_receivables' | 'accounts';
  deletedAt: any; // Firestore Timestamp
  deletedBy: string;
  metadata: {
    title: string;
    subtitle: string;
    amount: number;
    details?: string;
  };
  data: any; // Entire original document's raw payload
}

const TRASH_COLLECTION = 'deleted_records';

/**
 * Back up a document to the deleted_records collection before it is deleted permanently from the original location.
 */
export const backupDeletedRecord = async (
  originalCollection: 'journal_entries' | 'debts_receivables' | 'accounts',
  originalId: string,
  data: any,
  userId: string
): Promise<string> => {
  try {
    let title = 'Dokumen Terhapus';
    let subtitle = '';
    let amount = 0;
    let details = '';

    if (originalCollection === 'journal_entries') {
      title = data.description || 'Jurnal Tanpa Keterangan';
      subtitle = data.reference ? `Ref: ${data.reference}` : 'Jurnal Umum';
      amount = data.lines?.reduce((sum: number, line: any) => sum + (line.debit || 0), 0) || 0;
      details = `${data.lines?.length || 0} Baris Jurnal`;
    } else if (originalCollection === 'debts_receivables') {
      title = data.name || 'Kontrol Hutang/Piutang Terhapus';
      subtitle = `${data.type || 'Pencatatan'} • ${data.remarks || 'Tanpa Memo'}`;
      amount = data.totalAmount || 0;
      details = `Sisa Saldo: ${data.remainingBalance || 0} • Status: ${data.status || '-'}`;
    } else if (originalCollection === 'accounts') {
      title = data.name || 'Akun COA Terhapus';
      subtitle = `Kode Akun: ${data.code || '-'} • Kategori: ${data.category || '-'}`;
      amount = data.initialBalance || 0;
      details = `Sub Kategori: ${data.subCategory || '-'}`;
    }

    const trashPayload: Omit<DeletedRecord, 'id'> = {
      originalId,
      originalCollection,
      deletedAt: Timestamp.now(),
      deletedBy: userId || auth.currentUser?.uid || 'anonymous',
      metadata: {
        title,
        subtitle,
        amount,
        details
      },
      data
    };

    const docRef = await addDoc(collection(db, TRASH_COLLECTION), trashPayload);
    return docRef.id;
  } catch (error) {
    console.error('Gagal membuat salinan cadangan di Tempat Sampah:', error);
    // Silent fail if backup fails so we don't block deletion, but throwing error is safer for user intent
    throw new Error('Gagal mencadangkan data sebelum penghapusan: ' + (error instanceof Error ? error.message : String(error)));
  }
};

/**
 * Fetch all deleted history logs for user restore panel
 */
export const getDeletedRecords = async (): Promise<DeletedRecord[]> => {
  try {
    const q = query(collection(db, TRASH_COLLECTION), orderBy('deletedAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as DeletedRecord));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, TRASH_COLLECTION);
    throw error;
  }
};

/**
 * Restore a previously deleted document to its original collection
 */
export const restoreDeletedRecord = async (record: DeletedRecord): Promise<void> => {
  try {
    const { originalCollection, originalId, data, id } = record;
    
    // 1. Recreate document in original location with exact original ID & original data
    const targetDocRef = doc(db, originalCollection, originalId);
    await setDoc(targetDocRef, data);

    // 2. Clear out from recycle bin history
    const trashDocRef = doc(db, TRASH_COLLECTION, id);
    await deleteDoc(trashDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${record.originalCollection}/${record.originalId}`);
    throw error;
  }
};

/**
 * Completely wipe a record from the recycle bin (cannot be restored after this)
 */
export const wipeTrashRecord = async (trashId: string): Promise<void> => {
  try {
    const trashDocRef = doc(db, TRASH_COLLECTION, trashId);
    await deleteDoc(trashDocRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${TRASH_COLLECTION}/${trashId}`);
    throw error;
  }
};

/**
 * Empty the entire recycle bin collection safely
 */
export const emptyAllRecycleBin = async (records: DeletedRecord[]): Promise<void> => {
  try {
    for (const record of records) {
      await deleteDoc(doc(db, TRASH_COLLECTION, record.id));
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, TRASH_COLLECTION);
    throw error;
  }
};
