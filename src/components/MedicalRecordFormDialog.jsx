import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useData } from '../context/DataContext';
import { Plus, Trash2, Heart, Activity, Pill } from 'lucide-react';
import { safeSupabaseQuery } from '../utils/supabaseHelper';
import { SearchableSelect } from './ui/SearchableSelect';

const MedicalRecordFormDialog = ({ isOpen, onClose, onSave, initialData = null }) => {
    const { pets, customers, petBookings, activeStoreId, petServices, products, fetchAllProducts, fetchPetServices } = useData();
    const [staffList, setStaffList] = useState([]);
    const [formData, setFormData] = useState({
        petId: '',
        customerId: '',
        bookingId: '',
        date: new Date().toISOString(),
        doctorId: '',
        doctorName: '',
        paramedicId: '',
        symptoms: '',
        diagnosis: '',
        treatment: '',
        nextVisit: '',
        notes: '',
        services: [],
        prescriptions: []
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen && activeStoreId) {
            const fetchStaff = async () => {
                const data = await safeSupabaseQuery({
                    tableName: 'profiles',
                    queryBuilder: (q) => q
                        .eq('store_id', activeStoreId)
                        .in('role', ['dokter', 'paramedis', 'pramedic'])
                        .not('name', 'is', null) // Filter out orphans
                        .order('name'),
                });
                if (data) setStaffList(data);
            };
            fetchStaff();
            
            // Ensure data is loaded
            if (petServices.length === 0) fetchPetServices();
            if (products.length === 0) fetchAllProducts();
        }
    }, [isOpen, activeStoreId, fetchAllProducts, fetchPetServices, petServices.length, products.length]);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    petId: initialData.petId || '',
                    customerId: initialData.customerId || '',
                    bookingId: initialData.bookingId || '',
                    date: initialData.date || new Date().toISOString(),
                    doctorId: initialData.doctorId || '',
                    doctorName: initialData.doctorName || '',
                    paramedicId: initialData.paramedicId || '',
                    symptoms: initialData.symptoms || '',
                    diagnosis: initialData.diagnosis || '',
                    treatment: initialData.treatment || '',
                    nextVisit: initialData.nextVisit || '',
                    notes: initialData.notes || '',
                    services: initialData.services || [],
                    prescriptions: initialData.prescriptions || []
                });
            } else {
                setFormData({
                    petId: '',
                    customerId: '',
                    bookingId: '',
                    date: new Date().toISOString(),
                    doctorId: '',
                    doctorName: '',
                    paramedicId: '',
                    symptoms: '',
                    diagnosis: '',
                    treatment: '',
                    nextVisit: '',
                    notes: '',
                    services: [],
                    prescriptions: []
                });
            }
        }
    }, [isOpen, initialData]);

    const handlePetChange = (id) => {
        const pet = pets.find(p => p.id === id);
        setFormData(prev => ({ 
            ...prev, 
            petId: id, 
            customerId: pet?.customerId || '',
            bookingId: 'none'
        }));
    };

    const handleDoctorChange = (id) => {
        const staff = staffList.find(s => s.id === id);
        setFormData(prev => ({ 
            ...prev, 
            doctorId: id, 
            doctorName: staff?.name || '' 
        }));
    };

    const handleParamedicChange = (id) => {
        setFormData(prev => ({ 
            ...prev, 
            paramedicId: id
        }));
    };

    const addService = () => {
        setFormData(prev => ({
            ...prev,
            services: [...prev.services, { id: '', name: '', price: 0 }]
        }));
    };

    const handleServiceChange = (index, serviceId) => {
        const service = petServices.find(s => s.id === serviceId);
        const next = [...formData.services];
        next[index] = {
            id: serviceId,
            name: service?.name || '',
            price: service?.price || 0
        };
        setFormData({ ...formData, services: next });
    };

    const removeService = (index) => {
        setFormData(prev => ({
            ...prev,
            services: prev.services.filter((_, i) => i !== index)
        }));
    };

    const addPrescription = () => {
        setFormData(prev => ({
            ...prev,
            prescriptions: [...prev.prescriptions, { id: '', medicine: '', dosage: '', duration: '', price: 0 }]
        }));
    };

    const handlePrescriptionChange = (index, productId) => {
        const product = products.find(p => p.id === productId);
        const next = [...formData.prescriptions];
        next[index] = {
            ...next[index],
            id: productId,
            medicine: product?.name || '',
            price: product?.price || 0
        };
        setFormData({ ...formData, prescriptions: next });
    };

    const removePrescription = (index) => {
        setFormData(prev => ({
            ...prev,
            prescriptions: prev.prescriptions.filter((_, i) => i !== index)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSave = {
                ...formData,
                bookingId: formData.bookingId === 'none' ? null : formData.bookingId,
                paramedicId: formData.paramedicId === 'none' ? null : formData.paramedicId
            };
            await onSave(dataToSave);
            onClose();
        } catch (error) {
            console.error('Failed to save medical record', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Edit Rekam Medis' : 'Catat Rekam Medis Baru'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-6 py-4">
                    {/* Header Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Pilih Hewan <span className="text-red-500">*</span></Label>
                            <SearchableSelect
                                options={pets.map(p => {
                                    const customer = customers.find(c => c.id === p.customerId);
                                    return {
                                        value: p.id,
                                        label: p.name,
                                        subLabel: `${p.rmNumber || '-'} • ${customer?.name || 'No Owner'}`
                                    };
                                })}
                                value={formData.petId}
                                onValueChange={handlePetChange}
                                placeholder="Pilih Hewan"
                                searchPlaceholder="Cari Nama Hewan, No RM, atau Pemilik..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2">
                                <Label>No. RM</Label>
                                <div className="p-2 bg-blue-50 border border-blue-100 rounded-md text-sm font-bold text-blue-700 min-h-[38px] flex items-center justify-center">
                                    {pets.find(p => p.id === formData.petId)?.rmNumber || '-'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Pemilik</Label>
                            <div className="p-2 bg-slate-50 border rounded-md text-sm text-slate-600 truncate">
                                {customers.find(c => c.id === formData.customerId)?.name || '- Tanpa Pemilik -'}
                            </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Dokter Pengampu <span className="text-red-500">*</span></Label>
                            <Select value={formData.doctorId} onValueChange={handleDoctorChange} required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Dokter" />
                                </SelectTrigger>
                                <SelectContent>
                                    {staffList.filter(s => s.role === 'dokter' && s.name).map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                    {staffList.filter(s => s.role === 'dokter').length === 0 && (
                                        <SelectItem disabled value="none">Belum ada akun dengan role Dokter</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Paramedis / Asisten</Label>
                            <Select value={formData.paramedicId} onValueChange={handleParamedicChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Paramedis" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Tanpa Paramedis</SelectItem>
                                    {staffList.filter(s => s.role === 'paramedis' || s.role === 'pramedic').map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                    ))}
                                    {staffList.filter(s => s.role === 'paramedis' || s.role === 'pramedic').length === 0 && (
                                        <SelectItem disabled value="no-paramedic">Belum ada akun dengan role Paramedis</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Booking Terkait (Opsional)</Label>
                            <Select value={formData.bookingId} onValueChange={(val) => setFormData({...formData, bookingId: val})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Booking" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Tanpa Booking</SelectItem>
                                    {petBookings.filter(b => b.petId === formData.petId).map(b => {
                                        const petName = pets.find(p => p.id === b.petId)?.name || 'Hewan';
                                        const dateStr = new Date(b.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                                        return (
                                            <SelectItem key={b.id} value={b.id}>
                                                {dateStr} - {b.serviceType} ({petName})
                                            </SelectItem>
                                        );
                                    })}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Medical Section */}
                    <div className="space-y-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label>Anamnesa / Keluhan</Label>
                            <Textarea 
                                value={formData.symptoms} 
                                onChange={e => setFormData({...formData, symptoms: e.target.value})}
                                placeholder="Tuliskan keluhan hewan atau gejala yang diobservasi..."
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Diagnosa</Label>
                                <Textarea 
                                    value={formData.diagnosis} 
                                    onChange={e => setFormData({...formData, diagnosis: e.target.value})}
                                    placeholder="Hasil pemeriksaan dan diagnosa..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Tindakan / Treatment</Label>
                                <Textarea 
                                    value={formData.treatment} 
                                    onChange={e => setFormData({...formData, treatment: e.target.value})}
                                    placeholder="Tindakan medis yang dilakukan..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Services & Medications */}
                    <div className="grid grid-cols-2 gap-6 border-t pt-4">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-blue-500" />
                                    Layanan / Jasa
                                </Label>
                                <Button type="button" variant="ghost" size="sm" onClick={addService} className="h-7 text-[10px] uppercase font-bold">
                                    <Plus className="h-3 w-3 mr-1" /> Tambah
                                </Button>
                            </div>
                             <div className="space-y-2">
                                {formData.services.map((s, i) => (
                                    <div key={i} className="flex gap-2">
                                        <div className="flex-1">
                                            <SearchableSelect
                                                options={petServices
                                                    .filter(ps => ps.isActive && (ps.category === 'medis' || ps.category === 'medical' || !ps.category))
                                                    .map(ps => ({
                                                        value: ps.id,
                                                        label: ps.name,
                                                        subLabel: `Rp ${(ps.price || 0).toLocaleString('id-ID')}`
                                                    }))}
                                                value={s.id}
                                                onValueChange={(val) => handleServiceChange(i, val)}
                                                placeholder="Pilih Layanan"
                                                className="h-8 text-xs"
                                            />
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeService(i)} className="h-8 w-8 text-red-400">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                                {formData.services.length === 0 && <p className="text-[10px] text-slate-400 italic">Belum ada layanan ditambahkan</p>}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="flex items-center gap-2">
                                    <Pill className="h-4 w-4 text-red-500" />
                                    Resep Obat
                                </Label>
                                <Button type="button" variant="ghost" size="sm" onClick={addPrescription} className="h-7 text-[10px] uppercase font-bold">
                                    <Plus className="h-3 w-3 mr-1" /> Tambah
                                </Button>
                            </div>
                             <div className="space-y-2">
                                {formData.prescriptions.map((p, i) => (
                                    <div key={i} className="flex flex-col gap-1 p-2 bg-slate-50 rounded border">
                                        <div className="flex justify-between items-center gap-2">
                                            <div className="flex-1">
                                                <SearchableSelect
                                                    options={products
                                                        .filter(prod => !prod.isDeleted)
                                                        .map(prod => ({
                                                            value: prod.id,
                                                            label: prod.name,
                                                            subLabel: `${prod.categories?.name || ''} • Rp ${prod.price.toLocaleString('id-ID')}`
                                                        }))}
                                                    value={p.id}
                                                    onValueChange={(val) => handlePrescriptionChange(i, val)}
                                                    placeholder="Pilih Obat"
                                                />
                                            </div>
                                            <Button type="button" variant="ghost" size="icon" onClick={() => removePrescription(i)} className="h-6 w-6 text-red-400 shrink-0">
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                        <div className="flex gap-2">
                                            <Input 
                                                placeholder="Dosis / Aturan Pakai (misal: 1x1 sesudah makan)" 
                                                value={p.dosage} 
                                                onChange={e => {
                                                    const next = [...formData.prescriptions];
                                                    next[i].dosage = e.target.value;
                                                    setFormData({...formData, prescriptions: next});
                                                }}
                                                className="h-7 text-[10px] flex-1"
                                            />
                                            <Input 
                                                placeholder="Jumlah" 
                                                value={p.duration} 
                                                onChange={e => {
                                                    const next = [...formData.prescriptions];
                                                    next[i].duration = e.target.value;
                                                    setFormData({...formData, prescriptions: next});
                                                }}
                                                className="h-7 text-[10px] w-20"
                                            />
                                        </div>
                                    </div>
                                ))}
                                {formData.prescriptions.length === 0 && <p className="text-[10px] text-slate-400 italic">Belum ada resep ditambahkan</p>}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                        <div className="space-y-2">
                            <Label>Kunjungan Berikutnya (Opsional)</Label>
                            <Input 
                                type="date" 
                                value={formData.nextVisit} 
                                onChange={e => setFormData({...formData, nextVisit: e.target.value})}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Catatan Rahasia / internal</Label>
                            <Input 
                                value={formData.notes} 
                                onChange={e => setFormData({...formData, notes: e.target.value})}
                                placeholder="Hanya terlihat oleh staff..."
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Menyimpan...' : 'Simpan Rekam Medis'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default MedicalRecordFormDialog;
