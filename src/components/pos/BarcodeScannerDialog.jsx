import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from "html5-qrcode";
import { Camera, RefreshCw } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

const BarcodeScannerDialog = ({ isOpen, onClose, onScan }) => {
    const [cameras, setCameras] = useState([]);
    const [selectedCamera, setSelectedCamera] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const html5QrCodeRef = useRef(null);

    const stopScanner = React.useCallback(async () => {
        if (html5QrCodeRef.current) {
            try {
                await html5QrCodeRef.current.stop();
                html5QrCodeRef.current.clear();
                html5QrCodeRef.current = null;
                setIsScanning(false);
            } catch (err) {
                console.error("Failed to stop scanner", err);
            }
        }
    }, []);

    const startScannerInternal = React.useCallback((cameraId) => {
        const html5QrCode = new Html5Qrcode("reader");
        html5QrCodeRef.current = html5QrCode;

        html5QrCode.start(
            cameraId,
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            (decodedText, decodedResult) => {
                console.log(`Code matched = ${decodedText}`, decodedResult);

                // Play beep sound
                const audio = new Audio('/beep.mp3');
                audio.play().catch(e => console.log("Audio play failed", e));

                onScan(decodedText);
            },
            () => {
                // parse error, ignore it.
            }
        ).then(() => {
            setIsScanning(true);
        }).catch((err) => {
            console.error("Error starting scanner", err);
            setIsScanning(false);
        });
    }, [onScan]);

    const startScanner = React.useCallback((cameraId) => {
        if (html5QrCodeRef.current) {
            stopScanner().then(() => startScannerInternal(cameraId));
        } else {
            startScannerInternal(cameraId);
        }
    }, [stopScanner, startScannerInternal]);

    useEffect(() => {
        if (isOpen) {
            Html5Qrcode.getCameras().then(devices => {
                if (devices && devices.length) {
                    setCameras(devices);
                    const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment'));
                    setSelectedCamera(backCamera ? backCamera.id : devices[0].id);
                }
            }).catch(err => {
                console.error("Error getting cameras", err);
            });
        } else {
            setTimeout(() => stopScanner(), 0);
        }

        return () => {
            stopScanner();
        };
    }, [isOpen, stopScanner]);

    useEffect(() => {
        if (selectedCamera && isOpen && !isScanning) {
            setTimeout(() => startScanner(selectedCamera), 0);
        }
    }, [selectedCamera, isOpen, isScanning, startScanner]);

    const handleClose = () => {
        stopScanner();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Camera className="h-5 w-5" />
                        Scan Barcode
                    </DialogTitle>
                </DialogHeader>

                <div className="flex flex-col gap-4">
                    {cameras.length > 0 && (
                        <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih Kamera" />
                            </SelectTrigger>
                            <SelectContent>
                                {cameras.map(camera => (
                                    <SelectItem key={camera.id} value={camera.id}>
                                        {camera.label || `Camera ${camera.id}`}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}

                    <div className="relative bg-black rounded-2xl overflow-hidden min-h-[300px] flex items-center justify-center shadow-inner border border-slate-800 group">
                        <div id="reader" className="w-full h-full"></div>

                        {/* Scanning Overlay */}
                        {isScanning && (
                            <>
                                <div className="absolute inset-0 pointer-events-none border-[3px] border-indigo-500/30 rounded-2xl z-10" />
                                <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-red-500/80 shadow-[0_0_15px_rgba(239,68,68,0.8)] z-10 animate-pulse" />
                                <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-indigo-500/5 to-transparent z-0" />
                            </>
                        )}

                        {!isScanning && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-2 bg-slate-900">
                                <RefreshCw className="animate-spin text-indigo-500" />
                                <p className="text-sm font-medium">Memulai kamera...</p>
                            </div>
                        )}
                    </div>

                    <p className="text-center text-sm text-slate-500">
                        Arahkan kamera ke barcode produk.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BarcodeScannerDialog;
