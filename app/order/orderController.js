const orders = require('../../models/ordersModel')
const customers = require('../../models/customerModel')
const { default: mongoose } = require('mongoose');
const { default: puppeteer } = require('puppeteer');
const invoiceTemplate = require('../templates/invoiceTemplate');
const path = require("path");
const fs = require("fs");
const businessModel = require('../../models/businessModel');

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

        const orderPayload = {
            user_id: userId,
            items: data.items,
            type: data.type || 'item',
            status: data.status || 'confirm',
            date: new Date(data.date),
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            specialInstructions: data.specialInstructions || '',
            bill: billNo,
            billAmount: data?.items?.reduce((sum, item)=>{
                return sum + (parseFloat(item.qty || 0) * parseFloat(item.amount || 0));
            }, 0),
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

        return res.status(200).json({
            message: "Order created successfully",
            data: newOrder
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
        if (data?.items) {
            updateData.items = data.items;
            updateData.billAmount = data.items.reduce((sum, item)=>{
                return sum + (parseFloat(item.qty || 0) * parseFloat(item.amount || 0));
            }, 0);
        }
        if (data?.status) updateData.status = data.status;
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
                    status: existing ? existing.status : 'pending'
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
            condition.status = { $nin: ['confirm', 'delivered'] };
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
        const item = await orders.findOne({_id:_id}).populate('customerId')
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
        const result = await orders.updateMany({ _id: { $in: ids } }, { $set: { status: status } })
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
        const customer=order.customerId
        const business = await businessModel.find({user_id: req.user.id})
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

module.exports = { createOrder, updateOrder, getAll, getById, deleteOrder, overallsearch, bulkUpdate, generateInvoice, getDashboardMetrics, barcodeUpdate, recordPayment, updateOrderServiceStatus }