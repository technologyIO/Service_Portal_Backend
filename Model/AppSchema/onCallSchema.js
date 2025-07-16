const mongoose = require('mongoose');

// Spare Part Schema
const sparePartSchema = new mongoose.Schema({
    PartNumber: String,
    Description: String,
    Type: String,
    Rate: Number,
    DP: Number,
    Charges: String,
    Image: String
}, { _id: false });

// Complaint Schema
const complaintSchema = new mongoose.Schema({
    notificationtype: String,
    notification_complaintid: String,
    notificationdate: String,
    userstatus: String,
    materialdescription: String,
    serialnumber: String,
    devicedata: String,
    salesoffice: String,
    materialcode: String,
    reportedproblem: String,
    dealercode: String,
    customercode: String,
    partnerresp: String,
    breakdown: Boolean,
    requesteupdate: Boolean,
    rev: Number,
    remark: String,
    sparerequest: String
}, { _id: false });

// Product Group Schema
const productGroupSchema = new mongoose.Schema({
    productPartNo: String,
    subgroup: String,
    totalSpares: Number,
    spares: [sparePartSchema],
    existingSpares: [sparePartSchema]
}, { _id: false });

// Customer Schema
const customerSchema = new mongoose.Schema({
    customercodeid: String,
    customername: String,
    city: String,
    postalcode: String,
    taxnumber1: String,
    taxnumber2: String,
    telephone: String,
    email: String
}, { _id: false });

// Approval Schema
const approvalSchema = new mongoose.Schema({
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
}, { _id: false });

// Revision Schema
const revisionSchema = new mongoose.Schema({
    revisionNumber: { type: Number, required: true },
    revisionDate: { type: Date, default: Date.now },
    status: { type: String, default: 'pending' },
    approvalHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvalType: { type: String, enum: ['RSH', 'NSH'] },
        remark: String
    }],
    changes: {
        discountPercentage: Number,
        discountAmount: { type: Number, min: [0, 'Discount cannot be negative'] },
        afterDiscount: { type: Number, min: [0, 'Value cannot be negative'] },
        tdsAmount: { type: Number, min: [0, 'TDS cannot be negative'] },
        afterTds: { type: Number, min: [0, 'Value cannot be negative'] },
        gstAmount: { type: Number, min: [0, 'GST cannot be negative'] },
        finalAmount: { type: Number, min: [0, 'Final Amount cannot be negative'] },
        remark: String
    }
}, { _id: false });

// OnCall Schema
const onCallSchema = new mongoose.Schema({
    customer: customerSchema,
    productGroups: [productGroupSchema],
    tdsPercentage: Number,
    discountPercentage: Number,
    gstPercentage: Number,
    remark: String,
    CoNumber: String,
    complaint: complaintSchema,
    grandSubTotal: { type: Number, min: [0, 'Subtotal cannot be negative'] },
    discountAmount: { type: Number, min: [0, 'Discount cannot be negative'] },
    afterDiscount: { type: Number, min: [0, 'Value cannot be negative'] },
    tdsAmount: { type: Number, min: [0, 'TDS cannot be negative'] },
    afterTds: { type: Number, min: [0, 'Value cannot be negative'] },
    gstAmount: { type: Number, min: [0, 'GST cannot be negative'] },
    finalAmount: { type: Number, min: [0, 'Final Amount cannot be negative'] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    status: { type: String, default: 'draft' },
    onCallNumber: { type: String, unique: true },
    currentRevision: { type: Number, default: 0 },
    revisions: [revisionSchema],
    createdBy: { type: String },
    statusHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    RSHApproval: {
        type: approvalSchema,
        default: () => ({ approved: false })
    },
    NSHApproval: {
        type: approvalSchema,
        default: () => ({ approved: false })
    }
});

// Middleware: Auto status update
onCallSchema.pre('save', async function (next) {
    if (!this.onCallNumber) {
        try {
            const year = new Date().getFullYear();

            // Find latest onCallNumber starting with this year
            const latest = await this.constructor
                .findOne({ onCallNumber: { $regex: `^ONCALL-${year}-` } })
                .sort({ onCallNumber: -1 })
                .select('onCallNumber')
                .lean();

            let nextNumber = 1;

            if (latest && latest.onCallNumber) {
                const lastPart = latest.onCallNumber.split('-').pop(); // get 00001
                const parsed = parseInt(lastPart, 10);
                if (!isNaN(parsed)) nextNumber = parsed + 1;
            }

            this.onCallNumber = `ONCALL-${year}-${String(nextNumber).padStart(5, '0')}`;
            next();
        } catch (err) {
            next(err);
        }
    } else {
        next();
    }
});


// ✅ New: Unique onCallNumber without Counter
onCallSchema.pre('save', async function (next) {
    if (!this.onCallNumber) {
        const year = new Date().getFullYear();
        const random = Math.floor(1000 + Math.random() * 9000); // random 4-digit
        const timestamp = Date.now().toString().slice(-5); // last 5 digits of ms timestamp
        this.onCallNumber = `ONCALL-${year}-${timestamp}${random}`;
    }
    next();
});

// Auto update updatedAt
onCallSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Indexes
onCallSchema.index({ 'customer.customername': 1 });
onCallSchema.index({ 'productGroups.productPartNo': 1 });
onCallSchema.index({ 'productGroups.spares.PartNumber': 1 });

module.exports = mongoose.model('OnCall', onCallSchema);
