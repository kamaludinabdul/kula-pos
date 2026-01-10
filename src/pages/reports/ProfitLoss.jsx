import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, ShoppingBag, TrendingDown, Download, Eye, XCircle, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Search } from 'lucide-react';
import ReceiptModal from '../../components/ReceiptModal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { exportToCSV, getDateRange, formatPaymentMethod } from '../../lib/utils';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { supabase } from '../../supabase';
import { Calendar } from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ProfitLoss = () => {
    const { products, currentStore, voidTransaction } = useData();
    const { user } = useAuth();
    const [transactions, setTransactions] = useState([]); // Local state for report data
    const [isLoading, setIsLoading] = useState(false);
    // Initial state: This Month
    const [datePickerDate, setDatePickerDate] = useState(() => {
        const { startDate, endDate } = getDateRange('today');
        return { from: startDate, to: endDate };
    });

    useEffect(() => {
        if (!datePickerDate?.from) {
            const { startDate, endDate } = getDateRange('today');
            setDatePickerDate({ from: startDate, to: endDate });
        }
    }, [datePickerDate]);

    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [statusFilter, setStatusFilter] = useState('all');
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

    // Cancel Dialog State
    const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
    const [transactionToCancel, setTransactionToCancel] = useState(null);
    const [cancelReason, setCancelReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);

    const handleViewReceipt = (transaction) => {
        setSelectedTransaction(transaction);
        setIsReceiptModalOpen(true);
    };

    // Create a product map for quick lookup of current buy prices (fallback for old transactions)
    const productMap = useMemo(() => {
        const map = new Map();
        products.forEach(p => {
            map.set(p.id, p);
            map.set(p.name, p); // Fallback by name
        });
        return map;
    }, [products]);

    // Cash flow data fetching removed as unused

    const [stats, setStats] = useState({
        totalSales: 0,
        totalCOGS: 0,
        totalExpenses: 0,
        otherIncome: 0,
        netProfit: 0,
        totalTransactions: 0,
        totalItems: 0,
        totalTax: 0,
        totalDiscount: 0,
        totalAssets: 0
    });

    // Data Fetching Effect
    useEffect(() => {
        const fetchReportData = async () => {
            if (!currentStore?.id || !datePickerDate?.from || !datePickerDate?.to) return;

            setIsLoading(true);
            try {
                const start = new Date(datePickerDate.from);
                start.setHours(0, 0, 0, 0);

                const end = datePickerDate.to ? new Date(datePickerDate.to) : new Date(start);
                end.setHours(23, 59, 59, 999);

                const startDateStr = start.toISOString();
                const endDateStr = end.toISOString();

                // 1. Fetch Transactions for the table
                const { data: transData, error: transError } = await supabase
                    .from('transactions')
                    .select('*')
                    .eq('store_id', currentStore.id)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr)
                    .order('date', { ascending: false })
                    .limit(100);

                if (transError) throw transError;
                setTransactions(transData || []);

                // 2. Fetch Aggregated Stats via RPC (Server-side calculation)
                const { data: reportStats, error: statsError } = await supabase.rpc('get_profit_loss_report', {
                    p_store_id: currentStore.id,
                    p_start_date: startDateStr,
                    p_end_date: endDateStr
                });

                if (!statsError && reportStats) {
                    setStats(prev => ({
                        ...prev,
                        totalSales: reportStats.total_sales || 0,
                        totalCOGS: reportStats.total_cogs || 0,
                        totalExpenses: reportStats.total_expenses || 0,
                        otherIncome: reportStats.other_income || 0,
                        netProfit: reportStats.net_profit || 0,
                        totalTransactions: reportStats.total_transactions || 0,
                        totalItems: reportStats.total_items || 0,
                        totalTax: reportStats.total_tax || 0,
                        totalDiscount: reportStats.total_discount || 0,
                        totalAssets: reportStats.total_assets || 0
                    }));
                }
            } catch (error) {
                console.error("Error fetching report data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchReportData();
    }, [currentStore, datePickerDate]); // Re-fetch when Store or Date Range changes

    // Update filtering to work with local 'transactions' state
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            // 2. Status Filter
            if (statusFilter === 'success' && (t.status === 'void' || t.status === 'cancelled')) return false;
            if (statusFilter === 'void' && t.status !== 'void' && t.status !== 'cancelled') return false;

            // 3. Payment Method Filter
            if (paymentMethodFilter !== 'all') {
                const tMethod = (t.paymentMethod || '').toLowerCase();
                if (tMethod !== paymentMethodFilter) return false;
            }

            // 4. Search Filter
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const idMatch = t.id.toLowerCase().includes(query);
                const custMatch = (t.customerName || '').toLowerCase().includes(query);
                if (!idMatch && !custMatch) return false;
            }

            return true;
        });
    }, [transactions, statusFilter, paymentMethodFilter, searchQuery]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) return <ArrowUpDown className="h-4 w-4 ml-1 text-muted-foreground/50" />;
        if (sortConfig.direction === 'asc') return <ArrowUp className="h-4 w-4 ml-1" />;
        return <ArrowDown className="h-4 w-4 ml-1" />;
    };

    const sortedTransactions = useMemo(() => {
        let sortableItems = [...filteredTransactions];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                let aValue, bValue;

                if (sortConfig.key === 'date') {
                    aValue = new Date(a.date).getTime();
                    bValue = new Date(b.date).getTime();
                } else if (sortConfig.key === 'customer') {
                    aValue = (a.customerName || '').toLowerCase();
                    bValue = (b.customerName || '').toLowerCase();
                } else if (sortConfig.key === 'cashier') {
                    aValue = (a.cashier || '').toLowerCase();
                    bValue = (b.cashier || '').toLowerCase();
                } else if (sortConfig.key === 'items') {
                    aValue = a.items ? a.items.length : 0;
                    bValue = b.items ? b.items.length : 0;
                } else if (sortConfig.key === 'discount') {
                    aValue = a.discount || 0;
                    bValue = b.discount || 0;
                } else if (sortConfig.key === 'total') {
                    aValue = a.total || 0;
                    bValue = b.total || 0;
                } else if (sortConfig.key === 'status') {
                    aValue = a.status || '';
                    bValue = b.status || '';
                } else if (sortConfig.key === 'profit') {
                    // Calculate profit on the fly for the list
                    const getCOGS = (items) => {
                        let cogs = 0;
                        if (items) {
                            items.forEach(i => {
                                let buyPrice = i.buyPrice;
                                if (buyPrice === undefined || buyPrice === null) {
                                    const product = productMap.get(i.id) || productMap.get(i.name);
                                    buyPrice = product ? product.buyPrice : 0;
                                }
                                cogs += Number(buyPrice || 0) * i.qty;
                            });
                        }
                        return cogs;
                    };
                    aValue = a.total - getCOGS(a.items);
                    bValue = b.total - getCOGS(b.items);
                } else if (sortConfig.key === 'paymentMethod') {
                    aValue = a.paymentMethod || '';
                    bValue = b.paymentMethod || '';
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filteredTransactions, sortConfig, productMap]);

    const handleExport = () => {
        const dataToExport = filteredTransactions.map(t => {
            let tCOGS = 0;
            if (t.items) {
                t.items.forEach(i => {
                    let buyPrice = i.buyPrice;
                    if (buyPrice === undefined || buyPrice === null) {
                        const product = productMap.get(i.id) || productMap.get(i.name);
                        buyPrice = product ? product.buyPrice : 0;
                    }
                    tCOGS += Number(buyPrice || 0) * i.qty;
                });
            }
            const tProfit = t.total - tCOGS;

            return {
                ID: t.id,
                Tanggal: new Date(t.date).toLocaleString('id-ID'),
                Kasir: t.cashier,
                'Metode Bayar': formatPaymentMethod(t.paymentMethod),
                Items: t.items ? t.items.length : 0,
                Total: t.total,
                HPP: tCOGS,
                Laba: tProfit
            };
        });

        exportToCSV(dataToExport, `Laporan_Laba_Rugi_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();
        const start = datePickerDate.from.toLocaleDateString('id-ID');
        const end = datePickerDate.to ? datePickerDate.to.toLocaleDateString('id-ID') : start;

        // Header
        doc.setFontSize(18);
        doc.text(currentStore?.name || 'Laporan Laba Rugi', 14, 20);
        doc.setFontSize(12);
        doc.text(`Periode: ${start} - ${end}`, 14, 30);
        doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 36);

        // Summary Table
        const summaryData = [
            ['Total Penjualan', `Rp ${stats.totalSales.toLocaleString()}`],
            ['Total HPP', `(Rp ${stats.totalCOGS.toLocaleString()})`],
            ['Laba Kotor', `Rp ${(stats.totalSales - stats.totalCOGS).toLocaleString()}`],
            ['Biaya Operasional', `(Rp ${stats.totalExpenses.toLocaleString()})`],
            ['Pendapatan Lain', `Rp ${stats.otherIncome.toLocaleString()}`],
            ['Laba Bersih', `Rp ${stats.netProfit.toLocaleString()}`],
        ];

        autoTable(doc, {
            startY: 45,
            head: [['Keterangan', 'Jumlah']],
            body: summaryData,
            theme: 'striped',
            headStyles: { fillColor: [66, 66, 66] },
        });

        // Transactions Table
        const tableBody = filteredTransactions.map(t => {
            let tCOGS = 0;
            if (t.items) {
                t.items.forEach(i => {
                    let buyPrice = i.buyPrice;
                    if (buyPrice === undefined || buyPrice === null) {
                        const product = productMap.get(i.id) || productMap.get(i.name);
                        buyPrice = product ? product.buyPrice : 0;
                    }
                    tCOGS += Number(buyPrice || 0) * i.qty;
                });
            }
            const tProfit = t.total - tCOGS;
            return [
                t.id.slice(-6),
                new Date(t.date).toLocaleDateString('id-ID'),
                t.customerName || 'Umum',
                t.paymentMethod || '-',
                t.items?.length || 0,
                `Rp ${t.total.toLocaleString()}`,
                `Rp ${tProfit.toLocaleString()}`
            ];
        });

        doc.text('Rincian Transaksi', 14, doc.lastAutoTable.finalY + 15);

        autoTable(doc, {
            startY: doc.lastAutoTable.finalY + 20,
            head: [['ID', 'Tanggal', 'Pelanggan', 'Metode', 'Item', 'Total', 'Laba']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 8 },
        });

        doc.save(`Laporan_Laba_Rugi_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    const handleCancelClick = (transaction) => {
        setTransactionToCancel(transaction);
        setCancelReason('');
        setIsCancelDialogOpen(true);
    };

    const confirmCancel = async () => {
        if (!transactionToCancel || !cancelReason.trim()) return;

        setIsCancelling(true);
        const result = await voidTransaction(transactionToCancel.id, cancelReason);
        setIsCancelling(false);

        if (result.success) {
            setIsCancelDialogOpen(false);
            setTransactionToCancel(null);
            // No need to refetch, optimistic update handles it
        } else {
            alert("Gagal membatalkan transaksi: " + result.error);
        }
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Laporan Laba Rugi</h2>
                        <p className="text-muted-foreground">Ringkasan performa keuangan bisnis Anda.</p>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportPDF} disabled={isLoading}>
                            <Download className="mr-2 h-4 w-4" />
                            {isLoading ? 'Loading...' : 'Export PDF'}
                        </Button>
                        <Button variant="outline" onClick={handleExport} disabled={isLoading}>
                            <Download className="mr-2 h-4 w-4" />
                            Export CSV
                        </Button>
                    </div>
                </div>

                <div className="flex justify-start">
                    <SmartDatePicker
                        date={datePickerDate}
                        onDateChange={setDatePickerDate}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Laba Bersih</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Rp {stats.netProfit.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pemasukan</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp {stats.totalSales.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendapatan Lain</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">Rp {stats.otherIncome.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Diskon</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">Rp {stats.totalDiscount.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pengeluaran Operasional</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">Rp {stats.totalExpenses.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Harga Pokok (HPP)</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp {stats.totalCOGS.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Belanja Aset (Capex)</CardTitle>
                        <ShoppingBag className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-500">Rp {stats.totalAssets.toLocaleString()}</div>
                        <p className="text-[10px] text-muted-foreground mt-1">Tidak mengurangi laba bersih</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <CardTitle>Riwayat Transaksi</CardTitle>
                    <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
                        <div className="relative w-full md:w-[200px]">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari ID, Pelanggan..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-8"
                            />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="w-full md:w-[150px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Status</SelectItem>
                                <SelectItem value="success">Sukses</SelectItem>
                                <SelectItem value="void">Dibatalkan</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                            <SelectTrigger className="w-full md:w-[150px]">
                                <SelectValue placeholder="Tipe Bayar" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Semua Tipe</SelectItem>
                                <SelectItem value="cash">Tunai</SelectItem>
                                <SelectItem value="qris">QRIS</SelectItem>
                                <SelectItem value="transfer">Transfer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">ID</TableHead>
                                    <TableHead
                                        className="w-[140px] cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('date')}
                                    >
                                        <div className="flex items-center">
                                            Waktu
                                            {getSortIcon('date')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('customer')}
                                    >
                                        <div className="flex items-center">
                                            Pelanggan
                                            {getSortIcon('customer')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[100px] cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('paymentMethod')}
                                    >
                                        <div className="flex items-center">
                                            Metode
                                            {getSortIcon('paymentMethod')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[100px] cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('cashier')}
                                    >
                                        <div className="flex items-center">
                                            Kasir
                                            {getSortIcon('cashier')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[80px] text-center cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('items')}
                                    >
                                        <div className="flex items-center justify-center">
                                            Items
                                            {getSortIcon('items')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[100px] text-right cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('discount')}
                                    >
                                        <div className="flex items-center justify-end">
                                            Diskon
                                            {getSortIcon('discount')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[120px] text-right cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('total')}
                                    >
                                        <div className="flex items-center justify-end">
                                            Total
                                            {getSortIcon('total')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[120px] text-right cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('profit')}
                                    >
                                        <div className="flex items-center justify-end">
                                            Laba
                                            {getSortIcon('profit')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[100px] text-center cursor-pointer hover:bg-muted/50 transition-colors"
                                        onClick={() => handleSort('status')}
                                    >
                                        <div className="flex items-center justify-center">
                                            Status
                                            {getSortIcon('status')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[100px] text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sortedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                            Tidak ada data transaksi yang sesuai.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedTransactions.map(t => {
                                        let tCOGS = 0;
                                        if (t.items) {
                                            t.items.forEach(i => {
                                                let buyPrice = i.buyPrice;
                                                if (buyPrice === undefined || buyPrice === null) {
                                                    const product = productMap.get(i.id) || productMap.get(i.name);
                                                    buyPrice = product ? product.buyPrice : 0;
                                                }
                                                tCOGS += Number(buyPrice || 0) * i.qty;
                                            });
                                        }

                                        const tProfit = t.total - tCOGS;
                                        const isVoid = t.status === 'void' || t.status === 'cancelled';

                                        return (
                                            <TableRow key={t.id} className={isVoid ? 'bg-muted/50' : ''}>
                                                <TableCell className="font-mono text-xs w-[120px]">#{t.id}</TableCell>
                                                <TableCell className="w-[140px]">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{new Date(t.date).toLocaleDateString('id-ID')}</span>
                                                        <span className="text-xs text-muted-foreground">{new Date(t.date).toLocaleTimeString('id-ID')}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{t.customerName || 'Umum'}</TableCell>
                                                <TableCell>
                                                    <span className="capitalize text-sm font-medium">
                                                        {formatPaymentMethod(t.paymentMethod)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="w-[100px]">{t.cashier || '-'}</TableCell>
                                                <TableCell className="w-[80px] text-center">{t.items ? t.items.length : 0}</TableCell>
                                                <TableCell className="w-[100px] text-right text-red-500 font-medium">
                                                    {t.discount > 0 ? `-Rp ${t.discount.toLocaleString()}` : '-'}
                                                </TableCell>
                                                <TableCell className={`font-medium w-[120px] text-right ${isVoid ? 'line-through text-muted-foreground' : ''}`}>
                                                    Rp {t.total.toLocaleString()}
                                                </TableCell>
                                                <TableCell className={`font-medium w-[120px] text-right ${isVoid ? 'text-muted-foreground' : 'text-green-600'}`}>
                                                    {isVoid ? '-' : `Rp ${tProfit.toLocaleString()}`}
                                                </TableCell>
                                                <TableCell className="text-center w-[100px]">
                                                    {isVoid ? (
                                                        <span
                                                            className="text-xs text-destructive font-medium cursor-help border-b border-dotted border-destructive"
                                                            title={`Alasan: ${t.voidReason || t.cancelReason || '-'}`}
                                                        >
                                                            Dibatalkan
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-green-600 font-medium">Sukses</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right w-[100px]">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleViewReceipt(t)}
                                                            title="Lihat Struk"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {(user?.role === 'owner' || user?.role === 'super_admin' || (user?.role === 'admin' && (user?.permissions?.includes('transactions.void') || user?.permissions?.includes('transactions.refund')))) && !isVoid && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCancelClick(t);
                                                                }}
                                                                title="Batalkan Transaksi"
                                                            >
                                                                <XCircle className="h-4 w-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <ReceiptModal
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                transaction={selectedTransaction}
                store={currentStore}
            />

            <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Batalkan Transaksi
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <p className="text-sm text-muted-foreground">
                            Apakah Anda yakin ingin membatalkan transaksi <strong>#{transactionToCancel?.id.slice(-6)}</strong>?
                            <br />
                            Stok produk akan dikembalikan dan transaksi akan ditandai sebagai batal.
                        </p>
                        <div className="space-y-2">
                            <Label htmlFor="cancelReason">Alasan Pembatalan <span className="text-destructive">*</span></Label>
                            <Input
                                id="cancelReason"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Contoh: Salah input barang, Pelanggan batal beli"
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)} disabled={isCancelling}>Batal</Button>
                        <Button variant="destructive" onClick={confirmCancel} disabled={!cancelReason.trim() || isCancelling}>
                            {isCancelling ? 'Memproses...' : 'Ya, Batalkan Transaksi'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ProfitLoss;
