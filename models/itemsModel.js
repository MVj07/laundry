const mongoose = require('mongoose');
const itemsSchema = new mongoose.Schema({
    name: { type: String, required: true },
    createdAt: { type: Date },
    updatedAt: { type: Date }
})
module.exports = mongoose.model('items', itemsSchema)