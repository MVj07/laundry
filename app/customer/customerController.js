const customer = require('../../models/customerModel')
const orders = require('../../models/ordersModel')
const mongoose = require('mongoose')

const getAll = async (req, res, next) => {
    try {
        const condition={}
        condition.user_id=req.user.id
        const search=req.query?.search
        if (search){
            condition.$or=[
                {name:{$regex: search, $options:'i'}},
                {mobile:{$regex: search, $options:'i'}}
            ]
        }
        const item = await customer.find(condition)

        // Fetch order stats for each customer
        const stats = await orders.aggregate([
            { $match: { user_id: new mongoose.Types.ObjectId(req.user.id) } },
            {
                $group: {
                    _id: "$customerId",
                    totalOrders: { $sum: 1 },
                    deliveredOrders: {
                        $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
                    },
                    pendingOrders: {
                        $sum: { $cond: [{ $ne: ["$status", "delivered"] }, 1, 0] }
                    },
                    pendingAmount: {
                        $sum: { $cond: [{ $ne: ["$status", "delivered"] }, "$billAmount", 0] }
                    }
                }
            }
        ]);

        const statsMap = {};
        stats.forEach(s => {
            if (s._id) {
                statsMap[s._id.toString()] = {
                    totalOrders: s.totalOrders,
                    deliveredOrders: s.deliveredOrders,
                    pendingOrders: s.pendingOrders,
                    pendingAmount: s.pendingAmount
                };
            }
        });

        const customersWithStats = item.map(cust => {
            const custId = cust._id.toString();
            const custStats = statsMap[custId] || {
                totalOrders: 0,
                deliveredOrders: 0,
                pendingOrders: 0,
                pendingAmount: 0
            };
            return {
                ...cust.toObject(),
                stats: custStats
            };
        });

        return res.status(200).json({
            data: customersWithStats
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
        const _id = req.params.id
        console.log(_id)
        const item = await customer.findOne({_id})
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

module.exports={getAll, getById}