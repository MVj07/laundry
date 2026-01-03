const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'customer', required: true },
    items: { type: Array },
    status: { type: String, default: "washing" },
    // bill: { type: Number, required: true },
    billAmount: { type: Number, required: true },   // 💰 actual bill
    bill: { type: String, unique: true },
    date: {type: Date}
    // createdAt: { type: Date },
    // updatedAt: { type: Date }
},{timestamps:true})
module.exports = mongoose.model('orders', orderSchema)