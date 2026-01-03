const expense = require('../../models/expenseModel')

const create = async (req, res, next) => {
    try {
        const data = req.body;
        const userId = req.user.id
        let createexpense = await expense.create({...data, user_id: userId})
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
        filter.user_id=req.user.id
        const now = new Date()
        if (type === "today") {
            const start = new Date();
            start.setHours(0, 0, 0, 0);

            const end = new Date();
            end.setHours(23, 59, 59, 999);

            filter.createdAt = { $gte: start, $lte: end };
        }
        else if (type === "month") {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

            filter.createdAt = { $gte: start, $lte: end };
        }
        console.log(filter)
        const skip = (page - 1) * limit;

        // let expenses = await expense.find(filter).skip(skip).limit(parseInt(limit))
        const [expenses, total] = await Promise.all([expense.find(filter).skip(skip).limit(parseInt(limit)), expense.countDocuments(filter)])
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

const getExpensesByDay = async (req, res, next) => {
    try {
        const start = new Date();
        start.setHours(0, 0, 0, 0);

        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const expenses = await expense.find({
            createdAt: { $gte: start, $lte: end }
        });

        res.json({ status: 200, data: expenses });
    } catch (error) {
        next(error);
    }
};


const getExpensesByMonth = async (req, res, next) => {
    // try {
    //     const now = new Date();
    //     const start = new Date(now.getFullYear(), now.getMonth(), 1);
    //     const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    //     const expenses = await expense.find({
    //         createdAt: { $gte: start, $lte: end }
    //     });

    //     res.json({ status: 200, data: expenses });
    // } catch (error) {
    //     next(error);
    // }
    const { month, year } = req.body;

    // Convert to integers
    const numericMonth = parseInt(month); // e.g. "2" → 2
    const numericYear = parseInt(year);   // e.g. "2025" → 2025
    
    try {
      const startDate = new Date(numericYear, numericMonth - 1, 1); // Feb 1, 2025
      const endDate = new Date(numericYear, numericMonth, 0, 23, 59, 59, 999); // Feb 28, 2025
    
      console.log('Filtering from:', startDate.toISOString(), 'to', endDate.toISOString());
    
      
      const data = await expense.aggregate([
        {
            $match: {
              createdAt: { $gte: startDate, $lte: endDate }
            }
          },
        //   {
        //     $group: {
        //       _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        //       totalAmount: { $sum: { $multiply: ["$quantity", "$unitprice"] } }
        //     }
        //   },
          {
            $project: {
              _id: 0,
              date: "$createdAt",
              item: "$item",
              quantity: "$quantity",
              unitprice: "$unitprice",
              totalAmount: 1
            }
          },
          {
            $sort: { date: 1 }
          }
      ]);
    
    
      res.json({ success: true, data });    
    } catch (error) {
        console.error(error);

        // Make sure to return or end function here, so no more res calls happen:
        return res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const getExpensesByDate = async (req, res) => {
    try {
        const { date } = req.body;
        if (!date) {
            return res.status(400).json({ message: "Date is required" });
        }

        const start = new Date(date);
        start.setHours(0, 0, 0, 0);

        const end = new Date(date);
        end.setHours(23, 59, 59, 999);

        const expenses = await expense.find({
            createdAt: { $gte: start, $lte: end }
        });

        return res.status(200).json({ status: 200, data: expenses });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ status: 500, message: "Something went wrong", error: err.message });
    }
};

module.exports = { create, getAll, getExpensesByDay, getExpensesByMonth, getExpensesByDate }
