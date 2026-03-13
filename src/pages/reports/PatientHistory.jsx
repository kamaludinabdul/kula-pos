import React, { useState } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import {
    Search,
    User,
    History,
    Calendar,
    Pill,
    ChevronRight,
    RefreshCw,
    Phone,
    FileText
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const PatientHistory = () => {
    const { activeStoreId, customers } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchHistory = async (patientName) => {
        if (!activeStoreId) return;
        setLoading(true);
        try {
            // We search in transactions where either patient_name matches or customer_id matches
            // If they are a member, customer_name might be the source of truth
            let query = supabase
                .from('transactions')
                .select('*')
                .eq('store_id', activeStoreId)
                .order('date', { ascending: false });

            if (selectedPatient?.id) {
                query = query.eq('customer_id', selectedPatient.id);
            } else {
                // If no member selected, search by patient_name (from prescription form)
                query = query.ilike('patient_name', `%${patientName}%`);
            }

            const { data, error } = await query.limit(50);
            if (error) throw error;
            setHistory(data || []);
        } catch (error) {
            console.error("Gagal memuat riwayat pasien:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!searchTerm.trim()) return;
        // Search in local customers first
        const found = customers.find(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm)
        );

        if (found) {
            setSelectedPatient(found);
            fetchHistory(found.name, found.phone);
        } else {
            setSelectedPatient(null);
            fetchHistory(searchTerm, '');
        }
    };

    return (
        <div className="p-4 space-y-6 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <History className="h-6 w-6 text-indigo-600" />
                        Riwayat Obat Pasien
                    </h1>
                    <p className="text-slate-500">Pantau penggunaan obat dan riwayat resep pasien untuk keamanan klinis.</p>
                </div>
            </div>

            <Card className="border-indigo-100 shadow-sm">
                <CardContent className="p-6">
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Cari Nama Pasien atau No. HP..."
                                className="pl-10 h-11 border-slate-200 focus:ring-indigo-500"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                        </div>
                        <Button onClick={handleSearch} disabled={loading} className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700">
                            {loading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                            Cari
                        </Button>
                    </div>

                    {selectedPatient && (
                        <div className="mt-4 p-4 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-4 animate-in fade-in slide-in-from-top-2">
                            <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center shadow-sm text-indigo-600 border border-indigo-100">
                                <User size={24} />
                            </div>
                            <div className="flex-1">
                                <div className="font-bold text-slate-900">{selectedPatient.name}</div>
                                <div className="text-xs text-slate-500 flex items-center gap-3 mt-1">
                                    <span className="flex items-center gap-1"><Phone size={12} /> {selectedPatient.phone || '-'}</span>
                                    <span className="flex items-center gap-1 font-bold text-amber-600 bg-amber-50 px-1.5 rounded">{selectedPatient.loyaltyPoints || 0} Poin</span>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <RefreshCw className="h-10 w-10 animate-spin opacity-20" />
                    <p className="italic">Memuat riwayat...</p>
                </div>
            ) : history.length > 0 ? (
                <div className="space-y-4">
                    {history.map((tx) => (
                        <Card key={tx.id} className="border-slate-200 shadow-sm hover:border-indigo-200 transition-colors">
                            <CardHeader className="bg-slate-50/50 py-3 px-6 border-b flex flex-row items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                        <Calendar className="h-3.5 w-3.5" />
                                        {format(new Date(tx.date), 'dd MMMM yyyy HH:mm', { locale: id })}
                                    </div>
                                    <Badge variant="outline" className="text-[10px] bg-white">#{tx.id.slice(0, 8)}</Badge>
                                </div>
                                <div className="text-sm font-bold text-indigo-600">
                                    Rp {tx.total?.toLocaleString('id-ID')}
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-white pointer-events-none">
                                        <TableRow className="hover:bg-transparent border-0">
                                            <TableHead className="h-8 text-[10px] font-bold uppercase py-2">Nama Obat</TableHead>
                                            <TableHead className="h-8 text-[10px] font-bold uppercase text-center py-2">Qty</TableHead>
                                            <TableHead className="h-8 text-[10px] font-bold uppercase py-2">Aturan Pakai / Catatan</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {tx.items?.map((item, idx) => (
                                            <TableRow key={idx} className="border-slate-50">
                                                <TableCell className="py-3">
                                                    <div className="flex items-center gap-2">
                                                        <Pill className="h-3.5 w-3.5 text-indigo-400" />
                                                        <span className="font-medium text-slate-900">{item.name}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center text-slate-600 text-sm">
                                                    {item.qty} {item.unit || item.selectedUnit || 'pcs'}
                                                </TableCell>
                                                <TableCell>
                                                    {(item.aturanPakai || item.aturan_pakai) ? (
                                                        <Badge className="bg-green-50 text-green-700 border-green-100 hover:bg-green-100 font-bold">
                                                            {item.aturanPakai || item.aturan_pakai}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-300 italic text-xs">-</span>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>

                                {/* Prescription Metadata if present */}
                                {(tx.doctor_name || tx.prescription_number) && (
                                    <div className="p-4 bg-slate-50/30 border-t border-slate-100 flex gap-6 text-xs text-slate-500 italic">
                                        {tx.doctor_name && <span className="flex items-center gap-1.5 text-slate-600 font-medium"><FileText size={14} className="text-slate-400" /> Dokter: {tx.doctor_name}</span>}
                                        {tx.prescription_number && <span className="flex items-center gap-1.5"><ChevronRight size={14} /> No. Resep: {tx.prescription_number}</span>}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : searchTerm ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4 bg-white border border-dashed rounded-xl">
                    <History className="h-16 w-16 opacity-10" />
                    <div className="text-center">
                        <p className="font-medium">Tidak ada riwayat ditemukan</p>
                        <p className="text-sm opacity-60">Tidak ada transaksi terdaftar untuk "{searchTerm}"</p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-4 bg-white border border-dashed rounded-xl">
                    <History className="h-16 w-16 opacity-10" />
                    <p className="italic">Masukkan nama pasien untuk melihat riwayat obat.</p>
                </div>
            )}
        </div>
    );
};

export default PatientHistory;
