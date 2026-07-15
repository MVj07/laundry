const express = require('express')
const {createOrder, updateOrder, getAll, getById, deleteOrder, overallsearch, bulkUpdate, generateInvoice, getDashboardMetrics, barcodeUpdate, recordPayment, updateOrderServiceStatus, generateGarmentTags, generateThermalInvoice}= require('./orderController')
const authenticateJWT = require('../../services')
const checkSubscription = require('../middlewares/checkSubscription')

const orderRouting = (app) => {
    const router = express.Router()
    router.post('/', createOrder)
    router.put('/', updateOrder)
    router.put('/barcode-update', barcodeUpdate)
    router.get('/', getAll)
    router.get('/dashboard-metrics', getDashboardMetrics)
    router.get('/:id', getById)
    router.delete('/:id', deleteOrder)
    router.post('/search', overallsearch)
    router.put('/bulkUpdate', bulkUpdate)
    router.post('/generate-invoice/:id', generateInvoice)
    router.post('/generate-tags/:id', generateGarmentTags)
    router.post('/generate-thermal-invoice/:id', generateThermalInvoice)
    router.post('/record-payment', recordPayment)
    router.put('/:id/service-status', updateOrderServiceStatus)
    app.use('/order', authenticateJWT, checkSubscription, router)
}

module.exports = orderRouting