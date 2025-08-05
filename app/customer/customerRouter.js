const express = require('express')
const authenticateJWT = require('../../services')
const { getAll, getById } = require('./customerController')

const customerRouting = (app) => {
    const router = express.Router()
    router.get('/', getAll)
    router.get('/:id', getById)
    app.use('/customer', authenticateJWT, router)
}

module.exports = customerRouting