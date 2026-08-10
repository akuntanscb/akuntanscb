export type AccountCategory = 'Aset' | 'Liabilitas' | 'Ekuitas' | 'Pendapatan' | 'Beban';

export interface Account {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  subCategory: string;
  initialBalance: number;
  initialBalanceSMP?: number;
  initialBalanceSMA?: number;
  initialBalanceUmum?: number;
  isDeletable: boolean;
  order?: number;
  hideOnReport?: boolean;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  picName?: string; // PIC name for cash advances/dp
}

export interface JournalEntry {
  id: string;
  date: any; // Firestore Timestamp
  description: string;
  reference: string;
  lines: JournalLine[];
  createdBy: string;
  createdAt: any;
  picName?: string; // General PIC name for the entry
  schoolUnit?: 'SMP' | 'SMA' | 'Umum';
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  recipient: string;
  date: any;
  dueDate: any;
  items: InvoiceItem[];
  total: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Cancelled';
  notes: string;
  createdBy: string;
  type?: 'Faktur' | 'Penerimaan' | 'Pengeluaran';
  schoolUnit?: 'SMP' | 'SMA' | 'Umum';
}

export interface DebtPayment {
  id: string;
  date: any;
  amount: number;
  notes: string;
  cashAccountId?: string;
  cashAccountName?: string;
}

export interface DebtReceivable {
  id: string;
  type: 'Hutang' | 'Piutang';
  name: string;
  date: any;
  dueDate: any;
  totalAmount: number;
  downPayment: number;
  paidAmount: number;
  remainingBalance: number;
  remarks: string;
  status: 'Belum Lunas' | 'Lunas' | 'Sebagian';
  payments?: DebtPayment[];
  createdBy: string;
  createdAt: any;
  isUangMuka?: boolean;
  picName?: string;
  dpRefNumber?: string;
  reference?: string;
  journalId?: string;
  cashAccountId?: string;
  cashAccountName?: string;
  schoolUnit?: 'SMP' | 'SMA' | 'Umum';
}

export interface DepreciationLog {
  id: string;
  date: any; // Firestore Timestamp
  amount: number;
  notes?: string;
  journalId?: string;
  postedBy: string;
  postedAt: any; // Firestore Timestamp
}

export interface FixedAsset {
  id: string;
  code: string;
  name: string;
  purchaseDate: any; // Firestore Timestamp
  purchaseCost: number;
  usefulLife: number; // masa manfaat dalam tahun
  residualValue: number;
  depreciationMethod: 'straight_line' | 'double_declining';
  assetAccountId: string;
  assetAccountName: string;
  deprExpenseAccountId: string;
  deprExpenseAccountName: string;
  accumDeprAccountId: string;
  accumDeprAccountName: string;
  status: 'Aktif' | 'Dilepas';
  disposalDate?: any; // Firestore Timestamp
  disposalPrice?: number;
  remarks?: string;
  createdBy: string;
  createdAt: any; // Firestore Timestamp
  depreciationHistory: DepreciationLog[];
  schoolUnit?: 'SMP' | 'SMA' | 'Umum';
}

export interface UserRole {
  id?: string;
  email: string;
  name?: string;
  role: 'admin' | 'operator' | 'viewer';
  permissions: {
    canCOA: boolean;
    canJournal: boolean;
    canInvoices: boolean;
    canDebt: boolean;
    canFixedAssets: boolean;
    canSettings: boolean;
    canUsers: boolean;
    canTrash: boolean;
  };
  restrictedUnits: ('SMP' | 'SMA' | 'Umum')[];
  createdAt: any;
  updatedAt: any;
}

export interface ActivityLog {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  action: string;
  category: 'COA' | 'Journal' | 'Invoice' | 'Debts' | 'Assets' | 'Settings' | 'Auth' | 'Users' | 'Trash';
  details: string;
  timestamp: any; // Firestore Timestamp or Date
}


