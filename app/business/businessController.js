// import Business from "../models/Business.js";
// import User from "../models/User.js";
const Business = require('../../models/businessModel')
const User = require('../../models/usersModel')
const { encryptSecret } = require('../user/userController')

const saveBusiness = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log(req.user);

    let logoUrl = "";
    if (req.file) {
      logoUrl = `/uploads/${req.file.filename}`;
    }

    const existingBusiness = await Business.findOne({ user_id: userId });
    const businessPayload = {
      user_id: userId,
      business_name: req.body.business_name,
      owner_name: req.body.owner_name,
      mobile: req.body.mobile,
      city: req.body.city,
      address: req.body.address,
      gst_no: req.body.gst_no,
    };
    if (logoUrl) businessPayload.logo_url = logoUrl;
    if (req.body.razorpay_key_id !== undefined) businessPayload.razorpay_key_id = req.body.razorpay_key_id;
    if (req.body.razorpay_key_secret !== undefined && req.body.razorpay_key_secret !== '********') {
      businessPayload.razorpay_key_secret = encryptSecret(req.body.razorpay_key_secret);
    }

    let business;
    if (existingBusiness) {
      business = await Business.findOneAndUpdate({ user_id: userId }, { $set: businessPayload }, { new: true });
    } else {
      business = await Business.create(businessPayload);
    }

    const userUpdatePayload = {
      business_id: business._id,
      is_profile_completed: true,
    };
    if (req.body.razorpay_key_id !== undefined) userUpdatePayload.razorpay_key_id = req.body.razorpay_key_id;
    if (req.body.razorpay_key_secret !== undefined && req.body.razorpay_key_secret !== '********') {
      userUpdatePayload.razorpay_key_secret = encryptSecret(req.body.razorpay_key_secret);
    }

    await User.findByIdAndUpdate(userId, { $set: userUpdatePayload });

    console.log(await User.findById(userId));
    res.status(200).json({
      success: true,
      message: "Business details saved successfully",
      data: business
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
    const user = await User.findById(userId);
    const business = await Business.findOne({ user_id: userId });
    if (!business) return res.status(404).json({ message: "Business not found" });
    
    const businessData = business.toObject();
    if (!businessData.razorpay_key_id && user?.razorpay_key_id) businessData.razorpay_key_id = user.razorpay_key_id;
    const rawSecret = businessData.razorpay_key_secret || user?.razorpay_key_secret;
    businessData.isKeySet = Boolean(businessData.razorpay_key_id || rawSecret);
    if (rawSecret) {
      businessData.razorpay_key_secret = '********';
    } else {
      businessData.razorpay_key_secret = '';
    }

    return res.json({message: 'success', data: businessData})
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

const saveRazorpayKeys = async (req, res) => {
  try {
    const userId = req.user.id;
    const { razorpay_key_id, razorpay_key_secret, otp } = req.body;

    const user = await User.findById(userId);
    const business = await Business.findOne({ user_id: userId });

    const existingKeyId = business?.razorpay_key_id || user?.razorpay_key_id;
    const existingSecret = business?.razorpay_key_secret || user?.razorpay_key_secret;

    // If existing keys are set and user wants to modify them, verify OTP
    if ((existingKeyId || existingSecret) && (razorpay_key_id !== existingKeyId || razorpay_key_secret !== '********')) {
      if (!otp) {
        return res.json({
          status: false,
          requiresOtp: true,
          message: 'Existing Razorpay credentials found. Please request and enter the email verification code to authorize updating them.'
        });
      }

      if (otp !== user.razorpayUpdateOtp || !user.razorpayUpdateOtpExpiry || new Date() > new Date(user.razorpayUpdateOtpExpiry)) {
        return res.status(400).json({
          status: false,
          message: 'Invalid or expired verification code. Please request a new code.'
        });
      }

      user.razorpayUpdateOtp = null;
      user.razorpayUpdateOtpExpiry = null;
    }

    const finalSecret = (razorpay_key_secret === '********' && existingSecret) ? existingSecret : encryptSecret(razorpay_key_secret);

    await User.findByIdAndUpdate(userId, { $set: { razorpay_key_id, razorpay_key_secret: finalSecret, razorpayUpdateOtp: null, razorpayUpdateOtpExpiry: null } });
    const updatedBusiness = await Business.findOneAndUpdate(
      { user_id: userId },
      { $set: { razorpay_key_id, razorpay_key_secret: finalSecret } },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      status: true,
      message: "Razorpay keys saved successfully for laundry owner",
      data: updatedBusiness
    });
  } catch (err) {
    return res.status(500).json({ success: false, status: false, message: err.message });
  }
};

module.exports = { saveBusiness, createWorkflow, view, saveRazorpayKeys }
