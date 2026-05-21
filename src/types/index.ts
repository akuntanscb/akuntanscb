export type AccountCategory = 'Aset' | 'Liabilitas' | 'Ekuitas' | 'Pendapatan' | 'Beban';

export interface Account {
  id: string;
  code: string;
  name: string;
  category: AccountCategory;
  subCategory: string;
  initialBalance: number;
  isDeletable: boolean;
  order?: number;
  hideOnReport?: boolean;
}

export interface JournalLine {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface JournalEntry {
  id: string;
  date: any; // Firestore Timestamp
  description: string;
  reference: string;
  lines: JournalLine[];
  createdBy: string;
  createdAt: any;
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
}

export interface DebtPayment {
  id: string;
  date: any;
  amount: number;
  notes: string;
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
}

