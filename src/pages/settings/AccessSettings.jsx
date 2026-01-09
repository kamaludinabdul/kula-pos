import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Save, Shield } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';

const AccessSettings = () => {
    const { activeStoreId, currentStore, updateStore } = useData();
    const [permissions, setPermissions] = useState({
        admin: [],
        staff: [],
        sales: []
    });
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('staff');

    const featureGroups = [
        {
            title: 'Utama',
            features: [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'transactions', label: 'Transaksi (Lihat)' },
                { id: 'transactions.void', label: 'Batalkan Transaksi' },
                { id: 'transactions.refund', label: 'Refund Transaksi' },
                { id: 'pos', label: 'Kasir (POS)' },
            ]
        },
        {
            title: 'Databases',
            features: [
                { id: 'products.list', label: 'Produk (Daftar)' },
                { id: 'products.categories', label: 'Kategori' },
                { id: 'products.stock', label: 'Stok' },
                { id: 'products.stock_opname', label: 'Stock Opname' },
                { id: 'products.customers', label: 'Pelanggan' },
                { id: 'products.suppliers', label: 'Supplier' },
                { id: 'products.purchase_orders', label: 'Purchase Order' },
            ]
        },
        {
            title: 'Sales',
            features: [
                { id: 'sales.target', label: 'Target Sales' },
                { id: 'reports.forecast', label: 'Forecasting Penjualan (Lama)' },
                { id: 'smart_insights', label: 'Smart Strategy (AI)' },
            ]
        },
        {
            title: 'Laporan',
            features: [
                { id: 'reports.profit_loss', label: 'Laba Rugi' },
                { id: 'reports.sales_items', label: 'Penjualan Barang' },
                { id: 'reports.top_selling', label: 'Produk Terlaris' },
                { id: 'reports.sales_categories', label: 'Penjualan Kategori' },
                { id: 'reports.inventory_value', label: 'Nilai Stok (Modal)' },
                { id: 'reports.shifts', label: 'Laporan Shift' },
                { id: 'reports.expenses', label: 'Pengeluaran' },
                { id: 'reports.loyalty', label: 'Laporan Poin' },
                { id: 'reports.performance', label: 'Sales Performance' },
            ]
        },
        {
            title: 'Keuangan',
            features: [
                { id: 'finance.cash_flow', label: 'Arus Kas' },
            ]
        },
        {
            title: 'Lainnya',
            features: [
                { id: 'others.recommendations', label: 'Rekomendasi' },
                { id: 'others.staff', label: 'Kelola Staff' },
                { id: 'others.login_history', label: 'Riwayat Login' },
                { id: 'shifts.close_others', label: 'Tutup Shift Orang Lain' },
            ]
        },
        {
            title: 'Pengaturan',
            features: [
                { id: 'settings.profile', label: 'Profil Toko' },
                { id: 'settings.subscription', label: 'Langganan' },
                { id: 'settings.fees', label: 'Biaya & Pajak' },
                { id: 'settings.printer', label: 'Printer & Struk' },
                { id: 'settings.loyalty', label: 'Poin Loyalitas' },
                { id: 'settings.sales_performance', label: 'Sales Performance (Set)' },
                { id: 'settings.telegram', label: 'Notifikasi Telegram' },
                { id: 'settings.access', label: 'Hak Akses' },
            ]
        }
    ];

    useEffect(() => {
        if (currentStore) {
            setPermissions(prev => {
                const incomingData = currentStore.permissions || {
                    admin: [
                        'dashboard', 'transactions', 'pos',
                        'products.list', 'products.categories', 'products.stock', 'products.stock_opname', 'products.customers',
                        'reports.profit_loss', 'reports.sales_items', 'reports.top_selling', 'reports.sales_categories',
                        'reports.inventory_value', 'reports.shifts', 'reports.expenses', 'reports.loyalty', 'reports.performance',
                        'finance.cash_flow', 'transactions.void', 'transactions.refund',
                        'others.staff', 'others.login_history',
                        'settings.profile', 'settings.subscription', 'settings.fees', 'settings.printer',
                        'settings.loyalty', 'settings.sales_performance', 'settings.telegram', 'settings.access'
                    ],
                    staff: ['pos', 'transactions'],
                    sales: ['pos', 'transactions']
                };

                // Migration Logic: Convert broad legacy keys to specific granular keys
                const migrations = {
                    'products': 'Databases',
                    'reports': 'Laporan',
                    'settings': 'Pengaturan'
                };

                const migratedPermissions = { ...incomingData };


                Object.keys(migratedPermissions).forEach(role => {
                    let rolePerms = [...(migratedPermissions[role] || [])];
                    let roleChanged = false;

                    Object.entries(migrations).forEach(([broadKey, groupTitle]) => {
                        if (rolePerms.includes(broadKey)) {
                            // Remove the broad key
                            rolePerms = rolePerms.filter(k => k !== broadKey);

                            // Find all granular keys for this group
                            const groupFeatures = featureGroups.find(g => g.title === groupTitle)?.features || [];

                            // Add them to the role permissions
                            groupFeatures.forEach(feature => {
                                // Rule: Don't give sensitive access to staff/sales during migration
                                const isSensitive = [
                                    'products.suppliers', 'products.purchase_orders',
                                    'reports.profit_loss', 'reports.sales_categories', 'settings.access'
                                ].includes(feature.id);

                                if (role !== 'admin' && role !== 'owner' && isSensitive) {
                                    return; // Skip sensitive features for non-admins
                                }

                                if (!rolePerms.includes(feature.id)) {
                                    rolePerms.push(feature.id);
                                }
                            });
                            roleChanged = true;
                        }
                    });

                    // [NEW] Transactions Expansion
                    if (rolePerms.includes('transactions')) {
                        // Inherit only READ for existing staff/sales, Full for Admin
                        if (role === 'admin' || role === 'owner') {
                            if (!rolePerms.includes('transactions.void')) rolePerms.push('transactions.void');
                            if (!rolePerms.includes('transactions.refund')) rolePerms.push('transactions.refund');
                        }
                        // Explicitly NO void/refund for others unless manually added later
                    }

                    if (roleChanged) {
                        migratedPermissions[role] = rolePerms;

                    }
                });

                if (JSON.stringify(prev) === JSON.stringify(migratedPermissions)) {
                    return prev;
                }

                return migratedPermissions;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(currentStore?.permissions)]);

    const handlePermissionChange = (role, feature) => {
        setPermissions(prev => {
            const currentRolePermissions = prev[role] || [];
            let newRolePermissions;

            if (currentRolePermissions.includes(feature)) {
                newRolePermissions = currentRolePermissions.filter(p => p !== feature);
            } else {
                newRolePermissions = [...currentRolePermissions, feature];
            }

            return {
                ...prev,
                [role]: newRolePermissions
            };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeStoreId) return;

        setIsSaving(true);
        const result = await updateStore(activeStoreId, { permissions });
        setIsSaving(false);

        if (result.success) {
            alert('Hak akses berhasil disimpan!');
        } else {
            alert('Gagal menyimpan hak akses.');
        }
    };

    if (!currentStore) return <div>Loading...</div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <CardTitle>Hak Akses Role (Granular)</CardTitle>
                </div>
                <CardDescription>Atur hak akses secara detail untuk setiap menu dan submenu.</CardDescription>
            </CardHeader>
            <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-3 mb-4">
                        <TabsTrigger value="admin">Admin Store</TabsTrigger>
                        <TabsTrigger value="staff">Staff (Kasir)</TabsTrigger>
                        <TabsTrigger value="sales">Sales</TabsTrigger>
                    </TabsList>

                    {['admin', 'staff', 'sales'].map(role => (
                        <TabsContent key={role} value={role}>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {featureGroups.map(group => (
                                        group.features.length > 0 && (
                                            <Card key={group.title} className="bg-muted/30 border-muted">
                                                <CardHeader className="py-2 px-3">
                                                    <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{group.title}</CardTitle>
                                                </CardHeader>
                                                <CardContent className="py-2 px-3 space-y-1.5">
                                                    {group.features.map(feature => (
                                                        <label
                                                            key={feature.id}
                                                            className="flex items-start gap-2 cursor-pointer select-none"
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={(permissions[role] || []).includes(feature.id)}
                                                                onChange={() => handlePermissionChange(role, feature.id)}
                                                                className="mt-0.5 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                                            />
                                                            <span className="text-xs text-slate-700 leading-tight pt-0.5">
                                                                {feature.label}
                                                            </span>
                                                        </label>
                                                    ))}
                                                </CardContent>
                                            </Card>
                                        )
                                    ))}
                                </div>

                                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t">
                                    <p className="text-xs text-muted-foreground w-full text-center sm:text-left">
                                        *Hak akses ini berlaku instan setelah disimpan.
                                    </p>
                                    <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
                                        <Save className="h-4 w-4 mr-2" />
                                        {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                                    </Button>
                                </div>
                            </form>
                        </TabsContent>
                    ))}
                </Tabs>
            </CardContent>
        </Card>
    );
};

export default AccessSettings;
