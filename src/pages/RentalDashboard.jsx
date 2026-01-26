import React, { useState, useEffect, useCallback } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import ProductSelectorDialog from '../components/ProductSelectorDialog';
import { Play, Square, Plus, MonitorPlay, Coffee, Settings, Search, X, Trash2, Edit2, Link as LinkIcon, Check, Loader2, Eye, User, Bluetooth } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { supabase } from '../supabase';
import { useToast } from '../components/ui/use-toast';
import CheckoutDialog from '../components/pos/CheckoutDialog';
import { printerService } from '../services/printer';
import { printReceiptBrowser } from '../lib/receiptHelper';

// Helper Format Durasi
const formatDuration = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Helper: Hitung Harga Terbaik (Smart Bundling)
const calculateBestPrice = (durationData, product) => {
    let duration = parseFloat(durationData || 0);
    if (!product) return 0;

    const basePrice = parseInt(product.sellPrice || 0);

    // Jika tidak ada bundling, hitung flat
    if (!product.isBundlingEnabled || !product.pricingTiers || product.pricingTiers.length === 0) {
        return duration * basePrice;
    }

    let totalPrice = 0;
    let remainingDuration = duration;

    // 1. Sort tier dari durasi terpanjang ke terpendek
    const sortedTiers = [...product.pricingTiers]
        .map(t => ({ duration: parseFloat(t.duration), price: parseFloat(t.price) }))
        .sort((a, b) => b.duration - a.duration);

    // 2. Greedy Algorithm: Ambil paket terbesar yang muat
    for (const tier of sortedTiers) {
        if (remainingDuration >= tier.duration) {
            const count = Math.floor(remainingDuration / tier.duration);
            totalPrice += count * tier.price;
            remainingDuration -= count * tier.duration;

            // Fix floating point issues (e.g. 0.199999)
            remainingDuration = parseFloat(remainingDuration.toFixed(2));
        }
    }

    // 3. Sisa durasi dihitung harga normal
    if (remainingDuration > 0) {
        totalPrice += remainingDuration * basePrice;
    }

    return totalPrice;
};

// --- KOMPONEN KARTU UNIT ---
const RentalUnitCard = ({ unit, product, session, onStart, onStop, onOrder, onViewDetails }) => {
    const [elapsed, setElapsed] = useState(0);
    const [timeLeft, setTimeLeft] = useState(0);

    // Timer realtime
    useEffect(() => {
        let interval;
        if (session && session.status === 'active') {
            const updateTimer = () => {
                const now = Date.now();
                if (session.billing_mode === 'fixed' && session.target_end_time) {
                    // Count DOWN
                    const target = new Date(session.target_end_time).getTime();
                    setTimeLeft(target - now);
                } else {
                    // Count UP (Open Billing)
                    const startTime = new Date(session.start_time).getTime();
                    setElapsed(now - startTime);
                }
            };

            updateTimer(); // Initial call
            interval = setInterval(updateTimer, 1000);
        }
        return () => clearInterval(interval);
    }, [session]);

    // Hitung Biaya & Display Variables
    let durationInHours = 0;
    let currentBill = 0;
    let isOvertime = false;
    let timerDisplay = "00:00:00";

    if (session) {
        if (session.billing_mode === 'fixed') {
            // FIXED Mode
            durationInHours = session.target_duration || 1; // Fixed duration
            if (session.agreed_total !== undefined && session.agreed_total !== null) {
                currentBill = session.agreed_total;
            } else {
                currentBill = product ? durationInHours * product.sellPrice : 0;
            }

            if (timeLeft > 0) {
                timerDisplay = formatDuration(timeLeft);
            } else {
                timerDisplay = "WAKTU HABIS";
                isOvertime = true;
            }
        } else {
            // OPEN Mode
            durationInHours = Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60)));
            if (product && product.pricingType === 'daily') {
                const days = Math.ceil(durationInHours / 24);
                currentBill = days * product.sellPrice;
            } else {
                currentBill = product ? durationInHours * product.sellPrice : 0;
            }
            timerDisplay = formatDuration(elapsed);
        }
    }

    // Total Order F&B
    const totalOrder = session?.orders?.reduce((acc, item) => acc + (item.price * item.qty), 0) || 0;

    return (
        <Card className={`relative transition-all min-h-[400px] flex flex-col ${session ? (isOvertime ? 'border-red-600 ring-2 ring-red-500 shadow-xl bg-red-100' : 'border-indigo-500 shadow-md bg-indigo-50') : 'hover:border-indigo-500 bg-white'}`}>
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <MonitorPlay className="w-5 h-5 text-slate-500" />
                            {unit.name}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <LinkIcon className="w-3 h-3" />
                            {product?.name || 'Tarif tidak ditemukan'}
                        </p>
                        {session?.customer_name && session.customer_name !== 'Guest' && (
                            <div className={`flex items-center gap-1 mt-1 text-xs font-medium px-1.5 py-0.5 rounded w-fit ${session.customer_id ? 'text-indigo-600 bg-indigo-50 border border-indigo-100' : 'text-slate-600 bg-slate-100 border border-slate-200'
                                }`}>
                                <User className={`w-3 h-3 ${session.customer_id ? 'fill-current' : 'opacity-50'}`} />
                                <span className="truncate max-w-[100px]">{session.customer_name}</span>
                                {!session.customer_id && <span className="text-[10px] opacity-70 ml-1">(Guest)</span>}
                            </div>
                        )}
                        {session?.billing_mode === 'fixed' && (
                            <Badge variant="outline" className="mt-1 bg-white border-indigo-200 text-indigo-700 text-[10px] h-5">
                                Paket {session.target_duration} Jam
                            </Badge>
                        )}
                    </div>
                    <Badge variant={session ? "destructive" : "success"} className={session ? (isOvertime ? "bg-red-700 animate-pulse" : "bg-indigo-600") : "bg-green-600"}>
                        {session ? (isOvertime ? "WAKTU HABIS" : "In Use") : "Available"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1 p-4">
                <div className="flex flex-col h-full gap-4">
                    {session ? (
                        <>
                            <div className={`text-center py-2 rounded-lg border flex-shrink-0 ${isOvertime ? 'bg-red-200 border-red-300' : 'bg-white/60 border-indigo-100'}`}>
                                <div className={`text-3xl font-mono font-bold ${isOvertime ? 'text-red-700' : 'text-indigo-700'}`}>
                                    {timerDisplay}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                    {session.billing_mode === 'fixed'
                                        ? (timeLeft > 0 ? `Selesai: ${new Date(session.target_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Billing Terhenti (Fixed)')
                                        : (product?.pricingType === 'daily'
                                            ? `Durasi Billing: ${Math.ceil(durationInHours / 24)} Hari`
                                            : `Durasi Billing: ${durationInHours} Jam`
                                        )
                                    }
                                </p>
                            </div>

                            <div className="flex flex-col gap-2 text-sm bg-white/60 p-3 rounded border border-indigo-100/50">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Sewa {session.billing_mode === 'fixed' ? '(Fixed)' : `(${durationInHours} Jam)`}:</span>
                                    <span className="font-semibold">Rp {currentBill.toLocaleString('id-ID')}</span>
                                </div>
                                <div className="flex justify-between items-center border-t pt-2 mt-1">
                                    <span className="text-muted-foreground">F&B Total:</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold">Rp {totalOrder.toLocaleString('id-ID')}</span>
                                        {session.orders?.length > 0 && (
                                            <Button
                                                variant="secondary"
                                                size="icon"
                                                className="h-6 w-6 ml-1 bg-white border shadow-sm hover:bg-slate-100"
                                                onClick={() => onViewDetails(session)}
                                                title="Lihat Detail"
                                            >
                                                <Eye className="w-3 h-3 text-indigo-600" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <div className="flex justify-between border-t pt-2 mt-1 border-dashed border-slate-300">
                                    <span className="font-bold text-slate-700">Total Tagihan:</span>
                                    <span className="font-bold text-indigo-700 text-lg">Rp {(currentBill + totalOrder).toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                            <p>Siap Digunakan</p>
                            <p className="text-xs font-medium text-slate-900 mt-1">
                                Tarif: Rp {parseInt(product?.sellPrice || 0).toLocaleString('id-ID')} / {product?.pricingType === 'daily' ? 'hari' : 'jam'}

                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
            <CardFooter className="pt-2 gap-2">
                {session ? (
                    <>
                        <Button variant="outline" size="sm" className="flex-1 bg-white hover:bg-slate-50" onClick={() => onOrder(session)}>
                            <Coffee className="w-4 h-4 mr-1" />
                            Menu
                        </Button>
                        <Button variant={isOvertime ? "destructive" : "secondary"} size="sm" className={`flex-1 ${!isOvertime && "bg-slate-200 hover:bg-slate-300 text-slate-800"}`} onClick={() => onStop(session)}>
                            <Square className="w-4 h-4 mr-1" />
                            Stop
                        </Button>
                    </>
                ) : (
                    <Button
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                        onClick={() => onStart(unit)}
                        disabled={!product} // Disable start if no tariff linked
                    >
                        <Play className="w-4 h-4 mr-2" />
                        Mulai
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
};

// --- DIALOG MANAJEMEN UNIT ---
const ManageUnitsDialog = ({ isOpen, onClose, units, storeId, products, onRefresh }) => {
    const [name, setName] = useState('');
    const [linkedProductId, setLinkedProductId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [unitToDelete, setUnitToDelete] = useState(null);

    // Filter produk yang tipe hourly
    const hourlyProducts = products.filter(p => p.pricingType === 'hourly' || p.pricingType === 'daily');

    const { toast } = useToast();

    const handleAddUnit = async () => {
        if (!storeId) {
            alert("Gagal: Store ID tidak ditemukan. Coba refresh.");
            return;
        }
        if (!name || !linkedProductId) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('rental_units')
                .insert([{
                    store_id: storeId,
                    name,
                    linked_product_id: linkedProductId
                }]);

            if (error) throw error;
            setName('');

            // Immediate UI Refresh
            if (onRefresh) onRefresh();

            // Feedback & Reload
            toast({
                title: "Unit Berhasil Ditambahkan",
                description: `${name} telah disimpan. Halaman akan dimuat ulang...`,
                variant: "success",
                duration: 2000
            });

            setTimeout(() => {
                window.location.reload();
            }, 1500);

        } catch (error) {
            console.error("Error adding unit:", error);
            alert("Gagal menambah unit: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUnit = (unit) => {
        setUnitToDelete(unit);
    };

    const confirmDelete = async () => {
        if (!unitToDelete) return;
        try {
            const { error } = await supabase
                .from('rental_units')
                .delete()
                .eq('id', unitToDelete.id);

            if (error) throw error;
            setUnitToDelete(null);
            if (onRefresh) onRefresh();
            // Auto refresh handled by realtime or parent (units prop)
        } catch (error) {
            console.error("Error deleting unit:", error);
            alert(`Gagal menghapus unit: ${error.message || error.details || 'Unknown error'}`);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl border-none shadow-2xl overflow-hidden">
                <DialogHeader className="pb-4">
                    <DialogTitle className="text-2xl font-bold text-slate-800">Kelola Unit / Meja</DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Tambahkan unit fisik dan pilih tarifnya. <br />
                        <span className="text-xs font-medium text-slate-400">Pastikan klik tombol <strong className="text-indigo-600 font-bold">"+ Tambah"</strong> untuk menyimpan unit.</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-2">
                    {/* Form Tambah - Refined to match image */}
                    <div className="bg-slate-50/50 p-6 rounded-xl border border-slate-100 shadow-sm transition-all">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_auto] gap-x-6 gap-y-4 items-end">
                            <div className="space-y-2.5">
                                <Label className="text-sm font-bold text-slate-800">Nama Unit / Meja</Label>
                                <Input
                                    placeholder="Contoh: Meja 01"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="h-14 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50/50 rounded-xl transition-all text-base placeholder:text-slate-400"
                                />
                            </div>
                            <div className="space-y-2.5">
                                <Label className="text-sm font-bold text-slate-800">Tautkan Tarif (Produk)</Label>
                                <Select value={linkedProductId} onValueChange={setLinkedProductId} disabled={hourlyProducts.length === 0}>
                                    <SelectTrigger className="h-14 border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50/50 rounded-xl transition-all bg-white text-base">
                                        <SelectValue placeholder={hourlyProducts.length === 0 ? "Belum ada tarif..." : "Pilih Tarif..."} />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl border-slate-200">
                                        {hourlyProducts.length === 0 ? (
                                            <div className="p-4 text-sm text-center text-muted-foreground italic">
                                                Belum ada produk tipe "Rental" tersedia.
                                            </div>
                                        ) : (
                                            hourlyProducts.map(p => (
                                                <SelectItem key={p.id} value={p.id} className="cursor-pointer focus:bg-indigo-50 py-3">
                                                    <span className="font-medium text-slate-700">{p.name}</span>
                                                    <span className="ml-2 text-indigo-600 font-bold">- Rp {parseInt(p.sellPrice || 0).toLocaleString()}/{p.pricingType === 'daily' ? 'hari' : 'jam'}</span>
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                {hourlyProducts.length === 0 && (
                                    <p className="text-[10px] text-red-500 font-bold mt-1 leading-tight">
                                        *Belum ada produk tipe "Rental/Durasi".
                                    </p>
                                )}
                            </div>
                            <div className="md:pt-0">
                                <Button
                                    onClick={handleAddUnit}
                                    disabled={!name || !linkedProductId || isSubmitting}
                                    className="h-14 px-10 w-full md:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg transition-all active:scale-95 disabled:bg-slate-300 disabled:opacity-70 text-base"
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Plus className="w-6 h-6 mr-2" />
                                            Tambah
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* List Unit */}
                    <div className="space-y-4 mt-4">
                        <div className="flex items-center justify-between px-2">
                            <Label className="text-base font-bold text-slate-800">Daftar Unit Tersedia</Label>
                            <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-100 font-bold px-2.5">
                                {units.length} Unit
                            </Badge>
                        </div>
                        <ScrollArea className="h-[280px] border border-slate-100 rounded-xl p-3 bg-white/50 shadow-inner">
                            {units.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-60">
                                    <MonitorPlay className="w-12 h-12 mb-3 text-slate-300" />
                                    <p className="font-medium">Belum ada unit disimpan.</p>
                                </div>
                            ) : (
                                <div className="grid gap-2">
                                    {units.map(unit => {
                                        const product = products.find(p => p.id === unit.linked_product_id);
                                        return (
                                            <div key={unit.id} className="flex justify-between items-center p-4 bg-white border border-slate-50 hover:border-indigo-100 rounded-xl transition-all group shadow-sm hover:shadow-md">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors font-bold">
                                                        {unit.name.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-800 text-base">{unit.name}</div>
                                                        <div className="text-sm text-indigo-600 font-medium flex items-center gap-1.5">
                                                            <LinkIcon className="w-3.5 h-3.5" />
                                                            {product ? (
                                                                <>
                                                                    {product.name}
                                                                    <span className="text-slate-400 font-normal">・</span>
                                                                    Rp {parseInt(product.sellPrice || 0).toLocaleString()}/jam
                                                                </>
                                                            ) : (
                                                                <span className="text-red-500 italic">Produk tidak valid</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                                    onClick={() => handleDeleteUnit(unit)}
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </Button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter className="bg-slate-50/50 p-6 -mx-6 -mb-6 mt-4 flex items-center justify-center">
                    <Button variant="outline" onClick={onClose} className="rounded-xl px-12 h-12 font-bold text-slate-600 border-slate-200 hover:bg-white hover:border-slate-300 transition-all">
                        Tutup
                    </Button>
                </DialogFooter>

                {unitToDelete && (
                    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg">
                        <div className="bg-white p-6 rounded-xl shadow-xl border w-[90%] max-w-sm animate-in fade-in zoom-in duration-200">
                            <h3 className="text-xl font-bold text-slate-800 mb-2">Hapus {unitToDelete.name}?</h3>
                            <p className="text-slate-500 text-sm mb-6">Unit akan dihapus permanen. Aksi ini tidak bisa dibatalkan.</p>
                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => setUnitToDelete(null)}
                                    className="rounded-xl"
                                >
                                    Batal
                                </Button>
                                <Button
                                    onClick={confirmDelete}
                                    className="bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold"
                                >
                                    Ya, Hapus
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

// --- DIALOG DETAIL SESI (F&B LIST) ---
const RentalSessionDetailsDialog = ({ isOpen, onClose, session, onRemoveItem }) => {
    if (!session) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Detail Pesanan</DialogTitle>
                    <DialogDescription>
                        Item F&B untuk sesi ini.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {session.orders?.length > 0 ? (
                        <div className="space-y-2 border rounded-md p-2 max-h-[300px] overflow-y-auto">
                            {session.orders.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center text-sm p-2 hover:bg-slate-50 rounded border-b last:border-0">
                                    <div className="flex-1">
                                        <div className="font-medium">{item.qty}x {item.name}</div>
                                        <div className="text-muted-foreground text-xs">@ Rp {parseInt(item.price).toLocaleString()}</div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold">Rp {parseInt(item.price * item.qty).toLocaleString()}</span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => onRemoveItem(session, idx)}
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-muted-foreground">Belum ada pesanan F&B</div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={onClose}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// --- DIALOG STOP SESI (KONFIRMASI TOTAL) ---
const StopRentalDialog = ({ isOpen, onClose, session, onConfirm, product }) => {
    // State Initializers (runs once on mount/remount)
    const [durationInput, setDurationInput] = useState(() => {
        if (!session) return 0;
        if (session.billing_mode === 'fixed' && session.target_duration) {
            return session.target_duration;
        }
        const elapsed = Date.now() - new Date(session.start_time).getTime();
        const hrs = Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60)));
        // If Daily, return Days
        if (product && product.pricingType === 'daily') {
            return Math.ceil(hrs / 24);
        }
        return hrs;
    });

    const [priceInput, setPriceInput] = useState(() => {
        if (!session) return 0;
        const elapsed = Date.now() - new Date(session.start_time).getTime();
        const hrs = Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60)));
        const basePrice = product ? Number(product.sellPrice) : Number(session.product_price || 0);

        // If 'fixed' mode and NOT overtime, use agreed total
        if (session.billing_mode === 'fixed' && session.agreed_total !== null && session.agreed_total !== undefined) {
            const targetDuration = parseFloat(session.target_duration || 0);
            if (hrs <= targetDuration) {
                return session.agreed_total;
            }
            return hrs * basePrice;
        }
        return hrs * basePrice;
    });

    // Discount states
    const [discountAmount, setDiscountAmount] = useState(0);
    const [discountType, setDiscountType] = useState('percent'); // 'percent' | 'fixed'

    // Calculate discount value
    const calculateDiscount = () => {
        if (discountType === 'percent') {
            return Math.round(priceInput * (discountAmount / 100));
        }
        return discountAmount;
    };

    const discountValue = calculateDiscount();
    const finalPrice = Math.max(0, priceInput - discountValue);

    // We rely on 'key' prop to force remount when session changes, eliminating the need for useEffect state sync.

    const handleDurationChange = (e) => {
        const val = parseFloat(e.target.value) || 0;
        setDurationInput(val);

        // Auto update price based on Bundling Rules or Rate
        if (product && product.isBundlingEnabled && product.pricingTiers) {
            const tier = product.pricingTiers.find(t => parseFloat(t.duration) === val);
            if (tier) {
                setPriceInput(parseFloat(tier.price));
                return;
            }
        }

        // Fallback to normal calculation
        const basePrice = product ? Number(product.sellPrice) : Number(session.product_price || 0);
        setPriceInput(val * basePrice);
    };

    if (!session) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Stop Sesi Rental</DialogTitle>
                    <DialogDescription>Konfirmasi durasi dan total tagihan sebelum stop.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    {/* Info Waktu */}
                    <div className="text-sm text-muted-foreground mb-4 p-2 bg-slate-50 rounded border">
                        <div className="flex justify-between">
                            <span>Mulai:</span>
                            <span>{new Date(session.start_time).toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Selesai (Sekarang):</span>
                            <span>{new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Durasi Billing ({product?.pricingType === 'daily' ? 'Hari' : 'Jam'})</Label>
                            <Input
                                type="number"
                                value={durationInput}
                                onChange={handleDurationChange}
                                step="0.5"
                                min="0.5"
                            />
                            <p className="text-[10px] text-muted-foreground">Bisa diedit (misal telat stop).</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Rate / Jam</Label>
                            <div className="h-10 px-3 py-2 bg-slate-100 rounded text-sm flex items-center">
                                Rp {Number(product?.sellPrice || session.product_price || 0).toLocaleString()}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                        <Label>Total Tagihan Sewa</Label>
                        <Input
                            type="number"
                            value={priceInput}
                            onChange={(e) => setPriceInput(parseFloat(e.target.value) || 0)}
                            className="font-bold text-lg"
                        />
                        <p className="text-[10px] text-muted-foreground">*Total biaya sewa (belum termasuk F&B).</p>
                    </div>

                    {/* Discount Section */}
                    <div className="space-y-2 pt-2 border-t">
                        <Label>Diskon</Label>
                        <div className="flex gap-2">
                            <Input
                                type="number"
                                placeholder="0"
                                value={discountAmount || ''}
                                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                                className="flex-1"
                            />
                            <Select value={discountType} onValueChange={setDiscountType}>
                                <SelectTrigger className="w-20 h-10">
                                    <SelectValue placeholder="Tipe" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="percent">%</SelectItem>
                                    <SelectItem value="fixed">Rp</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {discountValue > 0 && (
                            <div className="text-sm text-red-600 flex justify-between">
                                <span>Potongan:</span>
                                <span>- Rp {discountValue.toLocaleString()}</span>
                            </div>
                        )}
                    </div>

                    {/* Final Price Preview */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-green-700">Total Akhir Sewa:</span>
                            <span className="text-xl font-bold text-green-800">Rp {finalPrice.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Batal</Button>
                    <Button onClick={() => onConfirm(durationInput, finalPrice, discountValue)}>Lanjut Pembayaran</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const RentalDashboard = () => {
    const {
        products,
        currentStore,
        activeStoreId,
        fetchAllProducts,
        refreshData,
        user,
        customers,
        processSale
    } = useData();
    const navigate = useNavigate();
    const { toast } = useToast();

    // Fetch Products on Mount (Ensure we have fresh products)
    useEffect(() => {
        if (activeStoreId) {
            fetchAllProducts(activeStoreId);
        }
    }, [activeStoreId, fetchAllProducts]);

    // States
    const [units, setUnits] = useState([]);
    const [isLoadingUnits, setIsLoadingUnits] = useState(true);
    const [sessions, setSessions] = useState({}); // Map: unitId -> sessionData (Synced)
    const [extraProducts, setExtraProducts] = useState([]);

    // Merge context products with explicitly fetched extra products for Rental needs
    const allProducts = React.useMemo(() => {
        const combined = [...products, ...extraProducts];
        const unique = new Map();
        combined.forEach(p => unique.set(p.id, p));
        return Array.from(unique.values());
    }, [products, extraProducts]);

    // Dialog States
    const [isManageOpen, setIsManageOpen] = useState(false);
    const [isStartOpen, setIsStartOpen] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState(null);
    const [customerName, setCustomerName] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    const [isOrderOpen, setIsOrderOpen] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState(null); // Ini sebenarnya Unit ID

    // Payment / Checkout States
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentSession, setPaymentSession] = useState(null);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    const [lastTransaction, setLastTransaction] = useState(null);

    // Detail Dialog State
    const [detailSession, setDetailSession] = useState(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    // Stop Confirm State
    const [stopSessionData, setStopSessionData] = useState(null);
    const [isStopConfirmOpen, setIsStopConfirmOpen] = useState(false);

    // Printer
    const [printerStatus, setPrinterStatus] = useState({ connected: false, name: null });

    // New States for Fixed Billing
    const [billingMode, setBillingMode] = useState('open'); // 'open' | 'fixed'
    const [fixedDuration, setFixedDuration] = useState(1); // Hours

    // Fetch Rental Units
    const fetchUnits = useCallback(async () => {
        if (!currentStore?.id) return;
        setIsLoadingUnits(true);
        const { data, error } = await supabase
            .from('rental_units')
            .select('*')
            .eq('store_id', currentStore.id);

        if (error) {
            console.error("Error fetching rental units:", error);
        } else {
            const items = data || [];
            items.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
            setUnits(items);
        }
        setIsLoadingUnits(false);
    }, [currentStore?.id]);

    // --- PRINTER AUTO-CONNECT ---
    useEffect(() => {
        const initPrinter = async () => {
            // Check if supported first
            if (navigator.bluetooth && navigator.bluetooth.getDevices) {
                if (!printerService.isConnected()) {
                    console.log("Attempting printer auto-connect...");
                    const result = await printerService.autoConnect();
                    if (result.success) {
                        toast({
                            title: "Printer Terhubung",
                            description: `Terhubung otomatis ke ${result.name}`,
                        });
                    }
                }
            }
        };
        initPrinter();
    }, [toast]);

    useEffect(() => {
        fetchUnits();

        const channel = supabase
            .channel('rental_units_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'rental_units',
                filter: `store_id=eq.${currentStore.id}`
            }, () => {
                fetchUnits();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchUnits, currentStore?.id]);

    // Fetch Active Sessions (Persistence)
    const fetchSessions = useCallback(async () => {
        if (!currentStore?.id) return;
        const { data, error } = await supabase
            .from('rental_sessions')
            .select('*')
            .eq('store_id', currentStore.id)
            .eq('status', 'active');

        if (error) {
            console.error("Error fetching sessions:", error);
        } else {
            const sessionsMap = {};
            (data || []).forEach(row => {
                sessionsMap[row.unit_id] = row;
            });
            setSessions(sessionsMap);
        }
    }, [currentStore?.id]);

    // Fetch Missing Products for Units
    useEffect(() => {
        const loadMissingProducts = async () => {
            if (units.length === 0) return;

            // Identify product IDs needed
            const neededIds = units.map(u => u.linked_product_id).filter(id => id);

            // Check which are missing from global context
            const missingIds = neededIds.filter(id => !products.find(p => p.id === id));

            if (missingIds.length > 0) {
                try {
                    // Fetch missing products
                    const { data, error } = await supabase
                        .from('products')
                        .select('*')
                        .in('id', missingIds)
                        .eq('store_id', currentStore.id);

                    if (error) throw error;

                    if (data && data.length > 0) {
                        // Normalize fetched data
                        const formatted = data.map(p => ({
                            ...p,
                            buyPrice: p.buy_price,
                            sellPrice: p.sell_price,
                            pricingType: p.pricing_type,
                            isBundlingEnabled: p.is_bundling_enabled,
                            pricingTiers: p.pricing_tiers || []
                        }));
                        setExtraProducts(formatted);
                    }
                } catch (err) {
                    console.error("Error fetching linked products:", err);
                }
            }
        };

        loadMissingProducts();
    }, [units, products, currentStore?.id]);

    useEffect(() => {
        fetchSessions();

        const channel = supabase
            .channel('rental_sessions_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'rental_sessions',
                filter: `store_id=eq.${currentStore.id}`
            }, () => {
                fetchSessions();
            })
            .subscribe();

        // Sync Printer Status
        const checkPrinter = setInterval(() => {
            setPrinterStatus({
                connected: printerService.isConnected(),
                name: printerService.getDeviceName()
            });
        }, 2000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(checkPrinter);
        };
    }, [fetchSessions, currentStore?.id]);

    // Handlers
    const handleRemoveItem = async (session, index) => {
        if (!confirm('Hapus item ini? Item akan dihapus dan stok dikembalikan (jika ada).')) return;

        try {
            const { error } = await supabase.rpc('remove_session_item', {
                p_session_id: session.id,
                p_store_id: currentStore.id,
                p_item_index: index
            });

            if (error) throw error;

            // Optimistic Update (Manual sync needs care with array index, easier to fetch fresh)
            await fetchSessions();

            toast({ title: "Item Dihapus", description: "Item dihapus dan stok dikembalikan." });
        } catch (error) {
            console.error("Failed to remove item:", error);
            alert("Gagal menghapus item: " + error.message);
        }
    };

    const handleStartClick = (unit) => {
        const product = allProducts.find(p => p.id === unit.linked_product_id);
        if (!product) {
            alert("Produk tarif tidak ditemukan! Mohon cek pengaturan unit.");
            return;
        }
        setSelectedUnit(unit);
        setCustomerName('');
        setSelectedCustomer(null);
        // Reset Billing Mode
        setBillingMode('open');
        setFixedDuration(1);
        setIsStartOpen(true);
    };

    const confirmStart = async () => {
        const product = allProducts.find(p => p.id === selectedUnit.linked_product_id);
        if (!product) return;

        // Calculate Agreed Price (Handling Bundling)
        let agreedTotal = 0;
        let finalDuration = 1;

        if (billingMode === 'fixed') {
            finalDuration = parseFloat(fixedDuration);
            // Use Smart Bundling Logic
            agreedTotal = calculateBestPrice(finalDuration, product);
        }

        try {
            const { data, error } = await supabase
                .from('rental_sessions')
                .insert([{
                    store_id: currentStore.id,
                    unit_id: selectedUnit.id,
                    customer_name: selectedCustomer ? selectedCustomer.name : (customerName || 'Guest'),
                    customer_id: selectedCustomer ? selectedCustomer.id : null,
                    start_time: new Date().toISOString(),
                    status: 'active',
                    billing_mode: billingMode,
                    target_duration: billingMode === 'fixed' ? finalDuration : null,
                    target_end_time: billingMode === 'fixed' ? new Date(Date.now() + (finalDuration * 60 * 60 * 1000)).toISOString() : null,
                    agreed_total: billingMode === 'fixed' ? agreedTotal : null,
                    product_id: product.id,
                    product_price: Number(product.sellPrice || 0),
                    unit_name: selectedUnit.name,
                    orders: []
                }])
                .select()
                .single();

            if (error) throw error;

            // Optimistic Update / Immediate Sync
            setSessions(prev => ({
                ...prev,
                [selectedUnit.id]: data
            }));

            setIsStartOpen(false);
            toast({ title: "Sesi Dimulai", description: `${selectedUnit.name} aktif.` });
        } catch (error) {
            console.error("Failed to start session:", error);
            alert("Gagal memulai sesi: " + error.message);
        }
    };

    const handleStopClick = (session) => {
        setStopSessionData(session);
        setIsStopConfirmOpen(true);
    };

    const handleStopConfirmed = (finalDuration, finalPrice, discountValue = 0) => {
        const session = sessions[stopSessionData.unit_id];

        // Buat Item Rental
        const rentalItem = {
            id: session.product_id || 'rental-fee',
            name: `Sewa ${session.unit_name || 'Unit'} (${finalDuration} Jam)`,
            price: finalPrice, // Harga FINAL setelah diskon
            qty: 1, // Kita set qty 1, karena harga sudah 'Total Harga Sewa'
            type: 'service'
        };
        // Alternatif: qty = finalDuration, price = rate. Tapi kalau user edit harga manual yg tidak match rate?
        // Lebih aman: Name mengandung durasi, Price adalah Total, Qty 1.

        const orderItems = (session.orders || []).map(o => ({
            id: o.id,
            name: o.name,
            price: o.price,
            qty: o.qty
        }));

        const items = [rentalItem, ...orderItems];
        const total = items.reduce((acc, item) => acc + (item.price * item.qty), 0);
        const subtotal = total + discountValue; // Subtotal adalah total sebelum diskon

        setPaymentSession({
            ...session,
            items,
            total,
            subtotal,
            discount: discountValue
        });
        setPaymentSuccess(false);
        setIsCheckoutOpen(true);
        setIsStopConfirmOpen(false);
    };

    const handlePrintReceipt = useCallback(async () => {
        if (!lastTransaction) return;
        const config = {
            ...currentStore,
            ...(currentStore?.settings || {})
        };

        if (printerService.isConnected()) {
            const res = await printerService.printReceipt(lastTransaction, config);
            if (res.success) return;
        }

        printReceiptBrowser(lastTransaction, config);
    }, [lastTransaction, currentStore]);

    const handleConnectPrinter = async () => {
        if (!navigator.bluetooth) {
            toast({
                title: "Bluetooth Tidak Didukung",
                description: "Gunakan Chrome pada Android/Desktop.",
                variant: "destructive"
            });
            return;
        }
        const res = await printerService.connect();
        setPrinterStatus({ connected: res.success, name: res.name });
        if (res.success) {
            toast({ title: "Printer Terhubung", description: `Berhasil tersambung ke ${res.name}` });
        } else {
            toast({ title: "Koneksi Gagal", description: res.error, variant: "destructive" });
        }
    };

    const handleProcessPayment = async ({ paymentMethod, cashAmount, change, transactionDate }) => {
        if (!paymentSession) return;

        try {
            // 1. Calculate Points (Loyalty)
            let pointsEarned = 0;
            const loyalty = currentStore?.loyaltySettings;

            if (paymentSession.customer_id && loyalty?.isActive) {
                const total = paymentSession.total;
                if (loyalty.ruleType === 'minimum' && total >= (parseInt(loyalty.minTransactionAmount) || 0)) {
                    pointsEarned = parseInt(loyalty.pointsReward) || 0;
                } else if (loyalty.ruleType === 'multiple') {
                    const step = parseFloat(loyalty.ratioAmount) || 0;
                    if (step > 0) {
                        const multipliers = Math.floor(total / step);
                        pointsEarned = multipliers * (parseInt(loyalty.ratioPoints) || 0);
                    }
                }
            }

            // 2. Transaction Data
            const transactionData = {
                items: paymentSession.items,
                total: paymentSession.total,
                subtotal: paymentSession.subtotal || paymentSession.total,
                discount: paymentSession.discount || 0,
                paymentMethod: paymentMethod,
                cashAmount: cashAmount,
                change: change > 0 ? change : 0,
                type: 'rental',
                rental_session_id: paymentSession.id,
                customerId: paymentSession.customer_id || null,
                pointsEarned: pointsEarned,
                date: transactionDate ? transactionDate.toISOString() : new Date().toISOString()
            };

            const result = await processSale(transactionData);

            if (!result.success) throw new Error(result.error);

            // 4. Delete Rental Session
            const { error: deleteError } = await supabase
                .from('rental_sessions')
                .delete()
                .eq('id', paymentSession.id);

            if (deleteError) throw deleteError;

            // 5. Update States & Manual UI Cleanup
            setLastTransaction(result.transaction);
            setPaymentSuccess(true);

            // Immediately clear the session from local state for instant feedback
            if (paymentSession?.unit_id) {
                setSessions(prev => {
                    const next = { ...prev };
                    delete next[paymentSession.unit_id];
                    return next;
                });
            }

            // Trigger re-fetches
            fetchSessions();
            refreshData();

            toast({ title: "Pembayaran Berhasil", description: "Transaksi rental tersimpan." });
        } catch (error) {
            console.error("Payment Error:", error);
            alert("Gagal memproses pembayaran: " + error.message);
        }
    };

    const handleOrderClick = (session) => {
        setCurrentSessionId(session.unit_id);
        setIsOrderOpen(true);
    };

    const handleProductSelect = async (product, qty = 1) => {
        const session = sessions[currentSessionId];
        if (!session) return;

        try {
            const { error } = await supabase.rpc('add_session_item', {
                p_session_id: session.id,
                p_store_id: currentStore.id,
                p_product_id: product.id,
                p_qty: qty,
                p_price: Number(product.sellPrice || 0)
            });

            if (error) throw error;

            await fetchSessions();

            toast({
                title: "Menu Ditambahkan",
                description: `${qty}x ${product.name} disimpan & stok dipotong.`,
                variant: "success",
                duration: 2000
            });
        } catch (error) {
            console.error("Failed to add order:", error);
            alert("Gagal menambah order: " + error.message);
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Rental</h1>
                    <p className="text-muted-foreground">Kelola sesi rental dan unit layanan.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant={printerStatus.connected ? "outline" : "ghost"}
                        size="sm"
                        className={cn(
                            "h-10 gap-2 transition-all",
                            printerStatus.connected
                                ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                                : "text-muted-foreground border border-dashed"
                        )}
                        onClick={handleConnectPrinter}
                    >
                        <Bluetooth size={16} className={printerStatus.connected ? "text-green-600" : ""} />
                        <span className="text-xs font-medium">
                            {printerStatus.connected ? (printerStatus.name || 'Printer On') : 'Connect Printer'}
                        </span>
                    </Button>
                    <Button variant="outline" onClick={() => navigate('/products/add', { state: { pricingType: 'hourly', type: 'service' } })}>
                        <Plus className="w-4 h-4 mr-2" />
                        Buat Tarif Baru
                    </Button>
                    <Button onClick={() => setIsManageOpen(true)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Kelola Unit / Meja
                    </Button>
                </div>
            </div>

            {/* Grid Kartu Unit */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {isLoadingUnits ? (
                    <div className="col-span-full py-20 flex justify-center items-center flex-col gap-3">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                        <p className="text-muted-foreground text-sm">Memuat unit...</p>
                    </div>
                ) : units.length === 0 ? (
                    <div className="col-span-full text-center py-12 bg-white rounded-lg border border-dashed">
                        <MonitorPlay className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                        <h3 className="text-lg font-medium">Belum ada Unit / Meja</h3>
                        <p className="text-muted-foreground mb-4">Buat unit meja/ruangan terlebih dahulu dan tautkan dengan tarif produk.</p>
                        <Button onClick={() => setIsManageOpen(true)}>Kelola Unit</Button>
                    </div>
                ) : (
                    units.map(unit => {
                        const product = allProducts.find(p => p.id === unit.linked_product_id);
                        return (
                            <RentalUnitCard
                                key={unit.id}
                                unit={unit}
                                product={product}
                                session={sessions[unit.id]}
                                onStart={handleStartClick}
                                onStop={handleStopClick}
                                onOrder={handleOrderClick}
                                onRemoveItem={handleRemoveItem}
                                onViewDetails={(s) => {
                                    setDetailSession(s); // Keep track of WHICH session is open
                                    setIsDetailOpen(true);
                                }}
                            />
                        );
                    })
                )}
            </div>

            {/* Dialogs */}
            <RentalSessionDetailsDialog
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                session={detailSession ? sessions[detailSession.unit_id] : null} // Use LIVE data from sessions map
                onRemoveItem={handleRemoveItem}
            />

            <StopRentalDialog
                key={stopSessionData?.id || 'idle'}
                isOpen={isStopConfirmOpen}
                onClose={() => setIsStopConfirmOpen(false)}
                session={stopSessionData ? sessions[stopSessionData.unit_id] : null}
                product={allProducts.find(p => p.id === (units.find(u => u.id === stopSessionData?.unit_id)?.linked_product_id))}
                onConfirm={handleStopConfirmed}
            />

            <Dialog open={isStartOpen} onOpenChange={setIsStartOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mulai Sewa - {selectedUnit?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nama Pelanggan / Tamu</Label>
                            <div className="relative">
                                <Input
                                    value={customerName}
                                    onChange={e => {
                                        setCustomerName(e.target.value);
                                        setSelectedCustomer(null);
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            confirmStart();
                                        }
                                    }}
                                    placeholder="Cari Pelanggan atau Ketik Tamu..."
                                    className={selectedCustomer ? "border-green-500 pr-10 focus-visible:ring-green-500" : ""}
                                    autoFocus
                                />
                                {selectedCustomer && (
                                    <div className="absolute right-3 top-3 text-green-600">
                                        <Check className="w-4 h-4" />
                                    </div>
                                )}

                                {customerName && !selectedCustomer && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                                        {customers
                                            .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
                                            .length > 0 ? (
                                            customers
                                                .filter(c => c.name.toLowerCase().includes(customerName.toLowerCase()))
                                                .slice(0, 5)
                                                .map(customer => (
                                                    <div
                                                        key={customer.id}
                                                        className="p-2 text-sm hover:bg-slate-100 cursor-pointer border-b last:border-0"
                                                        onClick={() => {
                                                            setCustomerName(customer.name);
                                                            setSelectedCustomer(customer);
                                                        }}
                                                    >
                                                        <div className="font-medium text-slate-900">{customer.name}</div>
                                                        <div className="text-xs text-muted-foreground">{customer.phone}</div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="p-2 text-xs text-muted-foreground italic bg-slate-50">
                                                Tekan Enter untuk menggunakan nama "{customerName}" sebagai Tamu.
                                            </div>
                                        )
                                        }
                                    </div>
                                )}
                            </div>
                        </div>
                        {selectedUnit && (
                            <div className="p-3 bg-blue-50 text-blue-800 rounded text-sm">
                                Tarif: <strong>{products.find(p => p.id === selectedUnit.linked_product_id)?.name}</strong>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>Mode Billing</Label>
                            <Select value={billingMode} onValueChange={setBillingMode}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Mode" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(() => {
                                        const prod = products.find(p => p.id === selectedUnit?.linked_product_id);
                                        const isDaily = prod?.pricingType === 'daily';
                                        const label = isDaily ? 'Hari' : 'Jam';
                                        return (
                                            <>
                                                <SelectItem value="open">Open Billing (Per {label} - Berjalan)</SelectItem>
                                                <SelectItem value="fixed">Fixed Duration (Tembak Paket/{label})</SelectItem>
                                            </>
                                        );
                                    })()}
                                </SelectContent>
                            </Select>
                        </div>

                        {billingMode === 'fixed' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                {(() => {
                                    const prod = products.find(p => p.id === selectedUnit?.linked_product_id);
                                    const isDaily = prod?.pricingType === 'daily';
                                    const unitLabel = isDaily ? 'Hari' : 'Jam';
                                    const unitValue = isDaily ? 24 : 1; // 1 unit = N hours

                                    return (
                                        <>
                                            <Label>Durasi Main ({unitLabel})</Label>
                                            <div className="flex items-center gap-2">
                                                <Input
                                                    type="number"
                                                    min={isDaily ? "1" : "0.5"}
                                                    step={isDaily ? "1" : "0.5"}
                                                    value={fixedDuration}
                                                    onChange={(e) => setFixedDuration(e.target.value)}
                                                    className="w-24 font-bold text-center"
                                                />
                                                <span className="text-sm text-muted-foreground">{unitLabel}</span>
                                                <div className="ml-auto text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                                    Selesai: {(() => {
                                                        const now = new Date();
                                                        // Calculate hours to add: Duration * UnitValue (24 or 1)
                                                        const hoursToAdd = parseFloat(fixedDuration || 0) * unitValue;
                                                        now.setHours(now.getHours() + hoursToAdd);

                                                        // If daily, show date + time. If hourly, just time.
                                                        const options = isDaily
                                                            ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }
                                                            : { hour: '2-digit', minute: '2-digit' };
                                                        return now.toLocaleString('id-ID', options);
                                                    })()}
                                                </div>
                                            </div>
                                            {/* Quick Presets */}
                                            <div className="flex gap-2 mt-2">
                                                {[1, 2, 3, 4, 5].map(val => (
                                                    <Button
                                                        key={val}
                                                        type="button"
                                                        variant={fixedDuration == val ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setFixedDuration(val)}
                                                        className="h-7 text-xs"
                                                    >
                                                        {val} {unitLabel}
                                                    </Button>
                                                ))}
                                            </div>

                                            {/* Bundling Info Preview (Smart Calc) */}
                                            {(() => {
                                                const prod = products.find(p => p.id === selectedUnit?.linked_product_id);
                                                if (!prod) return null;

                                                const dur = parseFloat(fixedDuration);
                                                const bestPrice = calculateBestPrice(dur, prod);
                                                const normalPrice = dur * parseInt(prod.sellPrice);

                                                // Cek apakah lebih hemat?
                                                const isCheaper = bestPrice < normalPrice;

                                                if (isCheaper) {
                                                    return (
                                                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                                                            <div className="flex justify-between items-center text-green-800 font-bold">
                                                                <span>✨ Harga Paket (Hemat):</span>
                                                                <span>Rp {bestPrice.toLocaleString()}</span>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground line-through mt-1 text-right">
                                                                Normal: Rp {normalPrice.toLocaleString()}
                                                            </div>
                                                        </div>
                                                    );
                                                } else {
                                                    return (
                                                        <div className="mt-3 p-3 bg-slate-50 border rounded-md text-sm flex justify-between">
                                                            <span className="text-muted-foreground">Total Estimasi:</span>
                                                            <span className="font-semibold">Rp {normalPrice.toLocaleString()}</span>
                                                        </div>
                                                    );
                                                }
                                            })()}
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStartOpen(false)}>Batal</Button>
                        <Button onClick={confirmStart}>Mulai Timer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ManageUnitsDialog
                isOpen={isManageOpen}
                onClose={() => setIsManageOpen(false)}
                units={units}
                storeId={currentStore?.id}
                products={allProducts}
                onRefresh={refreshData}
            />

            <ProductSelectorDialog
                isOpen={isOrderOpen}
                onClose={() => setIsOrderOpen(false)}
                onSelect={handleProductSelect}
                products={products}
            />

            <CheckoutDialog
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                total={paymentSession?.total || 0}
                onProcessPayment={handleProcessPayment}
                paymentSuccess={paymentSuccess}
                onPrintReceipt={handlePrintReceipt}
                onCloseSuccess={() => {
                    setIsCheckoutOpen(false);
                    setPaymentSession(null);
                    setPaymentSuccess(false);
                }}
                store={{ ...currentStore, ...(currentStore?.settings || {}) }}
                user={user}
                lastTransaction={lastTransaction}
            />
        </div >
    );
};

export default RentalDashboard;
