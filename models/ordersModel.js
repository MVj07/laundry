const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'customer', required: true },
    items: { type: Array },
    status: { type: String, default: "washing" },
    kuri: { type: Number, required: true },
    date: {type: Date}
    // createdAt: { type: Date },
    // updatedAt: { type: Date }
},{timestamps:true})
module.exports = mongoose.model('orders', orderSchema)