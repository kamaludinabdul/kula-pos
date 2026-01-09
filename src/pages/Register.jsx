import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Store, User, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff } from 'lucide-react';

const Register = () => {
    const [formData, setFormData] = useState({
        storeName: '',
        ownerName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth(); // We'll need to ensure signup is exposed or implement it here
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (formData.password !== formData.confirmPassword) {
            setError('Password tidak cocok.');
            setLoading(false);
            return;
        }

        if (formData.password.length < 6) {
            setError('Password minimal 6 karakter.');
            setLoading(false);
            return;
        }

        try {
            // Call signup from AuthContext
            const result = await signup(
                formData.email,
                formData.password,
                formData.ownerName,
                formData.storeName
            );

            if (result.success) {
                navigate('/dashboard');
            } else {
                setError(result.message);
            }

        } catch (err) {
            console.error("Registration Error:", err);
            setError('Gagal mendaftar. ' + (err.message || 'Silakan coba lagi.'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
            <Card className="w-full max-w-md shadow-xl border-slate-200">
                <CardHeader className="space-y-1 text-center">
                    <div className="mx-auto w-40 h-20 flex items-center justify-center mb-4">
                        <img src="/logo.png" alt="KULA Logo" className="w-full h-full object-contain drop-shadow-lg" />
                    </div>
                    <CardTitle className="text-2xl font-bold text-slate-900">Daftarkan Toko Anda</CardTitle>
                    <CardDescription>
                        Mulai kelola bisnis Anda dengan KULA. Gratis!
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg border border-red-200">
                                {error}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="storeName">Nama Toko</Label>
                            <div className="relative">
                                <Store className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    id="storeName"
                                    placeholder="Contoh: Toko Berkah"
                                    className="pl-9"
                                    value={formData.storeName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="ownerName">Nama Pemilik</Label>
                            <div className="relative">
                                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    id="ownerName"
                                    placeholder="Nama Lengkap Anda"
                                    className="pl-9"
                                    value={formData.ownerName}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="nama@email.com"
                                    className="pl-9"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="******"
                                        className="pl-9 pr-10"
                                        value={formData.password}
                                        onChange={handleChange}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Konfirmasi</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                                    <Input
                                        id="confirmPassword"
                                        type={showConfirmPassword ? "text" : "password"}
                                        placeholder="******"
                                        className="pl-9 pr-10"
                                        value={formData.confirmPassword}
                                        onChange={handleChange}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                                    >
                                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 mt-6" type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Mendaftarkan...
                                </>
                            ) : (
                                <>
                                    Daftar Sekarang <ArrowRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <p className="text-sm text-slate-600">
                        Sudah punya akun?{' '}
                        <Link to="/login" className="text-indigo-600 font-semibold hover:underline">
                            Masuk disini
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
};

export default Register;
