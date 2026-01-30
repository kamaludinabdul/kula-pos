
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { DollarSign, TrendingUp, Star, Percent } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { getDateRange } from '../../lib/utils';
import { safeSupabaseRpc } from '../../utils/supabaseHelper';

const CategorySales = () => {
    const { currentStore } = useData(); // Removed transactions
    // Initial state: This Month
    const [datePickerDate, setDatePickerDate] = useState(() => {
        const { startDate, endDate } = getDateRange('today');
        return { from: startDate, to: endDate };
    });

    const [fetchedTransactions, setFetchedTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!datePickerDate?.from) {
            const { startDate, endDate } = getDateRange('month');
            setDatePickerDate({ from: startDate, to: endDate });
        }
    }, [datePickerDate]);

    // Fetch Aggregated Category Sales
    useEffect(() => {
        const fetchData = async () => {
            if (!currentStore?.id || !datePickerDate?.from) return;

            setIsLoading(true);
            try {
                const startDate = datePickerDate.from;
                const endDate = datePickerDate.to || datePickerDate.from;
                const endDateTime = new Date(endDate);
                endDateTime.setHours(23, 59, 59, 999);

                // Call the high-performance RPC via Safe Helper
                const data = await safeSupabaseRpc({
                    rpcName: 'get_product_sales_report',
                    params: {
                        p_store_id: currentStore.id,
                        p_start_date: startDate.toISOString(),
                        p_end_date: endDateTime.toISOString()
                    }
                });

                // Aggregate product data by category for this report
                const categoryMap = {};
                (data || []).forEach(row => {
                    const catName = row.category_name || 'Uncategorized';
                    if (!categoryMap[catName]) {
                        categoryMap[catName] = {
                            name: catName,
                            value: 0,
                            cost: 0,
                            profit: 0
                        };
                    }
                    categoryMap[catName].value += parseFloat(row.total_revenue || 0);
                    categoryMap[catName].cost += parseFloat(row.total_cogs || 0);
                    categoryMap[catName].profit += parseFloat(row.total_profit || 0);
                });

                const processedData = Object.values(categoryMap).map(item => ({
                    ...item,
                    margin: item.value > 0 ? (item.profit / item.value) * 100 : 0
                })).sort((a, b) => b.value - a.value);

                setFetchedTransactions(processedData);

            } catch (error) {
                console.error("Error fetching category sales RPC:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [currentStore, datePickerDate]);


    const categoryStats = useMemo(() => {
        return fetchedTransactions;
    }, [fetchedTransactions]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Penjualan Kategori</h2>
                    <p className="text-muted-foreground">
                        Analisis penjualan dan performa profit berdasarkan kategori produk.
                    </p>
                </div>
                <div className="w-full lg:w-auto">
                    <SmartDatePicker
                        date={datePickerDate}
                        onDateChange={setDatePickerDate}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard
                    title="Total Penjualan"
                    value={`Rp ${categoryStats.reduce((sum, item) => sum + item.value, 0).toLocaleString()}`}
                    icon={DollarSign}
                    variant="primary"
                />
                <InfoCard
                    title="Total Profit"
                    value={`Rp ${categoryStats.reduce((sum, item) => sum + item.profit, 0).toLocaleString()}`}
                    icon={TrendingUp}
                    variant="success"
                />
                <InfoCard
                    title="Kategori Terlaris"
                    value={categoryStats.length > 0 ? categoryStats[0].name : '-'}
                    icon={Star}
                    variant="warning"
                />
                <InfoCard
                    title="Margin Rata-rata"
                    value={`${categoryStats.length > 0
                        ? (categoryStats.reduce((sum, item) => sum + item.profit, 0) / categoryStats.reduce((sum, item) => sum + item.value, 0) * 100).toFixed(1)
                        : 0}%`}
                    icon={Percent}
                    variant="info"
                />
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block">
                <Card className="rounded-xl overflow-hidden border-none shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-lg font-bold">Rincian Performa Kategori</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[40%]">Kategori</TableHead>
                                    <TableHead className="text-right">Total Penjualan</TableHead>
                                    <TableHead className="text-right">Keuntungan (Profit)</TableHead>
                                    <TableHead className="text-right">Margin (%)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : categoryStats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                            Tidak ada data penjualan pada periode ini.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    categoryStats.map((item, index) => (
                                        <TableRow key={index} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="font-bold">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2 h-2 rounded-full ${index < 3 ? (index === 0 ? 'bg-indigo-600' : index === 1 ? 'bg-indigo-400' : 'bg-indigo-300') : 'bg-slate-200'}`}></div>
                                                    {item.name}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-slate-900">
                                                Rp {item.value.toLocaleString('id-ID')}
                                            </TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">
                                                Rp {item.profit.toLocaleString('id-ID')}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <span className={`px-2 py-1 rounded-md text-[10px] font-bold tracking-tighter uppercase ${item.margin >= 30 ? 'bg-green-50 text-green-700' :
                                                    item.margin >= 15 ? 'bg-blue-50 text-blue-700' :
                                                        'bg-orange-50 text-orange-700'
                                                    }`}>
                                                    {item.margin.toFixed(1)}%
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
                {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border">Memuat data...</div>
                ) : categoryStats.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border">Tidak ada data.</div>
                ) : (
                    categoryStats.map((item, index) => (
                        <div key={index} className="bg-white rounded-xl p-4 border-none shadow-sm space-y-3">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${index < 3 ? 'bg-indigo-600' : 'bg-slate-200'}`}></div>
                                    <h3 className="font-bold text-slate-800 text-sm tracking-tight">{item.name}</h3>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${item.margin >= 30 ? 'bg-green-50 text-green-700 border border-green-100' :
                                    item.margin >= 15 ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                        'bg-orange-50 text-orange-700 border border-orange-100'
                                    }`}>
                                    {item.margin.toFixed(1)}% MARGIN
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Penjualan</p>
                                    <p className="text-sm font-extrabold text-slate-900">Rp {item.value.toLocaleString('id-ID')}</p>
                                </div>
                                <div className="space-y-0.5 text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Keuntungan</p>
                                    <p className="text-sm font-extrabold text-green-600">Rp {item.profit.toLocaleString('id-ID')}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};


export default CategorySales;
