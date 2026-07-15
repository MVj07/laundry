const express = require('express')
const authenticateJWT = require('../../services')
const checkSubscription = require('../middlewares/checkSubscription')
const { getAll, getById } = require('./customerController')

const customerRouting = (app) => {
    const router = express.Router()
    router.get('/', getAll)
    router.get('/:id', getById)
    app.use('/customer', authenticateJWT, checkSubscription, router)
}

module.exports = customerRouting