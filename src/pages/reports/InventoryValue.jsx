import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, Package, Download } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { exportToCSV } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const InventoryValue = () => {
    const { products, summary, fetchAllProducts, activeStoreId } = useData();

    // Trigger full products fetch for detailed table
    React.useEffect(() => {
        if (activeStoreId) {
            fetchAllProducts(activeStoreId);
        }
    }, [activeStoreId, fetchAllProducts]);

    const stats = useMemo(() => {
        // Use pre-calculated summary if products list is not yet loaded
        if (products.length === 0 && summary) {
            return {
                totalStock: summary.totalStock || 0,
                totalCapital: summary.totalValue || 0,
                potentialRevenue: 0, // Not currently in summary snapshot
                potentialProfit: 0
            };
        }

        let totalStock = 0;
        let totalCapital = 0; // Total Modal (Buy Price * Stock)
        let potentialRevenue = 0; // Potensi Pendapatan (Sell Price * Stock)

        products.forEach(p => {
            const stock = parseInt(p.stock || 0);
            const buyPrice = parseInt(p.buyPrice || 0);
            const sellPrice = parseInt(p.sellPrice || p.price || 0);

            if (stock > 0) {
                totalStock += stock;
                totalCapital += (stock * buyPrice);
                potentialRevenue += (stock * sellPrice);
            }
        });

        const potentialProfit = potentialRevenue - totalCapital;

        return { totalStock, totalCapital, potentialRevenue, potentialProfit };
    }, [products, summary]);

    const handleExport = () => {
        const dataToExport = products
            .filter(p => p.stock > 0)
            .sort((a, b) => (b.stock * b.buyPrice) - (a.stock * a.buyPrice))
            .map(p => {
                const stock = parseInt(p.stock || 0);
                const buyPrice = parseInt(p.buyPrice || 0);
                const sellPrice = parseInt(p.sellPrice || p.price || 0);
                const totalModal = stock * buyPrice;
                const potentialProfit = (stock * sellPrice) - totalModal;

                return {
                    "Nama Barang": p.name,
                    "Stok": stock,
                    "Harga Beli": buyPrice,
                    "Harga Jual": sellPrice,
                    "Total Modal": totalModal,
                    "Potensi Laba": potentialProfit
                };
            });

        exportToCSV(dataToExport, `Laporan_Nilai_Inventaris_${new Date().toISOString().split('T')[0]}.csv`);
    };

    return (
        <div className="space-y-6">

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Nilai Stok</h2>
                    <p className="text-muted-foreground">Analisis nilai aset dan potensi keuntungan stok.</p>
                </div>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Stok Barang</CardTitle>
                        <Package className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.totalStock.toLocaleString()} unit</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Modal (Aset)</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp {stats.totalCapital.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Potensi Pendapatan</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">Rp {stats.potentialRevenue.toLocaleString()}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Potensi Laba</CardTitle>
                        <DollarSign className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">Rp {stats.potentialProfit.toLocaleString()}</div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Rincian Nilai Stok</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama Barang</TableHead>
                                    <TableHead>Stok</TableHead>
                                    <TableHead>Harga Beli</TableHead>
                                    <TableHead>Harga Jual</TableHead>
                                    <TableHead>Total Modal</TableHead>
                                    <TableHead>Potensi Laba</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            Tidak ada data produk.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    products
                                        .filter(p => p.stock > 0)
                                        .sort((a, b) => (b.stock * b.buyPrice) - (a.stock * a.buyPrice))
                                        .map((p) => {
                                            const stock = parseInt(p.stock || 0);
                                            const buyPrice = parseInt(p.buyPrice || 0);
                                            const sellPrice = parseInt(p.sellPrice || p.price || 0);
                                            const totalModal = stock * buyPrice;
                                            const potentialProfit = (stock * sellPrice) - totalModal;

                                            return (
                                                <TableRow key={p.id}>
                                                    <TableCell className="font-medium">{p.name}</TableCell>
                                                    <TableCell>{stock}</TableCell>
                                                    <TableCell>Rp {buyPrice.toLocaleString()}</TableCell>
                                                    <TableCell>Rp {sellPrice.toLocaleString()}</TableCell>
                                                    <TableCell>Rp {totalModal.toLocaleString()}</TableCell>
                                                    <TableCell className="text-green-600 font-medium">Rp {potentialProfit.toLocaleString()}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default InventoryValue;
