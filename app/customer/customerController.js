const customer = require('../../models/customerModel')

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