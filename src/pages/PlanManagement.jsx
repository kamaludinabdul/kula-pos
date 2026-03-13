import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { cn } from '../lib/utils';
import {
    Plus, Trash2, Edit, Save, X, Check, Crown,
    Settings, Shield, BarChart3, Package, Layers,
    TrendingUp, Send, Gift, Lock, DollarSign
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Checkbox } from '../components/ui/checkbox';
import AlertDialog from '../components/AlertDialog';

const PlanManagement = () => {
    const { plans: contextPlans, updatePlans } = useData();
    const [plans, setPlans] = useState({});
    const [selectedBusinessType, setSelectedBusinessType] = useState('general');
    const [isEditing, setIsEditing] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

    const BUSINESS_TYPES_LIST = [
        { id: 'general', label: 'Toko (Retail)' },
        { id: 'fnb', label: 'F&B' },
        { id: 'pharmacy', label: 'Apotek' },
        { id: 'laundry', label: 'Laundry' },
        { id: 'rental', label: 'Rental' }
    ];

    // Features list for mapping - Aligned with REQUIRED_PLANS in plans.js and Sidebar.jsx
    const FEATURE_LIST = [
        { id: 'reports.profit_loss', label: 'Laba Rugi', group: 'Reports' },
        { id: 'reports.cash_flow', label: 'Arus Kas', group: 'Reports' },
        { id: 'reports.inventory_value', label: 'Nilai Stok', group: 'Reports' },
        { id: 'reports.shifts', label: 'Laporan Shift', group: 'Reports' },
        { id: 'reports.sales_forecast', label: 'Prediksi Omset', group: 'Reports' },
        { id: 'reports.top_selling', label: 'Produk Terlaris', group: 'Reports' },

        { id: 'products.stock_opname', label: 'Stock Opname', group: 'Inventory' },
        { id: 'products.stock_history', label: 'History Stok', group: 'Inventory' },
        { id: 'products.customers', label: 'Database Pelanggan', group: 'Inventory' },

        { id: 'staff.login_history', label: 'Riwayat Login Staff', group: 'Staff' },
        { id: 'staff.sales_target', label: 'Target Penjualan', group: 'Staff' },

        { id: 'settings.loyalty', label: 'Poin Loyalitas & Laporan', group: 'Settings' },
        { id: 'settings.telegram', label: 'Notifikasi Telegram', group: 'Settings' },
        { id: 'settings.sales_performance', label: 'Performance (Settings & Laporan)', group: 'Settings' },

        { id: 'features.shopping_recommendations', label: 'Smart Recommendations', group: 'Advanced' },
        { id: 'smart_insights', label: 'Smart Insights (AI Bundling & Forecast)', group: 'Advanced' },
        { id: 'rental', label: 'Mode Rental/Sewa (Playstation/Billiard)', group: 'Advanced' },

        { id: 'pharmacy.prescriptions', label: 'Apotek: Resep & Pasien', group: 'Pharmacy' },
        { id: 'pharmacy.multi_unit', label: 'Apotek: Multi-Satuan (Box/Strip)', group: 'Pharmacy' }
    ];

    // Initialize plans once when contextPlans becomes available
    if (contextPlans && Object.keys(plans).length === 0 && Object.keys(contextPlans).length > 0) {
        setPlans(JSON.parse(JSON.stringify(contextPlans)));
    }

    const showAlert = (title, message) => {
        setAlertData({ title, message });
        setIsAlertOpen(true);
    };

    // Filtered plans based on business type
    // If businessType is 'general', we show 'free', 'pro', 'enterprise'
    // If businessType is 'pharmacy', we show 'pharmacy_free', 'pharmacy_pro', 'pharmacy_enterprise'
    // if they don't exist, we can offer to "Clone from General"
    const getActivePlans = () => {
        const baseIds = ['free', 'pro', 'enterprise'];
        const active = {};

        baseIds.forEach(id => {
            const fullId = selectedBusinessType === 'general' ? id : `${selectedBusinessType}_${id}`;
            if (plans[fullId]) {
                active[id] = plans[fullId];
            } else {
                // Return a placeholder or the general plan if missing
                active[id] = plans[id] ? { ...plans[id], isPlaceholder: true, id: fullId } : null;
            }
        });
        return active;
    };

    const handleUpdateActivePlan = (baseId, field, value) => {
        if (!isEditing) return;
        const fullId = selectedBusinessType === 'general' ? baseId : `${selectedBusinessType}_${baseId}`;

        setPlans(prev => ({
            ...prev,
            [fullId]: {
                ...(prev[fullId] || prev[baseId] || {}),
                id: fullId,
                business_type: selectedBusinessType,
                [field]: value,
                isPlaceholder: false
            }
        }));
    };

    const handleFeatureToggle = (baseId, featureId) => {
        if (!isEditing) return;
        const fullId = selectedBusinessType === 'general' ? baseId : `${selectedBusinessType}_${baseId}`;

        const currentFeatures = (plans[fullId] || plans[baseId] || {}).features || [];
        let newFeatures;
        if (currentFeatures.includes(featureId)) {
            newFeatures = currentFeatures.filter(f => f !== featureId);
        } else {
            newFeatures = [...currentFeatures, featureId];
        }

        handleUpdateActivePlan(baseId, 'features', newFeatures);
    };

    const handleSave = async () => {
        // Prepare data for updatePlans (it expects an object of plans)
        // We only save modified/non-placeholder plans
        const toSave = {};
        Object.keys(plans).forEach(id => {
            if (!plans[id].isPlaceholder) {
                toSave[id] = plans[id];
            }
        });

        const result = await updatePlans(toSave);
        if (result.success) {
            setIsEditing(false);
            showAlert('Berhasil', 'Pengaturan paket langganan telah diperbarui.');
        } else {
            showAlert('Gagal', `Terjadi kesalahan saat menyimpan pengaturan: ${result.error?.message || 'Check Console'}`);
        }
    };

    const cancelEdit = () => {
        setPlans(JSON.parse(JSON.stringify(contextPlans)));
        setIsEditing(false);
    };

    if (!plans || Object.keys(plans).length === 0) {
        return <div className="p-4 text-center">Memuat data paket...</div>;
    }

    const activePlans = getActivePlans();

    return (
        <div className="p-4 w-full space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manajemen Paket & Fitur</h1>
                    <p className="text-muted-foreground mt-1">
                        Atur harga, nama paket, dan fitur per tipe bisnis.
                    </p>
                </div>
                <div className="flex gap-2">
                    {!isEditing ? (
                        <Button onClick={() => setIsEditing(true)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit Pengaturan
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={cancelEdit}>
                                <X className="h-4 w-4 mr-2" />
                                Batal
                            </Button>
                            <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                                <Save className="h-4 w-4 mr-2" />
                                Simpan Perubahan
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Business Type Selector Tabs */}
            <div className="flex flex-wrap gap-2 border-b pb-4">
                {BUSINESS_TYPES_LIST.map(bt => (
                    <Button
                        key={bt.id}
                        variant={selectedBusinessType === bt.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => !isEditing && setSelectedBusinessType(bt.id)}
                        disabled={isEditing}
                        className={selectedBusinessType === bt.id ? "bg-indigo-600" : ""}
                    >
                        {bt.label}
                    </Button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(activePlans).map(([baseId, plan]) => (
                    <Card key={baseId} className={cn(
                        baseId === 'enterprise' ? 'border-indigo-200' : '',
                        plan.isPlaceholder && "opacity-60 grayscale-[0.5]"
                    )}>
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <Badge variant={baseId === 'free' ? 'secondary' : 'default'} className={
                                    baseId === 'pro' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                        baseId === 'enterprise' ? 'bg-indigo-600 hover:bg-indigo-700' : ''
                                }>
                                    {baseId.toUpperCase()} {plan.isPlaceholder && "(Default)"}
                                </Badge>
                                <Crown size={20} className={
                                    baseId === 'pro' ? 'text-blue-500' :
                                        baseId === 'enterprise' ? 'text-indigo-600' : 'text-slate-300'
                                } />
                            </div>
                            <div className="mt-2">
                                {isEditing ? (
                                    <Input
                                        value={plan.label}
                                        onChange={(e) => handleUpdateActivePlan(baseId, 'label', e.target.value)}
                                        className="text-lg font-bold"
                                        placeholder={`e.g. ${selectedBusinessType.toUpperCase()} ${baseId.toUpperCase()}`}
                                    />
                                ) : (
                                    <CardTitle>{plan.label}</CardTitle>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Harga Bulanan (Rp)</Label>
                                {isEditing ? (
                                    <Input
                                        type="number"
                                        value={plan.price ?? ''}
                                        onChange={(e) => handleUpdateActivePlan(baseId, 'price', e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                ) : (
                                    <p className="text-2xl font-bold">
                                        {plan.price === 0 ? 'Gratis' : `Rp ${plan.price?.toLocaleString('id-ID')}`}
                                    </p>
                                )}

                                {baseId === 'pro' && (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Original Price (Strikeout)</Label>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                value={plan.originalPrice ?? ''}
                                                onChange={(e) => handleUpdateActivePlan(baseId, 'originalPrice', e.target.value === '' ? '' : Number(e.target.value))}
                                                className="h-8 text-xs"
                                            />
                                        ) : plan.originalPrice && (
                                            <p className="text-sm text-muted-foreground line-through">
                                                Rp {plan.originalPrice.toLocaleString('id-ID')}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                                <div className="space-y-2">
                                    <Label className="text-xs">Max Produk</Label>
                                    {isEditing ? (
                                        <div className="space-y-1">
                                            <Input
                                                type="number"
                                                value={plan.maxProducts ?? ''}
                                                onChange={(e) => handleUpdateActivePlan(baseId, 'maxProducts', e.target.value === '' ? null : parseInt(e.target.value))}
                                                className="h-8 text-sm"
                                                placeholder="e.g. 100"
                                            />
                                            <p className="text-[10px] text-muted-foreground">-1 = Tanpa Batas</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-semibold">
                                            {plan.maxProducts === -1 ? 'Unlimited' : (plan.maxProducts ?? 'Not set')}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs">Max User/Staff</Label>
                                    {isEditing ? (
                                        <div className="space-y-1">
                                            <Input
                                                type="number"
                                                value={plan.maxUsers ?? ''}
                                                onChange={(e) => handleUpdateActivePlan(baseId, 'maxUsers', e.target.value === '' ? null : parseInt(e.target.value))}
                                                className="h-8 text-sm"
                                                placeholder="e.g. 5"
                                            />
                                            <p className="text-[10px] text-muted-foreground">-1 = Tanpa Batas</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-semibold">
                                            {plan.maxUsers === -1 ? 'Unlimited' : (plan.maxUsers ?? 'Not set')}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 gap-4 pt-0 border-t-0">
                                <div className="space-y-2">
                                    <Label className="text-xs">Max Toko</Label>
                                    {isEditing ? (
                                        <div className="space-y-1">
                                            <Input
                                                type="number"
                                                value={plan.maxStores ?? ''}
                                                onChange={(e) => handleUpdateActivePlan(baseId, 'maxStores', e.target.value === '' ? null : parseInt(e.target.value))}
                                                className="h-8 text-sm"
                                                placeholder="e.g. 1"
                                            />
                                            <p className="text-[10px] text-muted-foreground">-1 = Tanpa Batas</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm font-semibold">
                                            {plan.maxStores === -1 ? 'Unlimited' : (plan.maxStores ?? 'Not set')}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="font-semibold text-sm">Akses Fitur</h3>
                                {['Reports', 'Inventory', 'Staff', 'Settings', 'Advanced', 'Pharmacy'].map(group => {
                                    const features = FEATURE_LIST.filter(f => f.group === group);
                                    if (features.length === 0) return null;

                                    return (
                                        <div key={group} className="space-y-2">
                                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">{group}</p>
                                            <div className="space-y-3">
                                                {features.map(feature => (
                                                    <div key={feature.id} className="flex items-start space-x-2">
                                                        <Checkbox
                                                            id={`${baseId}-${feature.id}`}
                                                            checked={(plan.features || []).includes(feature.id)}
                                                            onCheckedChange={() => handleFeatureToggle(baseId, feature.id)}
                                                            disabled={!isEditing}
                                                        />
                                                        <label
                                                            htmlFor={`${baseId}-${feature.id}`}
                                                            className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                        >
                                                            {feature.label}
                                                        </label>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <AlertDialog
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertData.title}
                message={alertData.message}
            />
        </div>
    );
};

export default PlanManagement;
