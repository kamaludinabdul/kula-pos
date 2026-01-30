import React, { useMemo } from 'react';
import { DollarSign, TrendingUp, Package, Download, RefreshCw } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { exportToCSV } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { InfoCard } from '../../components/ui/info-card';
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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Laporan Nilai Stok</h2>
                    <p className="text-muted-foreground">Analisis nilai aset dan potensi keuntungan stok.</p>
                </div>
                <div className="flex gap-2 w-full lg:w-auto">
                    <Button variant="outline" onClick={() => fetchAllProducts(activeStoreId)} className="flex-1 lg:flex-none">
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                    <Button variant="outline" onClick={handleExport} className="flex-1 lg:flex-none">
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <InfoCard
                    title="Total Stok"
                    value={`${stats.totalStock.toLocaleString()} unit`}
                    icon={Package}
                    variant="default"
                />
                <InfoCard
                    title="Total Modal"
                    value={`Rp ${stats.totalCapital.toLocaleString()}`}
                    icon={DollarSign}
                    variant="info"
                />
                <InfoCard
                    title="Potensi Omzet"
                    value={`Rp ${stats.potentialRevenue.toLocaleString()}`}
                    icon={TrendingUp}
                    variant="primary"
                />
                <InfoCard
                    title="Potensi Laba"
                    value={`Rp ${stats.potentialProfit.toLocaleString()}`}
                    icon={DollarSign}
                    variant="success"
                />
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block">
                <Card className="rounded-xl overflow-hidden border-none shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-lg font-bold text-slate-800">Rincian Nilai Stok</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow>
                                    <TableHead>Nama Barang</TableHead>
                                    <TableHead className="text-center">Stok</TableHead>
                                    <TableHead>Harga Beli</TableHead>
                                    <TableHead>Harga Jual</TableHead>
                                    <TableHead>Total Modal</TableHead>
                                    <TableHead className="text-right">Potensi Laba</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {products.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
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
                                                <TableRow key={p.id} className="hover:bg-slate-50 transition-colors">
                                                    <TableCell className="font-bold text-slate-800">{p.name}</TableCell>
                                                    <TableCell className="text-center font-medium">{stock}</TableCell>
                                                    <TableCell className="text-slate-500">Rp {buyPrice.toLocaleString()}</TableCell>
                                                    <TableCell className="text-slate-500">Rp {sellPrice.toLocaleString()}</TableCell>
                                                    <TableCell className="font-bold text-blue-600">Rp {totalModal.toLocaleString()}</TableCell>
                                                    <TableCell className="text-right text-green-600 font-bold">Rp {potentialProfit.toLocaleString()}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
                {products.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-white rounded-xl border">Tidak ada data.</div>
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
                                <div key={p.id} className="bg-white rounded-xl p-4 border-none shadow-sm space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <h3 className="font-bold text-slate-800 text-sm tracking-tight">{p.name}</h3>
                                            <div className="flex gap-2">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">STOK: {stock}</span>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">MODAL</p>
                                            <p className="text-sm font-extrabold text-blue-600">Rp {totalModal.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-y-3">
                                        <div>
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Beli/Jual</p>
                                            <p className="text-xs font-medium text-slate-700">Rp {buyPrice.toLocaleString()} / Rp {sellPrice.toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Potensi Laba</p>
                                            <p className="text-sm font-extrabold text-green-600">Rp {potentialProfit.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                )}
            </div>
        </div>
    );
};

export default InventoryValue;
