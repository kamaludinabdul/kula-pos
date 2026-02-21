import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { supabase } from '../supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useToast } from '../components/ui/use-toast';
import { ArrowLeft, Save, Send, Trash2, Plus, Search, FileDown, Sparkles, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Copy, FileText, CheckCircle, Clock } from 'lucide-react';
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
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { getRecommendationReasoning } from '../utils/ai';

const PurchaseOrderForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();
    const { suppliers, products, addPurchaseOrder, updatePurchaseOrder, purchaseOrders, stores, activeStoreId, fetchAllProducts, currentStore } = useData();

    const isEditMode = !!id;
    const [loading, setLoading] = useState(false);

    // Ensure we have products (fix for partial list bug)
    useEffect(() => {
        if (fetchAllProducts && activeStoreId) {
            console.log("[PurchaseOrderForm] Fetching all products for search...");
            fetchAllProducts(activeStoreId);
        }
    }, [activeStoreId, fetchAllProducts]);

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

    const [isSuggestOpen, setIsSuggestOpen] = useState(false);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [selectedSuggestions, setSelectedSuggestions] = useState({}); // { productId: boolean }

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

            // 3. Optional: Fetch AI Gemini Reasoning
            if ((import.meta.env.VITE_GEMINI_API_KEY || currentStore.settings?.geminiApiKey) && candidates.length > 0) {
                try {
                    const aiReasoning = await getRecommendationReasoning({
                        budget: 100000000, // Large budget for generic reasoning
                        items: candidates.slice(0, 10).map(c => ({
                            id: c.id,
                            name: c.name,
                            velocity: c.dailyRate * 30, // Estimate monthly velocity
                            trend: c.reason
                        }))
                    }, currentStore.settings?.geminiApiKey);

                    const updatedSuggestions = candidates.map(c => ({
                        ...c,
                        aiReason: aiReasoning[c.id] || null
                    }));
                    setSuggestions(updatedSuggestions);
                } catch (aiErr) {
                    console.error("AI reasoning in PO failed:", aiErr);
                }
            }

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

            // Determine Price
            let determinedPrice = parseInt(product.buyPrice) || 0; // This is per PCS (Base Price)

            // Check history for better price (simplified: assume same supplier if set)
            // (Skipping history check for bulk add to keep it fast, user can adjust)

            newItems.push({
                productId: product.id,
                productName: product.name,
                qty: qtyPO,
                qtyBase: qtyBase,
                buyPrice: determinedPrice,
                poPrice: determinedPrice * conversion,
                subtotal: determinedPrice * qtyBase
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

                // Hydrate poPrice
                if (newItem.poPrice === undefined) {
                    newItem.poPrice = (parseFloat(newItem.buyPrice) || 0) * (newItem.conversionToUnit ? parseInt(newItem.conversionToUnit) : 1);
                }

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
            ).slice(0, 50); // Limit to 50
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
            poPrice: determinedPrice * conversion,
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
        } else if (field === 'poPrice') {
            const newPOPrice = parseFloat(value) || 0;
            newItems[index].buyPrice = newPOPrice / conversion;
        } else if (field === 'buyPrice') {
            const newBuyPrice = parseFloat(value) || 0;
            newItems[index].poPrice = newBuyPrice * conversion;
        }

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
            <div className="print:hidden flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 w-full sm:w-auto flex-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/purchase-orders')} className="-ml-2">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            {isEditMode ? 'Edit Purchase Order' : 'Buat Purchase Order'}
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="capitalize">{status}</Badge>
                            {isEditMode && <span className="text-sm text-muted-foreground">ID: #{id}</span>}
                        </div>
                    </div>
                </div>
                {isEditMode && (
                    <div className="flex gap-2 w-full sm:w-auto sm:justify-end">
                        <Button variant="outline" onClick={handleDuplicate} className="gap-2 flex-1 sm:flex-none">
                            <Copy className="h-4 w-4" /> Duplikat
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="gap-2 flex-1 sm:flex-none">
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

            <div className="print:hidden grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Header Information */}
                <div className="lg:col-span-2 space-y-4 bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm transition-all">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4" /> Informasi Umum
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Supplier <span className="text-red-500">*</span></label>
                            <Select
                                value={supplierId}
                                onValueChange={setSupplierId}
                                disabled={isReadOnly}
                            >
                                <SelectTrigger className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500">
                                    <SelectValue placeholder="Pilih Supplier" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-100">
                                    {suppliers.map(s => (
                                        <SelectItem key={s.id} value={s.id} className="rounded-lg">{s.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Tanggal</label>
                            <Input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                disabled={isReadOnly}
                                className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Catatan</label>
                        <Input
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="Catatan tambahan untuk supplier..."
                            disabled={isReadOnly}
                            className="h-11 rounded-xl border-slate-200 focus:ring-indigo-500"
                        />
                    </div>
                </div>

                {/* Actions Panel */}
                <div className="space-y-4 bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Aksi</h2>
                    <div className="flex flex-col gap-3">
                        {!isReadOnly && (
                            <>
                                <Button
                                    className="w-full h-11 rounded-xl gap-2 font-bold transition-all hover:shadow-md"
                                    onClick={() => handleSave(status === 'draft' ? 'draft' : 'draft')}
                                    disabled={loading}
                                    variant="outline"
                                >
                                    <Save className="h-4 w-4" />
                                    {status === 'draft' ? 'Simpan Draft' : 'Simpan Perubahan'}
                                </Button>
                                {status === 'draft' && (
                                    <Button
                                        className="w-full h-11 rounded-xl gap-2 font-bold bg-indigo-600 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                                        onClick={() => handleSave('ordered')}
                                        disabled={loading}
                                    >
                                        <Send className="h-4 w-4" /> Pesan Sekarang
                                    </Button>
                                )}
                            </>
                        )}
                        {status === 'ordered' && (
                            <div className="p-3 bg-blue-50/50 text-blue-700 text-xs font-medium rounded-xl border border-blue-100/50 flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4" /> PO ini sudah dipesan.
                                </div>
                                <p className="text-[10px] opacity-70 italic text-slate-500 leading-relaxed">
                                    Silahkan terima stok di halaman daftar jika barang sudah sampai.
                                </p>
                            </div>
                        )}
                        {isReadOnly && (
                            <div className="p-3 bg-slate-50 text-slate-600 text-xs font-medium rounded-xl border border-slate-100 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                                PO ini berstatus {status} (Read Only).
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Items Section */}
            <div className="print:hidden bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Plus className="h-4 w-4" /> Daftar Barang
                    </h2>
                    <div className="w-full sm:w-auto flex flex-row sm:flex-col justify-between sm:justify-end items-center sm:items-end gap-1 bg-slate-50 p-3 rounded-xl border border-slate-100 min-w-[200px]">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Total Berat: <span className="text-slate-600 ml-1">{formatWeight(calculateTotalWeight())}</span>
                        </div>
                        <div className="text-xl font-extrabold text-indigo-600">
                            Rp {calculateTotal().toLocaleString('id-ID')}
                        </div>
                    </div>
                </div>

                {!isReadOnly && (
                    <div className="relative max-w-4xl flex flex-col sm:flex-row gap-2 w-full">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari & Tambah Produk..."
                                value={productSearch}
                                onChange={e => setProductSearch(e.target.value)}
                                className="pl-10 h-10 rounded-xl border-slate-200"
                            />
                            {searchResults.length > 0 && (
                                <div className="absolute z-10 w-full bg-white border border-slate-100 rounded-xl shadow-xl mt-1 max-h-60 overflow-auto divide-y divide-slate-50">
                                    {searchResults.map(p => (
                                        <div
                                            key={p.id}
                                            className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                                            onClick={() => handleAddProduct(p)}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-slate-900 truncate">{p.name}</div>
                                                <div className="text-[10px] font-mono font-bold text-slate-400 uppercase">{p.barcode || '-'}</div>
                                            </div>
                                            <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600 ml-2">
                                                <Plus className="h-4 w-4" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="outline"
                            className="bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 h-10 rounded-xl font-bold w-full sm:w-auto flex items-center justify-center whitespace-nowrap"
                            onClick={calculateSuggestions}
                            disabled={suggestLoading}
                        >
                            {suggestLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                            Restock AI
                        </Button>
                    </div>
                )}

                {/* Suggestions Dialog - (Leaving it as is, it's already a full-screen dialog) */}

                {/* Desktop View */}
                <div className="hidden lg:block overflow-x-auto border border-slate-50 rounded-xl">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 border-b border-slate-100">
                                <TableHead className="py-4 px-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">
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
                                <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">QTY PO</TableHead>
                                <TableHead className="w-[100px] text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Satuan</TableHead>
                                <TableHead className="w-[150px] text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">Harga Beli PO</TableHead>
                                <TableHead className="w-[120px] text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center">QTY PCS</TableHead>
                                <TableHead className="w-[150px] text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Harga Satuan</TableHead>
                                <TableHead className="w-[150px] text-right text-[10px] font-bold uppercase tracking-widest text-slate-500 pr-6">Subtotal</TableHead>
                                {!isReadOnly && <TableHead className="w-[50px]"></TableHead>}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12 text-slate-400 font-medium italic">
                                        Belum ada barang dipilih
                                    </TableCell>
                                </TableRow>
                            ) : (
                                items.map((item, index) => {
                                    const product = products.find(p => p.id === item.productId);
                                    const itemUnit = product?.unit || item.unit || '-';
                                    const itemPurchaseUnit = product?.purchaseUnit || item.purchaseUnit;
                                    const itemConversionToUnit = product?.conversionToUnit || item.conversionToUnit;
                                    const itemWeight = Number(product?.weight || item.weight) || 0;
                                    const totalItemWeight = (itemWeight * (item.qtyBase || 0)) / 1000;
                                    const hasConversion = itemPurchaseUnit && itemConversionToUnit;

                                    return (
                                        <TableRow key={index} className="hover:bg-slate-50/50 transition-colors group">
                                            <TableCell className="py-4 px-4">
                                                <div className="font-bold text-slate-900">{item.productName}</div>
                                                <div className="text-[10px] font-mono font-bold text-slate-400 mt-0.5">{product?.barcode || '-'}</div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    value={item.qty}
                                                    onChange={e => updateItem(index, 'qty', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="h-9 w-20 mx-auto text-center rounded-lg border-slate-200 font-bold"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className="font-bold text-[10px] uppercase bg-slate-50 text-slate-500 border-slate-200">
                                                    {hasConversion ? itemPurchaseUnit : itemUnit}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center print:hidden">
                                                <div className={`text-xs font-bold ${totalItemWeight <= 0 ? 'text-slate-300' : 'text-slate-600'}`}>
                                                    {totalItemWeight.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 3 })} Kg
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={item.poPrice !== undefined ? item.poPrice : (item.buyPrice * (itemConversionToUnit ? Number(itemConversionToUnit) : 1))}
                                                    onChange={e => updateItem(index, 'poPrice', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="h-9 w-28 mx-auto text-center rounded-lg border-slate-200 font-bold"
                                                />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={item.qtyBase || ''}
                                                    onChange={e => updateItem(index, 'qtyBase', e.target.value)}
                                                    disabled={hasConversion || isReadOnly}
                                                    className="h-9 w-20 mx-auto text-center bg-slate-50 font-bold rounded-lg border-slate-200"
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {(() => {
                                                    const conversion = itemConversionToUnit ? Number(itemConversionToUnit) : 1;
                                                    if (hasConversion && conversion > 1) {
                                                        return (
                                                            <div className="space-y-0.5">
                                                                <p className="font-bold text-slate-900">Rp {(Number(item.buyPrice) || 0).toLocaleString('id-ID')}</p>
                                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">per {itemUnit}</p>
                                                            </div>
                                                        );
                                                    }
                                                    return <span className="font-bold text-slate-900">Rp {(Number(item.buyPrice) || 0).toLocaleString('id-ID')}</span>;
                                                })()}
                                            </TableCell>
                                            <TableCell className="text-right font-extrabold text-slate-900 pr-6">
                                                Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                                            </TableCell>
                                            {!isReadOnly && (
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" onClick={() => removeItem(index)} className="h-8 w-8 text-slate-300 hover:text-red-500 transition-colors">
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

                {/* Mobile View */}
                <div className="lg:hidden space-y-4">
                    {items.length === 0 ? (
                        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-medium italic">
                            Belum ada barang dipilih
                        </div>
                    ) : (
                        items.map((item, index) => {
                            const product = products.find(p => p.id === item.productId);
                            const itemUnit = product?.unit || item.unit || '-';
                            const itemPurchaseUnit = product?.purchaseUnit || item.purchaseUnit;
                            const itemConversionToUnit = product?.conversionToUnit || item.conversionToUnit;
                            const hasConversion = itemPurchaseUnit && itemConversionToUnit;

                            return (
                                <div key={index} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-4 active:scale-[0.98] transition-transform">
                                    <div className="flex justify-between items-start gap-4">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-extrabold text-slate-900 leading-snug truncate">{item.productName}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">{product?.barcode || '-'}</p>
                                                <Badge variant="outline" className="text-[9px] font-bold uppercase bg-slate-50 text-slate-500 border-slate-200 px-1.5 py-0">
                                                    {hasConversion ? itemPurchaseUnit : itemUnit}
                                                </Badge>
                                            </div>
                                        </div>
                                        {!isReadOnly && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeItem(index)}
                                                className="h-8 w-8 -mr-1 text-slate-300 active:text-red-500"
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">QTY Order</label>
                                            <Input
                                                type="number"
                                                value={item.qty}
                                                onChange={e => updateItem(index, 'qty', e.target.value)}
                                                disabled={isReadOnly}
                                                className="h-10 rounded-xl border-slate-200 font-extrabold text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Harga Beli PO</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">Rp</span>
                                                <Input
                                                    type="number"
                                                    value={item.poPrice !== undefined ? item.poPrice : (item.buyPrice * (itemConversionToUnit ? Number(itemConversionToUnit) : 1))}
                                                    onChange={e => updateItem(index, 'poPrice', e.target.value)}
                                                    disabled={isReadOnly}
                                                    className="h-10 pl-8 rounded-xl border-slate-200 font-extrabold text-slate-900 focus:ring-indigo-500"
                                                />
                                            </div>
                                            {hasConversion && Number(itemConversionToUnit) > 1 && (
                                                <p className="text-[10px] text-slate-500 ml-1 mt-1">@ Rp {(Number(item.buyPrice) || 0).toLocaleString('id-ID')} / {itemUnit}</p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="bg-slate-50/50 rounded-xl p-3 flex justify-between items-center border border-slate-50">
                                        <div>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subtotal Item</p>
                                            <p className="text-base font-extrabold text-indigo-600">
                                                Rp {(item.subtotal || 0).toLocaleString('id-ID')}
                                            </p>
                                        </div>
                                        {hasConversion && (
                                            <div className="text-right">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Sesuai Satuan</p>
                                                <p className="text-sm font-bold text-slate-600">
                                                    {item.qtyBase} {itemUnit}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Suggestions Dialog */}
            <Dialog open={isSuggestOpen} onOpenChange={setIsSuggestOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-purple-600" />
                            Rekomendasi Restock AI
                        </DialogTitle>
                        <DialogDescription>
                            Berdasarkan analisis penjualan 30 hari terakhir dan sisa stok Anda.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto px-6 py-4">
                        {suggestions.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-slate-500 italic">Tidak ada rekomendasi restock saat ini.</p>
                            </div>
                        ) : (
                            <div className="border rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-50">
                                        <TableRow>
                                            <TableHead className="w-[40px]"></TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-widest">Produk</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-center">Stok</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-center">Analisis</TableHead>
                                            <TableHead className="text-[10px] font-bold uppercase tracking-widest text-right">Saran Qty</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {suggestions.map((s) => (
                                            <TableRow key={s.id} className="hover:bg-slate-50/50">
                                                <TableCell>
                                                    <Checkbox
                                                        checked={!!selectedSuggestions[s.id]}
                                                        onCheckedChange={() => toggleSuggestion(s.id)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-900 leading-tight">{s.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono tracking-tighter mb-1">{s.barcode || '-'}</div>
                                                    {s.aiReason && (
                                                        <div className="flex items-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md w-fit ring-1 ring-purple-100 italic">
                                                            <Sparkles size={10} className="fill-purple-600" />
                                                            {s.aiReason}
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-center font-bold text-slate-600">
                                                    {s.currentStock} {s.unit}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge variant="outline" className={`text-[9px] font-bold uppercase py-0 px-1 ${s.reason.includes('kritis') ? 'bg-red-50 text-red-600 border-red-100' : 'bg-orange-50 text-orange-600 border-orange-100'}`}>
                                                        {s.reason}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right font-extrabold text-indigo-600">
                                                    {s.suggestQty} {s.unit}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="px-6 pb-6 gap-2">
                        <Button variant="ghost" onClick={() => setIsSuggestOpen(false)}>Batal</Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 font-bold"
                            onClick={handleAddSuggestions}
                            disabled={suggestions.length === 0}
                        >
                            Tambahkan Selected ({suggestions.filter(s => selectedSuggestions[s.id]).length})
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

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
