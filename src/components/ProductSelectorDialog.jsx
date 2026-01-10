import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Search, X } from 'lucide-react';
import { ScrollArea } from '../components/ui/scroll-area';

const ProductSelectorDialog = ({ isOpen, onClose, onSelect, products }) => {
    const [search, setSearch] = useState('');
    const [quantities, setQuantities] = useState({}); // Local state untuk qty setiap produk di list

    const filteredProducts = useMemo(() => {
        return products.filter(p =>
            p.pricingType !== 'hourly' &&
            !p.isDeleted &&
            p.name.toLowerCase().includes(search.toLowerCase())
        ).slice(0, 20);
    }, [products, search]);

    const handleQtyChange = (productId, delta) => {
        setQuantities(prev => {
            const current = prev[productId] || 1;
            const newVal = Math.max(1, current + delta);
            return { ...prev, [productId]: newVal };
        });
    };

    const handleAddClick = (product) => {
        const qty = quantities[product.id] || 1;
        onSelect(product, qty);
        // Reset qty visual ke 1 setelah add
        setQuantities(prev => ({ ...prev, [product.id]: 1 }));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md h-[80vh] flex flex-col p-4 gap-4">
                <DialogHeader>
                    <DialogTitle>Tambah Menu F&B</DialogTitle>
                </DialogHeader>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                        placeholder="Cari makanan & minuman..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9"
                        autoFocus
                    />
                    {search && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-1 top-1 h-8 w-8"
                            onClick={() => setSearch('')}
                        >
                            <X className="w-3 h-3" />
                        </Button>
                    )}
                </div>

                <ScrollArea className="flex-1 -mx-4 px-4 my-2">
                    <div className="space-y-3">
                        {filteredProducts.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                Tidak ada menu ditemukan.
                            </div>
                        ) : (
                            filteredProducts.map(product => {
                                const qty = quantities[product.id] || 1;
                                return (
                                    <div
                                        key={product.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border rounded-lg hover:bg-slate-50 gap-3"
                                    >
                                        <div className="flex-1">
                                            <div className="font-medium">{product.name}</div>
                                            <div className="text-xs text-muted-foreground">{product.category}</div>
                                            <div className="font-semibold text-indigo-600 mt-1">
                                                Rp {parseInt(product.sellPrice).toLocaleString('id-ID')}
                                            </div>
                                        </div>

                                        {/* Qty & Add Button */}
                                        <div className="flex items-center gap-3 bg-white p-1 rounded-md border shadow-sm">
                                            <div className="flex items-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 rounded-sm"
                                                    onClick={() => handleQtyChange(product.id, -1)}
                                                >
                                                    -
                                                </Button>
                                                <div className="w-8 text-center text-sm font-medium">{qty}</div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-7 w-7 rounded-sm"
                                                    onClick={() => handleQtyChange(product.id, 1)}
                                                >
                                                    +
                                                </Button>
                                            </div>
                                            <div className="h-6 w-px bg-slate-200"></div>
                                            <Button
                                                size="sm"
                                                className="h-7 px-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                                                onClick={() => handleAddClick(product)}
                                            >
                                                Tambah
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>
                <div className="text-xs text-center text-muted-foreground border-t pt-3 mt-1">
                    *Maksimal menampilkan 20 item sesuai pencarian
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default ProductSelectorDialog;
