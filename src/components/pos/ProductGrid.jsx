import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { getOptimizedImage } from '../../utils/supabaseImage';

const ProductGrid = ({ products, onAddToCart, isCartCollapsed }) => {
    // --- Progressive Loading State ---
    const [visibleCount, setVisibleCount] = useState(24); // Start with 24 items (~3-4 rows)
    const scrollContainerRef = useRef(null);
    const observerTarget = useRef(null);

    // Reset visible count when filter/search changes (products array reference changes)
    useEffect(() => {
        // Use timeout to avoid synchronous set-state-in-effect warning
        const timer = setTimeout(() => {
            setVisibleCount(24);
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop = 0;
            }
        }, 0);
        return () => clearTimeout(timer);
    }, [products]);

    // Intersection Observer for Infinite Scroll
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setVisibleCount((prev) => {
                        if (prev >= products.length) return prev;
                        return prev + 24;
                    });
                }
            },
            {
                root: scrollContainerRef.current,
                threshold: 0.1,
                rootMargin: "200px" // Load before hitting bottom
            }
        );

        const currentObserverTarget = observerTarget.current;
        if (currentObserverTarget) {
            observer.observe(currentObserverTarget);
        }

        return () => {
            if (currentObserverTarget) {
                observer.unobserve(currentObserverTarget);
            }
            observer.disconnect();
        };
    }, [products.length, visibleCount]); // Re-run when products or count changes to re-observe if element moves

    const visibleProducts = products.slice(0, visibleCount);

    return (
        <div
            ref={scrollContainerRef}
            className={`grid gap-2 p-1 overflow-y-auto h-full scrollbar-thin content-start bg-slate-100/50 pb-20 ${isCartCollapsed
                ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10'
                : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8'
                }`}
        >
            {visibleProducts.map((product) => {
                const stock = parseInt(product.stock) || 0;
                const isUnlimited = product.isUnlimited;
                const isOutOfStock = product.type !== 'service' && !isUnlimited && stock <= 0;
                const isLowStock = product.type !== 'service' && !isUnlimited && stock <= 5 && stock > 0;

                return (
                    <Card
                        key={product.id}
                        className={`group cursor-pointer hover:shadow-xl transition-all duration-300 active:scale-95 flex flex-col overflow-hidden border-0 shadow-sm ring-1 ring-slate-200/60 bg-white h-auto min-h-[160px] ${isOutOfStock ? 'opacity-60 grayscale' : 'hover:-translate-y-1'
                            }`}
                        onClick={() => !isOutOfStock && onAddToCart(product)}
                    >
                        <div className="relative aspect-[4/3] bg-white overflow-hidden">
                            {product.image ? (
                                <img
                                    src={getOptimizedImage(product.image, { width: 200, quality: 50 })}
                                    alt={product.name}
                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-slate-50 text-slate-300 font-bold text-3xl">
                                    {product.name.charAt(0).toUpperCase()}
                                </div>
                            )}

                            {/* Stock Badge */}
                            {product.type !== 'service' && (
                                <div className="absolute top-1.5 right-1.5 shadow-lg">
                                    <Badge
                                        variant={isOutOfStock ? "destructive" : (isLowStock ? "secondary" : "default")}
                                        className={`px-1.5 h-5 text-[10px] ${isLowStock ? "bg-orange-500 hover:bg-orange-600 text-white" : ""} ${isUnlimited ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}`}
                                    >
                                        {isUnlimited ? "∞" : stock}
                                    </Badge>
                                </div>
                            )}

                            {/* Overlay on Hover */}
                            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>

                        <CardContent className="p-2.5 flex flex-col flex-1 gap-1 relative">
                            {/* Fixed height for title to ensure uniform card sizing - Force 2 lines */}
                            <div className="font-semibold text-xs text-slate-700 line-clamp-2 h-8 leading-4 overflow-hidden" title={product.name}>
                                {product.name}
                            </div>
                            <div className="mt-auto flex items-center justify-between pt-1">
                                <span className="font-bold text-indigo-600 text-sm">
                                    Rp {(parseInt(product.sellPrice || product.price) || 0).toLocaleString()}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}

            {visibleCount < products.length && (
                <div
                    ref={observerTarget}
                    className="col-span-full py-4 text-center text-xs text-slate-400"
                >
                    Memuat produk lainnya... ({visibleCount} / {products.length})
                </div>
            )}

            {products.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground opacity-60">
                    <div className="bg-slate-200 p-6 rounded-full mb-4">
                        <span className="text-4xl">🔍</span>
                    </div>
                    <p className="text-lg font-medium">Tidak ada produk ditemukan.</p>
                    <p className="text-sm">Coba kata kunci lain atau ubah kategori.</p>
                </div>
            )}
        </div>
    );
};

export default ProductGrid;
