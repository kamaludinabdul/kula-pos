import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Search, CheckCircle2, XCircle, LogOut, User, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const LoginHistory = () => {
    const { user } = useAuth();
    const { currentStore } = useData();
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [dateRange, setDateRange] = useState('week');

    const fetchLoginHistory = useCallback(async () => {
        setLoading(true);
        try {
            let query = supabase
                .from('audit_logs')
                .select('*');

            if (user?.role !== 'super_admin') {
                if (currentStore?.id) {
                    query = query.eq('store_id', currentStore.id);
                } else {
                    setHistory([]);
                    setLoading(false);
                    return;
                }
            }

            // Date Range Filter
            if (dateRange !== 'all') {
                const now = new Date();
                let startDate = new Date();

                if (dateRange === 'today') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                } else if (dateRange === 'week') {
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                } else if (dateRange === 'month') {
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                }
                query = query.gte('created_at', startDate.toISOString());
            }

            if (filterStatus !== 'all') {
                query = query.eq('status', filterStatus);
            }

            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(100);

            if (error) throw error;

            setHistory(data || []);
        } catch (error) {
            console.error("Error fetching login history:", error);
        } finally {
            setLoading(false);
        }
    }, [dateRange, filterStatus, user, currentStore]);

    useEffect(() => {
        fetchLoginHistory();
    }, [fetchLoginHistory]);

    const filteredHistory = history.filter(h =>
        (h.user_name || h.userName)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.store_name || h.storeName)?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusBadge = (status) => {
        switch (status) {
            case 'success':
                return (
                    <Badge className="bg-green-600 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Berhasil
                    </Badge>
                );
            case 'failed':
                return (
                    <Badge variant="destructive" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Gagal
                    </Badge>
                );
            case 'logout':
                return (
                    <Badge variant="outline" className="gap-1">
                        <LogOut className="h-3 w-3" />
                        Logout
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const stats = {
        totalLogins: history.filter(h => h.status === 'success').length,
        failedAttempts: history.filter(h => h.status === 'failed').length,
        uniqueUsers: new Set(history.filter(h => h.user_id || h.userId).map(h => h.user_id || h.userId)).size
    };

    return (
        <div className="p-4 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Riwayat Login</h1>
                    <p className="text-muted-foreground">Monitor aktivitas login pengguna</p>
                </div>
                <div className="flex items-center gap-2">
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Semua</SelectItem>
                            <SelectItem value="success">Berhasil</SelectItem>
                            <SelectItem value="failed">Gagal</SelectItem>
                            <SelectItem value="logout">Logout</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger className="w-[140px]">
                            <SelectValue placeholder="Periode" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="today">Hari Ini</SelectItem>
                            <SelectItem value="week">7 Hari</SelectItem>
                            <SelectItem value="month">30 Hari</SelectItem>
                            <SelectItem value="all">Semua</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            Login Berhasil
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">{stats.totalLogins}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            Percobaan Gagal
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600">{stats.failedAttempts}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <User className="h-4 w-4 text-blue-600" />
                            Pengguna Unik
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{stats.uniqueUsers}</div>
                    </CardContent>
                </Card>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-96">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Cari nama user atau toko..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                />
            </div>

            {/* History Table */}
            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Waktu</TableHead>
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Toko</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Device</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        Memuat data...
                                    </TableCell>
                                </TableRow>
                            ) : filteredHistory.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                        Tidak ada riwayat login
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredHistory.map(h => (
                                    <TableRow key={h.id}>
                                        <TableCell>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Clock className="h-4 w-4 text-muted-foreground" />
                                                <div>
                                                    <div>{new Date(h.created_at || h.loginTime).toLocaleDateString('id-ID')}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                        {new Date(h.created_at || h.loginTime).toLocaleTimeString('id-ID')}
                                                    </div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-medium">{h.user_name || h.userName}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {h.user_role || h.userRole || '-'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{h.store_name || h.storeName || '-'}</TableCell>
                                        <TableCell>{getStatusBadge(h.status)}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                            {(h.user_agent || h.userAgent) ? (h.user_agent || h.userAgent).split(' ').slice(0, 3).join(' ') : '-'}
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

export default LoginHistory;
