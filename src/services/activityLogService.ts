import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ActivityLog } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

export const logActivity = async (
  action: string,
  category: 'COA' | 'Journal' | 'Invoice' | 'Debts' | 'Assets' | 'Settings' | 'Auth' | 'Users' | 'Trash',
  details: string
) => {
  const path = 'activity_logs';
  try {
    const user = auth.currentUser;
    if (!user) return; // Skip if no user logged in

    const logEntry = {
      userId: user.uid,
      userEmail: user.email || 'unknown',
      userName: user.displayName || 'Pengguna',
      action,
      category,
      details,
      timestamp: serverTimestamp(),
    };

    const docRef = await addDoc(collection(db, path), logEntry);
    return docRef.id;
  } catch (error) {
    // Graceful warning for logs (do not block core transaction on log failure)
    console.warn('Gagal mencatat log aktivitas:', error);
  }
};

export const getActivityLogs = async (maxCount = 500): Promise<ActivityLog[]> => {
  const path = 'activity_logs';
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(maxCount));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as ActivityLog;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
};
