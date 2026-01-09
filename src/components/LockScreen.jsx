import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Lock, LogOut, Eye, EyeOff } from 'lucide-react';

const LockScreen = () => {
    const { user, unlock, logout, isLocked } = useAuth();
    const [pin, setPin] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    if (!isLocked || !user) return null;

    const handleUnlock = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await unlock(pin);

        if (result.success) {
            setPin('');
        } else {
            setError(result.message || 'PIN/Password Salah');
        }
        setIsLoading(false);
    };

    const handleLogout = () => {
        if (window.confirm('Yakin ingin logout penuh?')) {
            logout();
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="p-8 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-lg">
                        <Lock className="w-10 h-10 text-slate-600" />
                    </div>

                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Layar Terkunci</h2>
                        <p className="text-slate-500 mt-1">
                            Halo, <span className="font-semibold text-slate-700">{user.name}</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Sesi Anda dikunci karena tidak aktif.
                        </p>
                    </div>

                    <form onSubmit={handleUnlock} className="space-y-4">
                        <div className="space-y-2 text-left">
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Masukkan Password / PIN"
                                    value={pin}
                                    onChange={(e) => setPin(e.target.value)}
                                    className="h-12 text-center text-lg tracking-widest"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {error && (
                                <p className="text-red-500 text-sm text-center font-medium animate-pulse">
                                    {error}
                                </p>
                            )}
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-11 text-base bg-blue-600 hover:bg-blue-700"
                            disabled={!pin || isLoading}
                        >
                            {isLoading ? 'Membuka...' : 'Buka Kunci'}
                        </Button>
                    </form>

                    <div className="pt-4 border-t">
                        <Button
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={handleLogout}
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            Logout (Keluar Akun)
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LockScreen;
