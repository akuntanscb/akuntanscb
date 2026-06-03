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
import { db, auth } from '../lib/firebase';
import { Invoice, InvoiceItem } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

const COLLECTION_PATH = 'invoices';

export const generateInvoiceNumber = async (): Promise<string> => {
  try {
    const q = query(collection(db, COLLECTION_PATH), orderBy('invoiceNumber', 'desc'));
    const snapshot = await getDocs(q);
    const now = new Date();
    const year = now.getFullYear();
    
    let lastNum = 0;
    if (!snapshot.empty) {
      // Find the last INV for the current year
      const yearInvoice = snapshot.docs.find(doc => {
        const num = doc.data().invoiceNumber || '';
        return num.startsWith(`INV/${year}/`);
      });
      
      if (yearInvoice) {
        const lastInvoiceNumber = yearInvoice.data().invoiceNumber;
        const match = lastInvoiceNumber.match(/INV\/\d{4}\/(\d+)/);
        if (match && match[1]) {
          lastNum = parseInt(match[1], 10);
        }
      }
    }
    
    const nextNum = String(lastNum + 1).padStart(3, '0');
    return `INV/${year}/${nextNum}`;
  } catch (error) {
    console.error('Failed to generate invoice number, fallback to random:', error);
    const rand = Math.floor(100 + Math.random() * 900);
    return `INV/${new Date().getFullYear()}/${rand}`;
  }
};

export const getInvoices = async (): Promise<Invoice[]> => {
  try {
    const q = query(collection(db, COLLECTION_PATH), orderBy('date', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date instanceof Timestamp ? data.date.toDate() : data.date ? new Date(data.date) : new Date(),
        dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : data.dueDate ? new Date(data.dueDate) : new Date(),
      } as Invoice;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, COLLECTION_PATH);
    throw error;
  }
};

export const createInvoice = async (
  invoiceNumber: string,
  recipient: string,
  date: Date,
  dueDate: Date,
  items: InvoiceItem[],
  total: number,
  notes: string,
  status: 'Draft' | 'Sent' | 'Paid' | 'Cancelled' = 'Draft'
): Promise<string> => {
  try {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    const payload = {
      invoiceNumber,
      recipient,
      date: Timestamp.fromDate(date),
      dueDate: Timestamp.fromDate(dueDate),
      items,
      total,
      notes,
      status,
      createdBy: auth.currentUser.uid,
      createdAt: Timestamp.now()
    };
    
    const docRef = await addDoc(collection(db, COLLECTION_PATH), payload);
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, COLLECTION_PATH);
    throw error;
  }
};

export const updateInvoice = async (
  id: string,
  recipient: string,
  date: Date,
  dueDate: Date,
  items: InvoiceItem[],
  total: number,
  notes: string,
  status: 'Draft' | 'Sent' | 'Paid' | 'Cancelled'
): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_PATH, id);
    await updateDoc(docRef, {
      recipient,
      date: Timestamp.fromDate(date),
      dueDate: Timestamp.fromDate(dueDate),
      items,
      total,
      notes,
      status,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_PATH}/${id}`);
    throw error;
  }
};

export const updateInvoiceStatus = async (id: string, status: 'Draft' | 'Sent' | 'Paid' | 'Cancelled'): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_PATH, id);
    await updateDoc(docRef, { status, updatedAt: Timestamp.now() });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${COLLECTION_PATH}/${id}`);
    throw error;
  }
};

export const deleteInvoice = async (id: string): Promise<void> => {
  try {
    const docRef = doc(db, COLLECTION_PATH, id);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_PATH}/${id}`);
    throw error;
  }
};
