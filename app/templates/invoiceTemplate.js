function invoiceHTML(order, customer, business) {
    const itemsHTML = order.items.map((i, idx) => `
        <tr>
            <td class="text-center" style="width: 40px; color: #94a3b8;">${idx + 1}</td>
            <td style="font-weight: 500; color: #1e293b;">${i.name}</td>
            <td class="text-center" style="width: 80px; color: #475569;">${i.qty}</td>
            <td class="text-right" style="width: 100px; color: #475569;">₹${Number(i.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
            <td class="text-right" style="width: 120px; font-weight: 600; color: #0f172a;">₹${Number(i.qty * i.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
        </tr>
    `).join("");

    const itemsTotal = order.items.reduce((a, b) => a + ((Number(b.qty) || 0) * (Number(b.amount) || 0)), 0);
    const deliveryCharge = Number(order.deliveryCharge || 0);
    const total = itemsTotal + deliveryCharge;
    const formattedDate = new Date(order.date).toLocaleDateString('en-IN', { 
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
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
            
            body { 
                font-family: 'Inter', sans-serif; 
                color: #1e293b; 
                margin: 0;
                padding: 40px; 
                background: #ffffff;
                -webkit-print-color-adjust: exact;
            }
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
            }
            .top-accent {
                height: 6px;
                background: linear-gradient(90deg, #4f46e5 0%, #06b6d4 100%);
                margin-bottom: 35px;
                border-radius: 3px;
            }
            .header-section { 
                display: flex; 
                justify-content: space-between; 
                align-items: flex-start;
                margin-bottom: 40px;
            }
            .business-details h1 {
                font-size: 24px;
                font-weight: 800;
                color: #0f172a;
                margin: 0 0 6px 0;
                letter-spacing: -0.5px;
            }
            .business-info p {
                font-size: 13px;
                color: #64748b;
                margin: 3px 0;
                line-height: 1.4;
            }
            .logo-container img { 
                max-height: 65px; 
                object-fit: contain;
            }
            .invoice-meta {
                text-align: right;
            }
            .invoice-meta h2 {
                font-size: 26px;
                font-weight: 800;
                color: #4f46e5;
                margin: 0 0 12px 0;
                letter-spacing: -0.5px;
                text-transform: uppercase;
            }
            .meta-grid {
                display: grid;
                grid-template-columns: auto auto;
                gap: 6px 16px;
                font-size: 13px;
                text-align: left;
            }
            .meta-label {
                font-weight: 500;
                color: #64748b;
            }
            .meta-value {
                font-weight: 600;
                color: #1e293b;
                text-align: right;
            }
            .billing-section {
                display: flex;
                gap: 24px;
                margin-bottom: 35px;
            }
            .billing-card {
                flex: 1;
                background: #f8fafc;
                border: 1px solid #f1f5f9;
                border-radius: 10px;
                padding: 18px 20px;
            }
            .card-title {
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.75px;
                color: #64748b;
                margin-bottom: 10px;
            }
            .billing-card h3 {
                font-size: 15px;
                font-weight: 600;
                color: #0f172a;
                margin: 0 0 6px 0;
            }
            .billing-card p {
                font-size: 13px;
                color: #475569;
                margin: 3px 0;
                line-height: 1.4;
            }
            .billing-card p b {
                color: #334155;
            }
            .section-title { 
                font-size: 14px; 
                font-weight: 700; 
                text-transform: uppercase; 
                letter-spacing: 0.5px; 
                color: #475569;
                margin-top: 30px;
                border-bottom: 2px solid #f1f5f9;
                padding-bottom: 6px;
            }
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin-top: 15px; 
                font-size: 13px;
            }
            th { 
                background: #f8fafc; 
                border-bottom: 2px solid #e2e8f0; 
                color: #475569; 
                font-weight: 600;
                text-transform: uppercase;
                font-size: 11px;
                letter-spacing: 0.5px;
                padding: 12px 16px;
                text-align: left;
            }
            td { 
                padding: 14px 16px; 
                border-bottom: 1px solid #f1f5f9; 
                color: #334155;
            }
            tr:last-child td {
                border-bottom: 2px solid #e2e8f0;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            
            .summary-container {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-top: 35px;
                gap: 20px;
            }
            .instructions-section {
                flex: 1;
                max-width: 55%;
                font-size: 13px;
            }
            .instructions-card {
                background: #f8fafc;
                border: 1px dashed #cbd5e1;
                border-radius: 8px;
                padding: 14px 16px;
            }
            .instructions-card p {
                margin: 4px 0;
                color: #475569;
                line-height: 1.45;
            }
            .total-card {
                min-width: 280px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 18px;
            }
            .total-row {
                display: flex;
                justify-content: space-between;
                margin-bottom: 8px;
                font-size: 13px;
            }
            .total-row.grand-total {
                border-top: 1px dashed #cbd5e1;
                margin-top: 12px;
                padding-top: 12px;
                font-size: 18px;
                font-weight: 700;
                color: #4f46e5;
            }
            .footer { 
                margin-top: 60px; 
                font-size: 12px; 
                text-align: center; 
                color: #94a3b8; 
                border-top: 1px solid #e2e8f0;
                padding-top: 20px;
            }
            .status-badge {
                display: inline-block;
                padding: 4px 8px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                border-radius: 12px;
                margin-top: 6px;
            }
            .status-badge.washing { background: #fef3c7; color: #d97706; }
            .status-badge.ironing { background: #e0f2fe; color: #0284c7; }
            .status-badge.packing { background: #f3e8ff; color: #7c3aed; }
            .status-badge.deliver { background: #dcfce7; color: #16a34a; }
            .status-badge.confirm { background: #e0f2fe; color: #0369a1; }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="top-accent"></div>
            
            <!-- Header Section -->
            <div class="header-section">
                <div class="business-details">
                    <h1>${business.business_name}</h1>
                    <div class="business-info">
                        <p><b>Owner:</b> ${business.owner_name}</p>
                        <p><b>Mobile:</b> ${business.mobile}</p>
                        <p><b>Address:</b> ${business.address}, ${business.city}</p>
                        ${business.gst_no ? `<p><b>GST No:</b> ${business.gst_no}</p>` : ""}
                    </div>
                </div>
                <div class="invoice-meta">
                    <h2>Invoice</h2>
                    <div class="meta-grid">
                        <div class="meta-label">Bill No</div>
                        <div class="meta-value">${order.bill}</div>
                        <div class="meta-label">Date</div>
                        <div class="meta-value">${formattedDate}</div>
                        <div class="meta-label">Due Date</div>
                        <div class="meta-value">${formattedDueDate}</div>
                    </div>
                    <span class="status-badge ${order.status}">${order.status}</span>
                </div>
            </div>

            <!-- Billing Section -->
            <div class="billing-section">
                <div class="billing-card">
                    <div class="card-title">Bill To</div>
                    <h3>${customer.name}</h3>
                    <p><b>Mobile:</b> ${customer.mobile}</p>
                    <p><b>Address:</b> ${customer.address}</p>
                </div>
            </div>

            <!-- Order Summary Table -->
            <div class="section-title">Order Details</div>
            <table>
                <thead>
                    <tr>
                        <th class="text-center">#</th>
                        <th>Item Description</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Rate</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <!-- Summary & Footnotes -->
            <div class="summary-container">
                <div class="instructions-section">
                    ${order.specialInstructions ? `
                        <div class="card-title">Special Instructions</div>
                        <div class="instructions-card">
                            <p>${order.specialInstructions}</p>
                        </div>
                    ` : ""}
                </div>
                
                <div class="total-card">
                    <div class="total-row">
                        <span style="color: #64748b;">Subtotal (Items)</span>
                        <span style="font-weight: 600; color: #334155;">₹${Number(itemsTotal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ${deliveryCharge > 0 || order.deliverytype === 'DD' ? `
                    <div class="total-row" style="color: #0284c7;">
                        <span style="font-weight: 500;">Delivery Charge</span>
                        <span style="font-weight: 600;">+₹${Number(deliveryCharge).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    ` : ""}
                    <div class="total-row grand-total">
                        <span>Grand Total</span>
                        <span>₹${Number(total).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>Thank you for choosing ${business.business_name}!</p>
                <p>If you have any questions about this invoice, please contact us at ${business.mobile}.</p>
            </div>
        </div>
    </body>
    </html>
    `;
}

module.exports = { invoiceHTML };
