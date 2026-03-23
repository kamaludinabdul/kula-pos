import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Plus, Edit2, Trash2, Shield, User, Circle, History, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { supabase } from '../supabase';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { safeSupabaseQuery } from '../utils/supabaseHelper';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import UpgradeAlert from '../components/UpgradeAlert';
import Pagination from '../components/Pagination';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { PERMISSION_SCHEMA, ROLE_PRESETS } from '../utils/permissions';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";

const Staff = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { activeStoreId } = useData();
    const [staffList, setStaffList] = useState([]);
    const [activeShifts, setActiveShifts] = useState([]);
    const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
    const [upgradeDebugInfo] = useState(null);

    // Dialog States
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '' });
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmData, setConfirmData] = useState({ title: '', message: '', onConfirm: null });

    // History State
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [staffHistory, setStaffHistory] = useState([]);
    const [selectedStaffName, setSelectedStaffName] = useState('');
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const historyItemsPerPage = 5;

    useEffect(() => {
        if (!activeStoreId) {
            setStaffList([]);
            return;
        }

        const fetchInitialData = async () => {
            const users = await safeSupabaseQuery({
                tableName: 'profiles',
                queryBuilder: (q) => q.eq('store_id', activeStoreId),
                fallbackParams: `?store_id=eq.${activeStoreId}`
            });

            if (users) {
                setStaffList(users.map(u => ({ ...u, storeId: u.store_id, petCareAccess: u.pet_care_access })));
            }

            const shifts = await safeSupabaseQuery({
                tableName: 'shifts',
                queryBuilder: (q) => q.eq('store_id', activeStoreId).eq('status', 'active'),
                fallbackParams: `?store_id=eq.${activeStoreId}&status=eq.active`
            });

            if (shifts) {
                setActiveShifts(shifts.map(s => ({
                    ...s,
                    startTime: s.start_time,
                    initialCash: s.initial_cash,
                    cashierName: s.cashier_name,
                    storeId: s.store_id
                })));
            }
        };

        fetchInitialData();

        const usersChannel = supabase.channel('staff-users')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles',
                filter: `store_id = eq.${activeStoreId} `
            }, (payload) => {
                if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                    const mappedProfile = {
                        ...payload.new,
                        storeId: payload.new.store_id,
                        petCareAccess: payload.new.pet_care_access
                    };
                    setStaffList(prev => {
                        const idx = prev.findIndex(u => u.id === payload.new.id);
                        if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = mappedProfile;
                            return next;
                        }
                        return [...prev, mappedProfile];
                    });
                } else if (payload.eventType === 'DELETE') {
                    setStaffList(prev => prev.filter(u => u.id !== payload.old.id));
                }
            })
            .subscribe();

        const shiftsChannel = supabase.channel('staff-active-shifts')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'shifts',
                filter: `store_id = eq.${activeStoreId} `
            }, (payload) => {
                const { eventType, new: newShift, old: oldShift } = payload;
                if ((eventType === 'INSERT' || eventType === 'UPDATE') && newShift.status === 'active') {
                    const mappedShift = {
                        ...newShift,
                        startTime: newShift.start_time,
                        initialCash: newShift.initial_cash,
                        cashierName: newShift.cashier_name,
                        storeId: newShift.store_id
                    };
                    setActiveShifts(prev => {
                        const idx = prev.findIndex(s => s.id === newShift.id);
                        if (idx >= 0) {
                            const next = [...prev];
                            next[idx] = mappedShift;
                            return next;
                        }
                        return [...prev, mappedShift];
                    });
                } else {
                    // If DELETE or status changed to closed
                    const shiftId = eventType === 'DELETE' ? oldShift.id : newShift.id;
                    setActiveShifts(prev => prev.filter(s => s.id !== shiftId));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(usersChannel);
            supabase.removeChannel(shiftsChannel);
        };
    }, [activeStoreId]);

    const showAlert = (title, message) => {
        setAlertData({ title, message });
        setIsAlertOpen(true);
    };

    const showConfirm = (title, message, onConfirm) => {
        setConfirmData({ title, message, onConfirm });
        setIsConfirmOpen(true);
    };

    const getStaffStatus = (staff) => {
        // Use the status field from user document (online/offline)
        // Fallback to checking active shifts if status field doesn't exist
        if (staff.status) {
            return staff.status === 'online' ? 'login' : 'logout';
        }
        const isActive = activeShifts.some(shift => (shift.cashierId || shift.cashier_id) === staff.id);
        return isActive ? 'login' : 'logout';
    };

    // Helper to determine if current user can manage target staff
    const canManageStaff = (targetStaff) => {
        if (!user) return false;
        if (user.role === 'super_admin') return true;
        if (user.role === 'owner') return targetStaff.role !== 'owner'; // Owner manages all except other owners

        // ADMIN POLICY: Can manage Staff, Sales, AND other Admins (but not Owner/SuperAdmin)
        if (user.role === 'admin') {
            return targetStaff.role !== 'owner' && targetStaff.role !== 'super_admin';
        }

        return false;
    };

    const handleAddStaff = () => {
        navigate('/staff/add');
    };

    const handleEditStaff = (staff) => {
        navigate(`/staff/edit/${staff.id}`);
    };

    const handleForceLogout = (staff) => {
        showConfirm(
            'Paksa Logout',
            `Apakah Anda yakin ingin memaksa logout ${staff.name}? Sesi mereka akan segera dihentikan.`,
            async () => {
                try {
                    const { error } = await supabase
                        .from('profiles')
                        .update({
                            last_force_logout_at: new Date().toISOString(),
                            status: 'offline'
                        })
                        .eq('id', staff.id);

                    if (error) throw error;
                    showAlert("Sukses", "Perintah logout paksa telah dikirim.");
                } catch (error) {
                    console.error("Error forcing logout:", error);
                    showAlert("Gagal", "Gagal melakukan force logout.");
                }
            }
        );
    };

    const handleDeleteStaff = (id) => {
        showConfirm(
            'Hapus Staff',
            'Apakah Anda yakin ingin menghapus staff ini?',
            async () => {
                try {
                    await supabase.from('profiles').delete().eq('id', id);
                } catch (error) {
                    console.error("Error deleting staff:", error);
                    showAlert("Gagal", "Gagal menghapus staff.");
                }
            }
        );
    };

    const handleViewHistory = async (staff) => {
        setSelectedStaffName(staff.name);
        setIsHistoryModalOpen(true);
        setIsLoadingHistory(true);
        setStaffHistory([]);
        setHistoryPage(1);

        try {
            const data = await safeSupabaseQuery({
                tableName: 'audit_logs',
                queryBuilder: (q) => q.eq('user_id', staff.id)
                    .order('created_at', { ascending: false })
                    .limit(100),
                fallbackParams: `?user_id=eq.${staff.id}&order=created_at.desc&limit=100`
            });
            setStaffHistory(data || []);
        } catch (error) {
            console.error("Error fetching login history:", error);
            showAlert("Gagal", "Gagal mengambil riwayat login: " + error.message);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // handlePhotoChange, registerUserToSupabase, and handleSubmit are now in StaffForm.jsx

    // Pagination Logic for History
    const indexOfLastHistory = historyPage * historyItemsPerPage;
    const indexOfFirstHistory = indexOfLastHistory - historyItemsPerPage;
    const currentHistory = staffHistory.slice(indexOfFirstHistory, indexOfLastHistory);

    return (
        <div className="p-4 space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manajemen Staff</h1>
                    <p className="text-muted-foreground mt-1">Kelola akses dan karyawan toko Anda.</p>
                </div>
                <Button onClick={handleAddStaff} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Tambah Staff
                </Button>
            </header>

            {/* Desktop Table View */}
            <Card className="hidden lg:block">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[80px] p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Foto</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nama</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</TableHead>
                                <TableHead className="p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</TableHead>
                                <TableHead className="text-right p-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {staffList.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        Belum ada staff di toko ini.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                staffList.map((staff) => {
                                    const status = getStaffStatus(staff);
                                    return (
                                        <TableRow key={staff.id}>
                                            <TableCell>
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden border border-primary/20">
                                                    {staff.photo ? (
                                                        <img src={staff.photo} alt={staff.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <span className="text-sm font-bold text-primary">
                                                            {staff.name ? staff.name.charAt(0).toUpperCase() : '?'}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-medium">
                                                <div className="flex flex-col">
                                                    <span>{staff.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        ID: {staff.email && staff.email.endsWith('@kula.id') ? staff.email.split('@')[0] : staff.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={
                                                        staff.role === 'owner' ? 'indigo-subtle' :
                                                            staff.role === 'admin' ? 'info-subtle' :
                                                                staff.role === 'sales' ? 'warning-subtle' :
                                                                    staff.role === 'dokter' ? 'primary-subtle' :
                                                                        staff.role === 'pramedic' ? 'teal-subtle' :
                                                                            staff.role === 'groomer' ? 'rose-subtle' :
                                                                                'neutral-subtle'
                                                    }
                                                    className="font-bold border-none uppercase text-[10px]"
                                                >
                                                    {staff.role === 'owner' ? 'Owner' : 
                                                     staff.role === 'admin' ? 'Admin' : 
                                                     staff.role === 'sales' ? 'Sales' : 
                                                     staff.role === 'dokter' ? 'Dokter' : 
                                                     staff.role === 'pramedic' ? 'Pramedic' : 
                                                     staff.role === 'groomer' ? 'Groomer' : 
                                                     'Kasir'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={status === 'login' ? 'success-subtle' : 'neutral-subtle'}
                                                    className="font-bold border-none uppercase text-[10px]"
                                                >
                                                    {status === 'login' ? 'Online' : 'Offline'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => handleViewHistory(staff)} title="Riwayat Login">
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                    {canManageStaff(staff) && (
                                                        <>
                                                            <Button variant="ghost" size="sm" onClick={() => handleEditStaff(staff)}>
                                                                <Edit2 className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleForceLogout(staff)}
                                                                className="text-amber-600 hover:text-amber-700"
                                                                title="Paksa Logout"
                                                            >
                                                                <Shield className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteStaff(staff.id)}
                                                                className="text-destructive hover:text-destructive"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
                {staffList.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-white rounded-xl border">
                        Belum ada staff di toko ini.
                    </div>
                ) : (
                    staffList.map((staff) => {
                        const status = getStaffStatus(staff);
                        return (
                            <div key={staff.id} className="bg-white rounded-xl border p-4 shadow-sm active:bg-slate-50 transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden border border-primary/20">
                                            {staff.photo ? (
                                                <img src={staff.photo} alt={staff.name} className="h-full w-full object-cover" />
                                            ) : (
                                                <span className="text-lg font-bold text-primary">
                                                    {staff.name ? staff.name.charAt(0).toUpperCase() : '?'}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{staff.name}</h3>
                                            <p className="text-xs text-slate-500">ID: {staff.email && staff.email.endsWith('@kula.id') ? staff.email.split('@')[0] : staff.email}</p>
                                        </div>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleViewHistory(staff)}>
                                                <History className="h-4 w-4 mr-2" />
                                                <span>Riwayat Login</span>
                                            </DropdownMenuItem>
                                            {canManageStaff(staff) && (
                                                <>
                                                    <DropdownMenuItem onClick={() => handleEditStaff(staff)}>
                                                        <Edit2 className="h-4 w-4 mr-2" />
                                                        <span>Edit Staff</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleForceLogout(staff)} className="text-amber-600 focus:text-amber-600">
                                                        <Shield className="h-4 w-4 mr-2" />
                                                        <span>Paksa Logout</span>
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleDeleteStaff(staff.id)} className="text-destructive focus:text-destructive">
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        <span>Hapus Staff</span>
                                                    </DropdownMenuItem>
                                                </>
                                            )}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t">
                                    <Badge
                                        variant={
                                            staff.role === 'owner' ? 'indigo-subtle' :
                                                staff.role === 'admin' ? 'info-subtle' :
                                                    staff.role === 'sales' ? 'warning-subtle' :
                                                        staff.role === 'dokter' ? 'primary-subtle' :
                                                            staff.role === 'pramedic' ? 'teal-subtle' :
                                                                staff.role === 'groomer' ? 'rose-subtle' :
                                                                    'neutral-subtle'
                                        }
                                        className="font-bold border-none uppercase text-[10px]"
                                    >
                                        {staff.role === 'owner' ? 'Owner' : 
                                         staff.role === 'admin' ? 'Admin' : 
                                         staff.role === 'sales' ? 'Sales' : 
                                         staff.role === 'dokter' ? 'Dokter' : 
                                         staff.role === 'pramedic' ? 'Pramedic' : 
                                         staff.role === 'groomer' ? 'Groomer' : 
                                         'Kasir'}
                                    </Badge>
                                    <Badge
                                        variant={status === 'login' ? 'success-subtle' : 'neutral-subtle'}
                                        className="font-bold border-none uppercase text-[10px]"
                                    >
                                        {status === 'login' ? 'Online' : 'Offline'}
                                    </Badge>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Staff Dialog is now replaced by /staff/add and /staff/edit/:id pages */}

            <Dialog open={isHistoryModalOpen} onOpenChange={setIsHistoryModalOpen}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Riwayat Login - {selectedStaffName}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        {isLoadingHistory ? (
                            <div className="text-center py-8 text-muted-foreground">Memuat riwayat...</div>
                        ) : (
                            <>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Waktu</TableHead>
                                            <TableHead>Aktivitas</TableHead>
                                            <TableHead>Device</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {currentHistory.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                    Belum ada riwayat login.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            currentHistory.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell>
                                                        <div>
                                                            <div>{new Date(log.created_at).toLocaleDateString('id-ID')}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {new Date(log.created_at).toLocaleTimeString('id-ID')}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={
                                                            log.status === 'success' ? 'default' :
                                                                log.status === 'logout' ? 'secondary' :
                                                                    'destructive'
                                                        }>
                                                            {log.status === 'success' ? 'Login Berhasil' :
                                                                log.status === 'logout' ? 'Logout' :
                                                                    'Login Gagal'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                                                        {log.userAgent ? log.userAgent.split(' ').slice(0, 3).join(' ') : '-'}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                                <Pagination
                                    currentPage={historyPage}
                                    totalItems={staffHistory.length}
                                    itemsPerPage={historyItemsPerPage}
                                    onPageChange={setHistoryPage}
                                />
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            <UpgradeAlert
                isOpen={showUpgradeAlert}
                onClose={() => setShowUpgradeAlert(false)}
                title="Batas Staff Tercapai"
                description={
                    upgradeDebugInfo
                        ? `Plan: ${upgradeDebugInfo?.plan || 'Unknown'} | Limit: ${upgradeDebugInfo?.limit || 'Unknown'} | Terpakai: ${upgradeDebugInfo?.currentCount || 'Unknown'}. Upgrade untuk menambah slot.`
                        : "DEBUG: SYSTEM ERROR - PLAN NOT DETECTED. (Code Updated)"
                }
                benefits={[
                    "Hingga 5 Staff / Kasir",
                    "Produk Tanpa Batas",
                    "Laporan Keuangan Lengkap",
                    "Manajemen Stok Lanjutan"
                ]}
            />

            <AlertDialog
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertData.title}
                message={alertData.message}
            />

            <ConfirmDialog
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                title={confirmData.title}
                message={confirmData.message}
                onConfirm={confirmData.onConfirm}
            />
        </div >
    );
};

export default Staff;
