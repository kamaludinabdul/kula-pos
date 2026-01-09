import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Search, ArrowUpDown, Trophy, Calendar, Settings2, History } from 'lucide-react';
import { getDateRange } from '../../lib/utils';
import PointAdjustmentDialog from '../../components/PointAdjustmentDialog';
import PointHistoryDialog from '../../components/PointHistoryDialog';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { Tabs, TabsList, TabsTrigger } from '../../components/ui/tabs';

const LoyaltyPointsReport = () => {
    const { customers, transactions } = useData();
    const [viewMode, setViewMode] = useState('leaderboard'); // 'leaderboard' or 'history'

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
    const getFilteredTransactions = () => {
        if (!datePickerDate?.from) return [];
        const startDate = datePickerDate.from;
        const endDate = datePickerDate.to || datePickerDate.from;

        return transactions.filter(t => {
            const tDate = new Date(t.date);
            // Include both valid purchases (success) and voided ones (status 'void')
            // We want to show history of deductions too
            return tDate >= startDate && tDate <= endDate;
        });
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
            // 1. Original Transaction Record
            data.push({
                id: t.id,
                date: t.date,
                customerName: t.customerName || 'Unknown',
                customerId: t.customerId,
                total: t.total,
                pointsEarned: t.pointsEarned,
                status: t.status,
                type: 'earning'
            });

            // 2. Cancellation Record (if void)
            if ((t.status === 'void' || t.status === 'cancelled') && t.pointsEarned > 0) {
                data.push({
                    id: `${t.id}-void`,
                    // Use voidedAt if available, otherwise fallback to transaction date (slight delay)
                    date: t.voidedAt || t.date,
                    customerName: t.customerName || 'Unknown',
                    customerId: t.customerId,
                    total: 0, // No spending impact on this specific line (handled in total calc usually) or show neg?
                    // User wants to see deduction. Total spent reversal is a concept, but points is a number.
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
            <div className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-card p-4 rounded-lg border shadow-sm">
                <div className="w-full md:w-64">
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari Pelanggan..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>
                </div>

                {viewMode === 'history' && (
                    <>
                        <div className="flex items-center gap-2">
                            <SmartDatePicker
                                date={datePickerDate}
                                onDateChange={setDatePickerDate}
                            />
                        </div>



                    </>
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
                                {historyData.length === 0 ? (
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
