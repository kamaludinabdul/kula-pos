import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, ChevronRight, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import TurnstileWidget from '../components/TurnstileWidget';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [captchaToken, setCaptchaToken] = useState(null);
    const [captchaError, setCaptchaError] = useState('');
    const [captchaRetryKey, setCaptchaRetryKey] = useState(0);

    const { login, user, loading } = useAuth();
    const navigate = useNavigate();

    // Redirect if already logged in
    useEffect(() => {
        if (!loading && user) {
            navigate('/', { replace: true });
        }
    }, [user, loading, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (password.length < 6) {
            setError('Password minimal 6 karakter');
            setIsLoading(false);
            return;
        }

        if (TURNSTILE_SITE_KEY && !captchaToken) {
            setError('Silakan selesaikan verifikasi CAPTCHA.');
            setIsLoading(false);
            return;
        }

        let finalEmail = email.trim();
        if (finalEmail && !finalEmail.includes('@')) {
            finalEmail = `${finalEmail.toLowerCase().replace(/\s+/g, '')}@kula.id`;
        }

        const result = await login(finalEmail, password, captchaToken);

        if (result.success) {
            // Navigate to root to let RootRedirect component handle the destination based on role
            navigate('/');
        } else {
            setError(result.message);
            // Reset captcha on failed login to force re-verification
            setCaptchaToken(null);
            setCaptchaError('');
            setCaptchaRetryKey(prev => prev + 1);
        }
        setIsLoading(false);
    };

    const handleCaptchaError = (errorCode) => {
        setCaptchaToken(null);
        let errorMsg = 'Gagal memuat CAPTCHA.';
        
        if (!window.isSecureContext) {
            errorMsg = 'Koneksi tidak aman (Bukan HTTPS). Keamanan Cloudflare memerlukan koneksi HTTPS agar berfungsi.';
        } else if (errorCode === '600010') {
            errorMsg = `Masalah Konfigurasi (Error 600010): Domain ini kemungkinan belum terdaftar di dashboard Cloudflare Turnstile, atau Site Key tidak cocok.`;
        } else if (errorCode) {
            errorMsg = `Verifikasi Keamanan Gagal (Kode: ${errorCode}). Kemungkinan karena masalah koneksi atau konfigurasi.`;
        }
        
        setCaptchaError(errorMsg);
    };

    const handleCaptchaRetry = () => {
        setCaptchaError('');
        setCaptchaToken(null);
        setCaptchaRetryKey(prev => prev + 1);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="space-y-4 text-center pb-8">
                    <div className="mx-auto w-48 h-24 flex items-center justify-center mb-4">
                        <img src="/logo.png" alt="KULA Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>

                        <CardDescription className="text-base mt-2">
                            Masuk ke akun Anda
                        </CardDescription>
                    </div>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        {error && (
                            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}
                        {captchaError && (
                            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">
                                {captchaError}
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label htmlFor="email">Username / Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="email"
                                    type="text"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Username atau Email"
                                    className="pl-10"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Password</Label>
                                <Link to="/forgot-password" className="text-sm text-indigo-600 hover:underline">
                                    Lupa Password?
                                </Link>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Masukkan password"
                                    className="pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-5 w-5" />
                                    ) : (
                                        <Eye className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {TURNSTILE_SITE_KEY && (
                            <div className="flex flex-col items-center py-2 space-y-2">
                                <TurnstileWidget
                                    key={captchaRetryKey}
                                    onVerify={(token) => {
                                        setCaptchaToken(token);
                                        setCaptchaError('');
                                    }}
                                    onExpire={() => {
                                        setCaptchaToken(null);
                                        setCaptchaError('Sesi CAPTCHA berakhir. Silakan verifikasi ulang.');
                                    }}
                                    onError={handleCaptchaError}
                                />
                                {captchaError && (
                                    <div className="flex flex-col items-center space-y-2">
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={handleCaptchaRetry}
                                            className="text-xs h-8"
                                        >
                                            Coba Lagi (Retry)
                                        </Button>
                                        <p className="text-[10px] text-muted-foreground text-center max-w-[250px]">
                                            Jika terus gagal, pastikan domain diizinkan di Cloudflare, atau gunakan <b>Emergency Bypass Key</b> di .env.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full h-11 text-base gap-2"
                            disabled={isLoading}
                        >
                            <span>{isLoading ? 'Memuat...' : 'Masuk'}</span>
                            <ChevronRight className="h-5 w-5" />
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <p className="text-sm text-slate-600">
                        Belum punya akun toko?{' '}
                        <Link to="/register" className="text-indigo-600 font-semibold hover:underline">
                            Daftar Gratis
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
};

export default Login;
