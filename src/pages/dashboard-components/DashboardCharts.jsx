
import React, { useState, useEffect } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { safeSupabaseQuery } from '../../utils/supabaseHelper';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';

const DashboardCharts = ({ currentStore }) => {
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    useEffect(() => {
        const fetchData = async () => {
            if (!currentStore?.id) return;

            setLoading(true);
            try {
                // Initialize selected year (Jan - Dec)
                const monthMap = new Map();

                for (let i = 0; i < 12; i++) {
                    const d = new Date(selectedYear, i, 1);
                    const monthKey = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                    monthMap.set(monthKey, {
                        name: d.toLocaleString('id-ID', { month: 'short' }), // Use short name for better fit (Jan, Feb...)
                        fullName: monthKey,
                        monthIndex: i,
                        year: selectedYear,
                        totalRevenue: 0,
                        totalProfit: 0,
                        totalOpEx: 0,
                        daysWithValue: new Set(),
                        transactionsCount: 0
                    });
                }

                // Calculate Start and End Date for the selected year
                const startOfYear = new Date(selectedYear, 0, 1);
                startOfYear.setHours(0, 0, 0, 0);

                const endOfYear = new Date(selectedYear, 11, 31);
                endOfYear.setHours(23, 59, 59, 999);

                // 1. Fetch Transactions
                const transactions = await safeSupabaseQuery({
                    tableName: 'transactions',
                    queryBuilder: (q) => q.select('date, total, items, status')
                        .eq('store_id', currentStore.id)
                        .gte('date', startOfYear.toISOString())
                        .lte('date', endOfYear.toISOString()),
                    fallbackParams: `?store_id=eq.${currentStore.id}&date=gte.${startOfYear.toISOString()}&date=lte.${endOfYear.toISOString()}&select=date,total,items,status`
                });

                // 2. Fetch Cash Flow (Expenses)
                const expenses = await safeSupabaseQuery({
                    tableName: 'cash_flow',
                    queryBuilder: (q) => q.select('date, amount, expense_group')
                        .eq('store_id', currentStore.id)
                        .eq('type', 'out')
                        .gte('date', startOfYear.toISOString())
                        .lte('date', endOfYear.toISOString()),
                    fallbackParams: `?store_id=eq.${currentStore.id}&type=eq.out&date=gte.${startOfYear.toISOString()}&date=lte.${endOfYear.toISOString()}&select=date,amount,expense_group`
                });

                // Process Transactions
                transactions.forEach(t => {
                    if (t.status === 'void' || t.status === 'cancelled') return;

                    const tDate = new Date(t.date);
                    if (tDate < startOfYear || tDate > endOfYear) return; // Filter by selected year

                    // Fallback using index construction if locale string varies
                    // Better to just construct key same way loop did:
                    const d = new Date(tDate.getFullYear(), tDate.getMonth(), 1);
                    const key = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });

                    const record = monthMap.get(key);

                    if (record) {
                        record.totalRevenue += (t.total || 0);

                        // Calculate Profit
                        let cogs = 0;
                        if (t.items) {
                            t.items.forEach(i => {
                                cogs += (Number(i.buyPrice) || 0) * i.qty;
                            });
                        }
                        record.totalProfit += ((t.total || 0) - cogs);
                        record.daysWithValue.add(tDate.getDate());
                        record.transactionsCount += 1;
                    }
                });

                // Process Expenses
                expenses.forEach(e => {
                    const eDate = new Date(e.date);
                    if (eDate < startOfYear || eDate > endOfYear) return; // Filter by selected year

                    const d = new Date(eDate.getFullYear(), eDate.getMonth(), 1);
                    const key = d.toLocaleString('id-ID', { month: 'long', year: 'numeric' });
                    const record = monthMap.get(key);

                    if (record) {
                        record.totalOpEx += (Number(e.amount) || 0);
                    }
                });

                const data = Array.from(monthMap.values()).map(m => ({
                    ...m,
                    avgDailyRevenue: m.daysWithValue.size > 0 ? m.totalRevenue / m.daysWithValue.size : 0,
                    avgDailyProfit: m.daysWithValue.size > 0 ? m.totalProfit / m.daysWithValue.size : 0
                }));

                setChartData(data);

            } catch (error) {
                console.error("Error fetching chart data:", error);
                // Even on error, try to show empty charts if data partly failed?
                // For now, let it fall through.
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [currentStore, selectedYear]);

    // Generate year options (current year back 5 years)
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

    if (loading) {
        return <div className="text-center py-10 text-muted-foreground">Memuat grafik...</div>;
    }

    const formatCurrency = (val) => {
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)} jt`;
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-800 tracking-tight">Ringkasan Keuangan</h3>
                <div className="w-[120px]">
                    <Select
                        value={selectedYear.toString()}
                        onValueChange={(val) => setSelectedYear(Number(val))}
                    >
                        <SelectTrigger className="bg-white border-slate-200 shadow-sm">
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
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Omset Bulanan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#818cf8" stopOpacity={0.5} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="totalRevenue" fill="url(#colorRevenue)" radius={[6, 6, 0, 0]} name="Total Omset" barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Tren Laba (Bar) */}
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Tren Laba Harian (Rata-rata)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#34d399" stopOpacity={0.5} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="avgDailyProfit" fill="url(#colorProfit)" radius={[6, 6, 0, 0]} name="Laba Rata-rata" barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Tren Omset Harian (Bar) */}
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Tren Omset Harian (Rata-rata)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorDailyRev" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.5} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="avgDailyRevenue" fill="url(#colorDailyRev)" radius={[6, 6, 0, 0]} name="Omset Rata-rata" barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. Pengeluaran Operasional (Bar) */}
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Pengeluaran Operasional</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.8} />
                                            <stop offset="100%" stopColor="#fb7185" stopOpacity={0.5} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#94a3b8' }} />
                                    <YAxis width={60} fontSize={10} tickLine={false} axisLine={false} tickFormatter={formatCurrency} tick={{ fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="totalOpEx" fill="url(#colorExpense)" radius={[6, 6, 0, 0]} name="Pengeluaran Ops" barSize={32} />
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
