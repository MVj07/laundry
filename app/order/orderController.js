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
const generateBillNo = async (userId) => {
    const lastOrder = await orders
        .findOne({user_id: userId})
        .sort({ createdAt: -1 }) // or sort by bill_no
        .lean();

    let nextNumber = 1;
    console.log
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
        const billNo = await generateBillNo(userId);
        console.log(billNo)

        const orderPayload = {
            user_id: userId,
            items: data.items,
            // billAmount: data.bill,  // actual total amount
            status: data.status,
            date: new Date(data.date),
            bill: billNo,
            billAmount: data?.items?.reduce((sum, item)=>{
                return sum+(item.qty*item.amount);
            }, 0)
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
                kuri: data.kuri
            });
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

        const updateData = {}
        if (data?.items) updateData.items = data.items;
        if (data?.status) updateData.status = data.status

        const order = await orders.findOne({ customerId: customer._id, _id: data.orderId })
        if (!order) {
            return res.status(500).json({
                message: "Order not found"
            })
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
        const { search, page = 1, limit = 10 } = req.query;
        const condition = {}
        condition.user_id=req.user.id
        // if (req.query.status !== 'null') {
        //     condition.status = req.query.status
        // }
        // if (req.query.status==='track'){
        //     condition.status={$in: ['washing', 'ironing', 'packing', 'deliver']}
        // }

        // if (req.query.status=='all'){
        //     condition.status={$in: ['washing', 'ironing', 'packing', 'deliver', 'confirm']}
        // }
        
        console.log(condition)
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [items, total] = await Promise.all([orders.find(condition).skip(skip).limit(parseInt(limit)).populate('customerId').sort({ date: 1 }), orders.countDocuments(condition)])
        return res.status(200).json({
            data: items,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit))
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
        const _id = req.query.id
        const item = await orders.findOne(_id)
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
module.exports = { createOrder, updateOrder, getAll, getById, deleteOrder, overallsearch, bulkUpdate, generateInvoice }