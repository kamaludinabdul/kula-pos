import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Search, Loader2, FileText, User, Calendar, Stethoscope } from 'lucide-react';
import { useData } from '../../context/DataContext';
import { Badge } from '../ui/badge';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const RMSearchDialog = ({ isOpen, onClose, onSelectRecord }) => {
    const { medicalRecords, pets, petBookings } = useData();
    const [searchQuery, setSearchQuery] = useState('');

    // Derived state for ALL unpaid records & bookings
    const allUnpaidItems = React.useMemo(() => {
        const items = [];
        
        if (medicalRecords) {
            const unpaidMR = medicalRecords
                .filter(m => m.isPaidPos === false)
                .map(m => {
                    const pet = pets?.find(p => p.id === m.petId);
                    return {
                        ...m,
                        itemType: 'medical_record',
                        petName: pet?.name || 'Unknown Pet',
                        rmNumber: pet?.rmNumber || m.rm_number || 'No RM',
                        timestamp: new Date(m.date).getTime()
                    };
                });
            items.push(...unpaidMR);
        }

        if (petBookings) {
            const unpaidBookings = petBookings
                .filter(b => b.status === 'confirmed' || b.status === 'pending')
                .map(b => {
                    const pet = pets?.find(p => p.id === b.petId);
                    return {
                        ...b,
                        itemType: 'booking',
                        petName: pet?.name || 'Unknown Pet',
                        rmNumber: pet?.rmNumber || 'No RM',
                        timestamp: new Date(b.created_at || b.startDate).getTime()
                    };
                });
            items.push(...unpaidBookings);
        }

        return items.sort((a, b) => b.timestamp - a.timestamp);
    }, [medicalRecords, petBookings, pets]);

    // Apply local search
    const displayRecords = React.useMemo(() => {
        if (!searchQuery.trim()) return allUnpaidItems.slice(0, 15);
        
        const q = searchQuery.toLowerCase();
        return allUnpaidItems.filter(item => 
            (item.rmNumber || '').toLowerCase().includes(q) ||
            (item.petName || '').toLowerCase().includes(q) ||
            (item.customerName || '').toLowerCase().includes(q)
        ).slice(0, 15);
    }, [allUnpaidItems, searchQuery]);

    const handleSelect = (record) => {
        onSelectRecord(record);
        onClose();
        setSearchQuery('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-indigo-600" />
                        Tarik Data Booking / RM
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="space-y-2">
                        <Label htmlFor="searchQuery">Cari Nomor RM atau Nama Hewan</Label>
                        <Input
                            id="searchQuery"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Ketik nama hewan atau RM-0001..."
                            className="w-full"
                            autoFocus
                        />
                    </div>

                    <div className="mt-4 min-h-[200px] max-h-[400px] overflow-y-auto space-y-3">
                        {displayRecords.length > 0 ? (
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    {searchQuery ? 'Hasil Pencarian:' : 'Data Belum Lunas (Terbaru):'}
                                </p>
                                {displayRecords.map((item) => (
                                    <div
                                        key={item.itemType + '-' + item.id}
                                        className={`p-4 border rounded-lg hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer transition-all group ${item.itemType === 'booking' ? 'border-amber-200 bg-amber-50/30' : 'border-blue-200 bg-blue-50/30'}`}
                                        onClick={() => handleSelect(item)}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className={`${item.itemType === 'booking' ? 'border-amber-400 text-amber-700 bg-amber-100' : 'border-blue-400 text-blue-700 bg-blue-100'}`}>
                                                    {item.itemType === 'booking' ? 'Booking' : 'Rekam Medis'}
                                                </Badge>
                                                <span className="text-sm font-bold text-slate-800">{item.petName}</span>
                                                <span className="text-xs text-slate-500">({item.rmNumber})</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                {format(item.timestamp, 'dd MMM yyyy HH:mm', { locale: id })}
                                            </span>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                                            {item.itemType === 'medical_record' ? (
                                                <>
                                                    <div className="flex items-center gap-1.5">
                                                        <Stethoscope className="h-3 w-3 text-indigo-500" />
                                                        <span className="truncate">Dokter: {item.doctorName || '-'}</span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <FileText className="h-3 w-3 text-slate-400" />
                                                        <span className="truncate">Diagnosa: {item.diagnosis || '-'}</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="h-3 w-3 text-amber-500" />
                                                        <span className="truncate">Layanan: <span className="capitalize">{item.serviceType}</span></span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 font-bold">
                                                        <span className="truncate">Rp {item.totalPrice?.toLocaleString('id-ID') || 0}</span>
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <div className="mt-3 pt-3 border-t flex items-center justify-between">
                                            <div className="flex gap-1">
                                                {item.services?.length > 0 && (
                                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                                        {item.services.length} Layanan
                                                    </Badge>
                                                )}
                                                {item.prescriptions?.length > 0 && (
                                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-teal-50 text-teal-700 border-teal-100">
                                                        {item.prescriptions.length} Resep
                                                    </Badge>
                                                )}
                                                {item.itemType === 'booking' && item.notes && (
                                                    <span className="text-[10px] text-amber-600 truncate italic max-w-[150px]">"{item.notes}"</span>
                                                )}
                                            </div>
                                            <span className="text-[10px] text-indigo-600 font-bold group-hover:underline">Tarik ke Kasir →</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                                <FileText className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-center px-4">Tidak ada tagihan booking atau rekam medis yang belum lunas.</p>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter className="sm:justify-start">
                    <Button type="button" variant="ghost" onClick={onClose}>
                        Batal
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default RMSearchDialog;
