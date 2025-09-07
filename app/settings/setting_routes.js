const express = require('express')
const authenticateJWT = require('../../services')
const { chamge_password } = require('./controller')

const expenseRouting = (app) => {
    const router = express.Router()
    router.get('/',chamge_password )
    app.use('/setting', authenticateJWT, router)
}

module.exports = expenseRouting