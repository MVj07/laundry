const mongoose = require('mongoose');
const itemsSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    price: {type: Number},
    createdAt: { type: Date },
    updatedAt: { type: Date }
})
module.exports = mongoose.model('items', itemsSchema)