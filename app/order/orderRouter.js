const express = require('express')
const {createOrder, updateOrder, getAll, getById}= require('./orderController')
const authenticateJWT = require('../../services')

const orderRouting = (app) => {
    const router = express.Router()
    router.post('/', createOrder)
    router.put('/', updateOrder)
    router.get('/', getAll)
    router.get('/:id', getById)
    app.use('/order',authenticateJWT, router)
}

module.exports = orderRouting