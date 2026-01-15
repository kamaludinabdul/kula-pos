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
            <div className="flex items-center gap-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mr-1 text-slate-500 hover:text-slate-700"
                    onClick={() => onNavigate('/dashboard')}
                    title="Kembali ke Dashboard"
                >
                    <ChevronLeft size={20} />
                </Button>
                <div className="bg-primary/10 p-1.5 rounded-lg flex items-center gap-2">
                    <img src="/logo.png" alt="App Logo" className="h-6 w-auto object-contain" />
                    {currentStore?.logo && (
                        <>
                            <div className="h-4 w-px bg-primary/20" />
                            <img src={getOptimizedImage(currentStore.logo, { width: 48, quality: 70 })} alt="Store Logo" className="h-6 w-6 object-cover rounded-sm" />
                        </>
                    )}
                </div>
                {currentStore && (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <h1 className="text-sm font-bold tracking-tight leading-none">
                                {currentStore.name || 'Kasir Pro'}
                            </h1>
                            <div className={cn(
                                "flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border",
                                isOnline
                                    ? "bg-green-50 text-green-700 border-green-200"
                                    : "bg-red-50 text-red-700 border-red-200"
                            )} title={isOnline ? "Online" : "Offline Mode"}>
                                {isOnline ? <Wifi size={10} /> : <WifiOff size={10} />}
                                <span className="hidden sm:inline">{isOnline ? "Online" : "Offline"}</span>
                            </div>
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground mt-1">
                            {user?.name || 'Staff'}
                        </span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant={printerStatus.connected ? "outline" : "ghost"}
                    size="sm"
                    className={cn(
                        "h-8 gap-2 transition-all",
                        printerStatus.connected
                            ? "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"
                            : "text-muted-foreground"
                    )}
                    onClick={onConnectPrinter}
                >
                    <Bluetooth size={14} />
                    <span className="hidden sm:inline text-xs">
                        {printerStatus.connected ? 'Connected' : 'Connect'}
                    </span>
                </Button>

                {/* Shift Controls */}
                {currentShift ? (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 gap-2"
                            onClick={onManageCash}
                        >
                            <Wallet size={14} />
                            <span className="hidden sm:inline text-xs">Kas</span>
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            className="h-8 gap-2"
                            onClick={onEndShift}
                        >
                            <Clock size={14} />
                            <span className="hidden sm:inline text-xs">Tutup</span>
                        </Button>
                    </>
                ) : (
                    <Button
                        size="sm"
                        className="h-8 gap-2 bg-indigo-600 hover:bg-indigo-700"
                        onClick={onStartShift}
                    >
                        <Clock size={14} />
                        <span className="hidden sm:inline text-xs">Buka Shift</span>
                    </Button>
                )}

                <div className="h-4 w-px bg-border mx-1" />

                {/* Navigation Icons */}
                {hasPermission?.('products.stock') && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground"
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
                        className="h-8 w-8 text-muted-foreground"
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
        </header>
    );
};

export default POSHeader;
