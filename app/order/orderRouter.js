const express = require('express')
const {createOrder, updateOrder, getAll, getById, deleteOrder, overallsearch, bulkUpdate, generateInvoice, getDashboardMetrics, barcodeUpdate, recordPayment, createPaymentLink, checkPaymentLinkStatus, simulateLinkPayment, razorpayWebhook, renderCustomerPaymentPage, updateOrderServiceStatus, generateGarmentTags, generateThermalInvoice}= require('./orderController')
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
    router.post('/create-payment-link', createPaymentLink)
    router.get('/check-payment-link/:id', checkPaymentLinkStatus)
    router.post('/simulate-link-payment', simulateLinkPayment)
    router.put('/:id/service-status', updateOrderServiceStatus)

    // Public / External webhooks and customer payment simulation pages (NO JWT auth needed)
    app.get('/order/pay/:id', renderCustomerPaymentPage)
    app.get('/pay/:id', renderCustomerPaymentPage)
    app.post('/order/simulate-link-payment', simulateLinkPayment)
    app.post('/order/razorpay-webhook', razorpayWebhook)
    app.post('/webhook/razorpay', razorpayWebhook)

    // Top-level direct alias for POS terminal POST /create-payment-link
    app.post('/create-payment-link', authenticateJWT, checkSubscription, createPaymentLink)

    app.use('/order', authenticateJWT, checkSubscription, router)
}

module.exports = orderRouting