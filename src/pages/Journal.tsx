import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Trash2, 
  Save, 
  AlertCircle, 
  Edit2, 
  X,
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  FileUp,
  FileDown,
  HelpCircle,
  CheckCircle2,
  Info,
  Zap,
  Copy,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { getAccounts } from '../services/accountService';
import { createJournalEntry, getJournalEntries, updateJournalEntry, deleteJournalEntry } from '../services/journalService';
import { getDebts } from '../services/debtService';
import { Account, JournalLine, JournalEntry, DebtReceivable } from '../types';
import { auth } from '../lib/firebase';
import { formatRupiah, cn } from '../lib/utils';
import { format } from 'date-fns';
import { useUserRole } from '../context/UserRoleContext';
import { Shield } from 'lucide-react';

interface ParsedEntry {
  dateStr: string;
  reference: string;
  description: string;
  picName: string;
  lines: {
    accountCode: string;
    accountName: string;
    debit: number;
    credit: number;
  }[];
  isValid: boolean;
  errors: string[];
}

export default function Journal() {
  const { hasPermission, isUnitAllowed, userRole } = useUserRole();
  const isViewer = userRole?.role === 'viewer';

  if (!hasPermission('canJournal')) {
    return (
      <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md mx-auto my-12 shadow-sm font-sans">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-slate-500">Anda tidak memiliki hak istimewa (canJournal) untuk melihat atau mencatat Jurnal Umum.</p>
      </div>
    );
  }

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [debts, setDebts] = useState<DebtReceivable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Import & Export States
  const [showImportExport, setShowImportExport] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSuccessMsg, setImportSuccessMsg] = useState('');
  const [importErrorMsg, setImportErrorMsg] = useState('');

  // Form State
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [picName, setPicName] = useState('');
  const [selectedDpRef, setSelectedDpRef] = useState('');
  const [schoolUnit, setSchoolUnit] = useState<'SMP' | 'SMA' | 'Umum'>('Umum');
  const [lines, setLines] = useState<JournalLine[]>([
    { accountId: '', accountName: '', debit: 0, credit: 0 },
    { accountId: '', accountName: '', debit: 0, credit: 0 },
  ]);
  const [error, setError] = useState('');

  // Edit & Delete States
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<JournalEntry | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);

  // Filter & Pagination States
  const [filterText, setFilterText] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterSchoolUnit, setFilterSchoolUnit] = useState<'all' | 'SMP' | 'SMA' | 'Umum'>('all');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterText, filterAccount, filterStartDate, filterEndDate, filterSchoolUnit, pageSize]);

  // Quick Input Helpers
  const handleGenerateRef = () => {
    const yearMonth = format(new Date(date || new Date()), 'yyyyMM');
    const countThisMonth = entries.filter(e => {
      try {
        return format(e.date.toDate(), 'yyyyMM') === yearMonth;
      } catch {
        return false;
      }
    }).length + 1;
    setReference(`JU-${yearMonth}-${String(countThisMonth).padStart(3, '0')}`);
  };

  const handleDuplicateLine = (index: number) => {
    const lineToCopy = lines[index];
    const newLines = [...lines];
    newLines.splice(index + 1, 0, { ...lineToCopy });
    setLines(newLines);
  };

  const handleAutoBalanceLine = (targetIndex?: number) => {
    const currentTotalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
    const currentTotalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);
    const diff = Math.round((currentTotalDebit - currentTotalCredit) * 100) / 100;

    if (Math.abs(diff) < 0.01) return;

    const newLines = [...lines];
    if (targetIndex !== undefined && targetIndex >= 0 && targetIndex < newLines.length) {
      if (diff > 0) {
        newLines[targetIndex].credit = Math.round(((newLines[targetIndex].credit || 0) + diff) * 100) / 100;
        newLines[targetIndex].debit = 0;
      } else {
        newLines[targetIndex].debit = Math.round(((newLines[targetIndex].debit || 0) + Math.abs(diff)) * 100) / 100;
        newLines[targetIndex].credit = 0;
      }
    } else {
      if (diff > 0) {
        newLines.push({ accountId: '', accountName: '', debit: 0, credit: Math.abs(diff) });
      } else {
        newLines.push({ accountId: '', accountName: '', debit: Math.abs(diff), credit: 0 });
      }
    }
    setLines(newLines);
  };

  const applyTemplate = (templateType: 'spp' | 'operasional' | 'gaji' | 'setorBank') => {
    const kasAcc = accounts.find(a => a.name.toLowerCase().includes('kas') || a.code.startsWith('1-100'));
    const bankAcc = accounts.find(a => a.name.toLowerCase().includes('bank') || a.code.startsWith('1-102'));
    const sppAcc = accounts.find(a => a.name.toLowerCase().includes('spp') || a.name.toLowerCase().includes('bulanan') || a.code.startsWith('4-4'));
    const bebanAtk = accounts.find(a => a.name.toLowerCase().includes('atk') || a.name.toLowerCase().includes('operasional') || a.name.toLowerCase().includes('beban') || a.code.startsWith('5-5'));
    const bebanGaji = accounts.find(a => a.name.toLowerCase().includes('gaji') || a.name.toLowerCase().includes('honor') || a.code.startsWith('5-501'));

    if (templateType === 'spp') {
      setDescription('Penerimaan SPP Bulanan Siswa');
      setLines([
        { accountId: kasAcc?.id || '', accountName: kasAcc?.name || '', debit: 0, credit: 0 },
        { accountId: sppAcc?.id || '', accountName: sppAcc?.name || '', debit: 0, credit: 0 },
      ]);
    } else if (templateType === 'operasional') {
      setDescription('Pengeluaran Operasional / Pembelian ATK');
      setLines([
        { accountId: bebanAtk?.id || '', accountName: bebanAtk?.name || '', debit: 0, credit: 0 },
        { accountId: kasAcc?.id || '', accountName: kasAcc?.name || '', debit: 0, credit: 0 },
      ]);
    } else if (templateType === 'gaji') {
      setDescription('Pembayaran Gaji dan Honorarium Guru / Staf');
      setLines([
        { accountId: bebanGaji?.id || '', accountName: bebanGaji?.name || '', debit: 0, credit: 0 },
        { accountId: bankAcc?.id || kasAcc?.id || '', accountName: bankAcc?.name || kasAcc?.name || '', debit: 0, credit: 0 },
      ]);
    } else if (templateType === 'setorBank') {
      setDescription('Setoran Kas Tunai ke Rekening Bank Sekolah');
      setLines([
        { accountId: bankAcc?.id || '', accountName: bankAcc?.name || '', debit: 0, credit: 0 },
        { accountId: kasAcc?.id || '', accountName: kasAcc?.name || '', debit: 0, credit: 0 },
      ]);
    }
    if (!reference) {
      handleGenerateRef();
    }
  };

  const handleSaveAndNew = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (!auth.currentUser) throw new Error('Anda harus masuk untuk mencatat jurnal.');
      if (!description) throw new Error('Keterangan harus diisi.');

      await createJournalEntry(description, reference, lines, auth.currentUser.uid, new Date(date), picName, selectedDpRef, schoolUnit);

      // Auto increment reference number if present
      if (reference) {
        const match = reference.match(/^(.*?)(\d+)$/);
        if (match) {
          const prefix = match[1];
          const num = parseInt(match[2], 10) + 1;
          const paddedNum = String(num).padStart(match[2].length, '0');
          setReference(`${prefix}${paddedNum}`);
        }
      }

      setDescription('');
      setLines([
        { accountId: '', accountName: '', debit: 0, credit: 0 },
        { accountId: '', accountName: '', debit: 0, credit: 0 },
      ]);
      setSelectedDpRef('');
      setPicName('');

      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Bulk Delete States
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState('');

  const handleResetFilters = () => {
    setFilterText('');
    setFilterAccount('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilterSchoolUnit('all');
  };

  const handleToggleSelectEntry = (id: string) => {
    setSelectedEntryIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Safe reset when form closes/opens
  const handleCancelForm = () => {
    setShowForm(false);
    setIsEditingMode(false);
    setEditingEntry(null);
    setDescription('');
    setReference('');
    setPicName('');
    setSelectedDpRef('');
    setSchoolUnit('Umum');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setLines([
      { accountId: '', accountName: '', debit: 0, credit: 0 },
      { accountId: '', accountName: '', debit: 0, credit: 0 },
    ]);
    setError('');
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [accs, jurs, debtsList] = await Promise.all([getAccounts(), getJournalEntries(), getDebts()]);
    setAccounts(accs);
    setEntries(jurs);
    setDebts(debtsList);
    setLoading(false);
  };

  const handleAddLine = () => {
    setLines([...lines, { accountId: '', accountName: '', debit: 0, credit: 0 }]);
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleLineChange = (index: number, field: keyof JournalLine, value: any) => {
    const newLines = [...lines];
    if (field === 'accountId') {
      const acc = accounts.find(a => a.id === value);
      newLines[index].accountId = value;
      newLines[index].accountName = acc?.name || '';
    } else {
      newLines[index][field] = Number(value);
    }
    setLines(newLines);
  };

  const handleEditClick = (entry: JournalEntry) => {
    setIsEditingMode(true);
    setEditingEntry(entry);
    setDescription(entry.description);
    setReference(entry.reference);
    setPicName((entry as any).picName || '');
    setSelectedDpRef((entry as any).dpRefNumber || '');
    setSchoolUnit(entry.schoolUnit || 'Umum');
    setDate(format(entry.date.toDate(), 'yyyy-MM-dd'));
    setLines(entry.lines.map(line => ({
      accountId: line.accountId,
      accountName: line.accountName,
      debit: line.debit,
      credit: line.credit
    })));
    setShowForm(true);
    setError('');
  };

  const handleDeleteClick = (entry: JournalEntry) => {
    setEntryToDelete(entry);
    setDeleteError('');
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!entryToDelete) return;
    setIsDeletingLoading(true);
    setDeleteError('');
    try {
      await deleteJournalEntry(entryToDelete.id);
      setDeleteConfirmOpen(false);
      setEntryToDelete(null);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || 'Gagal menghapus entri jurnal.');
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (!auth.currentUser) throw new Error('Anda harus masuk untuk mencatat jurnal.');
      if (!description) throw new Error('Keterangan harus diisi.');
      
      if (isEditingMode && editingEntry) {
        await updateJournalEntry(
          editingEntry.id,
          description,
          reference,
          lines,
          new Date(date),
          editingEntry.createdBy,
          editingEntry.createdAt,
          picName,
          selectedDpRef,
          schoolUnit
        );
      } else {
        await createJournalEntry(description, reference, lines, auth.currentUser.uid, new Date(date), picName, selectedDpRef, schoolUnit);
      }
      
      handleCancelForm();
      fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Computed Filtered Entries
  const filteredEntries = entries.filter(entry => {
    // 0. Unit restriction check
    if (!isUnitAllowed(entry.schoolUnit || 'Umum')) {
      return false;
    }

    // 1. Text Search (Description, Reference, PIC, or account details)
    if (filterText) {
      const lowerText = filterText.toLowerCase();
      const descMatch = entry.description?.toLowerCase().includes(lowerText);
      const refMatch = entry.reference?.toLowerCase().includes(lowerText);
      const picMatch = (entry as any).picName?.toLowerCase().includes(lowerText);
      
      const lineMatch = entry.lines.some(l => 
        l.accountName?.toLowerCase().includes(lowerText) ||
        accounts.find(a => a.id === l.accountId)?.code?.toLowerCase().includes(lowerText) ||
        accounts.find(a => a.id === l.accountId)?.name?.toLowerCase().includes(lowerText)
      );

      if (!descMatch && !refMatch && !picMatch && !lineMatch) {
        return false;
      }
    }

    // 2. Account Filter
    if (filterAccount) {
      const hasAccount = entry.lines.some(l => l.accountId === filterAccount);
      if (!hasAccount) return false;
    }

    // 3. Date Filters
    if (entry.date) {
      const entryDate = entry.date.toDate();
      const dateStr = format(entryDate, 'yyyy-MM-dd');

      if (filterStartDate && dateStr < filterStartDate) {
        return false;
      }
      if (filterEndDate && dateStr > filterEndDate) {
        return false;
      }
    }

    // 4. School Unit Filter
    if (filterSchoolUnit !== 'all') {
      const entryUnit = entry.schoolUnit || 'Umum';
      if (entryUnit !== filterSchoolUnit) return false;
    }

    return true;
  });

  // Sorted list: Last inputted (createdAt descending)
  const sortedAndFilteredEntries = [...filteredEntries].sort((a, b) => {
    const timeA = a.createdAt?.seconds || a.date?.seconds || 0;
    const timeB = b.createdAt?.seconds || b.date?.seconds || 0;
    return timeB - timeA;
  });

  const handleSelectAllEntries = (checked: boolean) => {
    if (checked) {
      setSelectedEntryIds(filteredEntries.map(e => e.id));
    } else {
      setSelectedEntryIds([]);
    }
  };

  const handleBulkDeleteClick = () => {
    setBulkDeleteError('');
    setBulkDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    setIsBulkDeleting(true);
    setBulkDeleteError('');
    let successCount = 0;
    try {
      for (const id of selectedEntryIds) {
        await deleteJournalEntry(id);
        successCount++;
      }
      setSelectedEntryIds([]);
      setBulkDeleteConfirmOpen(false);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setBulkDeleteError(`Berhasil menghapus ${successCount} dari ${selectedEntryIds.length} entri. Error: ${err.message || 'Gagal menghapus beberapa entri.'}`);
      fetchData();
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const hasCreditUangMuka = lines.some((line) => {
    if (!line.accountId || !line.credit || line.credit <= 0) return false;
    const acc = accounts.find((a) => a.id === line.accountId);
    if (!acc) return false;
    const name = acc.name.toLowerCase();
    return name.includes('uang muka') || name.includes('panjar') || name.includes('dp');
  });

  const hasDebitHutang = lines.some((line) => {
    if (!line.accountId || !line.debit || line.debit <= 0) return false;
    const acc = accounts.find((a) => a.id === line.accountId);
    if (!acc) return false;
    const isHutang = acc.category === 'Liabilitas' && 
      (acc.subCategory?.toLowerCase()?.includes('hutang') || 
       acc.subCategory?.toLowerCase()?.includes('kewajiban') || 
       acc.name.toLowerCase().includes('hutang'));
    return isHutang;
  });

  // Automatically reset selectedDpRef if hasCreditUangMuka and hasDebitHutang become false
  useEffect(() => {
    if (!hasCreditUangMuka && !hasDebitHutang) {
      setSelectedDpRef('');
    }
  }, [hasCreditUangMuka, hasDebitHutang]);

  const handleSelectDpRef = (refNum: string) => {
    setSelectedDpRef(refNum);
    if (!refNum) return;
    const um = debts.find((d) => d.dpRefNumber === refNum);
    if (um) {
      if (um.picName) {
        setPicName(um.picName);
      }
      const originalRemarks = um.remarks || 'Uang Muka';
      setDescription(`Laporan Pertanggungjawaban ${originalRemarks} [Ref: ${um.dpRefNumber}]`);
    }
  };

  const handleSelectHutangRef = (refNum: string) => {
    setSelectedDpRef(refNum);
    if (!refNum) return;
    const debt = debts.find((d) => d.dpRefNumber === refNum);
    if (debt) {
      if (debt.picName) {
        setPicName(debt.picName);
      }
      const originalName = debt.name || 'Hutang';
      setDescription(`Pembayaran Hutang: ${originalName} [Ref: ${debt.dpRefNumber}]`);
    }
  };

  // ==========================================
  // EXPORT & IMPORT ENGINE ROUTINES
  // ==========================================

  const parseCSV = (text: string): string[][] => {
    const result: string[][] = [];
    const lines = text.split(/\r?\n/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row: string[] = [];
      let insideQuotes = false;
      let currentVal = '';
      
      for (let c = 0; c < line.length; c++) {
        const char = line[c];
        
        if (char === '"') {
          if (insideQuotes && line[c + 1] === '"') {
            currentVal += '"';
            c++;
          } else {
            insideQuotes = !insideQuotes;
          }
        } else if (char === ',' && !insideQuotes) {
          row.push(currentVal.trim());
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
      row.push(currentVal.trim());
      result.push(row);
    }
    return result;
  };

  const handleExportCSV = (all: boolean) => {
    const dataToExport = all ? entries : sortedAndFilteredEntries;
    if (dataToExport.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }
    
    const headers = ["Tanggal", "Referensi", "Keterangan", "PIC", "Kode Akun", "Nama Akun", "Debit", "Kredit"];
    const rows = [headers];
    
    dataToExport.forEach(entry => {
      const dateStr = format(entry.date.toDate(), 'yyyy-MM-dd');
      const pic = (entry as any).picName || '';
      entry.lines.forEach(line => {
        const acc = accounts.find(a => a.id === line.accountId);
        const code = acc ? acc.code : '';
        const name = acc ? acc.name : line.accountName;
        rows.push([
          dateStr,
          entry.reference,
          entry.description,
          pic,
          code,
          name,
          line.debit.toString(),
          line.credit.toString()
        ]);
      });
    });
    
    const csvContent = "\uFEFF" + rows.map(r => r.map(val => {
      const clean = (val || '').replace(/"/g, '""');
      return `"${clean}"`;
    }).join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Ekspor_Jurnal_${all ? 'Semua' : 'Terfilter'}_${format(new Date(), 'yyyyMMdd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = (all: boolean) => {
    const dataToExport = all ? entries : sortedAndFilteredEntries;
    if (dataToExport.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    const serializableData = dataToExport.map(entry => ({
      date: entry.date.toDate().toISOString(),
      description: entry.description,
      reference: entry.reference,
      picName: (entry as any).picName || '',
      dpRefNumber: (entry as any).dpRefNumber || '',
      lines: entry.lines.map(line => {
        const acc = accounts.find(a => a.id === line.accountId);
        return {
          accountCode: acc ? acc.code : '',
          accountName: line.accountName,
          debit: line.debit,
          credit: line.credit
        };
      })
    }));

    const jsonContent = JSON.stringify(serializableData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Ekspor_Jurnal_${all ? 'Semua' : 'Terfilter'}_${format(new Date(), 'yyyyMMdd_HHmmss')}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = ["Tanggal", "Referensi", "Keterangan", "PIC", "Kode Akun", "Nama Akun", "Debit", "Kredit"];
    const kasCode = accounts.find(a => a.name.toLowerCase().includes('kas') || a.code.startsWith('1-1'))?.code || '1-10001';
    const sppCode = accounts.find(a => a.name.toLowerCase().includes('spp') || a.name.toLowerCase().includes('bulanan') || a.code.startsWith('4-'))?.code || '4-40001';
    const bebanCode = accounts.find(a => a.name.toLowerCase().includes('beban') || a.name.toLowerCase().includes('belanja') || a.code.startsWith('5-'))?.code || '5-50001';

    const rows = [
      headers,
      ["2026-05-22", "BM-001", "Penerimaan SPP Siswa Kelas 1", "Siti Aminah", kasCode, "Kas Sekolah", "1500000", "0"],
      ["2026-05-22", "BM-001", "Penerimaan SPP Siswa Kelas 1", "Siti Aminah", sppCode, "Pendapatan SPP Bulanan", "0", "1500000"],
      ["2026-05-22", "BK-001", "Pembelian Kertas dan Alat Tulis Kantor", "", bebanCode, "Beban ATK", "350000", "0"],
      ["2026-05-22", "BK-001", "Pembelian Kertas dan Alat Tulis Kantor", "", kasCode, "Kas Sekolah", "0", "350000"]
    ];

    const csvContent = "\uFEFF" + rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "jurnal_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setImportSuccessMsg('');
    setImportErrorMsg('');
    setParsedEntries([]);
    const reader = new FileReader();
    
    const isCSV = file.name.endsWith('.csv');
    const isJSON = file.name.endsWith('.json');
    
    if (!isCSV && !isJSON) {
      setImportErrorMsg('Format file tidak didukung. Harap unggah file .csv atau .json.');
      return;
    }
    
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const tempParsedList: ParsedEntry[] = [];
        
        if (isCSV) {
          const csvRows = parseCSV(text);
          if (csvRows.length < 2) {
            setImportErrorMsg('File CSV kosong atau tidak memiliki data.');
            return;
          }
          
          const headers = csvRows[0].map(h => h.toLowerCase().replace(/[\ufeff\s]/g, ''));
          const idxDate = headers.indexOf('tanggal');
          const idxRef = headers.indexOf('referensi');
          const idxDesc = headers.indexOf('keterangan');
          const idxPic = headers.indexOf('pic');
          const idxCode = headers.indexOf('kodeakun');
          const idxName = headers.indexOf('namaakun');
          const idxDebit = headers.indexOf('debit');
          const idxCredit = headers.indexOf('kredit');
          
          if (idxDate === -1 || idxCode === -1 || (idxDebit === -1 && idxCredit === -1)) {
            setImportErrorMsg("Struktur kolom CSV salah. Pastikan memiliki kolom wajib: Tanggal, Kode Akun, Debit, Kredit.");
            return;
          }
          
          let currentGroup: ParsedEntry | null = null;
          
          for (let i = 1; i < csvRows.length; i++) {
            const row = csvRows[i];
            if (row.length === 0 || row.join('').trim() === '') continue;
            
            const dateStr = row[idxDate] || '';
            const reference = idxRef !== -1 ? (row[idxRef] || '') : '';
            const description = idxDesc !== -1 ? (row[idxDesc] || '') : '';
            const picName = idxPic !== -1 ? (row[idxPic] || '') : '';
            const accountCode = row[idxCode] || '';
            const accountName = idxName !== -1 ? (row[idxName] || '') : '';
            const debit = idxDebit !== -1 ? parseFloat(row[idxDebit]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
            const credit = idxCredit !== -1 ? parseFloat(row[idxCredit]?.replace(/[^0-9.-]/g, '') || '0') || 0 : 0;
            
            const isSameGroup = currentGroup && 
              currentGroup.dateStr === dateStr && 
              currentGroup.reference === reference && 
              currentGroup.description === description;
              
            if (isSameGroup && currentGroup) {
              currentGroup.lines.push({ accountCode, accountName, debit, credit });
            } else {
              if (currentGroup) {
                tempParsedList.push(currentGroup);
              }
              currentGroup = {
                dateStr,
                reference,
                description,
                picName,
                lines: [{ accountCode, accountName, debit, credit }],
                isValid: true,
                errors: []
              };
            }
          }
          if (currentGroup) {
            tempParsedList.push(currentGroup);
          }
        } else if (isJSON) {
          const parsedArray = JSON.parse(text);
          if (!Array.isArray(parsedArray)) {
            setImportErrorMsg('Format ekspor JSON tidak valid (harus berupa daftar array).');
            return;
          }
          
          parsedArray.forEach((item: any) => {
            const dateStr = item.date ? format(new Date(item.date), 'yyyy-MM-dd') : '';
            const lines = (item.lines || []).map((l: any) => ({
              accountCode: l.accountCode || '',
              accountName: l.accountName || '',
              debit: Number(l.debit || 0),
              credit: Number(l.credit || 0)
            }));
            
            tempParsedList.push({
              dateStr,
              reference: item.reference || '',
              description: item.description || '',
              picName: item.picName || '',
              lines,
              isValid: true,
              errors: []
            });
          });
        }
        
        // Validate
        tempParsedList.forEach(entry => {
          const errors: string[] = [];
          
          if (!entry.dateStr) {
            errors.push("Tanggal kosong.");
          } else {
            const tDate = new Date(entry.dateStr);
            if (isNaN(tDate.getTime())) {
              errors.push(`Tanggal '${entry.dateStr}' tidak valid.`);
            }
          }
          
          if (!entry.description.trim()) {
            errors.push("Keterangan jurnal kosong.");
          }
          
          if (entry.lines.length < 2) {
            errors.push("Buku jurnal wajib memiliki setidaknya 2 baris pencatatan.");
          }
          
          let sumDebit = 0;
          let sumCredit = 0;
          
          entry.lines.forEach((l, lIdx) => {
            sumDebit += l.debit;
            sumCredit += l.credit;
            
            const matchedCoa = accounts.find(a => a.code === l.accountCode);
            if (!matchedCoa) {
              errors.push(`Baris #${lIdx + 1}: Kode Akun '${l.accountCode}' tidak ditemukan di Bagan Akun.`);
            }
            
            if (l.debit <= 0 && l.credit <= 0) {
              errors.push(`Baris #${lIdx + 1}: Nilai Debit atau Kredit harus lebih besar dari 0.`);
            }
            if (l.debit > 0 && l.credit > 0) {
              errors.push(`Baris #${lIdx + 1}: Baris tidak bisa diisi Debit sekaligus Kredit.`);
            }
          });
          
          if (Math.abs(sumDebit - sumCredit) > 0.01) {
            errors.push(`Jurnal tidak seimbang. Total Debit (${sumDebit}) ≠ Total Kredit (${sumCredit}).`);
          }
          
          if (errors.length > 0) {
            entry.isValid = false;
            entry.errors = errors;
          }
        });
        
        setParsedEntries(tempParsedList);
        if (tempParsedList.length === 0) {
          setImportErrorMsg('Tidak ada baris data atau rincian transaksi yang dapat dibaca.');
        } else {
          const invalidCount = tempParsedList.filter(e => !e.isValid).length;
          if (invalidCount > 0) {
            setImportErrorMsg(`Ditemukan ${invalidCount} jurnal bermasalah dari total ${tempParsedList.length} entri di dalam file. Silakan periksa detailnya di bawah.`);
          }
        }
      } catch (err: any) {
        console.error(err);
        setImportErrorMsg('Gagal memproses file. Pastikan struktur data valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const validOnes = parsedEntries.filter(e => e.isValid);
    if (validOnes.length === 0) {
      alert("Tidak ada entri valid yang dapat dimasukkan.");
      return;
    }
    
    setImportLoading(true);
    setImportProgress({ current: 0, total: validOnes.length });
    
    let importedCount = 0;
    try {
      const uId = auth.currentUser?.uid || 'system';
      for (let i = 0; i < validOnes.length; i++) {
        const entry = validOnes[i];
        
        const linesToSubmit = entry.lines.map(line => {
          const matchedCoa = accounts.find(a => a.code === line.accountCode)!;
          return {
            accountId: matchedCoa.id,
            accountName: matchedCoa.name,
            debit: line.debit,
            credit: line.credit
          };
        });
        
        await createJournalEntry(
          entry.description,
          entry.reference,
          linesToSubmit,
          uId,
          new Date(entry.dateStr),
          entry.picName || '',
          ''
        );
        
        importedCount++;
        setImportProgress({ current: importedCount, total: validOnes.length });
      }
      
      setImportSuccessMsg(`Sukses! Berhasil mengimpor ${importedCount} entri jurnal baru ke buku laporan secara instan.`);
      setParsedEntries([]);
      fetchData();
    } catch (err: any) {
      console.error(err);
      setImportErrorMsg(`Gagal memproses impor data: ${err.message || 'Error internal'}`);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Jurnal Umum</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Pencatatan transaksi harian sekolah</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => {
              setShowImportExport(!showImportExport);
              if (showForm) handleCancelForm();
            }}
            className={cn(
              "px-5 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all font-semibold shadow-sm border text-sm w-full sm:w-auto cursor-pointer select-none",
              showImportExport 
                ? "bg-amber-50 text-amber-700 border-amber-200" 
                : "bg-white border-natural-border text-slate-700 hover:bg-slate-50"
            )}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            {isViewer ? 'Ekspor Jurnal' : 'Ekspor & Impor'}
          </button>
          
          {!isViewer && (
            <button 
              onClick={() => {
                if (showForm) {
                  handleCancelForm();
                } else {
                  setShowForm(true);
                  setShowImportExport(false);
                }
              }}
              className={cn(
                "px-6 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all font-semibold shadow-sm text-sm w-full sm:w-auto cursor-pointer select-none",
                showForm ? "bg-rose-50 text-rose-600 border border-rose-200" : "bg-natural-primary text-white hover:opacity-90"
              )}
            >
              {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {showForm ? 'Batal' : 'Entri Jurnal'}
            </button>
          )}
        </div>
      </div>

      {/* Import & Export Panel */}
      <AnimatePresence>
        {showImportExport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={cn(
              "bg-gradient-to-br from-slate-50 to-white p-6 rounded-3xl border border-natural-border shadow-md grid gap-8",
              isViewer ? "grid-cols-1 max-w-2xl mx-auto" : "grid-cols-1 lg:grid-cols-2"
            )}>
              {/* Export Panel */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <FileDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif italic font-bold text-slate-850 text-base">Ekspor Data Jurnal</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Tarik laporan transaksi dalam format file spreadsheet (.csv) atau database (.json)</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Ekspor catatan entri jurnal umum Anda secara instan untuk diolah di Excel, Google Sheets, atau diimpor kembali ke sistem pembukuan lainnya.
                </p>

                <div className="bg-white/80 border border-slate-100 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
                  {/* Status counts */}
                  <div className="text-xs space-y-1 w-full sm:w-auto text-left">
                    <div className="flex justify-between sm:justify-start gap-3">
                      <span className="text-slate-400">Total Transaksi Jurnal:</span>
                      <span className="font-bold text-slate-700 font-mono">{entries.length} entri</span>
                    </div>
                    <div className="flex justify-between sm:justify-start gap-3">
                      <span className="text-slate-400">Terfilter di layar sekarang:</span>
                      <span className="font-bold text-natural-primary font-mono">{sortedAndFilteredEntries.length} entri</span>
                    </div>
                  </div>

                  {/* Buttons group */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExportCSV(true)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 font-semibold text-white rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> CSV (Semua)
                      </button>
                      <button
                        onClick={() => handleExportCSV(false)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 font-semibold text-emerald-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        CSV (Terfilter)
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExportJSON(true)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs bg-slate-800 hover:bg-slate-900 font-semibold text-white rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <FileJson className="w-3.5 h-3.5" /> JSON (Semua)
                      </button>
                      <button
                        onClick={() => handleExportJSON(false)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs bg-slate-50 border border-slate-205 hover:bg-slate-100 font-semibold text-slate-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        JSON (Terfilter)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Import Panel */}
              {!isViewer && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <FileUp className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-serif italic font-bold text-slate-850 text-base">Impor Data Jurnal</h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Unggah spreadsheet Anda untuk membuat laporan otomatis instant</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownloadTemplate}
                      className="text-[10px] text-indigo-700 hover:underline uppercase tracking-widest font-bold font-mono cursor-pointer flex items-center gap-1 shrink-0"
                      title="Unduh format tabel dalam Excel/CSV"
                    >
                      <Download className="w-3 h-3" /> Unduh Template CSV
                    </button>
                  </div>

                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={cn(
                      "border-2 border-dashed rounded-2xl p-6 text-center transition-all relative flex flex-col items-center justify-center gap-2 cursor-pointer min-h-[140px]",
                      dragOver 
                        ? "border-indigo-505 bg-indigo-50/50" 
                        : "border-slate-205 bg-white hover:border-slate-350"
                    )}
                  >
                    <input
                      type="file"
                      accept=".csv,.json"
                      id="import-file-selector"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title=""
                    />
                    <Upload className="w-8 h-8 text-slate-400 shrink-0" />
                    <div className="space-y-0.5 select-none">
                      <p className="text-xs font-semibold text-slate-700">Tarik & Lepaskan File (.csv atau .json)</p>
                      <p className="text-[10px] text-slate-400 leading-none">atau klik area ini untuk memindai dokumen Anda</p>
                    </div>
                  </div>

                  {importSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{importSuccessMsg}</span>
                    </div>
                  )}

                  {importErrorMsg && (
                    <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="flex-1">{importErrorMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Parsing Review Panel / Importer Preview Table */}
            {parsedEntries.length > 0 && (
              <div className="mt-4 bg-white border border-natural-border rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h4 className="font-serif italic font-bold text-slate-855 text-base">Tinjau Validasi Transaksi Impor</h4>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono font-semibold">
                      Terbaca: <b className="text-slate-800 font-bold font-mono">{parsedEntries.length}</b> Jurnal • Valid: <b className="text-emerald-700 font-bold font-mono">{parsedEntries.filter(P => P.isValid).length}</b> • Bermasalah: <b className="text-rose-600 font-bold font-mono">{parsedEntries.filter(P => !P.isValid).length}</b>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => setParsedEntries([])}
                      className="flex-1 sm:flex-none px-4 py-2 text-xs bg-slate-50 border border-slate-205 hover:bg-slate-100 text-slate-600 font-semibold rounded-lg transition-colors cursor-pointer text-center"
                    >
                      Bersihkan
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={importLoading || parsedEntries.filter(P => P.isValid).length === 0}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {importLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Menyimpan ({importProgress.current}/{importProgress.total})...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Simpan {parsedEntries.filter(P => P.isValid).length} Entri Valid</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                  {parsedEntries.map((pe, idx) => (
                    <div key={idx} className="p-3 bg-slate-50/30 flex flex-col md:flex-row justify-between items-start gap-3 text-xs">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          {pe.isValid ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="Valid" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse" title="Perlu Koreksi" />
                          )}
                          <span className="font-bold text-slate-800 font-serif italic text-sm">{pe.description || 'Keterangan Kosong'}</span>
                          {pe.reference && (
                            <span className="font-mono text-[10px] bg-slate-100 border px-1.5 py-0.2 rounded text-slate-500">
                              {pe.reference}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Tanggal: {pe.dateStr} {pe.picName ? `• PIC: ${pe.picName}` : ''}
                        </div>
                        {/* Errors report */}
                        {!pe.isValid && (
                          <div className="space-y-1 mt-1 bg-rose-50 border border-rose-100 text-rose-700 p-2.5 rounded-xl text-[10px] font-medium leading-relaxed max-w-lg">
                            {pe.errors.map((err, eIdx) => (
                              <div key={eIdx} className="flex gap-1 items-start">
                                <span className="text-rose-500 shrink-0">•</span>
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Display debit credit summary */}
                      <div className="text-right shrink-0 pr-2">
                        <span className="text-[10px] text-slate-400 block font-semibold uppercase font-mono select-none">Total Transaksi</span>
                        <span className="font-bold font-mono text-indigo-700">
                          {formatRupiah(pe.lines.reduce((acc, sum) => acc + sum.debit, 0))}
                        </span>
                        <span className="text-[9px] text-slate-400 block font-mono">
                          {pe.lines.length} Baris Akun
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showForm && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl border border-natural-border shadow-xl"
        >
          {isEditingMode && (
            <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-800 text-sm flex justify-between items-center">
              <div>
                <h3 className="font-serif italic font-semibold text-amber-900 text-base">Ubah Jurnal Umum</h3>
                <p className="text-xs text-amber-700">Sedang memperbarui entri jurnal yang dipilih. Pastikan total debit dan kredit seimbang sebelum disimpan.</p>
              </div>
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 rounded-full font-bold text-xs"
              >
                Batal Edit
              </button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Quick Templates Bar for Super Fast Entry */}
            {!isEditingMode && (
              <div className="bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-slate-50 p-4 rounded-2xl border border-emerald-150 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-850 uppercase tracking-wider">
                    <Zap className="w-4 h-4 text-emerald-600 fill-emerald-500" />
                    <span>Template Cepat Transaksi Jurnal</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium">Klik untuk isi otomatis akun & keterangan</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => applyTemplate('spp')}
                    className="px-3 py-1.5 bg-white border border-emerald-200 hover:bg-emerald-100/60 text-emerald-800 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⚡ Penerimaan SPP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('operasional')}
                    className="px-3 py-1.5 bg-white border border-teal-200 hover:bg-teal-100/60 text-teal-800 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⚡ Operasional / ATK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('gaji')}
                    className="px-3 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-100/60 text-indigo-800 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⚡ Gaji & Honorarium</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyTemplate('setorBank')}
                    className="px-3 py-1.5 bg-white border border-sky-200 hover:bg-sky-100/60 text-sky-800 rounded-xl text-xs font-semibold shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>⚡ Setor Tunai Bank</span>
                  </button>
                </div>
              </div>
            )}

            <AnimatePresence>
              {hasCreditUangMuka && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-emerald-50/70 border border-emerald-150 p-4 rounded-xl space-y-2 mb-2">
                    <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Pilih Uang Muka yang Diselesaikan</span>
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        Cash Basis Sync
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <select
                          value={selectedDpRef}
                          onChange={(e) => handleSelectDpRef(e.target.value)}
                          className="w-full px-4 py-2 border border-emerald-250 bg-white rounded-lg text-sm text-emerald-950 font-medium outline-none focus:ring-2 focus:ring-emerald-500 transition-all cursor-pointer"
                        >
                          <option value="">-- Hubungkan Nomor Referensi Uang Muka --</option>
                          {debts
                            .filter((d) => d.isUangMuka && (d.status !== 'Lunas' || d.dpRefNumber === selectedDpRef))
                            .map((d) => (
                              <option key={d.id} value={d.dpRefNumber}>
                                {d.dpRefNumber} - {d.picName || 'Tanpa PIC'} (Sisa: {formatRupiah(d.remainingBalance)})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="text-xs text-emerald-700 leading-relaxed font-sans flex items-center pr-2">
                        Memilih referensi akan otomatis mengisi nama Penanggung Jawab (PIC) dan menyusun keterangan jurnal penyelesaian laporan uang muka secara otomatis.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {hasDebitHutang && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-indigo-50/70 border border-indigo-150 p-4 rounded-xl space-y-2 mb-2">
                    <div className="text-xs font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                      <span>Pilih Hutang yang Diselesaikan</span>
                      <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-semibold">
                        Liability Settlement Sync
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <select
                          value={selectedDpRef}
                          onChange={(e) => handleSelectHutangRef(e.target.value)}
                          className="w-full px-4 py-2 border border-indigo-250 bg-white rounded-lg text-sm text-indigo-950 font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                        >
                          <option value="">-- Hubungkan Nomor Referensi Hutang --</option>
                          {debts
                            .filter((d) => d.type === 'Hutang' && d.dpRefNumber && (d.status !== 'Lunas' || d.dpRefNumber === selectedDpRef))
                            .map((d) => (
                              <option key={d.id} value={d.dpRefNumber}>
                                {d.dpRefNumber} - {d.name} (Sisa: {formatRupiah(d.remainingBalance)})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="text-xs text-indigo-700 leading-relaxed font-sans flex items-center pr-2">
                        Memilih referensi akan otomatis mengisi nama Penanggung Jawab (PIC) dan menyusun keterangan jurnal pembayaran hutang secara otomatis berdasarkan data transaksi asal.
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Tanggal</label>
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Nomor Referensi</label>
                <div className="flex gap-1.5 items-center">
                  <input 
                    type="text" 
                    placeholder="Mis: BM-001"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleGenerateRef}
                    className="p-2 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 rounded-lg border border-slate-250 hover:border-emerald-300 shrink-0 transition-colors text-xs font-semibold flex items-center justify-center cursor-pointer"
                    title="Generate otomatis nomor referensi"
                  >
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Unit Sekolah</label>
                <select
                  value={schoolUnit}
                  onChange={(e) => setSchoolUnit(e.target.value as any)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 bg-white transition-colors cursor-pointer"
                >
                  <option value="Umum">Umum</option>
                  <option value="SMP">SMP</option>
                  <option value="SMA">SMA</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Keterangan</label>
                <input 
                  type="text" 
                  placeholder="Deskripsi transaksi"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2 flex justify-between">
                  <span>PIC (Penanggung Jawab DP)</span>
                  <span className="text-[10px] text-gray-400 font-normal uppercase select-none">Opsional</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Nama PIC Uang Muka"
                  value={picName}
                  onChange={(e) => setPicName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-12 gap-4 text-xs font-bold text-slate-500 uppercase tracking-wider px-2">
                <div className="col-span-5">Nama Akun</div>
                <div className="col-span-2 text-right">Debit</div>
                <div className="col-span-2 text-right">Kredit</div>
                <div className="col-span-3 text-right">Aksi Baris</div>
              </div>
              
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-5">
                    <select 
                      value={line.accountId}
                      onChange={(e) => handleLineChange(idx, 'accountId', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">Pilih Akun...</option>
                      {accounts.sort((a,b) => a.code.localeCompare(b.code)).map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      value={line.debit || ''}
                      placeholder="0"
                      onChange={(e) => handleLineChange(idx, 'debit', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="number" 
                      value={line.credit || ''}
                      placeholder="0"
                      onChange={(e) => handleLineChange(idx, 'credit', e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg text-right focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-1">
                    <button 
                      type="button"
                      onClick={() => handleDuplicateLine(idx)}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Salin Baris Ini"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {!isBalanced && (
                      <button 
                        type="button"
                        onClick={() => handleAutoBalanceLine(idx)}
                        className="px-2 py-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title="Isi sisa selisih nominal ke baris ini"
                      >
                        <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span className="hidden sm:inline">Auto</span>
                      </button>
                    )}
                    <button 
                      type="button"
                      onClick={() => handleRemoveLine(idx)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Hapus Baris"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-between items-center bg-slate-50 p-4 rounded-xl gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  type="button"
                  onClick={handleAddLine}
                  className="text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1.5 text-xs bg-white border border-emerald-200 px-3.5 py-2 rounded-lg shadow-2xs hover:bg-emerald-50 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Tambah Baris
                </button>

                {!isBalanced && (
                  <button 
                    type="button"
                    onClick={() => handleAutoBalanceLine()}
                    className="text-amber-800 hover:text-amber-900 font-semibold flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-lg shadow-2xs hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    <Zap className="w-4 h-4 text-amber-600 fill-amber-500" /> Auto-Balance Baris Baru ({formatRupiah(Math.abs(totalDebit - totalCredit))})
                  </button>
                )}
              </div>
              
              <div className="text-right space-y-1">
                <div className="flex gap-8 text-sm">
                  <span className="text-slate-500">Total Debit:</span>
                  <span className="font-bold">{formatRupiah(totalDebit)}</span>
                </div>
                <div className="flex gap-8 text-sm">
                  <span className="text-slate-500">Total Kredit:</span>
                  <span className="font-bold">{formatRupiah(totalCredit)}</span>
                </div>
                {!isBalanced && totalDebit + totalCredit > 0 && (
                  <p className="text-red-500 text-xs flex items-center gap-1 justify-end font-medium">
                    <AlertCircle className="w-3.5 h-3.5" /> Selisih: {formatRupiah(Math.abs(totalDebit - totalCredit))} (Tidak Seimbang)
                  </p>
                )}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {error}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-3 pt-4 border-t border-slate-100">
              {!isEditingMode && (
                <button 
                  type="button"
                  onClick={handleSaveAndNew}
                  disabled={!isBalanced || totalDebit === 0}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-250 disabled:opacity-50 disabled:cursor-not-allowed px-6 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all shadow-2xs flex items-center gap-2 cursor-pointer"
                  title="Simpan jurnal ini dan langsung buka form baru untuk transaksi berikutnya"
                >
                  <Zap className="w-4 h-4 text-emerald-600 fill-emerald-600" /> Simpan & Entri Baru
                </button>
              )}
              <button 
                type="submit"
                disabled={!isBalanced || totalDebit === 0}
                className="bg-natural-primary hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-2.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" /> {isEditingMode ? 'Perbarui Jurnal' : 'Simpan Jurnal'}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Filters Section */}
      <div className="bg-white p-6 rounded-3xl border border-natural-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-end">
          {/* Text Search */}
          <div className="flex-1 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cari Jurnal</span>
            <input
              type="text"
              placeholder="Cari keterangan, referensi, akun, atau PIC..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-slate-205 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
            />
          </div>

          {/* Account Filter */}
          <div className="w-full md:w-56 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Filter Akun</span>
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-slate-250 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer bg-white"
            >
              <option value="">Semua Akun</option>
              {accounts.sort((a,b) => a.code.localeCompare(b.code)).map(acc => (
                <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
              ))}
            </select>
          </div>

          {/* Unit Filter */}
          <div className="w-full md:w-36 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Unit Sekolah</span>
            <select
              value={filterSchoolUnit}
              onChange={(e) => setFilterSchoolUnit(e.target.value as any)}
              className="w-full px-4 py-2 text-sm border border-slate-250 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer bg-white"
            >
              <option value="all">Consolidated</option>
              <option value="SMP">SMP</option>
              <option value="SMA">SMA</option>
              <option value="Umum">Umum</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="w-full md:w-44 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mulai Tanggal</span>
            <input
              type="date"
              value={filterStartDate}
              onChange={(e) => setFilterStartDate(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-slate-205 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
            />
          </div>

          {/* End Date */}
          <div className="w-full md:w-44 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Sampai Tanggal</span>
            <input
              type="date"
              value={filterEndDate}
              onChange={(e) => setFilterEndDate(e.target.value)}
              className="w-full px-4 py-2 text-sm border border-slate-205 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none hover:border-slate-300 transition-colors"
            />
          </div>

          {/* Page Size Option */}
          <div className="w-full md:w-36 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full px-4 py-2 text-sm border border-slate-250 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer bg-white font-medium text-slate-700"
            >
              <option value={10}>10 Baris</option>
              <option value={25}>25 Baris</option>
              <option value={50}>50 Baris</option>
              <option value={100}>100 Baris</option>
              <option value={0}>Semua Data</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(filterText || filterAccount || filterStartDate || filterEndDate || filterSchoolUnit !== 'all') && (
            <button
              onClick={handleResetFilters}
              className="px-4 py-2 bg-slate-50 border border-slate-205 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1.5 h-[38px] shrink-0 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" /> Bersihkan
            </button>
          )}
        </div>
      </div>

      {/* Bulk Action Bar of Selected Entries */}
      <AnimatePresence>
        {!isViewer && selectedEntryIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="bg-natural-primary text-white p-4 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-3 shadow-md border border-emerald-850"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold font-mono text-emerald-100">
                {selectedEntryIds.length}
              </span>
              <span className="text-sm font-medium font-serif italic text-emerald-50">Entri Jurnal Umum terpilih untuk tindakan massal</span>
            </div>
            <button
              onClick={handleBulkDeleteClick}
              className="w-full sm:w-auto px-5 py-2.5 bg-rose-650 hover:bg-rose-700 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-sm cursor-pointer border border-rose-500"
            >
              <Trash2 className="w-4 h-4" /> Hapus Terpilih
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Journal Table */}
      {(() => {
        const totalItems = sortedAndFilteredEntries.length;
        const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalItems / pageSize));
        const safeCurrentPage = Math.min(currentPage, totalPages);
        const displayedEntries = pageSize === 0 
          ? sortedAndFilteredEntries 
          : sortedAndFilteredEntries.slice((safeCurrentPage - 1) * pageSize, safeCurrentPage * pageSize);
        const startIndex = pageSize === 0 ? (totalItems > 0 ? 1 : 0) : Math.min((safeCurrentPage - 1) * pageSize + 1, totalItems);
        const endIndex = pageSize === 0 ? totalItems : Math.min(safeCurrentPage * pageSize, totalItems);

        return (
          <div className="bg-white rounded-3xl border border-natural-border shadow-sm overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/50 border-b border-natural-border">
                  {!isViewer && (
                    <th className="px-4 py-4 text-center w-12 border-r border-natural-border/30 bg-slate-55/10">
                      <input
                        type="checkbox"
                        checked={filteredEntries.length > 0 && selectedEntryIds.length === filteredEntries.length}
                        ref={(input) => {
                          if (input) {
                            input.indeterminate = selectedEntryIds.length > 0 && selectedEntryIds.length < filteredEntries.length;
                          }
                        }}
                        onChange={(e) => handleSelectAllEntries(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-650 focus:ring-emerald-500 cursor-pointer"
                        title="Pilih semua baris yang terfilter"
                      />
                    </th>
                  )}
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tanggal</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Referensi</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Keterangan</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Akun</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Debit</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Kredit</th>
                  {!isViewer && <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={isViewer ? 6 : 8} className="px-6 py-12 text-center text-slate-400">Belum ada transaksi jurnal.</td>
                  </tr>
                ) : sortedAndFilteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={isViewer ? 6 : 8} className="px-6 py-12 text-center text-slate-400">Tidak ada transaksi jurnal yang cocok dengan filter pencarian.</td>
                  </tr>
                ) : (
                  displayedEntries.map((entry) => (
                    <React.Fragment key={entry.id}>
                      {entry.lines.map((line, lIdx) => (
                        <tr key={`${entry.id}-${lIdx}`} className="hover:bg-slate-50/50 transition-colors">
                          {!isViewer && lIdx === 0 && (
                            <td className="px-4 py-3 text-center border-r border-slate-100 select-none bg-slate-50/5 w-12" rowSpan={entry.lines.length}>
                              <div className="flex justify-center items-center h-full">
                                <input
                                  type="checkbox"
                                  checked={selectedEntryIds.includes(entry.id)}
                                  onChange={() => handleToggleSelectEntry(entry.id)}
                                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                              </div>
                            </td>
                          )}
                          <td className="px-6 py-3 text-sm text-slate-500">
                            {lIdx === 0 ? format(entry.date.toDate(), 'dd/MM/yyyy') : ''}
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-500">
                            {lIdx === 0 ? entry.reference : ''}
                          </td>
                          <td className="px-6 py-3 text-sm text-slate-700 font-medium pb-4">
                            {lIdx === 0 ? (
                              <div>
                                <div>{entry.description}</div>
                                <div className="flex flex-wrap gap-1.5 mt-1.5">
                                  {entry.schoolUnit && entry.schoolUnit !== 'Umum' ? (
                                    <span className={cn(
                                      "text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border",
                                      entry.schoolUnit === 'SMP' 
                                        ? "bg-sky-50 text-sky-700 border-sky-150" 
                                        : "bg-indigo-50 text-indigo-700 border-indigo-150"
                                    )}>
                                      {entry.schoolUnit}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] bg-slate-50 text-slate-600 border border-slate-150 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                      Umum
                                    </span>
                                  )}
                                  {(entry as any).picName && (
                                    <div className="text-[9px] text-emerald-700 bg-emerald-50 border border-emerald-150 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider inline-flex items-center gap-1">
                                      PIC: {(entry as any).picName}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : ''}
                          </td>
                          <td className={cn("px-6 py-3 text-sm text-slate-600", line.credit > 0 && "pl-12")}>
                            <span className="inline-flex items-center gap-2">
                              <span className="font-mono text-xs text-natural-primary/70 bg-natural-primary/5 px-1.5 py-0.5 rounded border border-natural-border">
                                {accounts.find(a => a.id === line.accountId)?.code || ''}
                              </span>
                              <span className="font-medium text-slate-750">
                                {accounts.find(a => a.id === line.accountId)?.name || line.accountName}
                              </span>
                            </span>
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-mono text-emerald-600">
                            {line.debit > 0 ? formatRupiah(line.debit) : ''}
                          </td>
                          <td className="px-6 py-3 text-sm text-right font-mono text-rose-600">
                            {line.credit > 0 ? formatRupiah(line.credit) : ''}
                          </td>
                          {!isViewer && lIdx === 0 && (
                            <td className="px-6 py-3 text-center border-l border-slate-100" rowSpan={entry.lines.length}>
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleEditClick(entry)}
                                  className="p-1.5 hover:bg-natural-bg rounded-lg text-natural-primary hover:scale-105 transition-all shadow-sm border border-neutral-100 bg-white inline-flex animate-none cursor-pointer"
                                  title="Edit Jurnal"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteClick(entry)}
                                  className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-600 hover:scale-105 transition-all shadow-sm border border-neutral-100 bg-white inline-flex animate-none cursor-pointer"
                                  title="Hapus Jurnal"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination Controls Footer */}
            {sortedAndFilteredEntries.length > 0 && (
              <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-500 font-medium">
                  Menampilkan <span className="font-bold text-slate-700">{startIndex}</span> - <span className="font-bold text-slate-700">{endIndex}</span> dari <span className="font-bold text-slate-700">{totalItems}</span> data transaksi
                </div>

                {pageSize > 0 && totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={safeCurrentPage === 1}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" /> Prev
                    </button>
                    <span className="text-xs text-slate-600 font-semibold px-2">
                      Halaman {safeCurrentPage} dari {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={safeCurrentPage >= totalPages}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Delete Confirmation Modal overlay */}
      <AnimatePresence>
        {deleteConfirmOpen && entryToDelete && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-natural-border bg-rose-50/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif italic text-rose-700">Konfirmasi Penghapusan Jurnal</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tindakan ini permanen</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {deleteError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{deleteError}</span>
                  </div>
                )}

                <p className="text-sm text-slate-700 leading-relaxed font-sans">
                  Apakah Anda benar-benar yakin ingin menghapus entri jurnal ini secara permanen dari database keuangan? 
                </p>

                <div className="bg-natural-bg/60 border border-natural-border p-4 rounded-2xl space-y-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Keterangan Jurnal</p>
                  <p className="font-medium text-slate-800 text-sm">
                    {entryToDelete.description}
                  </p>
                  {entryToDelete.reference && (
                    <p className="text-xs text-slate-500">
                      Ref: <span className="font-mono">{entryToDelete.reference}</span>
                    </p>
                  )}
                  <p className="text-[11px] text-slate-500 font-medium">
                    Tanggal: {format(entryToDelete.date.toDate(), 'dd/MM/yyyy')}
                  </p>
                </div>

                <div className="pt-4 border-t border-natural-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setEntryToDelete(null);
                    }}
                    disabled={isDeletingLoading}
                    className="px-5 py-2.5 border border-natural-border rounded-full text-xs font-bold uppercase tracking-wider text-slate-550 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirm}
                    disabled={isDeletingLoading}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-600/10 transition-colors"
                  >
                    {isDeletingLoading ? 'Menghapus...' : 'Hapus Jurnal'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Delete Confirmation Modal */}
      <AnimatePresence>
        {bulkDeleteConfirmOpen && selectedEntryIds.length > 0 && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-md w-full overflow-hidden"
            >
              <div className="p-6 border-b border-natural-border bg-rose-50/10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-serif italic text-rose-700">Konfirmasi Penghapusan Massal</h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">Tindakan ini permanen</p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                {bulkDeleteError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{bulkDeleteError}</span>
                  </div>
                )}

                <p className="text-sm text-slate-700 leading-relaxed font-sans">
                  Apakah Anda benar-benar yakin ingin menghapus <span className="font-bold text-rose-600">{selectedEntryIds.length} entri jurnal</span> yang terpilih secara permanen dari database keuangan? 
                </p>

                <div className="bg-rose-50/10 border border-rose-100 p-4 rounded-2xl max-h-48 overflow-y-auto space-y-2">
                  <p className="text-[10px] font-bold text-rose-550 uppercase tracking-widest mb-1">Daftar Jurnal Terpilih</p>
                  {selectedEntryIds.map(id => {
                    const ent = entries.find(e => e.id === id);
                    if (!ent) return null;
                    return (
                      <div key={id} className="text-xs border-b border-slate-100 pb-1.5 last:border-0 last:pb-0">
                        <span className="font-semibold text-slate-800">{ent.description}</span>
                        {ent.reference && <span className="text-slate-500 text-[11px]"> ({ent.reference})</span>}
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Tanggal: {format(ent.date.toDate(), 'dd/MM/yyyy')}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-4 border-t border-natural-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setBulkDeleteConfirmOpen(false);
                    }}
                    disabled={isBulkDeleting}
                    className="px-5 py-2.5 border border-natural-border rounded-full text-xs font-bold uppercase tracking-wider text-slate-550 hover:bg-slate-50 transition-colors disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDeleteConfirm}
                    disabled={isBulkDeleting}
                    className="px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-md shadow-rose-600/10 transition-colors"
                  >
                    {isBulkDeleting ? 'Menghapus...' : 'Hapus Semua Terpilih'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
