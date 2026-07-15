// Pure JS Code128 Barcode Generator for SVG output
function getCode128Svg(text, height = 35) {
    if (!text) return '';
    const code128CharData = [
        "11011001100", "11001101100", "11001100110", "10010011000", "10010001100", "10001001100", "10011001000",
        "10011000100", "10001100100", "11001001000", "11001000100", "11000100100", "10110011100", "10011011100",
        "10011001110", "10111001100", "10011101100", "10011100110", "11001110010", "11001011100", "11001001110",
        "11011100100", "11001110100", "11101101110", "11101001100", "11100101100", "11100100110", "11101100100",
        "11100110100", "11100110010", "11011011000", "11011000110", "11000110110", "10100011000", "10001011000",
        "10001000110", "10110001000", "10001101000", "10001100010", "11010001000", "11000101000", "11000100010",
        "10110111000", "10110001110", "10001101110", "10111011000", "10111000110", "10001110110", "11101110110",
        "11010001110", "11000101110", "11011101000", "11011100010", "11011101110", "11101011000", "11101000110",
        "11100010110", "11101101000", "11101100010", "11100011010", "11101111010", "11001000010", "11110001010",
        "10100110000", "10100001100", "10010110000", "10010000110", "10000101100", "10000100110", "10110010000",
        "10110000100", "10011010000", "10011000010", "10000110100", "10000110010", "11000010010", "11001010000",
        "11110111010", "11000010100", "10001111010", "10100111100", "10010111100", "10010011110", "10111100100",
        "10011110100", "10011110010", "11110100100", "11110010100", "11110010010", "11011011110", "11011110110",
        "11110110110", "10101111000", "10100011110", "10001011110", "10111101000", "10111100010", "11110101000",
        "11110100010", "10111011110", "10111101110", "11101011110", "11110101110", "11010000100", "11010010000",
        "11010011100", "1100011101011"
    ];

    let pattern = "11010010000"; // Start B
    let checkSum = 104;

    for (let i = 0; i < text.length; i++) {
        let code = text.charCodeAt(i) - 32;
        if (code < 0 || code > 95) code = 0;
        pattern += code128CharData[code];
        checkSum += code * (i + 1);
    }

    const checkDigit = checkSum % 103;
    pattern += code128CharData[checkDigit];
    pattern += code128CharData[106]; // Stop

    let svgBars = "";
    let x = 0;
    for (let i = 0; i < pattern.length; i++) {
        if (pattern[i] === "1") {
            let width = 1;
            while (i + 1 < pattern.length && pattern[i + 1] === "1") {
                width++;
                i++;
            }
            svgBars += `<rect x="${x}" y="0" width="${width}" height="${height}" fill="#000" />`;
            x += width;
        } else {
            x++;
        }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${x} ${height}" preserveAspectRatio="none" style="width: 100%; height: ${height}px; display: block;">${svgBars}</svg>`;
}

function tagHTML(order, customer, business, options = {}) {
    const paperSize = options.paperSize || '58mm'; // '58mm', '80mm', '50x30mm'
    const showBarcode = options.showBarcode !== false;
    const showShopName = options.showShopName !== false;
    const showKuri = options.showKuri !== false;
    const showMobile = options.showMobile !== false;
    const showDueDate = options.showDueDate !== false;

    // Expand items into pieces
    const pieces = [];
    if (order.items && order.items.length > 0) {
        order.items.forEach(item => {
            const qty = parseInt(item.qty) || 1;
            for (let q = 1; q <= qty; q++) {
                pieces.push({
                    name: item.name,
                    indexInItem: q,
                    itemTotalQty: qty
                });
            }
        });
    } else {
        pieces.push({ name: order.type === 'kg' ? 'Clothes (Kg)' : 'Garments', indexInItem: 1, itemTotalQty: 1 });
    }

    const totalPieces = pieces.length;
    const kuriNo = customer?.kuri || order?.kuri || order?.customerId?.kuri || 'N/A';
    const customerName = customer?.name || order?.customerName || order?.customerId?.name || 'Customer';
    const customerMobile = customer?.mobile || order?.phoneNumber || order?.customerId?.mobile || '';
    const dueDateStr = order.dueDate ? new Date(order.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
    const shopName = business?.business_name || 'LAUNDRY SERVICE';

    let widthCss = '58mm';
    let paddingCss = '8px';
    let fontSizeCss = '12px';

    if (paperSize === '80mm') {
        widthCss = '80mm';
        paddingCss = '12px';
        fontSizeCss = '14px';
    } else if (paperSize === '50x30mm') {
        widthCss = '50mm';
        paddingCss = '4px';
        fontSizeCss = '10px';
    }

    const tagsHtml = pieces.map((piece, idx) => {
        const pieceNum = idx + 1;
        const barcodeSvg = showBarcode ? getCode128Svg(order.bill || 'LDY-00000', paperSize === '50x30mm' ? 22 : 32) : '';

        return `
        <div class="tag-card">
            ${showShopName ? `<div class="tag-shop">${shopName}</div>` : ''}
            
            <div class="tag-header">
                ${showKuri ? `<div class="kuri-box">KURI #${kuriNo}</div>` : ''}
                <div class="piece-box">[ ${pieceNum} / ${totalPieces} ]</div>
            </div>

            <div class="item-name">${piece.name}</div>

            <div class="customer-info">
                <span class="cust-name">${customerName}</span>
                ${showMobile && customerMobile ? `<span class="cust-mobile">(${customerMobile})</span>` : ''}
            </div>

            <div class="meta-row">
                <span><b>Bill:</b> ${order.bill || 'N/A'}</span>
                ${showDueDate ? `<span><b>Due:</b> ${dueDateStr}</span>` : ''}
            </div>

            ${showBarcode ? `
                <div class="barcode-wrap">
                    ${barcodeSvg}
                    <div class="barcode-text">${order.bill || ''}</div>
                </div>
            ` : ''}
        </div>
        `;
    }).join('');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
            
            @page {
                size: ${widthCss} auto;
                margin: 0;
            }
            
            * {
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Inter', sans-serif;
                margin: 0;
                padding: 0;
                color: #000;
                background: #fff;
                font-size: ${fontSizeCss};
                -webkit-print-color-adjust: exact;
            }
            
            .tag-card {
                width: ${widthCss};
                padding: ${paddingCss};
                border-bottom: 2px dashed #000;
                page-break-after: always;
                break-after: page;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            
            .tag-shop {
                font-size: 11px;
                font-weight: 800;
                text-align: center;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                border-bottom: 1px solid #000;
                padding-bottom: 3px;
                margin-bottom: 2px;
            }
            
            .tag-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 4px;
            }
            
            .kuri-box {
                font-size: 16px;
                font-weight: 800;
                background: #000;
                color: #fff;
                padding: 2px 6px;
                border-radius: 4px;
                line-height: 1.1;
            }
            
            .piece-box {
                font-size: 14px;
                font-weight: 800;
                font-family: monospace;
            }
            
            .item-name {
                font-size: 15px;
                font-weight: 800;
                text-transform: uppercase;
                margin: 2px 0;
                line-height: 1.2;
            }
            
            .customer-info {
                font-size: 12px;
                font-weight: 600;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .cust-name {
                font-weight: 800;
            }
            
            .meta-row {
                display: flex;
                justify-content: space-between;
                font-size: 11px;
                border-top: 1px dotted #666;
                padding-top: 3px;
                margin-top: 2px;
            }
            
            .barcode-wrap {
                margin-top: 4px;
                text-align: center;
            }
            
            .barcode-text {
                font-size: 10px;
                font-weight: 700;
                font-family: monospace;
                letter-spacing: 1px;
                margin-top: 1px;
            }
        </style>
    </head>
    <body>
        ${tagsHtml}
    </body>
    </html>
    `;
}

module.exports = { tagHTML, getCode128Svg };
