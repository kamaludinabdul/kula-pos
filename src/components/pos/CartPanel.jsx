import React, { useState, useEffect, useRef } from 'react';
import {
    Trash2,
    Ticket,
    Plus,
    Minus,
    ShoppingCart,
    Search,
    Sparkles,
    CreditCard,
    User,
    ChevronDown,
    ChevronRight,
    X,
    Percent,
    DollarSign
} from 'lucide-react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { ScrollArea } from "../ui/scroll-area";
import { Card } from "../ui/card";
import { Separator } from "../ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { cn } from "../../lib/utils";

const CartPanel = ({
    cart,
    onUpdateQty,
    onUpdateItem,
    onClearCart,
    totals,
    selectedCustomer,
    customers,
    onSelectCustomer,
    onCheckout,
    discountType,
    discountValue,
    onDiscountChange,
    recommendations,
    onAddRecommendation,
    enableSalesPerformance,
    salesUsers,
    salesPerson,
    onSelectSalesPerson,
    availablePromos,
    onApplyPromo,
    onCollapse,
    loyaltySettings,
    onAddCustomer
}) => {
    const [isCustomerOpen, setIsCustomerOpen] = useState(false);
    const [customerSearch, setCustomerSearch] = useState('');
    const [editingItem, setEditingItem] = useState(null);
    const [showDiscountInput, setShowDiscountInput] = useState(false);
    const customerRef = useRef(null);

    // Click outside handler for dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (customerRef.current && !customerRef.current.contains(event.target)) {
                setIsCustomerOpen(false);
            }
        };

        if (isCustomerOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCustomerOpen]);

    // Filter customers for dropdown
    const filteredCustomers = customers?.filter(c =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
    ) || [];

    return (
        <Card className="h-full flex flex-col border-l rounded-none shadow-2xl bg-white/95 backdrop-blur-xl border-slate-200">
            {/* Header */}
            <div className="p-4 border-b flex items-center justify-between shrink-0 bg-white shadow-sm z-20">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={onCollapse} className="lg:hidden text-slate-400">
                        <ChevronRight />
                    </Button>
                    <div className="flex items-center gap-2">
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-2 rounded-lg shadow-md">
                            <ShoppingCart size={18} />
                        </div>
                        <div>
                            <h2 className="font-bold text-sm text-slate-800">Keranjang</h2>
                            <p className="text-[10px] text-muted-foreground font-medium">{cart.length} Item</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={onCollapse} title="Sembunyikan" className="hidden lg:flex text-slate-400 hover:text-slate-600">
                        <ChevronRight size={20} />
                    </Button>
                    {cart.length > 0 && (
                        <Button variant="ghost" size="icon" onClick={onClearCart} title="Hapus Semua" className="text-destructive hover:bg-red-50">
                            <Trash2 size={18} />
                        </Button>
                    )}
                </div>
            </div>

            {/* Customer & Sales Selector */}
            <div className="p-4 space-y-3 bg-slate-50/50 shrink-0 border-b relative z-10">
                {/* Sales Person (Re-implemented with Shadcn Select) */}
                {enableSalesPerformance && salesUsers?.length > 0 && (
                    <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider ml-1">Sales Person</label>
                        <Select
                            value={salesPerson?.id || "default"}
                            onValueChange={(val) => {
                                if (val === "default") onSelectSalesPerson(null);
                                else {
                                    const user = salesUsers.find(u => u.id === val);
                                    onSelectSalesPerson(user || null);
                                }
                            }}
                        >
                            <SelectTrigger className="h-9 text-xs bg-white border-slate-200 focus:ring-indigo-500">
                                <SelectValue placeholder="Pilih Sales..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="default">Tanpa Sales</SelectItem>
                                {salesUsers.map(u => (
                                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}

                {/* Customer Dropdown */}
                {loyaltySettings?.isActive && (
                    <div className="relative" ref={customerRef}>
                        <Button
                            variant="outline"
                            className="w-full justify-between h-auto py-2 px-3 pr-9 text-left font-normal bg-white"
                            onClick={() => setIsCustomerOpen(!isCustomerOpen)}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                <User size={16} className="text-muted-foreground shrink-0" />
                                <div className="flex flex-col truncate">
                                    <span className="text-[10px] uppercase text-muted-foreground font-bold leading-none">Pelanggan</span>
                                    <span className="text-xs font-semibold truncate">
                                        {selectedCustomer ? selectedCustomer.name : "Umum (Non-Member)"}
                                    </span>
                                    {selectedCustomer && (
                                        <span className="text-[9px] font-bold text-amber-600 leading-none mt-0.5">
                                            {selectedCustomer.loyaltyPoints || 0} Poin
                                        </span>
                                    )}
                                </div>
                            </div>
                            <ChevronDown size={14} className="opacity-50" />
                        </Button>

                        {!selectedCustomer && (
                            <Button
                                size="icon"
                                variant="ghost"
                                className="absolute right-0 top-0 bottom-0 w-8 h-full z-10 hover:bg-slate-100 rounded-r-md text-indigo-600"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAddCustomer();
                                }}
                                title="Tambah Pelanggan Baru"
                            >
                                <Plus size={16} />
                            </Button>
                        )}

                        {isCustomerOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg z-50 p-2 animate-in zoom-in-95 duration-200">
                                <div className="relative mb-2">
                                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                    <Input
                                        className="h-8 pl-8 text-xs"
                                        placeholder="Cari nama/HP..."
                                        value={customerSearch}
                                        onChange={(e) => setCustomerSearch(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1">
                                    <div
                                        className="px-2 py-1.5 hover:bg-slate-100 rounded text-xs cursor-pointer text-slate-600"
                                        onClick={() => { onSelectCustomer(null); setIsCustomerOpen(false); }}
                                    >
                                        Umum (Non-Member)
                                    </div>
                                    {filteredCustomers.map(c => (
                                        <div
                                            key={c.id}
                                            className="px-2 py-1.5 hover:bg-slate-100 rounded text-xs cursor-pointer flex justify-between items-center"
                                            onClick={() => { onSelectCustomer(c); setIsCustomerOpen(false); }}
                                        >
                                            <div className="flex flex-col">
                                                <span className="font-medium">{c.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{c.phone}</span>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-amber-100 text-amber-700 hover:bg-amber-100 whitespace-nowrap">
                                                {c.loyaltyPoints || c.points || 0} Pts
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Cart Items */}
            <ScrollArea className="flex-1 bg-white">
                <div className="p-4 space-y-3">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 opacity-50 space-y-2">
                            <ShoppingCart size={48} className="text-slate-300" />
                            <p className="text-sm font-medium text-slate-400">Keranjang Kosong</p>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="group relative bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate" title={item.name}>{item.name}</div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className="text-xs font-bold text-indigo-600">
                                                Rp {(item.price - (item.discount || 0)).toLocaleString()}
                                            </span>
                                            {item.discount > 0 && (
                                                <span className="text-[10px] line-through text-muted-foreground">
                                                    Rp {item.price.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 text-slate-300 hover:text-red-500 hover:bg-red-50"
                                        onClick={() => onUpdateQty(item.id, -item.qty)}
                                    >
                                        <Trash2 size={14} />
                                    </Button>
                                </div>

                                <div className="flex items-center justify-between mt-3 pt-2 border-t border-dashed">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] text-muted-foreground gap-1"
                                        onClick={() => setEditingItem(item)}
                                    >
                                        <Sparkles size={10} /> Edit
                                    </Button>

                                    <div className="flex items-center gap-2 bg-slate-50 rounded-lg p-0.5">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-md bg-white shadow-sm hover:bg-white hover:text-red-500"
                                            onClick={() => onUpdateQty(item.id, -1)}
                                        >
                                            <Minus size={12} />
                                        </Button>
                                        <span className="w-6 text-center text-xs font-bold">{item.qty}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded-md bg-white shadow-sm hover:bg-white hover:text-indigo-600"
                                            onClick={() => onUpdateQty(item.id, 1)}
                                        >
                                            <Plus size={12} />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Recommendations */}
                {recommendations?.length > 0 && cart.length > 0 && (
                    <div className="px-4 pb-4">
                        <div className="flex items-center gap-1.5 mb-2 text-amber-600">
                            <Sparkles size={12} />
                            <span className="text-[10px] font-bold uppercase">Rekomendasi</span>
                        </div>
                        <div className="space-y-2">
                            {recommendations.map(rec => (
                                <div
                                    key={rec.id}
                                    className="p-2 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-between cursor-pointer hover:bg-orange-100 transition-colors"
                                    onClick={() => onAddRecommendation(rec)}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-xs font-medium text-slate-700">{rec.name}</span>
                                        <span className="text-[10px] text-orange-600/80 italic">{rec.aiScript}</span>
                                    </div>
                                    <div className="bg-white p-1 rounded-full text-orange-500 shadow-sm">
                                        <Plus size={12} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </ScrollArea>

            {/* Promo Notification */}
            {availablePromos?.length > 0 && discountValue === 0 && (
                <div className="px-4 pb-2">
                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 rounded-lg shadow-md animate-in slide-in-from-bottom-2">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <Ticket size={16} className="animate-pulse" />
                                <span className="font-bold text-xs">{availablePromos.length} Promo Tersedia!</span>
                            </div>
                        </div>
                        <div className="space-y-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                            {availablePromos.map(promo => (
                                <div
                                    key={promo.id}
                                    className="bg-white/10 hover:bg-white/20 p-2 rounded cursor-pointer transition-colors flex justify-between items-center"
                                    onClick={() => onApplyPromo(promo)}
                                >
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold">{promo.title}</span>
                                        <span className="text-[10px] opacity-90">Hemat Rp {promo.potentialDiscount?.toLocaleString()}</span>
                                    </div>
                                    <Button size="xs" variant="secondary" className="h-6 text-[10px] bg-white text-rose-600 hover:bg-white/90">
                                        Pakai
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Calculations & Checkout */}
            <div className="p-4 bg-white/80 backdrop-blur-xl border-t space-y-3 shadow-negative z-20">
                {/* Discount Toggle */}
                <div className="flex flex-col gap-2">
                    <div
                        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => setShowDiscountInput(!showDiscountInput)}
                    >
                        <Percent size={12} />
                        <span>Diskon Tambahan</span>
                        <ChevronDown size={12} className={cn("transition-transform", showDiscountInput && "rotate-180")} />
                    </div>

                    {showDiscountInput && (
                        <div className="flex gap-2 animate-in slide-in-from-top-2 fade-in">
                            <div className="relative flex-1">
                                <Input
                                    type="number"
                                    className="h-8 text-xs pr-8"
                                    placeholder="0"
                                    value={discountValue || ''}
                                    onChange={(e) => onDiscountChange(parseFloat(e.target.value) || 0, discountType)}
                                />
                                <span className="absolute right-2 top-2 text-[10px] font-bold text-muted-foreground">
                                    {discountType === 'percentage' ? '%' : 'Rp'}
                                </span>
                            </div>
                            <div className="flex bg-slate-100 rounded-md p-1 h-8 items-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-6 px-2 text-[10px]", discountType === 'percentage' && "bg-white shadow-sm text-primary")}
                                    onClick={() => onDiscountChange(discountValue, 'percentage')}
                                >%</Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={cn("h-6 px-2 text-[10px]", discountType === 'amount' && "bg-white shadow-sm text-primary")}
                                    onClick={() => onDiscountChange(discountValue, 'amount')}
                                >Rp</Button>
                            </div>
                        </div>
                    )}
                </div>

                <Separator />

                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Subtotal</span>
                        <span>Rp {totals.subtotal.toLocaleString()}</span>
                    </div>
                    {/* Optional Taxes */}
                    {totals.tax > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Pajak</span>
                            <span>Rp {totals.tax.toLocaleString()}</span>
                        </div>
                    )}
                    {totals.discountAmount > 0 && (
                        <div className="flex justify-between text-xs text-red-500">
                            <span>Diskon</span>
                            <span>-Rp {totals.discountAmount.toLocaleString()}</span>
                        </div>
                    )}

                    <div className="flex justify-between items-end pt-2">
                        <span className="font-bold text-sm">Total</span>
                        <span className="font-extrabold text-xl text-primary">
                            Rp {totals.finalTotal.toLocaleString()}
                        </span>
                    </div>
                </div>

                <Button
                    className="w-full h-12 text-base font-bold bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg shadow-indigo-200 hover:shadow-indigo-300 transition-all hover:scale-[1.01] active:scale-[0.99]"
                    size="lg"
                    disabled={cart.length === 0}
                    onClick={onCheckout}
                >
                    <CreditCard className="mr-2 h-5 w-5" /> Bayar (F4)
                </Button>
            </div>

            {/* Edit Item Dialog */}
            <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
                <DialogContent className="sm:max-w-xs">
                    <DialogHeader>
                        <DialogTitle>Edit Item</DialogTitle>
                    </DialogHeader>
                    {editingItem && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Harga Manual</Label>
                                <Input
                                    type="number"
                                    value={editingItem.price}
                                    onChange={(e) => setEditingItem({ ...editingItem, price: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Diskon (Rp)</Label>
                                <Input
                                    type="number"
                                    value={editingItem.discount || 0}
                                    onChange={(e) => setEditingItem({ ...editingItem, discount: parseFloat(e.target.value) || 0 })}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex-row gap-2">
                        <Button variant="outline" className="flex-1" onClick={() => setEditingItem(null)}>Batal</Button>
                        <Button
                            className="flex-1"
                            onClick={() => {
                                onUpdateItem(editingItem.id, { price: editingItem.price, discount: editingItem.discount });
                                setEditingItem(null);
                            }}
                        >
                            Simpan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

export default CartPanel;
