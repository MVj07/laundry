const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'customer', required: true },
    items: { type: Array },
    type: { type: String, enum: ['item', 'kg'], default: 'item' },
    status: { type: String, default: "washing" },
    billAmount: { type: Number, required: true },   // 💰 actual bill
    bill: { type: String, unique: true },
    date: { type: Date },
    dueDate: { type: Date },
    specialInstructions: { type: String },
    // 💳 Payment fields
    paymentStatus: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'cheque', 'payment_link', 'razorpay_link'], default: null },
    paidAmount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    razorpayPaymentLinkId: { type: String, default: null },
    razorpayPaymentLinkUrl: { type: String, default: null },
    razorpayPaymentLinkStatus: { type: String, default: null },
    // 🧺 Services tracking fields
    services: [
        {
            serviceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Service' },
            name: { type: String },
            status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
            completedAt: { type: Date }
        }
    ],
    processingStartTime: { type: Date },
    orderTakenAt: { type: Date },
    deliveredAt: { type: Date },
    deliverytype: { type: String, enum: ['CP', 'DD'], default: 'CP' },
    deliveryCharge: { type: Number, default: 0 }
}, { timestamps: true })
module.exports = mongoose.model('orders', orderSchema)
