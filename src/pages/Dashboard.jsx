import React, { useMemo, useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, Users, TrendingUp, Eye, AlertTriangle, Package, BrainCircuit } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import { useData } from '../context/DataContext';
import { AreaChart, Area, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { InfoCard } from '../components/ui/info-card';
import DashboardCharts from './dashboard-components/DashboardCharts';
import { safeSupabaseRpc } from '../utils/supabaseHelper';

import { SmartDatePicker } from '../components/SmartDatePicker';
import { useAuth } from '../context/AuthContext';
import { formatCompactNumber } from '../lib/utils';

const formatCurrency = (val) => formatCompactNumber(val);

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'];

const Dashboard = () => {
    const { user } = useAuth();
    const userTimezone = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
        } catch {
            return 'Asia/Jakarta';
        }
    }, []);

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const [chartView, setChartView] = useState('daily'); // 'daily' | 'hourly'
    const [hourlyPatternData, setHourlyPatternData] = useState([]);
    const [isLoadingHourly, setIsLoadingHourly] = useState(false);
    const { currentStore, products: rawProducts, fetchAllProducts, activeStoreId } = useData();
    const products = useMemo(() => Array.isArray(rawProducts) ? rawProducts : [], [rawProducts]);

    // Products are not loaded by default (Phase 2 removed from DataContext).
    // We need them for stock counts (out of stock / low stock).
    useEffect(() => {
        if (activeStoreId && rawProducts.length === 0) {
            fetchAllProducts(activeStoreId);
        }
    }, [activeStoreId, rawProducts.length, fetchAllProducts]);

    const hasPermission = (feature) => {
        if (!user) return false;
        const userRole = (user.role || '').toLowerCase();
        if (userRole === 'super_admin') return true;
        if (!currentStore) return userRole === 'owner' || userRole === 'super_admin';
        if (userRole === 'owner' || userRole === 'super_admin' || userRole === 'admin') return true;
        const perms = Array.isArray(user.permissions) ? user.permissions : [];
        return perms.includes(feature) || perms.some(p => p.startsWith(feature + '.'));
    };

    const canViewFinancials = hasPermission('dashboard.financials') || hasPermission('reports.profit_loss');
    const canViewStock = hasPermission('dashboard.stock') || hasPermission('products.stock');

    const handleViewReceipt = (transaction) => {
        setSelectedTransaction(transaction);
        setIsReceiptModalOpen(true);
    };

    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        return {
            from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
            to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        };
    });

    const [dashboardStats, setDashboardStats] = useState({
        totalSales: 0,
        totalTransactions: 0,
        avgOrder: 0,
        totalProfit: 0,
        totalGrossProfit: 0,
        totalNetProfit: 0,
        chartData: [],
        categoryData: [],
        topProducts: [],
        recentTransactions: []
    });
    const [isLoading, setIsLoading] = useState(false);

    const isSingleDay = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return false;
        const from = new Date(dateRange.from);
        const to = new Date(dateRange.to);
        return from.getFullYear() === to.getFullYear() &&
            from.getMonth() === to.getMonth() &&
            from.getDate() === to.getDate();
    }, [dateRange]);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!currentStore?.id) return;
            setIsLoading(true);
            try {
                const start = new Date(dateRange.from);
                const end = new Date(dateRange.to);

                const data = await safeSupabaseRpc({
                    rpcName: 'get_dashboard_stats',
                    params: {
                        p_store_id: currentStore.id,
                        p_start_date: start.toISOString(),
                        p_end_date: end.toISOString(),
                        p_period: isSingleDay ? 'hour' : 'day',
                        p_timezone: userTimezone
                    }
                });

                if (data) {
                    setDashboardStats({
                        totalSales: Number(data.totalSales) || 0,
                        totalTransactions: Number(data.totalTransactions) || 0,
                        avgOrder: Number(data.avgOrder) || 0,
                        totalProfit: Number(data.totalNetProfit || data.totalProfit) || 0,
                        totalGrossProfit: Number(data.totalGrossProfit) || 0,
                        totalNetProfit: Number(data.totalNetProfit) || 0,
                        chartData: data.chartData || [],
                        categoryData: data.categoryData || [],
                        topProducts: data.topProducts || [],
                        recentTransactions: data.recentTransactions || []
                    });
                }
            } catch (error) {
                console.error("Error fetching dashboard stats:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [dateRange, currentStore, isSingleDay, userTimezone]);

    // Fetch hourly pattern data for multi-day view
    useEffect(() => {
        const fetchHourlyPattern = async () => {
            if (!currentStore?.id || isSingleDay) {
                setHourlyPatternData([]);
                return;
            }
            setIsLoadingHourly(true);
            try {
                const start = new Date(dateRange.from);
                const end = new Date(dateRange.to);

                const data = await safeSupabaseRpc({
                    rpcName: 'get_dashboard_stats',
                    params: {
                        p_store_id: currentStore.id,
                        p_start_date: start.toISOString(),
                        p_end_date: end.toISOString(),
                        p_period: 'hour',
                        p_timezone: userTimezone
                    }
                });

                const hourlyRaw = data?.chartData || [];
                // Aggregate by hour-of-day: compute avg, min, max
                const hourMap = {}; // { '08': [val1, val2, ...], ... }
                hourlyRaw.forEach(entry => {
                    // entry.name could be "08:00", "14:00", or "2026-03-01 08:00" etc.
                    const nameStr = String(entry.name || '');
                    let hourKey = nameStr;
                    // Extract hour part if format includes date
                    if (nameStr.includes(' ')) {
                        hourKey = nameStr.split(' ').pop();
                    }
                    // Normalize to 2-digit hour: "8" -> "08", "08:00" -> "08"
                    const hourNum = parseInt(hourKey);
                    if (isNaN(hourNum)) return;
                    const key = String(hourNum).padStart(2, '0');

                    if (!hourMap[key]) hourMap[key] = [];
                    hourMap[key].push(Number(entry.total) || 0);
                });

                // Build pattern data for all operating hours (07:00 - 23:00)
                const patternData = [];
                for (let h = 7; h <= 23; h++) {
                    const key = String(h).padStart(2, '0');
                    const values = hourMap[key] || [0];
                    const avg = values.reduce((a, b) => a + b, 0) / values.length;
                    const min = Math.min(...values);
                    const max = Math.max(...values);

                    patternData.push({
                        name: `${key}:00`,
                        avg: Math.round(avg),
                        min,
                        max,
                        range: [min, max]
                    });
                }

                setHourlyPatternData(patternData);
            } catch (error) {
                console.error("Error fetching hourly pattern:", error);
            } finally {
                setIsLoadingHourly(false);
            }
        };

        if (chartView === 'hourly' && !isSingleDay) {
            fetchHourlyPattern();
        }
    }, [dateRange, currentStore, isSingleDay, userTimezone, chartView]);

    // Reset chartView when switching between single/multi day
    useEffect(() => {
        setChartView('daily');
    }, [isSingleDay]);

    const stats = dashboardStats;
    const chartData = stats.chartData || [];
    const categoryData = stats.categoryData || [];
    const topProducts = stats.topProducts || [];
    const recentTransactions = stats.recentTransactions || [];

    // Find peak hour for annotation
    const peakHour = useMemo(() => {
        if (hourlyPatternData.length === 0) return null;
        const peak = hourlyPatternData.reduce((best, curr) => curr.avg > best.avg ? curr : best, hourlyPatternData[0]);
        return peak;
    }, [hourlyPatternData]);

    const stockCounts = useMemo(() => {
        return {
            outOfStock: products.filter(p => p.isUnlimited ? false : Number(p.stock) <= 0).length,
            lowStock: products.filter(p => p.isUnlimited ? false : Number(p.stock) > 0 && Number(p.stock) <= (Number(p.minStock) || 5)).length
        };
    }, [products]);

    return (
        <div className="p-4 space-y-6">
            <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Selamat datang, <span className="font-bold text-slate-900">{user?.name}</span>.
                        {canViewFinancials ? ' Berikut ringkasan bisnis Anda.' : ' Siap melayani pelanggan hari ini?'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <SmartDatePicker date={dateRange} onDateChange={setDateRange} />
                </div>
            </header>

            {/* Top Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {canViewFinancials && (
                    <>
                        <InfoCard
                            title="Total Penjualan"
                            value={`Rp ${stats.totalSales.toLocaleString('id-ID')}`}
                            icon={DollarSign}
                            variant="primary"
                        />
                        <InfoCard
                            title="Laba Bersih"
                            value={`Rp ${stats.totalNetProfit.toLocaleString('id-ID')}`}
                            icon={TrendingUp}
                            variant="success"
                        />
                        <InfoCard
                            title="Laba Kotor"
                            value={`Rp ${stats.totalGrossProfit.toLocaleString('id-ID')}`}
                            icon={TrendingUp}
                            variant="warning"
                        />
                    </>
                )}

                <InfoCard
                    title="Total Transaksi"
                    value={stats.totalTransactions}
                    icon={ShoppingBag}
                    variant="pink"
                />

                {canViewStock && (
                    <>
                        <InfoCard
                            title="Stok Habis"
                            value={stockCounts.outOfStock}
                            icon={AlertTriangle}
                            variant="danger"
                        />
                        <InfoCard
                            title="Stok Menipis"
                            value={stockCounts.lowStock}
                            icon={Package}
                            variant="warning"
                        />
                    </>
                )}
            </div>

            {/* Financial Charts */}
            {canViewFinancials && (
                <div className="space-y-6">
                    <DashboardCharts currentStore={currentStore} />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="rounded-xl border-none shadow-sm overflow-hidden">
                            <CardHeader className="bg-white border-b p-4">
                                <CardTitle className="text-lg font-bold">Penjualan per Kategori</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div style={{ width: '100%', height: 300 }}>
                                    {isLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">Memuat...</div>
                                    ) : categoryData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie data={categoryData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} fill="#8884d8" paddingAngle={5} dataKey="value">
                                                    {categoryData.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`}
                                                />
                                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '600' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm">Belum ada data.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="lg:col-span-2 rounded-xl border-none shadow-sm overflow-hidden">
                            <CardHeader className="bg-white border-b p-4">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                        Grafik Penjualan
                                        <span className="text-xs font-normal text-muted-foreground">
                                            ({isSingleDay ? 'Per Jam' : (chartView === 'hourly' ? 'Pola Per Jam' : 'Per Hari')})
                                        </span>
                                    </CardTitle>
                                    {!isSingleDay && (
                                        <div className="flex bg-slate-100 rounded-lg p-0.5">
                                            <button
                                                onClick={() => setChartView('daily')}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartView === 'daily' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                Per Hari
                                            </button>
                                            <button
                                                onClick={() => setChartView('hourly')}
                                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${chartView === 'hourly' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                Pola Per Jam
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent className="p-4">
                                <div style={{ width: '100%', height: 300 }}>
                                    {(isLoading || isLoadingHourly) ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">Memuat data...</div>
                                    ) : chartView === 'hourly' && !isSingleDay ? (
                                        // Hourly Pattern Chart
                                        hourlyPatternData.length > 0 ? (
                                            <>
                                                {peakHour && (
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                                                            🔥 Jam Tersibuk: {peakHour.name} (Rata-rata Rp {peakHour.avg.toLocaleString()})
                                                        </span>
                                                    </div>
                                                )}
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <ComposedChart data={hourlyPatternData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                                                        <defs>
                                                            <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                                                                <stop offset="95%" stopColor="#6366f1" stopOpacity={0.05} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                                        <YAxis width={50} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(value) => formatCurrency(value)} />
                                                        <Tooltip
                                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                            formatter={(value, name) => {
                                                                if (name === 'range') return [`Rp ${value[0].toLocaleString()} - Rp ${value[1].toLocaleString()}`, 'Min-Max'];
                                                                return [`Rp ${Number(value).toLocaleString()}`, name === 'avg' ? 'Rata-rata' : name];
                                                            }}
                                                        />
                                                        <Area type="monotone" dataKey="range" fill="url(#rangeGradient)" stroke="none" />
                                                        <Line type="monotone" dataKey="avg" stroke="#6366f1" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} name="avg" />
                                                    </ComposedChart>
                                                </ResponsiveContainer>
                                            </>
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-medium">Tidak ada data untuk periode ini.</div>
                                        )
                                    ) : chartData && chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 20 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                                <YAxis width={45} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(value) => formatCurrency(value)} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                    formatter={(value) => [`Rp ${value.toLocaleString()}`, 'Penjualan']}
                                                />
                                                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={4} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-medium">Tidak ada data untuk periode ini.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Split Row: Top Selling & Recent Transactions */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Selling Products */}
                {canViewFinancials && (
                    <Card className="rounded-xl border-none shadow-sm overflow-hidden h-full">
                        <CardHeader className="bg-white border-b p-4">
                            <CardTitle className="text-lg font-bold">Produk Terlaris</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {topProducts.length === 0 ? (
                                <p className="text-muted-foreground text-center py-12 text-sm font-medium">Tidak ada data penjualan.</p>
                            ) : (
                                <div className="divide-y divide-slate-50">
                                    {topProducts.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-extrabold ${index < 3 ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800 line-clamp-1">{item.name}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{item.sold} unit terjual</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-extrabold text-sm text-slate-900">Rp {(item.revenue || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Recent Transactions */}
                <Card className="rounded-xl border-none shadow-sm overflow-hidden h-full">
                    <CardHeader className="bg-white border-b p-4">
                        <CardTitle className="text-lg font-bold">Transaksi Terakhir</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-50">
                            {isLoading ? (
                                <p className="text-muted-foreground text-center py-12 text-sm font-medium">Memuat data...</p>
                            ) : recentTransactions.length === 0 ? (
                                <p className="text-muted-foreground text-center py-12 text-sm font-medium">Belum ada transaksi.</p>
                            ) : (
                                recentTransactions.map((t) => (
                                    <div key={t.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors group">
                                        <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs uppercase tracking-tighter">
                                            #{t.id ? t.id.toString().slice(-4).toUpperCase() : '????'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-sm text-slate-800">{t.cashier || 'Kasir Umum'}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                {t.date ? new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </p>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <p className="font-extrabold text-sm text-green-600">
                                                +Rp {(t.total || 0).toLocaleString()}
                                            </p>
                                            <button
                                                onClick={() => handleViewReceipt(t)}
                                                className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest hover:underline flex items-center justify-end gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity"
                                            >
                                                <Eye size={12} className="mr-0.5" />
                                                Detail
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <ReceiptModal
                isOpen={isReceiptModalOpen}
                onClose={() => setIsReceiptModalOpen(false)}
                transaction={selectedTransaction}
                store={currentStore}
            />
        </div>
    );
};

export default Dashboard;
