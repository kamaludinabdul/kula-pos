import React, { useState, useMemo, useEffect } from 'react';
import { DollarSign, TrendingUp, ShoppingBag, TrendingDown, Download, Eye, XCircle, AlertTriangle, ArrowUp, ArrowDown, ArrowUpDown, Search, RefreshCw } from 'lucide-react';
import ReceiptModal from '../../components/ReceiptModal';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { exportToCSV, getDateRange, formatPaymentMethod } from '../../lib/utils';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { safeSupabaseQuery, safeSupabaseRpc } from '../../utils/supabaseHelper';
import { Calendar } from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ProfitLoss = () => {
    const { products, currentStore, voidTransaction, fetchAllProducts, activeStoreId } = useData();
    const { user } = useAuth();

    // Products are not loaded by default (Phase 2 removed from DataContext).
    // We need them as fallback for buy price lookup on older transactions.
    useEffect(() => {
        if (activeStoreId && products.length === 0) {
            fetchAllProducts(activeStoreId);
        }
    }, [activeStoreId, products.length, fetchAllProducts]);
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
    const fetchReportData = React.useCallback(async () => {
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
            const transData = await safeSupabaseQuery({
                tableName: 'transactions',
                queryBuilder: (q) => q.eq('store_id', currentStore.id)
                    .gte('date', startDateStr)
                    .lte('date', endDateStr)
                    .order('date', { ascending: false })
                    .limit(100),
                fallbackParams: `?store_id=eq.${currentStore.id}&date=gte.${startDateStr}&date=lte.${endDateStr}&order=date.desc&limit=100`
            });

            // Map snake_case to camelCase for UI compatibility
            const mappedTransData = (transData || []).map(t => ({
                ...t,
                paymentMethod: t.payment_method,
                customerName: t.customer_name
            }));

            setTransactions(mappedTransData);

            // 2. Fetch Aggregated Stats via RPC
            const reportStats = await safeSupabaseRpc({
                rpcName: 'get_profit_loss_report',
                params: {
                    p_store_id: currentStore.id,
                    p_start_date: startDateStr,
                    p_end_date: endDateStr
                }
            });

            if (reportStats) {
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
    }, [currentStore, datePickerDate]);

    useEffect(() => {
        fetchReportData();
    }, [fetchReportData]);

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
                t.id.toUpperCase(),
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Laba Rugi</h2>
                    <p className="text-muted-foreground">Ringkasan performa keuangan bisnis Anda.</p>
                </div>
                <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-2">
                    <div className="flex gap-2 w-full lg:w-auto">
                        <Button variant="outline" onClick={fetchReportData} disabled={isLoading} className="flex-1 lg:flex-none">
                            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button variant="outline" onClick={handleExportPDF} disabled={isLoading} className="flex-1 lg:flex-none">
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                        <Button variant="outline" onClick={handleExport} disabled={isLoading} className="flex-1 lg:flex-none">
                            <Download className="mr-2 h-4 w-4" />
                            CSV
                        </Button>
                    </div>
                    <div className="w-full lg:w-auto">
                        <SmartDatePicker
                            date={datePickerDate}
                            onDateChange={setDatePickerDate}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard
                    title="Laba Kotor"
                    value={`Rp ${(stats.totalSales - stats.totalCOGS).toLocaleString()}`}
                    icon={TrendingUp}
                    variant="primary"
                />
                <InfoCard
                    title="Laba Bersih"
                    value={`Rp ${stats.netProfit.toLocaleString()}`}
                    icon={TrendingUp}
                    variant="success"
                />
                <InfoCard
                    title="Total Pemasukan"
                    value={`Rp ${stats.totalSales.toLocaleString()}`}
                    icon={DollarSign}
                    variant="default"
                />
                <InfoCard
                    title="Pendapatan Lain"
                    value={`Rp ${stats.otherIncome.toLocaleString()}`}
                    icon={DollarSign}
                    variant="info"
                />
                <InfoCard
                    title="Total Diskon"
                    value={`Rp ${stats.totalDiscount.toLocaleString()}`}
                    icon={TrendingDown}
                    variant="warning"
                />
                <InfoCard
                    title="Biaya Operasional"
                    value={`Rp ${stats.totalExpenses.toLocaleString()}`}
                    icon={ArrowDown}
                    variant="danger"
                />
                <InfoCard
                    title="HPP"
                    value={`Rp ${stats.totalCOGS.toLocaleString()}`}
                    icon={ShoppingBag}
                    variant="default"
                />
                <InfoCard
                    title="Belanja Aset"
                    value={`Rp ${stats.totalAssets.toLocaleString()}`}
                    icon={ShoppingBag}
                    variant="primary"
                    description="Tidak mengurangi laba"
                />
            </div>

            <Card className="rounded-xl border-none shadow-sm overflow-hidden">
                <CardHeader className="flex flex-col space-y-4 p-4 lg:p-6 bg-white border-b">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-bold">Riwayat Transaksi</CardTitle>
                    </div>
                    <div className="flex flex-col lg:flex-row gap-2 w-full">
                        <div className="relative flex-1">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari ID, Pelanggan..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 rounded-lg border-slate-200"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-full lg:w-[150px] h-10 rounded-lg border-slate-200">
                                    <SelectValue placeholder="Status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Semua Status</SelectItem>
                                    <SelectItem value="success">Sukses</SelectItem>
                                    <SelectItem value="void">Dibatalkan</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                                <SelectTrigger className="w-full lg:w-[150px] h-10 rounded-lg border-slate-200">
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
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop Table View */}
                    <div className="hidden xl:block">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[80px]">ID</TableHead>
                                    <TableHead
                                        className="w-[140px] cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('date')}
                                    >
                                        <div className="flex items-center font-bold text-slate-700">
                                            Waktu
                                            {getSortIcon('date')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('customer')}
                                    >
                                        <div className="flex items-center font-bold text-slate-700">
                                            Pelanggan
                                            {getSortIcon('customer')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[100px] cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('paymentMethod')}
                                    >
                                        <div className="flex items-center font-bold text-slate-700">
                                            Metode
                                            {getSortIcon('paymentMethod')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[100px] cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('cashier')}
                                    >
                                        <div className="flex items-center font-bold text-slate-700">
                                            Kasir
                                            {getSortIcon('cashier')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[80px] text-center cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('items')}
                                    >
                                        <div className="flex items-center justify-center font-bold text-slate-700">
                                            Items
                                            {getSortIcon('items')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[100px] text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('discount')}
                                    >
                                        <div className="flex items-center justify-end font-bold text-slate-700">
                                            Diskon
                                            {getSortIcon('discount')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[120px] text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('total')}
                                    >
                                        <div className="flex items-center justify-end font-bold text-slate-700">
                                            Total
                                            {getSortIcon('total')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[120px] text-right cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('profit')}
                                    >
                                        <div className="flex items-center justify-end font-bold text-slate-700">
                                            Laba
                                            {getSortIcon('profit')}
                                        </div>
                                    </TableHead>
                                    <TableHead
                                        className="w-[100px] text-center cursor-pointer hover:bg-slate-100 transition-colors"
                                        onClick={() => handleSort('status')}
                                    >
                                        <div className="flex items-center justify-center font-bold text-slate-700">
                                            Status
                                            {getSortIcon('status')}
                                        </div>
                                    </TableHead>
                                    <TableHead className="w-[100px] text-right font-bold text-slate-700">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : sortedTransactions.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                                            Tidak ada data transaksi yang sesuai.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    sortedTransactions.map(t => {
                                        let tCOGS = 0;
                                        if (t.items) {
                                            t.items.forEach(i => {
                                                // Check both camelCase AND snake_case (database uses snake_case)
                                                let buyPrice = i.buyPrice ?? i.buy_price;
                                                if (buyPrice === undefined || buyPrice === null) {
                                                    const product = productMap.get(i.id) || productMap.get(i.name);
                                                    buyPrice = product ? (product.buyPrice ?? product.buy_price ?? 0) : 0;
                                                }
                                                tCOGS += Number(buyPrice || 0) * i.qty;
                                            });
                                        }

                                        const tProfit = t.total - tCOGS;
                                        const isVoid = t.status === 'void' || t.status === 'cancelled';

                                        return (
                                            <TableRow key={t.id} className={`${isVoid ? 'bg-slate-50 opacity-60' : 'hover:bg-slate-50 transition-colors'} border-b border-slate-100`}>
                                                <TableCell className="font-mono text-[10px] text-slate-500">#{t.id.toUpperCase()}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-800">{new Date(t.date).toLocaleDateString('id-ID')}</span>
                                                        <span className="text-[10px] font-medium text-slate-400">{new Date(t.date).toLocaleTimeString('id-ID')}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-700">{t.customerName || 'Umum'}</TableCell>
                                                <TableCell>
                                                    <span className="capitalize text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                                        {formatPaymentMethod(t.paymentMethod)}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-slate-600 text-xs font-medium">{t.cashier || '-'}</TableCell>
                                                <TableCell className="text-center font-bold text-slate-800">{t.items ? t.items.length : 0}</TableCell>
                                                <TableCell className="text-right text-red-500 font-bold">
                                                    {t.discount > 0 ? `-Rp ${t.discount.toLocaleString()}` : '-'}
                                                </TableCell>
                                                <TableCell className={`font-extrabold text-right text-slate-900 ${isVoid ? 'line-through text-slate-300' : ''}`}>
                                                    Rp {t.total.toLocaleString()}
                                                </TableCell>
                                                <TableCell className={`font-extrabold text-right ${isVoid ? 'text-slate-300' : 'text-green-600'}`}>
                                                    {isVoid ? '-' : `Rp ${tProfit.toLocaleString()}`}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {isVoid ? (
                                                        <span
                                                            className="text-[9px] uppercase tracking-tighter bg-red-50 text-red-600 px-2 py-1 rounded font-bold border border-red-100 cursor-help"
                                                            title={`Alasan: ${t.voidReason || t.cancelReason || '-'}`}
                                                        >
                                                            VOID
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] uppercase tracking-tighter bg-green-50 text-green-600 px-2 py-1 rounded font-bold border border-green-100">SUKSES</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                                                            onClick={() => handleViewReceipt(t)}
                                                            title="Lihat Struk"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {(user?.role === 'owner' || user?.role === 'super_admin' || (user?.role === 'admin' && (user?.permissions?.includes('transactions.void') || user?.permissions?.includes('transactions.refund')))) && !isVoid && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
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

                    <div className="xl:hidden divide-y divide-slate-50">
                        {isLoading ? (
                            <div className="text-center py-12 text-muted-foreground font-medium">Memuat data...</div>
                        ) : sortedTransactions.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground font-medium">Tidak ada transaksi.</div>
                        ) : (
                            sortedTransactions.map(t => {
                                let tCOGS = 0;
                                if (t.items) {
                                    t.items.forEach(i => {
                                        // Check both camelCase AND snake_case
                                        let buyPrice = i.buyPrice ?? i.buy_price;
                                        if (buyPrice === undefined || buyPrice === null) {
                                            const product = productMap.get(i.id) || productMap.get(i.name);
                                            buyPrice = product ? (product.buyPrice ?? product.buy_price ?? 0) : 0;
                                        }
                                        tCOGS += Number(buyPrice || 0) * i.qty;
                                    });
                                }
                                const tProfit = t.total - tCOGS;
                                const isVoid = t.status === 'void' || t.status === 'cancelled';

                                return (
                                    <div key={t.id} className={`p-4 space-y-3 relative overflow-hidden ${isVoid ? 'bg-slate-50 opacity-60' : 'bg-white'}`}>
                                        <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${isVoid ? 'bg-red-500' : 'bg-green-500'}`} />
                                        <div className="flex justify-between items-start pl-2">
                                            <div className="space-y-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-[9px] text-slate-500 font-bold uppercase tracking-widest break-all max-w-[120px]">#{t.id}</span>
                                                    {isVoid ? (
                                                        <span className="text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-red-100">VOID</span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded uppercase tracking-tighter border border-indigo-100">{formatPaymentMethod(t.paymentMethod)}</span>
                                                    )}
                                                </div>
                                                <p className="font-bold text-slate-900 truncate">{t.customerName || 'Pelanggan Umum'}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                    {new Date(t.date).toLocaleDateString('id-ID')} • {new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className={`text-base font-extrabold ${isVoid ? 'text-slate-300 line-through' : 'text-slate-900'}`}>
                                                    Rp {t.total.toLocaleString()}
                                                </p>
                                                {!isVoid && (
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">LABA Rp {tProfit.toLocaleString()}</span>
                                                        {t.discount > 0 && (
                                                            <span className="text-[9px] font-bold text-red-500 uppercase tracking-tighter">DISC Rp {t.discount.toLocaleString()}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center pt-2 border-t border-slate-50 pl-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[60%]">{t.items?.length || 0} ITEMS • {t.cashier || 'Kasir'}</span>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-300 hover:text-indigo-600"
                                                    onClick={() => handleViewReceipt(t)}
                                                >
                                                    <Eye size={16} />
                                                </Button>
                                                {!isVoid && (user?.role === 'owner' || user?.role === 'super_admin' || (user?.role === 'admin' && (user?.permissions?.includes('transactions.void')))) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-slate-300 hover:text-red-500"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleCancelClick(t);
                                                        }}
                                                    >
                                                        <XCircle size={16} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
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
                            Apakah Anda yakin ingin membatalkan transaksi <strong>#{transactionToCancel?.id}</strong>?
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
