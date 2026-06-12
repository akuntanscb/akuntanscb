import { collection, doc, getDoc, getDocs, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserRole } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';

const PRIMARY_ADMIN_EMAIL = 'keuangan.scb@gmail.com';

export const DEFAULT_ADMIN_PERMISSIONS = {
  canCOA: true,
  canJournal: true,
  canInvoices: true,
  canDebt: true,
  canFixedAssets: true,
  canSettings: true,
  canUsers: true,
  canTrash: true,
};

export const DEFAULT_OPERATOR_PERMISSIONS = {
  canCOA: true,
  canJournal: true,
  canInvoices: true,
  canDebt: true,
  canFixedAssets: true,
  canSettings: false,
  canUsers: false,
  canTrash: false,
};

export const DEFAULT_VIEWER_PERMISSIONS = {
  canCOA: false,
  canJournal: false,
  canInvoices: false,
  canDebt: false,
  canFixedAssets: false,
  canSettings: false,
  canUsers: false,
  canTrash: false,
};

export const checkOrCreatePrimaryAdmin = async (): Promise<UserRole> => {
  const path = `user_roles/${PRIMARY_ADMIN_EMAIL}`;
  try {
    const docRef = doc(db, 'user_roles', PRIMARY_ADMIN_EMAIL);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      const primaryAdmin: UserRole = {
        email: PRIMARY_ADMIN_EMAIL,
        name: 'Primary Admin (SCB)',
        role: 'admin',
        permissions: DEFAULT_ADMIN_PERMISSIONS,
        restrictedUnits: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(docRef, primaryAdmin);
      return primaryAdmin;
    }
    return snap.data() as UserRole;
  } catch (error) {
    console.warn('Gagal memverifikasi atau membuat primary admin di database:', error);
    return {
      email: PRIMARY_ADMIN_EMAIL,
      name: 'Primary Admin (SCB)',
      role: 'admin',
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      restrictedUnits: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
};

export const getUserRoleByEmail = async (email: string): Promise<UserRole> => {
  const lowercaseVal = email.toLowerCase().trim();
  
  // Hardcoded Primary Admin override for safety and seamless first run
  if (lowercaseVal === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
    await checkOrCreatePrimaryAdmin().catch(() => {});
    return {
      email: PRIMARY_ADMIN_EMAIL,
      name: 'Primary Admin (SCB)',
      role: 'admin',
      permissions: DEFAULT_ADMIN_PERMISSIONS,
      restrictedUnits: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  const path = `user_roles/${lowercaseVal}`;
  try {
    const docRef = doc(db, 'user_roles', lowercaseVal);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserRole;
    }
    
    // Default Role for unconfigured accounts is 'viewer' with no read/write of logs/COA edits etc
    return {
      email: lowercaseVal,
      name: 'Pengguna Terbatas',
      role: 'viewer',
      permissions: DEFAULT_VIEWER_PERMISSIONS,
      restrictedUnits: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.warn('Error fetching role, returning viewer default:', error);
    return {
      email: lowercaseVal,
      name: 'Pengguna Terbatas',
      role: 'viewer',
      permissions: DEFAULT_VIEWER_PERMISSIONS,
      restrictedUnits: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
};

export const saveUserRole = async (email: string, userRoleData: Omit<UserRole, 'createdAt' | 'updatedAt'>) => {
  const path = `user_roles/${email}`;
  const lowercaseEmail = email.toLowerCase().trim();
  try {
    const docRef = doc(db, 'user_roles', lowercaseEmail);
    const existingSnap = await getDoc(docRef);
    
    let dbData: any;
    if (existingSnap.exists()) {
      dbData = {
        ...existingSnap.data(),
        ...userRoleData,
        email: lowercaseEmail,
        updatedAt: serverTimestamp(),
      };
    } else {
      dbData = {
        ...userRoleData,
        email: lowercaseEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
    }
    await setDoc(docRef, dbData);
    return dbData;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

export const deleteUserRole = async (email: string) => {
  const path = `user_roles/${email}`;
  try {
    const docRef = doc(db, 'user_roles', email.toLowerCase());
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};

export const getAllUserRoles = async (): Promise<UserRole[]> => {
  const path = 'user_roles';
  try {
    const snapshot = await getDocs(collection(db, path));
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserRole));
    
    // Ensure primary admin is in the list
    const hasPrimary = list.some(u => u.email.toLowerCase() === PRIMARY_ADMIN_EMAIL.toLowerCase());
    if (!hasPrimary) {
      list.unshift({
        email: PRIMARY_ADMIN_EMAIL,
        name: 'Primary Admin (SCB)',
        role: 'admin',
        permissions: DEFAULT_ADMIN_PERMISSIONS,
        restrictedUnits: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    throw error;
  }
};
