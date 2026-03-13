import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import {
    AlertTriangle,
    ShoppingCart,
    Search,
    ArrowLeft,
    Plus,
    FileText,
    Filter,
    ArrowUpDown,
    Download,
    PackageSearch
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import { useBusinessType } from '../hooks/useBusinessType';
import * as XLSX from 'xlsx';

const DefectaReport = () => {
    const navigate = useNavigate();
    const { products } = useData();
    const { term } = useBusinessType();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [sortConfig, setSortConfig] = useState({ key: 'stock', direction: 'asc' });

    // 1. Filter products which are below min_stock
    const defectaProducts = useMemo(() => {
        if (!products || !Array.isArray(products)) return [];
        return products.filter(p => {
            if (!p) return false;
            const stock = Number(p.stock) || 0;
            const minStock = Number(p.minStock || p.min_stock) || 0;

            // Defecta: Stock <= Min Stock AND not Unlimited AND not Jasa
            const isDefecta = !p.isUnlimited && p.stockType !== 'Jasa' && stock <= minStock;

            if (!isDefecta) return false;

            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                const pName = p.name ? p.name.toLowerCase() : '';
                const pCode = p.code ? p.code.toLowerCase() : '';
                return pName.includes(term) || pCode.includes(term);
            }
            return true;
        }).map(p => {
            const stock = Number(p.stock) || 0;
            const minStock = Number(p.minStock || p.min_stock) || 0;
            const diff = minStock - stock;
            // Suggested Qty: Buffer to get to at least 2x minStock or at least 10 units
            const suggested = Math.max(diff + minStock, 10);

            return {
                ...p,
                minStock,
                stock,
                suggested
            };
        }).sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }, [products, searchTerm, sortConfig]);

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === defectaProducts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(defectaProducts.map(p => p.id)));
        }
    };

    const toggleSelect = (id) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const handleCreatePO = () => {
        if (selectedIds.size === 0) return;

        const selectedProducts = defectaProducts.filter(p => selectedIds.has(p.id));

        const poItems = selectedProducts.map(p => {
            const conversion = Number(p.conversionToUnit) || 1;
            // suggest in PO units if applicable
            const qtyPO = Math.ceil(p.suggested / conversion);

            return {
                productId: p.id,
                productName: p.name,
                qty: qtyPO,
                qtyBase: qtyPO * conversion,
                buyPrice: Number(p.buyPrice) || 0,
                subtotal: (Number(p.buyPrice) || 0) * (qtyPO * conversion)
            };
        });

        navigate('/purchase-orders/new', {
            state: {
                recommendedItems: poItems,
                notes: `Dibuat otomatis dari Laporan Defecta (${new Date().toLocaleDateString('id-ID')})`
            }
        });
    };

    const exportToExcel = () => {
        const data = defectaProducts.map(p => ({
            'Nama Barang': p.name,
            'Kode': p.code || '-',
            'Satuan': p.unit || 'Pcs',
            'Stok Saat Ini': p.stock,
            'Stok Minimum': p.minStock,
            'Saran Order': p.suggested
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Defecta");
        XLSX.writeFile(wb, `Laporan_Defecta_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="p-4 space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <AlertTriangle className="h-6 w-6 text-amber-500" />
                            Laporan Defecta
                        </h1>
                        <p className="text-muted-foreground text-sm">
                            Daftar {term('product').toLowerCase()} dengan stok kritis yang perlu segera dipesan (restock).
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={exportToExcel} className="gap-2">
                        <Download className="h-4 w-4" /> Export Excel
                    </Button>
                    <Button
                        onClick={handleCreatePO}
                        disabled={selectedIds.size === 0}
                        className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                        <ShoppingCart className="h-4 w-4" />
                        Buat PO ({selectedIds.size})
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-amber-50 border-amber-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-amber-800">Total Defecta</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-900">{defectaProducts.length} Item</div>
                        <p className="text-xs text-amber-700 mt-1">Obat/Barang di bawah stok minimum</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Stok Kosong</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                            {defectaProducts.filter(p => p.stock <= 0).length} Item
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Benar-benar habis (stock-out)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Saran Order</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-indigo-600">
                            {defectaProducts.reduce((acc, p) => acc + p.suggested, 0).toLocaleString()} Unit
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total akumulasi saran pembelian</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari obat / barang..."
                                className="pl-9"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-normal">
                                <Filter className="h-3 w-3 mr-1 opacity-50" />
                                Semua Kategori
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {defectaProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <PackageSearch className="h-16 w-16 text-muted-foreground opacity-20 mb-4" />
                            <h3 className="text-lg font-medium">Aman! Stok Mencukupi</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto mt-2">
                                Tidak ada barang yang berada di bawah stok minimum saat ini.
                            </p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                    <TableHead className="w-[40px]">
                                        <Checkbox
                                            checked={selectedIds.size === defectaProducts.length}
                                            onCheckedChange={toggleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                                        Nama {term('product')} <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </TableHead>
                                    <TableHead className="text-right cursor-pointer" onClick={() => handleSort('stock')}>
                                        Stok Saat Ini <ArrowUpDown className="inline h-3 w-3 ml-1" />
                                    </TableHead>
                                    <TableHead className="text-right">Stok Min</TableHead>
                                    <TableHead className="text-right text-indigo-600 font-bold">Saran Order</TableHead>
                                    <TableHead className="text-center">Satuan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {defectaProducts.map((p) => (
                                    <TableRow key={p.id} className={p.stock <= 0 ? "bg-red-50/30" : ""}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(p.id)}
                                                onCheckedChange={() => toggleSelect(p.id)}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelect(p.id);
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{p.name}</div>
                                            <div className="text-[10px] text-muted-foreground">{p.code || '-'}</div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            <span className={p.stock <= 0 ? "text-red-600" : "text-amber-600"}>
                                                {p.stock}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">{p.minStock}</TableCell>
                                        <TableCell className="text-right font-bold text-indigo-600">
                                            {p.suggested}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="secondary" className="font-normal text-[10px]">
                                                {p.unit || 'Pcs'}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default DefectaReport;
