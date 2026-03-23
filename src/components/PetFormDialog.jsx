import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { useData } from '../context/DataContext';
import { Checkbox } from './ui/checkbox';
import { SearchableSelect } from './ui/SearchableSelect';

const PetFormDialog = ({ isOpen, onClose, onSave, initialData = null }) => {
    const { customers } = useData();
    const [formData, setFormData] = useState({
        name: '',
        customerId: '',
        petType: '',
        breed: '',
        gender: 'Jantan',
        petAge: '',
        weight: '',
        color: '',
        isNeutered: false,
        isVaccinated: false,
        rmNumber: '',
        specialNeeds: '',
        medicalHistory: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    name: initialData.name || '',
                    customerId: initialData.customerId || '',
                    petType: initialData.petType || initialData.pet_type || '',
                    breed: initialData.breed || '',
                    gender: initialData.gender || 'Jantan',
                    petAge: initialData.petAge || '',
                    weight: initialData.weight || '',
                    color: initialData.color || '',
                    isNeutered: initialData.isNeutered ?? initialData.is_neutered ?? false,
                    isVaccinated: initialData.isVaccinated ?? initialData.is_vaccinated ?? false,
                    rmNumber: initialData.rmNumber || initialData.rm_number || '',
                    specialNeeds: initialData.specialNeeds || '',
                    medicalHistory: initialData.medicalHistory || ''
                });
            } else {
                setFormData({
                    name: '',
                    customerId: '',
                    petType: '',
                    breed: '',
                    gender: 'Jantan',
                    petAge: '',
                    weight: '',
                    color: '',
                    isNeutered: false,
                    isVaccinated: false,
                    rmNumber: '',
                    specialNeeds: '',
                    medicalHistory: ''
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
            console.error('Failed to save pet', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Edit Data Hewan' : 'Tambah Data Hewan'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Hewan <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                required
                                placeholder="Contoh: Milo"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="customerId">Pemilik (Customer)</Label>
                            <SearchableSelect
                                options={customers.map(c => ({
                                    value: c.id,
                                    label: c.name,
                                    subLabel: c.phone
                                }))}
                                value={formData.customerId}
                                onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                                placeholder="Pilih Pemilik"
                                searchPlaceholder="Cari Nama atau Telepon..."
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="petType">Jenis Hewan <span className="text-red-500">*</span></Label>
                            <Input
                                id="petType"
                                value={formData.petType}
                                onChange={(e) => setFormData({ ...formData, petType: e.target.value })}
                                required
                                placeholder="Contoh: Kucing, Anjing"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="breed">Ras / Breed</Label>
                            <Input
                                id="breed"
                                value={formData.breed}
                                onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
                                placeholder="Contoh: Persia, Golden"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="gender">Jenis Kelamin</Label>
                            <Select 
                                value={formData.gender} 
                                onValueChange={(value) => setFormData({ ...formData, gender: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Jantan">Jantan</SelectItem>
                                    <SelectItem value="Betina">Betina</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="petAge">Umur</Label>
                            <Input
                                id="petAge"
                                value={formData.petAge}
                                onChange={(e) => setFormData({ ...formData, petAge: e.target.value })}
                                placeholder="Contoh: 2 Tahun"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="weight">Berat (kg)</Label>
                            <Input
                                id="weight"
                                type="number"
                                step="0.1"
                                value={formData.weight}
                                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                                placeholder="0.0"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="color">Warna / Corak</Label>
                            <Input
                                id="color"
                                value={formData.color}
                                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                placeholder="Contoh: Tabby, Putih"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="rmNumber">No. RM (Otomatis jika kosong)</Label>
                            <Input
                                id="rmNumber"
                                value={formData.rmNumber}
                                onChange={(e) => setFormData({ ...formData, rmNumber: e.target.value })}
                                placeholder="RM-XXXX"
                                disabled={!!initialData}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center space-x-2 pt-2 px-1">
                            <Checkbox 
                                id="isNeutered" 
                                checked={formData.isNeutered} 
                                onCheckedChange={(checked) => setFormData({ ...formData, isNeutered: !!checked })}
                            />
                            <Label htmlFor="isNeutered" className="text-xs font-bold text-slate-700 cursor-pointer">Steril / Kebiri</Label>
                        </div>
                        <div className="flex items-center space-x-2 pt-2 px-1">
                            <Checkbox 
                                id="isVaccinated" 
                                checked={formData.isVaccinated} 
                                onCheckedChange={(checked) => setFormData({ ...formData, isVaccinated: !!checked })}
                            />
                            <Label htmlFor="isVaccinated" className="text-xs font-bold text-slate-700 cursor-pointer">Vaksin Lengkap</Label>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="specialNeeds">Kebutuhan Khusus</Label>
                        <Textarea
                            id="specialNeeds"
                            value={formData.specialNeeds}
                            onChange={(e) => setFormData({ ...formData, specialNeeds: e.target.value })}
                            placeholder="Contoh: Alergi makanan laut, galak saat mandi"
                            rows={2}
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

export default PetFormDialog;
