import React, { useMemo, useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, Users, TrendingUp, Eye, AlertTriangle, Package } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import { useData } from '../context/DataContext';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { InfoCard } from '../components/ui/info-card';
import DashboardCharts from './dashboard-components/DashboardCharts';
import { safeSupabaseRpc } from '../utils/supabaseHelper';

import { SmartDatePicker } from '../components/SmartDatePicker';

import { useAuth } from '../context/AuthContext';

// ... existing imports

const formatCurrency = (val) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)} jt`;
    if (val >= 1000) return `${(val / 1000).toFixed(0)} rb`;
    return `${val}`;
};

const Dashboard = () => {
    const { user } = useAuth();

    // Helper to get Timezone
    const userTimezone = useMemo(() => {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
        } catch {
            return 'Asia/Jakarta';
        }
    }, []);

    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
    const { currentStore, products: rawProducts, customers: rawCustomers, summary } = useData();
    const products = useMemo(() => Array.isArray(rawProducts) ? rawProducts : [], [rawProducts]);
    const customers = useMemo(() => Array.isArray(rawCustomers) ? rawCustomers : [], [rawCustomers]);

    // Helper to check permissions
    const hasPermission = (feature) => {
        if (!user) return false;

        const userRole = (user.role || '').toLowerCase();

        if (userRole === 'super_admin') return true;
        if (!currentStore) return userRole === 'owner' || userRole === 'super_admin';

        // Admin always has access unless specifically restricted
        if (userRole === 'owner' || userRole === 'super_admin' || userRole === 'admin') return true;

        const perms = Array.isArray(user.permissions) ? user.permissions : [];
        return perms.includes(feature) || perms.some(p => p.startsWith(feature + '.'));
    };

    // Permission Gates
    const canViewFinancials = hasPermission('dashboard.financials') || hasPermission('reports.profit_loss');
    const canViewStock = hasPermission('dashboard.stock') || hasPermission('products.stock');

    const handleViewReceipt = (transaction) => {
        setSelectedTransaction(transaction);
        setIsReceiptModalOpen(true);
    };

    // SmartDatePicker date state: { from: Date, to: Date }
    const [dateRange, setDateRange] = useState(() => {
        const now = new Date();
        return {
            from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0),
            to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        };
    });

    // Local State for Dashboard Data from RPC
    const [dashboardStats, setDashboardStats] = useState({
        totalSales: 0,
        totalTransactions: 0,
        avgOrder: 0,
        totalProfit: 0,
        chartData: [],
        categoryData: [],
        topProducts: [],
        recentTransactions: []
    });
    const [isLoading, setIsLoading] = useState(false);

    // Determine if single-day view (for hourly chart)
    const isSingleDay = useMemo(() => {
        if (!dateRange?.from || !dateRange?.to) return false;
        const from = new Date(dateRange.from);
        const to = new Date(dateRange.to);
        return from.getFullYear() === to.getFullYear() &&
            from.getMonth() === to.getMonth() &&
            from.getDate() === to.getDate();
    }, [dateRange]);

    // Fetch Data Effect (RPC)
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!currentStore?.id) return;
            if (!dateRange?.from || !dateRange?.to) return;

            if (String(currentStore.id).length < 5) {
                console.warn("Dashboard: Invalid store ID skipped:", currentStore.id);
                return;
            }

            setIsLoading(true);
            try {
                const start = new Date(dateRange.from);
                const end = new Date(dateRange.to);

                // Call the RPC via Safe Helper
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
                        totalProfit: Number(data.totalProfit) || 0,
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

    const chartData = useMemo(() => {
        if (!canViewFinancials) return [];

        let data = dashboardStats.chartData || [];

        // If single day, fill in missing hours for a nice 0-23 graph
        if (isSingleDay) {
            const fullHours = Array.from({ length: 24 }, (_, i) => {
                const hourLabel = `${i.toString().padStart(2, '0')}:00`;
                const found = data.find(d => d.name === hourLabel);
                return {
                    name: hourLabel,
                    total: found ? found.total : 0
                };
            });
            return fullHours;
        }

        return data;
    }, [dashboardStats.chartData, isSingleDay, canViewFinancials]);

    const stats = useMemo(() => {
        const { totalSales, totalTransactions, avgOrder } = dashboardStats;

        let newCustomersCount = 0;
        if (customers.length > 0 && dateRange?.from && dateRange?.to) {
            newCustomersCount = customers.filter(c => {
                const joined = new Date(c.createdAt || 0);
                return joined >= dateRange.from && joined <= dateRange.to;
            }).length;
        }

        return { totalSales, totalTransactions, avgOrder, newCustomers: newCustomersCount };
    }, [dashboardStats, customers, dateRange]);

    const stockCounts = useMemo(() => {
        // Use summary data if available (faster/optimized)
        if (summary && typeof summary.outOfStock !== 'undefined') {
            return {
                outOfStock: summary.outOfStock || 0,
                lowStock: summary.lowStock || 0
            };
        }

        const outOfStock = products.filter(p => (p.stock || 0) <= 0).length;
        const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) <= (p.minStock || 10)).length;
        return { outOfStock, lowStock };
    }, [products, summary]);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

    // Use data directly from RPC
    const categoryData = dashboardStats.categoryData || [];
    const recentTransactions = dashboardStats.recentTransactions || [];
    const topProducts = dashboardStats.topProducts || [];

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
                <SmartDatePicker
                    date={dateRange}
                    onDateChange={setDateRange}
                />
            </header>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                {canViewFinancials && (
                    <>
                        <InfoCard
                            title="Total Penjualan"
                            value={`Rp ${stats.totalSales.toLocaleString()}`}
                            icon={DollarSign}
                            variant="primary"
                        />
                        <InfoCard
                            title="Laba Bersih"
                            value={`Rp ${((dashboardStats.totalProfit || 0)).toLocaleString()}`}
                            icon={TrendingUp}
                            variant="success"
                        />
                        <InfoCard
                            title="Rata-rata Order"
                            value={`Rp ${Math.round(stats.avgOrder).toLocaleString()}`}
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
                            <CardHeader className="bg-white border-b p-4 lg:p-6">
                                <CardTitle className="text-lg font-bold">Penjualan per Kategori</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 lg:p-6">
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
                            <CardHeader className="bg-white border-b p-4 lg:p-6">
                                <CardTitle className="flex items-center gap-2 text-lg font-bold">
                                    Grafik Penjualan
                                    <span className="text-xs font-normal text-muted-foreground">
                                        ({isSingleDay ? 'Per Jam' : 'Per Hari'})
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 lg:p-6">
                                <div style={{ width: '100%', height: 300 }}>
                                    {isLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">Memuat data...</div>
                                    ) : chartData && chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickFormatter={(value) => `Rp ${formatCurrency(value)}`} />
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
                        <CardHeader className="bg-white border-b p-4 lg:p-6">
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
                    <CardHeader className="bg-white border-b p-4 lg:p-6">
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
