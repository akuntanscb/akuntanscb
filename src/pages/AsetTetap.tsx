import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  FileText, 
  X, 
  History, 
  Sliders,
  AlertCircle,
  PiggyBank,
  ArrowRight,
  ChevronRight,
  Info,
  FileDown,
  FileUp,
  FileSpreadsheet,
  FileJson,
  Upload,
  Download,
  Save,
  Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useUserRole } from '../context/UserRoleContext';
import { getFixedAssets, createFixedAsset, updateFixedAsset, deleteFixedAsset, postAssetDepreciation } from '../services/fixedAssetService';
import { getAccounts } from '../services/accountService';
import { FixedAsset, DepreciationLog, Account } from '../types';
import { auth } from '../lib/firebase';
import { formatRupiah, cn } from '../lib/utils';

interface ParsedFixedAsset {
  code: string;
  name: string;
  purchaseDateStr: string;
  purchaseCost: number;
  usefulLife: number;
  residualValue: number;
  depreciationMethod: 'straight_line' | 'double_declining';
  assetAccountCodeOrName?: string;
  deprExpenseAccountCodeOrName?: string;
  accumDeprAccountCodeOrName?: string;
  remarks: string;
  schoolUnit: 'SMP' | 'SMA' | 'Umum';
  isValid: boolean;
  errors: string[];
  action: 'create' | 'update';
  existingId?: string;
}

export default function AsetTetap() {
  const { hasPermission, isUnitAllowed, userRole } = useUserRole();
  const isViewer = userRole?.role === 'viewer';

  if (!hasPermission('canFixedAssets')) {
    return (
      <div className="bg-white rounded-2xl border border-rose-100 p-8 text-center max-w-md mx-auto my-12 shadow-sm font-sans">
        <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-900 mb-2">Akses Ditolak</h3>
        <p className="text-sm text-slate-500">Anda tidak memiliki hak istimewa (canFixedAssets) untuk melihat atau mengelola Aset Tetap.</p>
      </div>
    );
  }

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Import / Export engine states
  const [showImportExport, setShowImportExport] = useState<boolean>(false);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importProgress, setImportProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [importSuccessMsg, setImportSuccessMsg] = useState<string>('');
  const [importErrorMsg, setImportErrorMsg] = useState<string>('');
  const [parsedAssets, setParsedAssets] = useState<ParsedFixedAsset[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | 'Aktif' | 'Dilepas'>('Semua');
  const [unitFilter, setUnitFilter] = useState<'all' | 'SMP' | 'SMA' | 'Umum'>('all');

  // Modal states
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [isDeprOpen, setIsDeprOpen] = useState<boolean>(false);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [isDisposeOpen, setIsDisposeOpen] = useState<boolean>(false);

  // Selected entities for actions
  const [selectedAsset, setSelectedAsset] = useState<FixedAsset | null>(null);

  // Form states for Add / Edit
  const [formId, setFormId] = useState<string>('');
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formPurchaseDate, setFormPurchaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formPurchaseCost, setFormPurchaseCost] = useState<number>(0);
  const [formUsefulLife, setFormUsefulLife] = useState<number>(4); // default 4 years
  const [formResidualValue, setFormResidualValue] = useState<number>(0);
  const [formMethod, setFormMethod] = useState<'straight_line' | 'double_declining'>('straight_line');
  const [formAssetAccount, setFormAssetAccount] = useState<string>('');
  const [formDeprExpenseAccount, setFormDeprExpenseAccount] = useState<string>('');
  const [formAccumDeprAccount, setFormAccumDeprAccount] = useState<string>('');
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formSchoolUnit, setFormSchoolUnit] = useState<'SMP' | 'SMA' | 'Umum'>('Umum');
  const [formError, setFormError] = useState<string>('');

  // Form states for Posting Depreciation
  const [deprAmount, setDeprAmount] = useState<number>(0);
  const [deprDate, setDeprDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [deprNotes, setDeprNotes] = useState<string>('');
  const [deprError, setDeprError] = useState<string>('');

  // Form states for Disposal
  const [disposeDate, setDisposeDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [disposePrice, setDisposePrice] = useState<number>(0);
  const [disposeRemarks, setDisposeRemarks] = useState<string>('');
  const [disposeError, setDisposeError] = useState<string>('');

  // Load baseline data on mount
  const loadData = async () => {
    setLoading(true);
    try {
      const assetsList = await getFixedAssets();
      setAssets(assetsList);
      
      const accountsList = await getAccounts();
      setAccounts(accountsList);

      // Pre-fill default account states if list is present
      const assetAccs = accountsList.filter(a => a.category === 'Aset' && a.subCategory.toLowerCase().includes('tetap'));
      const deprAccs = accountsList.filter(a => a.category === 'Beban' && a.name.toLowerCase().includes('penyusutan'));
      const accumAccs = accountsList.filter(a => a.category === 'Aset' && a.name.toLowerCase().includes('akumulasi'));

      if (assetAccs.length > 0 && !formAssetAccount) {
        setFormAssetAccount(assetAccs[0].id);
      }
      if (deprAccs.length > 0 && !formDeprExpenseAccount) {
        setFormDeprExpenseAccount(deprAccs[0].id);
      }
      if (accumAccs.length > 0 && !formAccumDeprAccount) {
        setFormAccumDeprAccount(accumAccs[0].id);
      }
    } catch (err) {
      console.error("Gagal memuat data aset tetap", err);
      setError("Gagal memuat data akuntansi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Utility to convert dates safely
  const toJSDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp instanceof Date) return timestamp;
    if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    return new Date(timestamp);
  };

  // Safe formatting of dates
  const formatDateString = (timestamp: any): string => {
    const d = toJSDate(timestamp);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Helper helper to filter options in COA selectors
  const getAssetAccountOptions = () => accounts.filter(a => a.category === 'Aset');
  const getBebanAccountOptions = () => accounts.filter(a => a.category === 'Beban');

  const showToast = (message: string, isError: boolean = false) => {
    if (isError) {
      setError(message);
      setTimeout(() => setError(''), 4500);
    } else {
      setSuccessMsg(message);
      setTimeout(() => setSuccessMsg(''), 4000);
    }
  };

  // ==========================================
  // EXPORT & IMPORT ENGINE ROUTINES (FIXED ASSET)
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
    const dataToExport = all ? assets : filteredAssets;
    if (dataToExport.length === 0) {
      alert("Tidak ada data inventaris aset tetap untuk diekspor.");
      return;
    }
    
    const headers = [
      "Kode Aset", 
      "Nama Barang", 
      "Tanggal Perolehan", 
      "Harga Perolehan", 
      "Masa Manfaat (Tahun)", 
      "Nilai Residu", 
      "Metode Penyusutan", 
      "Unit Sekolah", 
      "Keterangan", 
      "Kode Akun Aset", 
      "Nama Akun Aset", 
      "Kode Beban Penyusutan", 
      "Nama Beban Penyusutan", 
      "Kode Akumulasi Penyusutan", 
      "Nama Akumulasi Penyusutan", 
      "Status"
    ];
    
    const rows = [headers];
    
    dataToExport.forEach(item => {
      const pDate = toJSDate(item.purchaseDate);
      const dateStr = pDate.toISOString().split('T')[0];
      rows.push([
        item.code,
        item.name,
        dateStr,
        item.purchaseCost.toString(),
        item.usefulLife.toString(),
        item.residualValue.toString(),
        item.depreciationMethod,
        item.schoolUnit || 'Umum',
        item.remarks || '',
        accounts.find(a => a.id === item.assetAccountId)?.code || '',
        item.assetAccountName || '',
        accounts.find(a => a.id === item.deprExpenseAccountId)?.code || '',
        item.deprExpenseAccountName || '',
        accounts.find(a => a.id === item.accumDeprAccountId)?.code || '',
        item.accumDeprAccountName || '',
        item.status || 'Aktif'
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
    link.setAttribute("download", `Ekspor_Aset_Tetap_${all ? 'Semua' : 'Terfilter'}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = (all: boolean) => {
    const dataToExport = all ? assets : filteredAssets;
    if (dataToExport.length === 0) {
      alert("Tidak ada data inventaris aset tetap untuk diekspor.");
      return;
    }

    const serializableData = dataToExport.map(item => {
      const pDate = toJSDate(item.purchaseDate);
      return {
        code: item.code,
        name: item.name,
        purchaseDate: pDate.toISOString().split('T')[0],
        purchaseCost: item.purchaseCost,
        usefulLife: item.usefulLife,
        residualValue: item.residualValue,
        depreciationMethod: item.depreciationMethod,
        schoolUnit: item.schoolUnit || 'Umum',
        remarks: item.remarks || '',
        assetAccountCode: accounts.find(a => a.id === item.assetAccountId)?.code || '',
        assetAccountName: item.assetAccountName,
        deprExpenseAccountCode: accounts.find(a => a.id === item.deprExpenseAccountId)?.code || '',
        deprExpenseAccountName: item.deprExpenseAccountName,
        accumDeprAccountCode: accounts.find(a => a.id === item.accumDeprAccountId)?.code || '',
        accumDeprAccountName: item.accumDeprAccountName,
        status: item.status || 'Aktif'
      };
    });

    const jsonContent = JSON.stringify(serializableData, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Ekspor_Aset_Tetap_${all ? 'Semua' : 'Terfilter'}_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      "Kode Aset", 
      "Nama Barang", 
      "Tanggal Perolehan", 
      "Harga Perolehan", 
      "Masa Manfaat (Tahun)", 
      "Nilai Residu", 
      "Metode Penyusutan", 
      "Unit Sekolah", 
      "Keterangan", 
      "Kode Akun Aset", 
      "Kode Beban Penyusutan", 
      "Kode Akumulasi Penyusutan"
    ];
    
    const assetAccs = accounts.filter(a => a.category === 'Aset' && a.subCategory.toLowerCase().includes('tetap'));
    const deprAccs = accounts.filter(a => a.category === 'Beban' && a.name.toLowerCase().includes('penyusutan'));
    const accumAccs = accounts.filter(a => a.category === 'Aset' && a.name.toLowerCase().includes('akumulasi'));

    const codeAssetDefault = assetAccs[0]?.code || "1201";
    const codeDeprDefault = deprAccs[0]?.code || "5301";
    const codeAccumDefault = accumAccs[0]?.code || "1251";

    const rows = [
      headers,
      ["AST-006", "Laptop ASUS Core i7", "2026-01-15", "12500000", "4", "500000", "straight_line", "SMP", "Pembelian Hibah", codeAssetDefault, codeDeprDefault, codeAccumDefault],
      ["AST-007", "AC LG 2 PK Masjid SCB", "2026-03-10", "6500000", "5", "0", "double_declining", "Umum", "Operasional Masjid", codeAssetDefault, codeDeprDefault, codeAccumDefault],
      ["AST-008", "Meja Belajar Kelas", "2026-05-18", "4500000", "4", "0", "straight_line", "SMA", "Kelas XII IPS", codeAssetDefault, codeDeprDefault, codeAccumDefault]
    ];

    const csvContent = "\uFEFF" + rows.map(r => r.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "template_inventaris_aset_tetap.csv");
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
    setParsedAssets([]);
    
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
        const tempParsedList: ParsedFixedAsset[] = [];
        
        const assetAccs = accounts.filter(a => a.category === 'Aset' && a.subCategory.toLowerCase().includes('tetap'));
        const deprAccs = accounts.filter(a => a.category === 'Beban' && a.name.toLowerCase().includes('penyusutan'));
        const accumAccs = accounts.filter(a => a.category === 'Aset' && a.name.toLowerCase().includes('akumulasi'));
        
        const defaultAssetAcc = assetAccs[0] || null;
        const defaultDeprAcc = deprAccs[0] || null;
        const defaultAccumAcc = accumAccs[0] || null;

        if (isCSV) {
          const csvRows = parseCSV(text);
          if (csvRows.length < 2) {
            setImportErrorMsg('File CSV kosong atau tidak memiliki data.');
            return;
          }
          
          const headers = csvRows[0].map(h => h.toLowerCase().replace(/[\ufeff\s_\-()]/g, ''));
          
          const idxCode = headers.findIndex(h => h.includes('kode') || h.includes('code'));
          const idxName = headers.findIndex(h => h.includes('nama') || h.includes('name') || h.includes('barang'));
          const idxDate = headers.findIndex(h => h.includes('tgl') || h.includes('tanggal') || h.includes('date') || h.includes('perolehan'));
          const idxCost = headers.findIndex(h => h.includes('harga') || h.includes('cost') || h.includes('nilaiperolehan') || h.includes('nilaiawal'));
          const idxLife = headers.findIndex(h => h.includes('manfaat') || h.includes('life') || h.includes('tahun'));
          const idxRes = headers.findIndex(h => h.includes('residu') || h.includes('residual') || h.includes('sisa'));
          const idxMethod = headers.findIndex(h => h.includes('metode') || h.includes('method') || h.includes('penyusutan'));
          const idxUnit = headers.findIndex(h => h.includes('unit') || h.includes('sekolah'));
          const idxRemarks = headers.findIndex(h => h.includes('ket') || h.includes('keterangan') || h.includes('remarks') || h.includes('memo'));
          const idxAccAsset = headers.findIndex(h => h.includes('akunaset') || h.includes('assetaccount') || h.includes('kodeakunaset'));
          const idxAccDepr = headers.findIndex(h => h.includes('akunbeban') || h.includes('deprexpense') || h.includes('akunpenyusutan') || h.includes('bebanpenyusutan'));
          const idxAccAccum = headers.findIndex(h => h.includes('akunakumulasi') || h.includes('accumdepr') || h.includes('akumulasipenyusutan'));

          if (idxName === -1 || idxCost === -1) {
            setImportErrorMsg("Struktur kolom CSV salah. Pastikan memiliki kolom wajib: Nama Barang, Harga Perolehan.");
            return;
          }
          
          for (let i = 1; i < csvRows.length; i++) {
            const row = csvRows[i];
            if (row.length === 0 || row.join('').trim() === '') continue;
            
            const rawCode = idxCode !== -1 ? (row[idxCode] || '').trim() : '';
            const code = rawCode || `AST-${String(Date.now()).slice(-4)}-${i}`;
            const name = idxName !== -1 ? (row[idxName] || '').trim() : '';
            const purchaseDateStr = idxDate !== -1 ? (row[idxDate] || '').trim() : new Date().toISOString().split('T')[0];
            const purchaseCost = parseFloat((idxCost !== -1 ? row[idxCost] : '0').replace(/[^0-9.-]/g, '')) || 0;
            const usefulLife = parseInt((idxLife !== -1 ? row[idxLife] : '4').replace(/[^0-9]/g, '')) || 4;
            const residualValue = parseFloat((idxRes !== -1 ? row[idxRes] : '0').replace(/[^0-9.-]/g, '')) || 0;
            
            let depreciationMethod: 'straight_line' | 'double_declining' = 'straight_line';
            if (idxMethod !== -1) {
              const mStr = (row[idxMethod] || '').toLowerCase();
              if (mStr.includes('double') || mStr.includes('declining') || mStr.includes('menurun')) {
                depreciationMethod = 'double_declining';
              }
            }
            
            let schoolUnit: 'SMP' | 'SMA' | 'Umum' = 'Umum';
            if (idxUnit !== -1) {
              const uStr = (row[idxUnit] || '').toUpperCase();
              if (uStr.includes('SMP')) schoolUnit = 'SMP';
              else if (uStr.includes('SMA')) schoolUnit = 'SMA';
            }
            
            const remarks = idxRemarks !== -1 ? (row[idxRemarks] || '').trim() : '';
            const assetCodeOrName = idxAccAsset !== -1 ? (row[idxAccAsset] || '').trim() : '';
            const deprCodeOrName = idxAccDepr !== -1 ? (row[idxAccDepr] || '').trim() : '';
            const accumCodeOrName = idxAccAccum !== -1 ? (row[idxAccAccum] || '').trim() : '';

            const errors: string[] = [];
            if (!name) errors.push("Nama barang wajib diisi.");
            if (purchaseCost <= 0) errors.push("Harga perolehan harus lebih besar dari 0.");
            if (usefulLife <= 0) errors.push("Masa manfaat minimal 1 tahun.");
            if (residualValue < 0) errors.push("Nilai residu tidak boleh negatif.");
            if (residualValue >= purchaseCost) errors.push("Nilai residu tidak boleh melebihi atau sama dengan harga perolehan.");

            let isValidDate = true;
            try {
              const d = new Date(purchaseDateStr);
              if (isNaN(d.getTime())) isValidDate = false;
            } catch {
              isValidDate = false;
            }
            if (!isValidDate) errors.push(`Format tanggal perolehan tidak valid: '${purchaseDateStr}'. Gunakan YYYY-MM-DD.`);

            const findAccount = (codeOrName: string, category: 'Aset' | 'Beban', defaultAcc: any) => {
              if (!codeOrName) return defaultAcc;
              const clean = codeOrName.trim().toLowerCase();
              let matched = accounts.find(a => a.code.toLowerCase() === clean);
              if (!matched) {
                matched = accounts.find(a => a.name.toLowerCase() === clean);
              }
              if (!matched) {
                matched = accounts.find(a => a.category === category && a.name.toLowerCase().includes(clean));
              }
              return matched || defaultAcc;
            };

            const assetAcc = findAccount(assetCodeOrName, 'Aset', defaultAssetAcc);
            const deprAcc = findAccount(deprCodeOrName, 'Beban', defaultDeprAcc);
            const accumAcc = findAccount(accumCodeOrName, 'Aset', defaultAccumAcc);

            if (!assetAcc) errors.push("Akun COA Aset Tetap tidak terdeteksi.");
            if (!deprAcc) errors.push("Akun COA Beban Penyusutan tidak terdeteksi.");
            if (!accumAcc) errors.push("Akun COA Akumulasi Penyusutan tidak terdeteksi.");

            const existingAsset = assets.find(a => a.code === code);
            const action = existingAsset ? 'update' : 'create';

            tempParsedList.push({
              code,
              name,
              purchaseDateStr,
              purchaseCost,
              usefulLife,
              residualValue,
              depreciationMethod,
              schoolUnit,
              remarks,
              assetAccountCodeOrName: assetAcc?.code || '',
              deprExpenseAccountCodeOrName: deprAcc?.code || '',
              accumDeprAccountCodeOrName: accumAcc?.code || '',
              isValid: errors.length === 0,
              errors,
              action,
              existingId: existingAsset?.id
            });
          }
        } else if (isJSON) {
          const parsedArray = JSON.parse(text);
          const arrayToProcess = Array.isArray(parsedArray) ? parsedArray : [parsedArray];
          
          arrayToProcess.forEach((item: any, iIdx: number) => {
            const rawCode = String(item.code || item.kode || item.kodeAset || '').trim();
            const code = rawCode || `AST-${String(Date.now()).slice(-4)}-${iIdx}`;
            const name = String(item.name || item.nama || item.namaBarang || '').trim();
            const purchaseDateStr = String(item.purchaseDate || item.tanggalPerolehan || item.tanggal || '').trim() || new Date().toISOString().split('T')[0];
            const purchaseCost = Number(item.purchaseCost || item.hargaPerolehan || item.harga || 0);
            const usefulLife = Number(item.usefulLife || item.masaManfaat || item.masaManfaatTahun || 4);
            const residualValue = Number(item.residualValue || item.nilaiResidu || 0);
            
            let depreciationMethod: 'straight_line' | 'double_declining' = 'straight_line';
            const mStr = String(item.depreciationMethod || item.metodePenyusutan || item.metode || '').toLowerCase();
            if (mStr.includes('double') || mStr.includes('declining') || mStr.includes('menurun')) {
              depreciationMethod = 'double_declining';
            }

            let schoolUnit: 'SMP' | 'SMA' | 'Umum' = 'Umum';
            const uStr = String(item.schoolUnit || item.unitSekolah || item.unit || '').toUpperCase();
            if (uStr.includes('SMP')) schoolUnit = 'SMP';
            else if (uStr.includes('SMA')) schoolUnit = 'SMA';

            const remarks = String(item.remarks || item.keterangan || item.memo || '').trim();
            const assetCodeOrName = String(item.assetAccountCode || item.kodeAkunAset || item.assetAccountName || item.akunAset || '');
            const deprCodeOrName = String(item.deprExpenseAccountCode || item.kodeBebanPenyusutan || item.deprExpenseAccountName || item.bebanPenyusutan || '');
            const accumCodeOrName = String(item.accumDeprAccountCode || item.kodeAkumulasiPenyusutan || item.accumDeprAccountName || item.akumulasiPenyusutan || '');

            const errors: string[] = [];
            if (!name) errors.push("Nama barang wajib diisi.");
            if (purchaseCost <= 0) errors.push("Harga perolehan harus lebih besar dari 0.");
            if (usefulLife <= 0) errors.push("Masa manfaat minimal 1 tahun.");
            if (residualValue < 0) errors.push("Nilai residu tidak boleh negatif.");
            if (residualValue >= purchaseCost) errors.push("Nilai residu tidak boleh melebihi atau sama dengan harga perolehan.");

            let isValidDate = true;
            try {
              const d = new Date(purchaseDateStr);
              if (isNaN(d.getTime())) isValidDate = false;
            } catch {
              isValidDate = false;
            }
            if (!isValidDate) errors.push(`Format tanggal perolehan tidak valid: '${purchaseDateStr}'. Gunakan YYYY-MM-DD.`);

            const findAccount = (codeOrName: string, category: 'Aset' | 'Beban', defaultAcc: any) => {
              if (!codeOrName) return defaultAcc;
              const clean = codeOrName.trim().toLowerCase();
              let matched = accounts.find(a => a.code.toLowerCase() === clean);
              if (!matched) {
                matched = accounts.find(a => a.name.toLowerCase() === clean);
              }
              if (!matched) {
                matched = accounts.find(a => a.category === category && a.name.toLowerCase().includes(clean));
              }
              return matched || defaultAcc;
            };

            const assetAcc = findAccount(assetCodeOrName, 'Aset', defaultAssetAcc);
            const deprAcc = findAccount(deprCodeOrName, 'Beban', defaultDeprAcc);
            const accumAcc = findAccount(accumCodeOrName, 'Aset', defaultAccumAcc);

            if (!assetAcc) errors.push("Akun COA Aset Tetap tidak terdeteksi.");
            if (!deprAcc) errors.push("Akun COA Beban Penyusutan tidak terdeteksi.");
            if (!accumAcc) errors.push("Akun COA Akumulasi Penyusutan tidak terdeteksi.");

            const existingAsset = assets.find(a => a.code === code);
            const action = existingAsset ? 'update' : 'create';

            tempParsedList.push({
              code,
              name,
              purchaseDateStr,
              purchaseCost,
              usefulLife,
              residualValue,
              depreciationMethod,
              schoolUnit,
              remarks,
              assetAccountCodeOrName: assetAcc?.code || '',
              deprExpenseAccountCodeOrName: deprAcc?.code || '',
              accumDeprAccountCodeOrName: accumAcc?.code || '',
              isValid: errors.length === 0,
              errors,
              action,
              existingId: existingAsset?.id
            });
          });
        }
        
        if (tempParsedList.length === 0) {
          setImportErrorMsg('Tidak ada data aset tetap yang dapat dibaca dlm file.');
          return;
        }

        const invalidCount = tempParsedList.filter(p => !p.isValid).length;
        if (invalidCount > 0) {
          setImportErrorMsg(`Ditemukan ${invalidCount} baris bermasalah dari total ${tempParsedList.length} entri inventaris.`);
        }
        setParsedAssets(tempParsedList);
      } catch (err: any) {
        console.error(err);
        setImportErrorMsg('Gagal memproses file. Pastikan format tabel/struktur data valid.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    const validOnes = parsedAssets.filter(e => e.isValid);
    if (validOnes.length === 0) {
      alert("Tidak ada data aset tetap valid untuk diimpor.");
      return;
    }
    
    setImportLoading(true);
    setImportProgress({ current: 0, total: validOnes.length });
    
    let processedCount = 0;
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Harap lakukan autentikasi akun terlebih dahulu.');

      for (let i = 0; i < validOnes.length; i++) {
        const item = validOnes[i];
        
        const assetAccObj = accounts.find(a => a.code === item.assetAccountCodeOrName || a.name === item.assetAccountCodeOrName);
        const deprAccObj = accounts.find(a => a.code === item.deprExpenseAccountCodeOrName || a.name === item.deprExpenseAccountCodeOrName);
        const accumAccObj = accounts.find(a => a.code === item.accumDeprAccountCodeOrName || a.name === item.accumDeprAccountCodeOrName);

        const assetPayload = {
          code: item.code,
          name: item.name,
          purchaseDate: Timestamp.fromDate(new Date(item.purchaseDateStr)),
          purchaseCost: item.purchaseCost,
          usefulLife: item.usefulLife,
          residualValue: item.residualValue,
          depreciationMethod: item.depreciationMethod,
          assetAccountId: assetAccObj?.id || '',
          assetAccountName: assetAccObj?.name || 'Aset Tetap Terkait',
          deprExpenseAccountId: deprAccObj?.id || '',
          deprExpenseAccountName: deprAccObj?.name || 'Beban Penyusutan',
          accumDeprAccountId: accumAccObj?.id || '',
          accumDeprAccountName: accumAccObj?.name || 'Akumulasi Penyusutan',
          status: 'Aktif' as const,
          remarks: item.remarks,
          schoolUnit: item.schoolUnit
        };

        if (item.action === 'update' && item.existingId) {
          await updateFixedAsset(item.existingId, assetPayload);
        } else {
          await createFixedAsset(assetPayload as any, user.uid);
        }
        
        processedCount++;
        setImportProgress({ current: processedCount, total: validOnes.length });
      }
      
      setImportSuccessMsg(`Sukses! Berhasil mengimpor/singkronisasi ${processedCount} inventaris aset tetap ke database.`);
      setParsedAssets([]);
      loadData();
      setTimeout(() => {
        setImportSuccessMsg('');
      }, 5000);
    } catch (err: any) {
      console.error(err);
      setImportErrorMsg(`Gagal memproses impor aset: ${err.message || 'Error internal'}`);
    } finally {
      setImportLoading(false);
    }
  };

  // Calculate elapsed months and depreciation parameters
  const calculateAssetSummary = (asset: FixedAsset) => {
    const purchase = toJSDate(asset.purchaseDate);
    // Use target local current date
    const current = new Date();
    
    // Difference in months
    const yearsDiff = current.getFullYear() - purchase.getFullYear();
    const monthsDiff = current.getMonth() - purchase.getMonth();
    const totalElapsedMonths = Math.max(0, yearsDiff * 12 + monthsDiff);
    const maxUsefulMonths = asset.usefulLife * 12;
    const elapsedMonths = Math.min(maxUsefulMonths, totalElapsedMonths);

    // Straight Line math: (PurchaseCost - ResidualVal) / usefulLifeMonths
    const depreciableAmount = Math.max(0, asset.purchaseCost - asset.residualValue);
    const monthlyDepreciation = depreciableAmount / maxUsefulMonths;
    const theoreticalAccumulated = monthlyDepreciation * elapsedMonths;
    const theoreticalBookValue = Math.max(asset.residualValue, asset.purchaseCost - theoreticalAccumulated);

    // Actually Posted from postedHistory
    const actualAccumulated = asset.depreciationHistory.reduce((sum, log) => sum + log.amount, 0);
    const actualBookValue = Math.max(0, asset.purchaseCost - actualAccumulated);

    return {
      elapsedMonths,
      maxUsefulMonths,
      monthlyDepreciation,
      theoreticalAccumulated,
      theoreticalBookValue,
      actualAccumulated,
      actualBookValue,
      depreciableAmount
    };
  };

  // Global calculations for total grid statistics
  const getOverallStats = () => {
    let originalCost = 0;
    let accumPosted = 0;
    let netBookValue = 0;
    let activeAssetsCount = 0;

    const targetedAssets = unitFilter === 'all' ? assets : assets.filter(a => (a.schoolUnit || 'Umum') === unitFilter);

    targetedAssets.forEach(a => {
      if (a.status === 'Aktif') {
        originalCost += a.purchaseCost;
        const actualAccum = a.depreciationHistory.reduce((sum, log) => sum + log.amount, 0);
        accumPosted += actualAccum;
        netBookValue += Math.max(0, a.purchaseCost - actualAccum);
        activeAssetsCount += 1;
      }
    });

    return { originalCost, accumPosted, netBookValue, activeAssetsCount };
  };

  const overallStats = getOverallStats();

  // Open creation dialog with populated fields
  const handleOpenAdd = () => {
    setFormId('');
    setFormCode(`AST-${String(assets.length + 1).padStart(4, '0')}`);
    setFormName('');
    setFormPurchaseDate(new Date().toISOString().split('T')[0]);
    setFormPurchaseCost(0);
    setFormUsefulLife(4);
    setFormResidualValue(0);
    setFormMethod('straight_line');
    setFormRemarks('');
    setFormSchoolUnit('Umum');
    setFormError('');

    // Pre-populate accounts smart guess
    const assetAccs = accounts.filter(a => a.category === 'Aset' && a.subCategory.toLowerCase().includes('tetap'));
    const deprAccs = accounts.filter(a => a.category === 'Beban' && a.name.toLowerCase().includes('penyusutan'));
    const accumAccs = accounts.filter(a => a.category === 'Aset' && a.name.toLowerCase().includes('akumulasi'));

    setFormAssetAccount(assetAccs.length > 0 ? assetAccs[0].id : (accounts.find(a => a.category === 'Aset')?.id || ''));
    setFormDeprExpenseAccount(deprAccs.length > 0 ? deprAccs[0].id : (accounts.find(a => a.category === 'Beban')?.id || ''));
    setFormAccumDeprAccount(accumAccs.length > 0 ? accumAccs[0].id : (accounts.find(a => a.category === 'Aset' && a.code !== formAssetAccount)?.id || ''));

    setIsAddEditOpen(true);
  };

  // Open edit dialog
  const handleOpenEdit = (asset: FixedAsset) => {
    setFormId(asset.id);
    setFormCode(asset.code);
    setFormName(asset.name);
    setFormPurchaseDate(toJSDate(asset.purchaseDate).toISOString().split('T')[0]);
    setFormPurchaseCost(asset.purchaseCost);
    setFormUsefulLife(asset.usefulLife);
    setFormResidualValue(asset.residualValue);
    setFormMethod(asset.depreciationMethod);
    setFormAssetAccount(asset.assetAccountId);
    setFormDeprExpenseAccount(asset.deprExpenseAccountId);
    setFormAccumDeprAccount(asset.accumDeprAccountId);
    setFormRemarks(asset.remarks || '');
    setFormSchoolUnit(asset.schoolUnit || 'Umum');
    setFormError('');

    setIsAddEditOpen(true);
  };

  // Save/Update asset handler
  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formCode.trim()) return setFormError('Masukkan kode referensi aset.');
    if (!formName.trim()) return setFormError('Masukkan nama deskripsi aset tetap.');
    if (formPurchaseCost <= 0) return setFormError('Harga perolehan awal harus lebih tinggi dari Rp 0.');
    if (formUsefulLife <= 0) return setFormError('Masa manfaat ekonomis minimal adalah 1 tahun.');
    if (formResidualValue < 0) return setFormError('Nilai residu sisa tidak boleh negatif.');
    if (formResidualValue >= formPurchaseCost) return setFormError('Nilai sisa residu tidak boleh melebihi atau sama dengan modal perolehan.');
    
    if (!formAssetAccount || !formDeprExpenseAccount || !formAccumDeprAccount) {
      return setFormError('Semua ikat akun (COA) pendukung depresiasi wajib diisi.');
    }

    const selectedAssetAcc = accounts.find(a => a.id === formAssetAccount);
    const selectedBebanAcc = accounts.find(a => a.id === formDeprExpenseAccount);
    const selectedAccumAcc = accounts.find(a => a.id === formAccumDeprAccount);

    const assetPayload = {
      code: formCode,
      name: formName,
      purchaseDate: Timestamp.fromDate(new Date(formPurchaseDate)),
      purchaseCost: Number(formPurchaseCost),
      usefulLife: Number(formUsefulLife),
      residualValue: Number(formResidualValue),
      depreciationMethod: formMethod,
      assetAccountId: formAssetAccount,
      assetAccountName: selectedAssetAcc?.name || 'Aset Tetap Terkait',
      deprExpenseAccountId: formDeprExpenseAccount,
      deprExpenseAccountName: selectedBebanAcc?.name || 'Beban Penyusutan',
      accumDeprAccountId: formAccumDeprAccount,
      accumDeprAccountName: selectedAccumAcc?.name || 'Akumulasi Penyusutan',
      status: (formId ? assets.find(a => a.id === formId)?.status : 'Aktif') || 'Aktif',
      remarks: formRemarks,
      schoolUnit: formSchoolUnit,
    } as any;

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Harap lakukan autentikasi akun terlebih dahulu.');

      if (formId) {
        // Edit
        await updateFixedAsset(formId, assetPayload);
        showToast('Berhasil mengubah rincian informasi aset tetap.');
      } else {
        // Create new
        await createFixedAsset(assetPayload, user.uid);
        showToast('Sukses mengarsipkan inventaris aset tetap baru.');
      }
      setIsAddEditOpen(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Gagal menyimpan transaksi aset tetap ke server.');
    }
  };

  // Open Depreciation posting drawer
  const handleOpenDeprPosting = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    
    // Auto calculate recommended default monthly amount
    const calc = calculateAssetSummary(asset);
    setDeprAmount(Math.round(calc.monthlyDepreciation));
    setDeprDate(new Date().toISOString().split('T')[0]);
    const currentMonthLabel = new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    setDeprNotes(`Penyusutan Aset ${asset.name} - ${currentMonthLabel}`);
    setDeprError('');
    setIsDeprOpen(true);
  };

  // Submit monthly depreciation journal posting
  const handlePostDepreciationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeprError('');

    if (!selectedAsset) return;
    if (deprAmount <= 0) return setDeprError('Nominal penyusutan harus lebih besar dari Rp 0.');
    
    // Check if posted amount will exceed remaining book value
    const calc = calculateAssetSummary(selectedAsset);
    const actualRemainingValue = selectedAsset.purchaseCost - calc.actualAccumulated;
    if (deprAmount > (actualRemainingValue - selectedAsset.residualValue)) {
      return setDeprError(`Maksimum penyusutan tersisa untuk disusutkan hingga mencapai nilai residu adalah ${formatRupiah(actualRemainingValue - selectedAsset.residualValue)}`);
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('User audit dilarang membuat jurnal offline.');

      setLoading(true);
      const journalId = await postAssetDepreciation(
        selectedAsset,
        Number(deprAmount),
        new Date(deprDate),
        deprNotes,
        user.uid
      );

      showToast(`Sukses memposting penyusutan sebesar ${formatRupiah(deprAmount)} ke Jurnal Umum (Ref Jurnal: ${journalId}).`);
      setIsDeprOpen(false);
      setSelectedAsset(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      setDeprError(err.message || 'Gagal mempublikasi penyusutan aset tetap.');
    } finally {
      setLoading(false);
    }
  };

  // Open asset disposal dialog
  const handleOpenDispose = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setDisposeDate(new Date().toISOString().split('T')[0]);
    setDisposePrice(0);
    setDisposeRemarks('');
    setDisposeError('');
    setIsDisposeOpen(true);
  };

  // Submit disposal event of matching asset
  const handleDisposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDisposeError('');

    if (!selectedAsset) return;
    if (disposePrice < 0) return setDisposeError('Harga pelepasan tidak boleh negatif.');

    try {
      setLoading(true);
      await updateFixedAsset(selectedAsset.id, {
        status: 'Dilepas',
        disposalDate: Timestamp.fromDate(new Date(disposeDate)),
        disposalPrice: Number(disposePrice),
        remarks: `${selectedAsset.remarks || ''}\n[Pelepasan ${formatDateString(disposeDate)}: ${disposeRemarks || 'Dilepas/dijual aset tetap.'}]`.trim()
      });

      showToast(`Sukses mencatat pelepasan aset tetap: ${selectedAsset.name}.`);
      setIsDisposeOpen(false);
      setSelectedAsset(null);
      loadData();
    } catch (err: any) {
      console.error(err);
      setDisposeError(err.message || 'Gagal merubah status aset terlepas.');
    } finally {
      setLoading(false);
    }
  };

  // Deletion logic
  const handleDeleteAsset = async (assetId: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus arsip aset tetap ini secara permanen? Catatan log histori dan posting depresiasi tidak ikut terhapus di jurnal, namun referensi monitoring aset ini akan hilang.')) return;
    
    try {
      setLoading(true);
      await deleteFixedAsset(assetId);
      showToast('Arsip inventaris aset tetap telah dihapus.');
      loadData();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Gagal menghapus aset tetap.', true);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (asset: FixedAsset) => {
    setSelectedAsset(asset);
    setIsDetailOpen(true);
  };

  // Generate an array representing the projected amortization or depreciation timetable (Buku Penyusutan Tahunan/Bulanan)
  const generateDepreciationSchedule = (asset: FixedAsset) => {
    const calc = calculateAssetSummary(asset);
    const schedule = [];
    const purchase = toJSDate(asset.purchaseDate);
    const deprValuePerMonth = calc.monthlyDepreciation;

    let accum = 0;
    
    for (let m = 1; m <= calc.maxUsefulMonths; m++) {
      const scheduledDate = new Date(purchase.getFullYear(), purchase.getMonth() + m, 0); // End of month
      accum += deprValuePerMonth;
      const bValue = Math.max(asset.residualValue, asset.purchaseCost - accum);

      // Check if this projected month was already posted by querying depreciation History
      const isPostedLog = asset.depreciationHistory.find(history => {
        const historyDate = toJSDate(history.date);
        return historyDate.getFullYear() === scheduledDate.getFullYear() && 
               historyDate.getMonth() === scheduledDate.getMonth();
      });

      schedule.push({
        num: m,
        periodName: scheduledDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' }),
        expense: deprValuePerMonth,
        accumulated: accum,
        bookValue: bValue,
        posted: !!isPostedLog,
        journalId: isPostedLog?.journalId || null
      });
    }

    return schedule;
  };

  // Advanced search and filters logic
  const filteredAssets = assets.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (item.remarks && item.remarks.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'Semua' || item.status === statusFilter;
    const matchesUnit = unitFilter === 'all' || (item.schoolUnit || 'Umum') === unitFilter;

    return matchesSearch && matchesStatus && matchesUnit;
  });

  return (
    <div className="space-y-8">
      {/* Alert Error / Success */}
      <AnimatePresence>
        {successMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </motion.div>
        )}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-850 text-xs font-semibold flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-natural-border/60 hover:shadow-lg transition-all duration-350 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total Nilai Perolehan</p>
            <h3 className="text-xl font-bold font-mono text-slate-900">{formatRupiah(overallStats.originalCost)}</h3>
            <p className="text-[10px] text-gray-400">Kumulatif seluruh aset tetap aktif</p>
          </div>
          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-slate-500" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-natural-border/60 hover:shadow-lg transition-all duration-350 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Total Terdepresiasi</p>
            <h3 className="text-xl font-bold font-mono text-emerald-600">{formatRupiah(overallStats.accumPosted)}</h3>
            <p className="text-[10px] text-gray-400">Akumulasi penyusutan yang diposting</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-center shrink-0">
            <TrendingDown className="w-5 h-5 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-natural-border/60 hover:shadow-lg transition-all duration-350 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Nilai Buku Bersih (NBV)</p>
            <h3 className="text-xl font-bold font-mono text-natural-primary">{formatRupiah(overallStats.netBookValue)}</h3>
            <p className="text-[10px] text-gray-400 font-medium">Nilai bersih yang tersisa di neraca</p>
          </div>
          <div className="w-12 h-12 bg-emerald-50/40 border border-natural-border rounded-xl flex items-center justify-center shrink-0">
            <PiggyBank className="w-5 h-5 text-natural-primary" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-natural-border/60 hover:shadow-lg transition-all duration-350 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Jumlah Aset Aktif</p>
            <h3 className="text-xl font-bold font-mono text-slate-800">{overallStats.activeAssetsCount} barang</h3>
            <p className="text-[10px] text-gray-400">Aset dalam operasional sekolah</p>
          </div>
          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-slate-500" />
          </div>
        </div>
      </div>

      {/* Import & Export Panel */}
      <AnimatePresence>
        {showImportExport && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-6 animate-none"
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
                    <h3 className="font-serif italic font-bold text-slate-800 text-base">Ekspor Inventaris Aset Tetap</h3>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Unduh data aset tetap dalam format file CSV atau JSON</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Ekspor daftar inventaris aset tetap Anda ke dalam format CSV untuk dianalisis di Excel atau format JSON untuk cadangan database offline lengkap.
                </p>

                <div className="bg-white/80 border border-slate-100 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
                  <div className="text-xs space-y-1 w-full sm:w-auto text-left">
                    <div className="flex justify-between sm:justify-start gap-3">
                      <span className="text-slate-400">Total Terdaftar:</span>
                      <span className="font-bold text-slate-700 font-mono">{assets.length} aset</span>
                    </div>
                    <div className="flex justify-between sm:justify-start gap-3">
                      <span className="text-slate-400">Terfilter di layar:</span>
                      <span className="font-bold text-natural-primary font-mono">{filteredAssets.length} aset</span>
                    </div>
                  </div>

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
              {!isViewer && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                        <FileUp className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="font-serif italic font-bold text-slate-800 text-base">Impor Inventaris Aset Tetap</h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Unggah dokumen untuk sinkronisasi inventaris instan</p>
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
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <input
                      type="file"
                      accept=".csv,.json"
                      id="import-assets-file-selector"
                      onChange={handleFileChange}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      title=""
                    />
                    <Upload className="w-8 h-8 text-slate-400 shrink-0" />
                    <div className="space-y-0.5 select-none font-sans">
                      <p className="text-xs font-semibold text-slate-700 font-sans">Tarik & Lepaskan File (.csv atau .json)</p>
                      <p className="text-[10px] text-slate-400 leading-none">atau klik area ini untuk memindai dokumen Anda</p>
                    </div>
                  </div>

                  {importSuccessMsg && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-sans">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{importSuccessMsg}</span>
                    </div>
                  )}

                  {importErrorMsg && (
                    <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 text-xs rounded-xl flex items-center gap-2 font-sans">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span className="flex-1">{importErrorMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Parsing Review Panel / Importer Preview Table */}
            {parsedAssets.length > 0 && (
              <div className="mt-4 bg-white border border-natural-border rounded-3xl p-6 shadow-md space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-100">
                  <div className="text-left font-sans">
                    <h4 className="font-serif italic font-bold text-slate-800 text-base">Tinjau Validasi Transaksi Impor Aset Tetap</h4>
                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-mono font-semibold">
                      Terbaca: <b className="text-slate-805 font-bold font-mono">{parsedAssets.length}</b> Aset • Baru (Tambah): <b className="text-emerald-700 font-bold font-mono">{parsedAssets.filter(p => p.isValid && p.action === 'create').length}</b> • Sinkron (Update): <b className="text-blue-700 font-bold font-mono">{parsedAssets.filter(p => p.isValid && p.action === 'update').length}</b> • Bermasalah: <b className="text-rose-650 font-bold font-mono">{parsedAssets.filter(p => !p.isValid).length}</b>
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => setParsedAssets([])}
                      className="flex-1 sm:flex-none px-4 py-2 text-xs bg-slate-50 border border-slate-205 hover:bg-slate-100 text-slate-600 font-semibold rounded-lg transition-colors cursor-pointer text-center font-sans"
                    >
                      Bersihkan
                    </button>
                    <button
                      onClick={handleConfirmImport}
                      disabled={importLoading || parsedAssets.filter(p => p.isValid).length === 0}
                      className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                    >
                      {importLoading ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          <span>Menyimpan ({importProgress.current}/{importProgress.total})...</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4" />
                          <span>Proses Impor {parsedAssets.filter(p => p.isValid).length} Entri Valid</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-2xl">
                  {parsedAssets.map((pa, idx) => (
                    <div key={idx} className="p-3 bg-slate-50/30 flex flex-col md:flex-row justify-between items-start gap-4 text-xs font-sans">
                      <div className="space-y-1 flex-1 text-left font-sans">
                        <div className="flex flex-wrap items-center gap-2">
                          {!pa.isValid ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse" title="Perlu Koreksi" />
                          ) : pa.action === 'update' ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" title="Sinkron / Update Aset Terdaftar" />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="Aset Baru" />
                          )}
                          <span className="font-mono text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            {pa.code || 'Tanpa Kode'}
                          </span>
                          <span className="font-bold text-slate-800 text-sm">{pa.name || 'Nama Kosong'}</span>
                          
                          <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                            {formatRupiah(pa.purchaseCost)}
                          </span>

                          <span className={cn(
                            "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border leading-none font-sans",
                            pa.schoolUnit === 'SMP' ? "bg-sky-50 text-sky-700 border-sky-100" :
                            pa.schoolUnit === 'SMA' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                            "bg-slate-50 text-slate-600 border-slate-200"
                          )}>
                            {pa.schoolUnit}
                          </span>
                        </div>
                        
                        <div className="text-[10px] text-slate-550 leading-relaxed font-sans">
                          Tgl Perolehan: <strong className="text-slate-600 font-mono">{pa.purchaseDateStr}</strong> • Manfaat: <strong className="text-slate-600 font-mono">{pa.usefulLife} Thn</strong> • Residu: <strong className="text-slate-600 font-mono">{formatRupiah(pa.residualValue)}</strong> • Metode: <strong className="text-slate-600">{pa.depreciationMethod === 'straight_line' ? 'Garis Lurus' : 'Saldo Menurun'}</strong> • Keterangan: <strong className="text-slate-600 italic">{pa.remarks || '-'}</strong>
                        </div>
                        
                        {/* Errors report */}
                        {!pa.isValid && (
                          <div className="space-y-1 mt-1 bg-rose-50 border border-rose-100 text-rose-700 p-2.5 rounded-xl text-[10px] font-medium leading-relaxed max-w-lg font-sans">
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
                      <div className="text-right shrink-0 font-sans">
                        {pa.isValid && (
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase font-mono tracking-wider border",
                            pa.action === 'update' 
                              ? "bg-blue-50 text-blue-700 border-blue-200" 
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            {pa.action === 'update' ? 'Update/Sinkron' : 'Aset Baru'}
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

      {/* Main Panel */}
      <div className="bg-white rounded-2xl border border-natural-border/60 shadow-sm overflow-hidden min-h-[400px]">
        {/* Toolbar */}
        <div className="p-6 border-b border-natural-border flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Left search */}
          <div className="flex-1 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-300" />
              <input 
                type="text" 
                placeholder="Cari kode, nama atau memo aset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
              />
            </div>

            {/* Filter tags */}
            <div className="flex border border-natural-border bg-slate-50/50 p-1 rounded-xl">
              {(['Semua', 'Aktif', 'Dilepas'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={cn(
                    "px-3 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer",
                    statusFilter === tab 
                      ? "bg-natural-primary text-white shadow-sm" 
                      : "text-slate-500 hover:text-slate-850"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* School Unit Filter */}
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value as any)}
              className="bg-white border border-natural-border rounded-xl px-3 py-1.5 text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary cursor-pointer font-bold shrink-0"
            >
              <option value="all">Unit: Konsolidasi</option>
              <option value="SMP">Unit: SMP</option>
              <option value="SMA">Unit: SMA</option>
              <option value="Umum">Unit: Umum</option>
            </select>
          </div>

          {/* Right action button group */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowImportExport(!showImportExport)}
              className={cn(
                "flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer select-none border",
                showImportExport 
                  ? "bg-slate-100 text-slate-800 border-slate-300"
                  : "bg-white text-slate-600 border-natural-border hover:bg-slate-50"
              )}
            >
              <FileUp className="w-4 h-4" />
              <span>{isViewer ? 'Ekspor Aset' : 'Ekspor / Impor'}</span>
            </button>

            {!isViewer && (
              <button
                onClick={handleOpenAdd}
                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-natural-primary rounded-xl text-xs font-bold text-white shadow-md cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all shrink-0"
              >
                <Plus className="w-4 h-4 text-white/90" />
                <span>Tambah Aset Tetap</span>
              </button>
            )}
          </div>
        </div>

        {/* Assets List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-natural-border text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                <th className="px-6 py-4">Kode & Nama Barang</th>
                <th className="px-6 py-4">Perolehan</th>
                <th className="px-6 py-4">Masa Manfaat / Sisa</th>
                <th className="px-6 py-4">Akum. Penyusutan</th>
                <th className="px-6 py-4">Nilai Buku (NBV)</th>
                <th className="px-6 py-4 text-center">Status / Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-gray-400 italic text-xs font-sans">
                    Memuat inventaris aset tetap sekolah...
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-20 text-gray-400 italic text-xs font-sans">
                    Tidak ditemukan aset tetap terdaftar dengan kondisi filter ini.
                  </td>
                </tr>
              ) : (
                filteredAssets.map(asset => {
                  const calc = calculateAssetSummary(asset);

                  return (
                    <tr key={asset.id} className="hover:bg-slate-50/50 transition-all duration-150">
                      {/* Name & COA */}
                      <td className="px-6 py-4">
                        <div className="font-sans space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[9px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                              {asset.code}
                            </span>
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border leading-none font-sans",
                              (asset.schoolUnit || 'Umum') === 'SMP' ? "bg-sky-50 text-sky-700 border-sky-100" :
                              (asset.schoolUnit || 'Umum') === 'SMA' ? "bg-indigo-50 text-indigo-700 border-indigo-100" :
                              "bg-slate-50 text-slate-600 border-slate-200"
                            )}>
                              {asset.schoolUnit || 'Umum'}
                            </span>
                            <span className={cn(
                              "text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border leading-none font-sans",
                              asset.status === 'Aktif' ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-neutral-100 text-neutral-600 border-neutral-200"
                            )}>
                              {asset.status}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-850 text-sm">{asset.name}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-xs block">
                            Akun: <span className="font-medium text-slate-500">[{accounts.find(a => a.id === asset.assetAccountId)?.code || '-'}] {asset.assetAccountName}</span>
                          </p>
                        </div>
                      </td>

                      {/* Acquisition */}
                      <td className="px-6 py-4">
                        <div className="font-sans">
                          <p className="text-sm font-bold font-mono text-slate-900">{formatRupiah(asset.purchaseCost)}</p>
                          <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3" />
                            {formatDateString(asset.purchaseDate)}
                          </p>
                        </div>
                      </td>

                      {/* Useful Life & Period Sisa */}
                      <td className="px-6 py-4">
                        <div className="font-sans">
                          <p className="text-xs font-semibold text-slate-800">{asset.usefulLife} Tahun <span className="text-[10px] text-gray-400">({calc.maxUsefulMonths} bln)</span></p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Sisa: <span className="font-bold text-emerald-600">{Math.max(0, calc.maxUsefulMonths - calc.elapsedMonths)} bln</span>
                          </p>
                        </div>
                      </td>

                      {/* Accum Depreciation */}
                      <td className="px-6 py-4">
                        <div className="font-sans space-y-1">
                          <p className="text-sm font-bold font-mono text-emerald-600">{formatRupiah(calc.actualAccumulated)}</p>
                          <div className="flex items-center gap-1.5 opacity-90">
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-100 font-bold uppercase select-none leading-none">
                              {asset.depreciationHistory.length}x Diposting
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Net Book Value NBV */}
                      <td className="px-6 py-4">
                        <div className="font-sans">
                          <p className="text-sm font-black font-mono text-slate-900">{formatRupiah(calc.actualBookValue)}</p>
                          {asset.residualValue > 0 && (
                            <p className="text-[9px] text-gray-400 block mt-0.5">
                              Residu: <span className="font-mono text-slate-600 select-all font-semibold">{formatRupiah(asset.residualValue)}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {asset.status === 'Aktif' && !isViewer && (
                            <button
                              onClick={() => handleOpenDeprPosting(asset)}
                              title="Posting Jurnal Depresiasi Bulan Ini"
                              className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-100 rounded-xl text-[10px] font-bold tracking-wider uppercase transition-all cursor-pointer inline-flex items-center gap-1 shadow-sm"
                            >
                              <TrendingDown className="w-3.5 h-3.5" />
                              <span>Penyusutan</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenDetail(asset)}
                            title="Rincian Depresiasi & Sejarah Buku"
                            className="p-1.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-500 hover:text-slate-850 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {asset.status === 'Aktif' && !isViewer && (
                            <>
                              <button
                                onClick={() => handleOpenDispose(asset)}
                                title="Pelepasan Aset / Afkir"
                                className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-100 rounded-xl text-[10px] font-bold uppercase transition-all cursor-pointer inline-flex items-center"
                              >
                                Lepas Aset
                              </button>
                              
                              <button
                                onClick={() => handleOpenEdit(asset)}
                                title="Ubah Rincian Aset"
                                className="p-1.5 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {!isViewer && (
                            <button
                              onClick={() => handleDeleteAsset(asset.id)}
                              title="Hapus Aset"
                              className="p-1.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-400 hover:text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Model Add/Edit Asset */}
      <AnimatePresence>
        {isAddEditOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl p-8 border border-natural-border overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-serif italic text-natural-primary font-bold">
                    {formId ? 'Edit Rincian Aset Tetap' : 'Daftarkan Inventaris Aset Tetap'}
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-sans font-bold">Monitor SAK ETAP Depresiasi</p>
                </div>
                <button onClick={() => setIsAddEditOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-gray-400 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAsset} className="space-y-5">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold">
                    {formError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Code */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Kode Referensi Aset</label>
                    <input 
                      type="text" 
                      required
                      value={formCode}
                      onChange={(e) => setFormCode(e.target.value)}
                      placeholder="AST-0001"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    />
                  </div>

                  {/* Unit Sekolah Select */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Unit Sekolah</label>
                    <select
                      value={formSchoolUnit}
                      onChange={(e) => setFormSchoolUnit(e.target.value as any)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-slate-600 focus:outline-none focus:ring-1 focus:ring-natural-primary cursor-pointer"
                    >
                      <option value="Umum">Umum (Gabungan)</option>
                      <option value="SMP">SMP</option>
                      <option value="SMA">SMA</option>
                    </select>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Nama Barang Aset Tetap</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Contoh: Laptop ACER Core i7 Lab Komputer"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    />
                  </div>

                  {/* Purchase Date */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Tanggal Perolehan</label>
                    <input 
                      type="date"
                      required
                      value={formPurchaseDate}
                      onChange={(e) => setFormPurchaseDate(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    />
                  </div>

                  {/* Acquisition Cost */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Harga Perolehan Awal (Rp)</label>
                    <input 
                      type="number" 
                      required
                      min={0}
                      value={formPurchaseCost}
                      onChange={(e) => setFormPurchaseCost(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary font-mono font-bold"
                    />
                  </div>

                  {/* Useful Life */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Masa Manfaat (Tahun)</label>
                    <select
                      value={formUsefulLife}
                      onChange={(e) => setFormUsefulLife(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    >
                      <option value={4}>4 Tahun (Kelompok 1 - IT, Peralatan Kantor)</option>
                      <option value={8}>8 Tahun (Kelompok 2 - Kendaraan, Mesin)</option>
                      <option value={10}>10 Tahun (Kelompok 3 - Bangunan Semi Permanen)</option>
                      <option value={16}>16 Tahun (Kelompok 4 - Bangunan Kantor Pabrik)</option>
                      <option value={20}>20 Tahun (Kelompok Permanen - Gedung Sekolah)</option>
                    </select>
                  </div>

                  {/* Residual Value */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Nilai Sisa Residu (Rp)</label>
                    <input 
                      type="number" 
                      required
                      min={0}
                      placeholder="0"
                      value={formResidualValue}
                      onChange={(e) => setFormResidualValue(Number(e.target.value))}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary font-mono font-bold"
                    />
                  </div>

                  {/* Depreciation Method */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Metode Depresiasi</label>
                    <select
                      value={formMethod}
                      onChange={(e) => setFormMethod(e.target.value as any)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    >
                      <option value="straight_line">Garis Lurus (Straight-line) - Standar SAK ETAP</option>
                      {/* Note declining-balance is listed here conceptually */}
                    </select>
                  </div>

                  {/* Space filler / Remarks */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Memo / Catatan Penempatan</label>
                    <input 
                      type="text" 
                      placeholder="Lokasi/Ruang atau Kondisi Fisik..."
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-2">
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-3 flex items-center gap-1.5">
                    <Sliders className="w-3" />
                    INTEGRASI KUNCI AKUN GENERAL LEDGER (COA)
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Asset Account */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Akun Debit Utama (Aset)</label>
                      <select
                        required
                        value={formAssetAccount}
                        onChange={(e) => setFormAssetAccount(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-natural-border rounded-xl text-[11px] text-natural-text focus:outline-none"
                      >
                        {getAssetAccountOptions().map(acc => (
                          <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Accum Account */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Akun Akum. Penyusutan (Kredit)</label>
                      <select
                        required
                        value={formAccumDeprAccount}
                        onChange={(e) => setFormAccumDeprAccount(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-natural-border rounded-xl text-[11px] text-natural-text focus:outline-none"
                      >
                        {getAssetAccountOptions().map(acc => (
                          <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Expense Account */}
                    <div>
                      <label className="block text-[9px] uppercase tracking-widest text-gray-400 font-bold mb-1">Akun Beban Penyusutan</label>
                      <select
                        required
                        value={formDeprExpenseAccount}
                        onChange={(e) => setFormDeprExpenseAccount(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-natural-border rounded-xl text-[11px] text-natural-text focus:outline-none"
                      >
                        {getBebanAccountOptions().map(acc => (
                          <option key={acc.id} value={acc.id}>[{acc.code}] {acc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 mt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddEditOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-natural-border text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-natural-primary text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {formId ? 'Simpan Perubahan' : 'Daftarkan Aset'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Posting Depreciation */}
      <AnimatePresence>
        {isDeprOpen && selectedAsset && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 border border-natural-border"
            >
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-serif italic text-emerald-900 font-bold">Posting Penyusutan Aset</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Sinkronisasi Jurnal Umum SAK ETAP</p>
                </div>
                <button onClick={() => { setIsDeprOpen(false); setSelectedAsset(null); }} className="p-2 hover:bg-slate-50 rounded-xl text-gray-400 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Informational stats */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 space-y-2.5 mb-5">
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-800 font-medium font-sans">Nama Barang</span>
                  <span className="font-bold text-slate-800">{selectedAsset.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-emerald-800 font-medium font-sans">Harga Perolehan</span>
                  <span className="font-mono font-bold text-slate-800">{formatRupiah(selectedAsset.purchaseCost)}</span>
                </div>
                <div className="flex justify-between text-xs pt-1.5 border-t border-emerald-100">
                  <span className="text-emerald-800 font-medium font-sans">Rekomendasi Bulanan</span>
                  <span className="font-mono font-bold text-emerald-700">{formatRupiah(calculateAssetSummary(selectedAsset).monthlyDepreciation)}</span>
                </div>
              </div>

              <form onSubmit={handlePostDepreciationSubmit} className="space-y-4">
                {deprError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold">
                    {deprError}
                  </div>
                )}

                {/* Amount */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Nominal Penyusutan Yang Diposting (Rp)</label>
                  <input 
                    type="number" 
                    required
                    min={1}
                    value={deprAmount}
                    onChange={(e) => setDeprAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary font-mono font-bold"
                  />
                  <p className="text-[9px] text-gray-400 mt-1 select-none">Anda bisa merubah jumlah ini jika ingin memposting beban akumulasi kustom.</p>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Tanggal Posting Transaksi</label>
                  <input 
                    type="date"
                    required
                    value={deprDate}
                    onChange={(e) => setDeprDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none focus:ring-1 focus:ring-natural-primary"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Memo Deskripsi Jurnal</label>
                  <input 
                    type="text" 
                    required
                    value={deprNotes}
                    onChange={(e) => setDeprNotes(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text"
                  />
                </div>

                {/* Target Information */}
                <div className="p-3 bg-amber-50 border border-amber-100 text-amber-800 text-[10px] leading-relaxed rounded-xl font-medium mt-1 select-none flex gap-2">
                  <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    Aksi ini otomatis mem-posting transaksi debit ke akun <strong>{selectedAsset.deprExpenseAccountName}</strong> dan kredit ke akumulasi penyusutan <strong>{selectedAsset.accumDeprAccountName}</strong> di Jurnal Umum.
                  </span>
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 mt-6">
                  <button
                    type="button"
                    onClick={() => { setIsDeprOpen(false); setSelectedAsset(null); }}
                    className="px-5 py-2.5 rounded-xl border border-natural-border text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Post ke Jurnal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Dispose/Release Asset */}
      <AnimatePresence>
        {isDisposeOpen && selectedAsset && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 border border-natural-border"
            >
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-base font-serif italic text-amber-900 font-bold">Pelepasan / Penjualan Aset</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Penghentian Aktiva Tetap Sekolah</p>
                </div>
                <button onClick={() => { setIsDisposeOpen(false); setSelectedAsset(null); }} className="p-2 hover:bg-slate-50 rounded-xl text-gray-400 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Asset Snapshot summary */}
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-1.5 text-xs mb-5 font-sans">
                <div className="flex justify-between text-slate-600">
                  <span>Nama Aset</span>
                  <span className="font-bold text-slate-800">{selectedAsset.name}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Sisa Buku (NBV)</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatRupiah(selectedAsset.purchaseCost - selectedAsset.depreciationHistory.reduce((sum, log) => sum + log.amount, 0))}
                  </span>
                </div>
              </div>

              <form onSubmit={handleDisposeSubmit} className="space-y-4">
                {disposeError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-semibold">
                    {disposeError}
                  </div>
                )}

                {/* Disposal Date */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Tanggal Pelepasan</label>
                  <input 
                    type="date"
                    required
                    value={disposeDate}
                    onChange={(e) => setDisposeDate(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text focus:outline-none"
                  />
                </div>

                {/* Disposal Price */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Nilai Penjualan / Barang Bekas (Rp)</label>
                  <input 
                    type="number" 
                    required
                    min={0}
                    value={disposePrice}
                    onChange={(e) => setDisposePrice(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs text-natural-text font-mono font-bold"
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Masukkan 0 jika barang dibuang / rusak tanpa nilai sisa logam bekas.</p>
                </div>

                {/* Memo */}
                <div>
                  <label className="block text-[10px] uppercase tracking-widest text-gray-400 font-bold mb-1">Alasan / Catatan Akhir Pelepasan</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Contoh: Terjual rongsok atau laptop mati total"
                    value={disposeRemarks}
                    onChange={(e) => setDisposeRemarks(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-natural-border rounded-xl text-xs"
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-100 pt-5 mt-6">
                  <button
                    type="button"
                    onClick={() => { setIsDisposeOpen(false); setSelectedAsset(null); }}
                    className="px-5 py-2.5 rounded-xl border border-natural-border text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-xl bg-amber-600 text-xs font-bold text-white shadow-md hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    Konfirmasi Pelepasan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Detail & Depreciation Log Modal */}
      <AnimatePresence>
        {isDetailOpen && selectedAsset && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-40">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl p-8 border border-natural-border flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-3 shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-slate-150 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                      {selectedAsset.code}
                    </span>
                    <h3 className="text-lg font-serif italic text-natural-primary font-bold">Rincian Buku Aset Tetap {selectedAsset.name}</h3>
                  </div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Status: {selectedAsset.status}</p>
                </div>
                <button onClick={() => { setIsDetailOpen(false); setSelectedAsset(null); }} className="p-2 hover:bg-slate-50 rounded-xl text-gray-400 transition-colors cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Grid content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 overflow-y-auto pr-2">
                {/* Visual Specifications Left Card */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 self-start">
                  <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold select-none">DATA TEKNIS PEROLEHAN</span>
                  
                  <div className="space-y-3 font-sans text-xs">
                    <div className="border-b border-white pb-1.5">
                      <p className="text-gray-400 text-[10px]">Tanggal Pembelian</p>
                      <p className="font-semibold text-slate-800 mt-0.5">{formatDateString(selectedAsset.purchaseDate)}</p>
                    </div>

                    <div className="border-b border-white pb-1.5">
                      <p className="text-gray-400 text-[10px]">Harga Perolehan Kas</p>
                      <p className="font-bold text-slate-900 text-sm font-mono mt-0.5">{formatRupiah(selectedAsset.purchaseCost)}</p>
                    </div>

                    <div className="border-b border-white pb-1.5">
                      <p className="text-gray-400 text-[10px]">Perkiraan Nilai Sisa (Residu)</p>
                      <p className="font-bold text-slate-700 font-mono mt-0.5">{formatRupiah(selectedAsset.residualValue)}</p>
                    </div>

                    <div className="border-b border-white pb-1.5">
                      <p className="text-gray-400 text-[10px]">Masa Manfaat Ekonomis</p>
                      <p className="font-semibold text-slate-800 mt-0.5">{selectedAsset.usefulLife} Tahun ({selectedAsset.usefulLife * 12} bulan)</p>
                    </div>

                    <div className="border-b border-white pb-1.5">
                      <p className="text-gray-400 text-[10px]">Beban Penyusutan Bulanan</p>
                      <p className="font-semibold text-emerald-700 font-mono mt-0.5">
                        {formatRupiah((selectedAsset.purchaseCost - selectedAsset.residualValue) / (selectedAsset.usefulLife * 12))}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-400 text-[10px] select-none mb-1">Pemetaan Akun Jurnal (COA)</p>
                      <div className="space-y-1 text-[10px] text-slate-600">
                        <span className="block truncate">📦 Aset: <strong>{selectedAsset.assetAccountName}</strong></span>
                        <span className="block truncate">📉 Akumulasi: <strong>{selectedAsset.accumDeprAccountName}</strong></span>
                        <span className="block truncate">📊 Beban: <strong>{selectedAsset.deprExpenseAccountName}</strong></span>
                      </div>
                    </div>

                    {selectedAsset.remarks && (
                      <div className="bg-white border border-slate-150 p-2.5 rounded-xl mt-3">
                        <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Catatan Penempatan</p>
                        <p className="text-[11px] text-slate-700 font-medium italic">“{selectedAsset.remarks}”</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Projection of Amortization & Posting history panels Right (2 columns wide) */}
                <div className="md:col-span-2 space-y-6">
                  {/* POSTING HISTORY LOGS */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <History className="w-4 h-4 text-emerald-700" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">RIWAYAT PENYUSUTAN TERPOSTING</span>
                    </div>

                    {selectedAsset.depreciationHistory.length === 0 ? (
                      <div className="p-8 border border-dashed border-slate-250 bg-slate-50/50 rounded-2xl text-center text-xs text-gray-405 font-medium">
                        Belum ada beban akumulasi penyusutan yang terposting ke buku ledger jurnal umum sekolah.
                      </div>
                    ) : (
                      <div className="max-h-56 overflow-y-auto border border-slate-150 rounded-2xl divide-y divide-slate-100 bg-white">
                        {selectedAsset.depreciationHistory.map((log) => (
                          <div key={log.id} className="p-3.5 hover:bg-slate-50/70 transition-all flex items-center justify-between text-xs">
                            <div className="space-y-1 font-sans">
                              <p className="font-semibold text-slate-800">
                                {formatDateString(log.date)}
                              </p>
                              <p className="text-[10px] text-gray-400 italic">“{log.notes || 'Tanpa deskripsi memo'}”</p>
                              {log.journalId && (
                                <span className="inline-flex items-center text-[9px] bg-slate-100 text-slate-600 px-2 rounded-md font-mono border border-slate-200 mt-1 select-all font-semibold uppercase">
                                  Ref Jurnal: {log.journalId}
                                </span>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-emerald-600 font-mono text-sm">-{formatRupiah(log.amount)}</p>
                              <p className="text-[9px] text-gray-400 uppercase tracking-wider font-semibold">Beban Depresiasi</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PROJECTED DEPRECIATION AMORTIZATION SCHEDULE */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-slate-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">ESTIMASI AMORTISASI FORECAST (BULANAN)</span>
                    </div>

                    <div className="max-h-64 overflow-y-auto border border-slate-150 rounded-2xl bg-white">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 select-none text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-slate-100 leading-none">
                            <th className="p-3">Ke-</th>
                            <th className="p-3">Periode</th>
                            <th className="p-3">Beban Depresiasi</th>
                            <th className="p-3">Total Akumulasi</th>
                            <th className="p-3">Nilai Buku Sisa</th>
                            <th className="p-3 text-center">Keadaan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 font-sans">
                          {generateDepreciationSchedule(selectedAsset).map((item) => (
                            <tr key={item.num} className="hover:bg-slate-50/50 transition-all font-mono leading-none">
                              <td className="p-3 font-semibold text-slate-400">{item.num}</td>
                              <td className="p-3 text-slate-700 font-sans font-semibold">{item.periodName}</td>
                              <td className="p-3 text-slate-600">{formatRupiah(item.expense)}</td>
                              <td className="p-3 text-emerald-600">{formatRupiah(item.accumulated)}</td>
                              <td className="p-3 font-bold text-slate-900">{formatRupiah(item.bookValue)}</td>
                              <td className="p-3 text-center">
                                {item.posted ? (
                                  <span className="bg-emerald-50 text-emerald-700 text-[8px] font-bold px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">
                                    Posted
                                  </span>
                                ) : (
                                  <span className="bg-slate-100 text-slate-500 text-[8px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                                    Draft
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>

              {/* Close Button Footer */}
              <div className="flex justify-end pt-4 border-t border-slate-100 mt-6 shrink-0">
                <button
                  onClick={() => { setIsDetailOpen(false); setSelectedAsset(null); }}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 text-xs font-bold text-white shadow focus:outline-none cursor-pointer hover:bg-slate-800"
                >
                  Tutup Rincian
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
