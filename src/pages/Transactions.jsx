import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { InfoCard } from '../components/ui/info-card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { supabase } from '../supabase';

import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, Filter, Download, Trash2, Edit, Eye, ChevronDown, RotateCcw, Ban, ArrowUpDown, ArrowUp, ArrowDown, BookLock, Wallet, TrendingUp, TrendingDown, MoreVertical, RefreshCw } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import { SmartDatePicker } from '../components/SmartDatePicker';
import { format, startOfDay, endOfDay } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import AlertDialog from '../components/AlertDialog';
import { formatPaymentMethod } from '../lib/utils';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import Pagination from '../components/Pagination';

const Transactions = () => {
    // user unused
    const { user, checkPermission } = useAuth();
    const { voidTransaction, processRefund, currentStore } = useData();


    // -- Local Data State (Pagination) --
    const [transactionsList, setTransactionsList] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(20);
    const [isLoading, setIsLoading] = useState(false);
    const [totalItems, setTotalItems] = useState(0);

    // -- Filters & Sorting --
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // all, completed, void
    const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
    const [datePickerDate, setDatePickerDate] = useState({
        from: new Date(new Date().setHours(0, 0, 0, 0)),
        to: new Date()
    });

    // -- UI State --
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isReceiptOpen, setIsReceiptOpen] = useState(false);
    const [expandedTxIds, setExpandedTxIds] = useState(new Set());

    // Dialogs
    const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
    const [voidReason, setVoidReason] = useState('');
    const [transactionToVoid, setTransactionToVoid] = useState(null);
    const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [transactionToRefund, setTransactionToRefund] = useState(null);

    // -- Alert State --
    const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '' });

    // -- Summary Cards State --
    const [summaryStats, setSummaryStats] = useState({
        revenue: 0,
        count: 0,
        cash: 0,
        qris: 0,
        transfer: 0,
        loading: true
    });

    // -- Close Book State --
    const [isCloseBookDialogOpen, setIsCloseBookDialogOpen] = useState(false);
    const [closeBookStats, setCloseBookStats] = useState(null);
    const [existingRekapId, setExistingRekapId] = useState(null);
    const [isProcessingCloseBook, setIsProcessingCloseBook] = useState(false);

    // -- Data Fetching Logic --

    const fetchTransactions = useCallback(async (page = 1) => {
        if (!currentStore?.id) return;

        setIsLoading(true);
        try {
            let query = supabase
                .from('transactions')
                .select('*, profiles:cashier_id(name)', { count: 'exact' })
                .eq('store_id', currentStore.id);

            // Filter Application
            if (searchTerm) {
                query = query.ilike('id', `%${searchTerm}%`);
            } else {
                if (statusFilter !== 'all') {
                    query = query.eq('status', statusFilter);
                }
                if (paymentMethodFilter !== 'all') {
                    query = query.eq('payment_method', paymentMethodFilter);
                }

                if (datePickerDate?.from) {
                    query = query.gte('date', datePickerDate.from.toISOString());
                    const endDate = datePickerDate.to ? new Date(datePickerDate.to) : new Date(datePickerDate.from);
                    endDate.setHours(23, 59, 59, 999);
                    query = query.lte('date', endDate.toISOString());
                }
            }

            // Sorting and Pagination
            const from = (page - 1) * itemsPerPage;
            const to = from + itemsPerPage - 1;

            const { data, count, error } = await query
                .order('date', { ascending: false })
                .range(from, to);

            if (error) throw error;

            // Map snake_case to camelCase for UI components (ReceiptModal, Table)
            const mappedData = (data || []).map(t => ({
                ...t,
                paymentMethod: t.payment_method,
                customerName: t.customer_name,
                cashier: t.profiles?.name || t.cashier || '-', // From joined profiles table or direct cashier column
                // Extract details from payment_details JSONB if available
                amountPaid: t.payment_details?.amount_paid || t.total,
                change: t.payment_details?.change || 0,
                pointsEarned: t.payment_details?.points_earned || 0,
                customerTotalPoints: t.payment_details?.customer_remaining_points || 0,
                // Ensure items is array
                items: Array.isArray(t.items) ? t.items : (JSON.parse(t.items || '[]'))
            }));

            setTransactionsList(mappedData);
            setTotalItems(count || 0);

        } catch (error) {
            console.error("Error fetching transactions:", error);
            setTransactionsList([]);
        } finally {
            setIsLoading(false);
        }
    }, [currentStore?.id, searchTerm, statusFilter, paymentMethodFilter, datePickerDate, itemsPerPage]);


    // Use stable primitives for dependencies to avoid infinite loops
    const storeId = currentStore?.id;
    const dateFromStr = datePickerDate?.from?.getTime();
    const dateToStr = datePickerDate?.to?.getTime();

    // Debug: Log component Lifecycle
    useEffect(() => {
        console.log("Transactions: Component Mounted (v0.8.21)", { storeId });
        return () => console.log("Transactions: Component Unmounted");
    }, [storeId]);


    // [MOVED] Fetch Summary Logic (Refactored to be callable)
    const fetchSummary = useCallback(async () => {
        if (!storeId) return;
        setSummaryStats(prev => ({ ...prev, loading: true }));

        try {
            console.log("Transactions: Fetching Summary for store", storeId);
            // Use date-fns for robust date range calculation
            const start = startOfDay(new Date(dateFromStr));
            const end = endOfDay(dateToStr ? new Date(dateToStr) : new Date(dateFromStr));

            // Use a broader select to ensure we get all needed fields
            let query = supabase
                .from('transactions')
                .select('id, total, status, payment_method')
                .eq('store_id', storeId)
                .gte('date', start.toISOString())
                .lte('date', end.toISOString());

            const { data, error } = await query;
            if (error) throw error;

            // Filter valid transactions in JS for maximum reliability
            const validTxs = (data || []).filter(tx =>
                tx.status !== 'void' &&
                tx.status !== 'refunded' &&
                tx.status !== 'cancelled'
            );

            const revenue = validTxs.reduce((sum, tx) => sum + (parseFloat(tx.total) || 0), 0);
            const count = validTxs.length;

            // Calculate per-method totals with case-insensitivity and fallback for Indonesian labels
            const cash = validTxs
                .filter(tx => {
                    const m = tx.payment_method?.toLowerCase();
                    return m === 'cash' || m === 'tunai';
                })
                .reduce((sum, tx) => sum + (parseFloat(tx.total) || 0), 0);

            const qris = validTxs
                .filter(tx => tx.payment_method?.toLowerCase() === 'qris')
                .reduce((sum, tx) => sum + (parseFloat(tx.total) || 0), 0);

            const transfer = validTxs
                .filter(tx => tx.payment_method?.toLowerCase() === 'transfer')
                .reduce((sum, tx) => sum + (parseFloat(tx.total) || 0), 0);

            setSummaryStats({
                revenue,
                count,
                cash,
                qris,
                transfer,
                loading: false
            });

        } catch (error) {
            console.error("Error fetching summary stats:", error);
            setSummaryStats(prev => ({ ...prev, loading: false }));
        }
    }, [storeId, dateFromStr, dateToStr]);


    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSummary();
        }, 300);
        return () => clearTimeout(timer);
    }, [fetchSummary]);

    // [NEW] Handle Manual Refresh
    const handleRefresh = () => {
        fetchTransactions(currentPage);
        fetchSummary();
    };

    // Effect: Trigger fetch on filters change
    useEffect(() => {
        const timer = setTimeout(() => {
            console.log("Transactions: Fetching List due to filter change");
            if (searchTerm) {
                setTransactionsList([]);
                fetchTransactions(1, true);
            } else {
                setCurrentPage(1);  // Reset page
                fetchTransactions(1, true);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [storeId, searchTerm, statusFilter, paymentMethodFilter, dateFromStr, dateToStr, itemsPerPage, fetchTransactions]);

    const handlePageChange = (page) => {
        setCurrentPage(page);
        fetchTransactions(page);
    };

    const handleItemsPerPageChange = (newLimit) => {
        setItemsPerPage(newLimit);
        // Reset will be handled by the effect or we should handle it here?
        // The Pagination component logic resets to page 1 in Select onValueChange,
        // so here we just set state, and the effect below (timer) handles the fetch?
        // Actually the Effect depends on `itemsPerPage` now.
        // So it will trigger `fetchTransactions` automatically via the debounce timer Effect.
        // Wait, the effect has a debounce timer.
        // But `handlePageChange` triggers `fetchTransactions` directly.
        // Let's rely on the Effect for filters loop, but for Page Change we do it direct.
        // For Limit Change, we update state, Effect triggers fetch. Correct.
    };



    const toggleRow = (txId) => {
        const newExpanded = new Set(expandedTxIds);
        if (newExpanded.has(txId)) {
            newExpanded.delete(txId);
        } else {
            newExpanded.add(txId);
        }
        setExpandedTxIds(newExpanded);
    };

    // Sort functions removed (unused)

    // Helper functions for actions (Receipt, Void, Refund)
    const handleViewReceipt = (transaction) => {
        setSelectedTransaction(transaction);
        setIsReceiptOpen(true);
    };

    const handleVoidClick = (transaction) => {
        setTransactionToVoid(transaction);
        setVoidReason('');
        setIsVoidDialogOpen(true);
    };

    const confirmVoid = async () => {
        if (!transactionToVoid || !voidReason) return;
        const result = await voidTransaction(transactionToVoid.id, voidReason);
        if (result.success) {
            setIsVoidDialogOpen(false);
            setTransactionToVoid(null);
            // Refresh list to update status
            fetchTransactions(true);
        } else {
            alert(`Gagal membatalkan transaksi: ${result.error}`);
        }
    };

    const handleRefundClick = (transaction) => {
        setTransactionToRefund(transaction);
        setRefundReason('');
        setIsRefundDialogOpen(true);
    };

    const confirmRefund = async () => {
        if (!transactionToRefund || !refundReason) return;
        const result = await processRefund(transactionToRefund.id, refundReason);
        if (result.success) {
            // Refund hanya mengubah status transaksi, tidak dicatat ke cash_flow
            // karena transaksi refunded sudah tidak dihitung di Tutup Buku
            setIsRefundDialogOpen(false);
            setTransactionToRefund(null);
            fetchTransactions(true);
        } else {
            alert(`Gagal memproses refund: ${result.error}`);
        }
    };

    // -- Close Book Logic --
    const handleOpenCloseBookDialog = async () => {
        if (!currentStore?.id) return;

        // [NEW] Validation: Ensure strictly single day
        if (datePickerDate?.to && (new Date(datePickerDate.from).toDateString() !== new Date(datePickerDate.to).toDateString())) {
            setAlertConfig({
                isOpen: true,
                title: "Rentang Tanggal Tidak Valid",
                message: "Fitur Tutup Buku hanya bisa dilakukan untuk 1 tanggal spesifik.\nSilakan ganti filter tanggal menjadi 1 hari saja."
            });
            return;
        }

        setIsProcessingCloseBook(true);
        try {
            // 1. Calculate Date Range for selected date
            const start = new Date(datePickerDate.from);
            start.setHours(0, 0, 0, 0);
            const end = datePickerDate.to ? new Date(datePickerDate.to) : new Date(start);
            end.setHours(23, 59, 59, 999);

            // Format for display & storage
            const dateStr = format(start, 'yyyy-MM-dd');

            // 2. Fetch Completed Transactions
            const { data: sales, error: salesError } = await supabase
                .from('transactions')
                .select('total')
                .eq('store_id', currentStore.id)
                .eq('status', 'completed')
                .gte('date', start.toISOString())
                .lte('date', end.toISOString());

            if (salesError) throw salesError;

            const totalSales = sales.reduce((sum, tx) => sum + (Number(tx.total) || 0), 0);
            const count = sales.length;

            // 3. Check for existing Rekap
            // 3. Check for existing Rekap (Handle both new 'Penjualan (Rekap)' and legacy 'Penjualan')
            const { data: cfData, error: cfError } = await supabase
                .from('cash_flow')
                .select('*')
                .eq('store_id', currentStore.id)
                .in('category', ['Penjualan (Rekap)', 'Penjualan']) // Check both to avoid duplicates
                .eq('date', dateStr)
                .limit(1);

            if (cfError) throw cfError;

            let existingId = null;
            let previousAmount = 0;
            if (cfData && cfData.length > 0) {
                existingId = cfData[0].id;
                previousAmount = cfData[0].amount;
            }

            setCloseBookStats({
                date: start,
                totalSales,
                count,
                dateStr,
                previousAmount
            });
            setExistingRekapId(existingId);
            setIsCloseBookDialogOpen(true);

        } catch (err) {
            console.error(err);
            alert("Gagal memuat ringkasan buku.");
        } finally {
            setIsProcessingCloseBook(false);
        }
    };

    const confirmCloseBook = async () => {
        if (!closeBookStats) return;
        setIsProcessingCloseBook(true);
        try {
            const data = {
                store_id: currentStore.id,
                type: 'in',
                category: 'Penjualan (Rekap)',
                amount: closeBookStats.totalSales,
                description: `Rekap Penjualan ${format(closeBookStats.date, 'dd MMM yyyy', { locale: localeId })} (${closeBookStats.count} Transaksi)`,
                date: closeBookStats.dateStr,
                performed_by: user?.name || 'Admin',
                created_at: new Date().toISOString()
            };

            if (existingRekapId) {
                const { error } = await supabase
                    .from('cash_flow')
                    .update(data)
                    .eq('id', existingRekapId);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('cash_flow')
                    .insert(data);
                if (error) throw error;
            }

            setIsCloseBookDialogOpen(false);
            alert(existingRekapId ? "Rekap berhasil diperbarui!" : "Tutup buku berhasil!");

        } catch (err) {
            console.error(err);
            alert("Terjadi kesalahan saat menyimpan rekap.");
        } finally {
            setIsProcessingCloseBook(false);
        }
    };

    const exportData = () => {
        // Export logic (currently exports visible list, maybe should export filtered full list?)
        // For pagination, usually export needs a separate full fetch.
        // For now, let's just export what's loaded or maybe first 500?
        // User didn't specify, let's keep it simple: Export loaded transactions.
        const headers = ['ID', 'Date', 'Cashier', 'Customer', 'Items', 'Total', 'Status', 'Payment Method'];
        const csvContent = [
            headers.join(','),
            ...transactionsList.map(t => [
                t.id,
                new Date(t.date).toLocaleString(),
                t.cashier,
                t.customerName || '-',
                t.items.length,
                t.total,
                t.status,
                t.paymentMethod
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `transactions_${new Date().toISOString()}.csv`;
        link.click();
    };

    const handleExportPDF = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text(currentStore?.name || 'Riwayat Transaksi', 14, 20);
        doc.setFontSize(12);
        doc.text(`Tanggal Cetak: ${new Date().toLocaleString('id-ID')}`, 14, 28);

        const tableBody = transactionsList.map(t => [
            t.id.slice(-6),
            format(new Date(t.date), 'dd/MM/yyyy HH:mm'),
            t.customerName || 'Umum',
            t.items?.length || 0,
            `Rp ${t.total.toLocaleString()}`,
            t.status === 'completed' ? 'Sukses' : (t.status === 'refunded' ? 'Refund' : 'Batal'),
            t.paymentMethod || '-'
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['ID', 'Waktu', 'Pelanggan', 'Items', 'Total', 'Status', 'Metode']],
            body: tableBody,
            headStyles: { fillColor: [41, 128, 185] },
            styles: { fontSize: 8 },
        });

        doc.save(`Transaksi_${new Date().toISOString().split('T')[0]}.pdf`);
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Transaksi</h1>
                    <p className="text-muted-foreground">Kelola dan pantau riwayat transaksi penjualan.</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    <Button variant="outline" onClick={handleRefresh} className="flex-1 sm:flex-none" title="Segarkan Data">
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button variant="outline" onClick={handleOpenCloseBookDialog} disabled={isProcessingCloseBook} className="flex-1 sm:flex-none">
                        <BookLock className="mr-2 h-4 w-4" />
                        {isProcessingCloseBook ? "..." : "Tutup Buku Harian"}
                    </Button>
                    <div className="flex gap-2 w-full sm:w-auto">
                        {checkPermission('transactions.view') && (
                            <>
                                <Button variant="outline" onClick={handleExportPDF} className="flex-1 sm:flex-none px-2 sm:px-4">
                                    <Download className="mr-1 sm:mr-2 h-4 w-4" />
                                    PDF
                                </Button>
                                <Button variant="outline" onClick={exportData} className="flex-1 sm:flex-none px-2 sm:px-4">
                                    <Download className="mr-1 sm:mr-2 h-4 w-4" />
                                    CSV
                                </Button>
                            </>
                        )}
                    </div>
                </div>
            </div>


            {/* Summary Cards */}
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
                <InfoCard
                    title="Total Pendapatan"
                    value={summaryStats.loading ? "..." : `Rp ${summaryStats.revenue.toLocaleString()}`}
                    icon={Wallet}
                    variant="success"
                    description="Total pendapatan bersih"
                />
                <InfoCard
                    title="Tunai (Cash)"
                    value={summaryStats.loading ? "..." : `Rp ${summaryStats.cash.toLocaleString()}`}
                    icon={Wallet}
                    variant="warning"
                    description="Pembayaran tunai"
                />
                <InfoCard
                    title="QRIS / E-Wallet"
                    value={summaryStats.loading ? "..." : `Rp ${summaryStats.qris.toLocaleString()}`}
                    icon={TrendingUp}
                    variant="purple"
                    description="Dompet digital"
                />
                <InfoCard
                    title="Transfer Bank"
                    value={summaryStats.loading ? "..." : `Rp ${summaryStats.transfer.toLocaleString()}`}
                    icon={TrendingUp}
                    variant="info"
                    description="Transfer langsung"
                />
                <InfoCard
                    title="Total Transaksi"
                    value={summaryStats.loading ? "..." : `${summaryStats.count} Transaksi`}
                    icon={TrendingUp}
                    variant="primary"
                    description="Jumlah transaksi sukses"
                />
            </div>

            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="flex items-center gap-2">
                    <SmartDatePicker
                        date={datePickerDate}
                        onDateChange={setDatePickerDate}
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-[130px] max-w-full flex-1 md:flex-none">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Status</SelectItem>
                            <SelectItem value="completed">Berhasil</SelectItem>
                            <SelectItem value="void">Dibatalkan</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                        <SelectTrigger className="w-[150px] max-w-full flex-1 md:flex-none">
                            <SelectValue placeholder="Tipe Bayar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Tipe</SelectItem>
                            <SelectItem value="cash">Tunai</SelectItem>
                            <SelectItem value="qris">QRIS</SelectItem>
                            <SelectItem value="transfer">Transfer</SelectItem>
                        </SelectContent>
                    </Select>

                    <div className="relative w-full md:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari ID Transaksi..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 w-full"
                        />
                    </div>
                </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block rounded-xl border bg-white overflow-hidden shadow-sm">
                <Table className="min-w-[1000px]">
                    <TableHeader>
                        <TableRow>
                            {/* Headers can remain clickable for sort, but mostly relevant for loaded data or we implement server sort? */
                                /* For simplicity, we keep client sort on loaded data or disable sort for simplicity? */
                                /* Let's keep the UI but maybe disable functionality or make it sort the current page? */
                                /* Ideally server sort. But that requires index for every field. Let's simplfy to just visual headers for now or simplistic local sort */
                            }
                            <TableHead className="w-[100px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID</TableHead>
                            <TableHead className="w-[140px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Waktu</TableHead>
                            <TableHead className="w-[200px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Kasir</TableHead>
                            <TableHead className="w-[200px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pelanggan</TableHead>
                            <TableHead className="w-[140px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total</TableHead>
                            <TableHead className="w-[120px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</TableHead>
                            <TableHead className="w-[120px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tipe Bayar</TableHead>
                            <TableHead className="w-[100px] text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactionsList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                    {isLoading ? "Memuat data..." : "Tidak ada transaksi ditemukan."}
                                </TableCell>
                            </TableRow>
                        ) : (
                            transactionsList.map((tx) => (
                                <React.Fragment key={tx.id}>
                                    <TableRow
                                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${expandedTxIds.has(tx.id) ? "bg-muted/50" : ""}`}
                                        onClick={() => toggleRow(tx.id)}
                                    >
                                        <TableCell className="font-mono text-xs">
                                            #{tx.id}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium">
                                                    {format(new Date(tx.date), 'dd MMM yyyy', { locale: localeId })}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(tx.date), 'HH:mm', { locale: localeId })}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{tx.cashier || '-'}</TableCell>
                                        <TableCell>{tx.customerName || 'Umum'}</TableCell>
                                        <TableCell className="font-medium">
                                            Rp {tx.total?.toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={tx.status === 'void' ? 'error-subtle' : (tx.status === 'refunded' ? 'warning-subtle' : 'success-subtle')}
                                                className="font-bold border-none uppercase text-[10px]"
                                            >
                                                {tx.status === 'void' ? 'Batal' : (tx.status === 'refunded' ? 'Refund' : 'Berhasil')}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="neutral-subtle" className="capitalize font-bold border-none text-[10px]">
                                                {formatPaymentMethod(tx.paymentMethod)}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                                {checkPermission('transactions.detail') && (
                                                    <Button variant="ghost" size="icon" onClick={() => handleViewReceipt(tx)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                {tx.status !== 'void' && tx.status !== 'refunded' && checkPermission('transactions.refund') && (
                                                    <>
                                                        <Button variant="ghost" size="icon" onClick={() => handleRefundClick(tx)} className="text-orange-500 hover:text-orange-600" title="Refund">
                                                            <RotateCcw className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" onClick={() => handleVoidClick(tx)} className="text-destructive hover:text-destructive" title="Batalkan">
                                                            <Ban className="h-4 w-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                    {expandedTxIds.has(tx.id) && (
                                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                                            <TableCell colSpan={8} className="p-0">
                                                <div className="p-4 pl-12">
                                                    <div className="rounded-md border bg-white p-3 shadow-sm max-w-2xl">
                                                        <h4 className="font-semibold mb-2 text-sm">Detail Barang:</h4>
                                                        <div className="space-y-1">
                                                            {tx.items && tx.items.map((item, idx) => (
                                                                <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0 border-dashed">
                                                                    <span className="flex items-center gap-2">
                                                                        <span className="font-medium">{item.name}</span>
                                                                        <span className="text-muted-foreground text-xs">x{item.qty}</span>
                                                                    </span>
                                                                    <span>Rp {(item.price * item.qty).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
                {transactionsList.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed text-muted-foreground font-medium">
                        {isLoading ? "Memuat data..." : "Tidak ada transaksi ditemukan."}
                    </div>
                ) : (
                    transactionsList.map((tx) => (
                        <div key={tx.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3 relative overflow-hidden">
                            <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${tx.status === 'completed' ? 'bg-emerald-500' : (tx.status === 'refunded' ? 'bg-orange-500' : 'bg-red-500')}`} />
                            <div className="flex justify-between items-start pl-2">
                                <div className="space-y-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest truncate">#{tx.id}</span>
                                        <Badge
                                            variant={tx.status === 'void' ? 'error-subtle' : (tx.status === 'refunded' ? 'warning-subtle' : 'success-subtle')}
                                            className="text-[9px] font-bold px-1.5 py-0 border-none h-4 uppercase"
                                        >
                                            {tx.status === 'void' ? 'Batal' : (tx.status === 'refunded' ? 'Refund' : 'Sukses')}
                                        </Badge>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900">
                                            {format(new Date(tx.date), 'dd MMM yyyy', { locale: localeId })}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                            {format(new Date(tx.date), 'HH:mm', { locale: localeId })} • {tx.cashier || 'Kasir Umum'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                                    <span className={`text-lg font-extrabold ${tx.status === 'void' ? 'text-slate-300 line-through text-sm' : 'text-slate-900'}`}>
                                        Rp {tx.total?.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 py-2 border-y border-slate-50 pl-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pelanggan</span>
                                    <span className="text-xs font-bold text-slate-700 truncate">{tx.customerName || 'Umum'}</span>
                                </div>
                                <div className="flex flex-col text-right">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Metode Bayar</span>
                                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-tighter">
                                        {formatPaymentMethod(tx.paymentMethod)}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center pt-1 pl-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{tx.items?.length || 0} ITEMS</span>
                                <div className="flex gap-2">
                                    {checkPermission('transactions.detail') && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 hover:text-indigo-600" onClick={() => handleViewReceipt(tx)}>
                                            <Eye size={18} />
                                        </Button>
                                    )}
                                    {tx.status !== 'void' && tx.status !== 'refunded' && checkPermission('transactions.refund') && (
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300">
                                                    <MoreVertical size={18} />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => handleRefundClick(tx)} className="text-orange-500 font-bold text-xs">
                                                    <RotateCcw className="mr-2 h-4 w-4" /> Refund
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleVoidClick(tx)} className="text-red-500 font-bold text-xs">
                                                    <Ban className="mr-2 h-4 w-4" /> Batalkan
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Load More Button */}
            {/* Pagination Controls */}
            {/* Show pagination always if totalItems > 0 */}
            {totalItems > 0 && (
                <Pagination
                    currentPage={currentPage}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                    onItemsPerPageChange={handleItemsPerPageChange}
                // Remove isServerSide to use standard display
                />
            )}

            <ReceiptModal
                isOpen={isReceiptOpen}
                onClose={() => setIsReceiptOpen(false)}
                transaction={selectedTransaction}
                store={currentStore}
            />

            <Dialog open={isVoidDialogOpen} onOpenChange={setIsVoidDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Batalkan Transaksi</DialogTitle>
                        <DialogDescription>
                            Apakah Anda yakin ingin membatalkan transaksi ini? Stok akan dikembalikan dan data penjualan akan disesuaikan.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>ID Transaksi</Label>
                            <Input value={transactionToVoid?.id || ''} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="voidReason">Alasan Pembatalan <span className="text-destructive">*</span></Label>
                            <Input
                                id="voidReason"
                                value={voidReason}
                                onChange={(e) => setVoidReason(e.target.value)}
                                placeholder="Contoh: Salah input barang"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsVoidDialogOpen(false)}>Batal</Button>
                        <Button variant="destructive" onClick={confirmVoid} disabled={!voidReason}>
                            Konfirmasi Pembatalan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isRefundDialogOpen} onOpenChange={setIsRefundDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Proses Refund (Pengembalian)</DialogTitle>
                        <DialogDescription>
                            Proses pengembalian barang dan dana. Stok akan dikembalikan otomatis.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>ID Transaksi</Label>
                            <Input value={transactionToRefund?.id || ''} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="refundReason">Alasan Refund <span className="text-destructive">*</span></Label>
                            <Input
                                id="refundReason"
                                value={refundReason}
                                onChange={(e) => setRefundReason(e.target.value)}
                                placeholder="Contoh: Barang rusak, Salah ukuran"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRefundDialogOpen(false)}>Batal</Button>
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={confirmRefund} disabled={!refundReason}>
                            Konfirmasi Refund
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isCloseBookDialogOpen} onOpenChange={setIsCloseBookDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Tutup Buku Harian (Rekap Penjualan)</DialogTitle>
                        <DialogDescription>
                            Simpan total penjualan hari ini ke Arus Kas sebagai satu entri pemasukan.
                        </DialogDescription>
                    </DialogHeader>
                    {closeBookStats && (
                        <div className="space-y-4 py-4">
                            {existingRekapId && (
                                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-md text-sm mb-4">
                                    <strong>Perhatian:</strong> Rekap untuk tanggal ini sudah ada (Rp {closeBookStats.previousAmount?.toLocaleString()}).
                                    Data akan diperbarui dengan nilai baru di bawah.
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label className="text-muted-foreground">Tanggal</Label>
                                    <div className="font-medium">
                                        {format(closeBookStats.date, 'dd MMM yyyy', { locale: localeId })}
                                    </div>
                                </div>
                                <div className="space-y-1 text-right">
                                    <Label className="text-muted-foreground">Total Transaksi</Label>
                                    <div className="font-medium">{closeBookStats.count} Transaksi</div>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg flex justify-between items-center border">
                                <span className="font-semibold text-slate-700">Total Penjualan</span>
                                <span className="text-xl font-bold text-green-600">
                                    Rp {closeBookStats.totalSales.toLocaleString()}
                                </span>
                            </div>

                            <p className="text-xs text-muted-foreground text-center">
                                Hanya transaksi berstatus "Berhasil" yang dihitung.
                            </p>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCloseBookDialogOpen(false)}>Batal</Button>
                        <Button onClick={confirmCloseBook} disabled={isProcessingCloseBook || !closeBookStats}>
                            {isProcessingCloseBook ? "Menyimpan..." : (existingRekapId ? "Update Rekap" : "Simpan Rekap")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <AlertDialog
                isOpen={alertConfig.isOpen}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                title={alertConfig.title}
                message={alertConfig.message}
            />
        </div >
    );
};

export default Transactions;
