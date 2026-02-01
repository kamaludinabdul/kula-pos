import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useShift } from '../context/ShiftContext';
import { sendTransactionToTelegram } from '../services/telegram';
import { usePOS } from '../hooks/usePOS';

// Components
import ProductGrid from '../components/pos/ProductGrid';
import { MobileBottomNav, MobileCartSheet } from '../components/pos/MobileComponents';
import CheckoutDialog from '../components/pos/CheckoutDialog';
import BarcodeScannerDialog from '../components/pos/BarcodeScannerDialog';
import { Search, ScanBarcode, RefreshCw } from 'lucide-react';
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

const MobilePOS = () => {
    // Hooks
    const { user } = useAuth();
    const { products, categories, currentStore, processSale, refreshTransactions, fetchAllProducts } = useData();
    const { currentShift, updateShiftStats } = useShift();

    // Logic from usePOS
    const {
        cart,
        totals,
        addToCart: originalAddToCart, updateQty, clearCart,
        activeCategory, setActiveCategory,
        searchQuery, setSearchQuery,
        filteredProducts
    } = usePOS();

    // Haptic Wrapped Logic
    const hapticAddToCart = (product) => {
        originalAddToCart(product);
        if (navigator.vibrate) navigator.vibrate(50); // Subtle feedback
    };

    // Local UI State
    const [activeTab, setActiveTab] = useState('home');
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isScannerOpen, setIsScannerOpen] = useState(false);

    // Checkout State (Managed locally or can use usePOS if refined, but POS.jsx manages it locally too mostly for UI control)
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentSuccess, setPaymentSuccess] = useState(false);
    // Unused local state removed: paymentMethod, cashAmount
    const [lastTransaction, setLastTransaction] = useState(null);

    // Alert Helper (Simple alert for mobile)
    useEffect(() => {
        window.onPOSNotification = (title, message) => {
            // Use native alert or maybe a toast if available. 
            // In mobile context, alert is disruptive but safe fallback.
            // Ideally we use a Toast component.
            // For now, let's stick to alert or console if in dev.
            alert(`${title}: ${message}`);
        };
        return () => { window.onPOSNotification = null; };
    }, []);

    const handleBarcodeScan = (code) => {
        const product = products.find(p =>
            (p.code && p.code.toLowerCase() === code.toLowerCase()) ||
            (p.barcode && p.barcode.toLowerCase() === code.toLowerCase())
        );

        if (product) {
            hapticAddToCart(product);
            if (navigator.vibrate) navigator.vibrate(200);
            const audio = new Audio('/beep.mp3');
            audio.play().catch(() => { });
        } else {
            alert(`Tidak ditemukan: ${code}`);
        }
    };

    const handleCheckout = () => {
        if (!currentShift) {
            alert('Shift belum dibuka! Silakan buka shift di kasir utama (Desktop).');
            return;
        }
        setIsCartOpen(false);
        setIsCheckoutOpen(true);
        setPaymentSuccess(false);
    };

    const processPayment = async (paymentDetails) => {
        const { paymentMethod, cashAmount, change } = paymentDetails;

        const transactionData = {
            items: cart.map(item => ({
                id: item.id,
                name: item.name,
                qty: item.qty,
                price: item.price,
                discount: item.discount || 0,
                total: (item.price - (item.discount || 0)) * item.qty,
                category: item.category || [],
                type: item.type || 'goods'
            })),
            subtotal: totals.subtotal,
            tax: totals.tax,
            serviceCharge: totals.serviceCharge,
            discount: totals.discountAmount,
            discountType: 'percentage', // Default for mobile
            discountValue: 0,
            total: totals.finalTotal,
            paymentMethod,
            cashAmount,
            change,
            cashier: user?.name || 'Mobile Staff',
            cashierId: user?.id,
            status: 'completed',
            shiftId: currentShift?.id,
            storeName: currentStore?.name,
            date: new Date().toISOString(),
            pointsEarned: 0
        };

        const result = await processSale(transactionData);

        if (result.success) {
            await updateShiftStats(totals.finalTotal, paymentMethod, totals.discountAmount);
            if (currentStore?.telegramNotifyTransaction) {
                sendTransactionToTelegram({ ...transactionData, id: Date.now() }, { token: currentStore.telegramBotToken, chatId: currentStore.telegramChatId }, currentStore);
            }
            setLastTransaction({ ...transactionData, id: result.id });
            setPaymentSuccess(true);
            refreshTransactions();
        } else {
            alert(`Gagal: ${result.error}`);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white px-4 py-3 sticky top-0 z-40 shadow-sm border-b">
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Cari produk..."
                            className="pl-9 bg-slate-100 border-none h-10 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-10 w-10 shrink-0 text-slate-500 bg-slate-100 hover:bg-slate-200"
                        onClick={() => fetchAllProducts && currentStore?.id && fetchAllProducts(currentStore.id)}
                    >
                        <RefreshCw size={18} />
                    </Button>
                </div>
                {/* Categories */}
                <div className="flex gap-2 overflow-x-auto mt-3 pb-2 scrollbar-hide -mx-4 px-4 items-center">
                    <Button
                        size="sm"
                        variant={activeCategory === 'Semua' ? 'default' : 'secondary'}
                        onClick={() => setActiveCategory('Semua')}
                        className={`rounded-full h-9 px-4 text-xs font-semibold whitespace-nowrap transition-all duration-300 ${activeCategory === 'Semua' ? 'bg-indigo-600 shadow-md shadow-indigo-100' : 'bg-slate-100 text-slate-600 border-none'}`}
                    >
                        Semua
                    </Button>
                    {categories.map((cat) => (
                        <Button
                            key={cat.id}
                            size="sm"
                            variant={activeCategory === cat.name ? 'default' : 'secondary'}
                            onClick={() => setActiveCategory(cat.name)}
                            className={`rounded-full h-9 px-4 text-xs font-semibold whitespace-nowrap transition-all duration-300 ${activeCategory === cat.name ? 'bg-indigo-600 shadow-md shadow-indigo-100' : 'bg-slate-100 text-slate-600 border-none'}`}
                        >
                            {typeof cat.name === 'string' ? cat.name : 'Cat'}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
                <ProductGrid products={filteredProducts} onAddToCart={hapticAddToCart} />
            </div>

            {/* Bottom Nav */}
            <MobileBottomNav
                activeTab={activeTab}
                setActiveTab={(tab) => {
                    if (tab === 'scan') setIsScannerOpen(true);
                    else setActiveTab(tab);
                }}
                cartItemCount={cart.reduce((a, b) => a + b.qty, 0)}
                onCartClick={() => setIsCartOpen(true)}
            />

            {/* Cart Sheet */}
            <MobileCartSheet
                cart={cart}
                isOpen={isCartOpen}
                onClose={() => setIsCartOpen(false)}
                updateQty={updateQty}
                clearCart={clearCart}
                totals={totals}
                handleCheckout={handleCheckout}
            />

            {/* Checkout & Scanner */}
            <CheckoutDialog
                isOpen={isCheckoutOpen}
                onClose={setIsCheckoutOpen}
                total={totals.finalTotal}
                onProcessPayment={processPayment}
                paymentSuccess={paymentSuccess}
                lastTransaction={lastTransaction}
                onPrintReceipt={() => { }} // Simple no-op or implement browser print
                onDownloadReceipt={() => { }}
                onCloseSuccess={() => { setIsCheckoutOpen(false); clearCart(); setPaymentSuccess(false); }}
                store={currentStore}
            />

            <BarcodeScannerDialog
                isOpen={isScannerOpen}
                onClose={() => setIsScannerOpen(false)}
                onScan={handleBarcodeScan}
            />
        </div>
    );
};

export default MobilePOS;
