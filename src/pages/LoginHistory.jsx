import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { InfoCard } from '../components/ui/info-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Search, CheckCircle2, XCircle, LogOut, User, Clock, RefreshCw } from 'lucide-react';
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
                    <Badge variant="success-subtle" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Berhasil
                    </Badge>
                );
            case 'failed':
                return (
                    <Badge variant="error-subtle" className="gap-1">
                        <XCircle className="h-3 w-3" />
                        Gagal
                    </Badge>
                );
            case 'logout':
                return (
                    <Badge variant="neutral-subtle" className="gap-1">
                        <LogOut className="h-3 w-3" />
                        Logout
                    </Badge>
                );
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getRoleBadgeVariant = (role) => {
        const normalizedRole = (role || '').toLowerCase();
        if (normalizedRole.includes('owner')) return 'indigo-subtle';
        if (normalizedRole.includes('admin')) return 'purple-subtle';
        if (normalizedRole.includes('kasir') || normalizedRole.includes('cashier')) return 'info-subtle';
        return 'neutral-subtle';
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
                    <Button variant="outline" size="sm" onClick={fetchLoginHistory} disabled={loading}>
                        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
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
                <InfoCard
                    title="Login Berhasil"
                    value={stats.totalLogins}
                    icon={CheckCircle2}
                    variant="success"
                />
                <InfoCard
                    title="Percobaan Gagal"
                    value={stats.failedAttempts}
                    icon={XCircle}
                    variant="danger"
                />
                <InfoCard
                    title="Pengguna Unik"
                    value={stats.uniqueUsers}
                    icon={User}
                    variant="info"
                />
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

            {/* History List */}
            <Card className="rounded-xl border-none shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b bg-white">
                    <CardTitle className="text-lg font-bold">Detail Aktivitas</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Desktop View */}
                    <div className="hidden lg:block">
                        <Table>
                            <TableHeader className="bg-slate-50">
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
                                        <TableRow key={h.id} className="hover:bg-slate-50 transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <div>
                                                        <div className="font-medium text-slate-900">{new Date(h.created_at || h.loginTime).toLocaleDateString('id-ID')}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {new Date(h.created_at || h.loginTime).toLocaleTimeString('id-ID')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium text-slate-700">{h.user_name || h.userName}</TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={getRoleBadgeVariant(h.user_role || h.userRole)}
                                                    className="capitalize"
                                                >
                                                    {h.user_role || h.userRole || '-'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-600">{h.store_name || h.storeName || '-'}</TableCell>
                                            <TableCell>{getStatusBadge(h.status)}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                {(h.user_agent || h.userAgent) ? (h.user_agent || h.userAgent).split(' ').slice(0, 3).join(' ') : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile View */}
                    <div className="lg:hidden p-4 space-y-4 bg-slate-50/50">
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Memuat data...</div>
                        ) : filteredHistory.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">Tidak ada riwayat login</div>
                        ) : (
                            filteredHistory.map(h => (
                                <div key={h.id} className="bg-white rounded-xl p-4 shadow-sm border space-y-3 relative overflow-hidden">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-slate-800">{h.user_name || h.userName}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge
                                                    variant={getRoleBadgeVariant(h.user_role || h.userRole)}
                                                    className="text-[10px] h-5 px-1.5 capitalize"
                                                >
                                                    {h.user_role || h.userRole || '-'}
                                                </Badge>
                                                <span className="text-xs text-slate-500">{h.store_name || h.storeName || '-'}</span>
                                            </div>
                                        </div>
                                        {getStatusBadge(h.status)}
                                    </div>

                                    <div className="pt-2 border-t mt-2 flex items-center justify-between text-xs text-slate-500">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                                {new Date(h.created_at || h.loginTime).toLocaleDateString('id-ID')} • {new Date(h.created_at || h.loginTime).toLocaleTimeString('id-ID')}
                                            </span>
                                        </div>
                                        <div className="max-w-[120px] truncate" title={h.user_agent || h.userAgent}>
                                            {(h.user_agent || h.userAgent) || 'Unknown Device'}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default LoginHistory;
