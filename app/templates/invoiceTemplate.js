function invoiceHTML(order, customer, business) {
    const itemsHTML = order.items.map((i, idx) => `
        <tr>
            <td>${idx + 1}</td>
            <td>${i.name}</td>
            <td>${i.qty}</td>
            <td>₹${i.amount}</td>
            <td>₹${i.qty * i.amount}</td>
        </tr>
    `).join("");

    const total = order.items.reduce((a, b) => a + (b.qty * b.amount), 0);

    return `
    <html>
    <head>
        <style>
            body { font-family: 'Poppins', Arial, sans-serif; padding: 25px; }
            .header { display: flex; justify-content: space-between; align-items: center; }
            .logo { max-height: 80px; }
            .business-info { margin-top: 10px; }
            .section-title { margin-top: 30px; font-size: 18px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #ccc; padding: 8px; }
            th { background: #f0f0f0; }
            .footer { margin-top: 20px; font-size: 14px; text-align: center; color: #555; }
            .text-center {text-align: center}
        </style>
    </head>

    <body>
        <!-- Business Header -->
        <div class="header">
            <div>
                <h2>${business.business_name}</h2>
                <div class="business-info">
                    <p><b>Owner:</b> ${business.owner_name}</p>
                    <p><b>Mobile:</b> ${business.mobile}</p>
                    <p><b>Address:</b> ${business.address}, ${business.city}</p>
                    ${business.gst_no ? `<p><b>GST No:</b> ${business.gst_no}</p>` : ""}
                </div>
            </div>
            
            ${
                business.logo_url
                    ? `<img class="logo" src="${business.logo_url}" />`
                    : ""
            }
        </div>

        <hr />

        <!-- Invoice Info -->
        <h3 class='text-center'>Invoice</h3>
        <p><b>Bill No:</b> ${order.bill}</p>
        <p><b>Date:</b> ${new Date(order.date).toLocaleString()}</p>

        <!-- Customer Details -->
        <div class="section-title">Customer Details</div>
        <p><b>Name:</b> ${customer.name}</p>
        <p><b>Mobile:</b> ${customer.mobile}</p>
        <p><b>Address:</b> ${customer.address}</p>

        <!-- Items -->
        <div class="section-title">Order Summary</div>

        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>${itemsHTML}</tbody>
        </table>

        <h2 style="text-align: right; margin-top: 20px;">
            Grand Total: ₹${total}
        </h2>

        <div class="footer">
            Thank you for your business!
        </div>
    </body>
    </html>
    `;
}

module.exports = { invoiceHTML };
