import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
    const { resetPassword } = useAuth();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        const result = await resetPassword(email);

        if (result.success) {
            setMessage("Email reset password telah dikirim. Silakan cek inbox Anda.");
        } else {
            setError(result.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl font-bold text-center">Lupa Password</CardTitle>
                    <CardDescription className="text-center">
                        Masukkan email Anda untuk menerima link reset password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="destructive" className="mb-4">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {message && (
                        <Alert className="mb-4 bg-green-50 text-green-700 border-green-200">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            <AlertDescription>{message}</AlertDescription>
                        </Alert>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="nama@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Kirim Link Reset
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex justify-center">
                    <Link to="/login" className="flex items-center text-sm text-gray-600 hover:text-gray-900">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Kembali ke Login
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
};

export default ForgotPassword;
