const express = require('express');
const { createService, getServices, updateService, deleteService } = require('./serviceController');
const authenticateJWT = require('../../services');

const serviceRouting = (app) => {
  const router = express.Router();
  
  router.post('/', createService);
  router.get('/', getServices);
  router.put('/:id', updateService);
  router.delete('/:id', deleteService);

  app.use('/service', authenticateJWT, router);
};

module.exports = serviceRouting;
