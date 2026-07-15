const users = require('../../models/usersModel');

/**
 * Middleware: checkSubscription()
 * Checks if user is within their 14-day free trial OR has an active 30-day subscription.
 * If expired and not subscribed, returns 403 { subscriptionRequired: true }.
 */
const checkSubscription = async (req, res, next) => {
  try {
    const userId = req.user?.id || req.headers['x-user-id'];
    if (!userId) {
      return res.status(401).json({ status: false, message: 'Unauthorized. User ID not found in request.' });
    }

    const user = await users.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found.' });
    }

    const now = new Date();

    // 1. Check if trial is active
    if (user.subscriptionStatus === 'trial' && user.trialExpiryDate && new Date(user.trialExpiryDate) > now) {
      return next();
    }

    // 2. Check if paid subscription is active and not expired
    if ((user.subscriptionStatus === 'active' || user.subscriptionStatus === 'ACTIVE') && user.subscriptionExpiryDate && new Date(user.subscriptionExpiryDate) > now) {
      return next();
    }

    // 3. Otherwise, trial/subscription is expired
    return res.status(403).json({
      subscriptionRequired: true,
      status: false,
      message: 'Your 14-day trial or monthly subscription has expired. Please subscribe to continue accessing protected features.'
    });
  } catch (err) {
    console.error('Error in checkSubscription middleware:', err);
    return res.status(500).json({ status: false, message: 'Server error verifying subscription status.' });
  }
};

module.exports = checkSubscription;
