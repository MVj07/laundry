const express = require('express')
const {createOrder, updateOrder, getAll, getById, deleteOrder}= require('./orderController')
const authenticateJWT = require('../../services')

const orderRouting = (app) => {
    const router = express.Router()
    router.post('/', createOrder)
    router.put('/', updateOrder)
    router.get('/', getAll)
    router.get('/:id', getById)
    router.delete('/:id', deleteOrder)
    app.use('/order',authenticateJWT, router)
}

module.exports = orderRouting