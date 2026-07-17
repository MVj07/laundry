const mongoose = require('mongoose');
const bcrypt = require('bcryptjs')
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, default: 'admin' },
    role: { type: String, enum: ['admin', 'employee'], default: 'admin' },
    admin_id: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
    password: { type: String, required: true },
    is_profile_completed: { type: Boolean, default: false },
    business_id: { type: mongoose.Schema.Types.ObjectId, ref: "Business" },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    razorpay_key_id: { type: String, default: null },
    razorpay_key_secret: { type: String, default: null },
    razorpayUpdateOtp: { type: String, default: null },
    razorpayUpdateOtpExpiry: { type: Date, default: null },
    // Razorpay Subscription & Trial Management Fields
    trialStartDate: { type: Date, default: Date.now },
    trialExpiryDate: { 
        type: Date, 
        default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14-day free trial
    },
    subscriptionStatus: { 
        type: String, 
        enum: ['trial', 'active', 'ACTIVE', 'expired', 'cancelled', 'payment_failed'], 
        default: 'trial' 
    },
    subscriptionPlan: { 
        type: String, 
        enum: ['free_trial', 'monthly_200', '200', 'monthly_150', 'monthly_300', '150', '300', 'trial'], 
        default: 'free_trial' 
    },
    subscriptionStartDate: { type: Date },
    subscriptionExpiryDate: { type: Date },
    paymentStatus: { 
        type: String, 
        enum: ['unpaid', 'paid', 'PAID', 'failed'], 
        default: 'unpaid' 
    },
    razorpayOrderId: { type: String },
    razorpayPaymentId: { type: String },
    razorpaySignature: { type: String },
    paymentAmount: { type: Number },
    paymentCurrency: { type: String, default: 'INR' },
    paymentDate: { type: Date }
}, { timestamps: true })

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();

    try {
        const salt = await bcrypt.genSalt(10); // cost factor
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare entered password with hashed one
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('users', userSchema)