const express = require('express');
const { getStatus, createOrder, verifyPayment } = require('./subscriptionController');
const authenticateJWT = require('../../services');

const subscriptionRouter = (app) => {
  const router = express.Router();
  
  // Protected endpoints requiring JWT authentication
  router.get('/status', authenticateJWT, getStatus);
  router.post('/create-order', authenticateJWT, createOrder);
  router.post('/verify', authenticateJWT, verifyPayment);

  app.use('/subscription', router);
};

module.exports = subscriptionRouter;
