import React from 'react';
import { Home, ScanBarcode, ShoppingCart, Trash2, Plus, Minus, CreditCard } from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";

export const MobileBottomNav = ({ activeTab, setActiveTab, cartItemCount, onCartClick }) => {
    return (
        <div className="bg-white border-t py-2 px-6 flex justify-between items-center sticky bottom-0 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button
                className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-indigo-600' : 'text-slate-400'}`}
                onClick={() => setActiveTab('home')}
            >
                <Home size={24} />
                <span className="text-[10px] font-medium">Beranda</span>
            </button>

            <button
                className="flex flex-col items-center gap-1 text-slate-400"
                onClick={() => setActiveTab('scan')}
            >
                <div className="bg-indigo-600 text-white p-3 rounded-full -mt-8 shadow-lg border-4 border-slate-50">
                    <ScanBarcode size={24} />
                </div>
                <span className="text-[10px] font-medium">Scan</span>
            </button>

            <button
                className="flex flex-col items-center gap-1 text-slate-400 relative"
                onClick={onCartClick}
            >
                <ShoppingCart size={24} />
                {cartItemCount > 0 && (
                    <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px] bg-red-500">
                        {cartItemCount}
                    </Badge>
                )}
                <span className="text-[10px] font-medium">Keranjang</span>
            </button>
        </div>
    );
};

export const MobileCartSheet = ({ cart, isOpen, onClose, updateQty, totals, handleCheckout, clearCart }) => {
    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="bottom" className="h-[85vh] flex flex-col p-0 rounded-t-2xl">
                <SheetHeader className="p-4 border-b">
                    <SheetTitle className="flex items-center justify-between">
                        <span>Keranjang Belanja</span>
                        {cart.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearCart} className="text-destructive h-8 text-xs">
                                <Trash2 size={14} className="mr-1" /> Hapus
                            </Button>
                        )}
                    </SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1 p-4">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 opacity-50 space-y-2">
                            <ShoppingCart size={48} className="text-slate-300" />
                            <p className="text-sm font-medium text-slate-400">Keranjang Kosong</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {cart.map(item => (
                                <div key={item.id} className="bg-white border rounded-lg p-3 flex gap-3">
                                    <div className="flex-1">
                                        <div className="font-medium text-sm line-clamp-1">{item.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
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

                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 rounded-full"
                                            onClick={() => updateQty(item.id, -1)}
                                        >
                                            <Minus size={12} />
                                        </Button>
                                        <span className="w-4 text-center text-sm font-medium">{item.qty}</span>
                                        <Button
                                            variant="outline"
                                            size="icon"
                                            className="h-7 w-7 rounded-full"
                                            onClick={() => updateQty(item.id, 1)}
                                        >
                                            <Plus size={12} />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-4 border-t bg-slate-50 space-y-3">
                    <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Subtotal</span>
                            <span>Rp {totals.subtotal.toLocaleString()}</span>
                        </div>
                        {totals.tax > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Pajak</span>
                                <span>Rp {totals.tax.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg pt-1">
                            <span>Total</span>
                            <span>Rp {totals.finalTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    <Button
                        className="w-full h-12 text-base font-bold bg-indigo-600 hover:bg-indigo-700"
                        disabled={cart.length === 0}
                        onClick={handleCheckout}
                    >
                        <CreditCard className="mr-2 h-5 w-5" /> Bayar Sekarang
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
};
