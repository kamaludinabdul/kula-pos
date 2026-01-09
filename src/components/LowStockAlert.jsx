import React from 'react';
import { useData } from '../context/DataContext';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert';
import { AlertTriangle, Package } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../components/ui/badge';

const LowStockAlert = ({ threshold = 10, showDetails = false }) => {
    const { products } = useData();
    const navigate = useNavigate();

    // Filter products with low stock (exclude unlimited)
    const lowStockProducts = products.filter(product => {
        if (product.isUnlimited) return false;
        const stock = product.stock || 0;
        const minStock = product.minStock || threshold;
        return stock <= minStock && stock > 0;
    });

    const outOfStockProducts = products.filter(product => !product.isUnlimited && (product.stock || 0) === 0);

    if (lowStockProducts.length === 0 && outOfStockProducts.length === 0) {
        return null;
    }

    return (
        <div className="space-y-3">
            {outOfStockProducts.length > 0 && (
                <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Stok Habis!</AlertTitle>
                    <AlertDescription className="mt-2">
                        <div className="flex items-center justify-between">
                            <span>
                                <strong>{outOfStockProducts.length}</strong> produk kehabisan stok
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/stock-management')}
                            >
                                Lihat Detail
                            </Button>
                        </div>
                        {showDetails && (
                            <div className="mt-3 space-y-1">
                                {outOfStockProducts.slice(0, 5).map(product => (
                                    <div key={product.id} className="flex items-center justify-between text-sm bg-red-50 p-2 rounded">
                                        <span className="font-medium">{product.name}</span>
                                        <Badge variant="destructive">Habis</Badge>
                                    </div>
                                ))}
                                {outOfStockProducts.length > 5 && (
                                    <div className="text-xs text-muted-foreground">
                                        +{outOfStockProducts.length - 5} produk lainnya
                                    </div>
                                )}
                            </div>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            {lowStockProducts.length > 0 && (
                <Alert>
                    <Package className="h-4 w-4" />
                    <AlertTitle>Stok Menipis</AlertTitle>
                    <AlertDescription className="mt-2">
                        <div className="flex items-center justify-between">
                            <span>
                                <strong>{lowStockProducts.length}</strong> produk stoknya menipis
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => navigate('/stock-management')}
                            >
                                Kelola Stok
                            </Button>
                        </div>
                        {showDetails && (
                            <div className="mt-3 space-y-1">
                                {lowStockProducts.slice(0, 5).map(product => (
                                    <div key={product.id} className="flex items-center justify-between text-sm bg-yellow-50 p-2 rounded">
                                        <span className="font-medium">{product.name}</span>
                                        <Badge variant="outline" className="bg-yellow-100">
                                            Sisa: {product.stock}
                                        </Badge>
                                    </div>
                                ))}
                                {lowStockProducts.length > 5 && (
                                    <div className="text-xs text-muted-foreground">
                                        +{lowStockProducts.length - 5} produk lainnya
                                    </div>
                                )}
                            </div>
                        )}
                    </AlertDescription>
                </Alert>
            )}
        </div>
    );
};

export default LowStockAlert;
