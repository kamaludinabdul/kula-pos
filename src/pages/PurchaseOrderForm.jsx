import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useToast } from '../components/ui/use-toast';
import { ArrowLeft, Save, Send, Trash2, Plus, Search, FileDown, Sparkles, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Copy } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const PurchaseOrderForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const { suppliers, products, addPurchaseOrder, updatePurchaseOrder, purchaseOrders, stores, activeStoreId } = useData();

    const isEditMode = !!id;
    const [loading, setLoading] = useState(false);

    // Form State
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [supplierId, setSupplierId] = useState('');
    const [notes, setNotes] = useState('');
    const [status, setStatus] = useState('draft'); // draft, ordered, received, cancelled

    // Items State
    const [items, setItems] = useState([]);
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Initial Load / Duplicate Check
    useEffect(() => {
        if (location.state?.duplicatedItems) {
            setItems(location.state.duplicatedItems);
            if (location.state.duplicatedNotes) {
                setNotes(location.state.duplicatedNotes);
            }
            // Clear state so it doesn't persist on reload (optional, but good practice)
            // navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate]);

    const handleDuplicate = () => {
        navigate('/purchase-orders/new', {
            state: {
                duplicatedItems: items,
                duplicatedNotes: notes // Optional
            }
        });
    };

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });

        // Perform Sort
        const sortedItems = [...items].sort((a, b) => {
            let valA = a[key];
            let valB = b[key];

            // Convert to number if sorting by numeric fields
            if (['qty', 'qtyBase', 'buyPrice', 'subtotal'].includes(key)) {
                valA = Number(valA) || 0;
                valB = Number(valB) || 0;
            } else if (typeof valA === 'string') {
                valA = valA.toLowerCase();
                valB = (valB || '').toLowerCase();
            }

            if (valA < valB) {
                return direction === 'asc' ? -1 : 1;
            }
            if (valA > valB) {
                return direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
        setItems(sortedItems);
    };

    // Product Search State
    const [productSearch, setProductSearch] = useState('');
    const [searchResults, setSearchResults] = useState([]);

    // Suggestions State
    const [isSuggestOpen, setIsSuggestOpen] = useState(false);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [selectedSuggestions, setSelectedSuggestions] = useState({}); // { productId: boolean }

    // const { activeStoreId } = useData(); // Removed duplicate

    const calculateSuggestions = async () => {
        if (!activeStoreId) return;
        setSuggestLoading(true);
        setIsSuggestOpen(true);
        setSuggestions([]);
        setSelectedSuggestions({});

        try {
            // 1. Fetch Transactions (Last 30 Days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const { data: transactions, error } = await supabase
                .from('transactions')
                .select('*')
                .eq('store_id', activeStoreId)
                .gte('date', thirtyDaysAgo.toISOString());

            if (error) throw error;
            const salesMap = {}; // productId -> qtySold

            (transactions || []).forEach(data => {
                if (data.items) {
                    data.items.forEach(item => {
                        const pid = item.id || item.productId;
                        if (pid) {
                            salesMap[pid] = (salesMap[pid] || 0) + (Number(item.qty) || 0);
                        }
                    });
                }
            });

            // 2. Filter & Calculate Logic
            const candidates = products
                .map(product => {
                    const soldLast30 = salesMap[product.id] || 0;
                    const dailyRate = soldLast30 / 30; // Average per day
                    const currentStock = Number(product.stock) || 0;
                    const minStock = Number(product.minStock) || 0;

                    // Days of Inventory Remaining
                    const daysRemaining = dailyRate > 0 ? currentStock / dailyRate : 999;

                    let reason = null;
                    let suggestQty = 0;

                    // Criteria A: Running out soon (less than 7 days stock) AND has sales
                    if (dailyRate > 0 && daysRemaining < 7) {
                        reason = `Stok kritis(Sisa ${daysRemaining.toFixed(1)} hari)`;
                        // Target: 30 days stock
                        suggestQty = Math.ceil((dailyRate * 30) - currentStock);
                    }
                    // Criteria B: Below manual minStock setting
                    else if (minStock > 0 && currentStock <= minStock) {
                        reason = `Stok di bawah minimum(${minStock})`;
                        // Target: 2x Min Stock or 30 days rate, whichever is higher
                        const targetByMin = minStock * 2;
                        const targetByRate = Math.ceil(dailyRate * 30);
                        const target = Math.max(targetByMin, targetByRate);
                        suggestQty = target - currentStock;
                    }

                    if (reason && suggestQty > 0) {
                        return {
                            ...product,
                            reason,
                            dailyRate,
                            suggestQty,
                            currentStock
                        };
                    }
                    return null;
                })
                .filter(Boolean)
                .sort((a, b) => b.dailyRate - a.dailyRate); // Prioritize fast movers

            setSuggestions(candidates);

            // Auto-select all by default
            const initialSelection = {};
            candidates.forEach(c => initialSelection[c.id] = true);
            setSelectedSuggestions(initialSelection);

        } catch (error) {
            console.error("Error calculating suggestions:", error);
            toast({ variant: "destructive", title: "Gagal", description: "Gagal memproses analisis penjualan." });
            setIsSuggestOpen(false);
        } finally {
            setSuggestLoading(false);
        }
    };

    const handleAddSuggestions = () => {
        const selectedItems = suggestions.filter(s => selectedSuggestions[s.id]);
        let addedCount = 0;

        // Process additions
        const newItems = [...items];

        selectedItems.forEach(product => {
            // Check if already in PO
            if (newItems.some(i => i.productId === product.id)) return;

            const conversion = product.conversionToUnit ? parseInt(product.conversionToUnit) : 1;
            const hasConversion = product.purchaseUnit && conversion > 1;

            // Qty Logic:
            // suggestion.suggestQty is in PCS (Base Unit).
            // We need to convert to PO Unit if applicable.

            let qtyPO = 1;
            let qtyBase = product.suggestQty;

            if (hasConversion) {
                // Round up to nearest PO unit
                qtyPO = Math.ceil(product.suggestQty / conversion);
                qtyBase = qtyPO * conversion;
            } else {
                qtyPO = product.suggestQty;
                qtyBase = qtyPO;
            }

            // Determine Price (Reuse logic from handleAddProduct roughly)
            let baseBuyPrice = parseInt(product.buyPrice) || 0;
            let determinedPrice = hasConversion ? (baseBuyPrice * conversion) : baseBuyPrice;

            // Check history for better price (simplified: assume same supplier if set)
            // (Skipping history check for bulk add to keep it fast, user can adjust)

            newItems.push({
                productId: product.id,
                productName: product.name,
                qty: qtyPO,
                qtyBase: qtyBase,
                buyPrice: determinedPrice,
                subtotal: determinedPrice * qtyPO
            });
            addedCount++;
        });

        setItems(newItems);
        setIsSuggestOpen(false);
        toast({ title: "Berhasil", description: `${addedCount} produk ditambahkan ke PO.` });
    };

    const toggleSuggestion = (id) => {
        setSelectedSuggestions(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    // Load existing data or data from Recommendations
    useEffect(() => {
        if (location.state?.recommendedItems) {
            // Loaded from Shopping Recommendations
            setItems(location.state.recommendedItems);
            if (location.state.notes) setNotes(location.state.notes);

            // Clear state so it doesn't reload on refresh logic if we were careful, but here it's fine.
            // Optionally clearing it: window.history.replaceState({}, document.title)
        } else if (isEditMode && purchaseOrders.length > 0) {
            const po = purchaseOrders.find(p => p.id === id);
            if (po) {
                setDate(po.date ? new Date(po.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
                setSupplierId(po.supplier_id || po.supplierId);
                setNotes(po.note || po.notes || '');
                setStatus(po.status);
                setItems(po.items || []);
            } else {
                toast({ variant: "destructive", title: "Error", description: "PO tidak ditemukan" });
                navigate('/purchase-orders');
            }
        }
    }, [isEditMode, id, purchaseOrders, navigate, toast, location.state]);

    // Hydrate items with product details (calculations for existing items)
    useEffect(() => {
        if (items.length > 0 && products.length > 0) {
            const hydratedItems = items.map(item => {
                let product = products.find(p => p.id === item.productId);
                let isHealed = false;

                // Fallback: If product not found by ID (Legacy Data Case), try finding by Name
                if (!product && item.productName) {
                    const candidate = products.find(p => p.name.toLowerCase() === item.productName.toLowerCase());
                    if (candidate) {
                        product = candidate;
                        isHealed = true; // Mark as healed so we trigger a state update
                    }
                }

                // Only hydrate if qtyBase is missing OR metadata is missing OR we just healed the ID
                const missingMetadata = !item.weight || !item.unit;

                if (!missingMetadata && !isHealed && item.qtyBase !== undefined && item.qtyBase !== null) return item;

                if (!product) return item;

                let newItem = { ...item };

                // Auto-heal ID if we found it by name fallback
                if (isHealed) {
                    newItem.productId = product.id;
                    // Optional: newItem.productName = product.name; // Keep original name or sync? Keep original usually safer, but ID must be synced.
                }

                // Hydrate qtyBase
                const conversion = product.conversionToUnit ? parseInt(product.conversionToUnit) : 1;
                if (newItem.qtyBase === undefined || newItem.qtyBase === null) {
                    newItem.qtyBase = newItem.qty * conversion;
                }

                // Hydrate Metadata if missing
                // We also update metadata if we just Healed the item (because it's likely missing or wrong)
                if (isHealed || newItem.weight === undefined || newItem.weight === null) newItem.weight = product.weight;
                if (isHealed || !newItem.unit) newItem.unit = product.unit;
                if (isHealed || newItem.purchaseUnit === undefined) newItem.purchaseUnit = product.purchaseUnit;
                if (isHealed || newItem.conversionToUnit === undefined) newItem.conversionToUnit = product.conversionToUnit;

                return newItem;
            });

            // Avoid infinite loop: only update if changes detected
            const hasChanges = JSON.stringify(hydratedItems) !== JSON.stringify(items);
            if (hasChanges) {
                setItems(hydratedItems);
            }
        }
    }, [products, items, items.length]); // Dependencies: product list load or items count change

    // Filter products for search
    useEffect(() => {
        if (productSearch.trim().length > 1) {
            const term = productSearch.toLowerCase();
            const results = products.filter(p =>
                p.name.toLowerCase().includes(term) ||
                (p.barcode && p.barcode.includes(term))
            ).slice(0, 5); // Limit to 5
            setSearchResults(results);
        } else {
            setSearchResults([]);
        }
    }, [productSearch, products]);

    const handleAddProduct = (product) => {
        const existingItem = items.find(i => i.productId === product.id);
        if (existingItem) {
            toast({ title: "Produk sudah ada", description: "Produk ini sudah ada dalam daftar." });
            return;
        }

        const conversion = product.conversionToUnit ? parseInt(product.conversionToUnit) : 1;
        // const hasConversion = product.purchaseUnit && conversion > 1;

        const initialQty = 1;
        const initialQtyBase = initialQty * conversion;

        // Determine Buy Price
        // Determine Buy Price
        // Always use Base Buy Price (Per PCS) as per user requirement
        let determinedPrice = product.buyPrice || 0;

        let priceSource = 'default';

        if (supplierId && purchaseOrders.length > 0) {
            // Find last PO from this supplier
            const lastPO = purchaseOrders.find(po =>
                (po.supplier_id === supplierId || po.supplierId === supplierId) &&
                ['ordered', 'received'].includes(po.status) &&
                po.items && po.items.some(item => item.productId === product.id)
            );

            if (lastPO) {
                const lastItem = lastPO.items.find(item => item.productId === product.id);
                if (lastItem) {
                    determinedPrice = lastItem.buyPrice;
                    priceSource = 'history';
                }
            }
        }

        setItems([...items, {
            productId: product.id,
            productName: product.name,
            qty: initialQty,
            qtyBase: initialQtyBase,
            buyPrice: determinedPrice,
            // Subtotal = Qty Base (Tot PCS) * Price Base
            subtotal: determinedPrice * initialQtyBase,
            // Store product metadata for display (fallback when products not loaded)
            unit: product.unit,
            purchaseUnit: product.purchaseUnit,
            conversionToUnit: product.conversionToUnit,
            weight: product.weight
        }]);

        if (priceSource === 'history') {
            toast({ title: "Harga Terupdate", description: "Menggunakan harga terakhir dari supplier ini." });
        }
        setProductSearch('');
        setSearchResults([]);
    };

    const updateItem = (index, field, value) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        const item = newItems[index];
        const product = products.find(p => p.id === item.productId);
        const conversion = product?.conversionToUnit ? parseInt(product.conversionToUnit) : 1;

        if (field === 'qty') {
            // If PO Qty changed, update Base Qty
            newItems[index].qtyBase = value ? (value * conversion) : '';
        } else if (field === 'qtyBase') {
            // If Base Qty changed, update PO Qty
            const calculatedPOQty = value ? Math.ceil(value / conversion) : '';
            newItems[index].qty = calculatedPOQty;
        }

        // Recalculate Subtotal
        // Recalculate Subtotal
        // Logic: Qty Base (Total PCS) * Price (Per PCS)
        const qtyBase = parseFloat(newItems[index].qtyBase) || 0;
        const unitPrice = parseFloat(newItems[index].buyPrice) || 0;
        newItems[index].subtotal = qtyBase * unitPrice;

        setItems(newItems);
    };

    const removeItem = (index) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const calculateTotal = () => {
        return items.reduce((acc, item) => acc + (item.subtotal || 0), 0);
    };

    const calculateTotalWeight = () => {
        const totalWeightInGrams = items.reduce((acc, item) => {
            const product = products.find(p => p.id === item.productId);
            // Weight is in Grams (from Product Data or stored item data)
            const unitWeight = Number(product?.weight || item.weight) || 0;
            const qty = Number(item.qtyBase) || 0;
            return acc + (unitWeight * qty);
        }, 0);

        // Convert to Kilograms
        return totalWeightInGrams / 1000;
    };

    const formatWeight = (weight) => {
        if (!weight) return '0 kg';
        return `${weight.toLocaleString('id-ID')} Kg`;
    };

    const handleSave = async (targetStatus) => {
        if (!supplierId) {
            toast({ variant: "destructive", title: "Validasi Gagal", description: "Pilih supplier terlebih dahulu" });
            return;
        }
        if (items.length === 0) {
            toast({ variant: "destructive", title: "Validasi Gagal", description: "Daftar barang masih kosong" });
            return;
        }

        setLoading(true);
        try {
            const supplier = suppliers.find(s => s.id === supplierId);
            const poData = {
                date: new Date(date).toISOString(),
                supplier_id: supplierId,
                supplier_name: supplier?.name || 'Unknown',
                items: items.map(i => ({
                    productId: i.productId,
                    productName: i.productName,
                    qty: parseInt(i.qty),
                    qtyBase: parseInt(i.qtyBase || (i.qty * 1)), // Save qtyBase
                    buyPrice: parseInt(i.buyPrice),
                    subtotal: parseInt(i.subtotal),
                    // Store metadata for display
                    unit: i.unit,
                    purchaseUnit: i.purchaseUnit,
                    conversionToUnit: i.conversionToUnit,
                    weight: i.weight
                })),
                total_amount: calculateTotal(),
                note: notes,
                status: targetStatus // 'draft' or 'ordered'
            };

            if (isEditMode) {
                await updatePurchaseOrder(id, poData);
                toast({ title: "Tersimpan", description: `PO berhasil ${targetStatus === 'ordered' ? 'dipesan' : 'disimpan'} ` });
            } else {
                await addPurchaseOrder(poData);
                toast({ title: "Terbuat", description: `PO baru berhasil ${targetStatus === 'ordered' ? 'dipesan' : 'dibuat'} ` });
            }
            navigate('/purchase-orders');
        } catch (error) {
            toast({ variant: "destructive", title: "Gagal", description: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadPDF = (showPrices = true) => {
        const doc = new jsPDF();

        // Header
        doc.setFontSize(20);
        doc.text("PURCHASE ORDER", 105, 15, { align: 'center' });

        doc.setFontSize(10);
        doc.text(`No. PO: #${id}`, 14, 25);
        doc.text(`Tanggal: ${new Date(date).toLocaleDateString('id-ID')}`, 14, 30);
        doc.text(`Status: ${status.toUpperCase()}`, 14, 35);

        // Store Info (From)
        const currentStore = stores.find(s => s.id === activeStoreId);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text("DARI:", 14, 54);
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.text(currentStore?.name || 'My Store', 14, 60);
        doc.text(currentStore?.address || '', 14, 66);
        doc.text(currentStore?.phone || '', 14, 72);

        // Supplier Info (To)
        const supplier = suppliers.find(s => s.id === supplierId);
        doc.setFontSize(11);
        doc.setTextColor(100);
        doc.text("KEPADA (SUPPLIER):", 120, 54);
        doc.setTextColor(0);
        doc.setFontSize(10);
        doc.text(supplier?.name || 'Unknown', 120, 60);
        doc.text(supplier?.phone || '', 120, 66);
        doc.text(supplier?.address || '', 120, 72);

        // Table
        let tableColumn = ["No", "Produk", "Qty PO", "Satuan", "Qty PCS"];
        if (showPrices) {
            tableColumn = [...tableColumn, "Harga Beli PO", "Harga Satuan", "Subtotal"];
        }

        const tableRows = items.map((item, index) => {
            const product = products.find(p => p.id === item.productId);
            const hasConversion = product?.purchaseUnit && product?.conversionToUnit;
            const unitName = hasConversion ? product?.purchaseUnit : (product?.unit || '-');

            // Calculate PO Price
            const conversion = product?.conversionToUnit ? Number(product.conversionToUnit) : 1;
            let poPriceDisplay = '-';
            if (conversion > 1) {
                const poPrice = (Number(item.buyPrice) || 0) * conversion;
                poPriceDisplay = `Rp ${poPrice.toLocaleString('id-ID')}`;
            }

            const row = [
                index + 1,
                item.productName,
                item.qty,
                unitName,
                item.qtyBase || item.qty, // Fallback if no conversion
            ];

            if (showPrices) {
                row.push(
                    poPriceDisplay,
                    `Rp ${parseInt(item.buyPrice || 0).toLocaleString('id-ID')}`,
                    `Rp ${parseInt(item.subtotal || 0).toLocaleString('id-ID')}`
                );
            }

            return row;
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 85,
            theme: 'grid',
            styles: { fontSize: 8 },
            headStyles: { fillColor: [75, 85, 99] }
        });

        const finalY = doc.lastAutoTable.finalY + 10;

        // Total
        if (showPrices) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "bold");
            doc.text(`Total: Rp ${calculateTotal().toLocaleString('id-ID')}`, 195, finalY, { align: 'right' });
        }

        // Notes
        if (notes) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "normal");
            doc.text("Catatan:", 14, finalY + 10);
            doc.text(notes, 14, finalY + 16);
        }

        // Signatures
        const sigY = finalY + 40;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        doc.text("Dibuat Oleh,", 30, sigY, { align: 'center' });
        doc.line(15, sigY + 20, 45, sigY + 20); // Line for signature

        doc.text("Disetujui Oleh,", 160, sigY, { align: 'center' });
        doc.line(145, sigY + 20, 175, sigY + 20); // Line for signature

        doc.save(`PO - ${id}.pdf`);
    };



    const isReadOnly = status === 'received' || status === 'cancelled';

    return (
        <div className="p-6 space-y-6 w-full mx-auto">
            <div className="print:hidden flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {isEditMode ? 'Edit Purchase Order' : 'Buat Purchase Order'}
                    </h1>
                    <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="capitalize">{status}</Badge>
                        {isEditMode && <span className="text-sm text-muted-foreground">ID: #{id}</span>}
                    </div>
                </div>
                {isEditMode && (
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={handleDuplicate} className="gap-2">
                            <Copy className="h-4 w-4" /> Duplikat
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2">
                                    <FileDown className="h-4 w-4" /> PDF
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleDownloadPDF(true)}>
                                    Download PDF (Lengkap)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadPDF(false)}>
                                    Download PDF (Tanpa Harga)
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            <div className="print:hidden grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Header Information */}
                <div className="md:col-span-2 space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                    <h2 className="font-semibold mb-2">Informasi Umum</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium">Supplier <span className="text-red-500">*</span></label>
                            <Select
                                value={supplierId}
                                onValueChange={setSupplierId}
                                disabled={isReadOnly}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Supplier" />
                                </SelectTrigger>
                                <SelectContent>
                                    {suppliers.map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-sm font-medium">Tanggal</label>
                            <Input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                disabled={isReadOnly}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium">Catatan</label>
                        <Input
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Catatan tambahan..."
                            disabled={isReadOnly}
                        />
                    </div>
                </div>

                {/* Actions Panel */}
                <div className="space-y-4 bg-white p-4 rounded-lg border shadow-sm">
                    <h2 className="font-semibold mb-2">Aksi</h2>
                    <div className="space-y-2">
                        {!isReadOnly && (
                            <>
                                <Button
                                    className="w-full gap-2"
                                    onClick={() => handleSave(status === 'draft' ? 'draft' : 'draft')}
                                    disabled={loading}
                                    variant="outline"
                                >
                                    <Save className="h-4 w-4" />
                                    {status === 'draft' ? 'Simpan Draft' : 'Simpan Perubahan'}
                                </Button>
                                {status === 'draft' && (
                                    <Button
                                        className="w-full gap-2"
                                        onClick={() => handleSave('ordered')}
                                        disabled={loading}
                                    >
                                        <Send className="h-4 w-4" /> Pesan Sekarang (Order)
                                    </Button>
                                )}
                            </>
                        )}
                        {status === 'ordered' && (
                            <div className="p-2 bg-blue-50 text-blue-800 text-sm rounded border border-blue-100">
                                PO ini sudah dipesan. Menunggu barang diterima.
                                <Button variant="secondary" className="w-full mt-2" onClick={() => toast({ description: "Fitur Terima Barang ada di Halaman List" })}>Tes Terima Barang</Button>
                            </div>
                        )}
                        {isReadOnly && (
                            <div className="p-2 bg-gray-50 text-gray-800 text-sm rounded border">
                                PO ini berstatus {status} dan tidak dapat diedit.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Items Section */}
            <div className="print:hidden bg-white p-4 rounded-lg border shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="font-semibold">Daftar Barang</h2>
                    <div className="flex flex-col items-end gap-1">
                        <div className="text-sm font-medium text-slate-600">
                            Total Berat: {formatWeight(calculateTotalWeight())}
                        </div>
                        <div className="text-lg font-bold">
                            Total: Rp {calculateTotal().toLocaleString('id-ID')}
                        </div>
                    </div>
                </div>

                {!isReadOnly && (
                    <div className="relative max-w-md flex gap-2 w-full">
                        <div className="relative flex-1">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari & Tambah Produk..."
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                className="pl-8"
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full bg-white border rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
                                    {searchResults.map(p => (
                                        <div
                                            key={p.id}
                                            className="p-2 hover:bg-slate-100 cursor-pointer flex justify-between items-center"
                                            onClick={() => handleAddProduct(p)}
                                        >
                                            <div>
                                                <div className="font-medium">{p.name}</div>
                                                <div className="text-xs text-muted-foreground">{p.barcode}</div>
                                            </div>
                                            <Plus className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200"
                            onClick={calculateSuggestions}
                            disabled={suggestLoading}
                        >
                            {suggestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                            Saran Restock AI
                        </Button>
                    </div>
                )}

                {/* Suggestions Dialog */}
                <Dialog open={isSuggestOpen} onOpenChange={setIsSuggestOpen}>
                    <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-purple-600" />
                                Saran Restock AI
                            </DialogTitle>
                            <DialogDescription>
                                Produk berikut direkomendasikan berdasarkan analisis penjualan 30 hari terakhir.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto min-h-[300px] border rounded-md">
                            {suggestLoading ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                                    <p className="text-muted-foreground">Menganalisis data transaksi...</p>
                                </div>
                            ) : suggestions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-center p-8 text-muted-foreground">
                                    <p>Tidak ada rekomendasi saat ini.</p>
                                    <p className="text-xs mt-1">Stok produk Anda tampaknya aman berdasarkan tren penjualan.</p>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[40px]"></TableHead>
                                            <TableHead>Produk</TableHead>
                                            <TableHead className="text-right">Stok</TableHead>
                                            <TableHead className="text-right">Rata-rata/Hari</TableHead>
                                            <TableHead>Alasan</TableHead>
                                            <TableHead className="text-right">Saran Order</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {suggestions.map((item) => (
                                            <TableRow key={item.id} className="hover:bg-slate-50">
                                                <TableCell>
                                                    <Checkbox
                                                        checked={!!selectedSuggestions[item.id]}
                                                        onCheckedChange={() => toggleSuggestion(item.id)}
                                                    />
                                                </TableCell>
                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                <TableCell className="text-right">{item.currentStock}</TableCell>
                                                <TableCell className="text-right">{item.dailyRate.toFixed(1)}</TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{item.reason}</TableCell>
                                                <TableCell className="text-right font-bold text-purple-700">
                                                    {item.suggestQty} {item.unit}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </div>

                        <DialogFooter className="mt-4 pt-2 border-t">
                            <div className="flex justify-between w-full items-center">
                                <span className="text-sm text-muted-foreground">
                                    {Object.values(selectedSuggestions).filter(Boolean).length} produk dipilih
                                </span>
                                <div className="flex gap-2">
                                    <Button variant="ghost" onClick={() => setIsSuggestOpen(false)}>Batal</Button>
                                    <Button onClick={handleAddSuggestions} disabled={Object.values(selectedSuggestions).filter(Boolean).length === 0}>
                                        Tambahkan ke PO
                                    </Button>
                                </div>
                            </div>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>
                                <Button
                                    variant="ghost"
                                    onClick={() => requestSort('productName')}
                                    className="h-8 px-2 hover:bg-transparent font-bold text-left justify-start"
                                >
                                    Produk
                                    {sortConfig.key === 'productName' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead className="w-[100px]">
                                <Button
                                    variant="ghost"
                                    onClick={() => requestSort('qty')}
                                    className="h-8 px-2 hover:bg-transparent font-bold text-left justify-start"
                                >
                                    QTY PO
                                    {sortConfig.key === 'qty' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead className="w-[100px]">Satuan</TableHead>
                            <TableHead className="w-[100px] print:hidden">Berat (Kg)</TableHead>
                            <TableHead className="w-[150px] text-right">Harga Beli PO</TableHead>
                            <TableHead className="w-[100px]">
                                <Button
                                    variant="ghost"
                                    onClick={() => requestSort('qtyBase')}
                                    className="h-8 px-2 hover:bg-transparent font-bold text-left justify-start"
                                >
                                    QTY PCS
                                    {sortConfig.key === 'qtyBase' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead className="w-[150px]">
                                <Button
                                    variant="ghost"
                                    onClick={() => requestSort('buyPrice')}
                                    className="h-8 px-2 hover:bg-transparent font-bold text-left justify-start"
                                >
                                    Harga Beli
                                    {sortConfig.key === 'buyPrice' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            <TableHead className="w-[150px] text-right">
                                <Button
                                    variant="ghost"
                                    onClick={() => requestSort('subtotal')}
                                    className="h-8 px-2 hover:bg-transparent font-bold w-full justify-end"
                                >
                                    Subtotal
                                    {sortConfig.key === 'subtotal' ? (
                                        sortConfig.direction === 'asc' ? <ArrowUp className="ml-2 h-4 w-4" /> : <ArrowDown className="ml-2 h-4 w-4" />
                                    ) : (
                                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />
                                    )}
                                </Button>
                            </TableHead>
                            {!isReadOnly && <TableHead className="w-[50px]"></TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    Belum ada barang dipilih
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map((item, index) => {
                                const product = products.find(p => p.id === item.productId);
                                // Use product data if available, otherwise fallback to item stored data
                                const itemUnit = product?.unit || item.unit || '-';
                                const itemPurchaseUnit = product?.purchaseUnit || item.purchaseUnit;
                                const itemConversionToUnit = product?.conversionToUnit || item.conversionToUnit;
                                const itemWeight = Number(product?.weight || item.weight) || 0;

                                const totalItemWeight = (itemWeight * (item.qtyBase || 0)) / 1000;
                                const hasConversion = itemPurchaseUnit && itemConversionToUnit;

                                return (
                                    <TableRow key={index}>
                                        <TableCell>
                                            <div className="font-medium">{item.productName}</div>
                                            <div className="text-xs text-muted-foreground">{item.productCode}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.qty}
                                                    onChange={e => updateItem(index, 'qty', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="h-8"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm font-medium">
                                                {hasConversion ? itemPurchaseUnit : itemUnit}
                                            </span>
                                            {hasConversion && (
                                                <div className="text-[10px] text-muted-foreground">
                                                    Isi {itemConversionToUnit} {itemUnit}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell className="print:hidden text-center">
                                            <div className={`font-medium ${totalItemWeight <= 0 ? 'text-red-500' : 'text-slate-600'}`}>
                                                {totalItemWeight.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} Kg
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-slate-600">
                                            {(() => {
                                                const conversion = itemConversionToUnit ? Number(itemConversionToUnit) : 1;
                                                if (conversion > 1) {
                                                    const poPrice = (Number(item.buyPrice) || 0) * conversion;
                                                    return `Rp ${poPrice.toLocaleString('id-ID')} `;
                                                }
                                                return '-';
                                            })()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={item.qtyBase || ''}
                                                    onChange={e => updateItem(index, 'qtyBase', e.target.value)}
                                                    // If has conversion, disable editing Qty PCS because it's auto-calculated from Qty PO
                                                    disabled={hasConversion || isReadOnly}
                                                    className={`h - 8 bg - slate - 100`}
                                                    placeholder={!hasConversion ? '-' : ''}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={item.buyPrice}
                                                    onChange={e => updateItem(index, 'buyPrice', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="h-8"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                                        </TableCell>
                                        {!isReadOnly && (
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-red-500">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Printable View */}
            <div className="hidden print:block space-y-6">
                <div className="text-center border-b pb-4">
                    <h1 className="text-2xl font-bold">PURCHASE ORDER</h1>
                    <p className="text-sm text-gray-500">#{id}</p>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    <div>
                        <h3 className="font-bold text-sm text-gray-500 mb-1">DARI (SUPPLIER)</h3>
                        <p className="text-lg font-medium">{suppliers.find(s => s.id === supplierId)?.name || '-'}</p>
                        <p className="text-sm">{suppliers.find(s => s.id === supplierId)?.phone || ''}</p>
                    </div>
                    <div className="text-right">
                        <h3 className="font-bold text-sm text-gray-500 mb-1">DETAIL PO</h3>
                        <p><span className="text-gray-500">Tanggal:</span> {new Date(date).toLocaleDateString('id-ID')}</p>
                        <p><span className="text-gray-500">Status:</span> <span className="uppercase">{status}</span></p>
                    </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="px-4 py-3 text-left">No</th>
                                <th className="px-4 py-3 text-left">Produk</th>
                                <th className="px-4 py-3 text-right">Qty</th>
                                <th className="px-4 py-3 text-right">Harga Satuan</th>
                                <th className="px-4 py-3 text-right">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {items.map((item, index) => (
                                <tr key={index}>
                                    <td className="px-4 py-3 text-left text-gray-500">{index + 1}</td>
                                    <td className="px-4 py-3 font-medium">{item.productName}</td>
                                    <td className="px-4 py-3 text-right">{item.qty}</td>
                                    <td className="px-4 py-3 text-right">Rp {parseInt(item.buyPrice || 0).toLocaleString('id-ID')}</td>
                                    <td className="px-4 py-3 text-right">Rp {parseInt(item.subtotal || 0).toLocaleString('id-ID')}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t font-bold">
                            <tr>
                                <td colSpan={4} className="px-4 py-3 text-right">Total</td>
                                <td className="px-4 py-3 text-right">Rp {calculateTotal().toLocaleString('id-ID')}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {notes && (
                    <div className="border p-4 rounded bg-gray-50">
                        <h4 className="text-xs font-bold text-gray-500 mb-1">CATATAN</h4>
                        <p className="text-sm">{notes}</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-8 mt-12 pt-8">
                    <div className="text-center">
                        <p className="mb-16">Dibuat Oleh,</p>
                        <p className="border-t border-black w-32 mx-auto"></p>
                    </div>
                    <div className="text-center">
                        <p className="mb-16">Disetujui Oleh,</p>
                        <p className="border-t border-black w-32 mx-auto"></p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PurchaseOrderForm;
