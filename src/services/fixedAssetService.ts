import { 
  addDoc, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  orderBy, 
  query, 
  Timestamp, 
  updateDoc, 
  deleteDoc, 
  arrayUnion
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { FixedAsset, DepreciationLog, JournalLine } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { createJournalEntry } from './journalService';

const COLLECTION_NAME = 'fixed_assets';

/**
 * Mengambil semua inventaris aset tetap dari Firestore
 */
export const getFixedAssets = async (): Promise<FixedAsset[]> => {
  try {
    const q = query(collection(db, COLLECTION_NAME), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        purchaseDate: data.purchaseDate,
        createdAt: data.createdAt,
        depreciationHistory: data.depreciationHistory || []
      } as FixedAsset;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
    throw error;
  }
};

/**
 * Mencatat item aset tetap baru ke Firestore
 */
export const createFixedAsset = async (assetData: Omit<FixedAsset, 'id' | 'createdBy' | 'createdAt' | 'depreciationHistory'>, userId: string) => {
  try {
    const docData = {
      ...assetData,
      createdBy: userId,
      createdAt: Timestamp.now(),
      depreciationHistory: [],
      schoolUnit: (assetData as any).schoolUnit || 'Umum'
    };
    const docRef = await addDoc(collection(db, COLLECTION_NAME), docData);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_NAME);
    throw error;
  }
};

/**
 * Memperbarui data aset tetap
 */
export const updateFixedAsset = async (assetId: string, assetData: Partial<FixedAsset>) => {
  const path = `${COLLECTION_NAME}/${assetId}`;
  try {
    const docRef = doc(db, COLLECTION_NAME, assetId);
    await updateDoc(docRef, assetData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
};

/**
 * Menghapus data aset tetap
 */
export const deleteFixedAsset = async (assetId: string) => {
  const path = `${COLLECTION_NAME}/${assetId}`;
  try {
    const docRef = doc(db, COLLECTION_NAME, assetId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};

/**
 * Melakukan posting jurnal penyusutan aset tetap & mencatat log riwayatnya
 */
export const postAssetDepreciation = async (
  asset: FixedAsset,
  amount: number,
  deprDate: Date,
  notes: string,
  userId: string
): Promise<string> => {
  try {
    // 1. Buat catatan Jurnal Umum
    const journalLines: JournalLine[] = [
      {
        accountId: asset.deprExpenseAccountId,
        accountName: asset.deprExpenseAccountName,
        debit: amount,
        credit: 0
      },
      {
        accountId: asset.accumDeprAccountId,
        accountName: asset.accumDeprAccountName,
        debit: 0,
        credit: amount
      }
    ];

    const refNo = `DEP/${asset.code}/${deprDate.getFullYear()}${(deprDate.getMonth() + 1).toString().padStart(2, '0')}`;
    const desc = notes || `Penyusutan Aset ${asset.name} - ${deprDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`;

    const journalId = await createJournalEntry(
      desc,
      refNo,
      journalLines,
      userId,
      deprDate,
      undefined,
      undefined,
      asset.schoolUnit || 'Umum'
    );

    // 2. Catat riwayat di dokumen aset tetap terkait
    const logId = Math.random().toString(36).substring(2, 9);
    const newLog: DepreciationLog = {
      id: logId,
      date: Timestamp.fromDate(deprDate),
      amount: amount,
      notes: desc,
      journalId: journalId,
      postedBy: userId,
      postedAt: Timestamp.now()
    };

    const docRef = doc(db, COLLECTION_NAME, asset.id);
    await updateDoc(docRef, {
      depreciationHistory: arrayUnion(newLog)
    });

    return journalId;
  } catch (error) {
    console.error('Gagal memposting penyusutan aset tetap:', error);
    throw error;
  }
};
