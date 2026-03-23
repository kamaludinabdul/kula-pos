import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Trash2, MessageCircle, Save, Calendar, Clock, User, Heart, Utensils, Droplets } from 'lucide-react';
import { useData } from '../context/DataContext';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import { Badge } from './ui/badge';

const PetDailyLogModal = ({ booking, isOpen, onClose }) => {
    const { petDailyLogs, addPetDailyLog, deletePetDailyLog, staff } = useData();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({
        eating: 'lahap',
        mood: 'ceria',
        bathroom: 'normal',
        notes: '',
        staffId: ''
    });

    const relevantLogs = useMemo(() => {
        return petDailyLogs.filter(l => l.bookingId === booking?.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [petDailyLogs, booking?.id]);

    useEffect(() => {
        if (isOpen) {
            setForm(prev => ({ ...prev, notes: '', staffId: staff?.[0]?.id || '' }));
        }
    }, [isOpen, staff]);

    const handleSave = async () => {
        if (!booking) return;
        setIsSubmitting(true);
        try {
            const selectedStaff = staff.find(s => s.id === form.staffId);
            const logData = {
                bookingId: booking.id,
                petId: booking.petId,
                date: new Date().toISOString().split('T')[0],
                eating: form.eating,
                mood: form.mood,
                bathroom: form.bathroom,
                notes: form.notes,
                staffId: form.staffId,
                staffName: selectedStaff?.name || 'Staff'
            };

            const result = await addPetDailyLog(logData);
            if (result.success) {
                setForm(prev => ({ ...prev, notes: '' }));
            } else {
                alert("Gagal menyimpan log: " + result.error);
            }
        } catch (error) {
            console.error("Error saving log:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Hapus catatan ini?')) {
            await deletePetDailyLog(id);
        }
    };

    const generateWALink = (log) => {
        const petName = booking?.petName || 'Anabul';
        const dateStr = format(new Date(log.created_at), 'eeee, dd MMM', { locale: id });
        
        const message = `*Update Harian Pet Care: ${petName}*\n` +
            `📅 Tanggal: ${dateStr}\n\n` +
            `🍽️ Makan: ${log.eating}\n` +
            `✨ Mood: ${log.mood}\n` +
            `💩 Pup/Pee: ${log.bathroom}\n` +
            `${log.notes ? `📝 Catatan: ${log.notes}\n` : ''}\n` +
            `Kamar tetap nyaman dan ${petName} dalam pantauan kami. Terima kasih! 🐾`;

        const phone = booking?.customerPhone || '';
        return `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}`;
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex justify-between items-start">
                        <div>
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                <Heart className="h-5 w-5 text-rose-500 fill-rose-500" />
                                Harian Pet Care: {booking?.petName}
                            </DialogTitle>
                            <DialogDescription>
                                Catat perkembangan harian selama {booking?.serviceType === 'hotel' ? 'menginap' : 'perawatan'}.
                            </DialogDescription>
                        </div>
                        {booking?.serviceType === 'hotel' && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Room {booking.roomName || '?'}
                            </Badge>
                        )}
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-0">
                    {/* Form Section */}
                    <div className="md:w-5/12 p-6 overflow-y-auto border-r bg-slate-50/50">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nafsu Makan</Label>
                                <Select value={form.eating} onValueChange={v => setForm({ ...form, eating: v })}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih kondisi..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="lahap">😋 Lahap (Habis)</SelectItem>
                                        <SelectItem value="sisa_sedikit">🙂 Sisa Sedikit</SelectItem>
                                        <SelectItem value="sisa_banyak">😕 Sisa Banyak</SelectItem>
                                        <SelectItem value="tidak_makan">😶 Tidak Makan</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Kondisi / Mood</Label>
                                <Select value={form.mood} onValueChange={v => setForm({ ...form, mood: v })}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih mood..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="ceria">🌟 Ceria & Aktif</SelectItem>
                                        <SelectItem value="tenang">😴 Tenang & Santai</SelectItem>
                                        <SelectItem value="takut">😰 Malu / Takut</SelectItem>
                                        <SelectItem value="lemas">🤒 Lemas / Kurang Fit</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Buang Air</Label>
                                <Select value={form.bathroom} onValueChange={v => setForm({ ...form, bathroom: v })}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih kondisi..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="normal">✅ Normal</SelectItem>
                                        <SelectItem value="lembek">💧 Lembek / Diare</SelectItem>
                                        <SelectItem value="keras">🧱 Keras / Sembelit</SelectItem>
                                        <SelectItem value="tidak_ada">❌ Belum Ada</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Oleh Petugas</Label>
                                <Select value={form.staffId} onValueChange={v => setForm({ ...form, staffId: v })}>
                                    <SelectTrigger className="bg-white"><SelectValue placeholder="Pilih staff..." /></SelectTrigger>
                                    <SelectContent>
                                        {(staff || []).map(s => (
                                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Catatan Tambahan</Label>
                                <Textarea 
                                    value={form.notes}
                                    onChange={e => setForm({ ...form, notes: e.target.value })}
                                    placeholder="Misal: Sudah minum obat, jalan-jalan sore..."
                                    className="bg-white resize-none"
                                    rows={4}
                                />
                            </div>

                            <Button 
                                className="w-full h-11 font-bold shadow-md shadow-blue-200" 
                                onClick={handleSave}
                                disabled={isSubmitting || !form.staffId}
                            >
                                <Save className="h-4 w-4 mr-2" />
                                Simpan Update
                            </Button>
                        </div>
                    </div>

                    {/* Timeline Section */}
                    <div className="md:w-7/12 flex flex-col bg-white">
                        <div className="p-4 border-b flex items-center justify-between bg-slate-50/30">
                            <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Riwayat Catatan</span>
                            <Badge variant="secondary" className="text-[10px]">{relevantLogs.length} Entri</Badge>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {relevantLogs.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                                    <Clock className="h-10 w-10 opacity-10" />
                                    <p className="text-sm italic">Belum ada catatan aktivitas harian.</p>
                                </div>
                            ) : (
                                relevantLogs.map((log) => (
                                    <div key={log.id} className="relative pl-6 border-l-2 border-slate-100 last:border-l-0 pb-6 group">
                                        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-blue-500 border-4 border-white shadow-sm" />
                                        
                                        <div className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <span className="text-sm font-black text-slate-800">
                                                        {format(new Date(log.created_at), 'dd MMMM yyyy', { locale: id })}
                                                    </span>
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-bold">
                                                        <Clock className="h-3 w-3" />
                                                        {format(new Date(log.created_at), 'HH:mm')}
                                                        <span className="mx-1">•</span>
                                                        <User className="h-3 w-3" />
                                                        {log.staffName}
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <a 
                                                        href={generateWALink(log)} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                                                    >
                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                    </a>
                                                    <button 
                                                        onClick={() => handleDelete(log.id)}
                                                        className="h-7 w-7 flex items-center justify-center rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-3 gap-2 mb-3">
                                                <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                                                    <Utensils className="h-3.5 w-3.5 text-blue-500 mb-1" />
                                                    <span className="text-[10px] font-bold text-slate-600 capitalize">{log.eating}</span>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                                                    <Heart className="h-3.5 w-3.5 text-rose-500 mb-1" />
                                                    <span className="text-[10px] font-bold text-slate-600 capitalize">{log.mood}</span>
                                                </div>
                                                <div className="bg-slate-50 rounded-lg p-2 flex flex-col items-center">
                                                    <Droplets className="h-3.5 w-3.5 text-cyan-500 mb-1" />
                                                    <span className="text-[10px] font-bold text-slate-600 capitalize">{log.bathroom}</span>
                                                </div>
                                            </div>

                                            {log.notes && (
                                                <div className="bg-blue-50/30 rounded-lg p-3 text-xs text-slate-600 leading-relaxed italic border-l-2 border-blue-200">
                                                    "{log.notes}"
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-slate-50/50">
                    <Button variant="ghost" size="sm" onClick={onClose} className="font-bold">Selesai</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PetDailyLogModal;
