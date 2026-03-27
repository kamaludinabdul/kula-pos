import React from 'react';
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { GitCommit, Tag, Calendar } from 'lucide-react';
import { APP_VERSION } from '../version';

// This data would ideally come from a database or a markdown file
// For now, we'll maintain it here as a structured constant
const CHANGELOG_DATA = [
    {
        "version": "0.26.6",
        "date": "2026-03-27",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.26.6"
        ]
    },
    {
        "version": "0.26.6",
        "date": "2026-03-27",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**POS Rental Dialog**: Label dan preset durasi sewa kini dinamis berdasarkan `product.unit` (Menit/Jam/Hari), tidak lagi hardcoded \"Jam\".",
            "**POS Keranjang**: Nama item rental di keranjang dan struk kini menampilkan unit asli (contoh: \"PS 3 (30 Menit)\"), bukan selalu \"(X Jam)\".",
            "**POS Stok Unlimited**: Memperbaiki validasi stok yang memblokir item `isUnlimited` (contoh: PS 3) dengan pesan \"Stok Habis\" palsu.",
            "**Laporan Transaksi**: Pendapatan Jasa/Sewa kini dihitung secara case-insensitive (`jasa`, `Jasa`, `sewa` semuanya masuk \"Pendapatan Jasa\").",
            "**Laporan Defecta**: Item bertipe Jasa/Sewa tidak lagi muncul di peringatan stok menipis.",
            "**Laporan Laba Rugi (RPC)**: Query SQL `get_profit_loss_report` dipatch agar revenue split Jasa/Sewa case-insensitive. Debug fields dihapus untuk production.",
            "**Fee Pet Hotel**: Pembagian fee harian dipatenkan maksimal 2 shift (0.5 + 0.5). Shift ke-3 dan seterusnya tidak dihitung untuk menghindari pembulatan pecahan.",
            "**Production SQL Script**: `scripts/production_deploy_2026-03-27.sql` siap dijalankan di Supabase SQL Editor."
        ]
    },
    {
        "version": "0.26.5",
        "date": "2026-03-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**AI Smart Insight**: Laporan tutup shift Telegram kini lebih pintar dengan perbandingan data historis (kemarin, minggu lalu, bulan lalu) dan analisis kondisi cuaca lokal untuk evaluasi performa yang lebih akurat.",
            "Bumped version to 0.26.5"
        ]
    },
    {
        "version": "0.26.4",
        "date": "2026-03-26",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "**Shift Report**: Memperbaiki masalah perhitungan ganda (*double-counting*) pada total penjualan, tunai, dan non-tunai di tabel shift. Sistem kini menimpa nilai agregat dengan data riil dari tabel transaksi saat penutupan shift untuk akurasi 100%.",
            "**Inventory Reporting**: Mengecualikan item jasa/unlimited (stok 999999) dari laporan Nilai Stok/Aset Modal untuk mencegah penggelembungan nilai modal yang tidak akurat.",
            "**UI/UX**: Memindahkan posisi tombol melayang (*Bug Report FAB*) agar tidak menutupi navigasi halaman (pagination) di bagian bawah layar.",
            "**Pet Hotel Automation**: Integrasi otomatisasi pembuatan komisi (*Fee*) Pet Hotel langsung saat checkout transaksi rental di POS."
        ]
    },
    {
        "version": "0.26.3",
        "date": "2026-03-25",
        "type": "patch",
        "title": "Patch Release",
        "changes": [
            "Bumped version to 0.26.3"
        ]
    }
];

const ChangeLog = () => {
    return (
        <div className="p-4 max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
                <p className="text-muted-foreground">
                    Riwayat pembaruan dan perubahan sistem KULA.
                    Versi saat ini: <span className="font-semibold text-foreground">v{APP_VERSION}</span>
                </p>
            </div>

            <div className="relative border-l border-slate-200 ml-3 space-y-12">
                {CHANGELOG_DATA.map((log, index) => (
                    <div key={index} className="relative pl-8">
                        {/* Timeline Dot */}
                        <div className={`absolute - left - [5px] top - 2 h - 2.5 w - 2.5 rounded - full border border - white ring - 4 ring - white ${log.type === 'major' ? 'bg-indigo-600' :
                            log.type === 'minor' ? 'bg-blue-500' : 'bg-slate-400'
                            } `} />

                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <div className="flex items-center gap-2">
                                    <Badge variant={log.type === 'major' ? 'default' : 'secondary'} className={
                                        log.type === 'major' ? 'bg-indigo-600 hover:bg-indigo-700' :
                                            log.type === 'minor' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                                'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }>
                                        v{log.version}
                                    </Badge>
                                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                                        <Calendar size={14} />
                                        {new Date(log.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                                <h2 className="text-lg font-semibold text-slate-900">{log.title}</h2>
                            </div>

                            <Card>
                                <CardContent className="p-4">
                                    <ul className="space-y-3">
                                        {log.changes.map((change, i) => (
                                            <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                                                <GitCommit size={16} className="mt-0.5 text-slate-400 shrink-0" />
                                                <span className="leading-relaxed">{change}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChangeLog;
