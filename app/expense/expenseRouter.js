const express = require('express')
const authenticateJWT = require('../../services')
const { create, getAll } = require('./expenseController')

const customerRouting = (app) => {
    const router = express.Router()
    router.get('/:type', getAll)
    router.post('/', create)
    app.use('/customer', authenticateJWT, router)
}

module.exports = customerRouting