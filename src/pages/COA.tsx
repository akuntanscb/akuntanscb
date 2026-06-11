import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Search, 
  Tag, 
  Wallet, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  AlertCircle, 
  CheckCircle2,
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  FileUp,
  FileDown,
  Info 
} from 'lucide-react';
import { getAccounts, createAccount, updateAccount, deleteAccount } from '../services/accountService';
import { getJournalEntries } from '../services/journalService';
import { Account, AccountCategory } from '../types';
import { formatRupiah, cn } from '../lib/utils';

interface ParsedAccount {
  code: string;
  name: string;
  category: AccountCategory;
  subCategory: string;
  initialBalance: number;
  initialBalanceSMP?: number;
  initialBalanceSMA?: number;
  initialBalanceUmum?: number;
  action: 'create' | 'update';
  existingId?: string;
  isValid: boolean;
  errors: string[];
}

export default function COA() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AccountCategory>('Aset');
  const [subCategory, setSubCategory] = useState('');
  const [initialBalance, setInitialBalance] = useState<string>('0');
  const [initialBalanceSMP, setInitialBalanceSMP] = useState<string>('0');
  const [initialBalanceSMA, setInitialBalanceSMA] = useState<string>('0');
  const [initialBalanceUmum, setInitialBalanceUmum] = useState<string>('0');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Import & Export States
  const [showImportExport, setShowImportExport] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [parsedAccounts, setParsedAccounts] = useState<ParsedAccount[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importSuccessMsg, setImportSuccessMsg] = useState('');
  const [importErrorMsg, setImportErrorMsg] = useState('');

  // Delete Confirmation States
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<{ id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [isDeletingLoading, setIsDeletingLoading] = useState(false);
  const [hasTransactions, setHasTransactions] = useState(false);
  const [transactionCount, setTransactionCount] = useState(0);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const accs = await getAccounts();
      setAccounts(accs.sort((a, b) => a.code.localeCompare(b.code)));
    } catch (err) {
      console.error('Failed to fetch accounts', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingAccountId(null);
    setCode('');
    setName('');
    setCategory('Aset');
    setSubCategory('');
    setInitialBalance('0');
    setInitialBalanceSMP('0');
    setInitialBalanceSMA('0');
    setInitialBalanceUmum('0');
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: Account) => {
    setIsEditing(true);
    setEditingAccountId(acc.id);
    setCode(acc.code);
    setName(acc.name);
    setCategory(acc.category);
    setSubCategory(acc.subCategory || '');
    setInitialBalance(String(acc.initialBalance || 0));
    setInitialBalanceSMP(String(acc.initialBalanceSMP || 0));
    setInitialBalanceSMA(String(acc.initialBalanceSMA || 0));
    setInitialBalanceUmum(String(acc.initialBalanceUmum || 0));
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!code.trim()) {
      setErrorMsg('Kode akun wajib diisi.');
      return;
    }
    if (!name.trim()) {
      setErrorMsg('Nama akun wajib diisi.');
      return;
    }
    if (!category) {
      setErrorMsg('Kategori akun wajib dipilih.');
      return;
    }

    try {
      // Validate code format (numbers only or standard alphanumeric)
      if (!/^[a-zA-Z0-9_\-]+$/.test(code.trim())) {
        setErrorMsg('Kode akun hanya boleh berisi huruf, angka, strip (-), atau underscore (_).');
        return;
      }

      // Check duplicate code
      const duplicateCode = accounts.some(acc => 
        acc.code === code.trim() && (!isEditing || acc.id !== editingAccountId)
      );
      if (duplicateCode) {
        setErrorMsg(`Kode akun "${code}" sudah dialokasikan untuk akun lain.`);
        return;
      }

      const valSMP = Number(initialBalanceSMP) || 0;
      const valSMA = Number(initialBalanceSMA) || 0;
      const valUmum = Number(initialBalanceUmum) || 0;
      const balanceValue = valSMP + valSMA + valUmum;

      const accountData = {
        code: code.trim(),
        name: name.trim(),
        category,
        subCategory: subCategory.trim(),
        initialBalance: balanceValue,
        initialBalanceSMP: valSMP,
        initialBalanceSMA: valSMA,
        initialBalanceUmum: valUmum,
        isDeletable: isEditing ? (accounts.find(a => a.id === editingAccountId)?.isDeletable ?? true) : true
      };

      if (isEditing && editingAccountId) {
        await updateAccount(editingAccountId, accountData);
        setSuccessMsg('Akun berhasil diperbarui!');
      } else {
        await createAccount(accountData);
        setSuccessMsg('Akun baru berhasil didaftarkan!');
      }

      // Refresh list and auto close modal after brief delay
      setTimeout(() => {
        setIsModalOpen(false);
        fetchAccounts();
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyimpan perubahan akun.');
    }
  };

  const handleDeleteTrigger = async (accId: string, accName: string) => {
    setAccountToDelete({ id: accId, name: accName });
    setDeleteError('');
    setHasTransactions(false);
    setTransactionCount(0);
    setDeleteConfirmOpen(true);

    try {
      const entries = await getJournalEntries();
      let count = 0;
      entries.forEach(entry => {
        if (entry.lines && Array.isArray(entry.lines)) {
          entry.lines.forEach(line => {
            if (line.accountId === accId) {
              count++;
            }
          });
        }
      });
      if (count > 0) {
        setHasTransactions(true);
        setTransactionCount(count);
      }
    } catch (e) {
      console.error('Gagal memeriksa transaksi untuk akun ini:', e);
    }
  };

  // ==========================================
  // EXPORT & IMPORT ENGINE ROUTINES (COA)
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
    const dataToExport = all ? accounts : filteredAccounts;
    if (dataToExport.length === 0) {
      alert("Tidak ada data bagan akun untuk diekspor.");
      return;
    }
    
    const headers = ["Kode Akun", "Nama Akun", "Kategori Utama", "Sub-Kategori", "Saldo Awal", "Saldo Awal SMP", "Saldo Awal SMA", "Saldo Awal Umum"];
    const rows = [headers];
    
    dataToExport.forEach(acc => {
      rows.push([
        acc.code,
        acc.name,
        acc.category,
        acc.subCategory || '',
        (acc.initialBalance || 0).toString(),
        (acc.initialBalanceSMP || 0).toString(),
        (acc.initialBalanceSMA || 0).toString(),
        (acc.initialBalanceUmum || 0).toString()
      ]);
    });
    
    const csvContent = "\uFEFF" + rows.map(r => r.map(val => {
      const clean = (val || '').replace(/"/g, '""');
      return `"${clean}"`;
    }).join(",")).join("\n");
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Ekspor_COA_${all ? 'Semua' : 'Terfilter'}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = (all: boolean) => {
    const dataToExport = all ? accounts : filteredAccounts;
    if (dataToExport.length === 0) {
      alert("Tidak ada data bagan akun untuk diekspor.");
      return;
    }

    const serializableData = dataToExport.map(acc => ({
      code: acc.code,
      name: acc.name,
      category: acc.category,
      subCategory: acc.subCategory || '',
      initialBalance: acc.initialBalance || 0,
      initialBalanceSMP: acc.initialBalanceSMP || 0,
      initialBalanceSMA: acc.initialBalanceSMA || 0,
      initialBalanceUmum: acc.initialBalanceUmum || 0
    }));

    const jsonContent = JSON.stringify(serializableData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Ekspor_COA_${all ? 'Semua' : 'Terfilter'}_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = ["Kode Akun", "Nama Akun", "Kategori Utama", "Sub-Kategori", "Saldo Awal"];
    const rows = [
      headers,
      ["1104", "Bank Indonesia (Syariah)", "Aset", "Kas & Bank", "5000000"],
      ["4104", "Pendapatan SBN Sekolah", "Pendapatan", "Pendapatan Lain", "0"],
      ["5302", "Beban Internet & Wifi", "Beban", "Beban Operasional", "150000"]
    ];

    const csvContent = "\uFEFF" + rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "bagan_akun_template.csv");
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
    setParsedAccounts([]);
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
        const tempParsedList: ParsedAccount[] = [];
        
        if (isCSV) {
          const csvRows = parseCSV(text);
          if (csvRows.length < 2) {
            setImportErrorMsg('File CSV kosong atau tidak memiliki data.');
            return;
          }
          
          const headers = csvRows[0].map(h => h.toLowerCase().replace(/[\ufeff\s_\-]/g, ''));
          const idxCode = headers.findIndex(h => h.includes('kode') || h.includes('code'));
          const idxName = headers.findIndex(h => h.includes('nama') || h.includes('name'));
          const idxCat = headers.findIndex(h => h.includes('kat') || h.includes('cat'));
          const idxSub = headers.findIndex(h => h.includes('sub'));
          const idxBal = headers.findIndex(h => h.includes('saldo') || h.includes('balance') || h.includes('awal'));
          const idxSMP = headers.findIndex(h => h.includes('smp'));
          const idxSMA = headers.findIndex(h => h.includes('sma'));
          const idxUmum = headers.findIndex(h => h.includes('umum'));
          
          if (idxCode === -1 || idxName === -1 || idxCat === -1) {
            setImportErrorMsg("Struktur kolom CSV salah. Pastikan memiliki kolom wajib: Kode Akun, Nama Akun, Kategori Utama.");
            return;
          }
          
          for (let i = 1; i < csvRows.length; i++) {
            const row = csvRows[i];
            if (row.length === 0 || row.join('').trim() === '') continue;
            
            const codeRaw = row[idxCode];
            const nameRaw = row[idxName];
            const catRaw = row[idxCat];
            const subCategory = idxSub !== -1 ? (row[idxSub] || '') : '';
            const balRaw = idxBal !== -1 ? row[idxBal] : '0';
            const initialBalance = parseFloat(balRaw?.replace(/[^0-9.\-]/g, '') || '0') || 0;
            
            const smpRaw = idxSMP !== -1 ? row[idxSMP] : '0';
            const smaRaw = idxSMA !== -1 ? row[idxSMA] : '0';
            const umumRaw = idxUmum !== -1 ? row[idxUmum] : '0';
            const valSMP = parseFloat(smpRaw?.replace(/[^0-9.\-]/g, '') || '0') || 0;
            const valSMA = parseFloat(smaRaw?.replace(/[^0-9.\-]/g, '') || '0') || 0;
            const valUmum = parseFloat(umumRaw?.replace(/[^0-9.\-]/g, '') || '0') || 0;
            
            let finalBal = initialBalance;
            if (idxSMP !== -1 || idxSMA !== -1 || idxUmum !== -1) {
              finalBal = valSMP + valSMA + valUmum;
            }
            
            // Normalize Category
            let category: AccountCategory = 'Aset';
            const catLower = catRaw?.toLowerCase() || '';
            if (catLower.includes('liab') || catLower.includes('hutang') || catLower.includes('kewajiban')) {
              category = 'Liabilitas';
            } else if (catLower.includes('ekui') || catLower.includes('modal') || catLower.includes('neto')) {
              category = 'Ekuitas';
            } else if (catLower.includes('pendap') || catLower.includes('terima') || catLower.includes('revenue')) {
              category = 'Pendapatan';
            } else if (catLower.includes('beb') || catLower.includes('belanja') || catLower.includes('biaya') || catLower.includes('expense')) {
              category = 'Beban';
            } else {
              category = 'Aset';
            }

            tempParsedList.push({
              code: codeRaw?.trim() || '',
              name: nameRaw?.trim() || '',
              category,
              subCategory: subCategory?.trim() || '',
              initialBalance: finalBal,
              initialBalanceSMP: valSMP,
              initialBalanceSMA: valSMA,
              initialBalanceUmum: valUmum,
              action: 'create',
              isValid: true,
              errors: []
            });
          }
        } else if (isJSON) {
          const parsedArray = JSON.parse(text);
          const arrayToProcess = Array.isArray(parsedArray) ? parsedArray : [parsedArray];
          
          arrayToProcess.forEach((item: any) => {
            let category: AccountCategory = 'Aset';
            const catLower = String(item.category || item.kategori || '').toLowerCase();
            if (catLower.includes('liab') || catLower.includes('hutang') || catLower.includes('kewajiban')) {
              category = 'Liabilitas';
            } else if (catLower.includes('ekui') || catLower.includes('modal') || catLower.includes('neto')) {
              category = 'Ekuitas';
            } else if (catLower.includes('pendap') || catLower.includes('terima') || catLower.includes('revenue')) {
              category = 'Pendapatan';
            } else if (catLower.includes('beb') || catLower.includes('belanja') || catLower.includes('biaya') || catLower.includes('expense')) {
              category = 'Beban';
            }

            const parsedSMP = Number(item.initialBalanceSMP || item.saldoAwalSMP || 0);
            const parsedSMA = Number(item.initialBalanceSMA || item.saldoAwalSMA || 0);
            const parsedUmum = Number(item.initialBalanceUmum || item.saldoAwalUmum || 0);
            let finalBal = Number(item.initialBalance || item.saldoAwal || 0);
            if (item.initialBalanceSMP !== undefined || item.initialBalanceSMA !== undefined || item.initialBalanceUmum !== undefined ||
                item.saldoAwalSMP !== undefined || item.saldoAwalSMA !== undefined || item.saldoAwalUmum !== undefined) {
              finalBal = parsedSMP + parsedSMA + parsedUmum;
            }

            tempParsedList.push({
              code: String(item.code || item.kodeAkun || item.kode || '').trim(),
              name: String(item.name || item.nameAkun || item.nama || item.namaAkun || '').trim(),
              category,
              subCategory: String(item.subCategory || item.subKategori || '').trim(),
              initialBalance: finalBal,
              initialBalanceSMP: parsedSMP,
              initialBalanceSMA: parsedSMA,
              initialBalanceUmum: parsedUmum,
              action: 'create',
              isValid: true,
              errors: []
            });
          });
        }
        
        // Validate
        tempParsedList.forEach(acc => {
          const errors: string[] = [];
          
          if (!acc.code) {
            errors.push("Kode akun kosong.");
          } else if (!/^[a-zA-Z0-9_\-]+$/.test(acc.code)) {
            errors.push(`Kode akun '${acc.code}' tidak valid (hanya boleh huruf, angka, strip, atau underscore).`);
          }
          
          if (!acc.name) {
            errors.push("Nama akun kosong.");
          }

          // Determine Action: Create or Update based on currently registered Accounts
          const existing = accounts.find(a => a.code.toLowerCase() === acc.code.toLowerCase());
          if (existing) {
            acc.action = 'update';
            acc.existingId = existing.id;
          } else {
            acc.action = 'create';
          }
          
          if (errors.length > 0) {
            acc.isValid = false;
            acc.errors = errors;
          }
        });
        
        setParsedAccounts(tempParsedList);
        if (tempParsedList.length === 0) {
          setImportErrorMsg('Tidak ada data akun yang dapat dibaca dlm file.');
        } else {
          const invalidCount = tempParsedList.filter(e => !e.isValid).length;
          if (invalidCount > 0) {
            setImportErrorMsg(`Ditemukan ${invalidCount} baris bermasalah dari total ${tempParsedList.length} entri bagan akun.`);
          }
        }
      } catch (err: any) {
        console.error(err);
        setImportErrorMsg('Gagal memproses file. Pastikan format tabel/struktur data valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const validOnes = parsedAccounts.filter(e => e.isValid);
    if (validOnes.length === 0) {
      alert("Tidak ada data bagan akun valid untuk diimpor.");
      return;
    }
    
    setImportLoading(true);
    setImportProgress({ current: 0, total: validOnes.length });
    
    let processedCount = 0;
    try {
      for (let i = 0; i < validOnes.length; i++) {
        const item = validOnes[i];
        
        const accountData = {
          code: item.code,
          name: item.name,
          category: item.category,
          subCategory: item.subCategory,
          initialBalance: item.initialBalance,
          initialBalanceSMP: item.initialBalanceSMP || 0,
          initialBalanceSMA: item.initialBalanceSMA || 0,
          initialBalanceUmum: item.initialBalanceUmum || 0,
          isDeletable: true
        };

        if (item.action === 'update' && item.existingId) {
          // Update / Sync
          await updateAccount(item.existingId, accountData);
        } else {
          // Create new
          await createAccount(accountData);
        }
        
        processedCount++;
        setImportProgress({ current: processedCount, total: validOnes.length });
      }
      
      setImportSuccessMsg(`Sukses! Berhasil mengimpor/singkronisasi ${processedCount} bagan akun secara langsung ke database.`);
      setParsedAccounts([]);
      fetchAccounts();
      setTimeout(() => {
        setImportSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setImportErrorMsg(`Gagal memproses impor bagan akun: ${err.message || 'Error internal'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!accountToDelete) return;
    setIsDeletingLoading(true);
    setDeleteError('');
    try {
      await deleteAccount(accountToDelete.id);
      setSuccessMsg(`Akun "${accountToDelete.name}" berhasil dihapus.`);
      setDeleteConfirmOpen(false);
      setAccountToDelete(null);
      fetchAccounts();
      setTimeout(() => {
        setSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.message || 'Gagal menghapus akun keuangan.');
    } finally {
      setIsDeletingLoading(false);
    }
  };

  const categories = [
    { name: 'Aset', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { name: 'Liabilitas', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { name: 'Ekuitas', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { name: 'Pendapatan', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { name: 'Beban', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    acc.code.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-natural-primary">Bagan Akun (COA)</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest mt-1">Struktur database akun keuangan sekolah</p>
        </div>
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => {
              setShowImportExport(!showImportExport);
            }}
            className={cn(
              "px-5 py-2.5 rounded-full flex items-center justify-center gap-2 transition-all font-semibold shadow-sm border text-sm w-full sm:w-auto cursor-pointer select-none",
              showImportExport 
                ? "bg-amber-50 text-amber-700 border-amber-200" 
                : "bg-white border-natural-border text-slate-700 hover:bg-slate-50"
            )}
          >
            <FileSpreadsheet className="w-4 h-4 shrink-0" />
            Ekspor & Impor
          </button>
          
          <button 
            onClick={handleOpenAdd}
            className="px-6 py-2.5 bg-natural-primary text-white hover:opacity-90 rounded-full flex items-center justify-center gap-2 transition-all font-semibold shadow-sm text-sm w-full sm:w-auto cursor-pointer select-none"
          >
            <Plus className="w-4 h-4" /> 
            Tambah Akun
          </button>
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
            <div className="bg-gradient-to-br from-slate-50 to-white p-6 rounded-3xl border border-natural-border shadow-md grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Export Panel */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                    <FileDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif italic font-bold text-slate-850 text-base">Ekspor Bagan Akun</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Tarik bagan akun dalam format file spreadsheet (.csv) atau database (.json)</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Ekspor daftar bagan akun Anda ke dalam format CSV untuk dianalisis di Excel atau diolah ke sistem laporan keuangan lainnya.
                </p>

                <div className="bg-white/80 border border-slate-100 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
                  {/* Status counts */}
                  <div className="text-xs space-y-1 w-full sm:w-auto text-left">
                    <div className="flex justify-between sm:justify-start gap-3">
                      <span className="text-slate-400">Total Akun Terdaftar:</span>
                      <span className="font-bold text-slate-700 font-mono">{accounts.length} akun</span>
                    </div>
                    <div className="flex justify-between sm:justify-start gap-3">
                      <span className="text-slate-400">Terfilter di layar sekarang:</span>
                      <span className="font-bold text-natural-primary font-mono">{filteredAccounts.length} akun</span>
                    </div>
                  </div>

                  {/* Buttons group */}
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExportCSV(true)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs bg-emerald-600 hover:bg-emerald-700 font-semibold text-white rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> CSV (Semua)
                      </button>
                      <button
                        onClick={() => handleExportCSV(false)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 font-semibold text-emerald-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        CSV (Terfilter)
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleExportJSON(true)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs bg-slate-800 hover:bg-slate-900 font-semibold text-white rounded-xl shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <FileJson className="w-3.5 h-3.5" /> JSON (Semua)
                      </button>
                      <button
                        onClick={() => handleExportJSON(false)}
                        className="flex-1 sm:flex-none px-4 py-2 text-xs bg-slate-50 border border-slate-205 hover:bg-slate-100 font-semibold text-slate-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        JSON (Terfilter)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Import Panel */}
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                      <FileUp className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-serif italic font-bold text-slate-855 text-base">Impor Bagan Akun</h3>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Unggah dokumen untuk sinkronisasi bagan akun instan</p>
                    </div>
                  </div>
                  <button
                    onClick={handleDownloadTemplate}
                    className="text-[10px] text-indigo-750 hover:underline uppercase tracking-widest font-bold font-mono cursor-pointer flex items-center gap-1 shrink-0"
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
                      : "border-slate-250 bg-white hover:border-slate-350"
                  )}
                >
                  <input
                    type="file"
                    accept=".csv,.json"
                    id="import-coa-file-selector"
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
            </div>

            {/* Parsing Review Panel / Importer Preview Table */}
            {parsedAccounts.length > 0 && (
              <div className="mt-4 bg-white border border-natural-border rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <h4 className="font-serif italic font-bold text-slate-855 text-base">Tinjau Validasi Transaksi Impor Bagan Akun</h4>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono font-semibold">
                      Terbaca: <b className="text-slate-800 font-bold font-mono">{parsedAccounts.length}</b> Akun • Baru (Tambah): <b className="text-emerald-700 font-bold font-mono">{parsedAccounts.filter(p => p.isValid && p.action === 'create').length}</b> • Sinkron (Update): <b className="text-blue-700 font-bold font-mono">{parsedAccounts.filter(p => p.isValid && p.action === 'update').length}</b> • Bermasalah: <b className="text-rose-600 font-bold font-mono">{parsedAccounts.filter(p => !p.isValid).length}</b>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => setParsedAccounts([])}
                      className="flex-1 sm:flex-none px-4 py-2 text-xs bg-slate-50 border border-slate-205 hover:bg-slate-100 text-slate-600 font-semibold rounded-lg transition-colors cursor-pointer text-center"
                    >
                      Bersihkan
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={importLoading || parsedAccounts.filter(p => p.isValid).length === 0}
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
                          <span>Proses Impor {parsedAccounts.filter(p => p.isValid).length} Entri Valid</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                  {parsedAccounts.map((pa, idx) => (
                    <div key={idx} className="p-3 bg-slate-50/30 flex flex-col md:flex-row justify-between items-start gap-4 text-xs font-sans">
                      <div className="space-y-1 flex-1 text-left">
                        <div className="flex items-center gap-2">
                          {!pa.isValid ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse" title="Perlu Koreksi" />
                          ) : pa.action === 'update' ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" title="Sinkron / Update Akun Terdaftar" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="Akun Baru" />
                          )}
                          <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            {pa.code || 'Tanpa Kode'}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">{pa.name || 'Nama Kosong'}</span>
                          
                          <span className={cn(
                            "text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border shrink-0",
                            pa.category === 'Aset' ? 'bg-blue-50/50 border-blue-200 text-blue-700' :
                            pa.category === 'Liabilitas' ? 'bg-amber-50/50 border-amber-200 text-amber-700' :
                            pa.category === 'Ekuitas' ? 'bg-purple-50/50 border-purple-200 text-purple-700' :
                            pa.category === 'Pendapatan' ? 'bg-emerald-50/50 border-emerald-200 text-emerald-700' :
                            'bg-rose-50/50 border-rose-200 text-rose-700'
                          )}>
                            {pa.category}
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-slate-400">
                          Sub-Kategori: <strong className="text-slate-600">{pa.subCategory || '-'}</strong> • Saldo Awal: <strong className="text-slate-600">{formatRupiah(pa.initialBalance)}</strong>
                        </div>
                        
                        {/* Errors report */}
                        {!pa.isValid && (
                          <div className="space-y-1 mt-1 bg-rose-50 border border-rose-100 text-rose-700 p-2.5 rounded-xl text-[10px] font-medium leading-relaxed max-w-lg">
                            {pa.errors.map((err, eIdx) => (
                              <div key={eIdx} className="flex gap-1 items-start">
                                <span className="text-rose-500 shrink-0">•</span>
                                <span>{err}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action plan summary */}
                      <div className="text-right shrink-0">
                        {pa.isValid && (
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono tracking-wider border",
                            pa.action === 'update' 
                              ? "bg-blue-50 text-blue-700 border-blue-200" 
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            {pa.action === 'update' ? 'Sinkron/Update' : 'Akun Baru'}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white p-4 rounded-2xl border border-natural-border shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-gray-400 ml-2" />
        <input 
          type="text" 
          placeholder="Cari kode atau nama akun..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 bg-transparent outline-none text-natural-text text-sm p-2"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {categories.map(cat => (
          <div key={cat.name} className="bg-white p-5 rounded-2xl border border-natural-border shadow-sm">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{cat.name}</p>
            <p className="text-xl font-serif text-natural-primary">
              {accounts.filter(a => a.category === cat.name).length} <span className="text-[10px] font-sans font-bold text-gray-300 uppercase">Akun</span>
            </p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-natural-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-550 italic">Memuat daftar bagan akun...</div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50/50 border-b border-natural-border text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <th className="px-6 py-5">Kode</th>
                <th className="px-6 py-5">Nama Akun</th>
                <th className="px-6 py-5">Kategori</th>
                <th className="px-6 py-5">Sub-Kategori</th>
                <th className="px-6 py-5 text-right">Saldo Awal</th>
                <th className="px-6 py-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map((acc) => (
                <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-slate-500 font-semibold">{acc.code}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{acc.name}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      categories.find(c => c.name === acc.category)?.color
                    )}>
                      {acc.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{acc.subCategory || '-'}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="font-mono text-sm font-semibold text-slate-800">{formatRupiah(acc.initialBalance)}</div>
                    {(acc.initialBalanceSMP || acc.initialBalanceSMA || acc.initialBalanceUmum) ? (
                      <div className="text-[10px] text-gray-400 mt-1 space-y-0.5 font-sans leading-none">
                        {acc.initialBalanceSMP ? <div className="font-mono">SMP: {formatRupiah(acc.initialBalanceSMP)}</div> : null}
                        {acc.initialBalanceSMA ? <div className="font-mono">SMA: {formatRupiah(acc.initialBalanceSMA)}</div> : null}
                        {acc.initialBalanceUmum ? <div className="font-mono">Umum: {formatRupiah(acc.initialBalanceUmum)}</div> : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(acc)}
                        className="p-1.5 hover:bg-natural-bg rounded-lg text-natural-primary hover:scale-105 transition-all shadow-sm border border-neutral-100 bg-white inline-flex"
                        title="Edit Akun"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTrigger(acc.id, `${acc.code} - ${acc.name}`)}
                        className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-600 hover:scale-105 transition-all shadow-sm border border-neutral-100 bg-white inline-flex"
                        title="Hapus Akun"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredAccounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Tidak ada akun yang sesuai pencarian.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Account Input / Edit Modal overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-natural-border shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="p-6 border-b border-natural-border bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-serif italic text-natural-primary">
                    {isEditing ? 'Ubah Akun Keuangan' : 'Registrasi Akun Baru'}
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {isEditing ? 'Perbarui Atribut Akun yang Dipilih' : 'Formulir Bagan Akun Baru'}
                  </p>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-150 rounded-full text-slate-400 hover:text-slate-650 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs rounded-xl flex items-center gap-2 animate-pulse">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{successMsg}</span>
                  </div>
                )}

                 <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Kode Akun</label>
                    <input
                      type="text"
                      placeholder="Mis: 1104"
                      required
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Kategori Utama</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as AccountCategory)}
                      className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40"
                    >
                      <option value="Aset">Aset</option>
                      <option value="Liabilitas">Liabilitas</option>
                      <option value="Ekuitas">Ekuitas</option>
                      <option value="Pendapatan">Pendapatan</option>
                      <option value="Beban">Beban</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Nama Akun</label>
                  <input
                    type="text"
                    placeholder="Mis: Dana Kas Operasional"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Sub-Kategori</label>
                  <input
                    type="text"
                    placeholder="Mis: Kas & Bank"
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full px-4 py-2.5 text-sm border border-natural-border rounded-xl focus:ring-2 focus:ring-natural-primary outline-none bg-slate-50/40"
                  />
                </div>

                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 font-sans">Pemisahan Saldo Awal per Unit</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Unit SMP (RP)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={initialBalanceSMP}
                        onChange={(e) => setInitialBalanceSMP(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-natural-border rounded-xl focus:ring-1 focus:ring-natural-primary outline-none bg-white text-right font-mono"
                        id="balance-smp-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Unit SMA (RP)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={initialBalanceSMA}
                        onChange={(e) => setInitialBalanceSMA(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-natural-border rounded-xl focus:ring-1 focus:ring-natural-primary outline-none bg-white text-right font-mono"
                        id="balance-sma-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Unit Umum (RP)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={initialBalanceUmum}
                        onChange={(e) => setInitialBalanceUmum(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-natural-border rounded-xl focus:ring-1 focus:ring-natural-primary outline-none bg-white text-right font-mono"
                        id="balance-umum-input"
                      />
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-150/50 font-sans">
                    <span className="text-slate-400">Total Saldo Awal Gabungan:</span>
                    <strong className="text-slate-850 font-semibold font-mono text-sm">
                      {formatRupiah((Number(initialBalanceSMP) || 0) + (Number(initialBalanceSMA) || 0) + (Number(initialBalanceUmum) || 0))}
                    </strong>
                  </div>
                </div>

                <div className="pt-6 border-t border-natural-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 border border-natural-border rounded-full text-xs font-bold uppercase tracking-wider text-slate-550 hover:bg-slate-50 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-natural-primary hover:opacity-95 text-white rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md"
                  >
                    <Save className="w-3.5 h-3.5" /> Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal overlay */}
      <AnimatePresence>
        {deleteConfirmOpen && accountToDelete && (
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
                  <h3 className="text-lg font-serif italic text-rose-700">Konfirmasi Penghapusan</h3>
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
                  Apakah Anda benar-benar yakin ingin menghapus akun keuangan berikut dari database sekolah?
                </p>

                <div className="bg-natural-bg/60 border border-natural-border p-4 rounded-2xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Akun Terpilih</p>
                  <p className="font-serif font-medium text-natural-primary text-base">
                    {accountToDelete.name}
                  </p>
                </div>

                {hasTransactions && (
                  <div className="p-3.5 bg-amber-50 border border-amber-255 text-amber-900 text-xs rounded-xl flex flex-col gap-1.5 font-sans leading-relaxed">
                    <div className="flex items-center gap-2 font-bold text-amber-950 uppercase tracking-wider text-[10px]">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>PERINGATAN TRANSAKSI AKTIF</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Akun ini terdeteksi memiliki dan digunakan dalam <strong className="font-bold text-amber-950">{transactionCount} baris jurnal aktif</strong>. 
                      Menghapusnya akan memutus kaitan akun ini dengan transaksi terkait, namun data transaksi historis aslinya akan dipertahankan dengan nama teks cadangannya di Buku Besar dan Laporan lainnya.
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-natural-border flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirmOpen(false);
                      setAccountToDelete(null);
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
                    {isDeletingLoading ? 'Menghapus...' : 'Hapus Akun'}
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
