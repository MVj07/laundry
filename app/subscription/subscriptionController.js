const Razorpay = require('razorpay');
const crypto = require('crypto');
const users = require('../../models/usersModel');

// Initialize Razorpay instance (using Test Mode keys if not configured via .env)
const getRazorpayInstance = () => {
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret'
  });
};

/**
 * Get user subscription status and trial countdown
 * GET /api/subscription/status
 */
const getStatus = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    const now = new Date();
    const isTrialActive = user.subscriptionStatus === 'trial' && new Date(user.trialExpiryDate) > now;
    const isSubActive = (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'ACTIVE') && new Date(user.subscriptionExpiryDate) > now;

    let currentPlan = 'Expired';
    let daysRemaining = 0;
    let expiryDate = null;

    if (isSubActive) {
      currentPlan = 'Monthly Plan (₹150)';
      const diff = new Date(user.subscriptionExpiryDate).getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      expiryDate = user.subscriptionExpiryDate;
    } else if (isTrialActive) {
      currentPlan = '14-Day Free Trial';
      const diff = new Date(user.trialExpiryDate).getTime() - now.getTime();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
      expiryDate = user.trialExpiryDate;
    } else {
      currentPlan = user.subscriptionStatus === 'trial' ? 'Trial Expired' : 'Subscription Expired';
      daysRemaining = 0;
      expiryDate = user.subscriptionExpiryDate || user.trialExpiryDate;
    }

    return res.json({
      status: true,
      data: {
        userId: user._id,
        name: user.name,
        email: user.email,
        subscriptionStatus: isSubActive ? 'ACTIVE' : (isTrialActive ? 'trial' : 'expired'),
        subscriptionPlan: user.subscriptionPlan,
        currentPlan,
        daysRemaining,
        expiryDate,
        paymentStatus: user.paymentStatus,
        trialStartDate: user.trialStartDate,
        trialExpiryDate: user.trialExpiryDate
      }
    });
  } catch (err) {
    console.error('Error fetching subscription status:', err);
    return res.status(500).json({ status: false, message: err?.message || 'Server error fetching status' });
  }
};

/**
 * Create Razorpay Order for ₹150 Monthly Plan
 * POST /api/subscription/create-order
 */
const createOrder = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    const amountInPaise = 150 * 100; // ₹150 in paise
    const currency = 'INR';

    // If API keys are missing or set to placeholders in .env, use Sandbox Mock Mode so testing works smoothly
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret || keyId.includes('placeholder') || keyId === 'rzp_test_placeholder_key') {
      console.log('Sandbox Mock Mode: RAZORPAY_KEY_ID missing/placeholder in .env. Generating mock order for testing...');
      const mockOrderId = `order_mock_${Date.now()}`;
      user.razorpayOrderId = mockOrderId;
      user.paymentAmount = 150;
      user.paymentCurrency = currency;
      await user.save();

      return res.json({
        status: true,
        orderId: mockOrderId,
        amount: amountInPaise,
        currency,
        keyId: 'rzp_test_mock_key',
        mockMode: true,
        message: 'Sandbox Mock Order generated (Add RAZORPAY_KEY_ID to .env for real Razorpay Checkout)'
      });
    }

    const razorpay = getRazorpayInstance();
    const orderOptions = {
      amount: amountInPaise,
      currency,
      receipt: `sub_${Date.now()}`,
      notes: {
        userId: user._id.toString(),
        username: user.username
      }
    };

    const order = await razorpay.orders.create(orderOptions);

    user.razorpayOrderId = order.id;
    user.paymentAmount = 150;
    user.paymentCurrency = currency;
    await user.save();

    return res.json({
      status: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    return res.status(500).json({ status: false, message: err?.message || 'Could not create Razorpay order' });
  }
};

/**
 * Verify Razorpay Checkout Signature and activate subscription (+30 days)
 * POST /api/subscription/verify
 */
const verifyPayment = async (req, res) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, mockMode } = req.body;

    if (!razorpay_order_id || (!mockMode && (!razorpay_payment_id || !razorpay_signature))) {
      return res.status(400).json({ status: false, message: 'Missing payment verification details.' });
    }

    // If verifying a Sandbox Mock Order
    const keyId = process.env.RAZORPAY_KEY_ID;
    const isMock = mockMode || razorpay_order_id.startsWith('order_mock_') || !keyId || keyId.includes('placeholder');

    if (!isMock) {
      const secret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
      const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
      const generatedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(generatedSignature, 'utf8'),
        Buffer.from(razorpay_signature, 'utf8')
      );

      if (!isValid) {
        return res.status(400).json({ status: false, message: 'Payment signature verification failed.' });
      }
    } else {
      console.log(`Sandbox Mock Verification: Activating +30 days subscription for order ${razorpay_order_id}`);
    }

    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found.' });
    }

    const now = new Date();
    // Extend from existing expiry if currently active, else from now
    const baseDate = ((user.subscriptionStatus === 'active' || user.subscriptionStatus === 'ACTIVE') && new Date(user.subscriptionExpiryDate) > now)
      ? new Date(user.subscriptionExpiryDate)
      : now;

    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

    user.subscriptionStatus = 'ACTIVE';
    user.subscriptionPlan = 'monthly_150';
    user.subscriptionStartDate = user.subscriptionStartDate || now;
    user.subscriptionExpiryDate = newExpiry;
    user.paymentStatus = 'PAID';
    user.razorpayOrderId = razorpay_order_id;
    user.razorpayPaymentId = razorpay_payment_id;
    user.razorpaySignature = razorpay_signature;
    user.paymentAmount = 150;
    user.paymentCurrency = 'INR';
    user.paymentDate = now;

    await user.save();

    return res.json({
      status: true,
      message: 'Subscription successfully activated for 30 days!',
      data: {
        subscriptionStatus: user.subscriptionStatus,
        subscriptionPlan: user.subscriptionPlan,
        subscriptionExpiryDate: user.subscriptionExpiryDate
      }
    });
  } catch (err) {
    console.error('Error in payment verification:', err);
    return res.status(500).json({ status: false, message: err?.message || 'Verification error occurred.' });
  }
};

module.exports = {
  getStatus,
  createOrder,
  verifyPayment
};
