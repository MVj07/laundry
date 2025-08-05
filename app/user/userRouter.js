const express = require('express')
const { Login, createUser } = require('./userController')

const userRouting = (app) => {
    const router = express.Router()
    router.post('/login', Login)
    router.post('/create', createUser)
    app.use(router)
}

module.exports = userRouting