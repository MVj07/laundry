const items = require('../../models/itemsModel')
const orders = require('../../models/ordersModel')

const getAll = async (req, res, next) => {
    try {
        let condition={}
        condition.user_id=req.user.id
        const item = await items.find(condition)
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

const getById = async (req, res, next) => {
    try {
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
        const userId = req.user.id;
        const data = req.body; // expecting array

        if (!Array.isArray(data)) {
            return res.status(400).json({
                message: "Data should be an array of items."
            });
        }

        // add user_id to each item
        const itemsWithUser = data.map(item => ({
            ...item,
            user_id: userId
        }));

        await items.insertMany(itemsWithUser);

        return res.status(201).json({
            message: "New items created successfully"
        });
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        });
    }
};


const deleteItem = async (req, res) => {
    try {
        const id = req.body.itemId
        const deleted = await items.deleteOne({ _id: id })
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


module.exports = { getAll, getById, createItem, deleteItem }