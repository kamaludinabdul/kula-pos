import { formatDate } from './utils';
import { prepareReceiptData } from './receiptLogic';

export const generateReceiptHtml = (transaction, store) => {
    const isStandardPaper = store?.printerWidth === '80mm';
    const isContinuous = store?.printerWidth === 'continuous';

    const {
        totalQty,
        subtotal,
        tax,
        serviceCharge,
        finalTotal,
        amountPaid,
        change
    } = prepareReceiptData(transaction, store);

    return `
        <html>
            <head>
                <title>Receipt #${transaction.id}</title>
                <style>
                    @page { size: auto; margin: 0mm; }
                    body { 
                        font-family: ${store?.printerWidth === 'continuous' ? '"Courier New", Courier, monospace' : "'Courier New', monospace"};
                        background-color: #fff;
                        width: ${isStandardPaper ? '78mm' : store?.printerWidth === 'continuous' ? '210mm' : '48mm'}; 
                        margin: ${store?.printerWidth === 'continuous' ? '0 10mm' : '0 auto'}; 
                        padding: 0;
                        color: #000;
                        overflow: visible;
                        min-height: 100%;
                        height: auto;
                        font-size: ${store?.printerWidth === 'continuous' ? '14px' : '12px'};
                    }
                    .header { text-align: center; margin-bottom: 5px; }
                    .store-name { font-size: 1.2em; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
                    .divider { border-top: 1px dashed #000; margin: 3px 0; width: 100%; }
                    .item { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 0.9em; }
                    .totals { margin-top: 5px; display: flex; flex-direction: column; align-items: flex-end; font-size: 0.9em; }
                    .total-row { display: flex; justify-content: space-between; width: 100%; margin-top: 2px; }
                    .footer { text-align: center; margin-top: 10px; font-size: 0.8em; color: #444; }
                    .watermark {
                        position: fixed;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%) rotate(-45deg);
                        font-size: 3rem;
                        font-weight: bold;
                        color: rgba(0, 0, 0, 0.1);
                        border: 4px solid rgba(0, 0, 0, 0.1);
                        padding: 5px 20px;
                        z-index: 9999;
                        pointer-events: none;
                    }
                </style>
            </head>
            <body>
                ${(transaction.status === 'cancelled' || transaction.status === 'void') && store?.printerWidth !== 'continuous' ? '<div class="watermark">VOID</div>' : ''}
                <div class="header">
                    ${store?.logo && store?.printLogo !== false && store?.printerWidth !== 'continuous' ? `<img src="${store.logo}" style="max-height: 40px; margin-bottom: 5px; filter: grayscale(100%);" />` : ''}
                    <div class="store-name">${store?.name || 'Store'}</div>
                    <div style="font-size: 0.8em;">${store?.address || ''}</div>
                    <div style="font-size: 0.8em;">${store?.phone || ''}</div>
                    <div class="divider"></div>
                    <div style="font-size: 0.9em;">${store?.receiptHeader || ''}</div>
                </div>

                <div style="font-size: 0.8em; color: #555; margin-bottom: 5px;">
                    <div style="display: flex; justify-content: space-between;">
                       <span>${formatDate(transaction.date)}</span>
                       <span>${transaction.cashier || 'Staff'}</span>
                    </div>
                    <div>No: #${transaction.id}</div>
                    ${transaction.customerName ? `
                    <div style="margin-top: 2px; font-weight: bold;">
                        Pelanggan: ${transaction.customerName}
                    </div>
                    ${transaction.customerPhone ? `<div>HP: ${transaction.customerPhone}</div>` : ''}
                    ` : ''}
                </div>
                
                <div class="divider"></div>
                <div class="items">
                    ${isContinuous ? `
                        <table style="width: 100%; border-collapse: collapse; font-family: 'Courier New', monospace;">
                            <thead>
                                <tr style="border-bottom: 1px dashed #000;">
                                    <th style="text-align: left; padding: 2px 0;">Item</th>
                                    <th style="text-align: right; padding: 2px 0; width: 15%;">Qty</th>
                                    <th style="text-align: right; padding: 2px 0; width: 25%;">Harga</th>
                                    <th style="text-align: right; padding: 2px 0; width: 25%;">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${transaction.items ? transaction.items.map(item => {
        const originalTotal = item.price * item.qty;
        const itemDiscount = (item.discount || 0) * item.qty;
        const finalItemTotal = originalTotal - itemDiscount;
        return `
                                    <tr>
                                        <td style="padding: 2px 0;">${item.name}</td>
                                        <td style="text-align: right; padding: 2px 0;">${item.qty}</td>
                                        <td style="text-align: right; padding: 2px 0;">${item.price.toLocaleString('id-ID')}</td>
                                        <td style="text-align: right; padding: 2px 0;">${finalItemTotal.toLocaleString('id-ID')}</td>
                                    </tr>
                                    ${itemDiscount > 0 ? `
                                    <tr>
                                        <td colspan="4" style="text-align: right; font-size: 0.9em; font-style: italic;">(Disc: -${itemDiscount.toLocaleString('id-ID')})</td>
                                    </tr>` : ''}
                                    `;
    }).join('') : '<tr><td colspan="4">No items</td></tr>'}
                            </tbody>
                        </table>
                    ` : `
                    ${transaction.items ? transaction.items.map(item => {
        const originalTotal = item.price * item.qty;
        const itemDiscount = (item.discount || 0) * item.qty;
        const finalItemTotal = originalTotal - itemDiscount;

        // Check if discount exists
        if (itemDiscount > 0) {
            return `
                                             <div style="margin-bottom: 4px;">
                                                <div class="item">
                                                    <span style="flex: 1;">${item.name} x${item.qty}${item.unit ? ' ' + item.unit : ''}</span>
                                                    <span style="text-decoration: line-through; color: #888;">${originalTotal.toLocaleString('id-ID')}</span>
                                                </div>
                                                <div class="item" style="color: #d11;">
                                                    <span style="flex: 1; margin-left: 10px; font-size: 0.9em;">Diskon</span>
                                                    <span style="font-size: 0.9em;">-${itemDiscount.toLocaleString('id-ID')}</span>
                                                </div>
                                                <div class="item" style="font-weight: bold;">
                                                    <span style="flex: 1;"></span>
                                                    <span>${finalItemTotal.toLocaleString('id-ID')}</span>
                                                </div>
                                             </div>
                                             `;
        } else {
            return `
                                            <div class="item">
                                                <span style="flex: 1;">${item.name} x${item.qty}${item.unit ? ' ' + item.unit : ''}</span>
                                                <span>${finalItemTotal.toLocaleString('id-ID')}</span>
                                            </div>
                                            `;
        }
    }).join('') : '<div>No items</div>'}
                    `}
                </div>
                <div style="border-top: 1px dashed #ccc; padding-top: 2px; margin-bottom: 2px; font-size: 0.9em; text-align: right;">
                    Total Qty: ${totalQty}
                </div>
                <div class="divider"></div>

                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>Rp ${subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    ${transaction.discount > 0 ? `
                    <div class="total-row" style="color: red;">
                        <span>Diskon</span>
                        <span>- Rp ${transaction.discount.toLocaleString('id-ID')}</span>
                    </div>
                    ` : ''}
                    ${tax > 0 ? `
                    <div class="total-row">
                        <span>Tax (${store?.taxRate || 0}%)</span>
                        <span>Rp ${tax.toLocaleString('id-ID')}</span>
                    </div>
                    ` : ''}
                    ${serviceCharge > 0 ? `
                    <div class="total-row">
                        <span>Service</span>
                        <span>Rp ${serviceCharge.toLocaleString('id-ID')}</span>
                    </div>
                    ` : ''}
                    <div class="total-row" style="font-weight: bold; font-size: 1.1em; margin-top: 5px; border-top: 1px solid #ddd; padding-top: 2px;">
                        <span>TOTAL</span>
                        <span>Rp ${finalTotal.toLocaleString('id-ID')}</span>
                    </div>
                    <div class="total-row" style="margin-top: 2px;">
                        <span>${(transaction.paymentMethod || 'cash').toUpperCase()}</span>
                        <span>Rp ${amountPaid.toLocaleString('id-ID')}</span>
                    </div>
                    ${change > 0 ? `
                    <div class="total-row">
                        <span>Kembalian</span>
                        <span>Rp ${change.toLocaleString('id-ID')}</span>
                    </div>
                    ` : ''}
                </div>

                ${((transaction.customerName && (transaction.pointsEarned > 0 || transaction.customerTotalPoints >= 0)) || (transaction.payment_details?.stamp_updates?.length > 0 || transaction.stampUpdates?.length > 0)) ? `
                <div class="divider"></div>
                <div style="font-size: 0.8em; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px;">
                    ${(transaction.customerName && (transaction.pointsEarned > 0 || transaction.customerTotalPoints >= 0)) ? `
                        <div style="font-weight: bold; font-size: 0.9em; letter-spacing: 1px; text-transform: uppercase;">POIN LOYALITAS</div>
                        ${transaction.pointsEarned > 0 ? `<div style="color: #16a34a;">Poin Transaksi: +${transaction.pointsEarned}</div>` : ''}
                        ${transaction.customerTotalPoints !== undefined ? `<div style="font-weight: bold; color: #2563eb; border-top: 1px solid #eee; width: 100%; padding-top: 2px; margin-top: 2px;">Sisa Poin: ${transaction.customerTotalPoints}</div>` : ''}
                    ` : ''}
                    
                    ${(transaction.payment_details?.stamp_updates?.length > 0 || transaction.stampUpdates?.length > 0) ? `
                        <div style="width: 100%; border-top: 1px solid #eee; margin-top: 4px; padding-top: 4px;">
                            <div style="font-weight: bold; font-size: 0.9em; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px;">PROGRAM STAMP</div>
                            ${(transaction.payment_details?.stamp_updates || transaction.stampUpdates).map(stamp => `
                            <div style="width: 100%; display: flex; justify-content: space-between; padding: 2px 0; font-size: 11px;">
                                <span style="text-align: left;">${stamp.rule_name}</span>
                                <span style="font-weight: bold; text-align: right; white-space: nowrap; margin-left: 8px;">${stamp.reward_reached ? '🎁 Reward (Penuh!)' : `${stamp.current_stamps}/${stamp.target_stamps}`}</span>
                            </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                ` : ''}

                <div class="footer">
                    <div class="divider"></div>
                    <div style="margin-bottom: 5px;">${store?.receiptFooter || 'Terima Kasih'}</div>
                    <div style="font-size: 0.7em; color: #aaa;">KULA Pro</div>
                </div>
                <script>
                    window.onload = function() { 
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
        </html>
    `;
};

export const printReceiptBrowser = (transaction, store) => {
    try {
        // Create a hidden iframe for printing
        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'absolute';
            iframe.style.width = '0px';
            iframe.style.height = '0px';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
        }

        const html = generateReceiptHtml(transaction, store);

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        if (!doc) throw new Error("Could not access iframe document");

        doc.open();
        doc.write(html);
        doc.close();

        // The generated HTML already has window.print() inside window.onload
        // But for iframe, it's safer to ensure it prints
        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        }, 800);

    } catch (e) {
        console.error("Error printing receipt:", e);
        alert("Gagal mencetak struk di browser: " + e.message);
    }
};

export const generateEtiketHtml = (item, transaction, store) => {
    return `
        <html>
            <head>
                <title>Etiket - ${item.name}</title>
                <style>
                    @page { size: auto; margin: 0mm; }
                    body { 
                        font-family: 'Courier New', monospace;
                        background-color: #fff;
                        width: 48mm; 
                        margin: 0 auto; 
                        padding: 5px;
                        color: #000;
                        font-size: 11px;
                        line-height: 1.2;
                    }
                    .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 5px; }
                    .store-name { font-size: 12px; font-weight: bold; text-transform: uppercase; }
                    .patient-info { margin-bottom: 5px; font-weight: bold; font-size: 12px; }
                    .medicine-name { font-size: 11px; margin-bottom: 3px; border-bottom: 1px dashed #ccc; padding-bottom: 2px; }
                    .usage { font-size: 16px; font-weight: bold; text-align: center; margin: 8px 0; border: 1px solid #000; padding: 5px; }
                    .footer { text-align: center; margin-top: 8px; font-size: 9px; font-style: italic; }
                    .date { font-size: 9px; text-align: right; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="store-name">${store?.name || 'Apotek'}</div>
                    <div style="font-size: 8px;">${store?.address || ''}</div>
                </div>

                <div class="date">${formatDate(transaction.date)}</div>
                
                <div class="patient-info">
                    Pasien: ${transaction.customerName || transaction.prescriptionData?.patientName || 'Umum'}
                </div>

                <div class="medicine-name">
                    <strong>${item.name}</strong>
                    <div style="font-size: 9px; color: #666;">Qty: ${item.qty} ${item.unit || 'Pcs'}</div>
                </div>

                <div class="usage">
                    ${item.aturanPakai || item.aturan_pakai || 'Sesuai Petunjuk Dokter'}
                </div>

                <div class="footer">
                    Semoga Cepat Sembuh
                </div>

                <script>
                    window.onload = function() { 
                        setTimeout(function() {
                            window.print();
                        }, 500);
                    }
                </script>
            </body>
        </html>
    `;
};

export const printEtiketBrowser = (items, transaction, store) => {
    try {
        let iframe = document.getElementById('print-iframe');
        if (!iframe) {
            iframe = document.createElement('iframe');
            iframe.id = 'print-iframe';
            iframe.style.position = 'absolute';
            iframe.style.width = '0px';
            iframe.style.height = '0px';
            iframe.style.border = 'none';
            document.body.appendChild(iframe);
        }

        // Print each item as a separate page if possible, or just build one long HTML
        // For thermal printers, one long HTML with page breaks is best
        const fullHtml = `
            <html>
                <body>
                    ${items.map(item => `
                        <div style="page-break-after: always; min-height: 40mm;">
                            ${generateEtiketHtml(item, transaction, store).replace('<html>', '').replace('</html>', '').replace('<body>', '').replace('</body>', '')}
                        </div>
                    `).join('')}
                    <script>
                        window.onload = function() { 
                            setTimeout(function() {
                                window.print();
                            }, 800);
                        }
                    </script>
                </body>
            </html>
        `;

        const doc = iframe.contentWindow?.document || iframe.contentDocument;
        doc.open();
        doc.write(fullHtml);
        doc.close();

        setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
        }, 1200);

    } catch (e) {
        console.error("Error printing etiket:", e);
        alert("Gagal mencetak etiket: " + e.message);
    }
};
