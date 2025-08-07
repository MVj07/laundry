const mongoose = require('mongoose');
const customerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String },
    mobile: { type: Number, required: true },
    // kuri: { type: Number, required: true },
    // createdAt: { type: Date },
    // updatedAt: { type: Date }
},{timestamps:true})
module.exports = mongoose.model('customer', customerSchema)