import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Users, Plus, Edit2, Trash2, Shield, User, Circle, History, Eye, EyeOff } from 'lucide-react';
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
import { PERMISSION_SCHEMA, getPermissionsForRole, ROLE_PRESETS } from '../utils/permissions';
import { ChevronDown, ChevronRight, Check } from 'lucide-react';

const Staff = () => {
    const { user, updateStaffPassword } = useAuth();
    const { activeStoreId, addUser } = useData();
    const [staffList, setStaffList] = useState([]);
    const [activeShifts, setActiveShifts] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentStaff, setCurrentStaff] = useState({ name: '', email: '', role: 'staff', pin: '', photo: '' });
    const [permissions, setPermissions] = useState([]);
    const [showPermissions, setShowPermissions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [showUpgradeAlert, setShowUpgradeAlert] = useState(false);
    const [upgradeDebugInfo, setUpgradeDebugInfo] = useState(null);

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
    const [showPassword, setShowPassword] = useState(false);

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
        setCurrentStaff({ name: '', email: '', role: 'staff', password: '', photo: '', petCareAccess: false });
        // Set default permissions for new staff based on 'staff' role
        setPermissions(getPermissionsForRole('staff'));
        setIsEditing(false);
        setShowPassword(false);
        setShowPermissions(false); // Collapse by default
        setIsModalOpen(true);
    };

    const handleEditStaff = (staff) => {
        // If staff has pin but no password (legacy), use pin as password
        const staffData = {
            ...staff,
            password: staff.password || staff.pin || '',
            petCareAccess: staff.petCareAccess || false
        };

        // Clean up email for display (if dummy)
        if (staffData.email && staffData.email.endsWith('@kula.id')) {
            staffData.email = staffData.email.split('@')[0];
        }

        setCurrentStaff(staffData);
        // Load existing permissions OR fallback to defaults if empty (legacy)
        if (staff.permissions && staff.permissions.length > 0) {
            setPermissions(staff.permissions);
        } else {
            setPermissions(getPermissionsForRole(staff.role));
        }

        setIsEditing(true);
        setShowPassword(false);
        setShowPermissions(false);
        setIsModalOpen(true);
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

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentStaff(prev => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    /**
     * Registers a new user in Supabase Auth using a temporary client.
     * This avoids logging out the current admin.
     */
    // Dummy storage to prevent "Multiple GoTrueClient" warnings
    const dummyStorage = {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
    };

    const registerUserToSupabase = async (email, password, name, role, storeId) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        // Create a temporary client with NO persistence to isolate session
        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storage: dummyStorage // Isolate storage completely
            }
        });

        try {

            const { data, error } = await tempClient.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name || 'Staff Member',
                        role: role || 'staff',
                        store_name: 'No Store Name', // Legacy requirement potentially
                        store_id: storeId, // CRITICAL: Required for profiles trigger
                        // Mark as staff registration to potentially handle differently in triggers if needed
                        is_staff_registration: true,
                        permissions: permissions // Initialize granular permissions
                    }
                }
            });

            if (error) throw error;
            return { success: true, user: data.user, session: data.session };
        } catch (error) {
            // If user already exists, try to LOGIN to get the ID (Recover Orphaned Account)
            if (error.message && error.message.includes('already registered')) {
                try {
                    const { data: loginData, error: loginError } = await tempClient.auth.signInWithPassword({
                        email,
                        password
                    });
                    if (loginError) throw loginError;
                    // Success! We recovered the existing user's ID
                    return { success: true, user: loginData.user, session: loginData.session, recovered: true };
                } catch (loginErr) { // eslint-disable-line no-unused-vars
                    return { success: false, error: "Email sudah terdaftar tapi password salah. Gunakan password asli atau email baru." };
                }
            }

            console.error("Auto-registration failed:", error);
            return { success: false, error: error.message };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeStoreId) {
            showAlert("Error", "Terjadi kesalahan: Tidak ada toko yang aktif.");
            return;
        }

        try {
            // Auto-generate email from username if needed
            let finalEmail = currentStaff.email ? currentStaff.email.trim().toLowerCase() : '';
            if (finalEmail && !finalEmail.includes('@')) {
                finalEmail = `${finalEmail.replace(/\s+/g, '')}@kula.id`;
            }

            if (isEditing) {
                // NOTE: Retroactive registration (converting manual staff to auth user) is disabled
                // because we cannot force the Auth UUID to match the existing Profile UUID from client-side.
                // Doing so causes FK violations or Duplicate Key errors.
                // For now, we only update the local profile. To enable login, user must recreate staff.

                /* 
                // DISABLED: 
                if (currentStaff.password && currentStaff.password.length >= 6) {
                    const regResult = await registerUserToSupabase(finalEmail, currentStaff.password, currentStaff.name, currentStaff.role, activeStoreId);
                    // ... error handling ...
                } 
                */

                const { error } = await supabase
                    .from('profiles')
                    .update({
                        name: currentStaff.name,
                        email: finalEmail || '',
                        role: currentStaff.role,
                        password: currentStaff.password,
                        pin: currentStaff.password,
                        photo: currentStaff.photo || '',
                        pet_care_access: currentStaff.petCareAccess || false,
                        permissions: permissions // Save granular permissions
                    })
                    .eq('id', currentStaff.id);

                if (error) throw error;

                // Update Real Password...
                if (currentStaff.password && currentStaff.password.length >= 6) {
                    const pwdResult = await updateStaffPassword(currentStaff.id, currentStaff.password);
                    if (!pwdResult.success) {
                        showAlert("Peringatan", "Data tersimpan TAPI password gagal diubah: " + pwdResult.message);
                        return;
                    }
                }
            } else {
                // 1. Auto-Register in Supabase Auth (If password provided)
                let authId = null;
                if (currentStaff.password && currentStaff.password.length >= 6) {
                    const regResult = await registerUserToSupabase(finalEmail, currentStaff.password, currentStaff.name, currentStaff.role, activeStoreId);
                    if (regResult.success) {
                        if (regResult.user) authId = regResult.user.id;
                    } else {
                        // Warn but proceed? Or block? 
                        // Let's block to force consistent data
                        showAlert("Gagal Registrasi Akun", "Gagal mendaftarkan akun login: " + regResult.error);
                        return;
                    }
                }

                const result = await addUser({
                    id: authId, // Use the real Auth ID if available!
                    name: currentStaff.name,
                    email: finalEmail,
                    role: currentStaff.role,
                    password: currentStaff.password,
                    pin: currentStaff.password, // Keep pin synced for backward compatibility
                    photo: currentStaff.photo || '',
                    pet_care_access: currentStaff.petCareAccess || false,
                    store_id: activeStoreId,
                    permissions: permissions // Save granular permissions
                });

                if (!result.success) {
                    if (result.isLimitError) {
                        setUpgradeDebugInfo(result.debugInfo);
                        setIsModalOpen(false); // Close the form modal
                        setShowUpgradeAlert(true); // Show upgrade alert
                    } else {
                        showAlert("Gagal", result.error || "Gagal menambahkan staff.");
                    }
                    return;
                }
            }
            setIsModalOpen(false);
            showAlert(
                "Berhasil",
                isEditing ? "Data staff berhasil diperbarui!" : "Staff baru berhasil ditambahkan!"
            );
        } catch (error) {
            console.error("Error saving staff:", error);
            showAlert("Gagal", "Gagal menyimpan data staff.");
        }
    };

    // Pagination Logic for History
    const indexOfLastHistory = historyPage * historyItemsPerPage;
    const indexOfFirstHistory = indexOfLastHistory - historyItemsPerPage;
    const currentHistory = staffHistory.slice(indexOfFirstHistory, indexOfLastHistory);

    return (
        <div className="p-4 space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Manajemen Staff</h1>
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
                                <TableHead className="w-[80px]">Foto</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
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
                                                <Badge variant={staff.role === 'owner' ? 'default' : staff.role === 'admin' ? 'default' : staff.role === 'sales' ? 'outline' : 'secondary'}>
                                                    {staff.role === 'owner' ? 'Owner' : staff.role === 'admin' ? 'Administrator' : staff.role === 'sales' ? 'Sales' : 'Kasir'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Circle className={`h-3 w-3 fill-current ${status === 'login' ? 'text-green-500' : 'text-gray-300'}`} />
                                                    <span className={status === 'login' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                                        {status === 'login' ? 'Sedang Login' : 'Logout'}
                                                    </span>
                                                </div>
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
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleViewHistory(staff)}>
                                            <History className="h-4 w-4" />
                                        </Button>
                                        {canManageStaff(staff) && (
                                            <>
                                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditStaff(staff)}>
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-amber-500"
                                                    onClick={() => handleForceLogout(staff)}
                                                >
                                                    <Shield className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-red-500"
                                                    onClick={() => handleDeleteStaff(staff.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-3 border-t">
                                    <Badge variant={staff.role === 'owner' ? 'default' : staff.role === 'admin' ? 'default' : staff.role === 'sales' ? 'outline' : 'secondary'}>
                                        {staff.role === 'owner' ? 'Owner' : staff.role === 'admin' ? 'Administrator' : staff.role === 'sales' ? 'Sales' : 'Kasir'}
                                    </Badge>
                                    <div className="flex items-center gap-2">
                                        <Circle className={`h-2.5 w-2.5 fill-current ${status === 'login' ? 'text-green-500' : 'text-gray-300'}`} />
                                        <span className={`text-xs ${status === 'login' ? 'text-green-600 font-bold' : 'text-slate-400 font-medium'}`}>
                                            {status === 'login' ? 'ONLINE' : 'OFFLINE'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Edit Staff' : 'Tambah Staff Baru'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="staffName">Nama Lengkap</Label>
                            <Input
                                id="staffName"
                                type="text"
                                value={currentStaff.name}
                                onChange={(e) => setCurrentStaff({ ...currentStaff, name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffEmail">Username / Email (Login ID)</Label>
                            <Input
                                id="staffEmail"
                                type="text"
                                value={currentStaff.email || ''}
                                onChange={(e) => setCurrentStaff({ ...currentStaff, email: e.target.value })}
                                placeholder="Contoh: 'kasir1' atau 'kasir1@email.com'"
                            />
                            <p className="text-xs text-muted-foreground">
                                Tips: Gunakan username saja (misal: <span className="font-semibold">budi</span>) untuk login instan tanpa verifikasi email.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffPassword">Password / PIN Login {isEditing ? '(Opsional)' : ''}</Label>
                            <div className="relative">
                                <Input
                                    id="staffPassword"
                                    type={showPassword ? "text" : "password"}
                                    value={currentStaff.password || ''}
                                    onChange={(e) => setCurrentStaff({ ...currentStaff, password: e.target.value })}
                                    placeholder={isEditing ? "(Biarkan kosong jika tidak diubah)" : "Minimal 6 karakter"}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffPhoto">Foto Profil</Label>
                            <div className="flex items-center gap-4">
                                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center overflow-hidden border">
                                    {currentStaff.photo ? (
                                        <img src={currentStaff.photo} alt="Preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-8 w-8 text-muted-foreground" />
                                    )}
                                </div>
                                <Input
                                    id="staffPhoto"
                                    type="file"
                                    accept="image/*"
                                    onChange={handlePhotoChange}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="staffRole">Role / Peran</Label>
                            <Select
                                value={currentStaff.role}
                                onValueChange={(value) => {
                                    setCurrentStaff({ ...currentStaff, role: value });
                                    // Auto-update permissions when role changes (if user hasn't explicitly customized yet? 
                                    // Or just overwrite? UX decision: Overwrite to helpful defaults is safer.)
                                    setPermissions(getPermissionsForRole(value));
                                }}
                            >
                                <SelectTrigger id="staffRole">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="staff">Kasir</SelectItem>
                                    <SelectItem value="sales">Sales</SelectItem>
                                    <SelectItem value="admin">Administrator</SelectItem>
                                    {(user?.role === 'super_admin' || user?.role === 'owner') && (
                                        <SelectItem value="owner">Owner (Pemilik)</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* --- PERMISSION EDITOR --- */}
                        <div className="border rounded-md p-3 bg-slate-50">
                            <button
                                type="button"
                                onClick={() => setShowPermissions(!showPermissions)}
                                className="flex items-center justify-between w-full text-sm font-medium text-slate-700"
                            >
                                <span>Kelola Hak Akses (Advanced)</span>
                                {showPermissions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>

                            {showPermissions && (
                                <div className="mt-3 space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                    <div className="flex justify-between mb-2">
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-6"
                                                onClick={() => {
                                                    const allIds = PERMISSION_SCHEMA.flatMap(g => g.children.map(c => c.id));
                                                    setPermissions(allIds);
                                                }}
                                            >
                                                Pilih Semua
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="text-xs h-6"
                                                onClick={() => setPermissions([])}
                                            >
                                                Hapus Semua
                                            </Button>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs h-6 text-muted-foreground"
                                            onClick={() => setPermissions(getPermissionsForRole(currentStaff.role))}
                                        >
                                            Reset ke Default Role
                                        </Button>
                                    </div>
                                    {PERMISSION_SCHEMA.map((group) => {
                                        const groupChildrenIds = group.children.map(c => c.id);
                                        const isAllChecked = groupChildrenIds.every(id => permissions.includes(id));
                                        const isIndeterminate = groupChildrenIds.some(id => permissions.includes(id)) && !isAllChecked;

                                        const toggleGroup = () => {
                                            if (isAllChecked) {
                                                // Uncheck all
                                                setPermissions(prev => prev.filter(p => !groupChildrenIds.includes(p)));
                                            } else {
                                                // Check all (merge unique)
                                                setPermissions(prev => [...new Set([...prev, ...groupChildrenIds])]);
                                            }
                                        };

                                        return (
                                            <div key={group.id} className="space-y-2">
                                                <div className="flex items-center gap-2 bg-white p-2 rounded border shadow-sm">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                                                        checked={isAllChecked}
                                                        ref={input => {
                                                            if (input) input.indeterminate = isIndeterminate;
                                                        }}
                                                        onChange={toggleGroup}
                                                    />
                                                    <span className="font-semibold text-sm">{group.label}</span>
                                                </div>
                                                <div className="ml-6 space-y-1">
                                                    {group.children.map(child => (
                                                        <label key={child.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-gray-300 text-primary focus:ring-primary h-3.5 w-3.5"
                                                                checked={permissions.includes(child.id)}
                                                                onChange={(e) => {
                                                                    if (e.target.checked) {
                                                                        setPermissions(prev => [...prev, child.id]);
                                                                    } else {
                                                                        setPermissions(prev => prev.filter(p => p !== child.id));
                                                                    }
                                                                }}
                                                            />
                                                            <span className="text-slate-600">{child.label}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-2 pt-2">
                            <input
                                type="checkbox"
                                id="petCareAccess"
                                checked={currentStaff.petCareAccess}
                                onChange={(e) => setCurrentStaff({ ...currentStaff, petCareAccess: e.target.checked })}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <Label htmlFor="petCareAccess" className="font-medium cursor-pointer">
                                Berikan Akses ke Aplikasi Pet Care
                            </Label>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                                Batal
                            </Button>
                            <Button type="submit">Simpan</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog >

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
                        ? `Plan: ${upgradeDebugInfo.plan} | Limit: ${upgradeDebugInfo.limit} | Terpakai: ${upgradeDebugInfo.currentCount}. Upgrade untuk menambah slot.`
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
