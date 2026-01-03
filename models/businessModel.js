const mongoose = require('mongoose');

const businessSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

  business_name: String,
  owner_name: String,
  mobile: String,
  city: String,
  address: String,
  gst_no: String,
  logo_url: String,
  workflowEnabled: { type: Boolean, default: false },
  workflows: []
  
//   created_at: { type: Date, default: Date.now },
}, {timestamps: true});

module.exports=mongoose.model("Business", businessSchema);
