import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Save, User, Mail, Lock, Shield, Image as ImageIcon, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabase';
import { safeSupabaseQuery } from '../utils/supabaseHelper';
import { PERMISSION_SCHEMA, getPermissionsForRole } from '../utils/permissions';
import { useToast } from '../components/ui/use-toast';

const StaffForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, updateStaffPassword } = useAuth();
    const { activeStoreId, addUser } = useData();
    
    const isEditing = !!id;
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(isEditing);
    
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        role: 'staff',
        password: '',
        photo: '',
        petCareAccess: false
    });
    
    const [permissions, setPermissions] = useState([]);
    const [showPermissions, setShowPermissions] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    const fetchStaffData = React.useCallback(async () => {
        setFetching(true);
        try {
            const data = await safeSupabaseQuery({
                tableName: 'profiles',
                queryBuilder: (q) => q.eq('id', id).eq('store_id', activeStoreId).single(),
                fallbackParams: `?id=eq.${id}&store_id=eq.${activeStoreId}`,
                processFn: (res) => Array.isArray(res) ? res[0] : res
            });
            
            if (data) {
                // Clean up email for display (if dummy)
                let emailDisplay = data.email || '';
                if (emailDisplay.endsWith('@kula.id')) {
                    emailDisplay = emailDisplay.split('@')[0];
                }
                
                setFormData({
                    name: data.name || '',
                    email: emailDisplay,
                    role: data.role || 'staff',
                    password: data.password || data.pin || '',
                    photo: data.photo || '',
                    petCareAccess: !!data.pet_care_access
                });
                
                if (data.permissions && data.permissions.length > 0) {
                    setPermissions(data.permissions);
                } else {
                    setPermissions(getPermissionsForRole(data.role || 'staff'));
                }
            } else {
                toast({
                    title: "Error",
                    description: "Staff tidak ditemukan.",
                    variant: "destructive"
                });
                navigate('/staff');
            }
        } catch (error) {
            console.error("Error fetching staff:", error);
            toast({
                title: "Error",
                description: "Gagal memuat data staff.",
                variant: "destructive"
            });
        } finally {
            setFetching(false);
        }
    }, [id, activeStoreId, navigate, toast]);

    useEffect(() => {
        if (isEditing && activeStoreId) {
            fetchStaffData();
        }
    }, [isEditing, activeStoreId, fetchStaffData]);

    const handlePhotoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, photo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const registerUserToSupabase = async (email, password, name, role, storeId) => {
        try {
            const { data, error } = await supabase.functions.invoke('create-user', {
                body: {
                    email,
                    password,
                    name: name || 'Staff Member',
                    role: role || 'staff',
                    store_id: storeId,
                    permissions: permissions
                }
            });

            // Handle invocation error (Network, 400s, 500s reported by SDK)
            if (error) {
                let errorMsg = error.message;
                try {
                    // Try to parse error message if it's a JSON string from Edge Function
                    const parsed = JSON.parse(error.message);
                    if (parsed.error) errorMsg = parsed.error;
                } catch {
                    // Not JSON, use original message
                }
                throw new Error(errorMsg);
            }

            // Handle successful invocation but logic error in function
            if (data?.error) throw new Error(data.error);

            return { success: true, user: data.user };
        } catch (error) {
            console.error("Auto-registration failed:", error);
            const msg = error.message || "";
            if (msg.includes('already registered') || msg.includes('unique') || msg.includes('already exists')) {
                return { success: false, error: "Email/Username sudah terdaftar di sistem pusat. Gunakan yang lain." };
            }
            if (msg.includes('6 characters')) {
                return { success: false, error: "Password minimal harus 6 karakter." };
            }
            return { success: false, error: msg || "Terjadi kesalahan koneksi ke server." };
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeStoreId) return;
        
        setLoading(true);
        try {
            let finalEmail = formData.email ? formData.email.trim().toLowerCase() : "";
            if (finalEmail && !finalEmail.includes('@')) {
                finalEmail = `${finalEmail.replace(/\s+/g, '')}@kula.id`;
            }
            
            console.log("Submitting staff form. Finalized email:", finalEmail);

            if (!isEditing && (!formData.password || formData.password.length < 6)) {
                toast({
                    title: "Validasi Gagal",
                    description: "Password minimal 6 karakter.",
                    variant: "destructive"
                });
                setLoading(false);
                return;
            }

            if (isEditing) {
                const { error } = await supabase
                    .from('profiles')
                    .update({
                        name: formData.name,
                        email: finalEmail || '',
                        role: formData.role,
                        password: formData.password,
                        pin: formData.password,
                        photo: formData.photo || '',
                        pet_care_access: formData.petCareAccess || false,
                        permissions: permissions
                    })
                    .eq('id', id);

                if (error) throw error;

                if (formData.password && formData.password.length >= 6) {
                    await updateStaffPassword(id, formData.password);
                }
                
                toast({ title: "Berhasil", description: "Data staff diperbarui" });
                navigate('/staff');
            } else {
                let authId = null;
                const regResult = await registerUserToSupabase(finalEmail, formData.password, formData.name, formData.role, activeStoreId);
                
                if (regResult.success) {
                    authId = regResult.user?.id;
                } else {
                    toast({
                        title: "Gagal Registrasi",
                        description: regResult.error,
                        variant: "destructive"
                    });
                    setLoading(false);
                    return;
                }

                const result = await addUser({
                    id: authId,
                    name: formData.name,
                    email: finalEmail,
                    role: formData.role,
                    password: formData.password,
                    pin: formData.password,
                    photo: formData.photo || '',
                    pet_care_access: formData.petCareAccess || false,
                    store_id: activeStoreId,
                    permissions: permissions
                });

                if (result.success) {
                    toast({ title: "Berhasil", description: "Staff baru ditambahkan" });
                    navigate('/staff');
                } else {
                    throw new Error(result.error);
                }
            }
        } catch (error) {
            console.error("Error saving staff:", error);
            toast({
                title: "Gagal",
                description: "Terjadi kesalahan saat menyimpan data.",
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const togglePermission = (id) => {
        setPermissions(prev => 
            prev.includes(id) 
                ? prev.filter(p => p !== id) 
                : [...prev, id]
        );
    };

    if (fetching) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="w-full h-full p-4 md:p-6 lg:p-8 space-y-8">
            <header className="flex items-center gap-4 mb-2">
                <Button variant="ghost" size="icon" onClick={() => navigate('/staff')}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">{isEditing ? 'Edit Staff' : 'Tambah Staff Baru'}</h1>
                    <p className="text-sm text-muted-foreground">Kelola detail akun dan hak akses staff.</p>
                </div>
            </header>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Profile Info */}
                <div className="lg:col-span-1 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Profil Staff</CardTitle>
                            <CardDescription>Informasi dasar untuk login.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col items-center gap-4 mb-4">
                                <div className="h-24 w-24 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-200">
                                    {formData.photo ? (
                                        <img src={formData.photo} alt="Preview" className="h-full w-full object-cover" />
                                    ) : (
                                        <User className="h-12 w-12 text-slate-400" />
                                    )}
                                </div>
                                <div className="w-full">
                                    <Label htmlFor="photo-upload" className="cursor-pointer">
                                        <div className="flex items-center justify-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium">
                                            <ImageIcon className="h-4 w-4" />
                                            Ganti Foto
                                        </div>
                                    </Label>
                                    <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="staff-name">Nama Lengkap</Label>
                                <Input 
                                    id="staff-name"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                    placeholder="Nama Staff"
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="staff-email">Username / Email</Label>
                                <Input 
                                    id="staff-email"
                                    value={formData.email}
                                    onChange={e => setFormData({...formData, email: e.target.value})}
                                    placeholder="Username login"
                                    required
                                    autoComplete="off"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="staff-password">Password / PIN {isEditing && <span className="text-[10px] text-muted-foreground ml-1">(Kosongkan jika tidak diubah)</span>}</Label>
                                <div className="relative">
                                    <Input 
                                        id="staff-password"
                                        type={showPassword ? "text" : "password"}
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        placeholder="Min. 6 karakter"
                                        required={!isEditing}
                                        autoComplete="new-password"
                                    />
                                    <Button 
                                        type="button" 
                                        variant="ghost" 
                                        size="icon" 
                                        className="absolute right-0 top-0 h-full px-3"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        <Shield className="h-4 w-4 text-slate-400" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label>Role Utama</Label>
                                <Select value={formData.role} onValueChange={(val) => {
                                    setFormData({...formData, role: val});
                                    setPermissions(getPermissionsForRole(val));
                                }}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="staff">Kasir</SelectItem>
                                        <SelectItem value="sales">Sales</SelectItem>
                                        <SelectItem value="dokter">Dokter</SelectItem>
                                        <SelectItem value="pramedic">Pramedic</SelectItem>
                                        <SelectItem value="groomer">Groomer</SelectItem>
                                        <SelectItem value="admin">Administrator</SelectItem>
                                        {(user?.role === 'super_admin' || user?.role === 'owner') && (
                                            <SelectItem value="owner">Owner (Pemilik)</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                    
                    <Button type="submit" className="w-full h-12 text-lg font-bold" disabled={loading}>
                        {loading ? 'Menyimpan...' : 'Simpan Data Staff'}
                    </Button>
                </div>

                {/* Right Column: Permissions */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="h-full border-slate-200 shadow-sm overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between pb-3 bg-slate-50/50 border-b">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Shield className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <CardTitle className="text-lg">Hak Akses (Permissions)</CardTitle>
                                    <CardDescription>Aturan akses spesifik untuk staff ini.</CardDescription>
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                                <Badge variant="secondary" className="font-bold bg-blue-100 text-blue-700 hover:bg-blue-100 border-none">
                                    {permissions.length} Akses Aktif
                                </Badge>
                                {(permissions.length > 0) && (
                                    <button 
                                        type="button"
                                        onClick={() => setPermissions([])}
                                        className="text-[10px] text-red-500 hover:underline font-medium"
                                    >
                                        Hapus Semua
                                    </button>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-100">
                                {PERMISSION_SCHEMA.map((group) => {
                                    const groupChildrenIds = group.children.map(c => c.id);
                                    const isAllChecked = groupChildrenIds.every(id => permissions.includes(id));
                                    const someChecked = groupChildrenIds.some(id => permissions.includes(id));
                                    const isExpanded = showPermissions === group.id || (showPermissions === true && group.id === 'dashboard');

                                    return (
                                        <div key={group.id} className="group/item">
                                            {/* Group Header */}
                                            <div 
                                                className={`flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors ${isExpanded ? 'bg-slate-50/30' : ''}`}
                                                onClick={() => setShowPermissions(showPermissions === group.id ? null : group.id)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-1.5 rounded-md transition-colors ${someChecked ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                                        {group.icon ? <group.icon className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                                    </div>
                                                    <div className="flex flex-col">
                                                        <span className={`text-sm font-bold transition-colors ${someChecked ? 'text-slate-900' : 'text-slate-500'}`}>
                                                            {group.label}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400">
                                                            {group.children.filter(c => permissions.includes(c.id)).length} dari {group.children.length} aktif
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            type="button"
                                                            className={`text-[11px] font-medium px-2 py-0.5 rounded transition-colors ${isAllChecked ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'}`}
                                                            onClick={() => {
                                                                if (isAllChecked) {
                                                                    setPermissions(prev => prev.filter(p => !groupChildrenIds.includes(p)));
                                                                } else {
                                                                    setPermissions(prev => [...new Set([...prev, ...groupChildrenIds])]);
                                                                }
                                                            }}
                                                        >
                                                            {isAllChecked ? 'Batalkan Semua' : 'Pilih Semua'}
                                                        </button>
                                                    </div>
                                                    {showPermissions === group.id ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                                </div>
                                            </div>

                                            {/* Group Children (Permissions) */}
                                            {showPermissions === group.id && (
                                                <div className="p-4 pt-0 bg-white">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 pb-2">
                                                        {group.children.map((perm) => (
                                                            <div 
                                                                key={perm.id}
                                                                onClick={() => togglePermission(perm.id)}
                                                                className={`
                                                                    flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all active:scale-[0.98]
                                                                    ${permissions.includes(perm.id) 
                                                                        ? 'bg-blue-50 border-blue-200 text-blue-800 shadow-sm' 
                                                                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50/50'}
                                                                `}
                                                            >
                                                                <div className={`
                                                                    h-4 w-4 rounded flex items-center justify-center border transition-colors
                                                                    ${permissions.includes(perm.id) ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}
                                                                `}>
                                                                    {permissions.includes(perm.id) && <Check className="h-3 w-3 text-white stroke-[3px]" />}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="text-[13px] font-semibold leading-tight truncate">{perm.label}</span>
                                                                    <span className="text-[9px] font-mono opacity-50 truncate uppercase tracking-tighter">{perm.id.split('.').pop()}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </div>
    );
};

export default StaffForm;
