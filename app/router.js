const express = require('express');
const router = express.Router();
const userRouting = require('./user/userRouter');
const orderRouting = require('./order/orderRouter');
const customerRouting = require('./customer/customerRouter');
const expenseRouting = require('./expense/expenseRouter');
const settingsRouting = require('./settings/setting_routes');
const { businessRouting } = require('./business/businessRouter');
const serviceRouting = require('./service/serviceRouter');


router.get('/', async function(req, res, next){
  res.json({ status: "active" })
})

const routes=(app)=>{
    userRouting(app)
    orderRouting(app)
    customerRouting(app)
    expenseRouting(app)
    settingsRouting(app)
    businessRouting(app)
    serviceRouting(app)
}

module.exports=routes