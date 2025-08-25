const express = require('express');
const router = express.Router();
const items = require('../models/itemsModel');
const userRouting = require('./user/userRouter');
const orderRouting = require('./order/orderRouter');
const itemsRouting = require('./items/itemsRouter');
const customerRouting = require('./customer/customerRouter');
const expenseRouting = require('./expense/expenseRouter');

router.get('/', async function(req, res, next){
  const i = await items.find()
  res.json(i)
})

const routes=(app)=>{
    userRouting(app)
    orderRouting(app)
    itemsRouting(app)
    customerRouting(app)
    expenseRouting(app)
}

module.exports=routes