const orders = require('../../models/ordersModel')
const customers = require('../../models/customerModel')

const order = async (data, res) => {
    try {
        const order = await orders.create(data)
        if (order) {
            return res.status(201).json({
                data: order,
                message: "Order created successfully"
            })
        }
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

const createOrder = async (req, res, next) => {
    try {
        const data = req.body
        console.log(data)
        const kuri = data.kuri
        const name = data.customerName
        const mobile = data.phoneNumber

        const orderPayload = {
            items: data.items,
            kuri: data.kuri,
            status: data.status
        }


        const customer = await customers.findOne({ kuri, name, mobile })

        if (!customer) {
            const custPayload = {
                date: data.date,
                name: data.customerName,
                mobile: data.phoneNumber,
                address: data.address
            }
            const createCustomer = await customers.create(custPayload)

            if (createCustomer) {
                const crorder = await order({ ...orderPayload, customerId: createCustomer._id }, res)
            }
        }
        else {
            const crOrder = await order({ ...orderPayload, customerId: customer._id }, res)
        }
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

const updateOrder = async (req, res, next) => {
    try {
        const data = req.body
        if (!data.customerName && !data.kuri && !data.phoneNumber && !data.type) {
            return res.status(500).json({
                message: "one of the fields were missing"
            })
        }
        const customer = await customers.findOne({ kuri: data.kuri, name: data.customerName, mobile: data.phoneNumber })
        if (!customer) {
            return res.status(500).json({
                message: 'Customer not found'
            })
        }

        const updateData = {}
        if (data?.items) updateData.items = data.items;
        if (data?.status) updateData.status = data.status

        const order = await orders.findOne({customerId: customer._id})
        if (!order){
            return res.status(500).json({
                message:"Order not found"
            })
        }

        if (data.type==='item'){
            if(order.status!=='washing'){
                return res.status(500).json({
                    message: 'Cannot update.'
                })
            }
        }
        // console.log(updateData)
        const updtOrder = await orders.updateOne({ customerId: customer._id }, { $set: updateData })
        if (updtOrder) {
            return res.status(200).json({
                message: "Updated order successfully"
            })
        }
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

const getAll = async(req, res, next) => {
    try {
        const item = await orders.find({status:req.query.status}).populate('customerId')
        return res.status(200).json({
            data: item
        })
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

const getById=async(req, res, next)=>{
    try{
        const _id = req.query.id
        const item = await orders.findOne(_id)
        return res.status(200).json({
            data: item
        })
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

module.exports = { createOrder, updateOrder, getAll, getById }