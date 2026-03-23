import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useData } from '../context/DataContext';
import { Home, Scissors, Stethoscope } from 'lucide-react';
import { SearchableSelect } from './ui/SearchableSelect';

const PetBookingFormDialog = ({ isOpen, onClose, onSave, initialData = null }) => {
    const { pets, customers, petRooms, petServices } = useData();
    const [formData, setFormData] = useState({
        petId: '',
        customerId: '',
        serviceType: 'grooming',
        serviceId: '',
        roomId: '',
        startDate: new Date().toISOString().split('T')[0],
        startTime: '10:00',
        endDate: '',
        unitPrice: 0,
        totalPrice: 0,
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    petId: initialData.petId || '',
                    customerId: initialData.customerId || '',
                    serviceType: initialData.serviceType || 'grooming',
                    serviceId: initialData.serviceId || '',
                    roomId: initialData.roomId || '',
                    startDate: initialData.startDate || new Date().toISOString().split('T')[0],
                    startTime: initialData.startTime || '10:00',
                    endDate: initialData.endDate || '',
                    unitPrice: initialData.unitPrice || 0,
                    totalPrice: initialData.totalPrice || 0,
                    notes: initialData.notes || ''
                });
            } else {
                setFormData({
                    petId: '',
                    customerId: '',
                    serviceType: 'grooming',
                    serviceId: '',
                    roomId: '',
                    startDate: new Date().toISOString().split('T')[0],
                    startTime: '10:00',
                    endDate: '',
                    unitPrice: 0,
                    totalPrice: 0,
                    notes: ''
                });
            }
        }
    }, [isOpen, initialData]);

    // Auto-fill customer when pet is selected
    useEffect(() => {
        if (formData.petId) {
            const pet = pets.find(p => p.id === formData.petId);
            if (pet && pet.customerId) {
                setFormData(prev => ({ ...prev, customerId: pet.customerId }));
            }
        }
    }, [formData.petId, pets]);

    // Update price when service or room is selected
    useEffect(() => {
        if (formData.serviceType === 'hotel') {
            const room = petRooms.find(r => r.id === formData.roomId);
            if (room) {
                setFormData(prev => ({ ...prev, unitPrice: room.price }));
            }
        } else {
            const service = petServices.find(s => s.id === formData.serviceId);
            if (service) {
                setFormData(prev => ({ ...prev, unitPrice: service.price }));
            }
        }
    }, [formData.serviceId, formData.roomId, formData.serviceType, petRooms, petServices]);

    // Recalculate total price
    useEffect(() => {
        if (formData.serviceType === 'hotel' && formData.startDate && formData.endDate) {
            const start = new Date(formData.startDate);
            const end = new Date(formData.endDate);
            const nights = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
            setFormData(prev => ({ ...prev, totalPrice: prev.unitPrice * nights }));
        } else {
            setFormData(prev => ({ ...prev, totalPrice: prev.unitPrice }));
        }
    }, [formData.unitPrice, formData.startDate, formData.endDate, formData.serviceType]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSave(formData);
            onClose();
        } catch (error) {
            console.error('Failed to save booking', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{initialData ? 'Edit Booking' : 'Buat Booking Baru'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="petId">Pilih Hewan <span className="text-red-500">*</span></Label>
                            <SearchableSelect
                                options={pets.map(p => {
                                    const customer = customers.find(c => c.id === p.customerId);
                                    return {
                                        value: p.id,
                                        label: p.name,
                                        subLabel: `${p.petType || ''} • ${customer?.name || 'No Owner'}`
                                    };
                                })}
                                value={formData.petId}
                                onValueChange={(value) => setFormData({ ...formData, petId: value })}
                                placeholder="Pilih Hewan"
                                searchPlaceholder="Cari Nama Hewan atau Pemilik..."
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Pemilik</Label>
                            <div className="p-2 bg-slate-50 border rounded-md text-sm text-slate-600 truncate">
                                {customers.find(c => c.id === formData.customerId)?.name || '- Select Pet -'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Jenis Layanan</Label>
                        <div className="flex gap-2">
                            {[
                                { type: 'grooming', icon: <Scissors className="mr-1.5 h-3.5 w-3.5" />, label: 'Grooming' },
                                { type: 'medical', icon: <Stethoscope className="mr-1.5 h-3.5 w-3.5" />, label: 'Medis' },
                                { type: 'hotel', icon: <Home className="mr-1.5 h-3.5 w-3.5" />, label: 'Hotel' }
                            ].map(({ type, icon, label }) => (
                                <Button
                                    key={type}
                                    type="button"
                                    variant={formData.serviceType === type ? 'default' : 'outline'}
                                    className="flex-1 h-9 text-xs"
                                    onClick={() => setFormData({ ...formData, serviceType: type, serviceId: '', endDate: '' })}
                                >
                                    {icon}
                                    {label}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {formData.serviceType === 'hotel' ? (
                        <div className="space-y-2">
                            <Label htmlFor="roomId">Pilih Kamar <span className="text-red-500">*</span></Label>
                            <Select 
                                value={formData.roomId} 
                                onValueChange={(value) => setFormData({ ...formData, roomId: value })}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Kamar" />
                                </SelectTrigger>
                                <SelectContent>
                                    {petRooms.filter(r => r.status === 'available' || r.id === initialData?.roomId).map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.name} - Rp {r.price.toLocaleString('id-ID')}/mlm</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor="serviceId">Pilih Item Layanan <span className="text-red-500">*</span></Label>
                            <Select 
                                value={formData.serviceId} 
                                onValueChange={(value) => setFormData({ ...formData, serviceId: value })}
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih Layanan" />
                                </SelectTrigger>
                                <SelectContent>
                                    {petServices.filter(s => s.category === formData.serviceType && s.isActive).map(s => (
                                        <SelectItem key={s.id} value={s.id}>{s.name} - Rp {s.price.toLocaleString('id-ID')}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="startDate">Mulai Tanggal</Label>
                            <Input
                                id="startDate"
                                type="date"
                                value={formData.startDate}
                                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                required
                            />
                        </div>
                        {formData.serviceType === 'hotel' ? (
                            <div className="space-y-2">
                                <Label htmlFor="endDate">Selesai Tanggal</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={formData.endDate}
                                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                    required
                                    min={formData.startDate}
                                />
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <Label htmlFor="startTime">Waktu</Label>
                                <Input
                                    id="startTime"
                                    type="time"
                                    value={formData.startTime}
                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                />
                            </div>
                        )}
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-center">
                        <div className="text-sm font-medium text-slate-500">Total Estimasi</div>
                        <div className="text-xl font-bold text-blue-600">
                            Rp {(formData.totalPrice || 0).toLocaleString('id-ID')}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="notes">Catatan Tambahan</Label>
                        <Input
                            id="notes"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Contoh: Titip makan 3x sehari"
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? 'Menyimpan...' : (initialData ? 'Simpan Perubahan' : 'Buat Booking')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default PetBookingFormDialog;
