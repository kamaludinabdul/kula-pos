import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, ShoppingBag, Store, TrendingUp, Building2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { InfoCard } from '../components/ui/info-card';
import { safeSupabaseRpc } from '../utils/supabaseHelper';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';



const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6'];

const OwnerDashboard = () => {
    const { user } = useAuth();
    const { stores } = useData();

    const [dateRange, setDateRange] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Store Filter State
    const [selectedStoreId, setSelectedStoreId] = useState('all');

    const [dashboardData, setDashboardData] = useState({
        totalSales: 0,
        totalTransactions: 0,
        avgOrder: 0,
        totalStores: 0,
        storeBreakdown: []
    });
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [financialSummary, setFinancialSummary] = useState([]);
    const [dailySales, setDailySales] = useState([]);
    const [isDailyLoading, setIsDailyLoading] = useState(false);

    // Get owner's stores
    const ownerStores = useMemo(() => {
        if (!stores || !user) return [];
        let myStores = [];
        if (user.role === 'super_admin') {
            myStores = stores;
        } else {
            myStores = stores.filter(s => s.owner_id === user.id);
        }
        // Assign colors to stores for consistent charting
        return myStores.map((store, index) => ({
            ...store,
            color: COLORS[index % COLORS.length]
        }));
    }, [stores, user]);

    // --- Data Fetching ---

    useEffect(() => {
        const fetchOwnerDashboard = async () => {
            if (!user) return;

            setIsLoading(true);
            try {
                const now = new Date();
                let start, end;

                if (dateRange === 'today') {
                    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                } else if (dateRange === 'week') {
                    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    end = now;
                } else if (dateRange === 'month') {
                    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    end = now;
                } else if (dateRange === 'custom') {
                    if (!customStartDate || !customEndDate) {
                        setIsLoading(false);
                        return;
                    }
                    start = new Date(customStartDate);
                    end = new Date(customEndDate);
                    end.setHours(23, 59, 59, 999);
                } else if (dateRange === 'all') {
                    start = new Date('2023-01-01');
                    end = now;
                }

                const data = await safeSupabaseRpc({
                    rpcName: 'get_owner_dashboard_stats',
                    params: {
                        p_start_date: start.toISOString(),
                        p_end_date: end.toISOString()
                    }
                });

                if (data && !data.error) {
                    setDashboardData({
                        totalSales: Number(data.totalSales) || 0,
                        totalTransactions: Number(data.totalTransactions) || 0,
                        avgOrder: Number(data.avgOrder) || 0,
                        totalStores: Number(data.totalStores) || ownerStores.length,
                        storeBreakdown: data.storeBreakdown || []
                    });
                }

            } catch (error) {
                console.error("Error fetching owner dashboard:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchOwnerDashboard();
    }, [dateRange, customStartDate, customEndDate, user, ownerStores.length]);

    useEffect(() => {
        const fetchFinancialSummary = async () => {
            if (!user) return;
            try {
                const data = await safeSupabaseRpc({
                    rpcName: 'get_owner_financial_summary',
                    params: { p_year: selectedYear }
                });
                if (data && !data.error) {
                    setFinancialSummary(data);
                }
            } catch (error) {
                console.error("Error fetching financial summary:", error);
            }
        };
        fetchFinancialSummary();
    }, [selectedYear, user]);

    useEffect(() => {
        const fetchDailySales = async () => {
            if (!user) return;
            setIsDailyLoading(true);
            try {
                const now = new Date();
                let start, end, period;

                if (dateRange === 'today') {
                    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
                    period = 'hour';
                } else if (dateRange === 'week') {
                    start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    end = now;
                    period = 'day';
                } else if (dateRange === 'month') {
                    start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    end = now;
                    period = 'day';
                } else if (dateRange === 'custom') {
                    if (!customStartDate || !customEndDate) {
                        setIsDailyLoading(false);
                        return;
                    }
                    start = new Date(customStartDate);
                    end = new Date(customEndDate);
                    end.setHours(23, 59, 59, 999);

                    const diffMs = Math.abs(end - start);
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                    period = diffDays <= 1 ? 'hour' : 'day';
                } else {
                    // default for 'all' or others: show daily
                    start = new Date(now.getFullYear(), 0, 1);
                    end = now;
                    period = 'day';
                }

                const data = await safeSupabaseRpc({
                    rpcName: 'get_owner_daily_sales',
                    params: {
                        p_start_date: start.toISOString(),
                        p_end_date: end.toISOString(),
                        p_period: period
                    }
                });
                if (data && !data.error) {
                    setDailySales(data);
                }
            } catch (error) {
                console.error("Error fetching daily sales:", error);
            } finally {
                setIsDailyLoading(false);
            }
        };
        fetchDailySales();
    }, [dateRange, customStartDate, customEndDate, user]);

    // --- Computed Data for UI ---

    // 1. Filtered Summary Stats (Cards)
    const stats = useMemo(() => {
        if (selectedStoreId === 'all') {
            return {
                sales: dashboardData.totalSales,
                transactions: dashboardData.totalTransactions,
                avgOrder: dashboardData.avgOrder,
                storeCount: dashboardData.totalStores
            };
        } else {
            // Find specific store stats from breakdown
            // Note: avgOrder might be inaccurate if calculated from breakdown simply, so we recalc: sales / count
            const storeStats = dashboardData.storeBreakdown.find(s => s.store_id === selectedStoreId);
            const sales = storeStats ? Number(storeStats.total_sales) : 0;
            const transactions = storeStats ? Number(storeStats.total_transactions) : 0;
            return {
                sales,
                transactions,
                avgOrder: transactions > 0 ? sales / transactions : 0,
                storeCount: 1
            };
        }
    }, [selectedStoreId, dashboardData]);

    // 2. Chart Data Transformation (Daily Sales)
    const transformedDailySales = useMemo(() => {
        return dailySales.map(day => {
            const item = {
                date: day.date,
                fullDate: day.full_date,
                total: selectedStoreId === 'all' ? Number(day.total) : 0
            };

            // Pre-initialize all stores with 0 to ensure they appear even if no transactions
            ownerStores.forEach(s => {
                item[String(s.id)] = 0;
            });

            // Inject store data as dynamically keyed properties
            if (Array.isArray(day.stores)) {
                day.stores.forEach(storeData => {
                    const sId = String(storeData.store_id);
                    item[sId] = Number(storeData.total) || 0;
                    if (String(selectedStoreId) === sId) {
                        item.total = Number(storeData.total) || 0;
                    }
                });
            }

            return item;
        });
    }, [dailySales, selectedStoreId, ownerStores]);

    // 3. Chart Data Transformation (Financials)
    const transformedFinancials = useMemo(() => {
        if (!Array.isArray(financialSummary)) return [];
        return financialSummary.map(monthData => {
            const activeDays = Number(monthData.active_days) || 0;
            const item = {
                monthLabel: monthData.month_name || `Bulan ${monthData.month}`,
                revenue: selectedStoreId === 'all' ? Number(monthData.revenue) : 0,
                expenses: selectedStoreId === 'all' ? Number(monthData.expenses) : 0,
                profit: selectedStoreId === 'all' ? Number(monthData.profit) : 0,
                avgDailyRevenue: (selectedStoreId === 'all' && activeDays > 0) ? (Number(monthData.revenue) / activeDays) : 0,
                avgDailyProfit: (selectedStoreId === 'all' && activeDays > 0) ? (Number(monthData.profit) / activeDays) : 0,
            };

            // Initialize all stores with 0 to ensure they appear in the side-by-side bars
            ownerStores.forEach(s => {
                const sId = String(s.id);
                item[`revenue_${sId}`] = 0;
                item[`expenses_${sId}`] = 0;
                item[`profit_${sId}`] = 0;
                item[`avgDailyRevenue_${sId}`] = 0;
                item[`avgDailyProfit_${sId}`] = 0;
            });

            if (Array.isArray(monthData.stores)) {
                monthData.stores.forEach(storeData => {
                    const storeIdStr = String(storeData.store_id);
                    const sActiveDays = Number(storeData.active_days) || 0;

                    item[`revenue_${storeIdStr}`] = Number(storeData.revenue) || 0;
                    item[`expenses_${storeIdStr}`] = Number(storeData.expenses) || 0;
                    item[`profit_${storeIdStr}`] = Number(storeData.profit) || 0;
                    item[`avgDailyRevenue_${storeIdStr}`] = sActiveDays > 0 ? (Number(storeData.revenue) / sActiveDays) : 0;
                    item[`avgDailyProfit_${storeIdStr}`] = sActiveDays > 0 ? (Number(storeData.profit) / sActiveDays) : 0;

                    if (String(selectedStoreId) === storeIdStr) {
                        item.revenue = Number(storeData.revenue) || 0;
                        item.expenses = Number(storeData.expenses) || 0;
                        item.profit = Number(storeData.profit) || 0;
                        item.avgDailyRevenue = sActiveDays > 0 ? (Number(storeData.revenue) / sActiveDays) : 0;
                        item.avgDailyProfit = sActiveDays > 0 ? (Number(storeData.profit) / sActiveDays) : 0;
                    }
                });
            }
            return item;
        });
    }, [financialSummary, selectedStoreId, ownerStores]);

    // 4. Breakdown Chart Data (Horizontal Bar)
    const breakdownChartData = useMemo(() => {
        // Filter if specific store selected? Or always show comparison?
        // Usually comparison is useful even if one is selected, but maybe highlight it?
        // Let's just show all for comparison context, or filter if requested.
        // User asked: "komparasi semua tokonya" -> Suggests keeping all visible usually.
        // But if I select a store, maybe I want to see just that store? 
        // Let's filter if selected, showing only that one bar, to reduce noise?
        // Or better: keep all but highlight selected.
        // For now, let's filter to keep it consistent with the "Filter" concept.

        let data = dashboardData.storeBreakdown.map((store, index) => ({
            name: store.store_name || 'Unknown',
            sales: store.total_sales || 0,
            store_id: store.store_id, // Ensure we have ID
            color: ownerStores.find(s => s.id === store.store_id)?.color || COLORS[index % COLORS.length]
        }));

        if (selectedStoreId !== 'all') {
            data = data.filter(d => d.store_id === selectedStoreId);
        }

        return data;
    }, [dashboardData.storeBreakdown, selectedStoreId, ownerStores]);


    // Helper to get active lines/bars based on selection
    const activeSeries = useMemo(() => {
        if (selectedStoreId !== 'all') {
            const store = ownerStores.find(s => s.id === selectedStoreId);
            return store ? [store] : [];
        }
        return ownerStores;
    }, [selectedStoreId, ownerStores]);

    return (
        <div className="p-4 space-y-6">
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard Owner</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Ringkasan bisnis dari <span className="font-bold text-slate-900">{stats.storeCount} toko</span> Anda.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    {/* Store Filter */}
                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                        <SelectTrigger className="w-full sm:w-[200px] h-10 rounded-lg border-slate-200 bg-white">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <Store className="h-4 w-4 text-slate-500 flex-shrink-0" />
                                <span className="truncate">
                                    {selectedStoreId === 'all'
                                        ? 'Semua Toko'
                                        : ownerStores.find(s => s.id === selectedStoreId)?.name || 'Toko Terpilih'}
                                </span>
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Toko</SelectItem>
                            {ownerStores.map(store => (
                                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Date Period Filter */}
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-full sm:w-[150px] h-10 rounded-lg border-slate-200 bg-white">
                            <SelectValue placeholder="Pilih periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Hari Ini</SelectItem>
                            <SelectItem value="week">7 Hari Terakhir</SelectItem>
                            <SelectItem value="month">30 Hari Terakhir</SelectItem>
                            <SelectItem value="custom">Rentang Khusus</SelectItem>
                            <SelectItem value="all">Semua Waktu</SelectItem>
                        </SelectContent>
                    </Select>

                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                className="h-10 rounded-lg border-slate-200"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                            />
                            <span className="text-slate-400 font-bold">-</span>
                            <Input
                                type="date"
                                className="h-10 rounded-lg border-slate-200"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </header>

            {/* Daily Sales Chart Section */}
            <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                <CardHeader className="p-6 pb-0 flex flex-row items-center justify-between">
                    <div className="flex flex-col">
                        <CardTitle className="text-lg font-bold">Grafik Penjualan</CardTitle>
                        <span className="text-xs text-slate-400 font-medium">
                            ({dateRange === 'today' || (dateRange === 'custom' && dailySales.length <= 24 && dailySales[0]?.date.includes(':')) ? 'Per Jam' : 'Per Hari'})
                        </span>
                    </div>
                    {selectedStoreId === 'all' && (
                        <div className="flex flex-wrap justify-end gap-2">
                            {ownerStores.map(store => (
                                <div key={store.id} className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-slate-500 bg-slate-50 px-2 py-1 rounded-md">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: store.color }}></div>
                                    {store.name}
                                </div>
                            ))}
                        </div>
                    )}
                </CardHeader>
                <CardContent className="p-6">
                    <div className="h-[300px] w-full">
                        {isDailyLoading ? (
                            <div className="flex items-center justify-center h-full text-muted-foreground">Memuat...</div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={transformedDailySales}>
                                    <defs>
                                        {activeSeries.map(store => (
                                            <linearGradient key={store.id} id={`color_${store.id}`} x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor={store.color} stopOpacity={0.3} />
                                                <stop offset="95%" stopColor={store.color} stopOpacity={0} />
                                            </linearGradient>
                                        ))}
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis
                                        dataKey="date"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        minTickGap={dateRange === 'today' ? 10 : 30}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fill: '#94a3b8' }}
                                        tickFormatter={(v) => v >= 1000000 ? `Rp ${(v / 1000000).toFixed(1)} jt` : `Rp ${v.toLocaleString('en-US')}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                        formatter={(v, name) => {
                                            const store = ownerStores.find(s => String(s.id) === String(name)) || ownerStores.find(s => s.name === name);
                                            const label = store ? store.name : (name === 'total' ? 'Total' : name);
                                            return [`Rp ${Number(v).toLocaleString('en-US')}`, label];
                                        }}
                                    />

                                    {/* Render Areas */}
                                    {activeSeries.map(store => (
                                        <Area
                                            key={store.id}
                                            type="monotone"
                                            // Ensure dataKey matches the stringified IDs in transformedDailySales
                                            dataKey={selectedStoreId === 'all' ? String(store.id) : 'total'}
                                            stroke={store.color}
                                            strokeWidth={3}
                                            fillOpacity={1}
                                            fill={`url(#color_${store.id})`}
                                            name={store.name}
                                        />
                                    ))}
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Summary Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard
                    title="Total Omzet"
                    value={`Rp ${stats.sales.toLocaleString('en-US')}`}
                    icon={DollarSign}
                    variant="primary"
                />
                <InfoCard
                    title="Total Transaksi"
                    value={stats.transactions.toLocaleString('en-US')}
                    icon={ShoppingBag}
                    variant="pink"
                />
                <InfoCard
                    title="Rata-rata Order"
                    value={`Rp ${Math.round(stats.avgOrder).toLocaleString('en-US')}`}
                    icon={TrendingUp}
                    variant="warning"
                />
                <InfoCard
                    title="Jumlah Toko"
                    value={stats.storeCount.toLocaleString('en-US')}
                    icon={Building2}
                    variant="success"
                />
            </div>

            {/* Financial Summary Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-800">Ringkasan Keuangan</h2>
                    <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-[100px] h-9 rounded-xl border-none shadow-sm bg-white font-bold text-slate-600">
                            <SelectValue placeholder="Tahun" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-none shadow-xl">
                            {[2024, 2025, 2026].map(year => (
                                <SelectItem key={year} value={year.toString()} className="font-medium">{year}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Monthly Revenue (Stacked) */}
                    <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="p-6 pb-0">
                            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Omzet Bulanan</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={transformedFinancials} barGap={4}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                                                <stop offset="95%" stopColor="#818cf8" stopOpacity={0.4} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)} jt` : v.toLocaleString('en-US')} />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(v) => [`Rp ${Number(v).toLocaleString('en-US')}`, 'Omzet']}
                                        />

                                        {selectedStoreId === 'all' ? (
                                            activeSeries.map(store => (
                                                <Bar
                                                    key={store.id}
                                                    dataKey={`revenue_${store.id}`}
                                                    name={store.name}
                                                    fill={store.color}
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            ))
                                        ) : (
                                            <Bar dataKey="revenue" fill={activeSeries[0]?.color || '#6366f1'} radius={[4, 4, 0, 0]} />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 2. Monthly Profit (Stacked) */}
                    <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="p-6 pb-0">
                            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laba Bersih Bulanan</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={transformedFinancials} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)} jt` : v.toLocaleString('en-US')} />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(v) => [`Rp ${Number(v).toLocaleString('en-US')}`, 'Laba']}
                                        />

                                        {selectedStoreId === 'all' ? (
                                            activeSeries.map(store => (
                                                <Bar
                                                    key={store.id}
                                                    dataKey={`profit_${store.id}`}
                                                    name={store.name}
                                                    fill={store.color}
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            ))
                                        ) : (
                                            <Bar dataKey="profit" fill={activeSeries[0]?.color || '#10b981'} radius={[4, 4, 0, 0]} />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 3. Operational Expenses (Stacked) */}
                    <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="p-6 pb-0">
                            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pengeluaran Operasional</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={transformedFinancials} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)} jt` : v.toLocaleString('en-US')} />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(v) => [`Rp ${Number(v).toLocaleString('en-US')}`, 'Pengeluaran']}
                                        />

                                        {selectedStoreId === 'all' ? (
                                            activeSeries.map(store => (
                                                <Bar
                                                    key={store.id}
                                                    dataKey={`expenses_${store.id}`}
                                                    name={store.name}
                                                    fill={store.color}
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            ))
                                        ) : (
                                            <Bar dataKey="expenses" fill={activeSeries[0]?.color || '#f43f5e'} radius={[4, 4, 0, 0]} />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 4. Daily Avg Revenue */}
                    <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="p-6 pb-0">
                            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Omzet Rata-rata Harian</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={transformedFinancials} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)} jt` : v.toLocaleString('en-US')} />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(v) => [`Rp ${Number(v).toLocaleString('en-US')}`, 'Omzet Rata-rata']}
                                        />

                                        {selectedStoreId === 'all' ? (
                                            activeSeries.map(store => (
                                                <Bar
                                                    key={store.id}
                                                    dataKey={`avgDailyRevenue_${store.id}`}
                                                    name={store.name}
                                                    fill={store.color}
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            ))
                                        ) : (
                                            <Bar dataKey="avgDailyRevenue" fill={activeSeries[0]?.color || '#6366f1'} radius={[4, 4, 0, 0]} />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    {/* 5. Daily Avg Profit */}
                    <Card className="rounded-2xl border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="p-6 pb-0">
                            <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Laba Rata-rata Harian</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6">
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={transformedFinancials} barGap={4}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                                        <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => v >= 1000000 ? `${(v / 1000000).toFixed(1)} jt` : v.toLocaleString('en-US')} />
                                        <Tooltip
                                            cursor={{ fill: '#f1f5f9' }}
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(v) => [`Rp ${Number(v).toLocaleString('en-US')}`, 'Laba Rata-rata']}
                                        />

                                        {selectedStoreId === 'all' ? (
                                            activeSeries.map(store => (
                                                <Bar
                                                    key={store.id}
                                                    dataKey={`avgDailyProfit_${store.id}`}
                                                    name={store.name}
                                                    fill={store.color}
                                                    radius={[4, 4, 0, 0]}
                                                />
                                            ))
                                        ) : (
                                            <Bar dataKey="avgDailyProfit" fill={activeSeries[0]?.color || '#10b981'} radius={[4, 4, 0, 0]} />
                                        )}
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>


            {/* Per Store Breakdown (Keep existing, but filtered) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Bar Chart */}
                <Card className="rounded-xl border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-white border-b p-4 lg:p-6">
                        <CardTitle className="text-lg font-bold">Omzet per Toko</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6">
                        <div style={{ width: '100%', height: 300 }}>
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-muted-foreground">Memuat...</div>
                            ) : breakdownChartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={breakdownChartData} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f1f5f9" />
                                        <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(value) => `Rp ${(value / 1000000).toFixed(1)}jt`} />
                                        <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} width={100} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => [`Rp ${value.toLocaleString()}`, 'Omzet']}
                                        />
                                        <Bar dataKey="sales" radius={[0, 8, 8, 0]}>
                                            {breakdownChartData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Belum ada data.</div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Store Cards */}
                <Card className="rounded-xl border-none shadow-sm overflow-hidden">
                    <CardHeader className="bg-white border-b p-4 lg:p-6">
                        <CardTitle className="text-lg font-bold">Detail per Toko</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground">Memuat...</div>
                        ) : breakdownChartData.length === 0 ? (
                            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">Belum ada data.</div>
                        ) : (
                            <div className="divide-y">
                                {breakdownChartData.map((store) => (
                                    <div key={store.store_id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="h-10 w-10 rounded-xl flex items-center justify-center"
                                                style={{ backgroundColor: store.color + '20' }}
                                            >
                                                <Store size={18} style={{ color: store.color }} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-sm text-slate-800">{store.name}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <Badge variant="secondary" className="text-[10px] uppercase">
                                                        Store
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-extrabold text-sm text-slate-900">
                                                Rp {(store.sales || 0).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div >
        </div >
    );
};

export default OwnerDashboard;
