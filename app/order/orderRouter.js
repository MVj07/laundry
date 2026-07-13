const express = require('express')
const {createOrder, updateOrder, getAll, getById, deleteOrder, overallsearch, bulkUpdate, generateInvoice, getDashboardMetrics, barcodeUpdate, recordPayment}= require('./orderController')
const authenticateJWT = require('../../services')

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
    router.post('/record-payment', recordPayment)
    app.use('/order',authenticateJWT, router)
}

module.exports = orderRouting