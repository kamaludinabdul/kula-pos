import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';

const PetServiceFormDialog = ({ isOpen, onClose, onSave, initialData = null }) => {
    const [formData, setFormData] = useState({
        name: '',
        category: 'grooming',
        capitalPrice: 0,
        price: 0,
        duration: 30,
        isActive: true,
        doctorFeeType: 'fixed',
        doctorFeeValue: 0,
        commissions: {
            groomerFee: 0,
            paramedicFee: 0,
            cashierFee: 0
        }
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name || '',
                    category: initialData.category || 'grooming',
                    capitalPrice: initialData.capitalPrice || 0,
                    price: initialData.price || 0,
                    duration: initialData.duration || 30,
                    isActive: initialData.isActive ?? true,
                    doctorFeeType: initialData.doctorFeeType || 'fixed',
                    doctorFeeValue: initialData.doctorFeeValue || 0,
                    commissions: initialData.commission || {
                        groomerFee: 0,
                        paramedicFee: 0,
                        cashierFee: 0
                    }
                });
            } else {
                setFormData({
                    name: '',
                    category: 'grooming',
                    capitalPrice: 0,
                    price: 0,
                    duration: 30,
                    isActive: true,
                    doctorFeeType: 'fixed',
                    doctorFeeValue: 0,
                    commissions: {
                        groomerFee: 0,
                        paramedicFee: 0,
                        cashierFee: 0
                    }
                });
            }
        }
    }, [isOpen, initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Failed to save service', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Edit Layanan' : 'Tambah Layanan'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nama Layanan <span className="text-red-500">*</span></Label>
                        <Input
                            id="name"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            required
                            placeholder="Contoh: Bath & Haircut Small"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="category">Kategori</Label>
                        <Select 
                            value={formData.category} 
                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Kategori" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="grooming">Grooming</SelectItem>
                                <SelectItem value="medical">Medis</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="capitalPrice">Harga Modal (Opsional)</Label>
                            <Input
                                id="capitalPrice"
                                type="number"
                                value={formData.capitalPrice}
                                onChange={(e) => setFormData({ ...formData, capitalPrice: parseFloat(e.target.value) })}
                                min="0"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="price">Harga Jual <span className="text-red-500">*</span></Label>
                            <Input
                                id="price"
                                type="number"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                min="0"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="duration">Estimasi Durasi (Menit)</Label>
                        <Input
                            id="duration"
                            type="number"
                            value={formData.duration}
                            onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                            min="1"
                            placeholder="30"
                        />
                    </div>

                    <div className="p-3 bg-indigo-50 rounded-lg space-y-4">
                        <Label className="text-indigo-700 font-semibold flex items-center gap-2">
                             Bagi Hasil Klinik
                        </Label>
                        
                        {/* Common Fee Settings */}
                        <div className="grid grid-cols-2 gap-4 pb-2 border-b border-indigo-100">
                            <div className="space-y-2">
                                <Label htmlFor="doctorFeeType" className="text-xs">Tipe Fee (Umum)</Label>
                                <Select 
                                    value={formData.doctorFeeType} 
                                    onValueChange={(value) => setFormData({ ...formData, doctorFeeType: value })}
                                >
                                    <SelectTrigger id="doctorFeeType" className="bg-white h-8 text-xs">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="fixed">Nominal (Rp)</SelectItem>
                                        <SelectItem value="percentage">Persentase (%)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            {/* Dokter Fee - Always shown as base */}
                            <div className="flex items-center justify-between gap-4">
                                <Label htmlFor="doctorFeeValue" className="text-xs min-w-[80px]">Fee Dokter</Label>
                                <Input
                                    id="doctorFeeValue"
                                    type="number"
                                    value={formData.doctorFeeValue}
                                    onChange={(e) => setFormData({ ...formData, doctorFeeValue: parseFloat(e.target.value) || 0 })}
                                    min="0"
                                    className="bg-white h-8 text-xs max-w-[120px]"
                                />
                            </div>

                            {/* Conditional Fee: Groomer */}
                            {(formData.category === 'grooming' || formData.category === 'hotel_addon') && (
                                <div className="flex items-center justify-between gap-4">
                                    <Label htmlFor="groomerFee" className="text-xs min-w-[80px]">Fee Groomer</Label>
                                    <Input
                                        id="groomerFee"
                                        type="number"
                                        value={formData.commissions?.groomerFee || 0}
                                        onChange={(e) => setFormData({ 
                                            ...formData, 
                                            commissions: { ...formData.commissions, groomerFee: parseFloat(e.target.value) || 0 } 
                                        })}
                                        min="0"
                                        className="bg-white h-8 text-xs max-w-[120px]"
                                    />
                                </div>
                            )}

                            {/* Conditional Fee: Paramedis */}
                            {(formData.category === 'medical' || formData.category === 'hotel_addon') && (
                                <div className="flex items-center justify-between gap-4">
                                    <Label htmlFor="paramedicFee" className="text-xs min-w-[80px]">Fee Paramedis</Label>
                                    <Input
                                        id="paramedicFee"
                                        type="number"
                                        value={formData.commissions?.paramedicFee || 0}
                                        onChange={(e) => setFormData({ 
                                            ...formData, 
                                            commissions: { ...formData.commissions, paramedicFee: parseFloat(e.target.value) || 0 } 
                                        })}
                                        min="0"
                                        className="bg-white h-8 text-xs max-w-[120px]"
                                    />
                                </div>
                            )}

                            {/* Conditional Fee: Kasir (Hotel Only) */}
                            {formData.category === 'hotel_addon' && (
                                <div className="flex items-center justify-between gap-4">
                                    <Label htmlFor="cashierFee" className="text-xs min-w-[80px]">Fee Kasir</Label>
                                    <Input
                                        id="cashierFee"
                                        type="number"
                                        value={formData.commissions?.cashierFee || 0}
                                        onChange={(e) => setFormData({ 
                                            ...formData, 
                                            commissions: { ...formData.commissions, cashierFee: parseFloat(e.target.value) || 0 } 
                                        })}
                                        min="0"
                                        className="bg-white h-8 text-xs max-w-[120px]"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div className="space-y-0.5">
                            <Label>Status Aktif</Label>
                            <p className="text-[10px] text-muted-foreground">Aktifkan untuk menampilkan layanan di POS/Booking</p>
                        </div>
                        <Switch
                            checked={formData.isActive}
                            onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PetServiceFormDialog;
