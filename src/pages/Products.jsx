import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { getOptimizedImage } from '../utils/supabaseImage';

import { Search, Plus, Upload, Trash2, Edit, MoreVertical, FileDown, ArrowUpDown, ArrowUp, ArrowDown, Printer } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Pagination from '../components/Pagination';
import ConfirmDialog from '../components/ConfirmDialog';
import BarcodeLabelDialog from '../components/BarcodeLabelDialog';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "../components/ui/dialog";

const Products = () => {
    const navigate = useNavigate();
    const { products, deleteProduct, bulkAddProducts, categories } = useData();

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [filterSatuanPO, setFilterSatuanPO] = useState('all'); // New Filter State

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [importResult, setImportResult] = useState(null);
    const [isImportResultOpen, setIsImportResultOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
    const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState([]);

    // Import Progress State
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ step: '', current: 0, total: 0 });

    // Toggle select all
    const handleSelectAll = (checked) => {
        if (checked) {
            setSelectedProducts(currentProducts.map(p => p.id));
        } else {
            setSelectedProducts([]);
        }
    };

    // Toggle individual product
    const handleSelectProduct = (productId) => {
        setSelectedProducts(prev => {
            if (prev.includes(productId)) {
                return prev.filter(id => id !== productId);
            } else {
                return [...prev, productId];
            }
        });
    };

    // Bulk delete
    const handleBulkDelete = async () => {
        if (selectedProducts.length === 0) return;

        const confirmDelete = window.confirm(`Are you sure you want to delete ${selectedProducts.length} product(s)?`);
        if (!confirmDelete) return;

        for (const productId of selectedProducts) {
            await deleteProduct(productId);
        }
        setSelectedProducts([]);
    };

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
            (product.barcode && product.barcode.includes(searchTerm));

        let matchesCategory = true;
        if (selectedCategory !== 'all') {
            if (Array.isArray(product.category)) {
                const categoryNames = product.category.map(c => (typeof c === 'object' && c?.name) ? c.name : c);
                matchesCategory = categoryNames.includes(selectedCategory);
            } else {
                const categoryName = (typeof product.category === 'object' && product.category?.name) ? product.category.name : product.category;
                matchesCategory = categoryName === selectedCategory;
            }
        }

        // Filter by Satuan PO
        let matchesSatuanPO = true;
        if (filterSatuanPO !== 'all') {
            const hasSatuanPO = product.purchaseUnit && product.conversionToUnit > 0;
            if (filterSatuanPO === 'yes') {
                matchesSatuanPO = hasSatuanPO;
            } else if (filterSatuanPO === 'no') {
                matchesSatuanPO = !hasSatuanPO;
            }
        }

        return matchesSearch && matchesCategory && matchesSatuanPO;
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
            case 'discount':
                aValue = parseFloat(a.discount) || 0;
                bValue = parseFloat(b.discount) || 0;
                break;
            case 'category': {
                const getCatName = (cat) => {
                    if (Array.isArray(cat)) {
                        return cat.map(c => (typeof c === 'object' && c?.name) ? c.name : c).join(', ');
                    }
                    return (typeof cat === 'object' && cat?.name) ? cat.name : cat;
                };
                aValue = String(getCatName(a.category) || '').toLowerCase();
                bValue = String(getCatName(b.category) || '').toLowerCase();
                break;
            }
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

    // Reset page when filter changes
    useEffect(() => {
        setTimeout(() => setCurrentPage(1), 0);
    }, [searchTerm, selectedCategory, filterSatuanPO]);


    const handleEdit = (product) => {
        navigate(`/products/edit/${product.id}`);
    };

    const handleDelete = (product) => {
        setProductToDelete(product);
        setIsDeleteOpen(true);
    };

    const confirmDelete = async () => {
        if (productToDelete) {
            await deleteProduct(productToDelete.id);
            setProductToDelete(null);
        }
    };

    const handleExportCSV = () => {
        const csv = Papa.unparse(filteredProducts);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'products.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImportCSV = (event) => {
        const file = event.target.files[0];
        if (file) {
            Papa.parse(file, {
                header: true,
                complete: async (results) => {
                    const productsToAdd = results.data
                        .filter(row => row.name && row.price) // Basic validation
                        .map(row => ({
                            name: row.name,
                            price: parseFloat(row.price),
                            buyPrice: parseFloat(row.cost || row.buyPrice || 0),
                            sellPrice: parseFloat(row.price),
                            stock: parseInt(row.stock || 0),
                            category: row.category || 'Uncategorized',
                            barcode: row.barcode || '',
                            sku: row.sku || ''
                        }));

                    if (productsToAdd.length > 0) {
                        const result = await bulkAddProducts(productsToAdd);
                        if (result.success) {
                            setImportResult({
                                title: "Import Successful",
                                message: `Successfully imported ${result.count} products! ${result.skipped > 0 ? `(${result.skipped} duplicates skipped)` : ''}`,
                                success: true
                            });
                        } else {
                            setImportResult({
                                title: "Import Failed",
                                message: `Import failed: ${result.error}`,
                                success: false
                            });
                        }
                        setIsImportResultOpen(true);
                    }
                }
            });
        }
    };

    const handleDownloadTemplate = () => {
        const headers = [
            'nama_barang_edit',
            'kode_barang_edit',
            'kategori',
            'harga_beli_edit',
            'harga_jual_edit',
            'stok_edit',
            'minimum_stok',
            'diskon',
            'tipe_diskon',
            'berat',
            'letak_rak',
            'barang_jasa_edit'
        ];
        const sampleData = [
            ['Kopi Susu Gula Aren', '8991002003001', 'Minuman', 10000, 18000, 50, 5, 0, 'percent', 250, 'Rak A1', 'barang'],
            ['Jasa Potong Rambut', 'SRV001', 'Jasa', 0, 35000, 0, 0, 0, 'percent', 0, '-', 'jasa']
        ];

        const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template Import");
        XLSX.writeFile(wb, "Template_Produk_KULA.xlsx");
    };

    const handleImportExcel = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    // Start import process
                    setIsImporting(true);
                    setImportProgress({ step: 'Membaca file Excel...', current: 0, total: 100 });

                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    setImportProgress({ step: 'Memproses data produk...', current: 20, total: 100 });

                    const productsToAdd = jsonData
                        .filter(row => row.nama_barang_edit || row.name || row.Name || row.Nama)
                        .map(row => {
                            const name = row.nama_barang_edit || row.name || row.Name || row.Nama;
                            const barcode = row.kode_barang_edit || row.barcode || row.Barcode || row.Kode || '';
                            const category = row.kategori || row.category || row.Category || 'Uncategorized';
                            const buyPrice = row.harga_beli_edit || row.buyPrice || row.cost || row.Cost || 0;
                            const sellPrice = row.harga_jual_edit || row.sellPrice || row.price || row.Price || 0;
                            const stock = row.stok_edit || row.stock || row.Stock || row.Qty || 0;
                            const minStock = row.minimum_stok || row.minStock || 5;
                            const discount = row.diskon || row.discount || 0;
                            const discountType = row.tipe_diskon || row.discountType || 'percent';
                            const weight = row.berat || row.weight || 0;
                            const rackLocation = row.letak_rak || row.rackLocation || '';
                            const type = (row.barang_jasa_edit || '').toLowerCase().includes('jasa') ? 'service' : 'goods';

                            return {
                                name: String(name),
                                barcode: String(barcode),
                                code: String(barcode),
                                category: String(category),
                                buyPrice: parseFloat(buyPrice),
                                sellPrice: parseFloat(sellPrice),
                                price: parseFloat(sellPrice),
                                stock: parseInt(stock),
                                minStock: parseInt(minStock),
                                discount: parseFloat(discount),
                                discountType: String(discountType),
                                weight: parseFloat(weight),
                                rackLocation: String(rackLocation),
                                type: String(type)
                            };
                        });

                    if (productsToAdd.length > 0) {
                        setImportProgress({
                            step: `Mengupload ${productsToAdd.length} produk ke database...`,
                            current: 50,
                            total: 100
                        });

                        // Debug: Log first product to see what's being sent
                        console.log('Import Debug - First product:', JSON.stringify(productsToAdd[0], null, 2));
                        console.log('Import Debug - Total products:', productsToAdd.length);

                        const result = await bulkAddProducts(productsToAdd);

                        setImportProgress({ step: 'Selesai!', current: 100, total: 100 });

                        // Small delay to show completion
                        await new Promise(resolve => setTimeout(resolve, 500));
                        setIsImporting(false);

                        if (result.success) {
                            setImportResult({
                                title: "Import Berhasil",
                                message: `Berhasil mengimport ${result.count} produk! ${result.skipped > 0 ? `(${result.skipped} duplikat dilewati)` : ''}`,
                                success: true
                            });
                        } else {
                            setImportResult({
                                title: "Import Gagal",
                                message: `Import gagal: ${result.error}`,
                                success: false
                            });
                        }
                        setIsImportResultOpen(true);
                    } else {
                        setIsImporting(false);
                        setImportResult({
                            title: "Import Gagal",
                            message: "Tidak ada produk valid ditemukan. Gunakan template yang benar.",
                            success: false
                        });
                        setIsImportResultOpen(true);
                    }
                } catch (error) {
                    console.error("Excel Import Error:", error);
                    setIsImporting(false);
                    setImportResult({
                        title: "Import Error",
                        message: `Gagal memproses file Excel: ${error.message}`,
                        success: false
                    });
                    setIsImportResultOpen(true);
                }
            };
            reader.readAsArrayBuffer(file);
        }
        // Reset input so same file can be selected again
        event.target.value = '';
    };




    const handleExportExcel = () => {
        const worksheet = XLSX.utils.json_to_sheet(filteredProducts);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
        XLSX.writeFile(workbook, "products.xlsx");
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Products</h1>
                    <p className="text-muted-foreground">Manage your product inventory</p>
                </div>
                <div className="flex gap-2">
                    {selectedProducts.length > 0 && (
                        <>
                            <Button
                                variant="outline"
                                onClick={() => setIsBarcodeDialogOpen(true)}
                                className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                            >
                                <Printer className="mr-2 h-4 w-4" />
                                Cetak Barcode ({selectedProducts.length})
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={handleBulkDelete}
                            >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedProducts.length})
                            </Button>
                        </>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                <FileDown className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={handleExportCSV}>
                                Export as CSV
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleExportExcel}>
                                Export as Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDownloadTemplate} className="border-t mt-1 pt-1 text-indigo-600">
                                Download Import Template
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleImportCSV}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button variant="outline">
                            <Upload className="mr-2 h-4 w-4" />
                            Import CSV
                        </Button>
                    </div>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleImportExcel}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button variant="outline" className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200">
                            <Upload className="mr-2 h-4 w-4" />
                            Import Excel
                        </Button>
                    </div>

                    <Button onClick={() => navigate('/products/add')}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product
                    </Button>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search products..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Categories</SelectItem>
                            {categories.map(cat => {
                                const catName = typeof cat.name === 'object' && cat.name?.name ? cat.name.name : cat.name;
                                return (
                                    <SelectItem key={cat.id} value={catName}>{catName}</SelectItem>
                                );
                            })}
                        </SelectContent>
                    </Select>
                    <Select value={filterSatuanPO} onValueChange={setFilterSatuanPO}>
                        <SelectTrigger className="w-full sm:w-[150px]">
                            <SelectValue placeholder="Satuan PO" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua Satuan</SelectItem>
                            <SelectItem value="yes">Ada Satuan PO</SelectItem>
                            <SelectItem value="no">Tanpa Satuan PO</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-md border bg-card overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={selectedProducts.length === currentProducts.length && currentProducts.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="min-w-[250px]">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('name')}
                                    className="h-8 px-2 hover:bg-transparent"
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
                                    className="h-8 px-2 hover:bg-transparent"
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
                                    className="h-8 px-2 hover:bg-transparent"
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
                                    className="h-8 px-2 hover:bg-transparent"
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
                                    className="h-8 px-2 hover:bg-transparent"
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
                                    className="h-8 px-2 hover:bg-transparent"
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
                            <TableHead className="w-[120px]">Status Stok</TableHead>
                            <TableHead className="w-[120px]">Satuan PO</TableHead>
                            <TableHead className="w-[100px]">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('discount')}
                                    className="h-8 px-2 hover:bg-transparent"
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
                            <TableHead className="w-[80px] text-right">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {currentProducts.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                                    No products found
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
                                    stockColor = 'text-blue-600';
                                } else if (stock === 0) {
                                    stockStatus = 'Habis';
                                    stockColor = 'text-red-600';
                                } else if (stock <= 5) {
                                    stockStatus = 'Rendah';
                                    stockColor = 'text-orange-600';
                                }

                                return (
                                    <TableRow key={product.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedProducts.includes(product.id)}
                                                onCheckedChange={() => handleSelectProduct(product.id)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {product.image ? (
                                                    <div className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg object-cover border bg-white overflow-hidden">
                                                        <img
                                                            src={getOptimizedImage(product.image, { width: 40, quality: 50 })}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-lg bg-slate-100 flex items-center justify-center border">
                                                        <span className="text-lg font-bold text-slate-400">
                                                            {product.name.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="font-medium">{product.name}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {product.code || product.barcode || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {Array.isArray(product.category) ? (
                                                    product.category.map((cat, idx) => (
                                                        <Badge key={idx} variant="secondary" className="text-[10px] px-1 py-0">
                                                            {typeof cat === 'object' && cat?.name ? cat.name : cat}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <Badge variant="secondary">
                                                        {typeof product.category === 'object' && product.category?.name
                                                            ? product.category.name
                                                            : product.category}
                                                    </Badge>
                                                )}
                                            </div>
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
                                            {product.purchaseUnit && product.conversionToUnit > 0 ? (
                                                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                                                    {product.purchaseUnit}
                                                </Badge>
                                            ) : (
                                                <span className="text-muted-foreground">-</span>
                                            )}
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
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Open menu</span>
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleEdit(product)}>
                                                        <Edit className="mr-2 h-4 w-4" />
                                                        Edit
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() => handleDelete(product)}
                                                        className="text-red-600"
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Delete
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={sortedProducts.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
            />

            <ConfirmDialog
                isOpen={isDeleteOpen}
                onClose={() => setIsDeleteOpen(false)}
                onConfirm={confirmDelete}
                title="Delete Product"
                description={`Are you sure you want to delete "${productToDelete?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                variant="destructive"
            />

            <Dialog open={isImportResultOpen} onOpenChange={setIsImportResultOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{importResult?.title}</DialogTitle>
                        <DialogDescription>
                            {importResult?.message}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setIsImportResultOpen(false)}>
                            Tutup
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Import Progress Dialog */}
            <Dialog open={isImporting} onOpenChange={() => { }}>
                <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="inline-block w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                            Mengimport Produk...
                        </DialogTitle>
                        <DialogDescription>
                            {importProgress.step}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="w-full bg-slate-200 rounded-full h-2.5">
                            <div
                                className="bg-indigo-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${importProgress.current}%` }}
                            />
                        </div>
                        <p className="text-sm text-center text-muted-foreground">
                            {importProgress.current}%
                        </p>
                    </div>
                </DialogContent>
            </Dialog>

            <BarcodeLabelDialog
                isOpen={isBarcodeDialogOpen}
                onClose={() => setIsBarcodeDialogOpen(false)}
                products={products.filter(p => selectedProducts.includes(p.id))}
            />
        </div >
    );
};

export default Products;
