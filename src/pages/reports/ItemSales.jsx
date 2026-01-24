
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Download, ArrowUpDown } from 'lucide-react';
import { exportToCSV, getDateRange } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { SmartDatePicker } from '../../components/SmartDatePicker';
import { supabase } from '../../supabase';
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
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Laporan Penjualan Barang</h2>
                        <p className="text-muted-foreground">Analisis performa penjualan per item.</p>
                    </div>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>

                <div className="flex justify-start">
                    <SmartDatePicker
                        date={datePickerDate}
                        onDateChange={setDatePickerDate}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            Rp {itemStats.reduce((acc, curr) => acc + curr.revenue, 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Keuntungan</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            Rp {itemStats.reduce((acc, curr) => acc + curr.profit, 0).toLocaleString()}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Laporan Penjualan per Barang
                        {isLoading && <span className="text-xs text-muted-foreground font-normal ml-2">(Memuat data...)</span>}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[300px] cursor-pointer hover:bg-muted/50" onClick={() => handleSort('name')}>
                                        Nama Barang <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('qty')}>
                                        Terjual (Qty) <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('revenue')}>
                                        Total Pendapatan <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                                    </TableHead>
                                    <TableHead className="cursor-pointer hover:bg-muted/50" onClick={() => handleSort('profit')}>
                                        Keuntungan <ArrowUpDown className="ml-2 h-4 w-4 inline-block" />
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : itemStats.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                            Tidak ada data penjualan.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    itemStats.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell>{item.qty}</TableCell>
                                            <TableCell>Rp {item.revenue.toLocaleString()}</TableCell>
                                            <TableCell className="text-green-600 font-medium">Rp {item.profit.toLocaleString()}</TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default ItemSales;
