
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Download, ArrowUpDown } from 'lucide-react';
import { exportToCSV, getDateRange } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { safeSupabaseRpc } from '../../utils/supabaseHelper';

const ItemSales = () => {
    const { currentStore } = useData(); // Removed transactions, products
    // Initial state: Today
    const [datePickerDate, setDatePickerDate] = useState(() => {
        const { startDate, endDate } = getDateRange('today');
        return { from: startDate, to: endDate };
    });

    const [fetchedTransactions, setFetchedTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Fallback if undefined (shouldn't happen with valid util)
    useEffect(() => {
        if (!datePickerDate?.from) {
            const { startDate, endDate } = getDateRange('today');
            setDatePickerDate({ from: startDate, to: endDate });
        }
    }, [datePickerDate?.from]);

    // Fetch Aggregated Item Sales
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

                // Map database fields to UI fields
                const processedData = (data || []).map(row => ({
                    id: row.product_id,
                    name: row.product_name,
                    qty: parseFloat(row.total_qty),
                    revenue: parseFloat(row.total_revenue),
                    cogs: parseFloat(row.total_cogs),
                    profit: parseFloat(row.total_profit),
                    category: row.category_name
                }));

                setFetchedTransactions(processedData);

            } catch (error) {
                console.error("Error fetching item sales RPC:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [currentStore, datePickerDate]);

    const [sortConfig, setSortConfig] = useState({ key: 'revenue', direction: 'desc' });

    const itemStats = useMemo(() => {
        let data = [...fetchedTransactions];

        // Sorting
        if (sortConfig.key) {
            data.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return data;
    }, [fetchedTransactions, sortConfig]);

    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleExport = () => {
        const dataToExport = itemStats.map(item => ({
            "Nama Barang": item.name,
            "Terjual (Qty)": item.qty,
            "Total Pendapatan": item.revenue,
            "Keuntungan": item.profit
        }));

        exportToCSV(dataToExport, `Laporan_Penjualan_Barang_${new Date().toISOString().split('T')[0]}.csv`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Penjualan Barang</h2>
                    <p className="text-muted-foreground">Analisis performa penjualan per item.</p>
                </div>
                <div className="flex w-full lg:w-auto gap-2">
                    <Button variant="outline" onClick={handleExport} className="flex-1 lg:flex-none">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                    <div className="flex-1 lg:flex-none">
                        <SmartDatePicker
                            date={datePickerDate}
                            onDateChange={setDatePickerDate}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="rounded-xl border-none shadow-sm bg-indigo-50">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] font-bold text-indigo-800 uppercase tracking-widest">Total Pendapatan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl lg:text-2xl font-extrabold text-indigo-600">
                            Rp {itemStats.reduce((acc, curr) => acc + curr.revenue, 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-xl border-none shadow-sm bg-green-50">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-[10px] font-bold text-green-800 uppercase tracking-widest">Total Keuntungan</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-xl lg:text-2xl font-extrabold text-green-600">
                            Rp {itemStats.reduce((acc, curr) => acc + curr.profit, 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block">
                <Card className="rounded-xl overflow-hidden border-none shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            Laporan Penjualan per Barang
                            {isLoading && <span className="text-xs text-muted-foreground font-normal ml-2">(Memuat data...)</span>}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[300px] cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('name')}>
                                        Nama Barang <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('qty')}>
                                        Terjual (Qty) <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('revenue')}>
                                        Total Pendapatan <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('profit')}>
                                        Keuntungan <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : itemStats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-12 text-muted-foreground">
                                            Tidak ada data penjualan.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    itemStats.map((item, index) => (
                                        <TableRow key={index} className="hover:bg-slate-50 transition-colors">
                                            <TableCell className="font-bold text-slate-800">{item.name}</TableCell>
                                            <TableCell className="font-medium">{item.qty}</TableCell>
                                            <TableCell className="font-bold">Rp {item.revenue.toLocaleString()}</TableCell>
                                            <TableCell className="text-green-600 font-bold">Rp {item.profit.toLocaleString()}</TableCell>
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
                ) : itemStats.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border">Tidak ada data.</div>
                ) : (
                    itemStats.map((item, index) => (
                        <div key={index} className="bg-white rounded-xl p-4 border-none shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1">
                                    <h3 className="font-bold text-slate-800 text-sm tracking-tight">{item.name}</h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {item.category || 'TANPA KATEGORI'}
                                    </p>
                                </div>
                                <div className="bg-slate-100 px-2 py-1 rounded text-[10px] font-bold text-slate-600 uppercase">
                                    {item.qty} TERJUAL
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pendapatan</p>
                                    <p className="text-sm font-extrabold text-slate-900">Rp {item.revenue.toLocaleString()}</p>
                                </div>
                                <div className="space-y-0.5 text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profit</p>
                                    <p className="text-sm font-extrabold text-green-600">Rp {item.profit.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ItemSales;
