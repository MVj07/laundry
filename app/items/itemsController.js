const items = require('../../models/itemsModel')
const orders = require('../../models/ordersModel')

const getAll = async (req, res, next) => {
    try {
        const item = await items.find()
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
        const item = await items.findOne(_id)
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

const createItem = async (req, res, next) => {
    try {
        const data = req.body; // Expecting an array of items

        if (!Array.isArray(data)) {
            return res.status(400).json({
                message: "Data should be an array of items."
            });
        }

        await items.insertMany(data);

        return res.status(201).json({
            message: "New items created."
        });
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        });
    }
};

const deleteItem=async(req, res)=>{
    try{
        const id = req.body.itemId
        const deleted = await items.deleteOne({_id: id})
        return res.status(201).json({
            message: "Item deleted."
        });
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        });
    }
}
const overallsearch=async(req, res)=>{
    const { search } = req.body;

    try {
      const results = await orders.find({
        kuri: { $regex: new RegExp(search, 'i') } // case-insensitive partial match
      });
  
      res.json({ success: true, data: results });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ success: false, message: 'Server Error' });
    }
}


module.exports = { getAll, getById, createItem, deleteItem ,overallsearch }