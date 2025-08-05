const express = require('express')
const { getAll, getById } = require('./itemsController')
const authenticateJWT = require('../../services')

const itemsRouting = (app) => {
    const router = express.Router()
    router.get('/', getAll)
    router.get('/:id', getById)
    // router.post('/create', createUser)
    app.use('/items', authenticateJWT, router)
}

module.exports = itemsRouting