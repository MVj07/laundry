const users = require('../../models/usersModel')
const { jwtSecret, jwtExpire } = require('../../services/config')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')


const Login = async (req, res, next) => {
    try {
        // const users = [{ name: "surya", password: "123456789" }]
        const { name, password } = req.body
        // const user = users.find(u => u.name === name && u.password === password);
        const user = await users.findOne({ name })
        console.log(user)
        if (!user) {
            return res.json({ status: false, message: 'User not found' })
        }
        const isMatch = await user.comparePassword(password)
        console.log(isMatch)
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
const change_pass = async (req,res)=>{
     try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match.' });
    }

    const user = await users.findOne({_id: req.body.userId});
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    // Hash the new password and save
    const salt = await bcrypt.genSalt(10);
    // user.password = await bcrypt.hash(newPassword, salt);
    user.password = newPassword
    await user.save();

    return res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error.' });
  }
}

module.exports = { Login, createUser,change_pass }