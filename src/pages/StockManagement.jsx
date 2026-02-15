import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { Search, Plus, Minus, History as HistoryIcon, ArrowUp, ArrowDown, ArrowUpDown, Trash2, Wrench } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "../components/ui/dialog";
import { Label } from '../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import Pagination from '../components/Pagination';
import ProductHistoryDialog from '../components/ProductHistoryDialog';

import * as XLSX from 'xlsx';
import { Upload, FileDown, CheckCircle, AlertCircle } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

const StockManagement = () => {
    const { products, categories, addStockBatch, reduceStockFIFO, bulkUpdateStock, deleteProduct, fetchAllProducts, activeStoreId } = useData();

    // Fetch all products for stock management
    React.useEffect(() => {
        if (activeStoreId && products.length === 0) {
            fetchAllProducts(activeStoreId);
        }
    }, [activeStoreId, products.length, fetchAllProducts]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCategory, setFilterCategory] = useState('all');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isReduceModalOpen, setIsReduceModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Add stock form
    const [addQuantity, setAddQuantity] = useState('');
    const [newBuyPrice, setNewBuyPrice] = useState('');
    const [newSellPrice, setNewSellPrice] = useState('');
    const [addNote, setAddNote] = useState('');

    // Reduce stock form
    const [reduceQuantity, setReduceQuantity] = useState('');
    const [reduceNote, setReduceNote] = useState('');

    const [importResult, setImportResult] = useState(null);
    const [isImportResultOpen, setIsImportResultOpen] = useState(false);

    // Duplicate Management
    const [duplicateGroups, setDuplicateGroups] = useState([]);
    const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
    const [isFixingDuplicates, setIsFixingDuplicates] = useState(false);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    // Sorting function
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Filter products
    const filteredProducts = products.filter(product => {
        const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (product.barcode && product.barcode.includes(searchTerm)) ||
            (product.code && product.code.includes(searchTerm));

        const matchesCategory = filterCategory === 'all' || product.category === filterCategory;

        return matchesSearch && matchesCategory;
    });

    // Sort products
    const sortedProducts = [...filteredProducts].sort((a, b) => {
        if (!sortConfig.key) return 0;

        let aValue, bValue;

        switch (sortConfig.key) {
            case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
            case 'category':
                aValue = (a.category || '').toLowerCase();
                bValue = (b.category || '').toLowerCase();
                break;
            case 'buyPrice':
                aValue = parseFloat(a.buyPrice) || 0;
                bValue = parseFloat(b.buyPrice) || 0;
                break;
            case 'sellPrice':
                aValue = parseFloat(a.sellPrice || a.price) || 0;
                bValue = parseFloat(b.sellPrice || b.price) || 0;
                break;
            case 'profit':
                aValue = (parseFloat(a.sellPrice || a.price) || 0) - (parseFloat(a.buyPrice) || 0);
                bValue = (parseFloat(b.sellPrice || b.price) || 0) - (parseFloat(b.buyPrice) || 0);
                break;
            case 'stock':
                aValue = parseInt(a.stock) || 0;
                bValue = parseInt(b.stock) || 0;
                break;
            case 'status': {
                // Sort by status: Habis (0) < Menipis (1) < Tersedia (2) < Unlimited (3)
                const getStatusValue = (product) => {
                    if (product.isUnlimited) return 3; // Unlimited
                    const stock = product.stock || 0;
                    if (!stock || stock === 0) return 0; // Habis
                    if (stock <= 10) return 1; // Menipis
                    return 2; // Tersedia
                };
                aValue = getStatusValue(a);
                bValue = getStatusValue(b);
                break;
            }
            case 'discount':
                aValue = parseFloat(a.discount) || 0;
                bValue = parseFloat(b.discount) || 0;
                break;
            default:
                return 0;
        }

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Pagination Logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentProducts = sortedProducts.slice(indexOfFirstItem, indexOfLastItem);

    const handleAddStock = (product) => {
        setSelectedProduct(product);
        setAddQuantity('');
        setNewBuyPrice(product.buyPrice || '');
        setNewSellPrice(product.sellPrice || product.price || '');
        setAddNote('');
        setIsAddModalOpen(true);
    };

    const handleReduceStock = (product) => {
        setSelectedProduct(product);
        setReduceQuantity('');
        setReduceNote('');
        setIsReduceModalOpen(true);
    };

    const handleViewHistory = (product) => {
        setSelectedProduct(product);
        setIsHistoryModalOpen(true);
    };

    const handleSubmitAdd = async (e) => {
        e.preventDefault();
        if (!selectedProduct) return;

        const qty = parseInt(addQuantity);
        const buyPrice = parseFloat(newBuyPrice);
        const sellPrice = parseFloat(newSellPrice);

        if (isNaN(qty) || qty <= 0) {
            alert('Masukkan jumlah yang valid');
            return;
        }

        if (isNaN(buyPrice) || buyPrice <= 0) {
            alert('Masukkan harga beli yang valid');
            return;
        }

        if (isNaN(sellPrice) || sellPrice <= 0) {
            alert('Masukkan harga jual yang valid');
            return;
        }

        // Use addStockBatch for FIFO tracking
        const result = await addStockBatch(
            selectedProduct.id,
            qty,
            buyPrice,
            sellPrice,
            addNote || 'Stok masuk'
        );

        if (result.success) {
            setIsAddModalOpen(false);
        } else {
            alert('Gagal menambah stok: ' + result.error);
        }
    };

    const handleSubmitReduce = async (e) => {
        e.preventDefault();
        if (!selectedProduct) return;

        const qty = parseInt(reduceQuantity);
        if (isNaN(qty) || qty <= 0) {
            alert('Masukkan jumlah yang valid');
            return;
        }

        if (qty > selectedProduct.stock) {
            alert('Jumlah tidak boleh melebihi stok saat ini');
            return;
        }

        if (!reduceNote.trim()) {
            alert('Catatan wajib diisi');
            return;
        }

        // Use FIFO logic for reducing stock (similar to processSale)
        // This will be handled by a new function in DataContext
        // For now, we'll use adjustStock but mark it for FIFO implementation
        const result = await reduceStockFIFO(selectedProduct.id, qty, reduceNote);

        if (result.success) {
            setIsReduceModalOpen(false);
        } else {
            alert('Gagal mengurangi stok: ' + result.error);
        }
    };

    // Get product history


    const handleDownloadTemplate = () => {
        const headers = [
            'Kode Produk',
            'Nama Produk',
            'Jumlah Stok'
        ];

        // Sample data to guide user
        const sampleData = products.slice(0, 5).map(p => [
            p.barcode || p.code || '',
            p.name,
            0 // Default qty 0
        ]);

        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template Stok");
        XLSX.writeFile(wb, "Template_Import_Stok.xlsx");
    };

    const handleImportStockExcel = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    const stockUpdates = jsonData
                        .filter(row => {
                            // support both old template and new simple template
                            return row['Kode Produk'] || row.barcode || row.Barcode || row.Kode;
                        })
                        .map(row => {
                            const barcode = row['Kode Produk'] || row.barcode || row.Barcode || row.Kode;
                            // support both 'Jumlah Stok' and 'qty' etc
                            const qty = row['Jumlah Stok'] || row.qty || row.Qty || row.stock || row.Stock || 0;
                            const note = 'Stock Import (Bulk)';

                            return {
                                barcode: String(barcode),
                                qty: parseInt(qty),
                                note
                            };
                        });

                    if (stockUpdates.length > 0) {
                        const result = await bulkUpdateStock(stockUpdates);
                        if (result.success) {
                            setImportResult({
                                title: "Import Berhasil",
                                message: `Stok berhasil ditambahkan untuk ${result.count} produk. (Dilewati: ${result.skipped}, Tidak Ditemukan: ${result.notFound})`,
                                success: true
                            });
                        } else {
                            setImportResult({
                                title: "Import Gagal",
                                message: `Gagal mengupdate stok: ${result.error}`,
                                success: false
                            });
                        }
                        setIsImportResultOpen(true);
                    } else {
                        setImportResult({
                            title: "Import Gagal",
                            message: "Tidak ada data produk yang valid. Pastikan kolom 'Kode Produk' dan 'Jumlah Stok' ada.",
                            success: false
                        });
                        setIsImportResultOpen(true);
                    }
                } catch (error) {
                    console.error("Stock Import Error:", error);
                    setImportResult({
                        title: "Error Import",
                        message: `Gagal memproses file: ${error.message}`,
                        success: false
                    });
                    setIsImportResultOpen(true);
                }
            };
            reader.readAsArrayBuffer(file);
            // Reset input
            event.target.value = '';
        }
    };

    const handleCheckDuplicates = () => {
        const groups = {};
        products.forEach(p => {
            const code = p.barcode || p.code;
            if (!code) return;
            if (!groups[code]) groups[code] = [];
            groups[code].push(p);
        });

        const dups = Object.entries(groups)
            .filter(([, list]) => list.length > 1)
            .map(([code, list]) => {
                // Sort by createdAt (asc) -> Oldest first
                return {
                    code,
                    items: list.sort((a, b) => {
                        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
                        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
                        return dateA - dateB;
                    })
                };
            });

        setDuplicateGroups(dups);
        setIsDuplicateModalOpen(true);
    };

    const handleFixDuplicates = async () => {
        setIsFixingDuplicates(true);
        try {
            let totalDeleted = 0;
            for (const group of duplicateGroups) {
                // Keep the first one (index 0 is oldest), delete the rest
                const toDelete = group.items.slice(1);
                for (const item of toDelete) {
                    await deleteProduct(item.id);
                    totalDeleted++;
                }
            }
            alert(`Berhasil menghapus ${totalDeleted} produk duplikat.`);
            setIsDuplicateModalOpen(false);
            // Refresh logic if needed? deleteProduct usually triggers snapshot update in DataContext
        } catch (error) {
            console.error("Error fixing duplicates:", error);
            alert("Gagal menghapus beberapa duplikat. Cek konsol.");
        } finally {
            setIsFixingDuplicates(false);
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manajemen Stok</h1>
                    <p className="text-muted-foreground">Kelola stok produk Anda</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    <Button
                        variant="outline"
                        className="text-orange-600 border-orange-200 hover:bg-orange-50 flex-1 sm:flex-none"
                        onClick={handleCheckDuplicates}
                    >
                        <Wrench className="mr-2 h-4 w-4" />
                        Cek Duplikat
                    </Button>

                    <div className="flex gap-2 w-full sm:w-auto">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="flex-1 sm:flex-none">
                                    <FileDown className="mr-2 h-4 w-4" />
                                    Template
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={handleDownloadTemplate}>
                                    Download Template Stok
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="relative flex-1 sm:flex-none">
                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleImportStockExcel}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            <Button className="bg-blue-600 hover:bg-blue-700 w-full">
                                <Upload className="mr-2 h-4 w-4" />
                                Import Stok
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari produk..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Semua Kategori</SelectItem>
                        {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.name}>
                                {cat.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="rounded-md border bg-card overflow-hidden">
                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[250px]">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSort('name')}
                                        className="h-8 px-2"
                                    >
                                        Produk
                                        {sortConfig.key === 'name' ? (
                                            sortConfig.direction === 'asc' ? (
                                                <ArrowUp className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ArrowDown className="ml-2 h-4 w-4" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[120px]">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSort('category')}
                                        className="h-8 px-2"
                                    >
                                        Kategori
                                        {sortConfig.key === 'category' ? (
                                            sortConfig.direction === 'asc' ? (
                                                <ArrowUp className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ArrowDown className="ml-2 h-4 w-4" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[130px]">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSort('buyPrice')}
                                        className="h-8 px-2"
                                    >
                                        Harga Dasar
                                        {sortConfig.key === 'buyPrice' ? (
                                            sortConfig.direction === 'asc' ? (
                                                <ArrowUp className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ArrowDown className="ml-2 h-4 w-4" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[130px]">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSort('sellPrice')}
                                        className="h-8 px-2"
                                    >
                                        Harga Jual
                                        {sortConfig.key === 'sellPrice' ? (
                                            sortConfig.direction === 'asc' ? (
                                                <ArrowUp className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ArrowDown className="ml-2 h-4 w-4" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[140px]">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSort('profit')}
                                        className="h-8 px-2"
                                    >
                                        Keuntungan
                                        {sortConfig.key === 'profit' ? (
                                            sortConfig.direction === 'asc' ? (
                                                <ArrowUp className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ArrowDown className="ml-2 h-4 w-4" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[80px]">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSort('stock')}
                                        className="h-8 px-2"
                                    >
                                        Stok
                                        {sortConfig.key === 'stock' ? (
                                            sortConfig.direction === 'asc' ? (
                                                <ArrowUp className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ArrowDown className="ml-2 h-4 w-4" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[120px]">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSort('status')}
                                        className="h-8 px-2"
                                    >
                                        Status Stok
                                        {sortConfig.key === 'status' ? (
                                            sortConfig.direction === 'asc' ? (
                                                <ArrowUp className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ArrowDown className="ml-2 h-4 w-4" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[100px]">
                                    <Button
                                        variant="ghost"
                                        onClick={() => handleSort('discount')}
                                        className="h-8 px-2"
                                    >
                                        Diskon
                                        {sortConfig.key === 'discount' ? (
                                            sortConfig.direction === 'asc' ? (
                                                <ArrowUp className="ml-2 h-4 w-4" />
                                            ) : (
                                                <ArrowDown className="ml-2 h-4 w-4" />
                                            )
                                        ) : (
                                            <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                        )}
                                    </Button>
                                </TableHead>
                                <TableHead className="w-[200px] text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentProducts.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                                        Tidak ada produk ditemukan
                                    </TableCell>
                                </TableRow>
                            ) : (
                                currentProducts.map((product) => {
                                    const buyPrice = parseFloat(product.buyPrice) || 0;
                                    const sellPrice = parseFloat(product.sellPrice || product.price) || 0;
                                    const profit = sellPrice - buyPrice;
                                    const profitPercent = buyPrice > 0 ? ((profit / buyPrice) * 100).toFixed(1) : 0;
                                    const stock = parseInt(product.stock) || 0;
                                    const discount = parseFloat(product.discount) || 0;

                                    let stockStatus = 'Aman';
                                    let stockColor = 'text-green-600';

                                    if (product.isUnlimited) {
                                        stockStatus = 'Unlimited';
                                        stockColor = 'text-blue-600 font-bold';
                                    } else if (stock === 0) {
                                        stockStatus = 'Habis';
                                        stockColor = 'text-red-600';
                                    } else if (stock <= (product.minStock || 5)) {
                                        stockStatus = 'Rendah';
                                        stockColor = 'text-orange-600';
                                    }

                                    return (
                                        <TableRow key={product.id}>
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    {product.image ? (
                                                        <img
                                                            src={product.image}
                                                            alt={product.name}
                                                            className="w-12 h-12 flex-shrink-0 rounded-lg object-cover border"
                                                        />
                                                    ) : (
                                                        <div className="w-12 h-12 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center border">
                                                            <span className="text-lg font-bold text-slate-400">
                                                                {product.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="font-medium truncate">{product.name}</div>
                                                        <div className="text-xs text-muted-foreground truncate">
                                                            {product.code || product.barcode || '-'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary">{product.category}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="text-sm">Rp {buyPrice.toLocaleString('id-ID')}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-medium">Rp {sellPrice.toLocaleString('id-ID')}</div>
                                            </TableCell>
                                            <TableCell>
                                                <div className={profit >= 0 ? "text-green-600" : "text-red-600"}>
                                                    <div className="font-medium">Rp {profit.toLocaleString('id-ID')}</div>
                                                    <div className="text-xs">({profitPercent}%)</div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className={stock <= 5 && !product.isUnlimited ? "font-medium" : ""}>
                                                    {product.isUnlimited ? "∞" : stock}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <span className={`font-medium ${stockColor}`}>
                                                    {stockStatus}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                {discount > 0 ? (
                                                    <Badge variant="destructive">
                                                        {product.discountType === 'fixed'
                                                            ? `Rp ${discount.toLocaleString('id-ID')}`
                                                            : `${discount}%`}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted-foreground">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-green-600 border-green-200 hover:bg-green-50"
                                                        onClick={() => handleAddStock(product)}
                                                        disabled={product.isUnlimited}
                                                        title={product.isUnlimited ? "Stok Unlimited" : "Tambah Stok"}
                                                    >
                                                        <Plus className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                        onClick={() => handleReduceStock(product)}
                                                        disabled={product.isUnlimited}
                                                        title={product.isUnlimited ? "Stok Unlimited" : "Kurangi Stok"}
                                                    >
                                                        <Minus className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleViewHistory(product)}
                                                    >
                                                        <HistoryIcon className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden p-4 space-y-4">
                    {currentProducts.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground">
                            Tidak ada produk ditemukan
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {currentProducts.map((product) => {
                                const stock = parseInt(product.stock) || 0;
                                let stockStatus = 'Aman';
                                let stockColor = 'bg-green-100 text-green-700';

                                if (product.isUnlimited) {
                                    stockStatus = '∞';
                                    stockColor = 'bg-blue-100 text-blue-700 font-bold';
                                } else if (stock === 0) {
                                    stockStatus = 'Habis';
                                    stockColor = 'bg-red-100 text-red-700';
                                } else if (stock <= (product.minStock || 5)) {
                                    stockStatus = 'Rendah';
                                    stockColor = 'bg-orange-100 text-orange-700';
                                }

                                return (
                                    <div key={product.id} className="bg-white rounded-xl border p-4 shadow-sm space-y-4">
                                        <div className="flex gap-4">
                                            {product.image ? (
                                                <img
                                                    src={product.image}
                                                    alt={product.name}
                                                    className="w-16 h-16 rounded-lg object-cover border"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center border text-slate-400 font-bold text-xl">
                                                    {product.name.charAt(0).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-sm truncate">{product.name}</h3>
                                                <p className="text-xs text-muted-foreground font-mono">
                                                    {product.code || product.barcode || '-'}
                                                </p>
                                                <Badge variant="secondary" className="mt-1 text-[10px] h-5 px-1.5">
                                                    {product.category}
                                                </Badge>
                                            </div>
                                            <div className="text-right">
                                                <div className={`text-xs px-2 py-0.5 rounded-full font-bold ${stockColor}`}>
                                                    {stockStatus === '∞' ? 'Unlimited' : `Stok: ${stock}`}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 pt-2 border-t">
                                            <Button
                                                variant="outline"
                                                className="flex-1 text-green-600 border-green-200 bg-green-50/50 h-10"
                                                onClick={() => handleAddStock(product)}
                                                disabled={product.isUnlimited}
                                            >
                                                <Plus className="mr-2 h-4 w-4" /> Tambah
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="flex-1 text-red-600 border-red-200 bg-red-50/50 h-10"
                                                onClick={() => handleReduceStock(product)}
                                                disabled={product.isUnlimited}
                                            >
                                                <Minus className="mr-2 h-4 w-4" /> Kurangi
                                            </Button>
                                            <Button
                                                variant="outline"
                                                className="h-10 px-3"
                                                onClick={() => handleViewHistory(product)}
                                            >
                                                <HistoryIcon className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={sortedProducts.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
            />

            {/* Add Stock Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Tambah Stok - {selectedProduct?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitAdd} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Stok Saat Ini</Label>
                            <div className="text-2xl font-bold">{selectedProduct?.stock}</div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="addQuantity">Jumlah Masuk *</Label>
                            <Input
                                id="addQuantity"
                                type="number"
                                min="1"
                                value={addQuantity}
                                onChange={(e) => setAddQuantity(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newBuyPrice">Harga Beli Baru</Label>
                            <Input
                                id="newBuyPrice"
                                type="number"
                                step="0.01"
                                value={newBuyPrice}
                                onChange={(e) => setNewBuyPrice(e.target.value)}
                                placeholder="Kosongkan jika tidak berubah"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="newSellPrice">Harga Jual Baru</Label>
                            <Input
                                id="newSellPrice"
                                type="number"
                                step="0.01"
                                value={newSellPrice}
                                onChange={(e) => setNewSellPrice(e.target.value)}
                                placeholder="Kosongkan jika tidak berubah"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="addNote">Keterangan</Label>
                            <Textarea
                                id="addNote"
                                value={addNote}
                                onChange={(e) => setAddNote(e.target.value)}
                                placeholder="Contoh: Pembelian dari supplier X"
                                rows={3}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" className="bg-green-600 hover:bg-green-700">
                                Tambah Stok
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Reduce Stock Modal */}
            <Dialog open={isReduceModalOpen} onOpenChange={setIsReduceModalOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Kurangi Stok - {selectedProduct?.name}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmitReduce} className="space-y-4">
                        <div className="space-y-2">
                            <Label>Stok Saat Ini</Label>
                            <div className="text-2xl font-bold">{selectedProduct?.stock}</div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reduceQuantity">Jumlah Keluar *</Label>
                            <Input
                                id="reduceQuantity"
                                type="number"
                                min="1"
                                max={selectedProduct?.stock}
                                value={reduceQuantity}
                                onChange={(e) => setReduceQuantity(e.target.value)}
                                required
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="reduceNote">Catatan *</Label>
                            <Textarea
                                id="reduceNote"
                                value={reduceNote}
                                onChange={(e) => setReduceNote(e.target.value)}
                                placeholder="Contoh: Produk rusak, kadaluarsa, dll"
                                rows={3}
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsReduceModalOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit" variant="destructive">
                                Kurangi Stok
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* History Modal */}
            <ProductHistoryDialog
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                product={selectedProduct}
            />
            {/* Import Result Dialog */}
            <Dialog open={isImportResultOpen} onOpenChange={setIsImportResultOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {importResult?.success ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-red-600" />
                            )}
                            {importResult?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p>{importResult?.message}</p>
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsImportResultOpen(false)}>
                            Tutup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Duplicate Check Dialog */}
            <Dialog open={isDuplicateModalOpen} onOpenChange={setIsDuplicateModalOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Duplikat Produk Ditemukan</DialogTitle>
                        <DialogDescription>
                            Berikut adalah daftar produk dengan barcode yang sama.
                            Sistem akan <strong>menyimpan yang terlama (Oldest)</strong> dan menghapus sisanya.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[60vh] overflow-y-auto space-y-4">
                        {duplicateGroups.length === 0 ? (
                            <div className="text-center py-4 text-green-600 font-medium">
                                Tidak ada duplikat ditemukan! Database Anda bersih.
                            </div>
                        ) : (
                            duplicateGroups.map((group, index) => (
                                <div key={index} className="border rounded-md p-3">
                                    <div className="font-semibold mb-2 flex items-center gap-2">
                                        <Badge variant="outline">{group.code}</Badge>
                                        <span className="text-sm text-muted-foreground">{group.items[0].name}</span>
                                    </div>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Status</TableHead>
                                                <TableHead>ID</TableHead>
                                                <TableHead>Nama</TableHead>
                                                <TableHead>Stok</TableHead>
                                                <TableHead>Dibuat</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {group.items.map((item, idx) => (
                                                <TableRow key={item.id} className={idx === 0 ? "bg-green-50" : "bg-red-50"}>
                                                    <TableCell>
                                                        {idx === 0 ? (
                                                            <Badge className="bg-green-600">Simpan</Badge>
                                                        ) : (
                                                            <Badge variant="destructive">Hapus</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs">{item.id.slice(0, 8)}...</TableCell>
                                                    <TableCell>{item.name}</TableCell>
                                                    <TableCell>{item.stock}</TableCell>
                                                    <TableCell className="text-xs">
                                                        {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            ))
                        )}
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDuplicateModalOpen(false)}>
                            Tutup
                        </Button>
                        {duplicateGroups.length > 0 && (
                            <Button
                                variant="destructive"
                                onClick={handleFixDuplicates}
                                disabled={isFixingDuplicates}
                            >
                                {isFixingDuplicates ? "Sedang Menghapus..." : "Hapus Duplikat"}
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default StockManagement;
