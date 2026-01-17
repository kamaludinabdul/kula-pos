import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Lock, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const ResetPassword = () => {
    const navigate = useNavigate();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [hasValidSession, setHasValidSession] = useState(false);
    const [checking, setChecking] = useState(true);

    // Check if we have a valid recovery session
    useEffect(() => {
        let isMounted = true;

        const checkSession = async () => {
            try {
                // Check if there's an access_token in the URL hash (from email link)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const type = hashParams.get('type');

                if (accessToken && type === 'recovery') {
                    // Set the session from the recovery token
                    const { error } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: hashParams.get('refresh_token') || ''
                    });

                    if (!isMounted) return;

                    if (!error) {
                        setHasValidSession(true);
                    } else {
                        setError('Link reset password tidak valid atau sudah kadaluarsa.');
                    }
                } else {
                    // Check if there's already an active session from recovery
                    const { data: { session } } = await supabase.auth.getSession();

                    if (!isMounted) return;

                    if (session) {
                        setHasValidSession(true);
                    } else {
                        setError('Tidak ada sesi aktif. Silakan minta link reset password baru.');
                    }
                }
            } catch (err) {
                // Ignore abort errors (caused by React strict mode or component unmount)
                if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                    return;
                }
                if (isMounted) {
                    console.error('Session check error:', err);
                    setError('Terjadi kesalahan saat memverifikasi sesi.');
                }
            } finally {
                if (isMounted) setChecking(false);
            }
        };

        checkSession();

        return () => {
            isMounted = false;
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setError('Password tidak sama');
            return;
        }

        if (password.length < 6) {
            setError('Password minimal 6 karakter');
            return;
        }

        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            console.log('Starting password update...');
            const startTime = performance.now();

            const { error } = await supabase.auth.updateUser({
                password: password
            });

            console.log(`Password update took: ${((performance.now() - startTime) / 1000).toFixed(1)}s`);

            if (error) throw error;

            setMessage('Password berhasil diubah! Mengalihkan ke halaman login...');

            // Sign out immediately without waiting
            console.log('Signing out...');
            const signOutStart = performance.now();
            await supabase.auth.signOut();
            console.log(`Sign out took: ${((performance.now() - signOutStart) / 1000).toFixed(1)}s`);

            // Redirect to login
            navigate('/login');
        } catch (err) {
            console.error('Password update error:', err);
            setError(err.message || 'Gagal mengubah password. Silakan coba lagi.');
        } finally {
            setLoading(false);
        }
    };

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <p className="text-sm text-slate-500">Memverifikasi sesi...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <div className="flex justify-center mb-2">
                        <div className="p-3 bg-blue-100 rounded-full">
                            <Lock className="h-6 w-6 text-blue-600" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
                    <CardDescription className="text-center">
                        Masukkan password baru Anda
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertTriangle className="h-4 w-4 mr-2" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {message && (
                        <Alert className="mb-4 bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                    )}

                    {hasValidSession ? (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password Baru</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Minimal 6 karakter"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="Ulangi password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={loading}>
                                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Simpan Password Baru
                            </Button>
                        </form>
                    ) : (
                        <div className="text-center space-y-4">
                            <p className="text-gray-600">
                                Link reset password tidak valid atau sudah kadaluarsa.
                            </p>
                            <Link to="/forgot-password">
                                <Button variant="outline" className="w-full">
                                    Minta Link Reset Baru
                                </Button>
                            </Link>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">
                        Kembali ke Login
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
};

export default ResetPassword;
