const authenticateJWT = require('../../services')
const express = require('express')
const multer = require('multer')
const {saveBusiness, createWorkflow, view} = require('./businessController')

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) => cb(null, Date.now() + "_" + file.originalname)
});
const upload = multer({ storage });

const businessRouting = (app) => {
    const router = express.Router();
    router.post("/setup", upload.single("logo"), saveBusiness);
    router.post('/create-workflow', createWorkflow)
    router.get('/view', view)
    app.use('/business', authenticateJWT, router)
}
module.exports = { businessRouting }
// POST /business/setup

