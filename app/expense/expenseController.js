const expense = require('../../models/expenseModel')

const create = async (req, res, next) => {
    try {
        const data = req.body;
        let createexpense = await expense.create(data)
        return res.status(201).json({
            message: 'Expense created',
            data: createexpense
        })
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

const getAll = async (req, res, next) => {
    try {
        const { type, page, limit } = req.query
        let filter = {};
        const now = new Date()
        if (type === "Today") {
            const start = new Date();
            start.setHours(0, 0, 0, 0);

            const end = new Date();
            end.setHours(23, 59, 59, 999);

            filter.createdAt = { $gte: start, $lte: end };
        }
        else if (type === "This Month") {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

            filter.createdAt = { $gte: start, $lte: end };
        }
        console.log(filter)
        const skip = (page - 1) * limit;

        // let expenses = await expense.find(filter).skip(skip).limit(parseInt(limit))
        const [expenses,total] = await Promise.all([expense.find(filter).skip(skip).limit(parseInt(limit)),expense.countDocuments(filter)])
        return res.status(200).json({
            message: "Success",
            data: expenses,
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

module.exports = { create, getAll }
