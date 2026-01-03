const mongoose = require('mongoose');
const customerSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    address: { type: String },
    mobile: { type: String, required: true, unique: true },
    // kuri: { type: Number, required: true },
    // createdAt: { type: Date },
    // updatedAt: { type: Date }
},{timestamps:true})
module.exports = mongoose.model('customer', customerSchema)