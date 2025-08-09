const customer = require('../../models/customerModel')

const getAll = async (req, res, next) => {
    try {
        const item = await customer.find()
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