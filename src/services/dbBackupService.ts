import { collection, doc, getDocs, setDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseErrors';
import { initializeCOA } from './accountService';

/**
 * Recursively reconstructs Firestore Timestamp objects from serialized {_seconds, _nanoseconds} or {seconds, nanoseconds} representation.
 */
function reconstructFirestoreTimestamps(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object') {
    // Check if it matches a Firestore Timestamp signature
    const hasSeconds = typeof val.seconds === 'number' || typeof val._seconds === 'number';
    const hasNanos = typeof val.nanoseconds === 'number' || typeof val._nanoseconds === 'number';
    if (hasSeconds && hasNanos) {
      const seconds = typeof val.seconds === 'number' ? val.seconds : val._seconds;
      const nanoseconds = typeof val.nanoseconds === 'number' ? val.nanoseconds : val._nanoseconds;
      return new Timestamp(seconds, nanoseconds);
    }
    
    if (Array.isArray(val)) {
      return val.map(reconstructFirestoreTimestamps);
    }
    
    const result: any = {};
    for (const key of Object.keys(val)) {
      result[key] = reconstructFirestoreTimestamps(val[key]);
    }
    return result;
  }
  return val;
}

const COLLECTIONS_LIST = [
  'accounts',
  'journal_entries',
  'invoices',
  'debts_receivables',
  'system_settings',
  'deleted_records',
  'fixed_assets'
] as const;

export interface BackupData {
  backupMetadata: {
    timestamp: string;
    version: string;
    creatorEmail: string;
    systemName: string;
    totalRecords: number;
  };
  data: {
    accounts?: any[];
    journal_entries?: any[];
    invoices?: any[];
    debts_receivables?: any[];
    system_settings?: any[];
    deleted_records?: any[];
    fixed_assets?: any[];
  };
}

/**
 * Split an array of items into smaller chunks.
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

/**
 * Fetch and build the complete backup payload from all active Firestore collections.
 */
export const exportCompleteDatabase = async (): Promise<BackupData> => {
  try {
    const backupPayload: any = {};
    let totalRecords = 0;

    for (const colName of COLLECTIONS_LIST) {
      const snap = await getDocs(collection(db, colName));
      backupPayload[colName] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      totalRecords += snap.docs.length;
    }

    // Retrieve active system name from settings
    const systemSettingsSnap = await getDocs(collection(db, 'system_settings'));
    let systemName = 'SIA Cendekia Baznas';
    if (!systemSettingsSnap.empty) {
      const activeSettings = systemSettingsSnap.docs[0].data();
      if (activeSettings?.systemName) {
        systemName = activeSettings.systemName;
      }
    }

    const payload: BackupData = {
      backupMetadata: {
        timestamp: new Date().toISOString(),
        version: '1.2.0',
        creatorEmail: auth.currentUser?.email || 'unauthenticated_user',
        systemName,
        totalRecords
      },
      data: backupPayload
    };

    return payload;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'multiple_collections_backup');
    throw error;
  }
};

/**
 * Validates whether the provided parsed json structure matches our expected schema format.
 */
export const validateBackupSchema = (parsedJson: any): parsedJson is BackupData => {
  if (!parsedJson || typeof parsedJson !== 'object') return false;

  // Auto-recovery / wrapping if it's a direct JSON of tables (e.g., exported from another source or manually written)
  if (!parsedJson.data && (parsedJson.accounts || parsedJson.journal_entries || parsedJson.invoices || parsedJson.debts_receivables || parsedJson.fixed_assets)) {
    const rawData = { ...parsedJson };
    parsedJson.data = {
      accounts: rawData.accounts || [],
      journal_entries: rawData.journal_entries || [],
      invoices: rawData.invoices || [],
      debts_receivables: rawData.debts_receivables || [],
      system_settings: rawData.system_settings || [],
      deleted_records: rawData.deleted_records || [],
      fixed_assets: rawData.fixed_assets || []
    };
    parsedJson.backupMetadata = {
      timestamp: new Date().toISOString(),
      version: '1.2.0',
      creatorEmail: auth.currentUser?.email || 'system_imported',
      systemName: 'SIA Cendekia Baznas',
      totalRecords: 0
    };
  } else if (parsedJson.data && typeof parsedJson.data === 'object' && !parsedJson.backupMetadata) {
    parsedJson.backupMetadata = {
      timestamp: new Date().toISOString(),
      version: '1.2.0',
      creatorEmail: auth.currentUser?.email || 'system_imported',
      systemName: 'SIA Cendekia Baznas',
      totalRecords: 0
    };
  }

  // Final validations
  const m = parsedJson.backupMetadata;
  if (!m || typeof m !== 'object') return false;
  if (typeof m.timestamp !== 'string') return false;
  if (typeof m.version !== 'string') return false;
  
  const d = parsedJson.data;
  if (!d || typeof d !== 'object') return false;

  return true;
};

/**
 * Wipes out all existing documents in selected collections.
 */
export const clearDatabaseCollections = async (collectionsToClear: typeof COLLECTIONS_LIST[number][]) => {
  try {
    for (const colName of collectionsToClear) {
      const snap = await getDocs(collection(db, colName));
      if (snap.empty) continue;

      const chunks = chunkArray(snap.docs, 250); // Safe threshold under 500
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((docSnap) => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'multiple_collections_wipe');
    throw error;
  }
};

/**
 * Restores data back into firestore with flexible modes.
 * @param backupData Approved verified backup schema
 * @param mode 'overwrite' to wipe existing data first, 'merge' to insert missing/update matching by dynamic IDs.
 */
export const restoreDatabaseBackup = async (
  backupData: BackupData,
  mode: 'overwrite' | 'merge'
): Promise<{ success: boolean; totalUploaded: number }> => {
  try {
    if (mode === 'overwrite') {
      // Overwrite mode: Clean up existing data first
      // Note: We clear everything except settings, or we clear settings too based on user request.
      // Let's clear everything listed in the backup so we have a clean 100% snapshot match.
      await clearDatabaseCollections([
        'accounts',
        'journal_entries',
        'invoices',
        'debts_receivables',
        'deleted_records',
        'system_settings',
        'fixed_assets'
      ]);
    }

    let totalUploaded = 0;

    for (const colName of COLLECTIONS_LIST) {
      const records = backupData.data[colName];
      if (!records || !Array.isArray(records) || records.length === 0) continue;

      const chunks = chunkArray(records, 250);
      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach((record) => {
          const reconstructedRecord = reconstructFirestoreTimestamps(record);
          const { id, ...payload } = reconstructedRecord;
          
          // Ensure ownership and audit fields conform to security requirements on restore
          const currentUid = auth.currentUser?.uid || 'system';
          
          if (colName === 'journal_entries') {
            if (!payload.createdBy) payload.createdBy = currentUid;
            if (!payload.createdAt) payload.createdAt = payload.date || Timestamp.now();
          } else if (colName === 'invoices') {
            if (!payload.createdBy) payload.createdBy = currentUid;
            if (!payload.status) payload.status = 'Draft';
          } else if (colName === 'debts_receivables') {
            if (!payload.createdBy) payload.createdBy = currentUid;
            if (!payload.createdAt) payload.createdAt = Timestamp.now();
            if (!payload.payments) payload.payments = [];
          } else if (colName === 'deleted_records') {
            if (!payload.deletedBy) payload.deletedBy = currentUid;
          } else if (colName === 'fixed_assets') {
            if (!payload.createdBy) payload.createdBy = currentUid;
            if (!payload.createdAt) payload.createdAt = Timestamp.now();
            if (!payload.depreciationHistory) payload.depreciationHistory = [];
          }

          if (id) {
            const docRef = doc(db, colName, id);
            batch.set(docRef, payload);
          } else {
            const docRef = doc(collection(db, colName));
            batch.set(docRef, payload);
          }
        });
        await batch.commit();
        totalUploaded += chunk.length;
      }
    }

    // If accounts is empty, let's auto-initialize it default
    const accountsCheck = await getDocs(collection(db, 'accounts'));
    if (accountsCheck.empty) {
      await initializeCOA();
    }

    return {
      success: true,
      totalUploaded
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'backup_restore_execution');
    throw error;
  }
};

/**
 * Fully resets/archives the application transactions.
 * It deletes all journals, invoices, debts/receivables, and trash records.
 * It also resets accounts to default values so user can immediately write neat entries.
 */
export const resetAllTransactionsToDefault = async (): Promise<void> => {
  try {
    // Delete all transactional records
    await clearDatabaseCollections([
      'journal_entries',
      'invoices',
      'debts_receivables',
      'deleted_records',
      'accounts',
      'fixed_assets'
    ]);

    // Re-initialize COA defaults
    await initializeCOA();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'system_reset_initial');
    throw error;
  }
};
