import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Textarea } from '../../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '../../components/ui/dialog';
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Calendar, Filter } from 'lucide-react';
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
        const { startDate, endDate } = getDateRange('today');
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

    const categories = {
        in: ['Penjualan (Manual)', 'Penjualan (Rekap)', 'Modal Tambahan', 'Pendapatan Lain-lain'],
        out: ['Operasional', 'Gaji Karyawan', 'Sewa Tempat', 'Listrik & Air', 'Internet', 'Maintenance', 'Perlengkapan', 'Lain-lain']
    };

    const fetchTransactions = React.useCallback(async () => {
        if (!currentStore) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('cash_flow')
                .select('*')
                .eq('store_id', currentStore.id)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Client-side filtering and Mapping
            const mappedData = data.filter(item => {
                const itemDate = new Date(item.date);
                if (!datePickerDate?.from) return true;
                const start = new Date(datePickerDate.from);
                start.setHours(0, 0, 0, 0);
                const end = datePickerDate.to ? new Date(datePickerDate.to) : new Date(start);
                end.setHours(23, 59, 59, 999);

                return itemDate >= start && itemDate <= end;
            }).map(item => ({
                ...item,
                storeId: item.store_id,
                performedBy: item.performed_by,
                createdAt: item.created_at,
                expenseGroup: item.expense_group
            }));

            setTransactions(mappedData);
        } catch (error) {
            console.error("Error fetching cash flow:", error);
        } finally {
            setLoading(false);
        }
    }, [currentStore, datePickerDate]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

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
                expense_group: formData.expenseGroup || 'operational',
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

    const handleDelete = async (id) => {
        if (!window.confirm("Yakin ingin menghapus data ini?")) return;
        try {
            const { error } = await supabase.from('cash_flow').delete().eq('id', id);
            if (error) throw error;
            fetchTransactions();
        } catch (error) {
            console.error("Error deleting transaction:", error);
            alert("Gagal menghapus data");
        }
    };

    const stats = React.useMemo(() => transactions.reduce((acc, curr) => {
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
    }, { income: 0, expense: 0, capex: 0, opex: 0 }), [transactions]);

    // New: Calculate All-Time Balance (Sisa Saldo)
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
                // 1. Total Sales (Transactions)
                const { data: transData, error: transError } = await supabase
                    .from('transactions')
                    .select('total, status')
                    .eq('store_id', currentStore.id);

                if (transError) throw transError;

                let totalSales = 0;
                transData.forEach(data => {
                    if (data.status !== 'void' && data.status !== 'cancelled') {
                        totalSales += (Number(data.total) || 0);
                    }
                });

                // 2. Total Cash Flow
                const { data: cashData, error: cashError } = await supabase
                    .from('cash_flow')
                    .select('amount, type')
                    .eq('store_id', currentStore.id);

                if (cashError) throw cashError;

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
    }, [currentStore, transactions]); // Refetch when transactions change (e.g. added new cash flow)

    const currentBalance = allTimeBalance.sales + allTimeBalance.cashIn - allTimeBalance.cashOut;

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
                        </DialogContent>
                    </Dialog>
                </div>
            </div>


            {/* All-Time Balance Card */}
            <Card className="bg-slate-900 text-white border-none shadow-lg">
                <CardHeader>
                    <CardTitle className="text-lg font-medium text-slate-200">Total Uang Saat Ini (Tanpa Filter)</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                        <div>
                            <div className="text-4xl font-bold">
                                {allTimeBalance.loading ? '...' : `Rp ${currentBalance.toLocaleString()}`}
                            </div>
                            <div className="text-sm text-slate-400 mt-2">
                                (Penjualan + Kas Masuk) - (Kas Keluar)
                            </div>
                        </div>
                        <div className="text-right text-xs space-y-1">
                            <div className="text-emerald-400">Sales: +Rp {allTimeBalance.sales.toLocaleString()}</div>
                            <div className="text-emerald-400">Masuk: +Rp {allTimeBalance.cashIn.toLocaleString()}</div>
                            <div className="text-rose-400">Keluar: -Rp {allTimeBalance.cashOut.toLocaleString()}</div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            Rp {stats.income.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pengeluaran</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            Rp {stats.expense.toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Net Cash Flow</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${stats.income - stats.expense >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                            Rp {(stats.income - stats.expense).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>

                {/* Additional Stats: OPEX & CAPEX */}
                <Card className="bg-red-50/50 border-red-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-700">OPEX (Operasional)</CardTitle>
                        <div className="bg-red-100 p-1 rounded">
                            <TrendingDown className="h-3 w-3 text-red-700" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-semibold text-red-700">
                            Rp {stats.opex.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Biaya rutin (Gaji, Listrik, dll)</p>
                    </CardContent>
                </Card>
                <Card className="bg-orange-50/50 border-orange-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-700">CAPEX (Modal/Aset)</CardTitle>
                        <div className="bg-orange-100 p-1 rounded">
                            <TrendingDown className="h-3 w-3 text-orange-700" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-semibold text-orange-700">
                            Rp {stats.capex.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Pembelian aset & inventaris</p>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Riwayat Transaksi</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead>Keterangan</TableHead>
                                <TableHead>Oleh</TableHead>
                                <TableHead className="text-right">Masuk</TableHead>
                                <TableHead className="text-right">Keluar</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8">Memuat data...</TableCell>
                                </TableRow>
                            ) : transactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Belum ada data transaksi</TableCell>
                                </TableRow>
                            ) : (
                                transactions.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">{format(new Date(t.date), 'dd MMM yyyy', { locale: id })}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${t.type === 'in' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {t.category}
                                            </span>
                                            {t.type === 'out' && (
                                                <div className="text-[10px] text-muted-foreground mt-1">
                                                    {t.expenseGroup === 'non_operational' ? '(Aset/Modal)' : '(Operasional)'}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={t.description}>{t.description || '-'}</TableCell>
                                        <TableCell>{t.performedBy}</TableCell>
                                        <TableCell className="text-right font-medium text-green-600">
                                            {t.type === 'in' ? `Rp ${t.amount.toLocaleString()}` : '-'}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-red-600">
                                            {t.type === 'out' ? `Rp ${t.amount.toLocaleString()}` : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600" onClick={() => handleDelete(t.id)}>
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
        </div >
    );
};

export default CashFlow;
