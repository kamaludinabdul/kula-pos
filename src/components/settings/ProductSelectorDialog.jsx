import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Search, Check, Layers, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { ScrollArea } from '../ui/scroll-area';

/**
 * A reusable dialog for selecting multiple products with category filtering.
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Dialog open state
 * @param {Function} props.onClose - Function to close the dialog
 * @param {Array} props.products - Array of product objects from DataContext
 * @param {Array} props.categories - Array of category objects from DataContext
 * @param {Array} props.selectedProductIds - Array of currently selected product IDs
 * @param {Function} props.onSelectionComplete - Callback when user clicks Save, receives array of selected IDs
 * @param {boolean} props.multiple - If true, allows selecting multiple products. If false, acts like radio.
 */
const ProductSelectorDialog = ({
    isOpen,
    onClose,
    products,
    categories,
    selectedProductIds = [],
    disabledProductIds = [],
    onSelectionComplete,
    multiple = true
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');

    // Maintain internal state for selections before applying them
    const [draftSelections, setDraftSelections] = useState(selectedProductIds);

    // Sync draft selections when dialog opens with new props
    React.useEffect(() => {
        if (isOpen) {
            setDraftSelections(selectedProductIds || []);
            setSearchTerm('');
            setSelectedCategory('all');
        }
    }, [isOpen, selectedProductIds]);

    const filteredProducts = useMemo(() => {
        if (!products) return [];
        return products.filter(product => {
            const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                product.sku?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCategory = selectedCategory === 'all' || product.category_id === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, selectedCategory]);

    const toggleProduct = (productId) => {
        if (disabledProductIds.includes(productId)) return; // Prevent selecting disabled products

        if (multiple) {
            setDraftSelections(prev =>
                prev.includes(productId)
                    ? prev.filter(id => id !== productId)
                    : [...prev, productId]
            );
        } else {
            // Single selection mode
            setDraftSelections([productId]);
        }
    };

    const toggleSelectAllInCategory = () => {
        if (!multiple) return;

        // Only select products that are not disabled
        const currentFilteredIds = filteredProducts.map(p => p.id).filter(id => !disabledProductIds.includes(id));
        if (currentFilteredIds.length === 0) return;

        const allSelected = currentFilteredIds.every(id => draftSelections.includes(id));

        if (allSelected) {
            // Deselect all in current view
            setDraftSelections(prev => prev.filter(id => !currentFilteredIds.includes(id)));
        } else {
            // Select all in current view
            setDraftSelections(prev => {
                const newSelections = new Set([...prev, ...currentFilteredIds]);
                return Array.from(newSelections);
            });
        }
    };

    const handleSave = () => {
        onSelectionComplete(draftSelections);
        onClose();
    };

    // Derived flags for the "Select All" button state
    const currentSelectableIds = filteredProducts.map(p => p.id).filter(id => !disabledProductIds.includes(id));
    const isAllCurrentViewSelected = currentSelectableIds.length > 0 && currentSelectableIds.every(id => draftSelections.includes(id));

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="px-6 py-4 border-b bg-slate-50/50">
                    <DialogTitle className="text-xl">Pilih Produk</DialogTitle>
                    <DialogDescription>
                        {multiple
                            ? "Pilih satu atau lebih produk untuk dimasukkan ke dalam aturan ini."
                            : "Pilih satu produk eksklusif untuk aturan ini."}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-1 overflow-hidden min-h-[400px]">
                    {/* LEFT PANEL: CATEGORIES */}
                    <div className="w-1/3 border-r bg-slate-50/30 flex flex-col">
                        <div className="p-4 border-b font-medium text-slate-700 flex items-center gap-2">
                            <Layers className="h-4 w-4" /> Kategori
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1 text-sm">
                                <button
                                    type="button"
                                    onClick={() => setSelectedCategory('all')}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-md transition-colors",
                                        selectedCategory === 'all'
                                            ? "bg-indigo-100 text-indigo-900 font-semibold"
                                            : "hover:bg-slate-100 text-slate-700 font-medium"
                                    )}
                                >
                                    Semua Kategori
                                </button>
                                {categories?.map(category => (
                                    <button
                                        key={category.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(category.id)}
                                        className={cn(
                                            "w-full text-left px-3 py-2 rounded-md transition-colors",
                                            selectedCategory === category.id
                                                ? "bg-indigo-100 text-indigo-900 font-semibold"
                                                : "hover:bg-slate-100 text-slate-600"
                                        )}
                                    >
                                        {category.name}
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* RIGHT PANEL: PRODUCTS */}
                    <div className="w-2/3 flex flex-col bg-white">
                        <div className="p-4 border-b space-y-3">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <Input
                                    className="pl-9 h-10"
                                    placeholder="Cari nama atau SKU produk..."
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {multiple && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-slate-500">
                                        Menampilkan {filteredProducts.length} produk
                                    </span>
                                    {filteredProducts.length > 0 && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={toggleSelectAllInCategory}
                                            className="h-8 text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                        >
                                            {isAllCurrentViewSelected ? "Batal Pilih Semua" : "Pilih Semua di Kategori Ini"}
                                        </Button>
                                    )}
                                </div>
                            )}
                        </div>

                        <ScrollArea className="flex-1 p-4">
                            {filteredProducts.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                                    <AlertCircle className="h-12 w-12 mb-3 opacity-20" />
                                    <p>Tidak ada produk yang cocok ditemukan.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {filteredProducts.map(product => {
                                        const isSelected = draftSelections.includes(product.id);
                                        const isDisabled = disabledProductIds.includes(product.id);

                                        return (
                                            <div
                                                key={product.id}
                                                onClick={() => !isDisabled && toggleProduct(product.id)}
                                                className={cn(
                                                    "border rounded-lg p-3 flex items-start gap-3 transition-colors",
                                                    isDisabled ? "opacity-60 bg-slate-50 cursor-not-allowed" : "cursor-pointer",
                                                    (isSelected && !isDisabled)
                                                        ? "border-indigo-600 bg-indigo-50/50"
                                                        : (!isDisabled ? "border-slate-200 hover:border-indigo-300 hover:bg-slate-50" : "border-slate-200")
                                                )}
                                            >
                                                <div className={cn(
                                                    "mt-0.5 w-5 h-5 rounded flex items-center justify-center shrink-0 border",
                                                    multiple ? "rounded-[4px]" : "rounded-full",
                                                    isSelected
                                                        ? (isDisabled ? "bg-slate-400 border-slate-400 text-white" : "bg-indigo-600 border-indigo-600 text-white")
                                                        : "border-slate-300 bg-white"
                                                )}>
                                                    {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-sm font-medium text-slate-900 truncate leading-tight">
                                                            {product.name}
                                                        </p>
                                                        {isDisabled && (
                                                            <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded ml-2 whitespace-nowrap">
                                                                Sudah dipakai
                                                            </span>
                                                        )}
                                                    </div>
                                                    {product.sku && (
                                                        <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                                            {product.sku}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 border-t bg-slate-50/50 flex flex-row items-center justify-between sm:justify-between">
                    <div>
                        <Badge variant="outline" className="bg-white px-3 py-1 font-normal text-sm border-slate-300">
                            <strong className="font-semibold text-indigo-700 mr-1">{draftSelections.length}</strong>
                            Produk Terpilih
                        </Badge>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Batal
                        </Button>
                        <Button type="button" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700">
                            Simpan Pilihan
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProductSelectorDialog;
