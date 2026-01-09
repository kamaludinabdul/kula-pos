import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
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
    const { user } = useAuth();
    const [plans, setPlans] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });

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
        { id: 'rental', label: 'Mode Rental/Sewa (Playstation/Billiard)', group: 'Advanced' }
    ];

    useEffect(() => {
        if (contextPlans && Object.keys(plans).length === 0) {
            Promise.resolve().then(() => {
                setPlans(JSON.parse(JSON.stringify(contextPlans)));
            });
        }
    }, [contextPlans, plans]);

    const showAlert = (title, message) => {
        setAlertData({ title, message });
        setIsAlertOpen(true);
    };

    const handleLimitChange = (planId, field, value) => {
        if (!isEditing) return;
        setPlans(prevPlans => ({
            ...prevPlans,
            [planId]: {
                ...prevPlans[planId],
                [field]: value === '' ? null : parseInt(value)
            }
        }));
    };

    const handleFeatureToggle = (planId, featureId) => {
        if (!isEditing) return;

        setPlans(prevPlans => {
            const plan = prevPlans[planId];
            const currentFeatures = plan.features || [];

            let newFeatures;
            if (currentFeatures.includes(featureId)) {
                newFeatures = currentFeatures.filter(f => f !== featureId);
            } else {
                newFeatures = [...currentFeatures, featureId];
            }

            return {
                ...prevPlans,
                [planId]: {
                    ...plan,
                    features: newFeatures
                }
            };
        });
    };

    const handlePriceChange = (planId, field, value) => {
        if (!isEditing) return;
        setPlans(prevPlans => ({
            ...prevPlans,
            [planId]: {
                ...prevPlans[planId],
                [field]: value === '' ? '' : Number(value)
            }
        }));
    };

    const handleLabelChange = (planId, value) => {
        if (!isEditing) return;
        setPlans(prevPlans => ({
            ...prevPlans,
            [planId]: {
                ...prevPlans[planId],
                label: value
            }
        }));
    };

    const handleSave = async () => {
        const result = await updatePlans(plans);
        if (result.success) {
            setIsEditing(false);
            showAlert('Berhasil', 'Pengaturan paket langganan telah diperbarui.');
        } else {
            console.error("Save failure details:", result.error);
            showAlert('Gagal', `Terjadi kesalahan saat menyimpan pengaturan: ${result.error?.message || 'Permission Denied'}`);
        }
    };

    const cancelEdit = () => {
        setPlans(JSON.parse(JSON.stringify(contextPlans)));
        setIsEditing(false);
    };

    if (!plans || Object.keys(plans).length === 0) {
        return <div className="p-8 text-center">Memuat data paket...</div>;
    }

    return (
        <div className="p-6 w-full space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Manajemen Paket & Fitur</h1>
                    <p className="text-muted-foreground mt-1">
                        Atur harga, nama paket, dan fitur yang dapat diakses oleh setiap level langganan.
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-[10px] bg-slate-100 p-1 px-2 rounded w-fit text-slate-500 font-mono">
                        <span className="font-bold text-indigo-600">DEBUG CONSOLE:</span>
                        <span className="cursor-pointer hover:underline" onClick={() => {
                            navigator.clipboard.writeText(user?.id || user?.uid);
                            showAlert('Copied', 'UID telah disalin ke clipboard');
                        }}>UID: {user?.id || user?.uid} (Klik untuk salin)</span>
                        <span className="opacity-30">|</span>
                        <span className={user?.role === 'super_admin' ? 'text-green-600 font-bold' : 'text-red-600 font-bold underline animate-pulse'}>
                            Role: {user?.role || 'NOT LOGGED IN'}
                        </span>
                    </div>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(plans).map(([id, plan]) => (
                    <Card key={id} className={id === 'enterprise' ? 'border-indigo-200' : ''}>
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <Badge variant={id === 'free' ? 'secondary' : 'default'} className={
                                    id === 'pro' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                        id === 'enterprise' ? 'bg-indigo-600 hover:bg-indigo-700' : ''
                                }>
                                    {id.toUpperCase()}
                                </Badge>
                                <Crown size={20} className={
                                    id === 'pro' ? 'text-blue-500' :
                                        id === 'enterprise' ? 'text-indigo-600' : 'text-slate-300'
                                } />
                            </div>
                            <div className="mt-2">
                                {isEditing ? (
                                    <Input
                                        value={plan.label}
                                        onChange={(e) => handleLabelChange(id, e.target.value)}
                                        className="text-lg font-bold"
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
                                        onChange={(e) => handlePriceChange(id, 'price', e.target.value)}
                                    />
                                ) : (
                                    <p className="text-2xl font-bold">
                                        {plan.price === 0 ? 'Gratis' : `Rp ${plan.price?.toLocaleString('id-ID')}`}
                                    </p>
                                )}

                                {id === 'pro' && (
                                    <div className="space-y-1">
                                        <Label className="text-xs text-muted-foreground">Original Price (Strikeout)</Label>
                                        {isEditing ? (
                                            <Input
                                                type="number"
                                                value={plan.originalPrice ?? ''}
                                                onChange={(e) => handlePriceChange(id, 'originalPrice', e.target.value)}
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
                                                onChange={(e) => handleLimitChange(id, 'maxProducts', e.target.value)}
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
                                                onChange={(e) => handleLimitChange(id, 'maxUsers', e.target.value)}
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

                            <div className="space-y-4 pt-4 border-t">
                                <h3 className="font-semibold text-sm">Akses Fitur</h3>
                                {['Reports', 'Inventory', 'Staff', 'Settings', 'Advanced'].map(group => (
                                    <div key={group} className="space-y-2">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider font-mono">{group}</p>
                                        <div className="space-y-3">
                                            {FEATURE_LIST.filter(f => f.group === group).map(feature => (
                                                <div key={feature.id} className="flex items-start space-x-2">
                                                    <Checkbox
                                                        id={`${id}-${feature.id}`}
                                                        checked={(plan.features || []).includes(feature.id)}
                                                        onCheckedChange={() => handleFeatureToggle(id, feature.id)}
                                                        disabled={!isEditing}
                                                    />
                                                    <label
                                                        htmlFor={`${id}-${feature.id}`}
                                                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                                    >
                                                        {feature.label}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
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
