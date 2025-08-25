const mongoose = require('mongoose');
const expenseSchema = new mongoose.Schema({
    item: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitprice: { type: Number, required: true },
    // createdAt: { type: Date },
    // updatedAt: { type: Date }
},{timestamps:true})
module.exports = mongoose.model('expense', expenseSchema)