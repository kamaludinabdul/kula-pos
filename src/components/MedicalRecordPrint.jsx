import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Printer, FileText, Heart, Activity, Pill, Calendar, User, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const MedicalRecordPrint = ({ isOpen, onClose, record, pet, customer, store }) => {
    const printRef = useRef(null);

    const handlePrint = () => {
        const content = printRef.current;
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Rekam Medis - ${pet?.name}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
                        body { 
                            font-family: 'Inter', sans-serif; 
                            margin: 0; 
                            padding: 20mm;
                            background: white;
                            color: #1e293b;
                        }
                        .print-container {
                            max-width: 800px;
                            margin: auto;
                        }
                        .header {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            border-bottom: 2px solid #e2e8f0;
                            padding-bottom: 20px;
                            margin-bottom: 30px;
                        }
                        .clinic-info {
                            display: flex;
                            gap: 15px;
                            align-items: center;
                        }
                        .clinic-logo {
                            width: 60px;
                            height: 60px;
                            object-fit: contain;
                        }
                        .clinic-details h1 {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 800;
                            color: #2563eb;
                            text-transform: uppercase;
                        }
                        .clinic-details p {
                            margin: 2px 0;
                            font-size: 12px;
                            color: #64748b;
                        }
                        .doc-title {
                            text-align: right;
                        }
                        .doc-title h2 {
                            margin: 0;
                            font-size: 18px;
                            font-weight: 700;
                            color: #0f172a;
                        }
                        .doc-title p {
                            margin: 0;
                            font-size: 12px;
                            color: #64748b;
                        }
                        .info-grid {
                            display: grid;
                            grid-template-cols: 1fr 1fr;
                            gap: 30px;
                            margin-bottom: 30px;
                        }
                        .info-section {
                            background: #f8fafc;
                            padding: 15px;
                            border-radius: 8px;
                            border: 1px solid #e2e8f0;
                        }
                        .info-section h3 {
                            margin: 0 0 10px 0;
                            font-size: 10px;
                            font-weight: 800;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            color: #64748b;
                        }
                        .info-row {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 5px;
                            font-size: 13px;
                        }
                        .info-label {
                            font-weight: 600;
                            color: #64748b;
                        }
                        .info-value {
                            font-weight: 700;
                            color: #1e293b;
                        }
                        .content-section {
                            margin-bottom: 25px;
                        }
                        .content-section h4 {
                            margin: 0 0 8px 0;
                            font-size: 12px;
                            font-weight: 700;
                            color: #2563eb;
                            border-left: 3px solid #3b82f6;
                            padding-left: 10px;
                        }
                        .content-box {
                            font-size: 13px;
                            line-height: 1.6;
                            color: #334155;
                            background: #fff;
                            padding: 10px;
                            border: 1px solid #f1f5f9;
                            white-space: pre-wrap;
                        }
                        .table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 12px;
                            margin-top: 5px;
                        }
                        .table th {
                            text-align: left;
                            background: #f1f5f9;
                            padding: 8px;
                            border: 1px solid #e2e8f0;
                            font-weight: 700;
                        }
                        .table td {
                            padding: 8px;
                            border: 1px solid #e2e8f0;
                        }
                        .footer {
                            margin-top: 50px;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            border-top: 1px solid #f1f5f9;
                            padding-top: 20px;
                        }
                        .footer-text {
                            font-size: 10px;
                            color: #94a3b8;
                            font-style: italic;
                        }
                        .signature {
                            text-align: center;
                            min-width: 200px;
                        }
                        .sig-line {
                            border-top: 1px solid #0f172a;
                            margin-top: 60px;
                            padding-top: 5px;
                            font-weight: 700;
                            font-size: 13px;
                        }
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body>
                    ${content.innerHTML}
                    <script>
                        window.onload = () => {
                            window.print();
                            window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    if (!record || !pet) return null;

    const dateStr = format(new Date(record.date || new Date()), 'dd MMMM yyyy HH:mm', { locale: id });
    const nextVisitStr = record.nextVisit ? format(new Date(record.nextVisit), 'dd MMMM yyyy', { locale: id }) : '-';

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-center">
                        <DialogTitle className="flex items-center gap-2">
                            <Printer className="h-5 w-5 text-slate-600" />
                            Pratinjau Cetak Rekam Medis
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 overflow-hidden">
                    <div ref={printRef} className="bg-white shadow-sm mx-auto p-[15mm] min-h-[297mm] text-slate-800">
                        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #e2e8f0', paddingBottom: '15px', marginBottom: '25px' }}>
                            <div className="clinic-info" style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                                {store?.logo && (
                                    <img src={store.logo} alt="Logo" style={{ width: '50px', height: '50px', objectFit: 'contain' }} />
                                )}
                                <div className="clinic-details">
                                    <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#2563eb' }}>{store?.name || 'KULA PET CARE & CLINIC'}</h1>
                                    <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>{store?.address || '-'}</p>
                                    <p style={{ margin: '2px 0', fontSize: '11px', color: '#64748b' }}>Phone: {store?.phone || '-'} | Email: {store?.email || '-'}</p>
                                </div>
                            </div>
                            <div className="doc-title" style={{ textAlign: 'right' }}>
                                <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '700' }}>REKAM MEDIS PASIEN</h2>
                                <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>Electronic Medical Record (EMR)</p>
                            </div>
                        </div>

                        <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px', marginBottom: '25px' }}>
                            <div className="info-section" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' }}>Data Pasien</h3>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>No. RM:</span>
                                    <span style={{ fontWeight: '700' }}>{pet.rmNumber || '-'}</span>
                                </div>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Nama:</span>
                                    <span style={{ fontWeight: '700' }}>{pet.name}</span>
                                </div>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Spesies:</span>
                                    <span style={{ fontWeight: '700' }}>{pet.petType}</span>
                                </div>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Ras:</span>
                                    <span style={{ fontWeight: '700' }}>{pet.breed || '-'}</span>
                                </div>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Kelamin:</span>
                                    <span style={{ fontWeight: '700' }}>{pet.gender === 'male' ? 'Jantan' : 'Betina'}</span>
                                </div>
                            </div>

                            <div className="info-section" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: '#64748b' }}>Kunjungan Info</h3>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Tanggal:</span>
                                    <span style={{ fontWeight: '700' }}>{dateStr}</span>
                                </div>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Pemilik:</span>
                                    <span style={{ fontWeight: '700' }}>{customer?.name || '-'}</span>
                                </div>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Dokter:</span>
                                    <span style={{ fontWeight: '700' }}>{record.doctorName || '-'}</span>
                                </div>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Suhu:</span>
                                    <span style={{ fontWeight: '700' }}>{record.temperature || '-'} °C</span>
                                </div>
                                <div className="info-row" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Berat:</span>
                                    <span style={{ fontWeight: '700' }}>{record.weight || pet.weight || '-'} kg</span>
                                </div>
                            </div>
                        </div>

                        <div className="content-section" style={{ marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '700', color: '#2563eb', borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>Pemeriksaan & Gejala (Anamnesa)</h4>
                            <div className="content-box" style={{ fontSize: '11px', lineHeight: '1.5', color: '#334155', background: '#fff', padding: '10px', border: '1px solid #f1f5f9', whiteSpace: 'pre-wrap' }}>
                                {record.symptoms || '-'}
                            </div>
                        </div>

                        <div className="content-section" style={{ marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '700', color: '#2563eb', borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>Diagnosis</h4>
                            <div className="content-box" style={{ fontSize: '11px', lineHeight: '1.5', color: '#334155', background: '#fff', padding: '10px', border: '1px solid #f1f5f9', whiteSpace: 'pre-wrap' }}>
                                {record.diagnosis || '-'}
                            </div>
                        </div>

                        <div className="content-section" style={{ marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '700', color: '#2563eb', borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>Tindakan & Pengobatan</h4>
                            <div className="content-box" style={{ fontSize: '11px', lineHeight: '1.5', color: '#334155', background: '#fff', padding: '10px', border: '1px solid #f1f5f9', whiteSpace: 'pre-wrap' }}>
                                {record.treatment || '-'}
                            </div>
                        </div>

                        {record.prescriptions && record.prescriptions.length > 0 && (
                            <div className="content-section" style={{ marginBottom: '20px' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '700', color: '#2563eb', borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>Resep Obat</h4>
                                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '5px' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ textAlign: 'left', padding: '6px', border: '1px solid #e2e8f0' }}>Obat</th>
                                            <th style={{ textAlign: 'left', padding: '6px', border: '1px solid #e2e8f0' }}>Dosis / Aturan Pakai</th>
                                            <th style={{ textAlign: 'center', padding: '6px', border: '1px solid #e2e8f0', width: '80px' }}>Jumlah</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {record.prescriptions.map((p, i) => (
                                            <tr key={i}>
                                                <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>{p.medicine}</td>
                                                <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>{p.dosage || '-'}</td>
                                                <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'center' }}>{p.duration || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {record.services && record.services.length > 0 && (
                            <div className="content-section" style={{ marginBottom: '20px' }}>
                                <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', fontWeight: '700', color: '#2563eb', borderLeft: '3px solid #3b82f6', paddingLeft: '8px' }}>Jasa / Layanan</h4>
                                <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '5px' }}>
                                    <thead>
                                        <tr style={{ background: '#f1f5f9' }}>
                                            <th style={{ textAlign: 'left', padding: '6px', border: '1px solid #e2e8f0' }}>Nama Layanan</th>
                                            <th style={{ textAlign: 'right', padding: '6px', border: '1px solid #e2e8f0', width: '120px' }}>Harga</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {record.services.map((s, i) => (
                                            <tr key={i}>
                                                <td style={{ padding: '6px', border: '1px solid #e2e8f0' }}>{s.name}</td>
                                                <td style={{ padding: '6px', border: '1px solid #e2e8f0', textAlign: 'right' }}>Rp {(s.price || 0).toLocaleString('id-ID')}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="content-section" style={{ marginBottom: '20px' }}>
                            <div className="info-row" style={{ display: 'flex', gap: '50px', fontSize: '12px' }}>
                                <div>
                                    <span style={{ color: '#64748b', fontWeight: '600' }}>Rencana Kontrol:</span>
                                    <span style={{ fontWeight: '700', marginLeft: '10px' }}>{nextVisitStr}</span>
                                </div>
                            </div>
                        </div>

                        <div className="footer" style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '15px' }}>
                            <div className="footer-text" style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
                                Dokumen ini dihasilkan secara elektronik pada {format(new Date(), 'dd/MM/yyyy HH:mm')} • Kula POS v0.25.3
                            </div>
                            <div className="signature" style={{ textAlign: 'center', minWidth: '180px' }}>
                                <div style={{ fontSize: '11px', color: '#1e293b', marginBottom: '40px' }}>Dokter Hewan Pengampu,</div>
                                <div className="sig-line" style={{ borderTop: '1px solid #0f172a', paddingTop: '5px', fontWeight: '700', fontSize: '12px' }}>
                                    {record.doctorName || '................................'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                    <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                        <Printer className="h-4 w-4 mr-2" />
                        Cetak Sekarang
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default MedicalRecordPrint;
