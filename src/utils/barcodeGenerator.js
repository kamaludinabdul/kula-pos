import JsBarcode from 'jsbarcode';

/**
 * Generate barcode as SVG string
 * @param {string} value - The barcode value (product code)
 * @param {object} options - Barcode options
 * @returns {string} - SVG string
 */
export const generateBarcodeSVG = (value, options = {}) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

    const defaultOptions = {
        format: 'CODE128',
        width: 2,
        height: 40,
        displayValue: true,
        fontSize: 12,
        margin: 5,
        textAlign: 'center',
        ...options
    };

    try {
        JsBarcode(svg, String(value), defaultOptions);
        return svg.outerHTML;
    } catch (error) {
        console.error('Error generating barcode:', error);
        return null;
    }
};

/**
 * Generate barcode as Data URL (for img src)
 * @param {string} value - The barcode value
 * @param {object} options - Barcode options
 * @returns {Promise<string>} - Data URL
 */
export const generateBarcodeDataURL = async (value, options = {}) => {
    const canvas = document.createElement('canvas');

    const defaultOptions = {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: true,
        fontSize: 14,
        margin: 10,
        ...options
    };

    try {
        JsBarcode(canvas, String(value), defaultOptions);
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error('Error generating barcode:', error);
        return null;
    }
};

/**
 * Label sizes configuration
 */
export const LABEL_SIZES = {
    thermal58: {
        name: 'Thermal 58mm',
        width: 48, // printable area of 58mm printer
        height: 30,
        barcodeHeight: 30,
        fontSize: 9,
        priceSize: 11,
        nameMaxLength: 18
    },
    thermal80: {
        name: 'Thermal 80mm',
        width: 72, // printable area of 80mm printer
        height: 40,
        barcodeHeight: 40,
        fontSize: 11,
        priceSize: 13,
        nameMaxLength: 30
    },
    small: {
        name: 'Kecil (40x20mm)',
        width: 40, // mm
        height: 20, // mm
        barcodeHeight: 25,
        fontSize: 8,
        priceSize: 10,
        nameMaxLength: 15
    },
    medium: {
        name: 'Sedang (60x30mm)',
        width: 60,
        height: 30,
        barcodeHeight: 35,
        fontSize: 10,
        priceSize: 12,
        nameMaxLength: 25
    },
    large: {
        name: 'Besar (80x40mm)',
        width: 80,
        height: 40,
        barcodeHeight: 45,
        fontSize: 12,
        priceSize: 14,
        nameMaxLength: 35
    }
};

/**
 * Print labels using browser print
 * @param {Array} labels - Array of label objects { product, quantity }
 * @param {string} size - Label size key
 * @param {boolean} showPrice - Whether to show price
 */
export const printLabels = async (labels, size = 'medium', showPrice = true) => {
    const sizeConfig = LABEL_SIZES[size];

    // Create print content
    let printContent = `
        <html>
        <head>
            <title>Print Barcode Labels</title>
            <style>
                @page {
                    size: auto;
                    margin: 5mm;
                }
                body {
                    margin: 0;
                    padding: 0;
                    font-family: Arial, sans-serif;
                }
                .label-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 2mm;
                    justify-content: flex-start;
                }
                .label {
                    width: ${sizeConfig.width}mm;
                    height: ${sizeConfig.height}mm;
                    border: 1px dashed #ccc;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 1mm;
                    box-sizing: border-box;
                    page-break-inside: avoid;
                }
                .label-name {
                    font-size: ${sizeConfig.fontSize}pt;
                    font-weight: bold;
                    text-align: center;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    width: 100%;
                    margin-bottom: 1mm;
                }
                .label-barcode {
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .label-barcode svg {
                    max-width: 100%;
                    max-height: ${sizeConfig.barcodeHeight}px;
                }
                .label-price {
                    font-size: ${sizeConfig.priceSize}pt;
                    font-weight: bold;
                    margin-top: 1mm;
                }
                @media print {
                    .label {
                        border: none;
                    }
                }
            </style>
        </head>
        <body>
            <div class="label-container">
    `;

    // Generate labels
    for (const labelItem of labels) {
        const { product, quantity } = labelItem;
        const code = product.code || product.barcode || product.id;
        const name = product.name.length > sizeConfig.nameMaxLength
            ? product.name.substring(0, sizeConfig.nameMaxLength) + '...'
            : product.name;

        const barcodeSVG = generateBarcodeSVG(code, {
            height: sizeConfig.barcodeHeight,
            fontSize: sizeConfig.fontSize,
            displayValue: true
        });

        // Repeat for quantity
        for (let i = 0; i < quantity; i++) {
            printContent += `
                <div class="label">
                    <div class="label-name">${name}</div>
                    <div class="label-barcode">${barcodeSVG || 'No Code'}</div>
                    ${showPrice ? `<div class="label-price">Rp ${product.price?.toLocaleString() || 0}</div>` : ''}
                </div>
            `;
        }
    }

    printContent += `
            </div>
        </body>
        </html>
    `;

    // Open print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    // Wait for content to load then print
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};
