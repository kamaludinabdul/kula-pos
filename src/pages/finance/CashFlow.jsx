import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { safeSupabaseQuery } from '../../utils/supabaseHelper';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { getDateRange } from '../../lib/utils';
import FormattedNumberInput from '../../components/ui/FormattedNumberInput';


const CashFlow = () => {
    const { currentStore } = useData();
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [datePickerDate, setDatePickerDate] = useState(() => {
        const { startDate, endDate } = getDateRange('thisMonth');
        return { from: startDate, to: endDate };
    });

    // Form State
    const [formData, setFormData] = useState({
        type: 'out', // in, out
        category: '',
        expenseGroup: 'operational', // operational, non_operational
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    const categories = React.useMemo(() => ({
        in: ['Penjualan (Manual)', 'Penjualan (Rekap)', 'Modal Tambahan', 'Pendapatan Lain-lain'],
        out: ['Operasional', 'Gaji Karyawan', 'Sewa Tempat', 'Listrik & Air', 'Internet', 'Maintenance', 'Perlengkapan', 'Lain-lain']
    }), []);



    const [filterGroup, setFilterGroup] = useState('all'); // all, operational, non_operational
    const [filterType, setFilterType] = useState('all'); // all, in, out
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    const fetchTransactions = React.useCallback(async () => {
        if (!currentStore) return;
        setLoading(true);
        try {
            // 1. Fetch from Cash Flow (Back Office)
            const cashData = await safeSupabaseQuery({
                tableName: 'cash_flow',
                queryBuilder: (q) => q.eq('store_id', currentStore.id)
                    .order('date', { ascending: false })
                    .order('created_at', { ascending: false }),
                fallbackParams: `?store_id=eq.${currentStore.id}&order=date.desc,created_at.desc`
            });

            // 2. Fetch from Shift Movements (POS Petty Cash - Out only)
            const shiftData = await safeSupabaseQuery({
                tableName: 'shift_movements',
                queryBuilder: (q) => q.eq('store_id', currentStore.id)
                    .eq('type', 'out'),
                fallbackParams: `?store_id=eq.${currentStore.id}&type=eq.out`
            });

            // Combine and Map Data
            const allTransactions = [
                ...cashData.map(item => ({
                    ...item,
                    source: 'Back Office',
                    storeId: item.store_id,
                    performedBy: item.performed_by,
                    createdAt: item.created_at,
                    expenseGroup: item.expense_group
                })),
                ...shiftData.map(item => ({
                    id: item.id,
                    storeId: item.store_id,
                    type: item.type,
                    category: item.category || 'Operasional',
                    amount: item.amount,
                    description: item.reason || 'Pengeluaran Kasir',
                    date: item.date,
                    performedBy: item.cashier,
                    createdAt: item.created_at,
                    expenseGroup: item.expense_group || 'operational',
                    source: 'Kasir (POS)'
                }))
            ];

            setTransactions(allTransactions);
        } catch (error) {
            console.error("Error fetching cash flow:", error);
        } finally {
            setLoading(false);
        }
    }, [currentStore]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    const displayTransactions = React.useMemo(() => {
        let filtered = transactions.filter(item => {
            // Date Filter
            const itemDate = new Date(item.date);
            if (datePickerDate?.from) {
                const start = new Date(datePickerDate.from);
                start.setHours(0, 0, 0, 0);
                const end = datePickerDate.to ? new Date(datePickerDate.to) : new Date(start);
                end.setHours(23, 59, 59, 999);
                if (itemDate < start || itemDate > end) return false;
            }

            // Group Filter (OPEX/CAPEX)
            if (filterGroup !== 'all') {
                // If a group filter is active (OPEX/CAPEX), only show 'out' transactions
                if (item.type !== 'out') return false;
                if (item.expenseGroup !== filterGroup) return false;
            }

            // Type Filter
            if (filterType !== 'all' && item.type !== filterType) return false;

            // Category Filter
            if (filterCategory !== 'all' && item.category !== filterCategory) return false;

            return true;
        });

        // Sorting
        filtered.sort((a, b) => {
            let valA, valB;
            if (sortConfig.key === 'date') {
                valA = new Date(a.date).getTime();
                valB = new Date(b.date).getTime();
            } else if (sortConfig.key === 'in') {
                valA = a.type === 'in' ? a.amount : 0;
                valB = b.type === 'in' ? b.amount : 0;
            } else if (sortConfig.key === 'out') {
                valA = a.type === 'out' ? a.amount : 0;
                valB = b.type === 'out' ? b.amount : 0;
            } else {
                valA = a[sortConfig.key];
                valB = b[sortConfig.key];
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [transactions, datePickerDate, filterGroup, filterType, filterCategory, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    const handleAddTransaction = async () => {
        if (!currentStore || !user) {
            alert("Data toko atau user belum dimuat. Silakan refresh.");
            return;
        }
        if (!formData.amount || formData.amount <= 0) {
            alert("Jumlah harus lebih dari 0");
            return;
        }
        if (!formData.category) {
            alert("Silakan pilih kategori");
            return;
        }

        setIsSaving(true);
        try {
            const { error } = await supabase.from('cash_flow').insert({
                store_id: currentStore.id,
                type: formData.type,
                category: formData.category,
                expense_group: formData.type === 'out' ? (formData.expenseGroup || 'operational') : null,
                amount: Number(formData.amount),
                description: formData.description,
                date: formData.date,
                performed_by: user.name || 'Staff'
            });

            if (error) throw error;

            setIsAddDialogOpen(false);
            setFormData({
                type: 'out',
                category: '',
                expenseGroup: 'operational',
                amount: '',
                description: '',
                date: new Date().toISOString().split('T')[0]
            });
            fetchTransactions();
        } catch (error) {
            console.error("Error adding transaction:", error);
            alert("Gagal menyimpan data: " + (error.message || "Unknown error"));
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (transaction) => {
        if (!window.confirm("Yakin ingin menghapus data ini?")) return;

        try {
            let error;

            // Determine source based on property presence or specific flags
            // Based on fetchTransactions map:
            // Back Office: source = 'Back Office' (default from item)
            // POS: source = 'Kasir (POS)'

            if (transaction.source === 'Kasir (POS)') {
                const { error: deleteError } = await supabase
                    .from('shift_movements')
                    .delete()
                    .eq('id', transaction.id);
                error = deleteError;
            } else {
                // Default to cash_flow table
                const { error: deleteError } = await supabase
                    .from('cash_flow')
                    .delete()
                    .eq('id', transaction.id);
                error = deleteError;
            }

            if (error) throw error;
            fetchTransactions();
        } catch (error) {
            console.error("Error deleting transaction:", error);
            alert("Gagal menghapus data: " + (error.message || "Unknown error"));
        }
    };

    const stats = React.useMemo(() => displayTransactions.reduce((acc, curr) => {
        if (curr.type === 'in') {
            acc.income += (curr.amount || 0);
        } else {
            acc.expense += (curr.amount || 0);
            if (curr.expenseGroup === 'non_operational') {
                acc.capex += (curr.amount || 0);
            } else {
                acc.opex += (curr.amount || 0);
            }
        }
        return acc;
    }, { income: 0, expense: 0, capex: 0, opex: 0 }), [displayTransactions]);

    const [allTimeBalance, setAllTimeBalance] = useState({
        sales: 0,
        cashIn: 0,
        cashOut: 0,
        loading: true
    });

    useEffect(() => {
        const fetchAllTimeStats = async () => {
            if (!currentStore?.id) return;
            try {
                const transData = await safeSupabaseQuery({
                    tableName: 'transactions',
                    queryBuilder: (q) => q.select('total, status').eq('store_id', currentStore.id),
                    fallbackParams: `?store_id=eq.${currentStore.id}&select=total,status`
                });

                let totalSales = 0;
                transData.forEach(data => {
                    if (data.status !== 'void' && data.status !== 'cancelled') {
                        totalSales += (Number(data.total) || 0);
                    }
                });

                const cashData = await safeSupabaseQuery({
                    tableName: 'cash_flow',
                    queryBuilder: (q) => q.select('amount, type').eq('store_id', currentStore.id),
                    fallbackParams: `?store_id=eq.${currentStore.id}&select=amount,type`
                });

                let totalCashIn = 0;
                let totalCashOut = 0;

                cashData.forEach(data => {
                    if (data.type === 'in') totalCashIn += (Number(data.amount) || 0);
                    else totalCashOut += (Number(data.amount) || 0);
                });

                setAllTimeBalance({
                    sales: totalSales,
                    cashIn: totalCashIn,
                    cashOut: totalCashOut,
                    loading: false
                });

            } catch (error) {
                console.error("Error fetching all-time stats:", error);
                setAllTimeBalance(prev => ({ ...prev, loading: false }));
            }
        };

        fetchAllTimeStats();
    }, [currentStore, transactions]);

    const currentBalance = allTimeBalance.sales + allTimeBalance.cashIn - allTimeBalance.cashOut;

    const availableCategories = React.useMemo(() => {
        const cats = new Set();
        if (filterType === 'all') {
            categories.in.forEach(c => cats.add(c));
            categories.out.forEach(c => cats.add(c));
        } else {
            categories[filterType].forEach(c => cats.add(c));
        }
        return Array.from(cats);
    }, [filterType, categories]);

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Arus Kas (Cash Flow)</h1>
                    <p className="text-muted-foreground">Catat pemasukan dan pengeluaran manual</p>
                </div>
                <div className="flex items-center gap-2">
                    <SmartDatePicker
                        date={datePickerDate}
                        onDateChange={setDatePickerDate}
                    />

                    <Button variant="outline" size="icon" onClick={fetchTransactions} disabled={loading} className="h-9 w-9">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>

                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="h-4 w-4" /> Catat Transaksi
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>Catat Arus Kas</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Jenis</Label>
                                        <Select
                                            value={formData.type}
                                            onValueChange={(val) => setFormData(prev => ({ ...prev, type: val, category: '' }))}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="in">Pemasukan (In)</SelectItem>
                                                <SelectItem value="out">Pengeluaran (Out)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Tanggal</Label>
                                        <Input
                                            type="date"
                                            value={formData.date}
                                            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Kategori</Label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, category: val }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Pilih Kategori" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories[formData.type].map(cat => (
                                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.type === 'out' && (
                                    <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        <Label className="text-xs font-semibold text-slate-700">Jenis Pengeluaran</Label>
                                        <div className="flex flex-col gap-2 mt-1">
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    id="operational"
                                                    name="expenseGroup"
                                                    value="operational"
                                                    checked={formData.expenseGroup === 'operational'}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, expenseGroup: e.target.value }))}
                                                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                                />
                                                <label htmlFor="operational" className="text-sm font-medium leading-none cursor-pointer">
                                                    Biaya Operasional <span className="text-[10px] text-slate-500 block sm:inline">(Mengurangi Profit)</span>
                                                </label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    id="non_operational"
                                                    name="expenseGroup"
                                                    value="non_operational"
                                                    checked={formData.expenseGroup === 'non_operational'}
                                                    onChange={(e) => setFormData(prev => ({ ...prev, expenseGroup: e.target.value }))}
                                                    className="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                                />
                                                <label htmlFor="non_operational" className="text-sm font-medium leading-none cursor-pointer">
                                                    Belanja Aset/Modal <span className="text-[10px] text-slate-500 block sm:inline">(Aset Tetap, Tidak Mengurangi Profit)</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Jumlah (Rp)</Label>
                                    <FormattedNumberInput
                                        placeholder="0"
                                        value={formData.amount}
                                        onChange={(val) => setFormData(prev => ({ ...prev, amount: val }))}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Keterangan</Label>
                                    <Textarea
                                        placeholder="Catatan tambahan..."
                                        value={formData.description}
                                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSaving}>
                                    Batal
                                </Button>
                                <Button
                                    onClick={handleAddTransaction}
                                    disabled={isSaving || !formData.amount || !formData.category}
                                >
                                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                                </Button>
                            </DialogFooter>
                        </DialogContent >
                    </Dialog >
                </div >
            </div >


            {/* All-Time Balance Card */}
            <Card className="bg-slate-900 text-white border-none shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full -mr-16 -mt-16 blur-2xl" />
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Total Saldo Saat Ini</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        <div>
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                                {allTimeBalance.loading ? '...' : `Rp ${currentBalance.toLocaleString()}`}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-widest">
                                Sisa Kas + Penjualan
                            </p>
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-slate-500 uppercase">Sales</p>
                                <p className="text-xs font-bold text-emerald-400">+{allTimeBalance.sales.toLocaleString()}</p>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-slate-500 uppercase">Masuk</p>
                                <p className="text-xs font-bold text-emerald-400">+{allTimeBalance.cashIn.toLocaleString()}</p>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-slate-500 uppercase">Keluar</p>
                                <p className="text-xs font-bold text-rose-400">-{allTimeBalance.cashOut.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <InfoCard
                    title="Income"
                    value={`Rp ${stats.income.toLocaleString()}`}
                    icon={TrendingUp}
                    variant="success"
                />
                <InfoCard
                    title="Expense"
                    value={`Rp ${stats.expense.toLocaleString()}`}
                    icon={TrendingDown}
                    variant="danger"
                />
                <InfoCard
                    title="Net Flow"
                    value={`Rp ${(stats.income - stats.expense).toLocaleString()}`}
                    icon={DollarSign}
                    variant={stats.income - stats.expense >= 0 ? "info" : "warning"}
                    className={stats.income - stats.expense < 0 ? "text-orange-600" : "text-blue-600"}
                />
                <InfoCard
                    title="OPEX"
                    value={`Rp ${stats.opex.toLocaleString()}`}
                    icon={TrendingDown}
                    variant="danger"
                    description="Operasional"
                />
                <InfoCard
                    title="CAPEX"
                    value={`Rp ${stats.capex.toLocaleString()}`}
                    icon={TrendingDown}
                    variant="warning"
                    description="Aset & Inventaris"
                />
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-4 rounded-xl shadow-sm border border-slate-100">
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Grup Pengeluaran</Label>
                    <Select value={filterGroup} onValueChange={setFilterGroup}>
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Grup</SelectItem>
                            <SelectItem value="operational">OPEX (Operasional)</SelectItem>
                            <SelectItem value="non_operational">CAPEX (Aset/Modal)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Jenis</Label>
                    <Select value={filterType} onValueChange={(v) => { setFilterType(v); setFilterCategory('all'); }}>
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Jenis</SelectItem>
                            <SelectItem value="in">Pemasukan (In)</SelectItem>
                            <SelectItem value="out">Pengeluaran (Out)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-slate-400 uppercase">Kategori</Label>
                    <Select value={filterCategory} onValueChange={setFilterCategory}>
                        <SelectTrigger className="h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Kategori</SelectItem>
                            {availableCategories.map(cat => (
                                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Desktop Table View */}
            <Card className="hidden lg:block border-none shadow-sm overflow-hidden rounded-xl">
                <CardHeader className="bg-white border-b flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-bold">Riwayat Transaksi Kas</CardTitle>
                    <div className="text-[10px] text-slate-400 font-medium">
                        Menampilkan {displayTransactions.length} transaksi
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50">
                                <TableHead className="py-4">
                                    <button
                                        className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
                                        onClick={() => handleSort('date')}
                                    >
                                        Tanggal
                                        {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                                    </button>
                                </TableHead>
                                <TableHead>Sumber</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Keterangan</TableHead>
                                <TableHead>Oleh</TableHead>
                                <TableHead className="text-right">
                                    <button
                                        className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors"
                                        onClick={() => handleSort('in')}
                                    >
                                        Masuk
                                        {sortConfig.key === 'in' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                                    </button>
                                </TableHead>
                                <TableHead className="text-right">
                                    <button
                                        className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors"
                                        onClick={() => handleSort('out')}
                                    >
                                        Keluar
                                        {sortConfig.key === 'out' && (sortConfig.direction === 'asc' ? ' ↑' : ' ↓')}
                                    </button>
                                </TableHead>
                                <TableHead className="w-[80px] text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-slate-400">Memuat data...</TableCell>
                                </TableRow>
                            ) : displayTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-12 text-slate-400 font-medium">Belum ada data transaksi sesuai filter</TableCell>
                                </TableRow>
                            ) : (
                                displayTransactions.map((t) => (
                                    <TableRow key={t.id} className="hover:bg-slate-50 transition-colors group">
                                        <TableCell>
                                            <span className="font-semibold text-slate-700">{format(new Date(t.date), 'dd MMM yyyy', { locale: id })}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 uppercase tracking-tighter ring-1 ring-inset ring-slate-500/10">
                                                {t.source || 'Back Office'}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${t.type === 'in' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {t.category}
                                            </span>
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate text-slate-600" title={t.description}>{t.description || '-'}</TableCell>
                                        <TableCell className="text-slate-500 text-xs font-medium">{t.performedBy}</TableCell>
                                        <TableCell className="text-right font-bold text-green-600">
                                            {t.type === 'in' ? `Rp ${t.amount.toLocaleString()}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-red-600">
                                            {t.type === 'out' ? `Rp ${t.amount.toLocaleString()}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(t)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
                {loading ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-slate-400 font-medium">Memuat data...</div>
                ) : displayTransactions.length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-2xl border border-dashed text-slate-400 font-medium">Belum ada riwayat transaksi sesuai filter.</div>
                ) : (
                    displayTransactions.map((t) => (
                        <div key={t.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3 relative overflow-hidden">
                            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${t.type === 'in' ? 'bg-green-500' : 'bg-red-500'}`} />
                            <div className="flex justify-between items-start pl-2">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-slate-900">
                                            {format(new Date(t.date), 'dd MMM yyyy', { locale: id })}
                                        </span>
                                        <span className="inline-flex items-center rounded-md bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-400 uppercase tracking-tighter border border-slate-100">
                                            {t.source || 'Back Office'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-500 font-medium line-clamp-1">{t.description || 'Tanpa keterangan'}</p>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge
                                        variant="outline"
                                        className={`text-[9px] font-bold px-2 py-0.5 uppercase border-none ${t.type === 'in' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
                                    >
                                        {t.category}
                                    </Badge>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{t.performedBy}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-50 pl-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Jumlah</span>
                                <div className="flex items-center gap-3">
                                    <span className={`text-base font-extrabold ${t.type === 'in' ? 'text-green-600' : 'text-red-600'}`}>
                                        {t.type === 'in' ? '+' : '-'} Rp {t.amount?.toLocaleString()}
                                    </span>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-red-500" onClick={() => handleDelete(t)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )
                }
            </div>
        </div >
    );
};

export default CashFlow;
