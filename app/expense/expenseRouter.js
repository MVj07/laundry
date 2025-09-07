const express = require('express')
const authenticateJWT = require('../../services')
const { create, getAll,getExpensesByDay,getExpensesByMonth, getExpensesByDate } = require('./expenseController')

const expenseRouting = (app) => {
    const router = express.Router()
    router.get('/', getAll)
    router.post('/', create)
    router.post('/daywies', getExpensesByDay)
    router.post('/monthwise', getExpensesByMonth)
    router.post('/byDate', getExpensesByDate)
    app.use('/expense', authenticateJWT, router)
}

module.exports = expenseRouting