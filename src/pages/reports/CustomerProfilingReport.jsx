import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog';
import {
    Search, ArrowUpDown, Users, Star, UserPlus, UserX, Clock,
    Download, RefreshCw, Loader2, ShoppingBag, TrendingUp, AlertTriangle
} from 'lucide-react';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { getDateRange, exportToCSV, cn } from '../../lib/utils';

const CustomerProfilingReport = () => {
    const { customers, currentStore } = useData();

    // State
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'totalSpent', direction: 'desc' });
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);

    const [datePickerDate, setDatePickerDate] = useState(() => {
        const { startDate, endDate } = getDateRange('thisMonth');
        return { from: startDate, to: endDate };
    });

    // Fetch Transactions
    const fetchData = useCallback(async () => {
        if (!currentStore?.id) return;
        setLoading(true);
        try {
            const endDate = new Date(datePickerDate.to || datePickerDate.from);
            endDate.setHours(23, 59, 59, 999);

            // Fetch last 180 days (6 months) for accurate segmentation history
            const lookbackDate = new Date(endDate);
            lookbackDate.setDate(lookbackDate.getDate() - 180);

            const { data, error } = await supabase
                .from('transactions')
                .select('customer_id, date, total, items, status')
                .eq('store_id', currentStore.id)
                .neq('status', 'void')
                .gte('date', lookbackDate.toISOString())
                .lte('date', endDate.toISOString())
                .order('date', { ascending: false })
                .limit(20000);

            if (error) throw error;
            setTransactions(data || []);
        } catch (err) {
            console.error('Error fetching profiling data:', err);
        } finally {
            setLoading(false);
        }
    }, [currentStore?.id, datePickerDate]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Compute Customer Stats
    const customerStats = useMemo(() => {
        const statsMap = {};

        transactions.forEach(tx => {
            if (!tx.customer_id) return;
            if (!statsMap[tx.customer_id]) {
                statsMap[tx.customer_id] = {
                    count: 0, totalSpent: 0, lastVisit: null,
                    productCounts: {} // { productName: qty }
                };
            }
            const stat = statsMap[tx.customer_id];
            stat.count += 1;
            stat.totalSpent += (tx.total || 0);

            const txDate = new Date(tx.date);
            if (!stat.lastVisit || txDate > stat.lastVisit) {
                stat.lastVisit = txDate;
            }

            // Aggregate product purchases
            const items = tx.items || [];
            items.forEach(item => {
                const name = item.name || 'Unknown';
                stat.productCounts[name] = (stat.productCounts[name] || 0) + (item.qty || 1);
            });
        });

        // Merge with customer data
        return customers
            .filter(c => c.name) // Skip unnamed
            .map(c => {
                const stat = statsMap[c.id] || { count: 0, totalSpent: 0, lastVisit: null, productCounts: {} };
                const now = new Date();
                const daysSinceLast = stat.lastVisit
                    ? Math.floor((now - stat.lastVisit) / (1000 * 60 * 60 * 24))
                    : 999;

                const avgSpent = stat.count > 0 ? Math.round(stat.totalSpent / stat.count) : 0;

                // Top Products
                const topProducts = Object.entries(stat.productCounts)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([name, qty]) => ({ name, qty }));

                // Segment Logic (Rule 6 Months)
                let segment = 'Baru';
                if (stat.count === 1 && daysSinceLast > 90) {
                    segment = 'Tidur';
                } else if (stat.count > 10 && stat.totalSpent > 1000000) {
                    segment = 'VIP';
                } else if (stat.count >= 6) {
                    segment = 'Reguler';
                }

                return {
                    ...c,
                    txCount: stat.count,
                    totalSpent: stat.totalSpent,
                    avgSpent,
                    lastVisit: stat.lastVisit,
                    daysSinceLast,
                    topProducts,
                    segment,
                    // Check if active in the current date picker range
                    isActiveInRange: stat.lastVisit &&
                        stat.lastVisit >= new Date(datePickerDate.from).setHours(0, 0, 0, 0) &&
                        stat.lastVisit <= new Date(datePickerDate.to || datePickerDate.from).setHours(23, 59, 59, 999)
                };
            });
    }, [customers, transactions, datePickerDate]);

    // Segments
    const segments = useMemo(() => {
        const result = { VIP: [], Reguler: [], Baru: [], Tidur: [] };
        customerStats.forEach(c => {
            if (result[c.segment]) result[c.segment].push(c);
        });
        return result;
    }, [customerStats]);

    // Search & Sort
    const filteredCustomers = useMemo(() => {
        // Show customers active in the selected range OR search results
        let data = customerStats.filter(c => c.isActiveInRange || searchTerm);

        if (searchTerm) {
            const q = searchTerm.toLowerCase();
            data = data.filter(c =>
                c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
            );
        }

        data.sort((a, b) => {
            const aVal = a[sortConfig.key] ?? 0;
            const bVal = b[sortConfig.key] ?? 0;
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
            }
            return 0;
        });

        return data;
    }, [customerStats, searchTerm, sortConfig]);

    // Dormant Customers (active before but >30 days no visit)
    const dormantCustomers = useMemo(() => {
        return customerStats
            .filter(c => c.txCount > 0 && c.daysSinceLast > 30)
            .sort((a, b) => b.daysSinceLast - a.daysSinceLast);
    }, [customerStats]);

    // New Customers based on selected date range (replaces "thisMonth" logic)
    const newCustomersInSelectedRange = useMemo(() => {
        const fromDate = new Date(datePickerDate.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = new Date(datePickerDate.to || datePickerDate.from);
        toDate.setHours(23, 59, 59, 999);

        return customers.filter(c => {
            const created = c.created_at ? new Date(c.created_at) : null;
            return created && created >= fromDate && created <= toDate;
        }).length;
    }, [customers, datePickerDate]);

    // Sort Handler
    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    // CSV Export
    const handleExport = () => {
        const data = filteredCustomers.map(c => ({
            Nama: c.name,
            Telepon: c.phone || '-',
            Segmen: c.segment,
            'Jumlah Transaksi': c.txCount,
            'Total Belanja': c.totalSpent,
            'Rata-rata': c.avgSpent,
            'Terakhir Belanja': c.lastVisit ? c.lastVisit.toLocaleDateString('id-ID') : '-',
            'Hari Sejak Belanja': c.daysSinceLast === 999 ? '-' : c.daysSinceLast,
            'Produk Favorit': c.topProducts.map(p => `${p.name}(${p.qty}x)`).join(', ')
        }));
        exportToCSV(data, `profil-pelanggan-${new Date().toISOString().slice(0, 10)}`);
    };

    // View Favorites
    const openFavorites = (customer) => {
        setSelectedCustomer(customer);
        setIsFavoritesOpen(true);
    };

    const SortButton = ({ label, sortKey }) => (
        <button
            className="flex items-center gap-1 hover:text-indigo-600 transition-colors"
            onClick={() => handleSort(sortKey)}
        >
            {label}
            <ArrowUpDown className={cn("h-3 w-3", sortConfig.key === sortKey ? "text-indigo-600" : "text-slate-400")} />
        </button>
    );

    const getSegmentBadge = (segment) => {
        const variants = {
            VIP: 'purple-subtle',
            Reguler: 'info-subtle',
            Baru: 'success-subtle',
            Tidur: 'warning-subtle'
        };
        // Normalize variant mapping
        const variant = variants[segment] || (segment === 'Tidur' ? 'warning-subtle' : 'neutral-subtle');

        return (
            <Badge variant={variant} className="font-bold border-none uppercase text-[10px]">
                {segment}
            </Badge>
        );
    };

    return (
        <div className="p-4 space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Profil Pelanggan</h1>
                    <p className="text-muted-foreground">
                        Analisis data pelanggan berdasarkan pola belanja dan preferensi produk.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="flex-1 sm:flex-none">
                        <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="flex-1 sm:flex-none">
                        <Download className="mr-2 h-4 w-4" /> Export
                    </Button>
                    <div className="w-full sm:w-auto">
                        <SmartDatePicker
                            date={datePickerDate}
                            onDateChange={setDatePickerDate}
                        />
                    </div>
                </div>
            </div>

            {/* Segment Summary Cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
                <InfoCard
                    title="VIP"
                    value={segments.VIP.length}
                    icon={Star}
                    variant="purple"
                    description=">10 transaksi & >1jt belanja"
                />
                <InfoCard
                    title="Reguler"
                    value={segments.Reguler.length}
                    icon={Users}
                    variant="info"
                    description="6-10 transaksi"
                />
                <InfoCard
                    title="Baru"
                    value={segments.Baru.length}
                    icon={UserPlus}
                    variant="success"
                    description="1-5 transaksi"
                />
                <InfoCard
                    title="Tidur"
                    value={segments.Tidur.length}
                    icon={UserX}
                    variant="warning"
                    description="1 transaksi & >90 hari lalu"
                />
                <InfoCard
                    title="Baru di Range Ini"
                    value={newCustomersInSelectedRange}
                    icon={TrendingUp}
                    variant="default"
                    description="Pelanggan baru terdaftar"
                />
            </div>

            {/* Top Customers Table */}
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Star className="h-5 w-5 text-amber-500" />
                                Top Pelanggan
                            </CardTitle>
                            <CardDescription>
                                Pelanggan dengan transaksi terbanyak atau belanja terbesar.
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari nama / telepon..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead className="w-[50px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">#</TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pelanggan</TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Segmen</TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><SortButton label="Transaksi" sortKey="txCount" /></TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><SortButton label="Total Belanja" sortKey="totalSpent" /></TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><SortButton label="Rata-rata" sortKey="avgSpent" /></TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest"><SortButton label="Hari Lalu" sortKey="daysSinceLast" /></TableHead>
                                        <TableHead className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCustomers.slice(0, 50).map((c, idx) => (
                                        <TableRow key={c.id} className="hover:bg-slate-50">
                                            <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{c.name}</div>
                                                {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                                            </TableCell>
                                            <TableCell>{getSegmentBadge(c.segment)}</TableCell>
                                            <TableCell className="font-medium">{c.txCount}x</TableCell>
                                            <TableCell>Rp {c.totalSpent.toLocaleString('id-ID')}</TableCell>
                                            <TableCell className="text-muted-foreground">Rp {c.avgSpent.toLocaleString('id-ID')}</TableCell>
                                            <TableCell>
                                                <span className={cn(
                                                    "text-sm",
                                                    c.daysSinceLast > 30 ? "text-orange-600 font-medium" : "text-muted-foreground"
                                                )}>
                                                    {c.daysSinceLast === 999 ? '-' : `${c.daysSinceLast} hari`}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-1 text-xs"
                                                    onClick={() => openFavorites(c)}
                                                >
                                                    <ShoppingBag className="h-3 w-3" /> Favorit
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {filteredCustomers.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                                                {searchTerm ? 'Tidak ada pelanggan yang cocok.' : 'Belum ada data transaksi pelanggan.'}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                            {filteredCustomers.length > 50 && (
                                <div className="p-2 text-center text-xs text-muted-foreground bg-slate-50 border-t">
                                    Menampilkan 50 dari {filteredCustomers.length} pelanggan
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Dormant Customers */}
            {dormantCustomers.length > 0 && (
                <Card className="border-orange-200 bg-orange-50/30">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-orange-700">
                            <AlertTriangle className="h-5 w-5" />
                            Pelanggan Tidur ({dormantCustomers.length})
                        </CardTitle>
                        <CardDescription>
                            Pelanggan yang sudah lebih dari 30 hari tidak bertransaksi. Pertimbangkan untuk menghubungi mereka.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pelanggan</TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Terakhir Belanja</TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Transaksi</TableHead>
                                        <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Total Belanja</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {dormantCustomers.slice(0, 10).map(c => (
                                        <TableRow key={c.id}>
                                            <TableCell>
                                                <div className="font-medium">{c.name}</div>
                                                {c.phone && <div className="text-xs text-muted-foreground">{c.phone}</div>}
                                            </TableCell>
                                            <TableCell>
                                                <span className="text-orange-600 font-medium">{c.daysSinceLast} hari lalu</span>
                                            </TableCell>
                                            <TableCell>{c.txCount}x</TableCell>
                                            <TableCell>Rp {c.totalSpent.toLocaleString('id-ID')}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {dormantCustomers.length > 10 && (
                                <div className="p-2 text-center text-xs text-muted-foreground bg-slate-50 border-t">
                                    Menampilkan 10 dari {dormantCustomers.length} pelanggan tidur
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Favorites Dialog */}
            <Dialog open={isFavoritesOpen} onOpenChange={setIsFavoritesOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShoppingBag className="h-5 w-5 text-primary" />
                            Produk Favorit
                        </DialogTitle>
                        <DialogDescription>
                            {selectedCustomer?.name} — {selectedCustomer?.txCount} transaksi
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4">
                        {selectedCustomer?.topProducts?.length > 0 ? (
                            selectedCustomer.topProducts.map((p, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <span className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                                            idx === 0 ? "bg-amber-100 text-amber-700" :
                                                idx === 1 ? "bg-slate-200 text-slate-600" :
                                                    idx === 2 ? "bg-orange-100 text-orange-600" :
                                                        "bg-slate-100 text-slate-500"
                                        )}>
                                            {idx + 1}
                                        </span>
                                        <span className="font-medium text-sm">{p.name}</span>
                                    </div>
                                    <Badge variant="secondary" className="text-xs">
                                        {p.qty}x dibeli
                                    </Badge>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-4">
                                Belum ada data produk.
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CustomerProfilingReport;
