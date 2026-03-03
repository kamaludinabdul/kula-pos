import React, { useState, useEffect, useMemo } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Edit, Trash2, Plus, AlertCircle, Loader2 } from 'lucide-react';
import AlertDialog from '../AlertDialog';
import ConfirmDialog from '../ConfirmDialog';
import ProductSelectorDialog from './ProductSelectorDialog';

const PerProductPointsManager = () => {
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
        rule_type: 'per_product',
        product_ids: [],
        points_per_item: 10,
        isActive: true
    };

    const [formData, setFormData] = useState(defaultForm);

    const loadRules = React.useCallback(async () => {
        setLoading(true);
        try {
            const data = await fetchLoyaltyRules(currentStore.id);
            setRules(data ? data.filter(r => r.rule_type === 'per_product') : []);

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
                rule_type: 'per_product',
                product_ids: rule.product_ids || [],
                points_per_item: rule.points_per_item || 0,
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
            setAlertData({ open: true, title: 'Validasi', message: 'Silakan isi nama kelompok dan pilih minimal 1 produk.' });
            return;
        }
        if (formData.points_per_item <= 0) {
            setAlertData({ open: true, title: 'Validasi', message: 'Poin yang didapat harus lebih dari 0.' });
            return;
        }

        setIsSubmitting(true);
        try {
            const ruleToSave = {
                name: formData.name,
                rule_type: 'per_product',
                product_ids: formData.product_ids,
                points_per_item: Number(formData.points_per_item),
                stamp_target: 0,
                stamp_reward_points: 0,
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
                        <CardTitle className="text-lg">Kelompok Poin Per Produk</CardTitle>
                        <CardDescription>
                            Tentukan berapa poin yang didapat per QTY untuk kelompok produk tertentu.
                        </CardDescription>
                    </div>
                    <Button type="button" onClick={() => handleOpenForm()}>
                        <Plus className="h-4 w-4 mr-2" /> Tambah Kelompok
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {loading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-indigo-400" /></div>
                ) : rules.length === 0 ? (
                    <div className="text-center p-8 border border-dashed rounded-lg bg-slate-50">
                        <AlertCircle className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-600 mb-4">Belum ada kelompok pengaturan poin produk.</p>
                        <Button type="button" variant="outline" onClick={() => handleOpenForm()}>Buat Sekarang</Button>
                    </div>
                ) : (
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Poin Didapat</TableHead>
                                    <TableHead>Nama Kelompok</TableHead>
                                    <TableHead>Produk Terkait</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rules
                                    .sort((a, b) => b.points_per_item - a.points_per_item)
                                    .map(rule => {
                                        // Build a readable list of product names
                                        const ruleProducts = products.filter(p => rule.product_ids?.includes(p.id));
                                        let productsString = '';
                                        if (ruleProducts.length > 0) {
                                            const names = ruleProducts.map(p => p.name);
                                            productsString = names.length <= 3
                                                ? names.join(', ')
                                                : `${names.slice(0, 3).join(', ')} ... (+${names.length - 3} lainnya)`;
                                        } else {
                                            productsString = <span className="text-red-500 italic">Produk dihapus/tidak ditemukan</span>;
                                        }

                                        return (
                                            <TableRow key={rule.id}>
                                                <TableCell className="font-bold text-indigo-700">
                                                    {rule.points_per_item} Poin
                                                </TableCell>
                                                <TableCell className="font-semibold">{rule.name}</TableCell>
                                                <TableCell className="text-sm">
                                                    {productsString}
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
                        <DialogTitle>{editingRule ? 'Edit Kelompok Poin' : 'Tambah Kelompok Poin Baru'}</DialogTitle>
                        <DialogDescription className="hidden">Mengelola poin per produk secara berkelompok.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Poin Per QTY (Berapa poin yang didapat?)</Label>
                            <Input
                                type="number"
                                value={formData.points_per_item}
                                onChange={e => setFormData({ ...formData, points_per_item: e.target.value })}
                                placeholder="Cth: 10"
                                className="font-bold text-lg h-12"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label>Nama Kelompok Poin</Label>
                            <Input
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Cth: Kelompok Poin 10, Promo Akhir Tahun"
                            />
                        </div>

                        <div className="grid gap-2 relative">
                            <Label>Pilih Produk (Bisa lebih dari 1)</Label>
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full justify-between"
                                onClick={() => setIsProductDialogVisible(true)}
                            >
                                {formData.product_ids && formData.product_ids.length > 0
                                    ? `${formData.product_ids.length} Produk Terpilih`
                                    : "-- Cari & Pilih Produk --"}
                            </Button>
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="active_checkbox2"
                                className="h-4 w-4 rounded border-gray-300"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                            />
                            <Label htmlFor="active_checkbox2">Aturan Aktif</Label>
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
                title="Hapus Kelompok"
                description={`Yakin ingin menghapus kelompok "${ruleToDelete?.name}"? Poin produk ini akan dikembalikan ke 0 otomatis.`}
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
                onSelectionComplete={newIds =>
                    setFormData({ ...formData, product_ids: newIds })
                }
                multiple={true}
            />
        </Card>
    );
};

export default PerProductPointsManager;
