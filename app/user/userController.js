const users = require('../../models/usersModel')
const { jwtSecret, jwtExpire } = require('../../services/config')
const jwt = require('jsonwebtoken')

const Login = async (req, res, next) => {
    try {
        // const users = [{ name: "surya", password: "123456789" }]
        const { name, password } = req.body
        // const user = users.find(u => u.name === name && u.password === password);
        const user = await users.findOne({ name })
        if (!user) {
            return res.json({ status: false, message: 'User not found' })
        }
        const isMatch = await user.comparePassword(password)
        if (!isMatch) {
            return res.json({ status: false, message: 'Invalid password' });
        }

        const token = jwt.sign(
            { id: user._id, name: user.name, type: user.type },
            jwtSecret,
            { expiresIn: jwtExpire }
        );

        return res.json({ status: true, message: 'Login successful', user, token });
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

const createUser = async (req, res, next) => {
    try {
        const data = req.body;
        const user = await users.create(data)
        return res.status(201).json({
            message: "created successfully",
            data: user
        })
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

module.exports = { Login, createUser }