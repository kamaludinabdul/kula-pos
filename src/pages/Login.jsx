import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, ChevronRight, Mail, Eye, EyeOff } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        if (password.length < 6) {
            setError('Password minimal 6 karakter');
            setIsLoading(false);
            return;
        }

        let finalEmail = email.trim();
        if (finalEmail && !finalEmail.includes('@')) {
            finalEmail = `${finalEmail.replace(/\s+/g, '')}@kula.id`;
        }

        const result = await login(finalEmail, password);

        if (result.success) {
            // Navigate to root to let RootRedirect component handle the destination based on role
            navigate('/');
        } else {
            setError(result.message);
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
            <Card className="w-full max-w-md shadow-2xl">
                <CardHeader className="space-y-4 text-center pb-8">
                    <div className="mx-auto w-48 h-24 flex items-center justify-center mb-4">
                        <img src="/logo.png" alt="KULA Logo" className="w-full h-full object-contain drop-shadow-xl" />
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
