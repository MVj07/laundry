const users = require('../../models/usersModel')
const { jwtSecret } = require('../../services/config')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')


const Login = async (req, res, next) => {
  try {
    // const users = [{ name: "surya", password: "123456789" }]
    const { name, password } = req.body
    // const user = users.find(u => u.name === name && u.password === password);
    const user = await users.findOne({ username: name })
    console.log(user)
    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' })
    }
    const isMatch = await user.comparePassword(password)
    console.log(isMatch)
    if (!isMatch) {
      return res.status(400).json({ status: false, message: 'Invalid password' });
    }

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        type: user.type || user.role || 'admin',
        role: user.role || user.type || 'admin',
        admin_id: user.admin_id || user._id,
        business_id: user.business_id
      },
      jwtSecret
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

const createEmployee = async (req, res) => {
  try {
    if (req.user && req.user.role === 'employee') {
      return res.status(403).json({ message: 'Employees are not authorized to create staff accounts.' });
    }
    const { name, username, email, password } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }
    const exist = await users.findOne({ $or: [{ username }, { email }] });
    if (exist) {
      return res.status(400).json({ message: 'Username or Email already exists.' });
    }
    const adminUser = await users.findById(req.user.id);
    const newEmployee = await users.create({
      name,
      username,
      email,
      password,
      role: 'employee',
      type: 'employee',
      admin_id: req.user.id,
      business_id: adminUser?.business_id || req.user.business_id,
      is_profile_completed: true
    });
    return res.status(201).json({ message: 'Employee created successfully', data: newEmployee });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong', data: err?.message });
  }
};

const getEmployees = async (req, res) => {
  try {
    const adminId = req.user.id;
    const employeesList = await users.find({ admin_id: adminId, role: 'employee' }).select('-password');
    return res.json({ status: true, data: employeesList });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong', data: err?.message });
  }
};

const deleteEmployee = async (req, res) => {
  try {
    if (req.user && req.user.role === 'employee') {
      return res.status(403).json({ message: 'Employees are not authorized to delete staff accounts.' });
    }
    const { id } = req.params;
    const deleted = await users.findOneAndDelete({ _id: id, admin_id: req.user.id });
    if (!deleted) {
      return res.status(404).json({ message: 'Employee not found or not authorized to delete.' });
    }
    return res.json({ message: 'Employee deleted successfully', data: deleted });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong', data: err?.message });
  }
};

const change_pass = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match.' });
    }

    const user = await users.findOne({ _id: req.body.userId });
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

module.exports = { Login, createUser, createEmployee, getEmployees, deleteEmployee, change_pass }