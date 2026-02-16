// ESC/POS Command Constants
const ESC = '\x1B';
const GS = '\x1D';
const INIT = ESC + '@';
const CUT = GS + 'V' + '\x41' + '\x00';
const BOLD_ON = ESC + 'E' + '\x01';
const BOLD_OFF = ESC + 'E' + '\x00';
const ALIGN_LEFT = ESC + 'a' + '\x00';
const ALIGN_CENTER = ESC + 'a' + '\x01';
const ALIGN_RIGHT = ESC + 'a' + '\x02';
const DRAWER_KICK = ESC + 'p' + '\x00' + '\x19' + '\xFA'; // standard ESC/POS drawer kick

let connectedDevice = null;
let characteristic = null;
let isPrinting = false; // Mutex lock

// Detect mobile browser (Android/iOS)
const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// Platform-aware BLE settings
// Mobile BLE MTU is typically 20 bytes; desktop can handle more.
const getChunkSize = () => isMobile() ? 50 : 100;
const getChunkDelay = () => isMobile() ? 60 : 40;
const getLogoWidth = () => 128; // Same size for both — the chunk fix handles stability

// Safe chunked write with retry
const writeChunked = async (char, data, chunkSize, chunkDelay) => {
    for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, Math.min(i + chunkSize, data.length));
        let retries = 3;
        while (retries > 0) {
            try {
                await char.writeValue(chunk);
                break; // success
            } catch (e) {
                retries--;
                console.warn(`BLE write failed (${retries} retries left):`, e.message);
                if (retries === 0) throw e;
                await new Promise(r => setTimeout(r, 200)); // wait before retry
            }
        }
        await new Promise(r => setTimeout(r, chunkDelay));
    }
};

export const printerService = {
    isConnected: () => !!connectedDevice && !!characteristic && connectedDevice.gatt.connected,

    getDeviceName: () => connectedDevice ? connectedDevice.name : null,

    connect: async () => {
        try {
            if (!navigator.bluetooth) {
                throw new Error('Web Bluetooth API not supported in this browser.');
            }

            console.log('Requesting Bluetooth Device...');
            const device = await navigator.bluetooth.requestDevice({
                filters: [
                    { services: ['000018f0-0000-1000-8000-00805f9b34fb'] } // Standard UUID for many thermal printers
                ],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });

            console.log('Connecting to GATT Server...');
            const server = await device.gatt.connect();

            console.log('Getting Service...');
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');

            console.log('Getting Characteristic...');
            const characteristics = await service.getCharacteristics();
            if (characteristics.length === 0) throw new Error('No characteristics found');

            // Find a writable characteristic
            let writeChar = null;
            for (const char of characteristics) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                    writeChar = char;
                    console.log('Found writable characteristic:', char.uuid);
                    break;
                }
            }

            // If no writable characteristic found, try to use the first one (might not work)
            if (!writeChar) {
                console.warn('No writable characteristic found, using first one');
                writeChar = characteristics[0];
            }

            characteristic = writeChar;
            connectedDevice = device;

            device.addEventListener('gattserverdisconnected', () => {
                console.log('Printer disconnected');
                connectedDevice = null;
                characteristic = null;
            });

            return { success: true, name: device.name };
        } catch (error) {
            console.error('Connection failed', error);
            return { success: false, error: error.message };
        }
    },

    autoConnect: async () => {
        try {
            if (!navigator.bluetooth || !navigator.bluetooth.getDevices) {
                console.log('Auto-connect not supported');
                return { success: false };
            }

            const devices = await navigator.bluetooth.getDevices();
            if (devices.length === 0) return { success: false };

            console.log('Found permitted devices:', devices);
            // Try to connect to the first available device
            const device = devices[0];

            console.log('Auto-connecting to:', device.name);

            // Full discovery is needed to get characteristic
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristics = await service.getCharacteristics();
            let writeChar = null;
            for (const char of characteristics) {
                if (char.properties.write || char.properties.writeWithoutResponse) {
                    writeChar = char;
                    break;
                }
            }
            if (!writeChar) writeChar = characteristics[0];

            characteristic = writeChar;
            connectedDevice = device;
            device.addEventListener('gattserverdisconnected', () => {
                console.log('Printer disconnected');
                connectedDevice = null;
                characteristic = null;
            });

            return { success: true, name: device.name };

        } catch (error) {
            console.error('Auto-connect failed:', error);
            return { success: false, error: error.message };
        }
    },

    disconnect: () => {
        if (connectedDevice) {
            connectedDevice.gatt.disconnect();
            connectedDevice = null;
            characteristic = null;
        }
    },

    // Simple text encoder
    encode: (text) => {
        const encoder = new TextEncoder();
        return encoder.encode(text);
    },

    // Helper to fetch image with CORS handling
    fetchImage: async (url) => {
        // If it's already a data URI, return it
        if (url.startsWith('data:')) return url;

        try {
            console.log("Fetching image for printer:", url);
            // Add timestamp to avoid cache issues
            const fetchUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;

            const response = await fetch(fetchUrl, {
                method: 'GET',
                mode: 'cors',
                cache: 'no-cache'
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.warn("Fetch failed, falling back to direct URL load:", error);
            return url; // Fallback
        }
    },

    // Helper to process image for ESC/POS (GS v 0)
    processImage: async (url, maxWidth = 360) => { // Reduced to 360 for safety
        // 1. Get functional image source (Data URI preferred)
        let imageSrc = url;
        try {
            imageSrc = await printerService.fetchImage(url);
        } catch (e) {
            console.warn("Pre-fetch failed, using original URL", e);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";

            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    // Calculate new dimensions (maintain aspect ratio)
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    // CRITICAL: Width must be divisible by 8 for ESC/POS GS v 0
                    // If not, the image will look scrambled ("berantakan")
                    if (width % 8 !== 0) {
                        const originalWidth = width;
                        width -= (width % 8);
                        console.log(`Adjusting image width for alignment: ${originalWidth} -> ${width}`);
                    }

                    // Safety check: ensure width is positive
                    if (width <= 0) width = 8;

                    console.log(`Processing Printer Image: ${width}x${height}`);

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');

                    // Fill white background first (transparency becomes black otherwise)
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, width, height);

                    ctx.drawImage(img, 0, 0, width, height);

                    const imgData = ctx.getImageData(0, 0, width, height);
                    const data = imgData.data;

                    // Convert to monochrome and pack bits
                    // GS v 0 m xL xH yL yH d1...dk
                    // m=0, x=width/8, y=height
                    const xL = (width / 8) % 256;
                    const xH = Math.floor((width / 8) / 256);
                    const yL = height % 256;
                    const yH = Math.floor(height / 256);



                    const header = [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH];
                    const rasterData = [];

                    for (let y = 0; y < height; y++) {
                        for (let x = 0; x < width; x += 8) {
                            let byte = 0x00;
                            for (let b = 0; b < 8; b++) {
                                if (x + b < width) {
                                    const offset = ((y * width) + (x + b)) * 4;
                                    // RGBA
                                    const r = data[offset];
                                    const g = data[offset + 1];
                                    const b_val = data[offset + 2];
                                    // Alpha threshold (if transparency exists)
                                    const a = data[offset + 3];

                                    // Logic: 0 = Print (Black/Dot), 1 = No Print (White/Space)
                                    // We treat "Dark" as 1 in bits initially, but ESC/POS usually:
                                    // 0 = White/Paper, 1 = Black/Dot

                                    // Standard luminance
                                    const brightness = (r * 0.299) + (g * 0.587) + (b_val * 0.114);

                                    // If pixel is dark (< 128) AND not transparent (> 128 alpha)
                                    // Set the bit to 1 (Print Dot)
                                    if (brightness < 128 && a > 128) {
                                        byte |= (1 << (7 - b));
                                    }
                                }
                            }
                            rasterData.push(byte);
                        }
                    }

                    const commands = new Uint8Array([...header, ...rasterData]);
                    resolve(commands);
                } catch (e) {
                    console.error("Image Processing Error (Canvas/Bitpacking):", e);
                    reject(e);
                }
            };

            img.onerror = (e) => {
                console.error("Image OnError:", e);
                reject(new Error("Image load failed"));
            };

            img.src = imageSrc;
        });
    },

    printReceipt: async (transaction, storeConfig) => {
        if (!printerService.isConnected()) {
            // Cleanup stale state if any
            if (connectedDevice && !connectedDevice.gatt.connected) {
                printerService.disconnect();
            }
            throw new Error('Printer not connected');
        }

        if (isPrinting) {
            throw new Error('Printer is busy. Please wait.');
        }

        isPrinting = true;

        try {
            const encoder = new TextEncoder();

            // 0. Open drawer immediately (if supported)
            await characteristic.writeValue(encoder.encode(DRAWER_KICK));
            await new Promise(resolve => setTimeout(resolve, 50));

            // 1. Send Logo first if exists and enabled
            if (storeConfig.logo && storeConfig.printLogo !== false) {
                try {
                    const mobile = isMobile();
                    const logoWidth = getLogoWidth();
                    const chunkSize = getChunkSize();
                    const chunkDelay = getChunkDelay();
                    console.log(`Logo print: mobile=${mobile}, width=${logoWidth}, chunk=${chunkSize}`);
                    await characteristic.writeValue(encoder.encode(ALIGN_CENTER));
                    await new Promise(r => setTimeout(r, 50));

                    const logoCommands = await printerService.processImage(storeConfig.logo, logoWidth);
                    console.log("Logo processed:", logoCommands.length, "bytes");
                    await writeChunked(characteristic, logoCommands, chunkSize, chunkDelay);
                    // Feed + delay after image
                    await new Promise(r => setTimeout(r, 200));
                    await characteristic.writeValue(encoder.encode(ESC + 'd' + '\x01'));
                    await new Promise(r => setTimeout(r, mobile ? 1000 : 500));
                    // Reset printer state
                    await characteristic.writeValue(encoder.encode(INIT));
                    await new Promise(r => setTimeout(r, 100));
                    await characteristic.writeValue(encoder.encode(ALIGN_LEFT));
                    await new Promise(r => setTimeout(r, 100));
                    console.log("Logo sent successfully");
                } catch (e) {
                    console.error("Failed to print logo:", e);
                    // Reset anyway just in case
                    await characteristic.writeValue(encoder.encode(INIT));
                }
            } else {
                console.log("No logo found in storeConfig");
            }

            let commands = INIT;

            // Helper to add text

            const addLine = (text) => commands += text + '\n';

            // Header
            commands += ALIGN_CENTER;
            commands += BOLD_ON + (storeConfig.name || 'Store') + '\n' + BOLD_OFF;
            if (storeConfig.address) addLine(storeConfig.address);
            if (storeConfig.phone) addLine(storeConfig.phone);
            if (storeConfig.receiptHeader) {
                addLine(storeConfig.receiptHeader);
            }
            commands += '\n';

            // Transaction Info
            commands += ALIGN_LEFT;
            addLine(`Date: ${new Date(transaction.date).toLocaleString('id-ID')}`);
            addLine(`Cashier: ${transaction.cashier}`);
            addLine(`No: #${transaction.id || '??????'}`);
            if (transaction.customerName) {
                addLine(`Pelanggan: ${transaction.customerName}`);
                if (transaction.customerPhone) {
                    addLine(`HP: ${transaction.customerPhone}`);
                }
            }
            // Determine max characters per line based on paper width
            const is80mm = storeConfig.printerWidth === '80mm';
            const maxChars = is80mm ? 48 : 32;

            addLine('-'.repeat(maxChars));

            // Items
            transaction.items.forEach(item => {
                // Format: Product Name ........... Total Price
                //         Qty x Price

                const total = (item.total || (item.price * item.qty) || 0).toLocaleString();
                const name = item.name;

                // Calculate space for Name + Total
                // 32 chars max. Total takes ~10 chars. Name takes rest.
                // If Name is too long, it might wrap, which is fine mostly, but let's try to fit.

                // Proposed Layout:
                // Product Name (Truncated if needed) ... Total
                // Qty x Price

                let line1 = name;
                const totalStr = total;
                const maxNameLen = maxChars - totalStr.length - 1;

                if (line1.length > maxNameLen) {
                    line1 = line1.substring(0, maxNameLen);
                }

                const spaces = maxChars - line1.length - totalStr.length;
                addLine(line1 + ' '.repeat(Math.max(1, spaces)) + totalStr);

                const qtyPrice = `${item.qty} x ${(item.price || 0).toLocaleString()}`;
                addLine(qtyPrice);
            });

            addLine('-'.repeat(maxChars));

            // Totals
            commands += ALIGN_RIGHT;
            const subtotal = transaction.subtotal || transaction.total || 0;
            addLine(`Subtotal: ${subtotal.toLocaleString()}`);

            if (transaction.discount > 0) {
                addLine(`Diskon: -${(transaction.discount || 0).toLocaleString()}`);
            }

            if (transaction.tax > 0) {
                addLine(`Pajak: ${(transaction.tax || 0).toLocaleString()}`);
            }

            if (transaction.serviceCharge > 0) {
                addLine(`Service: ${(transaction.serviceCharge || 0).toLocaleString()}`);
            }

            commands += BOLD_ON;
            addLine(`Total: ${(transaction.total || 0).toLocaleString()}`);
            commands += BOLD_OFF;

            // Payment Info
            const paymentMethodText = transaction.paymentMethod === 'cash' ? 'Tunai' :
                transaction.paymentMethod === 'qris' ? 'QRIS' :
                    transaction.paymentMethod === 'transfer' ? 'Transfer' : 'Debit';
            addLine(`${paymentMethodText}: ${(transaction.amountPaid || transaction.cashAmount || transaction.total || 0).toLocaleString()}`);

            if (transaction.paymentMethod === 'cash' && transaction.change > 0) {
                addLine(`Kembalian: ${(transaction.change || 0).toLocaleString()}`);
            }

            // Points / Loyalty (Integrated)
            if (transaction.customerName && (transaction.pointsEarned > 0 || transaction.customerTotalPoints >= 0)) {
                addLine('-'.repeat(32)); // Separator
                commands += ALIGN_CENTER;
                if (transaction.pointsEarned > 0) {
                    addLine(`Poin Didapat: +${transaction.pointsEarned}`);
                }
                if (transaction.customerTotalPoints !== undefined) {
                    addLine(`Sisa Poin: ${transaction.customerTotalPoints}`);
                }
                commands += ALIGN_LEFT; // Reset to left
            }

            // Footer
            commands += ALIGN_CENTER;
            commands += '\n';
            addLine(storeConfig.receiptFooter || 'Terima Kasih');
            // Minimized bottom padding (just enough to clear the cutter)
            // commands += '\n\n'; // Removed extra padding as per user request

            // Send in chunks to avoid Bluetooth buffer overflow
            const data = encoder.encode(commands);

            await writeChunked(characteristic, data, getChunkSize(), getChunkDelay());

            // Wait a bit before sending cut command to ensure all data is printed
            await new Promise(resolve => setTimeout(resolve, 200));
            // Only feed enough to cut
            await characteristic.writeValue(encoder.encode(ESC + 'd' + '\x01'));
            await characteristic.writeValue(encoder.encode(CUT));

            return { success: true };
        } catch (error) {
            console.error('Print failed', error);
            // If it's a GATT error, the connection is likely dead
            if (error.message.includes('GATT') || error.message.includes('disconnected')) {
                printerService.disconnect();
            }
            return { success: false, error: error.message };
        } finally {
            isPrinting = false;
        }
    },

    printVirtual: async (commands) => {
        console.log("--- VIRTUAL PRINTER START ---");
        // Simple decoder to make ESC/POS commands readable in console
        const lines = commands.split('\n');
        let output = "";

        lines.forEach(line => {
            // Remove control characters for display
            // eslint-disable-next-line no-control-regex
            let cleanLine = line.replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
                .replace(/\[\d+m/g, ""); // Remove color codes if any

            // Handle some formatters manually for visualization
            if (line.includes(ALIGN_CENTER)) output += "[CENTER] ";
            if (line.includes(ALIGN_RIGHT)) output += "[RIGHT]  ";
            if (line.includes(BOLD_ON)) output += "[BOLD] ";

            output += cleanLine + "\n";
        });

        console.log(output);
        console.log("--- VIRTUAL PRINTER END ---");
        alert("Virtual Print Success!\nCheck Console for output.\n\nPreview:\n" + output.substring(0, 200) + "...");
        return { success: true };
    },

    printTestReceipt: async (storeConfig) => {
        // Check connection first
        if (!printerService.isConnected()) {
            // Cleanup stale state if any
            if (connectedDevice && !connectedDevice.gatt.connected) {
                printerService.disconnect();
            }
            console.warn('Printer not connected. Using Virtual Printer.');
            return printerService.printVirtual("Virtual Test Print...");
        }

        try {
            const encoder = new TextEncoder();

            // 0. Open drawer immediately
            await characteristic.writeValue(encoder.encode(DRAWER_KICK));
            await new Promise(resolve => setTimeout(resolve, 50));

            // 1. Send Logo first if exists and enabled
            if (storeConfig.logo && storeConfig.printLogo !== false) {
                try {
                    const mobile = isMobile();
                    const logoWidth = getLogoWidth();
                    const chunkSize = getChunkSize();
                    const chunkDelay = getChunkDelay();
                    console.log(`Test logo: mobile=${mobile}, width=${logoWidth}, chunk=${chunkSize}`);
                    await characteristic.writeValue(encoder.encode(ALIGN_CENTER));
                    await new Promise(r => setTimeout(r, 50));
                    const logoCommands = await printerService.processImage(storeConfig.logo, logoWidth);
                    await writeChunked(characteristic, logoCommands, chunkSize, chunkDelay);
                    await new Promise(r => setTimeout(r, 200));
                    await characteristic.writeValue(encoder.encode(ESC + 'J' + '\x10'));
                    await new Promise(r => setTimeout(r, mobile ? 1000 : 500));
                    await characteristic.writeValue(encoder.encode(INIT));
                    await new Promise(r => setTimeout(r, 100));
                    await characteristic.writeValue(encoder.encode(ALIGN_LEFT));
                    await new Promise(r => setTimeout(r, 100));
                } catch (e) {
                    console.error("Failed to print logo in test:", e);
                    await characteristic.writeValue(encoder.encode(INIT));
                }
            }

            let commands = INIT;
            const addLine = (text) => commands += text + '\n';

            // Header
            commands += ALIGN_CENTER;
            commands += BOLD_ON + (storeConfig.name || 'Store') + '\n' + BOLD_OFF;
            if (storeConfig.address) addLine(storeConfig.address);
            if (storeConfig.phone) addLine(storeConfig.phone);
            if (storeConfig.receiptHeader) {
                // Reduced spacing before header note
                addLine(storeConfig.receiptHeader);
            }
            commands += '\n' + BOLD_ON + '*** TEST PRINT ***\n' + BOLD_OFF + '\n';

            // Transaction Info
            commands += ALIGN_LEFT;
            addLine(`Date: ${new Date().toLocaleString('id-ID')}`);
            addLine(`Cashier: Test User`);
            addLine(`No: #123456`);
            addLine(`Pelanggan: Pelanggan Contoh`);
            addLine(`HP: 081234567890`);
            addLine('-'.repeat(32));

            // Sample Items
            addLine('Produk Contoh 1' + ' '.repeat(10) + '30.000');
            addLine('2 x 15.000');

            addLine('Produk Contoh 2' + ' '.repeat(10) + '25.000');
            addLine('1 x 25.000');
            addLine('-'.repeat(32));

            // Totals
            commands += ALIGN_RIGHT;
            addLine('Subtotal: 55,000');
            addLine('Diskon: -5,000'); // Test Discount
            addLine('Pajak: 5,500');
            addLine('Service: 2,500');
            commands += BOLD_ON;
            addLine('Total: 58,000');
            commands += BOLD_OFF;

            // Payment
            addLine('Tunai: 100,000');
            addLine('Kembalian: 42,000');

            // Loyalty Test
            addLine('-'.repeat(32));
            commands += ALIGN_CENTER;
            commands += BOLD_ON + '* POIN LOYALITAS *\n' + BOLD_OFF;
            addLine('Poin Transaksi: +10');
            addLine('Total Poin: 150');

            // Footer
            commands += ALIGN_CENTER + '\n';
            addLine(storeConfig.receiptFooter || 'Terima Kasih');
            // Minimized bottom padding
            commands += '\n\n';

            const data = encoder.encode(commands);

            await writeChunked(characteristic, data, getChunkSize(), getChunkDelay());

            // Wait a bit before sending cut command to ensure all data is printed
            await new Promise(resolve => setTimeout(resolve, 200));
            // Only feed enough to cut
            await characteristic.writeValue(encoder.encode(ESC + 'd' + '\x01'));
            await characteristic.writeValue(encoder.encode(CUT));

            return { success: true };
        } catch (error) {
            console.error('Test print failed', error);
            if (error.message.includes('GATT') || error.message.includes('disconnected')) {
                printerService.disconnect();
            }
            return { success: false, error: error.message };
        } finally {
            isPrinting = false;
        }
    }
};
