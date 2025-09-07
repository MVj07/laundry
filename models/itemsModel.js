const mongoose = require('mongoose');
const itemsSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: {type: Number},
    createdAt: { type: Date },
    updatedAt: { type: Date }
})
module.exports = mongoose.model('items', itemsSchema)