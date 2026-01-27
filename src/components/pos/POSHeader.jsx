import React from 'react';
import {
    Bluetooth,
    Clock,
    Package,
    LayoutDashboard,
    LogOut,
    Wallet,
    Menu,
    Wifi,
    WifiOff,
    ChevronLeft
} from 'lucide-react';
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { getOptimizedImage } from '../../utils/supabaseImage';

const POSHeader = ({
    currentStore,
    user,
    printerStatus,
    onConnectPrinter,
    currentShift,
    onStartShift,
    onEndShift,
    onManageCash,
    hasPermission,
    onNavigate,
    onLogout,
    isOnline = true
}) => {
    return (
        <header className="px-4 py-3 bg-white border-b border-border flex items-center justify-between shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-2 min-w-0">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-slate-500 hover:text-slate-700"
                    onClick={() => onNavigate('/dashboard')}
                    title="Kembali ke Dashboard"
                >
                    <ChevronLeft size={20} />
                </Button>
                <div className="bg-primary/10 p-1 rounded-lg flex items-center gap-1.5 shrink-0">
                    <img src="/logo.png" alt="App Logo" className={cn("h-5 w-auto object-contain", currentStore?.logo ? "hidden sm:block" : "block")} />
                    {currentStore?.logo && (
                        <>
                            <div className="h-3 w-px bg-primary/20 hidden sm:block" />
                            <img src={getOptimizedImage(currentStore.logo, { width: 48, quality: 70 })} alt="Store Logo" className="h-5 w-5 object-cover rounded-full" />
                        </>
                    )}
                </div>
                {currentStore && (
                    <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <h1 className="text-sm font-bold tracking-tight leading-none truncate max-w-[80px] xs:max-w-[120px] sm:max-w-none">
                                {currentStore.name || 'Kasir Pro'}
                            </h1>
                            <div className={cn(
                                "flex items-center gap-1 px-1 py-0.5 rounded-full text-[8px] font-bold border shrink-0",
                                isOnline
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                            )}>
                                {isOnline ? <Wifi size={8} /> : <WifiOff size={8} />}
                                <span className="hidden md:inline">{isOnline ? "Online" : "Offline"}</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground mt-0.5 truncate max-w-[100px] sm:max-w-none">
                            {user?.name || 'Staff'}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
                <Button
                    variant={printerStatus.connected ? "outline" : "ghost"}
                    size="sm"
                    className={cn(
                        "h-8 px-2 gap-1 transition-all",
                        printerStatus.connected
                            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            : "text-muted-foreground"
                    )}
                    onClick={onConnectPrinter}
                    title={printerStatus.connected ? 'Connected' : 'Connect Printer'}
                >
                    <Bluetooth size={14} />
                    <span className="hidden lg:inline text-xs">
                        {printerStatus.connected ? 'Connected' : 'Connect'}
                    </span>
                </Button>

                {/* Shift Controls */}
                {currentShift ? (
                    <div className="flex items-center gap-1 sm:gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 gap-1"
                            onClick={onManageCash}
                            title="Kelola Kas"
                        >
                            <Wallet size={14} />
                            <span className="hidden lg:inline text-xs">Kas</span>
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 px-2 gap-1 shadow-sm"
                            onClick={onEndShift}
                            title="Tutup Shift"
                        >
                            <Clock size={14} />
                            <span className="hidden lg:inline text-xs">Tutup</span>
                        </Button>
                    </div>
                ) : (
                    <Button
                        size="sm"
                        className="h-8 px-2 gap-1 bg-indigo-600 hover:bg-indigo-700 shadow-sm"
                        onClick={onStartShift}
                        title="Buka Shift"
                    >
                        <Clock size={14} />
                        <span className="hidden lg:inline text-xs">Buka Shift</span>
                    </Button>
                )}

                <div className="h-4 w-px bg-border mx-0.5 sm:mx-1" />

                {/* Navigation Icons - Hidden on very small screens, use icon-only on mobile */}
                <div className="flex items-center gap-0.5 sm:gap-1">
                    {hasPermission?.('products.stock') && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hidden xs:flex"
                            onClick={() => onNavigate('/stock-management')}
                            title="Stok"
                        >
                            <Package size={16} />
                        </Button>
                    )}

                    {hasPermission?.('dashboard') && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hidden xs:flex"
                            onClick={() => onNavigate('/dashboard')}
                            title="Dashboard"
                        >
                            <LayoutDashboard size={16} />
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={onLogout}
                        title="Keluar"
                    >
                        <LogOut size={16} />
                    </Button>
                </div>
            </div>
        </header>
    );
};

export default POSHeader;
