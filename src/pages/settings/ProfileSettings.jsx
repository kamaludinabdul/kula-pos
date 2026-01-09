import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Save, UserCog, Trash2 } from 'lucide-react';
import { compressImage } from '../../utils/imageCompressor';
import AlertDialog from '../../components/AlertDialog';

const ProfileSettings = () => {
    const { activeStoreId, currentStore, updateStore } = useData();
    const [formData, setFormData] = useState({
        name: '',
        address: '',
        phone: '',
        logo: '',
        enableSalesPerformance: false,
        latitude: '',
        longitude: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertData, setAlertData] = useState({ title: '', message: '', onConfirm: null });

    useEffect(() => {
        if (currentStore) {
            setFormData(prev => {
                const newData = {
                    name: currentStore.name || '',
                    email: currentStore.email || '',
                    address: currentStore.address || '',
                    phone: currentStore.phone || '',
                    logo: currentStore.logo || '',
                    enableSalesPerformance: currentStore.enableSalesPerformance || false,
                    latitude: currentStore.latitude || '',
                    longitude: currentStore.longitude || ''
                };

                // Shallow comparison to prevent unnecessary updates
                if (
                    prev.name === newData.name &&
                    prev.email === newData.email &&
                    prev.address === newData.address &&
                    prev.phone === newData.phone &&
                    prev.logo === newData.logo &&
                    prev.enableSalesPerformance === newData.enableSalesPerformance &&
                    prev.latitude === newData.latitude &&
                    prev.longitude === newData.longitude
                ) {
                    return prev;
                }

                return newData;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        currentStore?.name,
        currentStore?.email,
        currentStore?.address,
        currentStore?.phone,
        currentStore?.logo,
        currentStore?.enableSalesPerformance,
        currentStore?.latitude,
        currentStore?.longitude
    ]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleLogoChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                // Compress logo (usually displayed small, so 500px is enough)
                const compressedBase64 = await compressImage(file, 500, 0.7);
                setFormData(prev => ({ ...prev, logo: compressedBase64 }));
            } catch (error) {
                console.error("Logo compression failed:", error);
                const reader = new FileReader();
                reader.onloadend = () => {
                    setFormData(prev => ({ ...prev, logo: reader.result }));
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const handleRemoveLogo = () => {
        setAlertData({
            title: 'Hapus Logo',
            message: 'Apakah Anda yakin ingin menghapus logo toko ini?',
            onConfirm: () => setFormData(prev => ({ ...prev, logo: '' }))
        });
        setIsAlertOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeStoreId) return;

        setIsSaving(true);
        const result = await updateStore(activeStoreId, formData);
        setIsSaving(false);

        if (result.success) {
            alert('Profil toko berhasil disimpan!');
        } else {
            alert('Gagal menyimpan profil toko.');
        }
    };

    if (!currentStore) return <div>Loading...</div>;

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center gap-2">
                    <UserCog className="h-5 w-5" />
                    <CardTitle>Informasi Umum</CardTitle>
                </div>
                <CardDescription>Kelola informasi dasar toko Anda.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Nama Toko</Label>
                        <Input
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email Toko</Label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            value={formData.email || ''}
                            onChange={handleChange}
                            placeholder="email@toko.com"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="logo">Logo Toko</Label>
                        <div className="flex items-center gap-4">
                            {formData.logo && (
                                <div className="relative group">
                                    <img src={formData.logo} alt="Logo Preview" className="h-16 w-16 object-contain border rounded bg-white" />
                                    <button
                                        type="button"
                                        onClick={handleRemoveLogo}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow hover:bg-red-600 transition-colors"
                                        title="Hapus Logo"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </button>
                                </div>
                            )}
                            <Input
                                id="logo"
                                type="file"
                                accept="image/*"
                                onChange={handleLogoChange}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="address">Alamat</Label>
                        <Textarea
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            rows={3}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">Nomor Telepon</Label>
                        <Input
                            id="phone"
                            name="phone"
                            type="text"
                            value={formData.phone}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="latitude">Latitude</Label>
                            <Input
                                id="latitude"
                                name="latitude"
                                type="text"
                                value={formData.latitude}
                                onChange={handleChange}
                                placeholder="-6.200000"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="longitude">Longitude</Label>
                            <Input
                                id="longitude"
                                name="longitude"
                                type="text"
                                value={formData.longitude}
                                onChange={handleChange}
                                placeholder="106.816666"
                            />
                        </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={() => {
                        if (navigator.geolocation) {
                            navigator.geolocation.getCurrentPosition((position) => {
                                setFormData(prev => ({
                                    ...prev,
                                    latitude: position.coords.latitude,
                                    longitude: position.coords.longitude
                                }));
                            }, (error) => {
                                alert("Gagal mendapatkan lokasi: " + error.message);
                            });
                        } else {
                            alert("Geolocation tidak didukung browser ini.");
                        }
                    }}>
                        📍 Gunakan Lokasi Saat Ini
                    </Button>


                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isSaving}>
                            <Save className="h-4 w-4 mr-2" />
                            {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                        </Button>
                    </div>
                </form>
            </CardContent>

            <AlertDialog
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertData.title}
                message={alertData.message}
                onConfirm={alertData.onConfirm}
                confirmText="Hapus"
            />
        </Card >
    );
};

export default ProfileSettings;
