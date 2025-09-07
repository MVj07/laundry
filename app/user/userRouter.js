const express = require('express')
const { Login, createUser,change_pass } = require('./userController')

const userRouting = (app) => {
    const router = express.Router()
    router.post('/login', Login)
    router.post('/create', createUser)
    router.post('/change_pass', change_pass)

    app.use(router)
}

module.exports = userRouting