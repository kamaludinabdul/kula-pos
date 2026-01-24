import React, { useMemo, useState, useEffect } from 'react';
import { DollarSign, ShoppingBag, Users, TrendingUp, Eye, AlertTriangle, Package } from 'lucide-react';
import ReceiptModal from '../components/ReceiptModal';
import { useData } from '../context/DataContext';
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Input } from '../components/ui/input';
import { supabase } from '../supabase';
import DashboardCharts from './dashboard-components/DashboardCharts';
import { safeSupabaseRpc } from '../utils/supabaseHelper';



const StatCard = ({ title, value, change, icon, color }) => {
    const Icon = icon;
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}20`, color: color }}>
                    <Icon className="h-4 w-4" />
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
                <div className="text-lg md:text-2xl font-bold">{value}</div>
                <p className={`text-[10px] md:text-xs mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {change >= 0 ? '+' : ''}{change}% dari periode lalu
                </p>
            </CardContent>
        </Card>
    );
};

import { useAuth } from '../context/AuthContext';

// ... existing imports

const Dashboard = () => {
    const { user } = useAuth();
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

    const [dateRange, setDateRange] = useState('today');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // Local State for Dashboard Data from RPC
    const [dashboardStats, setDashboardStats] = useState({
        totalSales: 0,
        totalTransactions: 0,
        avgOrder: 0,
        chartData: [],
        categoryData: [],
        topProducts: [],
        recentTransactions: []
    });
    const [isLoading, setIsLoading] = useState(false);

    // Fetch Data Effect (RPC)
    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!currentStore?.id) return;

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

                // Call the RPC via Safe Helper
                const data = await safeSupabaseRpc({
                    rpcName: 'get_dashboard_stats',
                    params: {
                        p_store_id: currentStore.id,
                        p_start_date: start.toISOString(),
                        p_end_date: end.toISOString(),
                        p_period: dateRange === 'today' ? 'hour' : 'day'
                    }
                });

                if (data) {
                    setDashboardStats({
                        totalSales: Number(data.totalSales) || 0,
                        totalTransactions: Number(data.totalTransactions) || 0,
                        avgOrder: Number(data.avgOrder) || 0,
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
    }, [dateRange, customStartDate, customEndDate, currentStore]);

    const chartData = useMemo(() => {
        if (!canViewFinancials) return [];

        let data = dashboardStats.chartData || [];

        // If 'today', fill in missing hours for a nice 0-23 graph
        if (dateRange === 'today') {
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
    }, [dashboardStats.chartData, dateRange, canViewFinancials]);

    const stats = useMemo(() => {
        const { totalSales, totalTransactions, avgOrder } = dashboardStats;

        let newCustomersCount = 0;
        if (customers.length > 0) {
            const now = new Date();
            let start, end;
            if (dateRange === 'today') {
                start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
            } else {
                // Simplified, just approximation for "current period" logic or fallback
                start = new Date(0);
                end = now;
            }
            newCustomersCount = customers.filter(c => {
                const joined = new Date(c.createdAt || 0);
                return joined >= start && joined <= end;
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
        <div className="p-4 space-y-4 md:space-y-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 md:gap-4">
                <div>
                    <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                        Selamat datang, <span className="font-medium text-foreground">{user?.name}</span>.
                        {canViewFinancials ? ' Berikut ringkasan bisnis Anda.' : ' Siap melayani pelanggan hari ini?'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[140px] md:w-[180px] h-8 md:h-10 text-xs md:text-sm">
                            <SelectValue placeholder="Pilih periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Hari Ini</SelectItem>
                            <SelectItem value="week">7 Hari Terakhir</SelectItem>
                            <SelectItem value="month">30 Hari Terakhir</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                            <SelectItem value="all">Semua Waktu</SelectItem>
                        </SelectContent>
                    </Select>
                    {dateRange === 'custom' && (
                        <div className="flex items-center gap-2">
                            <Input
                                type="date"
                                className="min-w-[150px] md:min-w-[180px] h-8 md:h-10 text-xs md:text-sm"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                                type="date"
                                className="min-w-[150px] md:min-w-[180px] h-8 md:h-10 text-xs md:text-sm"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            </header>

            <div className="grid gap-3 md:gap-4 grid-cols-2 lg:grid-cols-4">
                {canViewFinancials && (
                    <>
                        <StatCard
                            title="Total Penjualan"
                            value={`Rp ${stats.totalSales.toLocaleString()}`}
                            change={0}
                            icon={DollarSign}
                            color="#6366f1"
                        />
                        <StatCard
                            title="Rata-rata Order"
                            value={`Rp ${Math.round(stats.avgOrder).toLocaleString()}`}
                            change={0}
                            icon={TrendingUp}
                            color="#f59e0b"
                        />
                    </>
                )}

                <StatCard
                    title="Total Transaksi"
                    value={stats.totalTransactions}
                    change={0}
                    icon={ShoppingBag}
                    color="#ec4899"
                />

                {canViewStock && (
                    <>
                        <StatCard
                            title="Stok Habis"
                            value={stockCounts.outOfStock}
                            change={0}
                            icon={AlertTriangle}
                            color="#ef4444"
                        />
                        <StatCard
                            title="Stok Menipis"
                            value={stockCounts.lowStock}
                            icon={Package}
                            color="#f59e0b"
                        />
                    </>
                )}
            </div>

            {/* Financial Charts */}
            {canViewFinancials && (
                <>
                    <div className="mt-6">
                        <DashboardCharts currentStore={currentStore} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="col-span-1">
                            <CardHeader className="p-4 md:p-6">
                                <CardTitle className="text-sm md:text-lg">Penjualan per Kategori</CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-6 pt-0">
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
                                                <Tooltip formatter={(value) => `Rp ${value.toLocaleString('id-ID')}`} />
                                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-xs md:text-sm">Belum ada data.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="col-span-1 md:col-span-2">
                            <CardHeader className="p-4 md:p-6">
                                <CardTitle className="flex items-center gap-2 text-sm md:text-lg">
                                    Grafik Penjualan
                                    <span className="text-[10px] md:text-sm font-normal text-muted-foreground">
                                        ({dateRange === 'today' ? 'Per Jam' : 'Per Hari'})
                                    </span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 md:p-6 pt-0">
                                <div style={{ width: '100%', height: 300 }}>
                                    {isLoading ? (
                                        <div className="flex items-center justify-center h-full text-muted-foreground">Memuat data...</div>
                                    ) : chartData && chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} dy={10} />
                                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#6b7280' }} tickFormatter={(value) => `Rp ${value / 1000}k`} />
                                                <Tooltip formatter={(value) => [`Rp ${value.toLocaleString()}`, 'Penjualan']} />
                                                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-muted-foreground text-xs md:text-sm">Belum ada data penjualan untuk periode ini.</div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            {/* Split Row: Top Selling & Recent Transactions */}
            <div className="grid gap-3 md:gap-4 grid-cols-1 lg:grid-cols-2">

                {/* Top Selling Products */}
                {canViewFinancials ? (
                    <Card className="col-span-1 h-full">
                        <CardHeader className="p-4 md:p-6 pb-2">
                            <CardTitle className="text-sm md:text-lg">Produk Terlaris (Periode Ini)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 md:p-6 pt-0">
                            {topProducts.length === 0 ? (
                                <p className="text-muted-foreground text-center py-8 text-sm">Tidak ada data penjualan periode ini.</p>
                            ) : (
                                <div className="grid gap-2 max-h-[300px] overflow-y-auto pr-1">
                                    {topProducts.map((item, index) => (
                                        <div key={index} className="flex items-center justify-between p-2 rounded-lg border bg-slate-50/50">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${index < 3 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                                                    <p className="text-xs text-muted-foreground">{item.sold} terjual</p>
                                                </div>
                                            </div>
                                            <div className="font-semibold text-sm">
                                                Rp {(item.revenue || 0).toLocaleString()}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                ) : <div />}

                {/* Recent Transactions */}
                <Card className="col-span-1 h-full">
                    <CardHeader className="p-4 md:p-6">
                        <CardTitle className="text-sm md:text-lg">Transaksi Terakhir</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 md:p-6 pt-0">
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-1">
                            {isLoading ? (
                                <p className="text-muted-foreground text-center py-4 text-xs md:text-sm">Memuat...</p>
                            ) : recentTransactions.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4 text-xs md:text-sm">Belum ada transaksi.</p>
                            ) : (
                                recentTransactions.map((t) => (
                                    <div key={t.id} className="flex items-center gap-3 group">
                                        <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs md:text-sm">
                                            #{t.id ? t.id.toString().slice(-4) : '????'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-xs md:text-sm">{t.cashier || 'Kasir'}</p>
                                            <p className="text-[10px] md:text-xs text-muted-foreground">
                                                {t.date ? new Date(t.date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-green-600 text-xs md:text-sm">
                                                +Rp {(t.total || 0).toLocaleString()}
                                            </div>
                                            <button
                                                onClick={() => handleViewReceipt(t)}
                                                className="text-[10px] md:text-xs text-primary hover:underline flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Eye size={12} />
                                                Lihat Struk
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
        </div >
    );
};

export default Dashboard;
