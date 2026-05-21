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

const COLLECTION_PATH = 'debts_receivables';

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
  userId: string
): Promise<string> => {
  try {
    const remainingBalance = totalAmount - downPayment;
    let status: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Belum Lunas';
    
    if (remainingBalance <= 0) {
      status = 'Lunas';
    } else if (downPayment > 0) {
      status = 'Sebagian';
    }

    const docData = {
      type,
      name,
      date: Timestamp.fromDate(date),
      dueDate: Timestamp.fromDate(dueDate),
      totalAmount,
      downPayment,
      paidAmount: 0,
      remainingBalance,
      remarks,
      status,
      payments: [],
      createdBy: userId,
      createdAt: Timestamp.now()
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

    const newPayment: DebtPayment = {
      id: Math.random().toString(36).substring(2, 9),
      date: Timestamp.fromDate(paymentDate),
      amount: paymentAmount,
      notes: paymentNotes
    };

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
  }
): Promise<void> => {
  const docRef = doc(db, COLLECTION_PATH, debtId);
  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      throw new Error('Data Hutang/Piutang tidak ditemukan.');
    }

    const currentData = docSnap.data() as DebtReceivable;
    
    // Recalculate remaining balance
    const totalAmount = updateData.totalAmount;
    const downPayment = updateData.downPayment;
    const paidAmount = currentData.paidAmount || 0;
    
    const remainingBalance = totalAmount - downPayment - paidAmount;
    
    let status: 'Belum Lunas' | 'Lunas' | 'Sebagian' = 'Belum Lunas';
    if (remainingBalance <= 0) {
      status = 'Lunas';
    } else if (paidAmount > 0 || downPayment > 0) {
      status = 'Sebagian';
    }

    await updateDoc(docRef, {
      name: updateData.name,
      date: Timestamp.fromDate(updateData.date),
      dueDate: Timestamp.fromDate(updateData.dueDate),
      totalAmount,
      downPayment,
      remainingBalance: Math.max(0, remainingBalance),
      status,
      remarks: updateData.remarks
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_PATH}/${debtId}`);
    throw error;
  }
};

export const deleteDebt = async (debtId: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_PATH, debtId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_PATH}/${debtId}`);
    throw error;
  }
};
