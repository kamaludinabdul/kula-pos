
import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { supabase } from '../../supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Plus, Search, Pencil, Trash2, Ticket, Percent, Package } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const PromotionsList = () => {
    const { currentStore } = useData();
    const navigate = useNavigate();
    const [promotions, setPromotions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchPromotions = async () => {
        if (!currentStore?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('promotions')
                .select('*')
                .eq('store_id', currentStore.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPromotions(data || []);
        } catch (error) {
            console.error("Error fetching promotions:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPromotions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStore?.id]);

    const handleDelete = async (promoId) => {
        if (!window.confirm('Apakah Anda yakin ingin menghapus promo ini?')) return;
        try {
            const { error } = await supabase
                .from('promotions')
                .delete()
                .eq('id', promoId);

            if (error) throw error;
            fetchPromotions();
        } catch (error) {
            console.error("Error deleting promo:", error);
        }
    };

    const filteredPromotions = promotions.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getPromoIcon = (type) => {
        switch (type) {
            case 'bundle': return <Package className="h-4 w-4 text-purple-500" />;
            case 'percentage': return <Percent className="h-4 w-4 text-blue-500" />;
            default: return <Ticket className="h-4 w-4 text-green-500" />;
        }
    };

    const getStatusBadge = (promo) => {
        const now = new Date();
        const start = new Date(promo.start_date);
        const end = new Date(promo.end_date);

        if (!promo.is_active) return <Badge variant="secondary">Nonaktif</Badge>;
        if (now < start) return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Akan Datang</Badge>;
        if (now > end) return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Berakhir</Badge>;
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-green-200">Aktif</Badge>;
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Promosi & Diskon</h1>
                    <p className="text-muted-foreground">
                        Kelola diskon, voucher, dan paket bundling untuk meningkatkan penjualan.
                    </p>
                </div>
                <Button onClick={() => navigate('/promotions/new')} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Buat Promo Baru
                </Button>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle>Daftar Promo</CardTitle>
                        <div className="relative w-64">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Cari promo..."
                                className="pl-8"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nama Promo</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead>Periode</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Memuat...</TableCell>
                                </TableRow>
                            ) : filteredPromotions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada promo yang dibuat.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPromotions.map((promo) => (
                                    <TableRow key={promo.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex flex-col">
                                                <span>{promo.name}</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {promo.description || '-'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                {getPromoIcon(promo.type)}
                                                <span className="capitalize">{promo.type === 'fixed' ? 'Potongan Harga' : promo.type === 'percentage' ? 'Diskon %' : 'Bundling'}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {format(new Date(promo.start_date), 'dd MMM yyyy', { locale: id })} - {format(new Date(promo.end_date), 'dd MMM yyyy', { locale: id })}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(promo)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => navigate(`/promotions/edit/${promo.id}`)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(promo.id)}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
};

export default PromotionsList;
