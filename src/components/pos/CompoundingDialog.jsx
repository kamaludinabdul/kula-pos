import React, { useState, useMemo } from 'react';
import { Search, Plus, Trash2, Calculator, Pill } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";

const CompoundingDialog = ({ isOpen, onClose, products, onAddToCart }) => {
    const [racikanName, setRacikanName] = useState('Racikan Baru');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIngredients, setSelectedIngredients] = useState([]);
    const [sellingPrice, setSellingPrice] = useState(0);

    // Filter products for ingredient searching
    const searchResults = useMemo(() => {
        if (searchQuery.length < 2) return [];
        return products.filter(p =>
            p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.barcode?.toLowerCase().includes(searchQuery.toLowerCase())
        ).slice(0, 5);
    }, [products, searchQuery]);

    const addIngredient = (product) => {
        if (selectedIngredients.some(i => i.id === product.id)) return;

        const newIngredient = {
            id: product.id,
            name: product.name,
            qty: 1,
            unit: product.unit || 'Pcs',
            buyPrice: product.buyPrice || 0,
            sellPrice: product.sellPrice || product.price || 0
        };

        const newIngredients = [...selectedIngredients, newIngredient];
        setSelectedIngredients(newIngredients);
        setSearchQuery('');

        // Auto-calculate suggested selling price (sum of ingredient prices)
        const totalSell = newIngredients.reduce((sum, item) => sum + (item.sellPrice * item.qty), 0);
        setSellingPrice(totalSell);
    };

    const removeIngredient = (id) => {
        const newIngredients = selectedIngredients.filter(i => i.id !== id);
        setSelectedIngredients(newIngredients);
        const totalSell = newIngredients.reduce((sum, item) => sum + (item.sellPrice * item.qty), 0);
        setSellingPrice(totalSell);
    };

    const updateIngredientQty = (id, newQty) => {
        const newIngredients = selectedIngredients.map(i =>
            i.id === id ? { ...i, qty: parseFloat(newQty) || 0 } : i
        );
        setSelectedIngredients(newIngredients);
        const totalSell = newIngredients.reduce((sum, item) => sum + (item.sellPrice * item.qty), 0);
        setSellingPrice(totalSell);
    };

    const handleAddRacikanToCart = () => {
        if (selectedIngredients.length === 0) return;

        const racikanItem = {
            id: `racikan-${Date.now()}`,
            name: racikanName,
            price: sellingPrice,
            qty: 1,
            type: 'racikan',
            ingredients: selectedIngredients.map(i => ({
                id: i.id,
                name: i.name,
                qty: i.qty,
                unit: i.unit
            })),
            // For stock deduction logic on frontend/UI if needed
            isUnlimited: true,
            unit: 'Paket'
        };

        onAddToCart(racikanItem);

        // Reset state
        setRacikanName('Racikan Baru');
        setSelectedIngredients([]);
        setSellingPrice(0);
        onClose();
    };

    const totalCost = selectedIngredients.reduce((sum, i) => sum + (i.buyPrice * i.qty), 0);
    const profit = sellingPrice - totalCost;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Pill className="text-indigo-600" />
                        Buat Obat Racikan
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
                    {/* Racikan Meta */}
                    <div className="space-y-2">
                        <Label htmlFor="racikan-name" className="text-xs font-bold uppercase text-slate-500">Nama Racikan</Label>
                        <Input
                            id="racikan-name"
                            value={racikanName}
                            onChange={(e) => setRacikanName(e.target.value)}
                            className="h-10 font-semibold"
                            placeholder="Cth: Puyer Batuk Anak"
                        />
                    </div>

                    {/* Ingredient Search */}
                    <div className="space-y-2 relative">
                        <Label className="text-xs font-bold uppercase text-slate-500">Cari Bahan Baku</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Ketik nama obat..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>

                        {searchResults.length > 0 && (
                            <Card className="absolute top-full left-0 right-0 mt-1 z-50 shadow-xl border-slate-200 overflow-hidden">
                                <ScrollArea className="max-h-48">
                                    {searchResults.map(p => (
                                        <div
                                            key={p.id}
                                            className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b last:border-0"
                                            onClick={() => addIngredient(p)}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{p.name}</span>
                                                <span className="text-[10px] text-slate-400">Stok: {p.stock} {p.unit}</span>
                                            </div>
                                            <Badge variant="outline" className="text-indigo-600 border-indigo-100 bg-indigo-50">
                                                Rp {p.price.toLocaleString()}
                                            </Badge>
                                        </div>
                                    ))}
                                </ScrollArea>
                            </Card>
                        )}
                    </div>

                    {/* Selected Ingredients List */}
                    <div className="flex-1 flex flex-col min-h-0 space-y-2">
                        <Label className="text-xs font-bold uppercase text-slate-500">Daftar Bahan ({selectedIngredients.length})</Label>
                        <ScrollArea className="flex-1 border rounded-xl bg-slate-50/50">
                            {selectedIngredients.length === 0 ? (
                                <div className="h-32 flex flex-col items-center justify-center text-slate-400 opacity-60">
                                    <Calculator size={32} strokeWidth={1.5} />
                                    <p className="text-xs mt-2">Belum ada bahan baku</p>
                                </div>
                            ) : (
                                <div className="p-3 space-y-3">
                                    {selectedIngredients.map(item => (
                                        <div key={item.id} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold truncate">{item.name}</div>
                                                <div className="text-[10px] text-slate-400">Modal: Rp {item.buyPrice.toLocaleString()}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    value={item.qty}
                                                    onChange={(e) => updateIngredientQty(item.id, e.target.value)}
                                                    className="w-16 h-8 text-center text-xs"
                                                />
                                                <span className="text-[10px] font-medium text-slate-500 w-8">{item.unit}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-300 hover:text-red-500"
                                                    onClick={() => removeIngredient(item.id)}
                                                >
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </div>

                    {/* Pricing Summary */}
                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-500">Total Modal (COGS):</span>
                            <span className="font-semibold">Rp {totalCost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <Label className="text-xs font-bold text-slate-700">Set Harga Jual:</Label>
                            <div className="relative w-32">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Rp</span>
                                <Input
                                    type="number"
                                    value={sellingPrice}
                                    onChange={(e) => setSellingPrice(parseFloat(e.target.value) || 0)}
                                    className="h-8 pl-7 text-right font-bold text-indigo-600 bg-white"
                                />
                            </div>
                        </div>
                        <Separator className="bg-indigo-100" />
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-medium text-slate-500">Potensi Laba:</span>
                            <Badge className={cn(
                                "text-xs font-bold",
                                profit >= 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            )}>
                                Rp {profit.toLocaleString()}
                            </Badge>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-0">
                    <Button variant="outline" className="flex-1" onClick={onClose}>Batal</Button>
                    <Button
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100"
                        onClick={handleAddRacikanToCart}
                        disabled={selectedIngredients.length === 0}
                    >
                        Tambah ke Keranjang
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CompoundingDialog;
