import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Play, Square, Plus, MonitorPlay, Coffee, Settings, Search, X, Trash2, Edit2, Link as LinkIcon, Check, Loader2, Eye, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ScrollArea } from '../components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { useToast } from '../components/ui/use-toast';
import CheckoutDialog from '../components/pos/CheckoutDialog';

// Helper Format Durasi
const formatDuration = (ms) => {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// --- KOMPONEN KARTU UNIT ---
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
            currentBill = product ? durationInHours * product.sellPrice : 0;
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
                                        : `Durasi Billing: ${durationInHours} Jam`
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
                                Tarif: Rp {parseInt(product?.sellPrice || 0).toLocaleString('id-ID')} / jam
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
const ManageUnitsDialog = ({ isOpen, onClose, units, storeId, products }) => {
    const [name, setName] = useState('');
    const [linkedProductId, setLinkedProductId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Filter produk yang tipe hourly
    const hourlyProducts = products.filter(p => p.pricingType === 'hourly');

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
            // Optional Feedback
        } catch (error) {
            console.error("Error adding unit:", error);
            alert("Gagal menambah unit: " + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteUnit = async (id) => {
        if (!confirm("Hapus unit ini?")) return;
        try {
            const { error } = await supabase
                .from('rental_units')
                .delete()
                .eq('id', id);

            if (error) throw error;
        } catch (error) {
            console.error("Error deleting unit:", error);
            alert("Gagal menghapus unit");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Kelola Unit / Meja</DialogTitle>
                    <DialogDescription>Tambahkan unit fisik dan pilih tarifnya. <br /><span className="text-xs text-muted-foreground">Pastikan klik tombol <strong>"+ Tambah"</strong> untuk menyimpan unit.</span></DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    {/* Form Tambah */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end bg-slate-50 p-4 rounded-lg border">
                        <div className="space-y-2">
                            <Label>Nama Unit / Meja</Label>
                            <Input
                                placeholder="Contoh: Meja 01"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Tautkan Tarif (Produk)</Label>
                            <Select value={linkedProductId} onValueChange={setLinkedProductId} disabled={hourlyProducts.length === 0}>
                                <SelectTrigger>
                                    <SelectValue placeholder={hourlyProducts.length === 0 ? "Belum ada tarif tersedia" : "Pilih Tarif..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {hourlyProducts.length === 0 ? (
                                        <div className="p-2 text-sm text-center text-muted-foreground">
                                            Buat produk tipe "Rental" dulu.
                                        </div>
                                    ) : (
                                        hourlyProducts.map(p => (
                                            <SelectItem key={p.id} value={p.id}>
                                                {p.name} - Rp {parseInt(p.sellPrice || 0).toLocaleString()}/jam
                                            </SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                            {hourlyProducts.length === 0 && (
                                <p className="text-[10px] text-red-500">
                                    *Belum ada produk tipe "Rental/Durasi".
                                </p>
                            )}
                        </div>
                        <Button onClick={handleAddUnit} disabled={!name || !linkedProductId || isSubmitting}>
                            {isSubmitting ? "Menyimpan..." : (
                                <>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Tambah
                                </>
                            )}
                        </Button>
                    </div>

                    {/* List Unit */}
                    <div className="space-y-2 mt-4">
                        <Label>Daftar Unit Tersedia</Label>
                        <ScrollArea className="h-[200px] border rounded-md p-2">
                            {units.length === 0 ? (
                                <p className="text-center text-muted-foreground py-8">Belum ada unit disimpan.</p>
                            ) : (
                                units.map(unit => {
                                    const product = products.find(p => p.id === unit.linkedProductId);
                                    return (
                                        <div key={unit.id} className="flex justify-between items-center p-2 border-b last:border-0 hover:bg-slate-50">
                                            <div>
                                                <div className="font-medium">{unit.name}</div>
                                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                                    <LinkIcon className="w-3 h-3" />
                                                    {product?.name || <span className="text-red-500">Produk dihapus</span>}
                                                </div>
                                            </div>
                                            <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDeleteUnit(unit.id)}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </ScrollArea>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

// --- DIALOG SELECTOR PRODUK F&B ---
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

    if (!isOpen) return null;

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

                <DialogFooter className="bg-slate-50 -mx-4 -mb-4 p-4 border-t">
                    <Button variant="outline" onClick={onClose} className="w-full">Selesai / Tutup</Button>
                </DialogFooter>
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
                                            size="sm"
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
        return Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60)));
    });

    const [priceInput, setPriceInput] = useState(() => {
        if (!session) return 0;

        // Use Agreed Total if available (Fixed Bundling)
        if (session.agreed_total !== undefined && session.agreed_total !== null) {
            return session.agreed_total;
        }

        const elapsed = Date.now() - new Date(session.start_time).getTime();
        const hrs = Math.max(1, Math.ceil(elapsed / (1000 * 60 * 60)));
        const basePrice = product ? parseInt(product.sellPrice) : (session.product_price || 0);
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
        const basePrice = product ? parseInt(product.sellPrice) : (session.product_price || 0);
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
                            <Label>Durasi Billing (Jam)</Label>
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
                                Rp {parseInt(product?.sellPrice || session.product_price || 0).toLocaleString()}
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
                            <select
                                value={discountType}
                                onChange={(e) => setDiscountType(e.target.value)}
                                className="h-10 px-3 border rounded-md bg-white text-sm"
                            >
                                <option value="percent">%</option>
                                <option value="fixed">Rp</option>
                            </select>
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
    const { products, currentStore, user, customers, refreshData } = useData();
    const navigate = useNavigate();
    const { toast } = useToast();

    // States
    const [units, setUnits] = useState([]);
    const [isLoadingUnits, setIsLoadingUnits] = useState(true);
    const [sessions, setSessions] = useState({}); // Map: unitId -> sessionData (Synced)

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

    // New States for Fixed Billing
    const [billingMode, setBillingMode] = useState('open'); // 'open' | 'fixed'
    const [fixedDuration, setFixedDuration] = useState(1); // Hours

    // Fetch Rental Units
    useEffect(() => {
        if (!currentStore?.id) return;

        const fetchUnits = async () => {
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
        };

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
    }, [currentStore?.id]);

    // Fetch Active Sessions (Persistence)
    useEffect(() => {
        if (!currentStore?.id) return;

        const fetchSessions = async () => {
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
        };

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

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentStore?.id]);

    // Handlers
    const handleRemoveItem = async (session, index) => {
        if (!confirm('Hapus item ini?')) return;
        const newOrders = [...session.orders];
        newOrders.splice(index, 1);
        try {
            const { error } = await supabase
                .from('rental_sessions')
                .update({ orders: newOrders })
                .eq('id', session.id);

            if (error) throw error;
            toast({ title: "Item Dihapus", description: "Item berhasil dihapus dari pesanan." });
        } catch (error) {
            console.error("Failed to remove item:", error);
            alert("Gagal menghapus item");
        }
    };

    const handleStartClick = (unit) => {
        const product = products.find(p => p.id === unit.linked_product_id);
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
        const product = products.find(p => p.id === selectedUnit.linked_product_id);
        if (!product) return;

        // Calculate Agreed Price (Handling Bundling)
        let agreedTotal = 0;
        let finalDuration = 1;

        if (billingMode === 'fixed') {
            finalDuration = parseFloat(fixedDuration);
            // Check Bundling
            const tiers = product.pricingTiers || [];
            const matchedTier = product.isBundlingEnabled ? tiers.find(t => parseFloat(t.duration) === finalDuration) : null;

            if (matchedTier) {
                agreedTotal = parseFloat(matchedTier.price);
            } else {
                agreedTotal = finalDuration * parseInt(product.sellPrice);
            }
        }

        try {
            const { error } = await supabase
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
                    orders: []
                }]);

            if (error) throw error;

            setIsStartOpen(false);
            toast({ title: "Sesi Dimulai", description: `${selectedUnit.name} aktif.` });
        } catch (error) {
            console.error("Failed to start session:", error);
            alert("Gagal memulai sesi");
        }
    };

    const handleStopClick = (session) => {
        setStopSessionData(session);
        setIsStopConfirmOpen(true);
    };

    const handleStopConfirmed = (finalDuration, finalPrice, discountValue = 0) => {
        const session = stopSessionData;

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
                store_id: currentStore.id,
                date: transactionDate ? transactionDate.toISOString() : new Date().toISOString(),
                user_id: user?.id || user?.uid || 'system',
                cashier: user?.name || user?.email || 'Admin',
                customer_name: paymentSession.customer_name || 'Guest',
                items: paymentSession.items,
                total: paymentSession.total,
                subtotal: paymentSession.subtotal || paymentSession.total,
                discount: paymentSession.discount || 0,
                payment_method: paymentMethod,
                amount_paid: cashAmount,
                change: change > 0 ? change : 0,
                type: 'rental',
                rental_session_id: paymentSession.id,
                points_earned: pointsEarned,
                status: 'completed'
            };

            const { data: transData, error: transError } = await supabase
                .from('transactions')
                .insert([transactionData])
                .select();

            if (transError) throw transError;

            // 3. Update Customer Points
            if (paymentSession.customer_id && (pointsEarned > 0 || paymentSession.total > 0)) {
                try {
                    const { data: cust, error: custFetchError } = await supabase
                        .from('customers')
                        .select('loyalty_points, total_spent')
                        .eq('id', paymentSession.customer_id)
                        .single();

                    if (!custFetchError) {
                        await supabase
                            .from('customers')
                            .update({
                                loyalty_points: (cust.loyalty_points || 0) + pointsEarned,
                                total_spent: (cust.total_spent || 0) + paymentSession.total
                            })
                            .eq('id', paymentSession.customer_id);
                    }
                } catch (err) {
                    console.error("Failed to update points:", err);
                }
            }

            // 4. Delete Rental Session
            const { error: deleteError } = await supabase
                .from('rental_sessions')
                .delete()
                .eq('id', paymentSession.id);

            if (deleteError) throw deleteError;

            // 5. Update States
            setLastTransaction(transData[0]);
            setPaymentSuccess(true);
            refreshData(); // Refresh global data for reports

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

        const newOrder = {
            id: product.id,
            name: product.name,
            price: parseInt(product.sellPrice),
            qty: qty
        };

        const currentOrders = session.orders || [];
        const existingIndex = currentOrders.findIndex(o => o.id === product.id);
        let updatedOrders = [...currentOrders];

        if (existingIndex >= 0) {
            updatedOrders[existingIndex] = {
                ...updatedOrders[existingIndex],
                qty: updatedOrders[existingIndex].qty + qty
            };
        } else {
            updatedOrders.push(newOrder);
        }

        try {
            const { error } = await supabase
                .from('rental_sessions')
                .update({ orders: updatedOrders })
                .eq('id', session.id);

            if (error) throw error;
            toast({
                title: "Menu Ditambahkan",
                description: `${qty}x ${product.name} disimpan.`,
                variant: "success",
                duration: 2000
            });
        } catch (error) {
            console.error("Failed to add order:", error);
            alert("Gagal menambah order");
        }
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Rental</h1>
                    <p className="text-muted-foreground">Kelola sesi rental dan unit layanan.</p>
                </div>
                <div className="flex gap-2">
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
                        const product = products.find(p => p.id === unit.linked_product_id);
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
                                    setDetailSession(s);
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
                session={detailSession}
                onRemoveItem={handleRemoveItem}
            />

            <StopRentalDialog
                key={stopSessionData?.id || 'idle'}
                isOpen={isStopConfirmOpen}
                onClose={() => setIsStopConfirmOpen(false)}
                session={stopSessionData}
                product={products.find(p => p.id === (units.find(u => u.id === stopSessionData?.unit_id)?.linked_product_id))}
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
                                    <SelectItem value="open">Open Billing (Per Jam - Berjalan)</SelectItem>
                                    <SelectItem value="fixed">Fixed Duration (Tembak Paket/Jam)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {billingMode === 'fixed' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <Label>Durasi Main (Jam)</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        min="0.5"
                                        step="0.5"
                                        value={fixedDuration}
                                        onChange={(e) => setFixedDuration(e.target.value)}
                                        className="w-24 font-bold text-center"
                                    />
                                    <span className="text-sm text-muted-foreground">Jam</span>
                                    <div className="ml-auto text-sm font-medium text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                        Selesai: {(() => {
                                            const now = new Date();
                                            now.setHours(now.getHours() + parseFloat(fixedDuration || 0));
                                            return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                        })()}
                                    </div>
                                </div>
                                {/* Quick Presets */}
                                <div className="flex gap-2 mt-2">
                                    {[1, 2, 3, 4, 5].map(hr => (
                                        <Button
                                            key={hr}
                                            type="button"
                                            variant={fixedDuration == hr ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setFixedDuration(hr)}
                                            className="h-7 text-xs"
                                        >
                                            {hr} Jam
                                        </Button>
                                    ))}
                                </div>

                                {/* Bundling Info Preview */}
                                {(() => {
                                    const prod = products.find(p => p.id === selectedUnit?.linkedProductId);
                                    if (prod && prod.isBundlingEnabled) {
                                        const dur = parseFloat(fixedDuration);
                                        const tier = prod.pricingTiers?.find(t => parseFloat(t.duration) === dur);
                                        const normalPrice = dur * parseInt(prod.sellPrice);

                                        if (tier) {
                                            return (
                                                <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md text-sm">
                                                    <div className="flex justify-between items-center text-green-800 font-bold">
                                                        <span>✨ Paket {dur} Jam:</span>
                                                        <span>Rp {parseInt(tier.price).toLocaleString()}</span>
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
                                    } else if (prod) {
                                        const normalPrice = parseFloat(fixedDuration) * parseInt(prod.sellPrice);
                                        return (
                                            <div className="mt-3 p-3 bg-slate-50 border rounded-md text-sm flex justify-between">
                                                <span className="text-muted-foreground">Total Estimasi:</span>
                                                <span className="font-semibold">Rp {normalPrice.toLocaleString()}</span>
                                            </div>
                                        );
                                    }
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
                products={products}
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
                onPrintReceipt={() => window.print()} // Simple print fallback
                onCloseSuccess={() => {
                    setIsCheckoutOpen(false);
                    setPaymentSession(null);
                    setPaymentSuccess(false);
                }}
                store={currentStore}
                user={user}
                lastTransaction={lastTransaction}
            />
        </div >
    );
};

export default RentalDashboard;
