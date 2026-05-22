import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Account } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { backupDeletedRecord } from './trashService';

const INITIAL_COA: Partial<Account>[] = [
  // ASET
  { code: '1101', name: 'Kas Kecil', category: 'Aset', subCategory: 'Kas & Bank', initialBalance: 0, isDeletable: false },
  { code: '1102', name: 'Bank Zakat (Syariah)', category: 'Aset', subCategory: 'Kas & Bank', initialBalance: 0, isDeletable: false },
  { code: '1103', name: 'Bank Infaq (Syariah)', category: 'Aset', subCategory: 'Kas & Bank', initialBalance: 0, isDeletable: false },
  { code: '1201', name: 'Piutang Donatur', category: 'Aset', subCategory: 'Piutang', initialBalance: 0, isDeletable: true },
  { code: '1301', name: 'Aset Tetap - Bangunan', category: 'Aset', subCategory: 'Aset Tetap', initialBalance: 0, isDeletable: true },
  
  // LIABILITAS
  { code: '2101', name: 'Hutang Gaji Guru', category: 'Liabilitas', subCategory: 'Hutang Lancar', initialBalance: 0, isDeletable: true },
  { code: '2102', name: 'Hutang Operasional', category: 'Liabilitas', subCategory: 'Hutang Lancar', initialBalance: 0, isDeletable: true },

  // EKUITAS (ASET NETO)
  { code: '3101', name: 'Aset Neto Tanpa Pembatasan', category: 'Ekuitas', subCategory: 'Ekuitas', initialBalance: 0, isDeletable: false },
  { code: '3102', name: 'Aset Neto Terikat (Zakat)', category: 'Ekuitas', subCategory: 'Ekuitas', initialBalance: 0, isDeletable: false },

  // PENDAPATAN
  { code: '4101', name: 'Penerimaan Zakat', category: 'Pendapatan', subCategory: 'Pendapatan Zakat', initialBalance: 0, isDeletable: false },
  { code: '4102', name: 'Penerimaan Infaq/Sedekah', category: 'Pendapatan', subCategory: 'Pendapatan Infaq', initialBalance: 0, isDeletable: false },
  { code: '4103', name: 'Dana Hibah/Donasi', category: 'Pendapatan', subCategory: 'Pendapatan Donasi', initialBalance: 0, isDeletable: false },

  // BEBAN
  { code: '5101', name: 'Beban Gaji & Tunjangan', category: 'Beban', subCategory: 'Beban Pegawai', initialBalance: 0, isDeletable: true },
  { code: '5201', name: 'Beban Program Pendidikan', category: 'Beban', subCategory: 'Beban Program', initialBalance: 0, isDeletable: true },
  { code: '5202', name: 'Beban Beasiswa Santri', category: 'Beban', subCategory: 'Beban Program', initialBalance: 0, isDeletable: true },
  { code: '5301', name: 'Beban Listrik & Air', category: 'Beban', subCategory: 'Beban Operasional', initialBalance: 0, isDeletable: true },
];

export const initializeCOA = async () => {
  const path = 'accounts';
  try {
    const snapshot = await getDocs(collection(db, path));
    if (snapshot.empty) {
      const batch = writeBatch(db);
      INITIAL_COA.forEach((account) => {
        const docRef = doc(collection(db, path));
        batch.set(docRef, { ...account, id: docRef.id });
      });
      await batch.commit();
      console.log('COA Initialized');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const getAccounts = async (): Promise<Account[]> => {
  const path = 'accounts';
  try {
    const snapshot = await getDocs(collection(db, path));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Account));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
};

export const createAccount = async (accountData: Omit<Account, 'id'>) => {
  const path = 'accounts';
  try {
    const docRef = doc(collection(db, path));
    const newAccount = {
      ...accountData,
      id: docRef.id,
      isDeletable: accountData.isDeletable !== undefined ? accountData.isDeletable : true
    };
    await setDoc(docRef, newAccount);
    return newAccount;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const updateAccount = async (accountId: string, accountData: Partial<Account>) => {
  const path = `accounts/${accountId}`;
  try {
    const docRef = doc(db, 'accounts', accountId);
    await updateDoc(docRef, accountData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
    throw error;
  }
};

export const deleteAccount = async (accountId: string) => {
  const path = `accounts/${accountId}`;
  try {
    const docRef = doc(db, 'accounts', accountId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      await backupDeletedRecord('accounts', accountId, snap.data(), auth.currentUser?.uid || 'system');
    }
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};
