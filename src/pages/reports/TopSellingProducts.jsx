import React, { useState, useEffect } from 'react';
import { safeSupabaseRpc } from '../../utils/supabaseHelper';
import { TrendingUp, Package, Download, DollarSign, Layers, RefreshCw } from 'lucide-react';
import { exportToCSV } from '../../lib/utils';
import { exportTopSellingToPDF } from '../../lib/pdfExport';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Produk Terlaris</h2>
                    <p className="text-muted-foreground">Analisis produk dengan performa penjualan terbaik.</p>
                </div>
                <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-2">
                    <div className="flex gap-2 w-full lg:w-auto">
                        <Button variant="outline" onClick={fetchTopProducts} disabled={loading} className="flex-1 lg:flex-none rounded-[10px]">
                            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                        <Button variant="outline" onClick={handleExportPDF} className="flex-1 lg:flex-none rounded-[10px]">
                            <Download className="mr-2 h-4 w-4" />
                            PDF
                        </Button>
                        <Button variant="outline" onClick={handleExport} className="flex-1 lg:flex-none rounded-[10px]">
                            <Download className="mr-2 h-4 w-4" />
                            CSV
                        </Button>
                    </div>
                    <div className="w-full lg:w-auto">
                        <SmartDatePicker
                            date={datePickerDate}
                            onDateChange={setDatePickerDate}
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Urutkan:</span>
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[160px] h-9 border-none bg-slate-100 font-bold text-slate-700 rounded-[10px] px-3">
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

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard
                    title="Unit Terjual"
                    value={products.reduce((sum, p) => sum + p.totalQuantity, 0).toLocaleString()}
                    icon={Package}
                    variant="default"
                />
                <InfoCard
                    title="Total Pendapatan"
                    value={`Rp ${products.reduce((sum, p) => sum + p.totalRevenue, 0).toLocaleString()}`}
                    icon={DollarSign}
                    variant="success"
                />
                <InfoCard
                    title="Total Profit"
                    value={`Rp ${products.reduce((sum, p) => sum + p.totalProfit, 0).toLocaleString()}`}
                    icon={TrendingUp}
                    variant="info"
                />
                <InfoCard
                    title="Variasi Produk"
                    value={products.length}
                    icon={Layers} // Using Layers as 'Box/Variation' isn't imported, or use generic
                    variant="purple"
                />
            </div>

            <Card className="rounded-xl border-none shadow-sm overflow-hidden">
                <CardHeader className="p-4 lg:p-6 bg-white border-b">
                    <CardTitle className="text-lg font-bold">Peringkat Produk</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop Table View */}
                    <div className="hidden lg:block">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead className="w-[80px] font-bold text-slate-700">Rank</TableHead>
                                    <TableHead className="font-bold text-slate-700">Nama Produk</TableHead>
                                    <TableHead className="font-bold text-slate-700">Kategori</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700">Qty Terjual</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700">Pendapatan</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700">Profit</TableHead>
                                    <TableHead className="text-right font-bold text-slate-700">Transaksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                                            Tidak ada data penjualan.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products.map((product, index) => (
                                        <TableRow key={product.productId || product.name} className="hover:bg-slate-50 transition-colors border-b border-slate-100">
                                            <TableCell>{getRankBadge(index)}</TableCell>
                                            <TableCell className="font-bold text-slate-800">{product.name}</TableCell>
                                            <TableCell className="text-slate-500 font-medium">{product.category}</TableCell>
                                            <TableCell className="text-right font-extrabold text-slate-900">
                                                {product.totalQuantity.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-green-600 font-extrabold">
                                                Rp {product.totalRevenue.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-blue-600 font-extrabold">
                                                Rp {product.totalProfit.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right text-slate-400 font-bold">
                                                {product.transactionCount}x
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Card View */}
                    <div className="lg:hidden divide-y divide-slate-50">
                        {loading ? (
                            <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
                        ) : products.length === 0 ? (
                            <div className="text-center py-12 text-muted-foreground">Tidak ada data.</div>
                        ) : (
                            products.map((product, index) => (
                                <div key={product.productId || product.name} className="p-4 space-y-3 bg-white">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-start gap-3">
                                            <div className="mt-0.5">
                                                {getRankBadge(index)}
                                            </div>
                                            <div className="space-y-0.5">
                                                <p className="text-sm font-bold text-slate-800 leading-tight">{product.name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{product.category}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-extrabold text-slate-900">{product.totalQuantity.toLocaleString()} <span className="text-[10px] text-slate-400">UNIT</span></p>
                                            <p className="text-[10px] text-slate-400 font-bold">{product.transactionCount}x Transaksi</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-slate-50">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Pendapatan</span>
                                            <span className="text-xs font-extrabold text-green-600">Rp {product.totalRevenue.toLocaleString()}</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter leading-none mb-1">Profit</span>
                                            <span className="text-xs font-extrabold text-blue-600">Rp {product.totalProfit.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TopSellingProducts;
