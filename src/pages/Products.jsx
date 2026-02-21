import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { getOptimizedImage } from '../utils/supabaseImage';

import { Search, Plus, Upload, Trash2, Edit, MoreVertical, FileDown, ArrowUpDown, ArrowUp, ArrowDown, Printer, Package, Copy, RefreshCw } from 'lucide-react';
import AlertDialog from '../components/AlertDialog';
import { safeSupabaseRpc } from '../utils/supabaseHelper';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
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
import { hasFeatureAccess } from '../utils/plans';
import { getPricingInsights } from '../utils/ai';
import { Sparkles, Lock, Loader2 } from 'lucide-react';

const Products = () => {
    const navigate = useNavigate();
    const { checkPermission, user } = useAuth();
    const { deleteProduct, bulkAddProducts, categories, fetchProductsPage, fetchAllProducts, activeStoreId, stores } = useData();

    // Server-side state
    const [currentProducts, setCurrentProducts] = useState([]);
    const [totalItems, setTotalItems] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    // Filters & Pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [filterSatuanPO, setFilterSatuanPO] = useState('all');

    // Debounce Search
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });

    // Modal States
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [productToDelete, setProductToDelete] = useState(null);
    const [importResult, setImportResult] = useState(null);
    const [isImportResultOpen, setIsImportResultOpen] = useState(false);
    const [isBarcodeDialogOpen, setIsBarcodeDialogOpen] = useState(false);
    const [selectedProducts, setSelectedProducts] = useState([]);

    // Copy to Store States
    const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
    const [targetStoreId, setTargetStoreId] = useState('');
    const [isCopying, setIsCopying] = useState(false);
    const [copyAlert, setCopyAlert] = useState({ open: false, title: '', message: '' });

    // Import Progress State
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ step: '', current: 0, total: 0 });

    // AI Pricing States
    const [isAiPricingOpen, setIsAiPricingOpen] = useState(false);
    const [aiPricingData, setAiPricingData] = useState({ product: null, advice: '', loading: false });

    const currentStore = stores.find(s => s.id === activeStoreId);
    const userPlan = currentStore?.owner?.plan || 'free';
    const hasAiPricingAccess = hasFeatureAccess(userPlan, 'features.ai_pricing');
    const hasApiKey = Boolean(currentStore?.settings?.geminiApiKey || import.meta.env.VITE_GEMINI_API_KEY);

    // Fetch Products (Server Side)
    const loadProducts = useCallback(async () => {
        if (!fetchProductsPage) return;
        setIsLoading(true);
        try {
            const { data, total } = await fetchProductsPage({
                page: currentPage,
                pageSize: itemsPerPage,
                search: debouncedSearch,
                category: selectedCategory,
                satuanPO: filterSatuanPO,
                sortKey: sortConfig.key || 'name',
                sortDir: sortConfig.direction
            });
            setCurrentProducts(data || []);
            setTotalItems(total || 0);
        } catch (error) {
            console.error("Failed to load products:", error);
        } finally {
            setIsLoading(false);
        }
    }, [fetchProductsPage, currentPage, itemsPerPage, debouncedSearch, selectedCategory, filterSatuanPO, sortConfig]);

    // Reload when filters change
    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    // Reset page when filter changes (except pagination itself)
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch, selectedCategory, filterSatuanPO]);

    // Toggle select all (Current Page Only)
    const handleSelectAll = (checked) => {
        if (checked) {
            // Add all IDs from current page that aren't already selected
            const newIds = currentProducts.map(p => p.id);
            setSelectedProducts(prev => {
                const combined = [...new Set([...prev, ...newIds])];
                return combined;
            });
        } else {
            // Deselect all IDs from current page
            const currentIds = currentProducts.map(p => p.id);
            setSelectedProducts(prev => prev.filter(id => !currentIds.includes(id)));
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
        loadProducts(); // Refresh
    };

    const handleBulkCopy = async () => {
        if (!targetStoreId) {
            setCopyAlert({ open: true, title: 'Validasi', message: 'Silakan pilih toko tujuan terlebih dahulu.' });
            return;
        }

        if (targetStoreId === activeStoreId) {
            setCopyAlert({ open: true, title: 'Validasi', message: 'Toko tujuan tidak boleh sama dengan toko saat ini.' });
            return;
        }

        setIsCopying(true);
        try {
            const result = await safeSupabaseRpc({
                rpcName: 'copy_products_to_store',
                params: {
                    p_source_store_id: activeStoreId,
                    p_target_store_id: targetStoreId,
                    p_product_ids: selectedProducts
                }
            });

            if (result && result.success) {
                setCopyAlert({
                    open: true,
                    title: 'Sukses',
                    message: `${result.copiedCount} produk berhasil disalin. ${result.skippedCount} produk dilewati karena sudah ada.`
                });
                setIsCopyModalOpen(false);
                setSelectedProducts([]); // Clear selection
            } else {
                setCopyAlert({
                    open: true,
                    title: 'Gagal',
                    message: result?.error || 'Terjadi kesalahan saat menyalin produk.'
                });
            }
        } catch (error) {
            console.error("Error in handleBulkCopy:", error);
            setCopyAlert({ open: true, title: 'Error', message: 'Terjadi kesalahan sistem.' });
        } finally {
            setIsCopying(false);
        }
    };

    // Sorting function
    const handleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    // Export CSV (Fetch All First)
    const handleExportCSV = async () => {
        setIsLoading(true);
        try {
            const allProducts = await fetchAllProducts(activeStoreId);
            const csv = Papa.unparse(allProducts);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', 'products.csv');
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Export failed", e);
        } finally {
            setIsLoading(false);
        }
    };

    // Export Excel (Fetch All First)
    const handleExportExcel = async () => {
        setIsLoading(true);
        try {
            const allProducts = await fetchAllProducts(activeStoreId);
            const worksheet = XLSX.utils.json_to_sheet(allProducts);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Products");
            XLSX.writeFile(workbook, "products.xlsx");
        } catch (e) {
            console.error("Export failed", e);
        } finally {
            setIsLoading(false);
        }
    };


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
            loadProducts(); // Refresh
        }
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
                            loadProducts(); // Refresh list after import
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
                            loadProducts(); // Refresh list
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

    const handleGetAiPricing = async (product) => {
        if (!hasAiPricingAccess) {
            setIsAiPricingOpen(true);
            setAiPricingData({ product, advice: '', loading: false });
            return;
        }

        if (!hasApiKey) {
            setIsAiPricingOpen(true);
            setAiPricingData({ product, advice: '', loading: false, error: 'no_key' });
            return;
        }

        setIsAiPricingOpen(true);
        setAiPricingData({ product, advice: '', loading: true });

        try {
            const advice = await getPricingInsights({
                name: product.name,
                buyPrice: product.buyPrice,
                sellPrice: product.sellPrice || product.price
            }, currentStore.settings?.geminiApiKey);
            setAiPricingData(prev => ({ ...prev, advice, loading: false }));
        } catch (err) {
            console.error("AI Pricing error:", err);
            setAiPricingData(prev => ({ ...prev, advice: "Gagal memuat saran AI.", loading: false }));
        }
    };






    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Products</h1>
                    <p className="text-muted-foreground">Manage your product inventory</p>
                </div>
                <div className="flex flex-wrap gap-2 w-full xl:w-auto">
                    <Button
                        variant="outline"
                        onClick={loadProducts}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
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
                            {checkPermission('products.delete') && (
                                <Button
                                    variant="destructive"
                                    onClick={handleBulkDelete}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete ({selectedProducts.length})
                                </Button>
                            )}
                            {(user?.role === 'owner' || user?.role === 'super_admin') && (
                                <Button
                                    variant="outline"
                                    onClick={() => setIsCopyModalOpen(true)}
                                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200"
                                >
                                    <Copy className="mr-2 h-4 w-4" />
                                    Salin ke Toko ({selectedProducts.length})
                                </Button>
                            )}
                        </>
                    )}
                    {checkPermission('products.import_export') && (
                        <>
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
                        </>
                    )}

                    {checkPermission('products.create') && (
                        <Button onClick={() => navigate('/products/add')}>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Product
                        </Button>
                    )}
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

            {/* Desktop Table View */}
            <div className="hidden lg:block rounded-xl border bg-card overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <Checkbox
                                    checked={selectedProducts.length === currentProducts.length && currentProducts.length > 0}
                                    onCheckedChange={handleSelectAll}
                                />
                            </TableHead>
                            <TableHead className="min-w-[250px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('name')}
                                    className="h-8 px-2 hover:bg-transparent text-[10px] font-bold text-slate-500 uppercase tracking-widest"
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
                            <TableHead className="w-[120px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('category')}
                                    className="h-8 px-2 hover:bg-transparent text-[10px] font-bold text-slate-500 uppercase tracking-widest"
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
                            <TableHead className="w-[130px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('buyPrice')}
                                    className="h-8 px-2 hover:bg-transparent text-[10px] font-bold text-slate-500 uppercase tracking-widest"
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
                            <TableHead className="w-[130px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('sellPrice')}
                                    className="h-8 px-2 hover:bg-transparent text-[10px] font-bold text-slate-500 uppercase tracking-widest"
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
                            <TableHead className="w-[140px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('profit')}
                                    className="h-8 px-2 hover:bg-transparent text-[10px] font-bold text-slate-500 uppercase tracking-widest"
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
                            <TableHead className="w-[80px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('stock')}
                                    className="h-8 px-2 hover:bg-transparent text-[10px] font-bold text-slate-500 uppercase tracking-widest"
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
                            <TableHead className="w-[120px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status Stok</TableHead>
                            <TableHead className="w-[120px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Satuan PO</TableHead>
                            <TableHead className="w-[100px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                <Button
                                    variant="ghost"
                                    onClick={() => handleSort('discount')}
                                    className="h-8 px-2 hover:bg-transparent text-[10px] font-bold text-slate-500 uppercase tracking-widest"
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
                            <TableHead className="w-[80px] p-4 text-right text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={10} className="h-24 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                        <span>Loading products...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : currentProducts.length === 0 ? (
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
                                let stockVariant = 'success-subtle';
                                if (product.isUnlimited) {
                                    stockStatus = 'Unlimited';
                                    stockVariant = 'info-subtle';
                                } else if (stock === 0) {
                                    stockStatus = 'Habis';
                                    stockVariant = 'error-subtle';
                                } else if (stock <= 5) {
                                    stockStatus = 'Rendah';
                                    stockVariant = 'warning-subtle';
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
                                                            loading="lazy"
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
                                                        <Badge key={idx} variant="indigo-subtle" className="text-[10px] px-1.5 py-0 border-none font-bold uppercase">
                                                            {typeof cat === 'object' && cat?.name ? cat.name : cat}
                                                        </Badge>
                                                    ))
                                                ) : (
                                                    <Badge variant="indigo-subtle" className="text-[10px] px-1.5 py-0 border-none font-bold uppercase">
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
                                            <Badge variant={stockVariant} className="font-bold border-none uppercase text-[10px] px-2 py-0.5">
                                                {stockStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            {product.purchaseUnit && product.conversionToUnit > 0 ? (
                                                <Badge variant="info-subtle" className="font-bold border-none uppercase text-[10px] px-2 py-0.5">
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
                                                    <DropdownMenuItem onClick={() => handleGetAiPricing(product)} className="text-purple-600 font-bold gap-2">
                                                        <Sparkles className="h-3.5 w-3.5 fill-purple-600" />
                                                        AI Pricing Insight
                                                    </DropdownMenuItem>
                                                    {checkPermission('products.update') && (
                                                        <DropdownMenuItem onClick={() => handleEdit(product)}>
                                                            <Edit className="mr-2 h-4 w-4" />
                                                            Edit
                                                        </DropdownMenuItem>
                                                    )}
                                                    {checkPermission('products.delete') && (
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(product)}
                                                            className="text-red-600 focus:text-red-600"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            Delete
                                                        </DropdownMenuItem>
                                                    )}
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

            <div className="lg:hidden grid grid-cols-1 gap-4">
                {isLoading ? (
                    <div className="text-center py-12 text-slate-400 font-medium bg-white rounded-2xl border border-dashed">Memuat Produk...</div>
                ) : currentProducts.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 font-medium bg-white rounded-2xl border border-dashed">Produk tidak ditemukan</div>
                ) : (
                    currentProducts.map(product => {
                        const stock = product.stock || 0;
                        const buyPrice = product.buyPrice || 0;
                        const sellPrice = product.sellPrice || 0;
                        const discount = product.discount || 0;
                        const finalPrice = discount > 0
                            ? (product.discountType === 'fixed' ? sellPrice - discount : sellPrice * (1 - discount / 100))
                            : sellPrice;

                        const profit = finalPrice - buyPrice;
                        const profitPercent = buyPrice > 0 ? ((profit / buyPrice) * 100).toFixed(1) : '0';

                        let stockStatus = 'Instock';
                        let stripColor = 'bg-green-500';
                        let stockTextColor = 'text-green-600';
                        if (stock <= 0 && !product.isUnlimited) {
                            stockStatus = 'Habis';
                            stripColor = 'bg-red-500';
                            stockTextColor = 'text-red-500';
                        } else if (stock <= 5 && !product.isUnlimited) {
                            stockStatus = 'Menipis';
                            stripColor = 'bg-amber-500';
                            stockTextColor = 'text-amber-500';
                        } else if (product.isUnlimited) {
                            stockStatus = 'Unlimited';
                            stripColor = 'bg-blue-500';
                            stockTextColor = 'text-blue-600';
                        }

                        return (
                            <div key={product.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3 relative overflow-hidden">
                                <div className={`absolute top-0 left-0 bottom-0 w-1.5 ${stripColor}`} />
                                <div className="flex gap-4 pl-2">
                                    <div className="h-16 w-16 rounded-xl bg-slate-50 flex-shrink-0 overflow-hidden border border-slate-100/50">
                                        {product.image ? (
                                            <img
                                                src={getOptimizedImage(product.image, { width: 100, height: 100 })}
                                                alt={product.name}
                                                className="h-full w-full object-cover"
                                            />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center text-slate-200 bg-slate-50">
                                                <Package size={24} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 pr-2">
                                                <h3 className="font-bold text-slate-900 truncate text-sm">{product.name}</h3>
                                                <p className="text-[10px] font-mono font-bold text-slate-300 uppercase tracking-widest mt-0.5">
                                                    {product.sku || product.barcode || '-'}
                                                </p>
                                            </div>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-slate-300">
                                                        <MoreVertical size={16} />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleGetAiPricing(product)} className="font-bold text-xs text-purple-600">
                                                        <Sparkles size={14} className="mr-2 fill-purple-600" /> AI Pricing Insight
                                                    </DropdownMenuItem>
                                                    {checkPermission('products.update') && (
                                                        <DropdownMenuItem onClick={() => handleEdit(product)} className="font-bold text-xs">
                                                            <Edit className="mr-2 h-4 w-4" /> Edit
                                                        </DropdownMenuItem>
                                                    )}
                                                    {checkPermission('products.delete') && (
                                                        <DropdownMenuItem
                                                            onClick={() => handleDelete(product)}
                                                            className="text-red-500 font-bold text-xs"
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                        </DropdownMenuItem>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <Badge variant="secondary" className="text-[9px] font-bold px-1.5 py-0 h-4 bg-slate-50 text-slate-400 border-none uppercase tracking-tighter">
                                                {typeof product.category === 'object' && product.category?.name
                                                    ? product.category.name
                                                    : product.category || 'Umum'}
                                            </Badge>
                                            <span className={`text-[9px] font-black uppercase tracking-widest ${stockTextColor}`}>
                                                {product.isUnlimited ? "∞" : `${stock}`} {stockStatus}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-50 pl-2">
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Harga Jual</p>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-extrabold text-slate-900">
                                                Rp {sellPrice.toLocaleString('id-ID')}
                                            </span>
                                            {discount > 0 && (
                                                <Badge variant="destructive" className="h-4 px-1 text-[8px] font-bold border-none">
                                                    -{product.discountType === 'fixed' ? 'Rp' : ''}{discount}{product.discountType === 'percent' ? '%' : ''}
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-0.5 text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Profit / Marjin</p>
                                        <p className={`font-extrabold ${profit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
                                            Rp {profit.toLocaleString('id-ID')} <span className="text-[10px] font-bold">({profitPercent}%)</span>
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={setItemsPerPage}
            />

            {/* AI Pricing Dialog */}
            <Dialog open={isAiPricingOpen} onOpenChange={setIsAiPricingOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            AI Pricing Insight
                        </DialogTitle>
                        <DialogDescription>
                            Analisis harga jual optimal menggunakan Gemini AI.
                        </DialogDescription>
                    </DialogHeader>

                    {!hasAiPricingAccess ? (
                        <div className="py-6 text-center space-y-4">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600">
                                <Lock className="h-6 w-6" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="font-bold text-slate-900">Fitur Khusus Enterprise</h3>
                                <p className="text-sm text-slate-500">
                                    Upgrade ke paket **Enterprise** untuk membuka rahasia harga jual paling menguntungkan dengan bantuan AI.
                                </p>
                            </div>
                        </div>
                    ) : aiPricingData.error === 'no_key' ? (
                        <div className="py-8 text-center space-y-4">
                            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-orange-50 text-orange-600">
                                <ShieldAlert className="h-8 w-8" />
                            </div>
                            <div className="max-w-xs mx-auto space-y-2">
                                <h3 className="font-bold text-lg">API Key Belum Diatur</h3>
                                <p className="text-sm text-slate-500">
                                    Silakan atur Gemini API Key Anda di Pengaturan Umum untuk menggunakan fitur AI Pricing.
                                </p>
                                <Button className="w-full mt-4 bg-orange-600 hover:bg-orange-700" onClick={() => navigate('/settings')}>
                                    Buka Pengaturan
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 py-4">
                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Produk</div>
                                <div className="font-bold text-slate-900">{aiPricingData.product?.name}</div>
                            </div>

                            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100 min-h-[100px] flex items-center justify-center text-center">
                                {aiPricingData.loading ? (
                                    <div className="flex flex-col items-center gap-2">
                                        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                                        <div className="text-xs font-medium text-purple-600">Sedang menganalisis...</div>
                                    </div>
                                ) : (
                                    <div className="text-purple-900 font-medium italic">
                                        "{aiPricingData.advice}"
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        {!hasAiPricingAccess ? (
                            <Button className="w-full bg-indigo-600" onClick={() => navigate('/settings/plan')}>
                                Upgrade Sekarang
                            </Button>
                        ) : (
                            <Button className="w-full" onClick={() => setIsAiPricingOpen(false)}>
                                Tutup
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
                products={currentProducts.filter(p => selectedProducts.includes(p.id))}
            />

            {/* Copy to Store Dialog */}
            <Dialog open={isCopyModalOpen} onOpenChange={setIsCopyModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Salin Produk ke Toko Lain</DialogTitle>
                        <DialogDescription>
                            Pilih toko tujuan untuk menyalin {selectedProducts.length} produk terpilih.
                            Katalog produk akan diduplikasi (stok mulai dari 0 di toko tujuan).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label>Toko Tujuan</Label>
                            <Select value={targetStoreId} onValueChange={setTargetStoreId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Toko" />
                                </SelectTrigger>
                                <SelectContent>
                                    {stores
                                        .filter(s => s.id !== activeStoreId && (user?.role === 'super_admin' || s.owner_id === user?.id))
                                        .map(store => (
                                            <SelectItem key={store.id} value={store.id}>
                                                {store.name}
                                            </SelectItem>
                                        ))
                                    }
                                    {stores.filter(s => s.id !== activeStoreId && (user?.role === 'super_admin' || s.owner_id === user?.id)).length === 0 && (
                                        <SelectItem disabled value="none">Tidak ada toko lain</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCopyModalOpen(false)}>Batal</Button>
                        <Button
                            onClick={handleBulkCopy}
                            disabled={isCopying || !targetStoreId}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {isCopying ? "Menyalin..." : "Salin Sekarang"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog
                isOpen={copyAlert.open}
                onClose={() => setCopyAlert({ ...copyAlert, open: false })}
                title={copyAlert.title}
                message={copyAlert.message}
            />
        </div >
    );
};

export default Products;
