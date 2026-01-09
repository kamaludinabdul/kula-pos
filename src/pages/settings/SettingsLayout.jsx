import React from 'react';
import { Outlet } from 'react-router-dom';

const SettingsLayout = () => {
    return (
        <div className="p-6 space-y-6">
            <header>
                <h1 className="text-3xl font-bold">Pengaturan</h1>
                <p className="text-muted-foreground mt-1">Kelola konfigurasi toko Anda.</p>
            </header>

            <main>
                <Outlet />
            </main>
        </div>
    );
};

export default SettingsLayout;
