
import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Switch } from '../../components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowLeft, Plus, X, Calculator, Sparkles } from 'lucide-react';
import { useToast } from '../../components/ui/use-toast';
import FormattedNumberInput from '../../components/ui/FormattedNumberInput';
// import { ProductPicker } from '../../components/ProductPicker'; // Unused
// import { SmartDatePicker } from '../../components/SmartDatePicker'; // Unused or use native

const PromotionForm = () => {
    const { currentStore, products, fetchAllProducts } = useData();
    const navigate = useNavigate();
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();

    // Ensure we have products to select from
    useEffect(() => {
        if (currentStore?.id) {
            fetchAllProducts(currentStore.id);
        }
    }, [currentStore?.id, fetchAllProducts]);

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        type: 'bundle', // bundle, percentage, fixed
        discount_value: 0, // amount or percentage
        target_ids: [], // product IDs for bundle
        start_date: new Date().toISOString().split('T')[0],
        end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
        is_active: true,
        min_purchase: 0,
        usage_limit: 0,
        current_usage: 0,
        allow_multiples: true // Default true for backward compatibility
    });

    const isEdit = !!id;

    // Load data if edit
    useEffect(() => {
        if (isEdit && currentStore?.id) {
            const fetchPromo = async () => {
                setLoading(true);
                try {
                    const { data, error } = await supabase
                        .from('promotions')
                        .select('*')
                        .eq('id', id)
                        .single();

                    if (error) throw error;
                    if (data) {
                        setFormData(prev => ({
                            ...prev,
                            ...data,
                            // Handle potential naming differences if any mapping was missed
                            name: data.name || data.title,
                            discount_value: data.discount_value !== undefined ? data.discount_value : data.value,
                            target_ids: data.target_ids || data.targetIds || [],
                            start_date: data.start_date ? new Date(data.start_date).toISOString().split('T')[0] : (data.startDate || prev.start_date),
                            end_date: data.end_date ? new Date(data.end_date).toISOString().split('T')[0] : (data.endDate || prev.end_date),
                            is_active: data.is_active !== undefined ? data.is_active : (data.isActive !== undefined ? data.isActive : prev.is_active),
                            min_purchase: data.min_purchase !== undefined ? data.min_purchase : (data.minPurchase !== undefined ? data.minPurchase : prev.min_purchase),
                            usage_limit: data.usage_limit !== undefined ? data.usage_limit : (data.usageLimit !== undefined ? data.usageLimit : prev.usage_limit),
                            allow_multiples: data.allow_multiples !== undefined ? data.allow_multiples : (data.allowMultiples !== undefined ? data.allowMultiples : true)
                        }));
                    }
                } catch (error) {
                    console.error("Error fetching promo:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchPromo();
        }
    }, [id, currentStore?.id, isEdit]);

    // Load from URL params (Smart Link from Market Basket Analysis)
    useEffect(() => {
        if (!isEdit && searchParams.get('type') === 'bundle') {
            const items = searchParams.get('items')?.split(',') || [];
            if (items.length > 0) {
                setFormData(prev => ({
                    ...prev,
                    name: 'Paket Bundling Spesial',
                    type: 'bundle',
                    target_ids: items
                }));
            }
        }
    }, [searchParams, isEdit]);

    // Bundle Logic
    const bundleItems = formData.target_ids.map(id => products.find(p => p.id === id)).filter(Boolean);
    const totalNormalPrice = bundleItems.reduce((acc, item) => acc + (item.sell_price || item.sellPrice || 0), 0);

    // Auto Recommendation Logic for Bundle Price
    useEffect(() => {
        // If type is bundle and we have items, and discount_value is 0 (untouched), suggest 10% off
        if (formData.type === 'bundle' && totalNormalPrice > 0 && formData.discount_value === 0 && !isEdit) {
            setFormData(prev => ({ ...prev, discount_value: totalNormalPrice * 0.9 }));
        }
    }, [formData.type, totalNormalPrice, formData.discount_value, isEdit]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name) return toast({ title: "Judul wajib diisi", variant: "destructive" });
        if (formData.type === 'bundle' && formData.target_ids.length < 2) return toast({ title: "Pilih minimal 2 produk untuk bundling", variant: "destructive" });

        setLoading(true);
        try {
            const payload = {
                ...formData,
                store_id: currentStore.id,
                updated_at: new Date().toISOString()
            };

            if (isEdit) {
                const { error } = await supabase
                    .from('promotions')
                    .update(payload)
                    .eq('id', id);
                if (error) throw error;
                toast({ title: "Promo berhasil diperbarui" });
            } else {
                const { error } = await supabase
                    .from('promotions')
                    .insert([payload]);
                if (error) throw error;
                toast({ title: "Promo berhasil dibuat" });
            }
            navigate('/promotions');
        } catch (error) {
            console.error("Error saving promo:", error);
            toast({ title: "Gagal menyimpan promo", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // Helper to add product to bundle
    const toggleProduct = (productId) => {
        setFormData(prev => {
            const exists = prev.target_ids.includes(productId);
            if (exists) {
                return { ...prev, target_ids: prev.target_ids.filter(id => id !== productId) };
            } else {
                return { ...prev, target_ids: [...prev.target_ids, productId] };
            }
        });
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/promotions')}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{isEdit ? 'Edit Promo' : 'Buat Promo Baru'}</h1>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Detail Promosi</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="space-y-2">
                            <Label>Judul Promo</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Contoh: Paket Sarapan Hemat"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tipe Promo</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={val => setFormData({ ...formData, type: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="bundle">Paket Bundling</SelectItem>
                                        <SelectItem value="percentage">Diskon Persen (%)</SelectItem>
                                        <SelectItem value="fixed">Potongan Harga (Rp)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Status</Label>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch
                                        checked={formData.is_active}
                                        onCheckedChange={val => setFormData({ ...formData, is_active: val })}
                                    />
                                    <span className="text-sm text-muted-foreground">{formData.is_active ? 'Aktif' : 'Nonaktif'}</span>
                                </div>
                            </div>
                        </div>

                        {/* Bundle Specific Selection */}
                        {formData.type === 'bundle' && (
                            <div className="space-y-4 border p-4 rounded-md bg-slate-50">
                                <div className="flex justify-between items-center">
                                    <Label>Pilih Produk untuk Dibundling</Label>
                                    <div className="relative w-1/2">
                                        <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
                                        <Input
                                            placeholder="Cari produk..."
                                            className="h-8 pl-7 text-xs bg-white"
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <div className="max-h-60 overflow-y-auto border rounded bg-white p-2 space-y-2">
                                    {products
                                        .filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()))
                                        .map(product => (
                                            <div
                                                key={product.id}
                                                className={`flex items-center justify-between p-2 rounded cursor-pointer border ${formData.target_ids.includes(product.id) ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-slate-50'}`}
                                                onClick={() => toggleProduct(product.id)}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-4 h-4 border rounded flex items-center justify-center ${formData.target_ids.includes(product.id) ? 'bg-primary border-primary' : 'border-slate-300'}`}>
                                                        {formData.target_ids.includes(product.id) && <div className="w-2 h-2 bg-white rounded-full" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{product.name}</span>
                                                </div>
                                                <span className="text-xs text-muted-foreground">Rp {(product.sell_price || product.sellPrice || 0).toLocaleString()}</span>
                                            </div>
                                        ))}
                                    {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                        <div className="text-center py-4 text-muted-foreground text-xs">
                                            Tidak ada produk ditemukan
                                        </div>
                                    )}
                                </div>

                                {bundleItems.length > 0 && (
                                    <div className="flex flex-col gap-2 border-t pt-4">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm text-muted-foreground">
                                                Total Harga Normal: <span className="font-bold text-foreground line-through decoration-slate-400">Rp {totalNormalPrice.toLocaleString()}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-medium">
                                                <div className="mr-1">✨</div>
                                                Hemat Rp {(totalNormalPrice - formData.discount_value).toLocaleString()}
                                            </div>
                                        </div>

                                        {/* Profit Analysis */}
                                        {(() => {
                                            const totalHPP = bundleItems.reduce((acc, item) => acc + (parseInt(item.buy_price || item.buyPrice || 0) || 0), 0);
                                            const profit = formData.discount_value - totalHPP;
                                            const margin = formData.discount_value > 0 ? (profit / formData.discount_value) * 100 : 0;
                                            const isLoss = profit < 0;

                                            return (
                                                <div className={`text-xs p-2 rounded border ${isLoss ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                                                    <div className="flex justify-between font-medium">
                                                        <span>Total Modal (HPP):</span>
                                                        <span>Rp {totalHPP.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between font-bold mt-1">
                                                        <span>Estimasi Laba:</span>
                                                        <span>
                                                            Rp {profit.toLocaleString()} ({margin.toFixed(1)}%)
                                                        </span>
                                                    </div>
                                                    {isLoss && (
                                                        <div className="mt-2 text-[10px] font-bold flex items-center gap-1">
                                                            ⚠️ Harga jual di bawah modal! Anda akan rugi.
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label>
                                        {formData.type === 'bundle' ? 'Harga Jual Paket (Rp)' :
                                            formData.type === 'percentage' ? 'Besar Diskon (%)' : 'Potongan (Rp)'}
                                    </Label>
                                    <div className="relative">
                                        <FormattedNumberInput
                                            value={formData.discount_value}
                                            onChange={val => setFormData({ ...formData, discount_value: val })}
                                            className="font-bold"
                                        />
                                        {/* Recommendation Helper for Bundle */}
                                        {formData.type === 'bundle' && totalNormalPrice > 0 && (
                                            <div className="absolute right-0 top-full mt-1">
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="xs"
                                                    className="h-6 text-[10px] text-primary"
                                                    onClick={() => setFormData(prev => ({ ...prev, discount_value: totalNormalPrice * 0.9 }))}
                                                >
                                                    Jual Rp {(totalNormalPrice * 0.9).toLocaleString()} (Diskon 10%)
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Minimum Purchase for Non-Bundle */}
                                {formData.type !== 'bundle' && (
                                    <div className="space-y-2">
                                        <Label>Min. Belanja (Rp)</Label>
                                        <FormattedNumberInput
                                            value={formData.min_purchase}
                                            onChange={val => setFormData({ ...formData, min_purchase: val })}
                                            placeholder="0 = Tanpa Minimum"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Deskripsi (Opsional)</Label>
                                <Input
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Ketentuan promo..."
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Tanggal Mulai</Label>
                                <Input
                                    type="date"
                                    value={formData.start_date}
                                    onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tanggal Berakhir</Label>
                                <Input
                                    type="date"
                                    value={formData.end_date}
                                    onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Batas Penggunaan (Kuota)</Label>
                            <Input
                                type="number"
                                min="0"
                                value={formData.usage_limit || ''}
                                onChange={e => setFormData({ ...formData, usage_limit: e.target.value ? parseInt(e.target.value) : 0 })}
                                placeholder="0 = Tidak Terbatas"
                            />
                            <p className="text-[10px] text-muted-foreground">Kosongkan atau isi 0 jika tidak ada batasan jumlah transaksi.</p>
                        </div>

                        <div className="space-y-2 border-t pt-2 mt-2">
                            <div className="flex items-center justify-between">
                                <Label>Berlaku Kelipatan?</Label>
                                <Switch
                                    checked={formData.allow_multiples}
                                    onCheckedChange={val => setFormData({ ...formData, allow_multiples: val })}
                                />
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Jika <b>Aktif</b>: Promo akan diterapkan berkali-kali sesuai jumlah barang (Misal: Beli 4 dapat diskon 2x). <br />
                                Jika <b>Nonaktif</b>: Promo hanya berlaku 1 kali per transaksi meski memenuhi syarat lebih banyak.
                            </p>
                        </div>

                        <div className="flex justify-end gap-4 pt-4">
                            <Button type="button" variant="outline" onClick={() => navigate('/promotions')}>
                                Batal
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {isEdit ? 'Simpan Perubahan' : 'Buat Promo'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default PromotionForm;
