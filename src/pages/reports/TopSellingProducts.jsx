import React, { useState, useEffect } from 'react';
import { safeSupabaseRpc } from '../../utils/supabaseHelper';
import { TrendingUp, Package, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/utils';
import { exportTopSellingToPDF } from '../../lib/pdfExport';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';

import { SmartDatePicker } from '../../components/SmartDatePicker';

// ... (previous imports remain the same, ensure SmartDatePicker is added)

const TopSellingProducts = () => {
    const { currentStore } = useData();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    // Initialize with current month
    const [datePickerDate, setDatePickerDate] = useState({
        from: new Date(new Date().setHours(0, 0, 0, 0)),
        to: new Date()
    });
    const [sortBy, setSortBy] = useState('quantity'); // 'quantity' or 'revenue'

    const fetchTopProducts = React.useCallback(async () => {
        if (!currentStore?.id) return;
        setLoading(true);
        try {
            const startDate = datePickerDate?.from;
            const endDate = datePickerDate?.to || datePickerDate?.from;
            if (!startDate) return;

            const queryEndDate = new Date(endDate);
            queryEndDate.setHours(23, 59, 59, 999);

            // Call the high-performance RPC via Safe Helper
            const data = await safeSupabaseRpc({
                rpcName: 'get_product_sales_report',
                params: {
                    p_store_id: currentStore.id,
                    p_start_date: startDate.toISOString(),
                    p_end_date: queryEndDate.toISOString()
                }
            });

            // Map and sort
            let productsArray = (data || []).map(row => ({
                productId: row.product_id,
                name: row.product_name,
                category: row.category_name || '-',
                totalQuantity: parseFloat(row.total_qty),
                totalRevenue: parseFloat(row.total_revenue),
                totalProfit: parseFloat(row.total_profit),
                transactionCount: parseInt(row.transaction_count)
            }));

            if (sortBy === 'quantity') {
                productsArray.sort((a, b) => b.totalQuantity - a.totalQuantity);
            } else if (sortBy === 'revenue') {
                productsArray.sort((a, b) => b.totalRevenue - a.totalRevenue);
            } else if (sortBy === 'profit') {
                productsArray.sort((a, b) => b.totalProfit - a.totalProfit);
            }

            setProducts(productsArray);

        } catch (error) {
            console.error("Error fetching top products RPC:", error);
        } finally {
            setLoading(false);
        }
    }, [datePickerDate, sortBy, currentStore]);

    useEffect(() => {
        fetchTopProducts();
    }, [fetchTopProducts]);

    const handleExport = () => {
        const dataToExport = products.map((product, index) => ({
            "Ranking": index + 1,
            "Nama Produk": product.name,
            "Kategori": product.category,
            "Jumlah Terjual": product.totalQuantity,
            "Total Pendapatan": product.totalRevenue,
            "Total Profit": product.totalProfit,
            "Jumlah Transaksi": product.transactionCount
        }));

        exportToCSV(dataToExport, `Produk_Terlaris_${new Date().toISOString().split('T')[0]}.csv`);
    };

    const handleExportPDF = () => {
        // Simplified period label
        const dateRangeText = `${datePickerDate?.from?.toLocaleDateString('id-ID')} - ${datePickerDate?.to?.toLocaleDateString('id-ID')}`;
        exportTopSellingToPDF(products, currentStore?.name || 'KULA', dateRangeText);
    };

    const getRankBadge = (index) => {
        if (index === 0) return <Badge className="bg-yellow-500">🥇 #1</Badge>;
        if (index === 1) return <Badge className="bg-gray-400">🥈 #2</Badge>;
        if (index === 2) return <Badge className="bg-orange-600">🥉 #3</Badge>;
        return <Badge variant="outline">#{index + 1}</Badge>;
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="text-2xl font-bold tracking-tight">Produk Terlaris</h2>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleExportPDF}>
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                        <Button variant="outline" onClick={handleExport}>
                            <Download className="mr-2 h-4 w-4" />
                            CSV
                        </Button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="w-full md:w-auto">
                        <SmartDatePicker
                            date={datePickerDate}
                            onDateChange={setDatePickerDate}
                        />
                    </div>

                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Urutkan" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="quantity">Jumlah Terjual</SelectItem>
                            <SelectItem value="revenue">Pendapatan</SelectItem>
                            <SelectItem value="profit">Profit</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Produk Terjual</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {products.reduce((sum, p) => sum + p.totalQuantity, 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Unit terjual</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Pendapatan</CardTitle>
                        <TrendingUp className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            Rp {products.reduce((sum, p) => sum + p.totalRevenue, 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground">Dari produk terjual</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Variasi Produk</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{products.length}</div>
                        <p className="text-xs text-muted-foreground">Jenis produk berbeda</p>
                    </CardContent>
                </Card>
            </div>

            {/* Products Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Daftar Produk Terlaris</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[80px]">Rank</TableHead>
                                    <TableHead>Nama Produk</TableHead>
                                    <TableHead>Kategori</TableHead>
                                    <TableHead className="text-right">Qty Terjual</TableHead>
                                    <TableHead className="text-right">Pendapatan</TableHead>
                                    <TableHead className="text-right">Profit</TableHead>
                                    <TableHead className="text-right">Transaksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                                            Tidak ada data penjualan.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product, index) => (
                                        <TableRow key={product.productId || product.name}>
                                            <TableCell>{getRankBadge(index)}</TableCell>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell>{product.category}</TableCell>
                                            <TableCell className="text-right font-medium">
                                                {product.totalQuantity.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-green-600 font-medium">
                                                Rp {product.totalRevenue.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-blue-600 font-medium">
                                                Rp {product.totalProfit.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {product.transactionCount}x
                                            </TableCell>
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

export default TopSellingProducts;
