import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { Calendar, Clock, User, FileText, Download } from 'lucide-react';
import { exportToCSV } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { Badge } from '../../components/ui/badge';

import { useShift } from '../../context/ShiftContext';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { Ban } from 'lucide-react';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import ShiftDetailsDialog from './ShiftDetailsDialog';

import { SmartDatePicker } from '../../components/SmartDatePicker';

// ... (other imports)

const ShiftReport = () => {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    // Initialize with current month
    const [datePickerDate, setDatePickerDate] = useState({
        from: new Date(new Date().setHours(0, 0, 0, 0)),
        to: new Date()
    });
    const { terminateShift } = useShift();
    const { user } = useAuth();
    const { currentStore } = useData();

    // Terminate Modal State
    const [isTerminateModalOpen, setIsTerminateModalOpen] = useState(false);
    const [shiftToTerminate, setShiftToTerminate] = useState(null);
    const [terminateReason, setTerminateReason] = useState('');

    // Details Modal State
    const [selectedShift, setSelectedShift] = useState(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const handleTerminateClick = (shift) => {
        setShiftToTerminate(shift);
        setTerminateReason('Dihentikan paksa oleh Admin');
        setIsTerminateModalOpen(true);
    };

    const confirmTerminate = async () => {
        if (!shiftToTerminate) return;

        const result = await terminateShift(shiftToTerminate.id, terminateReason);
        if (result.success) {
            alert('Shift berhasil dihentikan.');
            fetchShifts(); // Refresh list
            setIsTerminateModalOpen(false);
            setShiftToTerminate(null);
        } else {
            alert('Gagal menghentikan shift.');
        }
    };
    const fetchShifts = useCallback(async () => {
        setLoading(true);
        try {
            let queryBuilder = supabase
                .from('shifts')
                .select('*')
                .eq('store_id', currentStore.id)
                .order('start_time', { ascending: false });

            if (datePickerDate?.from) {
                const startDate = datePickerDate.from;
                const endDate = datePickerDate.to || datePickerDate.from;
                const queryEndDate = new Date(endDate);
                queryEndDate.setHours(23, 59, 59, 999);

                queryBuilder = queryBuilder
                    .gte('start_time', startDate.toISOString())
                    .lte('start_time', queryEndDate.toISOString());
            }

            const { data, error } = await queryBuilder;
            if (error) throw error;

            setShifts(data || []);
        } catch (error) {
            console.error("Error fetching shifts:", error);
        } finally {
            setLoading(false);
        }
    }, [datePickerDate, currentStore]);

    useEffect(() => {
        fetchShifts();
    }, [fetchShifts]);

    // ... (handlers remain)

    const handleExport = () => {
        const dataToExport = shifts.map(shift => ({
            "Waktu Mulai": new Date(shift.start_time).toLocaleString('id-ID'),
            "Waktu Selesai": shift.end_time ? new Date(shift.end_time).toLocaleString('id-ID') : 'Aktif',
            "Kasir": shift.cashier_name,
            "Modal Awal": shift.initial_cash,
            "Total Penjualan": shift.total_sales,
            "Uang Akhir": shift.final_cash || 0,
            "Selisih": shift.cash_difference || 0,
            "Status": shift.status,
            "Catatan": shift.notes || ''
        }));

        exportToCSV(dataToExport, `Laporan_Shift_${new Date().toISOString().split('T')[0]}.csv`);
    };

    return (
        <div className="space-y-6">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Laporan Shift</h2>
                        <p className="text-muted-foreground">Riwayat shift kasir dan ringkasan penjualan.</p>
                    </div>
                    <Button variant="outline" onClick={handleExport}>
                        <Download className="mr-2 h-4 w-4" />
                        Export CSV
                    </Button>
                </div>

                <div className="flex justify-start">
                    <SmartDatePicker
                        date={datePickerDate}
                        onDateChange={setDatePickerDate}
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Laporan Shift</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Waktu Mulai</TableHead>
                                    <TableHead>Waktu Selesai</TableHead>
                                    <TableHead>Kasir</TableHead>
                                    <TableHead>Modal Awal</TableHead>
                                    <TableHead>Total Penjualan</TableHead>
                                    <TableHead>Total Diskon</TableHead>
                                    <TableHead>Tunai</TableHead>
                                    <TableHead>Non-Tunai</TableHead>
                                    <TableHead>Kas Masuk</TableHead>
                                    <TableHead>Kas Keluar</TableHead>
                                    <TableHead>Uang Akhir (Aktual)</TableHead>
                                    <TableHead>Selisih</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Catatan</TableHead>
                                    <TableHead className="text-right">Aksi</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                                            Memuat data...
                                        </TableCell>
                                    </TableRow>
                                ) : shifts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={14} className="text-center py-8 text-muted-foreground">
                                            Tidak ada data shift.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    shifts.map(shift => (
                                        <TableRow key={shift.id}>
                                            <TableCell>
                                                <div className="flex flex-col text-xs">
                                                    <div className="flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(shift.start_time).toLocaleDateString()}
                                                    </div>
                                                    <div className="flex items-center gap-1 text-muted-foreground">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(shift.start_time).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {shift.end_time ? (
                                                    <div className="flex items-center gap-1 text-xs">
                                                        <Clock className="h-3 w-3" />
                                                        {new Date(shift.end_time).toLocaleTimeString()}
                                                    </div>
                                                ) : (
                                                    <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Aktif</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <User className="h-3 w-3" />
                                                    {shift.cashier_name}
                                                </div>
                                            </TableCell>
                                            <TableCell>Rp {shift.initial_cash?.toLocaleString()}</TableCell>
                                            <TableCell className="font-bold">Rp {shift.total_sales?.toLocaleString()}</TableCell>
                                            <TableCell className="text-red-500 font-medium">
                                                {shift.total_discount > 0 ? `Rp ${shift.total_discount.toLocaleString()}` : '-'}
                                            </TableCell>
                                            <TableCell className="text-green-600">Rp {(shift.total_cash_sales || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-blue-600">Rp {(shift.total_non_cash_sales || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-green-600">+ Rp {(shift.total_cash_in || 0).toLocaleString()}</TableCell>
                                            <TableCell className="text-red-600">- Rp {(shift.total_cash_out || 0).toLocaleString()}</TableCell>
                                            <TableCell>
                                                {shift.final_cash !== undefined
                                                    ? `Rp ${shift.final_cash.toLocaleString()}`
                                                    : '-'}
                                            </TableCell>
                                            <TableCell>
                                                {shift.cash_difference !== undefined ? (
                                                    <span className={shift.cash_difference < 0 ? 'text-red-500 font-bold' : 'text-green-500 font-bold'}>
                                                        {shift.cash_difference < 0 ? '-' : '+'} Rp {Math.abs(shift.cash_difference).toLocaleString()}
                                                    </span>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={shift.status === 'active' ? "outline" : "secondary"} className={shift.status === 'active' ? "text-yellow-600 border-yellow-200 bg-yellow-50" : ""}>
                                                    {shift.status === 'active' ? 'Aktif' : 'Selesai'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[150px]">
                                                {shift.notes ? (
                                                    <div className="flex items-center gap-1 text-xs" title={shift.notes}>
                                                        <FileText className="h-3 w-3" />
                                                        <span className="truncate">{shift.notes}</span>
                                                    </div>
                                                ) : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setSelectedShift(shift);
                                                            setIsDetailsOpen(true);
                                                        }}
                                                    >
                                                        Detail
                                                    </Button>
                                                    {(user?.role === 'owner' || user?.role === 'super_admin' || (user?.role === 'admin' && user?.permissions?.includes('shifts.close_others'))) && shift.status === 'active' && (
                                                        <Button
                                                            variant="destructive"
                                                            size="sm"
                                                            onClick={() => handleTerminateClick(shift)}
                                                            title="Hentikan Shift Paksa"
                                                        >
                                                            <Ban className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Terminate Confirmation Modal */}
            <Dialog open={isTerminateModalOpen} onOpenChange={setIsTerminateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Konfirmasi Penghentian Shift</DialogTitle>
                        <DialogDescription>
                            Tindakan ini akan menutup paksa sesi shift kasir <b>{shiftToTerminate?.cashier_name}</b>.
                            Kasir tidak akan bisa melanjutkan transaksi sampai shift baru dibuka.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="reason">Alasan Penghentian</Label>
                            <Input
                                id="reason"
                                placeholder="Contoh: Kesalahan input modal, pergantian mendadak, dll."
                                value={terminateReason}
                                onChange={(e) => setTerminateReason(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTerminateModalOpen(false)}>Batal</Button>
                        <Button variant="destructive" onClick={confirmTerminate}>Hentikan Shift</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ShiftDetailsDialog
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                shift={selectedShift}
            />
        </div>
    );
};

export default ShiftReport;
