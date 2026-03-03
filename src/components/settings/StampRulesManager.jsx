import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Edit, Trash2, Plus, AlertCircle, Loader2 } from 'lucide-react';
import AlertDialog from '../AlertDialog';
import ConfirmDialog from '../ConfirmDialog';
import ProductSelectorDialog from './ProductSelectorDialog';

const StampRulesManager = () => {
    const { currentStore, fetchLoyaltyRules, saveLoyaltyRule, deleteLoyaltyRule, products, categories, fetchAllProducts } = useData();
    const [rules, setRules] = useState([]);
    const [loading, setLoading] = useState(true);

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isProductDialogVisible, setIsProductDialogVisible] = useState(false);
    const [ruleToDelete, setRuleToDelete] = useState(null);
    const [editingRule, setEditingRule] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [alertData, setAlertData] = useState({ open: false, title: '', message: '' });

    const defaultForm = {
        name: '',
        rule_type: 'stamp_card',
        product_ids: [],
        stamp_target: 10,
        stamp_reward_points: 0,
        isActive: true
    };

    const [formData, setFormData] = useState(defaultForm);

    const loadRules = React.useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchLoyaltyRules(currentStore.id);
            setRules(data ? data.filter(r => r.rule_type === 'stamp_card') : []);

            // Ensure products are loaded for the dropdown
            if (!products || products.length === 0) {
                await fetchAllProducts();
            }
        } catch (error) {
            console.error("Failed to load rules", error);
        } finally {
            setLoading(false);
        }
    }, [currentStore?.id, fetchLoyaltyRules, fetchAllProducts, products]);

    useEffect(() => {
        if (currentStore?.id) {
            loadRules();
        }
    }, [currentStore?.id, loadRules]);

    const handleOpenForm = (rule = null) => {
        if (rule) {
            setEditingRule(rule);
            setFormData({
                id: rule.id,
                name: rule.name,
                rule_type: 'stamp_card',
                product_ids: rule.product_ids || [],
                points_earned: rule.points_earned || 0,
                stamp_target: rule.stamp_target || 10,
                stamp_reward_points: rule.stamp_reward_points || 0,
                isActive: rule.is_active
            });
        } else {
            setEditingRule(null);
            setFormData(defaultForm);
        }
        setIsFormOpen(true);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.product_ids || formData.product_ids.length === 0) {
            setAlertData({ open: true, title: 'Validasi', message: 'Silakan isi nama program dan pilih minimal satu produk.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const ruleToSave = {
                name: formData.name,
                rule_type: 'stamp_card',
                product_ids: formData.product_ids,
                points_per_item: 0,
                stamp_target: Number(formData.stamp_target),
                stamp_reward_points: Number(formData.stamp_reward_points),
                is_active: formData.isActive
            };

            const result = await saveLoyaltyRule({ ...ruleToSave, id: editingRule?.id });
            if (result.success) {
                setIsFormOpen(false);
                loadRules();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            setAlertData({ open: true, title: 'Error', message: error.message || 'Gagal menyimpan aturan' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!ruleToDelete) return;
        try {
            const result = await deleteLoyaltyRule(ruleToDelete.id);
            if (result.success) {
                loadRules();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            setAlertData({ open: true, title: 'Error', message: error.message || 'Gagal menghapus aturan' });
        } finally {
            setIsConfirmOpen(false);
            setRuleToDelete(null);
        }
    };

    const disabledProductIds = useMemo(() => {
        return rules
            .filter(r => r.id !== formData?.id)
            .reduce((acc, r) => {
                if (r.product_ids && Array.isArray(r.product_ids)) {
                    return [...acc, ...r.product_ids];
                }
                return acc;
            }, []);
    }, [rules, formData?.id]);

    return (
        <Card className="mt-4 border-slate-200 shadow-sm">
            <CardHeader className="bg-slate-50/50 rounded-t-lg pb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-lg">Daftar Aturan Stamp</CardTitle>
                        <CardDescription>
                            Kelola produk apa saja yang mendapatkan stamp.
                        </CardDescription>
                    </div>
                    <Button type="button" onClick={() => handleOpenForm()}>
                        <Plus className="h-4 w-4 mr-2" /> Tambah Aturan
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-400" /></div>
                ) : rules.length === 0 ? (
                    <div className="text-center p-8 border border-dashed rounded-lg bg-slate-50">
                        <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-600 mb-4">Belum ada aturan khusus atau stamp yang dibuat.</p>
                        <Button type="button" variant="outline" onClick={() => handleOpenForm()}>Buat Sekarang</Button>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nama Program / Aturan</TableHead>
                                    <TableHead>Produk Terkait</TableHead>
                                    <TableHead>Target/Reward</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules.map(rule => {
                                    const productName = products.find(p => rule.product_ids?.includes(p.id))?.name || "Banyak produk";
                                    return (
                                        <TableRow key={rule.id}>
                                            <TableCell className="font-semibold">{rule.name}</TableCell>
                                            <TableCell className="text-sm">
                                                {productName}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <span className="text-slate-600">{rule.stamp_target} Cap ➔ Penukaran Fisik</span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={rule.is_active ? 'default' : 'secondary'} className={rule.is_active ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}>
                                                    {rule.is_active ? 'Aktif' : 'Nonaktif'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => handleOpenForm(rule)}>
                                                        <Edit className="h-4 w-4 text-slate-500" />
                                                    </Button>
                                                    <Button type="button" variant="ghost" size="icon" onClick={() => { setRuleToDelete(rule); setIsConfirmOpen(true); }}>
                                                        <Trash2 className="h-4 w-4 text-red-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            {/* Form Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingRule ? 'Edit Aturan' : 'Tambah Aturan Baru'}</DialogTitle>
                        <DialogDescription className="hidden">Dialog untuk mengelola aturan loyalitas per produk atau cap.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Nama Program / Promo</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Cth: Promo Kopi Gratis, Poin Susu Bayi, dll"
                            />
                        </div>

                        <div className="grid gap-2 hidden">
                            <Label>Tipe Aturan</Label>
                            <Input value="Program Kartu Stamp" disabled />
                        </div>

                        <div className="grid gap-2 relative">
                            <Label>Pilih Produk Syarat</Label>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-between"
                                onClick={() => setIsProductDialogVisible(true)}
                            >
                                {formData.product_ids && formData.product_ids.length > 0
                                    ? `${formData.product_ids.length} Produk Terpilih`
                                    : "-- Pilih Produk Syarat --"}
                            </Button>
                        </div>

                        <div className="space-y-4 bg-amber-50/50 p-3 rounded-md border border-amber-100">
                            <div className="grid gap-2">
                                <Label>Berapa stamp target untuk dapat hadiah?</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={formData.stamp_target}
                                    onChange={e => setFormData({ ...formData, stamp_target: e.target.value })}
                                    placeholder="Cth: 10"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Berapa kali pembeli harus beli salah satu produk ini sampai penuh?</p>
                            </div>
                            <div className="bg-white p-3 rounded text-xs border border-amber-200">
                                <p className="text-amber-800 font-medium">Informasi Kado/Reward:</p>
                                <p className="text-amber-700/80 mt-1">Saat target stamp tercapai, kasir bertugas menukarkannya dengan hadiah langsung (misal: kopi gratis) dan akan dicatat di sistem.</p>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="active_checkbox"
                                className="h-4 w-4 rounded border-gray-300"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                            />
                            <Label htmlFor="active_checkbox">Aturan Aktif</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                        <Button type="button" onClick={handleSave} disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Simpan Aturan
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleDelete}
                title="Hapus Aturan"
                description={`Yakin ingin menghapus program "${ruleToDelete?.name}"? Aksi ini tidak bisa diubah.`}
            />

            <AlertDialog
                isOpen={alertData.open}
                onClose={() => setAlertData({ ...alertData, open: false })}
                title={alertData.title}
                message={alertData.message}
            />

            <ProductSelectorDialog
                isOpen={isProductDialogVisible}
                onClose={() => setIsProductDialogVisible(false)}
                products={products}
                categories={categories}
                selectedProductIds={formData.product_ids}
                disabledProductIds={disabledProductIds}
                onSelectionComplete={(newIds) => setFormData({ ...formData, product_ids: newIds })}
                multiple={true}
            />
        </Card>
    );
};

export default StampRulesManager;
