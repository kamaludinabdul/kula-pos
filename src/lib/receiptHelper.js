import { formatDate } from './utils';

export const generateReceiptHtml = (transaction, store) => {
    const isStandardPaper = store?.printerPaperSize === '80mm';

    // Calculate totals
    const subtotal = transaction.subtotal || transaction.total;
    const tax = transaction.tax || 0;
    const serviceCharge = transaction.serviceCharge || 0;
    const finalTotal = transaction.total;

    return `
        <html>
            <head>
                <title>Receipt #${transaction.id}</title>
                <style>
                    @page { size: auto; margin: 0mm; }
                    body { 
                        font-family: 'Courier New', monospace; 
                        background-color: #fff;
                        width: ${isStandardPaper ? '78mm' : '48mm'}; 
                        margin: 0 auto; 
                        padding: 0;
                        color: #000;
                        overflow: visible;
                        min-height: 100%;
                        height: auto;
                    }
                    .header { text-align: center; margin-bottom: 5px; }
                    .store-name { font-size: 1.2em; font-weight: bold; margin-bottom: 2px; text-transform: uppercase; }
                    .divider { border-top: 1px dashed #000; margin: 3px 0; }
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
                ${transaction.status === 'cancelled' || transaction.status === 'void' ? '<div class="watermark">VOID</div>' : ''}
                <div class="header">
                    ${store?.logo ? `<img src="${store.logo}" style="max-height: 40px; margin-bottom: 5px; filter: grayscale(100%);" />` : ''}
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
                </div>
                <div style="border-top: 1px dashed #ccc; padding-top: 2px; margin-bottom: 2px; font-size: 0.9em; text-align: right;">
                    Total Qty: ${transaction.items ? transaction.items.reduce((acc, item) => acc + Number(item.qty), 0) : 0}
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
                        <span>Rp ${transaction.amountPaid ? Number(transaction.amountPaid).toLocaleString('id-ID') : finalTotal.toLocaleString('id-ID')}</span>
                    </div>
                    ${transaction.change > 0 ? `
                    <div class="total-row">
                        <span>Kembalian</span>
                        <span>Rp ${Number(transaction.change).toLocaleString('id-ID')}</span>
                    </div>
                    ` : ''}
                </div>

                ${(transaction.pointsEarned > 0 || transaction.customerTotalPoints > 0) ? `
                <div class="divider"></div>
                <div style="font-size: 0.8em; text-align: center;">
                    <div style="font-weight: bold; margin-bottom: 2px;">POIN LOYALITAS</div>
                    ${transaction.pointsEarned > 0 ? `<div>Poin Transaksi: +${transaction.pointsEarned}</div>` : ''}
                    ${transaction.customerTotalPoints ? `<div>Total Poin: ${transaction.customerTotalPoints}</div>` : ''}
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
        const receiptWindow = window.open('', '_blank', 'width=400,height=600');

        if (!receiptWindow) {
            console.error("Popup blocked! Cannot print receipt.");
            alert("Pop-up diblokir. Izinkan pop-up untuk mencetak struk.");
            return;
        }

        const html = generateReceiptHtml(transaction, store);
        receiptWindow.document.write(html);
        receiptWindow.document.close();
    } catch (e) {
        console.error("Error printing receipt:", e);
        alert("Gagal mencetak struk di browser: " + e.message);
    }
};
