const users = require('../../models/usersModel')
const { jwtSecret } = require('../../services/config')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const crypto = require('crypto')
const nodemailer = require('nodemailer')

const ENCRYPTION_KEY = crypto.scryptSync(process.env.JWT_SECRET || 'laundry_saas_secure_key_2026', 'salt_rzp_enc', 32);
const IV_LENGTH = 16;

const encryptSecret = (text) => {
  if (!text || text === '********' || text.startsWith('enc:')) return text;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return 'enc:' + iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (e) {
    return text;
  }
};

const decryptSecret = (text) => {
  if (!text || text === '********') return '';
  if (!text.startsWith('enc:')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const encryptedText = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (e) {
    return text;
  }
};


const Login = async (req, res, next) => {
  try {
    // const users = [{ name: "surya", password: "123456789" }]
    const { name, password } = req.body
    // const user = users.find(u => u.name === name && u.password === password);
    const user = await users.findOne({ username: name })
    console.log(user)
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' })
    }
    const isMatch = await user.comparePassword(password)
    console.log(isMatch)
    if (!isMatch) {
      return res.status(400).json({ status: false, message: 'Invalid password' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        type: user.type || user.role || 'admin',
        role: user.role || user.type || 'admin',
        admin_id: user.admin_id || user._id,
        business_id: user.business_id
      },
      jwtSecret
    );

    return res.json({ status: true, message: 'Login successful', user, token });
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
      data: err?.message
    })
  }
}

const createUser = async (req, res, next) => {
  try {
    const data = req.body;
    const user = await users.create(data)
    return res.status(201).json({
      message: "created successfully",
      data: user
    })
  } catch (err) {
    return res.status(500).json({
      message: "Something went wrong",
      data: err?.message
    })
  }
}

const createEmployee = async (req, res) => {
  try {
    if (req.user && req.user.role === 'employee') {
      return res.status(403).json({ message: 'Employees are not authorized to create staff accounts.' });
    }
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const exist = await users.findOne({ $or: [{ username }, { email }] });
    if (exist) {
      return res.status(400).json({ message: 'Username or Email already exists.' });
    }
    const adminUser = await users.findById(req.user.id);
    if (!adminUser) {
      return res.status(404).json({ message: 'Admin user not found.' });
    }

    const is300Plan = String(adminUser.subscriptionPlan).includes('300') || Number(adminUser.paymentAmount) === 300;
    const maxEmployees = is300Plan ? 7 : 3;

    const currentEmployeeCount = await users.countDocuments({ admin_id: req.user.id, role: 'employee' });
    if (currentEmployeeCount >= maxEmployees) {
      if (maxEmployees === 3) {
        return res.status(403).json({
          status: false,
          message: 'Only 3 employees can be created in the 150 plan. Please upgrade to the 300 plan to create up to 7 employees.'
        });
      } else {
        return res.status(403).json({
          status: false,
          message: 'You have reached the maximum limit of 7 employees in the 300 plan.'
        });
      }
    }

    const newEmployee = await users.create({
      name,
      username,
      email,
      password,
      role: 'employee',
      type: 'employee',
      admin_id: req.user.id,
      business_id: adminUser?.business_id || req.user.business_id,
      is_profile_completed: true
    });
    return res.status(201).json({ message: 'Employee created successfully', data: newEmployee });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong', data: err?.message });
  }
};

const getEmployees = async (req, res) => {
  try {
    const adminId = req.user.id;
    const employeesList = await users.find({ admin_id: adminId, role: 'employee' }).select('-password');
    return res.json({ status: true, data: employeesList });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong', data: err?.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    if (req.user && req.user.role === 'employee') {
      return res.status(403).json({ message: 'Employees are not authorized to delete staff accounts.' });
    }
    const { id } = req.params;
    const deleted = await users.findOneAndDelete({ _id: id, admin_id: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: 'Employee not found or not authorized to delete.' });
    }
    return res.json({ message: 'Employee deleted successfully', data: deleted });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong', data: err?.message });
  }
};

const change_pass = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match.' });
    }

    const user = await users.findOne({ _id: req.body.userId });
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    // Hash the new password and save
    const salt = await bcrypt.genSalt(10);
    // user.password = await bcrypt.hash(newPassword, salt);
    user.password = newPassword
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error.' });
  }
}

const getRazorpayKeys = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await users.findById(userId);
    const Business = require('../../models/businessModel');
    const business = await Business.findOne({ user_id: user?.role === 'employee' ? (user.admin_id || userId) : userId });
    const keyId = business?.razorpay_key_id || user?.razorpay_key_id || '';
    const rawSecret = business?.razorpay_key_secret || user?.razorpay_key_secret || '';
    const isSecretSet = Boolean(rawSecret && rawSecret !== '');
    return res.json({
      status: true,
      data: {
        razorpay_key_id: keyId,
        razorpay_key_secret: isSecretSet ? '********' : '',
        isKeySet: Boolean(keyId || isSecretSet)
      }
    });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

const requestRazorpayUpdateOtp = async (req, res) => {
  try {
    if (req.user && req.user.role === 'employee') {
      return res.status(403).json({ status: false, message: 'Only laundry owners can update Razorpay keys.' });
    }
    const userId = req.user.id;
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.razorpayUpdateOtp = otp;
    user.razorpayUpdateOtpExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    console.log(`[Security OTP] Verification code for updating Razorpay keys (${user.email}): ${otp}`);

    let emailSent = false;
    let emailErrorMsg = null;
    if (process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_HOST) {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT || 587),
          secure: Boolean(process.env.SMTP_SECURE === 'true'),
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });

        await transporter.sendMail({
          from: `"Laundry SaaS Security" <${process.env.SMTP_USER}>`,
          to: user.email,
          subject: 'Verification Code to Update Razorpay API Keys',
          html: `<h3>Razorpay Key Modification Request</h3>
                 <p>Hello ${user.name},</p>
                 <p>We received a request to update or replace your store's Razorpay API keys (<code>razorpay_key_id</code> & <code>razorpay_key_secret</code>).</p>
                 <p>Your 6-digit authorization code is: <b style="font-size: 20px; color: #ec4899;">${otp}</b></p>
                 <p>This code is valid for 15 minutes. If you did not request this, please change your password immediately.</p>`
        });
        emailSent = true;
      } catch (smtpErr) {
        console.warn(`[SMTP Warning] Failed to send OTP email via ${process.env.SMTP_HOST}:`, smtpErr.message);
        if (smtpErr.message?.includes('535') || smtpErr.message?.includes('BadCredentials') || smtpErr.code === 'EAUTH') {
          console.warn(`[SMTP Guidance] Gmail requires a 16-character Google App Password (not your regular Gmail account password). Go to Google Account -> Security -> 2-Step Verification -> App Passwords to generate one and place it in SMTP_PASS.`);
        }
        emailErrorMsg = smtpErr.message;
      }
    }

    return res.json({
      status: true,
      message: emailSent 
        ? `Verification code sent to your registered email (${user.email}).`
        : `Verification code generated (${otp}). Note: SMTP email delivery failed (${emailErrorMsg || 'SMTP credentials missing'}). Please use the code shown below or on console.`,
      devOtp: (!emailSent || !process.env.SMTP_USER) ? otp : undefined
    });
  } catch (err) {
    console.error('OTP request error:', err);
    return res.status(500).json({ status: false, message: err?.message || 'Failed to send verification code.' });
  }
};

const updateRazorpayKeys = async (req, res) => {
  try {
    if (req.user && req.user.role === 'employee') {
      return res.status(403).json({ status: false, message: 'Only laundry owners can update Razorpay keys.' });
    }
    const userId = req.user.id;
    const { razorpay_key_id, razorpay_key_secret, otp } = req.body;

    const user = await users.findById(userId);
    const Business = require('../../models/businessModel');
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

    await users.findByIdAndUpdate(userId, { $set: { razorpay_key_id, razorpay_key_secret: finalSecret, razorpayUpdateOtp: null, razorpayUpdateOtpExpiry: null } });
    await Business.findOneAndUpdate({ user_id: userId }, { $set: { razorpay_key_id, razorpay_key_secret: finalSecret } }, { upsert: true });

    return res.json({ status: true, message: 'Razorpay API keys saved successfully.' });
  } catch (err) {
    return res.status(500).json({ status: false, message: err.message });
  }
};

module.exports = { Login, createUser, createEmployee, getEmployees, deleteEmployee, change_pass, getRazorpayKeys, updateRazorpayKeys, requestRazorpayUpdateOtp, decryptSecret, encryptSecret }