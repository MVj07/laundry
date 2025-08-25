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
        const type = req.params.type
        let filter = {};
        const now = new Date()
        if (type === "today") {
            const start = new Date(now.setHours(0, 0, 0, 0));
            const end = new Date(now.setHours(23, 59, 59, 999));
            filter.date = { $gte: start, $lte: end };

        } else if (type === "month") {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);  // 1st day of month
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // last day of month
            filter.date = { $gte: start, $lte: end };
        }
        let expenses = await expense.find(filter)

        return res.status(200).json({
            message:"Success",
            data: expenses
        })
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

module.exports = { create, getAll }
