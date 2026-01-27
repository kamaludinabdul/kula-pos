import React from 'react';
import { Home, ScanBarcode, ShoppingCart, Trash2, Plus, Minus, CreditCard } from 'lucide-react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { Separator } from "../ui/separator";

export const MobileBottomNav = ({ activeTab, setActiveTab, cartItemCount, onCartClick }) => {
    const handleTabClick = (tab) => {
        if (navigator.vibrate) navigator.vibrate(10);
        setActiveTab(tab);
    };

    return (
        <div className="bg-white border-t py-2 px-8 flex justify-between items-center sticky bottom-0 z-50 shadow-[0_-4px_15px_-1px_rgba(0,0,0,0.08)]">
            <button
                className={`flex flex-col items-center gap-1 transition-all duration-300 ${activeTab === 'home' ? 'text-indigo-600 scale-110' : 'text-slate-400'}`}
                onClick={() => handleTabClick('home')}
            >
                <Home size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
                <span className={`text-[10px] font-bold uppercase tracking-tighter ${activeTab === 'home' ? 'opacity-100' : 'opacity-60'}`}>Home</span>
            </button>

            <button
                className="flex flex-col items-center gap-1 group relative"
                onClick={() => handleTabClick('scan')}
            >
                <div className="bg-indigo-600 text-white p-4 rounded-2xl -mt-10 shadow-xl shadow-indigo-200 border-4 border-white transition-transform duration-300 active:scale-90 group-hover:scale-105">
                    <ScanBarcode size={26} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Scan</span>
            </button>

            <button
                className="flex flex-col items-center gap-1 text-slate-400 relative transition-all duration-300"
                onClick={() => {
                    if (navigator.vibrate) navigator.vibrate(10);
                    onCartClick();
                }}
            >
                <div className="relative">
                    <ShoppingCart size={24} strokeWidth={2} />
                    {cartItemCount > 0 && (
                        <div className="absolute -top-2 -right-2 h-5 min-w-[20px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white animate-in zoom-in duration-300">
                            {cartItemCount}
                        </div>
                    )}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter opacity-60">Cart</span>
            </button>
        </div>
    );
};

export const MobileCartSheet = ({ cart, isOpen, onClose, updateQty, totals, handleCheckout, clearCart }) => {
    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent side="bottom" className="h-[90vh] flex flex-col p-0 rounded-t-[2.5rem] border-t-0 shadow-2xl">
                <div className="mx-auto w-12 h-1.5 bg-slate-200 rounded-full mt-3 mb-1" />
                <SheetHeader className="p-6 pb-2 text-left">
                    <SheetTitle className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-xl font-black text-slate-900 tracking-tight">Keranjang</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{cart.length} Jenis Produk</span>
                        </div>
                        {cart.length > 0 && (
                            <Button variant="ghost" size="sm" onClick={clearCart} className="text-red-500 hover:bg-red-50 h-8 text-[10px] font-bold uppercase tracking-widest">
                                <Trash2 size={14} className="mr-1" /> Kosongkan
                            </Button>
                        )}
                    </SheetTitle>
                </SheetHeader>

                <ScrollArea className="flex-1 px-6">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4">
                            <div className="p-6 bg-slate-100 rounded-full">
                                <ShoppingCart size={48} className="text-slate-300" />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-bold text-slate-900">Keranjang masih kosong</p>
                                <p className="text-xs text-slate-400">Pilih produk untuk mulai berjualan</p>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-3 py-4">
                            {cart.map(item => (
                                <div key={item.id} className="bg-white border border-slate-100 rounded-2xl p-4 flex gap-4 shadow-sm relative overflow-hidden">
                                    <div className="flex-1 min-w-0">
                                        <div className="font-extrabold text-sm text-slate-800 line-clamp-1">{item.name}</div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm font-black text-indigo-600">
                                                Rp {(item.price - (item.discount || 0)).toLocaleString()}
                                            </span>
                                            {item.discount > 0 && (
                                                <span className="text-[10px] font-bold line-through text-slate-300">
                                                    Rp {item.price.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center bg-slate-50 rounded-xl p-1 gap-1 border border-slate-100/50">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                                            onClick={() => {
                                                if (navigator.vibrate) navigator.vibrate(5);
                                                updateQty(item.id, -1);
                                            }}
                                        >
                                            <Minus size={14} className="text-slate-600" />
                                        </Button>
                                        <span className="w-6 text-center text-sm font-black text-slate-700">{item.qty}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 rounded-lg hover:bg-white hover:shadow-sm transition-all"
                                            onClick={() => {
                                                if (navigator.vibrate) navigator.vibrate(5);
                                                updateQty(item.id, 1);
                                            }}
                                        >
                                            <Plus size={14} className="text-indigo-600" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>

                <div className="p-6 bg-white border-t pt-4 pb-8 space-y-4 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.03)]">
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            <span>Subtotal</span>
                            <span className="text-slate-600">Rp {totals.subtotal.toLocaleString()}</span>
                        </div>
                        {totals.tax > 0 && (
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                <span>Pajak</span>
                                <span className="text-slate-600">Rp {totals.tax.toLocaleString()}</span>
                            </div>
                        )}
                        <Separator className="my-2 bg-slate-50" />
                        <div className="flex justify-between items-end pt-1">
                            <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Bayar</span>
                            <span className="text-2xl font-black text-slate-900 tracking-tight">
                                Rp {totals.finalTotal.toLocaleString()}
                            </span>
                        </div>
                    </div>

                    <Button
                        className="w-full h-14 text-base font-black bg-indigo-600 hover:bg-indigo-700 rounded-2xl shadow-lg shadow-indigo-100 transition-all active:scale-[0.98]"
                        disabled={cart.length === 0}
                        onClick={() => {
                            if (navigator.vibrate) navigator.vibrate(20);
                            handleCheckout();
                        }}
                    >
                        <CreditCard className="mr-2 h-5 w-5" /> BAYAR SEKARANG
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
};
