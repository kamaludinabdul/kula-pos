import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, ArrowUpDown, Trophy, Calendar, Settings2, History, Loader2, RefreshCw } from 'lucide-react';
import { getDateRange, cn } from '../../lib/utils';
import PointAdjustmentDialog from '../../components/PointAdjustmentDialog';
import PointHistoryDialog from '../../components/PointHistoryDialog';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';

const LoyaltyPointsReport = () => {
    const { customers, currentStore } = useData();
    const [viewMode, setViewMode] = useState('leaderboard'); // 'leaderboard' or 'history'
    const [historyTransactions, setHistoryTransactions] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const [datePickerDate, setDatePickerDate] = useState(() => {
        const { startDate, endDate } = getDateRange('today');
        return { from: startDate, to: endDate };
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'points', direction: 'desc' });
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
    const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);

    // --- Helper Functions ---
    const fetchHistoryTransactions = useCallback(async () => {
        if (!currentStore?.id || !datePickerDate?.from) return;

        setIsLoadingHistory(true);
        try {
            const startDate = new Date(datePickerDate.from);
            startDate.setHours(0, 0, 0, 0);

            const endDate = new Date(datePickerDate.to || datePickerDate.from);
            endDate.setHours(23, 59, 59, 999);

            const { data, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('store_id', currentStore.id)
                .gte('date', startDate.toISOString())
                .lte('date', endDate.toISOString())
                .order('date', { ascending: false });

            if (error) throw error;

            // Map data to include fallbacks, same as DataContext/Transactions
            const mapped = (data || []).map(t => ({
                ...t,
                customerId: t.customer_id,
                customerName: t.customer_name,
                pointsEarned: t.points_earned !== undefined ? Number(t.points_earned || 0) : Number(t.payment_details?.points_earned || 0),
                customerTotalPoints: Number(t.payment_details?.customer_remaining_points || 0),
                voidedAt: t.voided_at,
                amountPaid: Number(t.payment_details?.amount_paid || t.amount_paid || t.total || 0),
                pointsSpent: Number(t.payment_details?.redeemed_points || 0)
            }));

            setHistoryTransactions(mapped);
        } catch (error) {
            console.error("Error fetching loyalty history:", error);
        } finally {
            setIsLoadingHistory(false);
        }
    }, [currentStore?.id, datePickerDate]);

    useEffect(() => {
        if (viewMode === 'history') {
            fetchHistoryTransactions();
        }
    }, [viewMode, fetchHistoryTransactions]);

    const getFilteredTransactions = () => {
        return historyTransactions;
    };

    // --- Data Processing ---

    // 1. Leaderboard Data (All time points or filtered?)
    // Usually leaderboard is "Current Total Points" which is stored in customer object.
    // If user wants "Points Earned in Period", we calculate from transactions.
    // Let's provide both views.

    // View 1: Customer Leaderboard (Current Balance)
    const getLeaderboardData = () => {
        // Show all customers with any points (current or lifetime)
        let data = customers.filter(c => {
            const currentPoints = c.loyaltyPoints || c.points || 0;
            const lifetimePoints = c.totalLifetimePoints || 0;
            return currentPoints > 0 || lifetimePoints > 0;
        });

        if (searchTerm) {
            data = data.filter(c =>
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                c.phone.includes(searchTerm)
            );
        }

        // Map to display format
        data = data.map(c => {
            const currentPoints = c.loyaltyPoints || c.points || 0;
            // Ensure lifetime is at least current points (handling legacy data issues)
            const lifetimePoints = Math.max(c.totalLifetimePoints || 0, currentPoints);

            return {
                id: c.id,
                name: c.name,
                phone: c.phone,
                totalSpent: c.totalSpent || 0,
                points: currentPoints, // Current balance (after adjustments)
                lifetimePoints: lifetimePoints // Total earned from transactions
            };
        });

        // Sort
        data.sort((a, b) => {
            if (sortConfig.key === 'points') {
                return sortConfig.direction === 'asc' ? a.points - b.points : b.points - a.points;
            }
            if (sortConfig.key === 'lifetimePoints') {
                return sortConfig.direction === 'asc' ? a.lifetimePoints - b.lifetimePoints : b.lifetimePoints - a.lifetimePoints;
            }
            return 0;
        });

        return data;
    };

    // View 2: Points History (Transactions in period)
    const getHistoryData = () => {
        const filteredTrans = getFilteredTransactions();

        // Map to display format and generate cancellation rows
        let data = [];

        filteredTrans.forEach(t => {
            // Filter: Only include transactions with a customer AND points interaction
            // We show points earned OR points spent
            const hasPointsInteraction = (t.pointsEarned > 0) || (t.pointsSpent > 0);
            if (!t.customerId || !hasPointsInteraction) return;

            // Lookup customer name if the transaction record doesn't have it (denormalization insurance)
            const cName = t.customerName || customers.find(c => c.id === t.customerId)?.name || 'Pelanggan';

            // 1. Original Transaction Record
            data.push({
                id: t.id,
                date: t.date,
                customerName: cName,
                customerId: t.customerId,
                total: t.total,
                pointsEarned: t.pointsEarned > 0 ? t.pointsEarned : -t.pointsSpent,
                status: t.status,
                type: t.pointsEarned > 0 ? 'earning' : 'deduction'
            });

            // 2. Cancellation Record (if void)
            if ((t.status === 'void' || t.status === 'cancelled') && t.pointsEarned > 0) {
                data.push({
                    id: `${t.id}-void`,
                    // Use voidedAt if available, otherwise fallback to transaction date (slight delay)
                    date: t.voidedAt || t.date,
                    customerName: cName,
                    customerId: t.customerId,
                    total: 0,
                    pointsEarned: -t.pointsEarned,
                    status: 'system_deduction',
                    type: 'deduction'
                });
            }
        });

        if (searchTerm) {
            data = data.filter(item =>
                item.customerName.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        // Sort by date descending
        data.sort((a, b) => new Date(b.date) - new Date(a.date));

        return data;
    };

    const leaderboardData = getLeaderboardData();
    const historyData = getHistoryData();

    // --- Render ---

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Poin Loyalitas</h2>
                    <p className="text-muted-foreground">
                        Pantau perolehan poin pelanggan dan riwayat transaksi poin.
                    </p>
                </div>
                <Tabs value={viewMode} onValueChange={setViewMode} className="w-[400px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
                        <TabsTrigger value="history">Riwayat</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari Pelanggan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-[10px]"
                    />
                </div>

                {viewMode === 'history' && (
                    <div className="flex items-center gap-2">
                        <SmartDatePicker
                            date={datePickerDate}
                            onDateChange={setDatePickerDate}
                        />
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={fetchHistoryTransactions}
                            disabled={isLoadingHistory}
                            className="rounded-[10px]"
                            title="Refresh data"
                        >
                            <RefreshCw className={cn("h-4 w-4", isLoadingHistory && "animate-spin")} />
                        </Button>
                    </div>
                )}
            </div>

            {/* Content */}
            {viewMode === 'leaderboard' ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            Top Pelanggan Berdasarkan Poin
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">#</TableHead>
                                    <TableHead>Nama Pelanggan</TableHead>
                                    <TableHead>No HP</TableHead>
                                    <TableHead>Total Belanja</TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => setSortConfig({ key: 'lifetimePoints', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                                        <div className="flex items-center justify-end gap-1">
                                            Poin Sepanjang Masa
                                            <ArrowUpDown className="h-4 w-4" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer hover:bg-muted/50" onClick={() => setSortConfig({ key: 'points', direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}>
                                        <div className="flex items-center justify-end gap-1">
                                            Poin Saat Ini
                                            <ArrowUpDown className="h-4 w-4" />
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {leaderboardData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            Belum ada data poin pelanggan.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    leaderboardData.map((customer, index) => (
                                        <TableRow key={customer.id}>
                                            <TableCell>{index + 1}</TableCell>
                                            <TableCell className="font-medium">{customer.name}</TableCell>
                                            <TableCell>{customer.phone}</TableCell>
                                            <TableCell>Rp {(customer.totalSpent || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-medium text-blue-600">
                                                {(customer.lifetimePoints || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-amber-600">
                                                {(customer.points || 0).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => {
                                                            setSelectedCustomer(customer);
                                                            setIsAdjustDialogOpen(true);
                                                        }}
                                                    >
                                                        <Settings2 className="h-4 w-4 mr-1" />
                                                        Sesuaikan
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => {
                                                            setSelectedCustomer(customer);
                                                            setIsHistoryDialogOpen(true);
                                                        }}
                                                    >
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            Riwayat Perolehan Poin
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>ID Transaksi</TableHead>
                                    <TableHead>Pelanggan</TableHead>
                                    <TableHead>Total Belanja</TableHead>
                                    <TableHead className="text-right">Poin Didapat</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingHistory ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12">
                                            <div className="flex flex-col items-center justify-center gap-2">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                                <p className="text-muted-foreground animate-pulse">Memuat riwayat poin...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : historyData.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                            Tidak ada transaksi poin pada periode ini.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    historyData.map((item) => {
                                        const isVoidOrigin = (item.status === 'void' || item.status === 'cancelled') && item.type === 'earning';
                                        const isDeduction = item.type === 'deduction';

                                        return (
                                            <TableRow key={item.id} className={isVoidOrigin ? 'bg-slate-50 opacity-60' : (isDeduction ? 'bg-red-50' : '')}>
                                                <TableCell className={isVoidOrigin ? 'text-muted-foreground' : ''}>
                                                    {new Date(item.date).toLocaleString('id-ID')}
                                                </TableCell>
                                                <TableCell className={`font-mono text-xs ${isVoidOrigin ? 'line-through text-muted-foreground' : ''}`}>
                                                    {isDeduction ? `REF-${item.id.replace('-void', '').slice(-6)}` : `#${item.id.slice(-6)}`}
                                                </TableCell>
                                                <TableCell className={isVoidOrigin ? 'text-muted-foreground' : ''}>
                                                    {item.customerName}
                                                </TableCell>
                                                <TableCell className={isVoidOrigin ? 'text-muted-foreground line-through' : ''}>
                                                    {isDeduction ? '-' : `Rp ${item.total.toLocaleString()}`}
                                                </TableCell>
                                                <TableCell className={`text-right font-medium ${isVoidOrigin ? 'text-slate-400 line-through' : (isDeduction ? 'text-red-600' : 'text-green-600')}`}>
                                                    {item.pointsEarned > 0 ? `+${item.pointsEarned}` : item.pointsEarned}
                                                </TableCell>
                                                {isVoidOrigin && (
                                                    <TableCell className="text-slate-500 text-xs italic">
                                                        Dibatalkan
                                                    </TableCell>
                                                )}
                                                {isDeduction && (
                                                    <TableCell className="text-red-600 text-xs font-bold">
                                                        System Adjustment (Void)
                                                    </TableCell>
                                                )}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Dialogs */}
            <PointAdjustmentDialog
                open={isAdjustDialogOpen}
                onOpenChange={setIsAdjustDialogOpen}
                customer={selectedCustomer}
                onSuccess={() => {
                    // Refresh will happen via optimistic update in DataContext
                }}
            />

            <PointHistoryDialog
                open={isHistoryDialogOpen}
                onOpenChange={setIsHistoryDialogOpen}
                customer={selectedCustomer}
            />
        </div>
    );
};

export default LoyaltyPointsReport;
