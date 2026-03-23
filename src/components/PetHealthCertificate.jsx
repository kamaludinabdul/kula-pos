import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Printer, X, Award, ShieldCheck, Heart } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const PetHealthCertificate = ({ isOpen, onClose, record, pet, customer }) => {
    const printRef = useRef(null);

    const handlePrint = () => {
        const content = printRef.current;
        const printWindow = window.open('', '_blank');
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Health Certificate - ${pet?.name}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap');
                        body { 
                            font-family: 'Outfit', sans-serif; 
                            margin: 0; 
                            padding: 0;
                            background: white;
                        }
                        .cert-container {
                            width: 210mm;
                            height: 297mm;
                            padding: 20mm;
                            margin: auto;
                            box-sizing: border-box;
                            border: 15px double #1e3a8a;
                            position: relative;
                            background: #fff;
                        }
                        .watermark {
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            transform: translate(-50%, -50%) rotate(-45deg);
                            font-size: 150px;
                            color: rgba(30, 58, 138, 0.03);
                            font-weight: 900;
                            pointer-events: none;
                            white-space: nowrap;
                        }
                        .header { text-align: center; margin-bottom: 40px; }
                        .title { 
                            font-family: 'Playfair Display', serif; 
                            font-size: 42px; 
                            color: #1e3a8a; 
                            text-transform: uppercase; 
                            letter-spacing: 2px;
                            margin: 0;
                        }
                        .subtitle { 
                            font-style: italic; 
                            color: #64748b; 
                            font-size: 18px; 
                            margin-top: 5px;
                        }
                        .divider {
                            width: 100px;
                            height: 3px;
                            background: #1e3a8a;
                            margin: 20px auto;
                        }
                        .section { margin-bottom: 30px; }
                        .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 40px; }
                        .label { 
                            font-size: 11px; 
                            font-weight: 900; 
                            text-transform: uppercase; 
                            color: #1e3a8a; 
                            letter-spacing: 1px;
                            margin-bottom: 5px;
                        }
                        .value { 
                            font-family: 'Playfair Display', serif; 
                            font-size: 22px; 
                            border-bottom: 1px solid #e2e8f0; 
                            padding-bottom: 5px;
                            color: #1e293b;
                        }
                        .findings {
                            background: #f8fafc;
                            border: 1px solid #e2e8f0;
                            padding: 25px;
                            border-radius: 12px;
                            margin: 40px 0;
                        }
                        .findings-title {
                            text-align: center;
                            font-weight: 900;
                            color: #1e3a8a;
                            margin-bottom: 20px;
                            text-transform: uppercase;
                        }
                        .footer {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            margin-top: 60px;
                        }
                        .signature-line {
                            width: 250px;
                            border-top: 2px solid #0f172a;
                            text-align: center;
                            padding-top: 10px;
                            font-weight: 700;
                        }
                        @media print {
                            body { -webkit-print-color-adjust: exact; }
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

    const dateStr = format(new Date(record.date || new Date()), 'dd MMMM yyyy', { locale: id });

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex justify-between items-center">
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-blue-600" />
                            Cetak Sertifikat Kesehatan
                        </DialogTitle>
                    </div>
                </DialogHeader>

                <div className="bg-slate-50 p-8 rounded-xl border-2 border-dashed border-slate-200">
                    <div ref={printRef} className="cert-wrapper bg-white shadow-2xl mx-auto overflow-hidden">
                        <div className="cert-container" style={{ width: '100%', border: '15px double #1e3a8a', padding: '40px', boxSizing: 'border-box', position: 'relative' }}>
                            <div className="watermark" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-45deg)', fontSize: '100px', color: 'rgba(30,58,138,0.03)', fontWeight: '900', zIndex: 0, whiteSpace: 'nowrap' }}>
                                HEALTHY PET
                            </div>

                            <div className="header" style={{ textAlign: 'center', marginBottom: '40px', position: 'relative', zIndex: 1 }}>
                                <Award style={{ height: '60px', width: '60px', color: '#eab308', margin: '0 auto 10px' }} />
                                <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '32px', color: '#1e3a8a', textTransform: 'uppercase', margin: 0 }}>Sertifikat Kesehatan</h1>
                                <p style={{ color: '#64748b', fontStyle: 'italic', margin: '5px 0' }}>Health Certificate of Good Health</p>
                                <div style={{ width: '80px', height: '3px', background: '#1e3a8a', margin: '15px auto' }} />
                            </div>

                            <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', position: 'relative', zIndex: 1 }}>
                                <div className="column">
                                    <div className="section" style={{ marginBottom: '20px' }}>
                                        <div className="label" style={{ fontSize: '10px', fontWeight: '900', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '5px' }}>Nama Pasien (Pet Name)</div>
                                        <div className="value" style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>{pet.name}</div>
                                    </div>
                                    <div className="section" style={{ marginBottom: '20px' }}>
                                        <div className="label" style={{ fontSize: '10px', fontWeight: '900', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '5px' }}>Spesies & Breed</div>
                                        <div className="value" style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>{pet.petType} / {pet.breed || '-'}</div>
                                    </div>
                                    <div className="section" style={{ marginBottom: '20px' }}>
                                        <div className="label" style={{ fontSize: '10px', fontWeight: '900', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '5px' }}>Warna / Tanda</div>
                                        <div className="value" style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>{pet.color || '-'}</div>
                                    </div>
                                </div>
                                <div className="column">
                                    <div className="section" style={{ marginBottom: '20px' }}>
                                        <div className="label" style={{ fontSize: '10px', fontWeight: '900', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '5px' }}>Pemilik (Owner)</div>
                                        <div className="value" style={{ fontFamily: 'Playfair Display, serif', fontSize: '20px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>{customer?.name || '-'}</div>
                                    </div>
                                    <div className="section" style={{ marginBottom: '20px' }}>
                                        <div className="label" style={{ fontSize: '10px', fontWeight: '900', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '5px' }}>Kontak</div>
                                        <div className="value" style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>{customer?.phone || '-'}</div>
                                    </div>
                                    <div className="section" style={{ marginBottom: '20px' }}>
                                        <div className="label" style={{ fontSize: '10px', fontWeight: '900', color: '#1e3a8a', textTransform: 'uppercase', marginBottom: '5px' }}>Tanggal Periksa</div>
                                        <div className="value" style={{ fontFamily: 'Playfair Display, serif', fontSize: '18px', borderBottom: '1px solid #e2e8f0', color: '#1e293b' }}>{dateStr}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="findings" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '10px', margin: '30px 0', position: 'relative', zIndex: 1 }}>
                                <div className="findings-title" style={{ textAlign: 'center', fontWeight: '900', color: '#1e3a8a', marginBottom: '15px', textTransform: 'uppercase', fontSize: '12px' }}>Hasil Pemeriksaan Fisik</div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '20px' }}>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b' }}>Berat Badan</div>
                                        <div style={{ fontWeight: '900', fontSize: '16px' }}>{pet.weight || record.weight || '-'} kg</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b' }}>Temperatur</div>
                                        <div style={{ fontWeight: '900', fontSize: '16px' }}>{record.temperature || '-'} °C</div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ fontSize: '10px', fontWeight: '700', color: '#64748b' }}>Kondisi</div>
                                        <div style={{ fontWeight: '900', fontSize: '16px' }}>Normal</div>
                                    </div>
                                </div>
                                <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.6' }}>
                                    <strong>Diagnosis / Catatan:</strong><br />
                                    <span style={{ fontStyle: 'italic' }}>"{record.diagnosis || 'Sehat'}. {record.treatment ? `Telah diberikan tindakan berupa ${record.treatment}.` : ''}"</span>
                                </div>
                            </div>

                            <div className="footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '50px', position: 'relative', zIndex: 1 }}>
                                <div className="store-info" style={{ textAlign: 'left' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#1e3a8a', fontWeight: '900', fontSize: '14px' }}>
                                        <Heart style={{ height: '14px', width: '14px', fill: '#1e3a8a' }} />
                                        PET CLINIC SYSTEM
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b' }}>Official Health Validation</div>
                                </div>
                                <div className="signature" style={{ textAlign: 'center' }}>
                                    <div style={{ height: '60px' }}></div>
                                    <div className="signature-line" style={{ width: '200px', borderTop: '2px solid #0f172a', fontWeight: '700', fontSize: '14px', paddingTop: '5px' }}>
                                        {record.doctorName || 'Veterinarian'}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase' }}>Dokter Hewan Pemeriksa</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Tutup</Button>
                    <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                        <Printer className="h-4 w-4 mr-2" />
                        Cetak Sertifikat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PetHealthCertificate;
