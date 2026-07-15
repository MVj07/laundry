function thermalInvoiceHTML(order, customer, business, options = {}) {
    const paperSize = options.paperSize || '58mm';
    let widthCss = '58mm';
    let paddingCss = '10px';
    let fontSizeCss = '11px';

    if (paperSize === '80mm') {
        widthCss = '80mm';
        paddingCss = '14px';
        fontSizeCss = '13px';
    }

    const itemsHTML = (order.items || []).map((i, idx) => `
        <tr>
            <td style="padding: 3px 0; text-align: left;">${i.name}</td>
            <td style="padding: 3px 0; text-align: center;">${i.qty}</td>
            <td style="padding: 3px 0; text-align: right;">₹${Number(i.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td style="padding: 3px 0; text-align: right; font-weight: bold;">₹${Number(i.qty * i.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
    `).join("");

    const itemsTotal = (order.items || []).reduce((a, b) => a + ((Number(b.qty) || 0) * (Number(b.amount) || 0)), 0);
    const deliveryCharge = Number(order.deliveryCharge || 0);
    const discount = Number(order.discount || 0);
    const total = itemsTotal + deliveryCharge - discount;
    const formattedDate = new Date(order.date || order.createdAt || new Date()).toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    const formattedDueDate = order.dueDate ? new Date(order.dueDate).toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
    }) : 'N/A';

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
            @page {
                size: ${widthCss} auto;
                margin: 0;
            }
            * { box-sizing: border-box; }
            body { 
                font-family: 'Inter', sans-serif; 
                color: #000; 
                margin: 0;
                padding: ${paddingCss}; 
                background: #fff;
                font-size: ${fontSizeCss};
                width: ${widthCss};
                -webkit-print-color-adjust: exact;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .shop-title {
                font-size: 16px;
                font-weight: 800;
                text-align: center;
                text-transform: uppercase;
                margin-bottom: 2px;
            }
            .shop-sub {
                font-size: 10px;
                text-align: center;
                color: #333;
                margin-bottom: 6px;
            }
            .divider {
                border-top: 1px dashed #000;
                margin: 6px 0;
            }
            .meta-table {
                width: 100%;
                font-size: 11px;
            }
            .meta-table td {
                padding: 1px 0;
            }
            .items-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
                margin-top: 4px;
            }
            .items-table th {
                border-bottom: 1px solid #000;
                padding-bottom: 3px;
                text-align: left;
                font-weight: 700;
            }
            .total-table {
                width: 100%;
                font-size: 11px;
                margin-top: 4px;
            }
            .total-table td {
                padding: 2px 0;
            }
            .grand-total {
                font-size: 14px;
                font-weight: 800;
                border-top: 1px solid #000;
                border-bottom: 1px double #000;
                padding: 4px 0 !important;
            }
            .footer-msg {
                text-align: center;
                font-size: 10px;
                margin-top: 10px;
                color: #444;
            }
        </style>
    </head>
    <body>
        <div class="shop-title">${business?.business_name || 'LAUNDRY SERVICE'}</div>
        <div class="shop-sub">
            ${business?.address ? `${business.address}<br>` : ''}
            ${business?.mobile ? `Ph: ${business.mobile}` : ''}
        </div>
        
        <div class="divider"></div>
        
        <table class="meta-table">
            <tr>
                <td><b>Bill No:</b> ${order.bill || 'N/A'}</td>
                <td class="text-right"><b>Date:</b> ${formattedDate.split(',')[0]}</td>
            </tr>
            <tr>
                <td><b>Customer:</b> ${customer?.name || order.customerName || 'N/A'}</td>
                <td class="text-right"><b>Kuri: #${customer?.kuri || order?.kuri || 'N/A'}</b></td>
            </tr>
            ${customer?.mobile ? `<tr><td colspan="2"><b>Mobile:</b> ${customer.mobile}</td></tr>` : ''}
            <tr>
                <td colspan="2"><b>Due Date:</b> ${formattedDueDate}</td>
            </tr>
        </table>
        
        <div class="divider"></div>
        
        <table class="items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th class="text-center">Qty</th>
                    <th class="text-right">Rate</th>
                    <th class="text-right">Amount</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHTML}
            </tbody>
        </table>
        
        <div class="divider"></div>
        
        <table class="total-table">
            <tr>
                <td>Subtotal</td>
                <td class="text-right">₹${Number(itemsTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            ${deliveryCharge > 0 ? `
            <tr>
                <td>Delivery Charge</td>
                <td class="text-right">+₹${Number(deliveryCharge).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            ` : ''}
            ${discount > 0 ? `
            <tr>
                <td>Discount</td>
                <td class="text-right">-₹${Number(discount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
            ` : ''}
            <tr class="grand-total">
                <td>GRAND TOTAL</td>
                <td class="text-right">₹${Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            </tr>
        </table>
        
        <div class="footer-msg">
            Thank you for your visit!<br>
            Please bring this bill or kuri number at delivery.
        </div>
    </body>
    </html>
    `;
}

module.exports = { thermalInvoiceHTML };
