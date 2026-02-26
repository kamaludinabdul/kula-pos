
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const DashboardCharts = ({ currentStore }) => {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!currentStore?.id) {
                console.warn("DashboardCharts: No store ID available.");
                if (isMounted) {
                    setLoading(false);
                    setChartData([]);
                }
                return;
            }

            setLoading(true);
            try {
                // Use RPC with SECURITY DEFINER to bypass RLS issues
                const { safeSupabaseRpc } = await import('../../utils/supabaseHelper');

                const rpcData = await safeSupabaseRpc({
                    rpcName: 'get_dashboard_monthly_summary',
                    params: {
                        p_store_id: currentStore.id,
                        p_year: selectedYear
                    }
                });

                if (rpcData && Array.isArray(rpcData)) {
                    // RPC returns pre-formatted data with Indonesian month names
                    const data = rpcData.map(m => ({
                        ...m,
                        // Convert month name to Indonesian short format
                        name: new Date(selectedYear, m.monthIndex, 1).toLocaleString('id-ID', { month: 'short' }),
                        daysWithValue: { size: m.daysWithSales || 0 } // For backwards compatibility
                    }));
                    setChartData(data);
                } else {
                    // Fallback to empty months if RPC fails
                    const emptyData = [];
                    for (let i = 0; i < 12; i++) {
                        emptyData.push({
                            name: new Date(selectedYear, i, 1).toLocaleString('id-ID', { month: 'short' }),
                            monthIndex: i,
                            totalRevenue: 0,
                            totalProfit: 0,
                            totalOpEx: 0,
                            avgDailyRevenue: 0,
                            avgDailyProfit: 0,
                            transactionsCount: 0
                        });
                    }
                    setChartData(emptyData);
                }
            } catch (error) {
                console.error("DashboardCharts: Error fetching chart data:", error);
                // Initialize empty chart data on error
                const emptyData = [];
                for (let i = 0; i < 12; i++) {
                    emptyData.push({
                        name: new Date(selectedYear, i, 1).toLocaleString('id-ID', { month: 'short' }),
                        monthIndex: i,
                        totalRevenue: 0,
                        totalProfit: 0,
                        totalOpEx: 0,
                        avgDailyRevenue: 0,
                        avgDailyProfit: 0,
                        transactionsCount: 0
                    });
                }
                setChartData(emptyData);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [currentStore, selectedYear]);

    // Generate year options (current year back 5 years)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    if (loading) {
        return <div className="text-center py-10 text-muted-foreground">Memuat grafik...</div>;
    }

    const formatCurrency = (val) => {
        if (val >= 1000000) {
            // Show up to 2 decimals, but remove trailing zeros (e.g., 12.06 jt, 12 jt)
            const num = (val / 1000000).toFixed(2);
            return `${Number(num)} jt`;
        }
        if (val >= 1000) return `${(val / 1000).toFixed(0)} rb`;
        return `${val}`;
    };

    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-3 border border-slate-100 shadow-xl rounded-lg text-sm">
                    <p className="font-semibold text-slate-700 mb-1">{label} {selectedYear}</p>
                    {payload.map((entry, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-slate-500">{entry.name}:</span>
                            <span className="font-medium" style={{ color: entry.color }}>
                                Rp {entry.value.toLocaleString('id-ID')}
                            </span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800 tracking-tight">Ringkasan Keuangan</h3>
                <div className="w-[140px]">
                    <Select
                        value={selectedYear.toString()}
                        onValueChange={(val) => setSelectedYear(Number(val))}
                    >
                        <SelectTrigger className="bg-slate-100 border-none font-bold text-slate-700 h-9 rounded-lg shadow-none">
                            <SelectValue placeholder="Tahun" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(y => (
                                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* 1. Omset Bulanan (Bar) */}
                <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden">
                    <CardHeader className="p-4 lg:p-6 pb-0">
                        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Omset Bulanan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#4f46e5" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#818cf8" stopOpacity={0.8} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="totalRevenue" fill="url(#colorRevenue)" radius={[6, 6, 0, 0]} name="Total Omset" barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Tren Laba (Bar) */}
                <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden">
                    <CardHeader className="p-4 lg:p-6 pb-0">
                        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Laba Kotor Rata-rata Harian</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#059669" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#34d399" stopOpacity={0.8} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="avgDailyProfit" fill="url(#colorProfit)" radius={[6, 6, 0, 0]} name="Laba Rata-rata" barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Tren Omset Harian (Bar) */}
                <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden">
                    <CardHeader className="p-4 lg:p-6 pb-0">
                        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Omset Rata-rata Harian</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorDailyRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.8} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="avgDailyRevenue" fill="url(#colorDailyRev)" radius={[6, 6, 0, 0]} name="Omset Rata-rata" barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Pengeluaran Operasional (Bar) */}
                <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden">
                    <CardHeader className="p-4 lg:p-6 pb-0">
                        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pengeluaran Operasional</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#e11d48" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#fb7185" stopOpacity={0.8} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="totalOpEx" fill="url(#colorExpense)" radius={[6, 6, 0, 0]} name="Pengeluaran Ops" barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Laba Bersih Bulanan (Bar) */}
                <Card className="border-none shadow-sm bg-white rounded-xl overflow-hidden md:col-span-2">
                    <CardHeader className="p-4 lg:p-6 pb-0">
                        <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Laba Kotor Bulanan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 lg:p-6">
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorNetProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                                            <stop offset="100%" stopColor="#34d399" stopOpacity={0.8} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8', fontWeight: 600 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="totalProfit" fill="url(#colorNetProfit)" radius={[6, 6, 0, 0]} name="Laba Bersih" barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default DashboardCharts;
