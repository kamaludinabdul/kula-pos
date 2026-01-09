
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { getDateRange } from '../../lib/utils';
import { supabase } from '../../supabase';

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

                // Call the high-performance RPC
                const { data, error } = await supabase.rpc('get_product_sales_report', {
                    p_store_id: currentStore.id,
                    p_start_date: startDate.toISOString(),
                    p_end_date: endDateTime.toISOString()
                });

                if (error) throw error;

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
            <div className="space-y-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Penjualan Kategori</h2>
                    <p className="text-muted-foreground">
                        Analisis penjualan dan performa profit berdasarkan kategori produk.
                    </p>
                </div>

                <div className="flex justify-start">
                    <SmartDatePicker
                        date={datePickerDate}
                        onDateChange={setDatePickerDate}
                    />
                </div>
            </div>

            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Rincian Performa Kategori</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
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
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        <div className="flex items-center justify-center gap-2">
                                            Memuat data...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : categoryStats.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        Tidak ada data penjualan pada periode ini.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                categoryStats.map((item, index) => (
                                    <TableRow key={index}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${index < 3 ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                                                {item.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            Rp {item.value.toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-right text-green-600">
                                            Rp {item.profit.toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${item.margin >= 30 ? 'bg-green-100 text-green-700' :
                                                item.margin >= 15 ? 'bg-blue-100 text-blue-700' :
                                                    'bg-orange-100 text-orange-700'
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
    );
};


export default CategorySales;
