const Service = require('../../models/serviceModel');

const createService = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ message: "Service name is required" });
    }

    const existing = await Service.findOne({ user_id: req.user.id, name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: "Service already exists" });
    }

    const service = await Service.create({
      user_id: req.user.id,
      name: name.trim(),
      description
    });

    res.status(201).json({ message: "Service created successfully", data: service });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

const getServices = async (req, res) => {
  try {
    const services = await Service.find({ user_id: req.user.id }).sort({ name: 1 });
    res.status(200).json({ data: services });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Service name is required" });
    }

    const existing = await Service.findOne({
      _id: { $ne: id },
      user_id: req.user.id,
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
    });

    if (existing) {
      return res.status(400).json({ message: "Another service with this name already exists" });
    }

    const service = await Service.findOneAndUpdate(
      { _id: id, user_id: req.user.id },
      { name: name.trim(), description },
      { new: true }
    );

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.status(200).json({ message: "Service updated successfully", data: service });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const service = await Service.findOneAndDelete({ _id: id, user_id: req.user.id });

    if (!service) {
      return res.status(404).json({ message: "Service not found" });
    }

    res.status(200).json({ message: "Service deleted successfully", data: service });
  } catch (err) {
    res.status(500).json({ message: "Something went wrong", error: err.message });
  }
};

module.exports = { createService, getServices, updateService, deleteService };
