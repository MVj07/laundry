const orders = require('../../models/ordersModel')
const customers = require('../../models/customerModel')

const order = async (data, res) => {
    try {
        const exist=await orders.findOne({kuri:data.kuri})
        if(exist){
            return res.status(500).json({
                message:'Same order kuri not allowed.'
            })
        }
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
        const name = data.customerName
        const mobile = data.phoneNumber

        const orderPayload = {
            items: data.items,
            kuri: data.kuri,
            status: data.status,
            p:1,
            date: new Date(data.date)
        }

        const existCustomer = await customers.find({mobile})
        if (existCustomer){
            return res.status(500).json({
                message:"Phone number already exist."
            })
        }

        const customer = await customers.findOne({ name, mobile })

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
        if (!data.customerId && !data.kuri  && !data.type) {
            return res.status(500).json({
                message: "one of the fields were missing"
            })
        }
        const customer = await customers.findOne({ _id: data.customerId })
        if (!customer) {
            return res.status(500).json({
                message: 'Customer not found'
            })
        }

        const updateData = {}
        if (data?.items) updateData.items = data.items;
        if (data?.status) updateData.status = data.status

        const order = await orders.findOne({customerId: customer._id, _id:data.orderId})
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
        const updtOrder = await orders.updateOne({ customerId: customer._id, _id:data.orderId }, { $set: {...updateData, date: new Date()} })
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
        const { search, page = 1, limit = 10 } = req.query;
        const condition={}
        if (req.query.status!=='null'){
            condition.status=req.query.status
        }
        console.log(condition)
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [items,total] = await Promise.all([orders.find(condition).skip(skip).limit(parseInt(limit)).populate('customerId').sort({date:1}),orders.countDocuments(condition)])
        return res.status(200).json({
            data: items,
            meta: {
            total,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(total / parseInt(limit))
        }
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

const deleteOrder=async(req, res, next)=>{
    try{
        const _id = req.query.id
        const item = await orders.findOne(_id)
        if (!item){
            return res.status(404).json({
                message: 'Order not found'
            })
        }
        const deleted = await item.deleteOne()
        return res.status(200).json({
            message: "Order deleted successfully",
            data: deleted
        })
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

module.exports = { createOrder, updateOrder, getAll, getById, deleteOrder }