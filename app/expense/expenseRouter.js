const express = require('express')
const authenticateJWT = require('../../services')
const { create, getAll } = require('./expenseController')

const expenseRouting = (app) => {
    const router = express.Router()
    router.get('/', getAll)
    router.post('/', create)
    app.use('/expense', authenticateJWT, router)
}

module.exports = expenseRouting