// import Business from "../models/Business.js";
// import User from "../models/User.js";
const Business = require('../../models/businessModel')
const User = require('../../models/usersModel')

const saveBusiness = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(req.user)

    let logoUrl = "";
    if (req.file) {
      logoUrl = `/uploads/${req.file.filename}`;
    }

    const business = await Business.create({
      user_id: userId,
      business_name: req.body.business_name,
      owner_name: req.body.owner_name,
      mobile: req.body.mobile,
      city: req.body.city,
      address: req.body.address,
      gst_no: req.body.gst_no,
      logo_url: logoUrl,
    });

    await User.findByIdAndUpdate(userId, {
      business_id: business._id,
      is_profile_completed: true,
    });

    console.log(await User.findById(userId))
    res.status(200).json({
      success: true,
      message: "Business details saved successfully",
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// POST /api/workflow
const createWorkflow = async (req, res) => {
  try {
    const { workflows } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(workflows) || workflows.length === 0) {
      return res.status(400).json({ message: "Workflow required" });
    }

    const business = await Business.findOne({ user_id: userId });
    if (!business) return res.status(404).json({ message: "Business not found" });

    business.workflows = workflows.map((w, i) => ({
      name: w,
      indentifier: w.trim().toLowerCase(),
      order: i
    }));
    business.workflowEnabled = true;

    await business.save();

    res.json({ message: "Workflow created successfully", data: business.workflows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const view = async(req, res)=>{
  try{
    const userId = req.user.id
    const business = await Business.findOne({ user_id: userId });
    if (!business) return res.status(404).json({ message: "Business not found" });
    return res.json({message: 'success', data: business})
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}


module.exports = { saveBusiness, createWorkflow, view }
