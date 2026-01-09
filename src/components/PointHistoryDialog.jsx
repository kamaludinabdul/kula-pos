import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Loader2 } from 'lucide-react';

const PointHistoryDialog = ({ open, onOpenChange, customer }) => {
    const { getPointAdjustmentHistory } = useData();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            const result = await getPointAdjustmentHistory(customer.id);
            setLoading(false);

            if (result.success) {
                setHistory(result.data);
            } else {
                console.error('Failed to fetch history:', result.error);
                setHistory([]);
            }
        };

        if (open && customer) {
            fetchHistory();
        }
    }, [open, customer, getPointAdjustmentHistory]);

    const getTypeBadge = (type) => {
        switch (type) {
            case 'addition':
                return <Badge variant="default" className="bg-green-500">Penambahan</Badge>;
            case 'deduction':
                return <Badge variant="destructive">Pengurangan</Badge>;
            case 'expiry_reset':
                return <Badge variant="secondary">Reset Expired</Badge>;
            default:
                return <Badge>{type}</Badge>;
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (!customer) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>History Penyesuaian Poin</DialogTitle>
                    <DialogDescription>
                        {customer.name} - Total Poin: <span className="font-bold">{customer.loyaltyPoints || 0}</span>
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : history.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Belum ada history penyesuaian poin
                    </div>
                ) : (
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Tanggal</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead className="text-right">Jumlah</TableHead>
                                    <TableHead>Alasan</TableHead>
                                    <TableHead>Oleh</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {history.map((record) => (
                                    <TableRow key={record.id}>
                                        <TableCell className="text-sm">
                                            {formatDate(record.date)}
                                        </TableCell>
                                        <TableCell>
                                            {getTypeBadge(record.type)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            <span className={record.amount > 0 ? 'text-green-600' : 'text-red-600'}>
                                                {record.amount > 0 ? '+' : ''}{record.amount}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-sm max-w-[200px] truncate" title={record.reason}>
                                            {record.reason}
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {record.performedByName}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default PointHistoryDialog;
