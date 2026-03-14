import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Store, User, Mail, Lock, Loader2, ArrowRight, Eye, EyeOff, UtensilsCrossed, Pill, PawPrint, Timer, Shirt, CheckCircle2, MailCheck, Circle } from 'lucide-react';
import TurnstileWidget from '../components/TurnstileWidget';
import { supabase } from '../supabase';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const BUSINESS_TYPES = [
    { id: 'general', label: 'Toko', description: 'Retail & Minimarket', icon: Store, color: 'indigo' },
    { id: 'fnb', label: 'F&B', description: 'Coming Soon', icon: UtensilsCrossed, color: 'orange', disabled: true },
    { id: 'pharmacy', label: 'Apotek', description: 'Obat & Alat Kesehatan', icon: Pill, color: 'emerald' },
    { id: 'laundry', label: 'Laundry', description: 'Coming Soon', icon: Shirt, color: 'cyan', disabled: true },
    { id: 'rental', label: 'Rental', description: 'Coming Soon', icon: Timer, color: 'violet', disabled: true },
    { id: 'pet_clinic', label: 'Klinik Hewan', description: 'Coming Soon', icon: PawPrint, color: 'amber', disabled: true },
];



const Register = () => {
    const [formData, setFormData] = useState({
        storeName: '',
        ownerName: '',
        email: '',
        password: '',
        confirmPassword: '',
        businessType: 'general'
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [error, setError] = useState('');
    const [loadingState, setLoadingState] = useState(false);
    const [captchaToken, setCaptchaToken] = useState(null);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [confirmationEmail, setConfirmationEmail] = useState('');
    const { signup, user, loading } = useAuth();
    const navigate = useNavigate();
    const turnstileRef = useRef(null);

    // Password strength criteria
    const passwordCriteria = useMemo(() => {
        const pwd = formData.password;
        return [
            { label: 'Minimal 8 karakter', met: pwd.length >= 8 },
            { label: 'Huruf besar (A-Z)', met: /[A-Z]/.test(pwd) },
            { label: 'Huruf kecil (a-z)', met: /[a-z]/.test(pwd) },
            { label: 'Angka (0-9)', met: /[0-9]/.test(pwd) },
            { label: 'Karakter spesial (!@#$%^&*)', met: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd) },
        ];
    }, [formData.password]);
    const allCriteriaMet = passwordCriteria.every(c => c.met);

    const isCaptchaEnabled = TURNSTILE_SITE_KEY && TURNSTILE_SITE_KEY !== 'YOUR_TURNSTILE_SITE_KEY_HERE';

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && user) {
            navigate('/', { replace: true });
        }
    }, [user, loading, navigate]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoadingState(true);

        if (formData.password !== formData.confirmPassword) {
            setError('Password tidak cocok.');
            setLoadingState(false);
            return;
        }

        if (!allCriteriaMet) {
            setError('Password belum memenuhi semua kriteria keamanan.');
            setLoadingState(false);
            return;
        }

        // Validate CAPTCHA if enabled
        if (isCaptchaEnabled && !captchaToken) {
            setError('Silakan selesaikan verifikasi CAPTCHA.');
            setLoadingState(false);
            return;
        }

        try {
            // Check if email already exists in profiles (staff or owner)
            const { data: checkData, error: checkError } = await supabase
                .rpc('check_staff_conflict', {
                    p_email: formData.email,
                    p_target_store_id: '00000000-0000-0000-0000-000000000000' // Use dummy ID to force conflict status if email exists
                });

            if (checkError) {
                console.error("Uniqueness check failed:", checkError);
            } else if (checkData && (checkData.status === 'conflict' || checkData.status === 'same_store')) {
                setError(`Email ini sudah terdaftar sebagai ${checkData.current_role} di ${checkData.current_store_name || 'toko lain'}. Silakan gunakan email lain.`);
                setLoadingState(false);
                return;
            }

            const result = await signup(
                formData.email,
                formData.password,
                formData.ownerName,
                formData.storeName,
                formData.businessType,
                captchaToken // Pass CAPTCHA token to signup
            );

            if (result.success) {
                if (result.requiresConfirmation) {
                    // Show email confirmation screen
                    setConfirmationEmail(formData.email);
                    setShowConfirmation(true);
                } else {
                    navigate('/dashboard');
                }
            } else {
                setError(result.message);
                // Reset CAPTCHA on error
                setCaptchaToken(null);
                if (turnstileRef.current?.reset) {
                    turnstileRef.current.reset();
                }
            }

        } catch (err) {
            console.error("Registration Error:", err);
            setError('Gagal mendaftar. ' + (err.message || 'Silakan coba lagi.'));
            setCaptchaToken(null);
        } finally {
            setLoadingState(false);
        }
    };

    // Email Confirmation Success Screen
    if (showConfirmation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="w-full max-w-md shadow-xl border-slate-200">
                    <CardHeader className="space-y-1 text-center">
                        <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                            <MailCheck className="h-8 w-8 text-emerald-600" />
                        </div>
                        <CardTitle className="text-2xl font-bold text-slate-900">Cek Email Anda!</CardTitle>
                        <CardDescription className="text-base">
                            Kami telah mengirim link konfirmasi ke
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                            <p className="font-semibold text-indigo-700 text-lg">{confirmationEmail}</p>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
                            <p className="text-sm text-amber-800 font-medium">📌 Langkah selanjutnya:</p>
                            <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
                                <li>Buka email dari <strong>noreply@mail.app.supabase.io</strong></li>
                                <li>Klik tombol <strong>"Confirm your mail"</strong></li>
                                <li>Kembali ke halaman ini dan login</li>
                            </ol>
                        </div>
                        <p className="text-xs text-slate-500 text-center">
                            Tidak menerima email? Cek folder spam atau coba daftar ulang.
                        </p>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                        <Link to="/login">
                            <Button variant="outline" className="gap-2">
                                <ArrowRight className="h-4 w-4" />
                                Ke Halaman Login
                            </Button>
                        </Link>
                    </CardFooter>
                </Card>
            </div>
        );
    }

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
                            <Label>Tipe Bisnis</Label>
                            <div className="grid grid-cols-3 gap-2">
                                {BUSINESS_TYPES.map((bt) => {
                                    const Icon = bt.icon;
                                    const isSelected = formData.businessType === bt.id;
                                    const isDisabled = bt.disabled;
                                    return (
                                        <button
                                            key={bt.id}
                                            type="button"
                                            disabled={isDisabled}
                                            onClick={() => setFormData({ ...formData, businessType: bt.id })}
                                            className={`relative flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all duration-150 ${isDisabled
                                                ? 'opacity-40 cursor-not-allowed border-dashed border-slate-300 bg-slate-50'
                                                : isSelected
                                                    ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500 shadow-sm'
                                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer'
                                                }`}
                                        >
                                            <Icon className={`h-5 w-5 ${isDisabled ? 'text-slate-400' : isSelected ? 'text-indigo-600' : 'text-slate-500'
                                                }`} />
                                            <span className={`text-xs font-semibold leading-tight ${isDisabled ? 'text-slate-400' : isSelected ? 'text-indigo-700' : 'text-slate-700'
                                                }`}>{bt.label}</span>
                                            <span className={`text-[9px] leading-tight ${isDisabled ? 'text-slate-400 italic' : 'text-slate-400'
                                                }`}>{bt.description}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

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

                        {/* Password Strength Checklist */}
                        {formData.password.length > 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1.5">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Kriteria Password</p>
                                {passwordCriteria.map((criteria, idx) => (
                                    <div key={idx} className={`flex items-center gap-2 text-sm transition-colors duration-200 ${criteria.met ? 'text-emerald-600' : 'text-slate-400'}`}>
                                        {criteria.met ? (
                                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                                        ) : (
                                            <Circle className="h-4 w-4 shrink-0" />
                                        )}
                                        <span className={criteria.met ? 'font-medium' : ''}>{criteria.label}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Cloudflare Turnstile CAPTCHA */}
                        <TurnstileWidget
                            ref={turnstileRef}
                            onVerify={(token) => setCaptchaToken(token)}
                            onError={() => {
                                setCaptchaToken(null);
                                setError('Verifikasi CAPTCHA gagal. Silakan coba lagi.');
                            }}
                            onExpire={() => setCaptchaToken(null)}
                        />

                        <Button className="w-full bg-indigo-600 hover:bg-indigo-700 mt-6" type="submit" disabled={loadingState || !allCriteriaMet || (isCaptchaEnabled && !captchaToken)}>
                            {loadingState ? (
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
