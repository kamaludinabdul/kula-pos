import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useData } from '../../context/DataContext';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Check, Crown, Zap, Shield, FileText, Loader2, Eye } from 'lucide-react';
import { supabase } from '../../supabase';
import dayjs from 'dayjs';

import CheckoutDialog from './components/CheckoutDialog';
import InvoiceDialog from './components/InvoiceDialog';

// Lazy load ReuploadDialog to avoid blocking main thread/bundle size on initial load
const ReuploadDialog = React.lazy(() => import('./components/ReuploadDialog'));

const SubscriptionSettings = () => {
    const { currentStore, plans: contextPlans } = useData();
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);

    // History State
    const [invoices, setInvoices] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [isInvoiceOpen, setIsInvoiceOpen] = useState(false);

    // Re-upload State
    const [isReuploadOpen, setIsReuploadOpen] = useState(false);
    const [reuploadInvoice, setReuploadInvoice] = useState(null);

    // console.log("DEBUG SubscriptionSettings: contextPlans", contextPlans);
    // console.log("DEBUG SubscriptionSettings: currentStore", currentStore);

    const currentPlanId = currentStore?.plan || 'free';

    // Use useCallback to stabilize the function reference
    const fetchHistory = useCallback(async () => {
        if (!currentStore?.id) return;
        try {
            setLoadingHistory(true);
            const { data, error } = await supabase
                .from('subscription_invoices')
                .select('*')
                .eq('store_id', currentStore.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setInvoices(data || []);
        } catch (error) {
            console.error("Error fetching subscription history:", error);
        } finally {
            setLoadingHistory(false);
        }
    }, [currentStore?.id]);

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Helper to format price
    const formatPrice = (price) => {
        if (price === 0) return 'Gratis';
        if (typeof price === 'string') return price;
        return `Rp ${price?.toLocaleString('id-ID')}`;
    };

    // Features list for mapping - Aligned with PlanManagement.jsx
    const FEATURE_LIST = {
        'reports.profit_loss': 'Laba Rugi',
        'reports.cash_flow': 'Arus Kas',
        'reports.inventory_value': 'Nilai Stok',
        'reports.shifts': 'Laporan Shift',
        'reports.sales_forecast': 'Prediksi Omset',
        'reports.top_selling': 'Produk Terlaris',
        'products.stock_opname': 'Stock Opname',
        'products.stock_history': 'History Stok',
        'products.customers': 'Database Pelanggan',
        'staff.login_history': 'Riwayat Login Staff',
        'staff.sales_target': 'Target Penjualan',
        'settings.loyalty': 'Poin Loyalitas & Laporan',
        'settings.telegram': 'Notifikasi Telegram',
        'settings.sales_performance': 'Performance',
        'features.shopping_recommendations': 'Smart Recommendations',
        'smart_insights': 'Smart Insights',
        'rental': 'Mode Rental/Sewa'
    };

    // Base metadata for plans (Icons, Colors, Descriptions)
    const basePlans = [
        {
            id: 'free',
            icon: Zap,
            color: 'text-slate-600',
            bgColor: 'bg-slate-100',
            btnVariant: 'outline',
            description: 'Untuk usaha kecil yang baru memulai.'
        },
        {
            id: 'pro',
            icon: Crown,
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50',
            btnVariant: 'default',
            popular: true,
            description: 'Untuk usaha berkembang dengan kebutuhan lebih.'
        },
        {
            id: 'enterprise',
            icon: Shield,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            btnVariant: 'outline',
            description: 'Solusi lengkap untuk bisnis skala besar.'
        }
    ];

    const displayPlans = basePlans.map(base => {
        // Get dynamic data from context, fallback to defaults if strictly needed (though context should have it)
        const dynamic = contextPlans?.[base.id] || {};

        // Construct features list dynamically
        const features = [];

        // Users
        const users = dynamic.maxUsers ?? (base.id === 'free' ? 2 : (base.id === 'pro' ? 5 : -1));
        if (users === -1) features.push('Unlimited User');
        else features.push(`${users} User (Admin/Kasir/Staff)`);

        // Products
        const products = dynamic.maxProducts ?? (base.id === 'free' ? 100 : -1);
        if (products === -1) features.push('Unlimited Produk');
        else features.push(`${products} Produk`);

        // Check for dynamic features from the plan
        if (dynamic.features && Array.isArray(dynamic.features)) {
            dynamic.features.forEach(featureId => {
                if (FEATURE_LIST[featureId]) {
                    features.push(FEATURE_LIST[featureId]);
                }
            });
        }

        // Fallback features if dynamic features are empty (e.g. initial load or legacy)
        // Only add defaults if NO dynamic features are present to avoid duplication/confusion
        if (!dynamic.features || dynamic.features.length === 0) {
            if (base.id === 'free') {
                features.push('Laporan Dasar');
                features.push('Struk Digital');
            } else if (base.id === 'pro') {
                features.push('Laporan Lengkap (Laba Rugi)');
                features.push('Manajemen Stok');
                features.push('Export Laporan');
            } else if (base.id === 'enterprise') {
                features.push('Multi Cabang');
                features.push('API Access');
                features.push('Prioritas Support 24/7');
            }
        }

        return {
            ...base,
            name: dynamic.label || (base.id.charAt(0).toUpperCase() + base.id.slice(1)),
            price: formatPrice(dynamic.price ?? (base.id === 'free' ? 0 : (base.id === 'pro' ? 0 : 'Hubungi Kami'))),
            originalPrice: dynamic.originalPrice ? `Rp ${dynamic.originalPrice.toLocaleString('id-ID')}` : null,
            period: (dynamic.price > 0 || base.id === 'pro') ? '/bln' : '', // Show /bln even for Rp 0 Pro if it's a sub
            features: features,
            priceValue: dynamic.price // Store raw price for calculation logic
        };
    });

    const handleUpgrade = (plan) => {
        setSelectedPlan(plan);
        setIsCheckoutOpen(true);
    };

    const handleViewInvoice = (invoice) => {
        setSelectedInvoice(invoice);
        setIsInvoiceOpen(true);
    };

    const handleReupload = (invoice) => {
        setReuploadInvoice(invoice);
        setIsReuploadOpen(true);
    };

    const handleReuploadSuccess = () => {
        fetchHistory(); // Refresh list to show pending status
    };

    const statusBadge = (status) => {
        switch (status) {
            case 'approved':
            case 'paid':
                return <Badge variant="success-subtle">Aktif/Lunas</Badge>;
            case 'pending':
                return <Badge variant="warning-subtle">Menunggu Verifikasi</Badge>;
            case 'failed':
                return <Badge variant="destructive-subtle">Gagal</Badge>;
            case 'expired':
                return <Badge variant="secondary-subtle">Kadaluarsa</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="space-y-10">
            {/* Pricing Section */}
            <div className="space-y-6">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Langganan & Paket</h2>
                    <p className="text-muted-foreground">
                        Pilih paket yang sesuai dengan kebutuhan bisnis Anda.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {displayPlans.map((plan) => {
                        const Icon = plan.icon;
                        const isCurrent = currentPlanId === plan.id;

                        return (
                            <Card
                                key={plan.id}
                                className={`relative flex flex-col ${isCurrent ? 'border-indigo-600 ring-1 ring-indigo-600 shadow-lg' : ''} ${plan.popular ? 'shadow-md' : ''}`}
                            >
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                            Paling Laris
                                        </span>
                                    </div>
                                )}

                                <CardHeader>
                                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${plan.bgColor}`}>
                                        <Icon className={`h-6 w-6 ${plan.color}`} />
                                    </div>
                                    <CardTitle className="flex items-baseline gap-2">
                                        {plan.name}
                                        {isCurrent && <Badge variant="secondary" className="ml-auto">Aktif</Badge>}
                                    </CardTitle>
                                    {isCurrent && currentStore?.planExpiryDate && (
                                        <div className="text-xs text-amber-600 font-medium mb-1">
                                            Berakhir: {new Date(currentStore.planExpiryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                        </div>
                                    )}
                                    <CardDescription>{plan.description}</CardDescription>
                                </CardHeader>

                                <CardContent className="flex-1">
                                    <div className="mb-6">
                                        {plan.originalPrice && (
                                            <div className="text-sm text-muted-foreground line-through">
                                                {plan.originalPrice}
                                            </div>
                                        )}
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-3xl font-bold">{plan.price}</span>
                                            {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                                        </div>
                                    </div>
                                    <ul className="space-y-3 text-sm">
                                        {plan.features.map((feature, i) => (
                                            <li key={i} className="flex items-center gap-2 text-slate-600">
                                                <Check className="h-4 w-4 text-green-500 shrink-0" />
                                                {feature}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>

                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        variant={isCurrent ? "secondary" : plan.btnVariant}
                                        disabled={isCurrent}
                                        onClick={() => handleUpgrade(plan)}
                                    >
                                        {isCurrent ? 'Paket Saat Ini' : 'Pilih Paket'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* History Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 bg-slate-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold tracking-tight">Riwayat Langganan</h3>
                        <p className="text-sm text-muted-foreground">
                            Semua tagihan dan riwayat pembelian paket Anda.
                        </p>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>No. Invoice</TableHead>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Paket</TableHead>
                                <TableHead className="text-center">Durasi</TableHead>
                                <TableHead className="text-right">Jumlah</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loadingHistory ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                                        Belum ada riwayat pembelian.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                invoices.map((invoice) => (
                                    <TableRow key={invoice.id}>
                                        <TableCell className="font-medium font-mono">
                                            {invoice.unique_code
                                                ? `INV-${dayjs(invoice.created_at).format('YYYYMM')}-${invoice.unique_code}`
                                                : invoice.id.slice(0, 8).toUpperCase()
                                            }
                                        </TableCell>
                                        <TableCell>
                                            {dayjs(invoice.created_at).format('DD MMM YYYY, HH:mm')}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {invoice.plan_id}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {invoice.duration_months} Bulan
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            Rp {invoice.amount.toLocaleString('id-ID')}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {statusBadge(invoice.status)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                {invoice.status === 'failed' && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-600 border-red-200 hover:bg-red-50"
                                                        onClick={() => handleReupload(invoice)}
                                                    >
                                                        Perbaiki
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleViewInvoice(invoice)}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    Lihat
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <CheckoutDialog
                isOpen={isCheckoutOpen}
                onClose={() => setIsCheckoutOpen(false)}
                plan={selectedPlan}
            />

            <InvoiceDialog
                isOpen={isInvoiceOpen}
                onClose={() => setIsInvoiceOpen(false)}
                invoice={selectedInvoice}
            />

            <Suspense fallback={null}>
                {isReuploadOpen && (
                    <ReuploadDialog
                        isOpen={isReuploadOpen}
                        onClose={() => setIsReuploadOpen(false)}
                        invoice={reuploadInvoice}
                        onSuccess={handleReuploadSuccess}
                    />
                )}
            </Suspense>
        </div>
    );
};

export default SubscriptionSettings;
