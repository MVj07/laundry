const orders = require('../../models/ordersModel')
const customers = require('../../models/customerModel')
const { default: mongoose } = require('mongoose');
const { default: puppeteer } = require('puppeteer');
const invoiceTemplate = require('../templates/invoiceTemplate');
const tagTemplate = require('../templates/tagTemplate');
const thermalInvoiceTemplate = require('../templates/thermalInvoiceTemplate');
const path = require("path");
const fs = require("fs");
const businessModel = require('../../models/businessModel');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { decryptSecret } = require('../user/userController');

const getRazorpayInstance = (customKeyId, customKeySecret) => {
    let secret = customKeySecret || process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
    if (secret && typeof secret === 'string' && secret.startsWith('enc:')) {
        secret = decryptSecret(secret) || secret;
    }
    return new Razorpay({
        key_id: customKeyId || process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder_key',
        key_secret: secret
    });
};

// const generateBillNo = async () => {
//     const count = await orders.countDocuments(); // total orders
//     const nextNumber = count + 1;

//     // padded 5 digits like 00001, 00002
//     return "LDY-" + nextNumber.toString().padStart(5, "0");
// };
const generateBillNo = async () => {
    const lastOrder = await orders
        .findOne({})
        .sort({ createdAt: -1 }) // or sort by bill_no
        .lean();

    let nextNumber = 1;
    if (lastOrder?.bill) {
        const lastNumber = parseInt(lastOrder.bill.split('-')[1]);
        nextNumber = lastNumber + 1;
    }

    return `LDY-${nextNumber.toString().padStart(5, '0')}`;
};



const order = async (data, res) => {
    try {
        const exist = await orders.findOne({ bill: data.bill })
        if (exist) {
            return res.status(500).json({
                message: 'Same order kuri not allowed.'
            })
        }
        const order = await orders.create(data)
        if (order) {
            return res.status(201).json({
                data: order,
                message: "Order created successfully"
            })
        }
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

// const createOrder = async (req, res, next) => {
//     try {
//         const data = req.body
//         console.log(data)
//         const name = data.customerName
//         const mobile = data.phoneNumber

//         const orderPayload = {
//             items: data.items,
//             bill: data.bill,
//             status: data.status,
//             p: 1,
//             date: new Date(data.date)
//         }


//         const customer = await customers.findOne({ name, mobile })

//         if (!customer) {
//             const custPayload = {
//                 date: data.date,
//                 name: data.customerName,
//                 mobile: data.phoneNumber,
//                 address: data.address,
//                 kuri: data.kuri
//             }
//             const createCustomer = await customers.create(custPayload)

//             if (createCustomer) {
//                 const crorder = await order({ ...orderPayload, customerId: createCustomer._id }, res)
//             }
//         }
//         else {
//             const crOrder = await order({ ...orderPayload, customerId: customer._id }, res)
//         }
//     } catch (err) {
//         return res.status(500).json({
//             message: "Something went wrong",
//             data: err?.message
//         })
//     }
// }
const createOrder = async (req, res, next) => {
    try {
        const userId = req.user.id
        const data = req.body;

        const name = data.customerName;
        const mobile = data.phoneNumber;

        // generate bill number
        const billNo = await generateBillNo();
        console.log(billNo)

        // Resolve services
        let selectedServices = [];
        if (Array.isArray(data.services) && data.services.length > 0) {
            const ServiceModel = require('../../models/serviceModel');
            const foundServices = await ServiceModel.find({
                user_id: userId,
                $or: [
                    { _id: { $in: data.services.filter(id => mongoose.isValidObjectId(id)) } },
                    { name: { $in: data.services } }
                ]
            });
            selectedServices = foundServices.map(s => ({
                serviceId: s._id,
                name: s.name,
                status: 'pending'
            }));
        }

        const initialStatus = data.status || 'confirm';
        const isTrackingStatus = !['confirm', 'delivered'].includes(initialStatus);

        const dcharge = parseFloat(data.deliveryCharge) || 0;
        const dtype = data.deliverytype || (dcharge > 0 ? 'DD' : 'CP');

        const orderPayload = {
            user_id: userId,
            items: data.items,
            type: data.type || 'item',
            status: initialStatus,
            processingStartTime: isTrackingStatus ? new Date() : null,
            deliverytype: dtype,
            deliveryCharge: dcharge,
            date: new Date(data.date),
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            specialInstructions: data.specialInstructions || '',
            bill: billNo,
            billAmount: (data?.items?.reduce((sum, item) => {
                return sum + (parseFloat(item.qty || 0) * parseFloat(item.amount || 0));
            }, 0) || 0) + dcharge,
            services: selectedServices
        };

        // Find or create customer
        let customer = await customers.findOne({ name, mobile });

        if (!customer) {
            customer = await customers.create({
                user_id: userId,
                date: data.date,
                name: data.customerName,
                mobile: data.phoneNumber,
                address: data.address,
                kuri: data.kuri,
                whatsapp: data.whatsappNumber
            });
        } else if (data.whatsappNumber) {
            customer.whatsapp = data.whatsappNumber;
            await customer.save();
        }

        // Create order
        const newOrder = await orders.create({
            ...orderPayload,
            customerId: customer._id
        });

        const populatedOrder = await orders.findById(newOrder._id).populate('customerId');

        return res.status(200).json({
            message: "Order created successfully",
            data: populatedOrder
        });

    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            error: err.message
        });
    }
};


const updateOrder = async (req, res, next) => {
    try {
        const data = req.body
        if (!data.customerId && !data.bill && !data.type) {
            return res.status(500).json({
                message: "one of the fields were missing"
            })
        }
        const customer = await customers.findOne({ _id: data.customerId })
        if (!customer) {
            return res.status(500).json({
                message: 'Customer not found'
            })
        }

        const order = await orders.findOne({ customerId: customer._id, _id: data.orderId })
        if (!order) {
            return res.status(500).json({
                message: "Order not found"
            })
        }

        const updateData = {}
        if (data?.deliverytype) updateData.deliverytype = data.deliverytype;
        if (data?.deliveryCharge !== undefined) {
            updateData.deliveryCharge = parseFloat(data.deliveryCharge) || 0;
            if (updateData.deliveryCharge > 0 && !updateData.deliverytype) updateData.deliverytype = 'DD';
        }

        if (data?.items || data?.deliveryCharge !== undefined || data?.deliverytype) {
            const items = data.items || order.items || [];
            const dcharge = data?.deliveryCharge !== undefined ? (parseFloat(data.deliveryCharge) || 0) : (parseFloat(order.deliveryCharge) || 0);
            updateData.billAmount = items.reduce((sum, item) => {
                return sum + (parseFloat(item.qty || 0) * parseFloat(item.amount || 0));
            }, 0) + dcharge;
            if (data?.items) {
                updateData.items = data.items;
            }
        }
        if (data?.status) {
            updateData.status = data.status;
            if (!['confirm', 'delivered'].includes(data.status) && !order.processingStartTime) {
                updateData.processingStartTime = new Date();
            }
            if (data.status === 'order_taken' && !order.orderTakenAt) {
                updateData.orderTakenAt = data.orderTakenAt ? new Date(data.orderTakenAt) : new Date();
            }
            if (data.status === 'delivered') {
                updateData.deliveredAt = data.deliveredAt ? new Date(data.deliveredAt) : new Date();
            }
        }
        if (data?.orderTakenAt) updateData.orderTakenAt = new Date(data.orderTakenAt);
        if (data?.deliveredAt) updateData.deliveredAt = new Date(data.deliveredAt);
        if (data?.dueDate) updateData.dueDate = new Date(data.dueDate);
        if (data?.specialInstructions !== undefined) updateData.specialInstructions = data.specialInstructions;
        if (data?.type && (data.type === 'item' || data.type === 'kg')) updateData.type = data.type;

        if (data?.services) {
            const ServiceModel = require('../../models/serviceModel');
            const foundServices = await ServiceModel.find({
                user_id: req.user.id,
                $or: [
                    { _id: { $in: data.services.filter(id => mongoose.isValidObjectId(id)) } },
                    { name: { $in: data.services } }
                ]
            });
            updateData.services = foundServices.map(s => {
                const existing = order.services ? order.services.find(es => es.serviceId.toString() === s._id.toString()) : null;
                return {
                    serviceId: s._id,
                    name: s.name,
                    status: existing ? existing.status : 'pending',
                    completedAt: existing ? existing.completedAt : null
                };
            });
        }

        // if (data.type === 'item') {
        //     if (order.status !== '') {
        //         return res.status(500).json({
        //             message: 'Cannot update.'
        //         })
        //     }
        // }
        // console.log(updateData)
        const updtOrder = await orders.updateOne({ customerId: customer._id, _id: data.orderId }, { $set: { ...updateData, date: new Date() } })
        if (updtOrder) {
            return res.status(200).json({
                message: "Updated order successfully"
            })
        }
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

const getAll = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, status, customerName, mobile, date, month, year, paymentStatus } = req.query;
        const condition = {}
        condition.user_id = req.user.id

        if (status === 'track') {
            // Tracking board: all orders that are actively in the workflow pipeline
            // (exclude drafts saved as 'confirm' and fully completed 'delivered' orders)
            condition.status = { $nin: ['confirm', 'delivered', 'deliver', 'order_taken', 'pickup'] };
        } else if (status === 'deliver') {
            condition.status = { $in: ['deliver', 'order_taken'] };
        } else if (status) {
            condition.status = status;
        }

        if (paymentStatus) {
            condition.paymentStatus = paymentStatus;
        }

        // Filter by Customer Name or Mobile (retrieving matches from customer collection)
        if (customerName || mobile) {
            const customerFilter = { user_id: req.user.id };
            if (customerName) {
                customerFilter.name = { $regex: new RegExp(customerName, 'i') };
            }
            if (mobile) {
                customerFilter.mobile = { $regex: new RegExp(mobile, 'i') };
            }
            const matchedCustomers = await customers.find(customerFilter).select('_id');
            const customerIds = matchedCustomers.map(c => c._id);
            condition.customerId = { $in: customerIds };
        }

        // Filter by Date
        if (date) {
            const start = new Date(date);
            start.setHours(0, 0, 0, 0);

            const end = new Date(date);
            end.setHours(23, 59, 59, 999);

            condition.date = { $gte: start, $lte: end };
        }
        // Filter by Month-wise
        else if (month && year) {
            const numericMonth = parseInt(month);
            const numericYear = parseInt(year);
            const start = new Date(numericYear, numericMonth - 1, 1);
            const end = new Date(numericYear, numericMonth, 0, 23, 59, 59, 999);

            condition.date = { $gte: start, $lte: end };
        }

        console.log(condition)
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const aggregateCondition = { ...condition };
        if (aggregateCondition.user_id) {
            aggregateCondition.user_id = new mongoose.Types.ObjectId(req.user.id);
        }

        const [items, total, sumResult] = await Promise.all([
            orders.find(condition).skip(skip).limit(parseInt(limit)).populate('customerId').sort({ date: -1 }),
            orders.countDocuments(condition),
            orders.aggregate([
                { $match: aggregateCondition },
                { $group: { _id: null, totalAmount: { $sum: "$billAmount" } } }
            ])
        ])

        const overallTotalAmount = sumResult[0]?.totalAmount || 0;

        return res.status(200).json({
            data: items,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
                overallTotalAmount
            }
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
        const _id = req.params.id
        console.log(248, _id)
        const item = await orders.findOne({ _id: _id }).populate('customerId')
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

const deleteOrder = async (req, res, next) => {
    try {
        if (req.user && req.user.role === 'employee') {
            return res.status(403).json({
                message: 'Employees are not authorized to delete orders.'
            });
        }
        const _id = req.query.id
        const item = await orders.findOne(_id)
        if (!item) {
            return res.status(404).json({
                message: 'Order not found'
            })
        }
        const deleted = await item.deleteOne()
        return res.status(200).json({
            message: "Order deleted successfully",
            data: deleted
        })
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            data: err?.message
        })
    }
}

const overallsearch = async (req, res) => {
    const { search } = req.body;

    try {
        const results = await orders.findOne({
            // bill: { $regex: new RegExp(search, 'i') } // case-insensitive partial match
            bill: Number(search)
        });

        res.json({ success: true, data: results });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}

const bulkUpdate = async (req, res) => {
    try {
        const { orderIds, status } = req.body
        console.log(orderIds, status)
        const ids = orderIds.map(id => new mongoose.Types.ObjectId(id))
        const updateFields = { status: status };
        if (status === 'delivered') {
            updateFields.deliveredAt = new Date();
        } else if (status === 'order_taken') {
            updateFields.orderTakenAt = new Date();
        }
        const result = await orders.updateMany({ _id: { $in: ids } }, { $set: updateFields })

        if (!['confirm', 'delivered'].includes(status)) {
            await orders.updateMany(
                { _id: { $in: ids }, $or: [{ processingStartTime: { $exists: false } }, { processingStartTime: null }] },
                { $set: { processingStartTime: new Date() } }
            );
        }

        return res.status(200).json({
            message: "Orders updated successfully",
            matchedCount: result.matchedCount,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
}

// const generateInvoice = async (req, res) => {
//     try {
//         // import fs from "fs";
//         // import puppeteer from "puppeteer";

//         // async function generateInvoice() {
//         const html = fs.readFileSync("./invoice.html", "utf8");

//         const items = [
//             { name: "Shirt", qty: 5, price: 25 },
//             { name: "Pant", qty: 3, price: 30 },
//             { name: "Bed Sheet", qty: 2, price: 40 },
//         ];

//         const itemsHTML = items
//             .map(
//                 (item, index) => `
//     <tr>
//       <td>${index + 1}</td>
//       <td>${item.name}</td>
//       <td>${item.qty}</td>
//       <td>${item.price}</td>
//       <td>${item.qty * item.price}</td>
//     </tr>
//   `
//             )
//             .join("");

//         let output = html
//             .replace("{{shopName}}", "ROYAL DRY CLEAN")
//             .replace("{{shopAddress}}", "No. 12, Anna Nagar, Madurai – 625020")
//             .replace("{{shopPhone}}", "+91 98765 43210")
//             .replace("{{invoiceNo}}", "INV-02456")
//             .replace("{{date}}", "09-Feb-2025")
//             .replace("{{orderNo}}", "ORD-04521")
//             .replace("{{deliveryDate}}", "12-Feb-2025")
//             .replace("{{customerName}}", "Ravi Kumar")
//             .replace("{{customerMobile}}", "9876543210")
//             .replace("{{customerAddress}}", "Anna Nagar, Madurai")
//             .replace("{{items}}", itemsHTML)
//             .replace("{{subtotal}}", "295")
//             .replace("{{discount}}", "20")
//             .replace("{{finalTotal}}", "275")
//             .replace("{{paymentStatus}}", "Paid")
//             .replace("{{paymentMode}}", "UPI");

//         const browser = await puppeteer.launch({
//             headless: "new",
//             args: ["--no-sandbox", "--disable-setuid-sandbox"],
//         });
//         const page = await browser.newPage();

//         await page.setContent(output, { waitUntil: "networkidle0" });

//         await page.pdf({
//             path: "invoice.pdf",
//             format: "A4",
//             printBackground: true,
//         });

//         await browser.close();
//         res.setHeader("Content-Type", "application/pdf");
//         res.setHeader("Content-Disposition", `attachment; filename=invoice_${invoice.id}.pdf`);
//         console.log("Invoice generated: invoice.pdf");
//     }

// generateInvoice();

// }
// }
async function generateInvoicePuppeteer(order, customer, business) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    const html = invoiceTemplate.invoiceHTML(order, customer, business);
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfPath = path.join(__dirname, `invoice-${order.bill}.pdf`);

    await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true
    });

    await browser.close();
    return pdfPath;
}

const generateInvoice = async (req, res) => {
    try {
        const order = await orders.findById(req.params.id).populate('customerId');
        if (!order) return res.status(404).json({ message: "Order not found" });

        // const customer = await customers.findOne();
        const customer = order.customerId
        const business = await businessModel.find({ user_id: req.user.id })
        console.log(business)

        const pdfPath = await generateInvoicePuppeteer(order, customer, business[0]);

        return res.download(pdfPath, `invoice-${order.bill}.pdf`, () => {
            fs.unlinkSync(pdfPath); // auto delete after download
        });

    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
}

const getDashboardMetrics = async (req, res, next) => {
    try {
        const userId = req.user.id;

        // Define date range for today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        // Define date range for this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        // Fetch counts/sums
        const [
            todayOrdersCount,
            activeOrdersCount,
            monthlyRevenueResult,
            todayRevenueResult
        ] = await Promise.all([
            // 1. Today Orders Count
            orders.countDocuments({
                user_id: userId,
                createdAt: { $gte: startOfToday, $lte: endOfToday }
            }),
            // 2. Active Orders Count (not delivered)
            orders.countDocuments({
                user_id: userId,
                status: { $ne: 'delivered' }
            }),
            // 3. Monthly Revenue
            orders.aggregate([
                {
                    $match: {
                        user_id: new mongoose.Types.ObjectId(userId),
                        createdAt: { $gte: startOfMonth, $lte: endOfToday }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$billAmount' }
                    }
                }
            ]),
            // 4. Today Revenue
            orders.aggregate([
                {
                    $match: {
                        user_id: new mongoose.Types.ObjectId(userId),
                        createdAt: { $gte: startOfToday, $lte: endOfToday }
                    }
                },
                {
                    $group: {
                        _id: null,
                        totalRevenue: { $sum: '$billAmount' }
                    }
                }
            ])
        ]);

        const todayRevenue = todayRevenueResult[0]?.totalRevenue || 0;
        const monthlyRevenue = monthlyRevenueResult[0]?.totalRevenue || 0;

        // Fetch today's expenses
        const expenseModel = require('../../models/expenseModel');
        const todayExpensesResult = await expenseModel.aggregate([
            {
                $match: {
                    user_id: new mongoose.Types.ObjectId(userId),
                    createdAt: { $gte: startOfToday, $lte: endOfToday }
                }
            },
            {
                $project: {
                    totalCost: { $multiply: ["$quantity", "$unitprice"] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalExpenses: { $sum: "$totalCost" }
                }
            }
        ]);
        const todayExpenses = todayExpensesResult[0]?.totalExpenses || 0;

        // Fetch status summaries for all workflows
        const statusSummary = await orders.aggregate([
            { $match: { user_id: new mongoose.Types.ObjectId(userId) } },
            { $group: { _id: "$status", count: { $sum: 1 } } }
        ]);

        // Transform statusSummary array to key-value counts
        const statusCounts = {};
        statusSummary.forEach(s => {
            if (s._id) {
                statusCounts[s._id] = s.count;
            }
        });

        // Fetch Today's Deliverable Orders
        const todayDeliveries = await orders.find({
            user_id: userId,
            dueDate: { $gte: startOfToday, $lte: endOfToday }
        }).populate('customerId');

        return res.status(200).json({
            todayOrdersCount,
            activeOrdersCount,
            monthlyRevenue,
            todayRevenue,
            todayExpenses,
            statusCounts,
            todayDeliveries
        });
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            error: err.message
        });
    }
};

const barcodeUpdate = async (req, res, next) => {
    try {
        const { bill, status } = req.body;
        if (!bill) {
            return res.status(400).json({ message: "Barcode/Bill number is required" });
        }

        const order = await orders.findOne({ bill }).populate('customerId');
        if (!order) {
            return res.status(404).json({ message: "Order not found with this barcode/bill number" });
        }

        const Business = require('../../models/businessModel');
        const business = await Business.findOne({ user_id: order.user_id });
        let workflows = [];
        if (business && business.workflowEnabled && business.workflows && business.workflows.length > 0) {
            workflows = business.workflows;
        } else {
            workflows = [
                { name: "Washing", indentifier: "washing" },
                { name: "Ironing", indentifier: "ironing" },
                { name: "Folding", indentifier: "folding" },
                { name: "Packing", indentifier: "packing" }
            ];
        }

        let nextStatus = status;
        if (!nextStatus || nextStatus === 'next') {
            const currentIndex = workflows.findIndex(w => w.indentifier === order.status);
            if (currentIndex === -1) {
                nextStatus = workflows[0].indentifier;
            } else if (currentIndex < workflows.length - 1) {
                nextStatus = workflows[currentIndex + 1].indentifier;
            } else {
                nextStatus = 'delivered'; // Finish transition
            }
        }

        order.status = nextStatus;
        if (!['confirm', 'delivered'].includes(nextStatus) && !order.processingStartTime) {
            order.processingStartTime = new Date();
        }
        order.date = new Date();
        await order.save();

        return res.status(200).json({
            message: `Order status updated to ${nextStatus} successfully`,
            data: order
        });
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            error: err.message
        });
    }
};

const recordPayment = async (req, res) => {
    try {
        const { orderId, paymentMethod, paidAmount, discount } = req.body;

        if (!orderId || !paymentMethod || paidAmount == null) {
            return res.status(400).json({ message: 'orderId, paymentMethod and paidAmount are required' });
        }

        const orderDoc = await orders.findById(orderId).populate('customerId');
        if (!orderDoc) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const discountAmt = parseFloat(discount) || 0;
        const paid = parseFloat(paidAmount) || 0;
        const finalBill = orderDoc.billAmount - discountAmt;

        let paymentStatus = 'unpaid';
        if (paid >= finalBill) {
            paymentStatus = 'paid';
        } else if (paid > 0) {
            paymentStatus = 'partial';
        }

        await orders.findByIdAndUpdate(orderId, {
            $set: {
                paymentStatus,
                paymentMethod,
                paidAmount: paid,
                discount: discountAmt
            }
        });

        const updated = await orders.findById(orderId).populate('customerId');
        return res.status(200).json({
            message: 'Payment recorded successfully',
            data: updated
        });
    } catch (err) {
        return res.status(500).json({
            message: 'Something went wrong',
            error: err.message
        });
    }
};

const createPaymentLink = async (req, res) => {
    try {
        const orderId = req.body.orderId || req.body.id || req.params.id;
        if (!orderId) {
            return res.status(400).json({ status: false, message: 'orderId is required' });
        }

        const orderDoc = await orders.findById(orderId).populate('customerId');
        if (!orderDoc) {
            return res.status(404).json({ status: false, message: 'Order not found' });
        }

        const orderUserId = orderDoc.user_id || req.user?.id;
        let adminUser = null;
        let businessDoc = null;
        if (orderUserId) {
            const orderUserDoc = await require('../../models/usersModel').findById(orderUserId);
            const adminId = orderUserDoc?.role === 'employee' ? (orderUserDoc.admin_id || orderUserId) : orderUserId;
            adminUser = await require('../../models/usersModel').findById(adminId);
            businessDoc = await businessModel.findOne({ user_id: adminId });
        }

        const discountAmt = parseFloat(orderDoc.discount) || 0;
        const paid = parseFloat(orderDoc.paidAmount) || 0;
        const finalAmount = Math.max(0, orderDoc.billAmount - discountAmt);
        const balanceDue = Math.max(0, finalAmount - paid);

        if (balanceDue <= 0 || orderDoc.paymentStatus === 'paid') {
            return res.status(200).json({
                status: true,
                message: 'Order is already fully paid',
                data: {
                    paymentLinkId: orderDoc.razorpayPaymentLinkId || 'paid',
                    short_url: orderDoc.razorpayPaymentLinkUrl || '',
                    status: 'paid',
                    order: orderDoc
                }
            });
        }

        const amountInPaise = Math.round(balanceDue * 100);
        const customerName = orderDoc.customerId?.name || 'Customer';
        const customerEmail = orderDoc.customerId?.email || 'customer@laundry.local';
        const customerPhone = orderDoc.customerId?.mobile || orderDoc.customerId?.phone || '9999999999';

        const keyId = businessDoc?.razorpay_key_id || adminUser?.razorpay_key_id;
        const keySecret = businessDoc?.razorpay_key_secret || adminUser?.razorpay_key_secret;

        if (!keyId || !keySecret || keyId.includes('placeholder') || keyId === 'rzp_test_placeholder_key') {
            return res.status(400).json({
                status: false,
                requiresRazorpayKeys: true,
                message: "Please add your store's Razorpay API Key ID and Key Secret in Application Settings before generating online payment requests and links."
            });
        }

        const isPlaceholderKey = false;

        let paymentLinkId = null;
        let shortUrl = null;
        let linkStatus = 'created';
        let mockMode = false;

        try {
            const razorpay = getRazorpayInstance(keyId, keySecret);
            const linkPayload = {
                amount: amountInPaise,
                currency: 'INR',
                accept_partial: false,
                description: `Payment for Laundry Bill #${orderDoc.bill || orderDoc._id}`,
                customer: {
                    name: customerName,
                    email: customerEmail,
                    contact: customerPhone
                },
                notify: {
                    sms: false,
                    email: false
                },
                reminder_enable: true,
                notes: {
                    orderId: orderDoc._id.toString(),
                    bill: orderDoc.bill || ''
                }
            };

            const createdLink = await razorpay.paymentLink.create(linkPayload);
            paymentLinkId = createdLink.id;
            shortUrl = createdLink.short_url;
            linkStatus = createdLink.status;
        } catch (rzpErr) {
            console.error('Razorpay paymentLink.create failed:', rzpErr);
            const errMsg = rzpErr.error?.description || rzpErr.message || 'Razorpay API rejected the request with your configured API keys.';
            return res.status(400).json({
                status: false,
                message: `Razorpay Error: ${errMsg}. Please verify your Key ID and Key Secret in Application Settings.`
            });
        }

        orderDoc.razorpayPaymentLinkId = paymentLinkId;
        orderDoc.razorpayPaymentLinkUrl = shortUrl;
        orderDoc.razorpayPaymentLinkStatus = linkStatus;
        await orderDoc.save();

        return res.status(200).json({
            status: true,
            message: mockMode ? 'Payment Link generated successfully (Demo/Sandbox Mode)' : 'Payment Link created via Razorpay',
            data: {
                paymentLinkId,
                short_url: shortUrl,
                status: linkStatus,
                mockMode,
                order: orderDoc
            }
        });
    } catch (err) {
        console.error('Error creating payment link:', err);
        return res.status(500).json({
            status: false,
            message: 'Error creating payment link: ' + (err.message || err)
        });
    }
};

const checkPaymentLinkStatus = async (req, res) => {
    try {
        const orderId = req.params.id || req.body.orderId || req.body.id;
        if (!orderId) {
            return res.status(400).json({ status: false, message: 'orderId is required' });
        }

        const orderDoc = await orders.findById(orderId).populate('customerId');
        if (!orderDoc) {
            return res.status(404).json({ status: false, message: 'Order not found' });
        }

        if (orderDoc.paymentStatus === 'paid') {
            return res.status(200).json({
                status: true,
                paid: true,
                message: 'Order is paid',
                data: orderDoc
            });
        }

        const plinkId = orderDoc.razorpayPaymentLinkId;
        if (!plinkId) {
            return res.status(200).json({
                status: true,
                paid: false,
                message: 'No payment link generated for this order yet',
                data: orderDoc
            });
        }

        if (plinkId.startsWith('plink_mock_')) {
            const isPaid = orderDoc.razorpayPaymentLinkStatus === 'paid' || orderDoc.paymentStatus === 'paid';
            return res.status(200).json({
                status: true,
                paid: isPaid,
                message: isPaid ? 'Order paid via demo link' : 'Pending demo payment',
                data: orderDoc
            });
        }

        try {
            const orderUserId = orderDoc.user_id;
            let keyId = process.env.RAZORPAY_KEY_ID;
            let keySecret = process.env.RAZORPAY_KEY_SECRET;
            if (orderUserId) {
                const orderUserDoc = await require('../../models/usersModel').findById(orderUserId);
                const adminId = orderUserDoc?.role === 'employee' ? (orderUserDoc.admin_id || orderUserId) : orderUserId;
                const adminUser = await require('../../models/usersModel').findById(adminId);
                const businessDoc = await businessModel.findOne({ user_id: adminId });
                if (businessDoc?.razorpay_key_id || adminUser?.razorpay_key_id) {
                    keyId = businessDoc?.razorpay_key_id || adminUser?.razorpay_key_id;
                    keySecret = businessDoc?.razorpay_key_secret || adminUser?.razorpay_key_secret;
                }
            }
            const razorpay = getRazorpayInstance(keyId, keySecret);
            const rzpLink = await razorpay.paymentLink.fetch(plinkId);
            if (rzpLink.status === 'paid' && orderDoc.paymentStatus !== 'paid') {
                const discountAmt = parseFloat(orderDoc.discount) || 0;
                const finalAmount = Math.max(0, orderDoc.billAmount - discountAmt);

                orderDoc.paymentStatus = 'paid';
                orderDoc.paidAmount = finalAmount;
                orderDoc.paymentMethod = 'payment_link';
                orderDoc.razorpayPaymentLinkStatus = 'paid';
                await orderDoc.save();

                return res.status(200).json({
                    status: true,
                    paid: true,
                    message: 'Payment verified and order marked as paid!',
                    data: orderDoc
                });
            }

            return res.status(200).json({
                status: true,
                paid: rzpLink.status === 'paid',
                linkStatus: rzpLink.status,
                data: orderDoc
            });
        } catch (fetchErr) {
            console.error('Error fetching Razorpay link status:', fetchErr);
            return res.status(200).json({
                status: true,
                paid: false,
                message: 'Unable to check live Razorpay link right now',
                data: orderDoc
            });
        }
    } catch (err) {
        console.error('Error in checkPaymentLinkStatus:', err);
        return res.status(500).json({ status: false, message: err.message || 'Server error' });
    }
};

const simulateLinkPayment = async (req, res) => {
    try {
        const orderId = req.params.id || req.body.orderId || req.body.id;
        if (!orderId) {
            return res.status(400).json({ status: false, message: 'orderId is required' });
        }

        const orderDoc = await orders.findById(orderId).populate('customerId');
        if (!orderDoc) {
            return res.status(404).json({ status: false, message: 'Order not found' });
        }

        const discountAmt = parseFloat(orderDoc.discount) || 0;
        const finalAmount = Math.max(0, orderDoc.billAmount - discountAmt);

        orderDoc.paymentStatus = 'paid';
        orderDoc.paidAmount = finalAmount;
        orderDoc.paymentMethod = 'payment_link';
        orderDoc.razorpayPaymentLinkStatus = 'paid';
        await orderDoc.save();

        return res.status(200).json({
            status: true,
            message: 'Payment simulated successfully. Order is now PAID!',
            data: orderDoc
        });
    } catch (err) {
        console.error('Error simulating payment:', err);
        return res.status(500).json({ status: false, message: err.message || 'Server error' });
    }
};

const razorpayWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers['x-razorpay-signature'];

        if (webhookSecret && webhookSecret !== 'your_webhook_secret_here' && signature) {
            const expectedSignature = crypto.createHmac('sha256', webhookSecret)
                .update(JSON.stringify(req.body))
                .digest('hex');
            if (expectedSignature !== signature) {
                console.warn('Invalid Razorpay Webhook Signature received');
                return res.status(400).json({ status: false, message: 'Invalid signature' });
            }
        }

        const event = req.body?.event;
        const payload = req.body?.payload;

        if (event === 'payment_link.paid' || event === 'payment_link.updated') {
            const plink = payload?.payment_link?.entity;
            if (plink && plink.status === 'paid') {
                const plinkId = plink.id;
                const notesOrderId = plink.notes?.orderId;

                let orderDoc = null;
                if (notesOrderId) {
                    orderDoc = await orders.findById(notesOrderId).populate('customerId');
                }
                if (!orderDoc && plinkId) {
                    orderDoc = await orders.findOne({ razorpayPaymentLinkId: plinkId }).populate('customerId');
                }

                if (orderDoc && orderDoc.paymentStatus !== 'paid') {
                    const discountAmt = parseFloat(orderDoc.discount) || 0;
                    const finalAmount = Math.max(0, orderDoc.billAmount - discountAmt);

                    orderDoc.paymentStatus = 'paid';
                    orderDoc.paidAmount = finalAmount;
                    orderDoc.paymentMethod = 'payment_link';
                    orderDoc.razorpayPaymentLinkStatus = 'paid';
                    await orderDoc.save();
                    console.log(`Webhook processed: Order #${orderDoc.bill || orderDoc._id} automatically marked as PAID via payment_link.paid event.`);
                }
            }
        } else if (event === 'order.paid' || event === 'payment.authorized' || event === 'payment.captured') {
            const entity = payload?.payment?.entity || payload?.order?.entity;
            const notesOrderId = entity?.notes?.orderId;
            if (notesOrderId) {
                const orderDoc = await orders.findById(notesOrderId).populate('customerId');
                if (orderDoc && orderDoc.paymentStatus !== 'paid') {
                    const discountAmt = parseFloat(orderDoc.discount) || 0;
                    const finalAmount = Math.max(0, orderDoc.billAmount - discountAmt);

                    orderDoc.paymentStatus = 'paid';
                    orderDoc.paidAmount = finalAmount;
                    orderDoc.paymentMethod = 'payment_link';
                    orderDoc.razorpayPaymentLinkStatus = 'paid';
                    await orderDoc.save();
                    console.log(`Webhook processed: Order #${orderDoc.bill || orderDoc._id} automatically marked as PAID via ${event}.`);
                }
            }
        }

        return res.status(200).json({ status: true });
    } catch (err) {
        console.error('Error handling Razorpay webhook:', err);
        return res.status(500).json({ status: false, message: 'Webhook handler error' });
    }
};

const renderCustomerPaymentPage = async (req, res) => {
    try {
        const orderId = req.params.id;
        const orderDoc = await orders.findById(orderId).populate('customerId');
        if (!orderDoc) {
            return res.status(404).send('<h1 style="color:white;text-align:center;font-family:sans-serif;margin-top:20%">Order not found</h1>');
        }

        const customer = orderDoc.customerId || {};
        const discountAmt = parseFloat(orderDoc.discount) || 0;
        const finalAmount = Math.max(0, orderDoc.billAmount - discountAmt);
        const isPaid = orderDoc.paymentStatus === 'paid';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Express Laundry - Payment Checkout #${orderDoc.bill || orderId}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Outfit', sans-serif; }
        body {
            background: radial-gradient(circle at top right, #311042, #09090b);
            color: #f4f4f5;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .checkout-card {
            background: rgba(24, 24, 27, 0.85);
            backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 24px;
            width: 100%;
            max-width: 480px;
            padding: 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6);
            position: relative;
            overflow: hidden;
        }
        .header {
            text-align: center;
            margin-bottom: 24px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            padding-bottom: 20px;
        }
        .brand-badge {
            background: linear-gradient(135deg, #a855f7, #6366f1);
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 6px 14px;
            border-radius: 100px;
            text-transform: uppercase;
            letter-spacing: 1px;
            display: inline-block;
            margin-bottom: 12px;
            box-shadow: 0 4px 15px rgba(168, 85, 247, 0.3);
        }
        .header h1 { font-size: 26px; font-weight: 700; color: #fff; margin-bottom: 4px; }
        .header p { color: #a1a1aa; font-size: 14px; }
        .info-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 0;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
            font-size: 15px;
        }
        .info-label { color: #a1a1aa; font-weight: 500; }
        .info-value { font-weight: 600; color: #e4e4e7; }
        .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 20px 0;
            padding: 16px;
            background: rgba(168, 85, 247, 0.1);
            border: 1px solid rgba(168, 85, 247, 0.2);
            border-radius: 16px;
        }
        .total-row .label { font-size: 16px; font-weight: 600; color: #c084fc; }
        .total-row .amount { font-size: 28px; font-weight: 700; color: #fff; }
        .pay-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
            border: none;
            border-radius: 16px;
            font-size: 18px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }
        .pay-btn:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(16, 185, 129, 0.4); }
        .pay-btn:disabled { background: #3f3f46; cursor: not-allowed; box-shadow: none; transform: none; }
        .paid-banner {
            background: linear-gradient(135deg, #10b981, #047857);
            color: white;
            text-align: center;
            padding: 20px;
            border-radius: 16px;
            font-size: 20px;
            font-weight: 700;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 8px;
            box-shadow: 0 10px 25px rgba(16, 185, 129, 0.3);
        }
        .methods {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
        }
        .method-item {
            flex: 1;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 12px;
            border-radius: 12px;
            text-align: center;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .method-item.active {
            border-color: #a855f7;
            background: rgba(168, 85, 247, 0.15);
            color: #fff;
        }
        .footer-note {
            text-align: center;
            font-size: 12px;
            color: #71717a;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="checkout-card">
        <div class="header">
            <span class="brand-badge">✨ Express Laundry Service</span>
            <h1>Bill Payment Request</h1>
            <p>Invoice #${orderDoc.bill || orderId}</p>
        </div>

        <div class="info-row">
            <span class="info-label">Customer Name</span>
            <span class="info-value">${customer.name || 'Valued Customer'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Contact Number</span>
            <span class="info-value">${customer.mobile || customer.phone || 'N/A'}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Order Type / Items</span>
            <span class="info-value">${orderDoc.items?.length || 1} Item(s) (${orderDoc.type || 'item'})</span>
        </div>
        <div class="info-row">
            <span class="info-label">Current Status</span>
            <span class="info-value" style="color: #60a5fa; text-transform: capitalize;">${orderDoc.status || 'Processing'}</span>
        </div>

        <div class="total-row">
            <span class="label">Balance Amount Due</span>
            <span class="amount">₹${finalAmount.toFixed(2)}</span>
        </div>

        <div id="payment-section">
            ${isPaid ? `
                <div class="paid-banner">
                    <span style="font-size:36px">🎉</span>
                    <span>Order Paid in Full!</span>
                    <span style="font-size:13px; font-weight:500; opacity:0.9">Thank you for choosing Express Laundry</span>
                </div>
            ` : `
                <div style="font-size:13px; color:#a1a1aa; margin-bottom:10px; font-weight:600">Select Payment Method:</div>
                <div class="methods">
                    <div class="method-item active" onclick="selectMethod(this, 'UPI')">⚡ UPI (GPay/PhonePe)</div>
                    <div class="method-item" onclick="selectMethod(this, 'Card')">💳 Debit/Credit Card</div>
                    <div class="method-item" onclick="selectMethod(this, 'NetBanking')">🏦 NetBanking</div>
                </div>
                <button class="pay-btn" id="pay-button" onclick="payNow()">
                    <span>🔒 Pay ₹${finalAmount.toFixed(2)} Securely</span>
                </button>
            `}
        </div>

        <div class="footer-note">
            🛡️ 256-bit Encrypted Payment • Powered by Razorpay Secure Gateway
        </div>
    </div>

    <script>
        let selectedMethod = 'UPI';
        function selectMethod(el, method) {
            document.querySelectorAll('.method-item').forEach(i => i.classList.remove('active'));
            el.classList.add('active');
            selectedMethod = method;
        }

        async function payNow() {
            const btn = document.getElementById('pay-button');
            btn.disabled = true;
            btn.innerHTML = '<span>⏳ Processing Payment via ' + selectedMethod + '...</span>';

            try {
                const res = await fetch('/order/simulate-link-payment', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderId: '${orderId}' })
                });
                const data = await res.json();
                if (data.status) {
                    document.getElementById('payment-section').innerHTML = \`
                        <div class="paid-banner">
                            <span style="font-size:36px">🎉</span>
                            <span>Payment Successful!</span>
                            <span style="font-size:13px; font-weight:500; opacity:0.9">Your order has been updated automatically to PAID.</span>
                        </div>
                    \`;
                } else {
                    alert('Payment processing error: ' + (data.message || 'Unknown error'));
                    btn.disabled = false;
                    btn.innerHTML = '<span>🔒 Pay ₹${finalAmount.toFixed(2)} Securely</span>';
                }
            } catch (err) {
                alert('Connection error while submitting payment.');
                btn.disabled = false;
                btn.innerHTML = '<span>🔒 Pay ₹${finalAmount.toFixed(2)} Securely</span>';
            }
        }
    </script>
</body>
</html>`;
        return res.send(html);
    } catch (err) {
        console.error('Error rendering customer payment page:', err);
        return res.status(500).send('Server Error');
    }
};


const updateOrderServiceStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { serviceId, status } = req.body;

        if (!serviceId || !status) {
            return res.status(400).json({ message: "serviceId and status are required" });
        }

        const order = await orders.findOne({ _id: id, user_id: req.user.id });
        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const serviceIndex = order.services.findIndex(s => s.serviceId.toString() === serviceId.toString());
        if (serviceIndex === -1) {
            return res.status(404).json({ message: "Service not found on this order" });
        }

        order.services[serviceIndex].status = status;
        order.services[serviceIndex].completedAt = new Date();

        // Check if all services are completed
        const allCompleted = order.services.every(s => s.status === 'completed');
        if (allCompleted) {
            if (order.deliverytype === 'DD') {
                order.status = 'deliver';
            } else {
                order.status = 'pickup';
            }
        }

        await order.save();

        const updatedOrder = await orders.findById(id).populate('customerId');

        return res.status(200).json({
            message: "Service status updated successfully",
            data: updatedOrder
        });
    } catch (err) {
        return res.status(500).json({
            message: "Something went wrong",
            error: err.message
        });
    }
};

async function generateTagsPuppeteer(order, customer, business, options) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    const html = tagTemplate.tagHTML(order, customer, business, options);
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfPath = path.join(__dirname, `tags-${order.bill || order._id}.pdf`);
    await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true
    });

    await browser.close();
    return pdfPath;
}

const generateGarmentTags = async (req, res) => {
    try {
        const order = await orders.findById(req.params.id).populate('customerId');
        if (!order) return res.status(404).json({ message: "Order not found" });

        const customer = order.customerId;
        const business = await businessModel.find({ user_id: req.user.id });
        const options = req.body || {};

        const pdfPath = await generateTagsPuppeteer(order, customer, business[0] || {}, options);

        return res.download(pdfPath, `tags-${order.bill || order._id}.pdf`, () => {
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

async function generateThermalBillPuppeteer(order, customer, business, options) {
    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    const html = thermalInvoiceTemplate.thermalInvoiceHTML(order, customer, business, options);
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfPath = path.join(__dirname, `thermal-bill-${order.bill || order._id}.pdf`);
    await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true
    });

    await browser.close();
    return pdfPath;
}

const generateThermalInvoice = async (req, res) => {
    try {
        const order = await orders.findById(req.params.id).populate('customerId');
        if (!order) return res.status(404).json({ message: "Order not found" });

        const customer = order.customerId;
        const business = await businessModel.find({ user_id: req.user.id });
        const options = req.body || {};

        const pdfPath = await generateThermalBillPuppeteer(order, customer, business[0] || {}, options);

        return res.download(pdfPath, `thermal-bill-${order.bill || order._id}.pdf`, () => {
            if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

module.exports = { createOrder, updateOrder, getAll, getById, deleteOrder, overallsearch, bulkUpdate, generateInvoice, getDashboardMetrics, barcodeUpdate, recordPayment, createPaymentLink, checkPaymentLinkStatus, simulateLinkPayment, razorpayWebhook, renderCustomerPaymentPage, updateOrderServiceStatus, generateGarmentTags, generateThermalInvoice }