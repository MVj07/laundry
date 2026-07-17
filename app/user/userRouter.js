const express = require('express')
const { Login, createUser, change_pass, createEmployee, getEmployees, deleteEmployee, getRazorpayKeys, updateRazorpayKeys, requestRazorpayUpdateOtp } = require('./userController')
const authenticateJWT = require('../../services')

const userRouting = (app) => {
    const router = express.Router()
    router.post('/login', Login)
    router.post('/create', createUser)
    router.post('/change_pass', change_pass)
    router.post('/create-employee', authenticateJWT, createEmployee)
    router.get('/employees', authenticateJWT, getEmployees)
    router.delete('/employee/:id', authenticateJWT, deleteEmployee)
    router.get('/razorpay-keys', authenticateJWT, getRazorpayKeys)
    router.post('/razorpay-keys/request-otp', authenticateJWT, requestRazorpayUpdateOtp)
    router.post('/razorpay-keys', authenticateJWT, updateRazorpayKeys)
    router.put('/razorpay-keys', authenticateJWT, updateRazorpayKeys)

    app.use(router)
}

module.exports = userRouting