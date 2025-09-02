const mongoose = require('mongoose');

const additionalServiceChargeSchema = new mongoose.Schema({
    totalAmount: { type: Number },
    location: { type: String, enum: ["withinCity", "outsideCity"] },
    gstAmount: { type: Number },
    enteredCharge: { type: Number }
}, { _id: false });

const sparePartSchema = new mongoose.Schema({
    PartNumber: String,
    Description: String,
    Type: String,
    Rate: Number,
    DP: Number,
    Charges: String,
    Image: String
}, { _id: false });

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
    breakdown: String,
    requesteupdate: Boolean,
    rev: Number,
    remark: String,
    sparerequest: String
}, { _id: false });

const productGroupSchema = new mongoose.Schema({
    productPartNo: String,
    subgroup: String,
    totalSpares: Number,
    spares: [sparePartSchema],
    existingSpares: [sparePartSchema]
}, { _id: false });

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

const approvalSchema = new mongoose.Schema({
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date
}, { _id: false });

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

const onCallSchema = new mongoose.Schema({
    customer: customerSchema,
    productGroups: [productGroupSchema],
    tdsPercentage: Number,
    discountPercentage: Number,
    gstPercentage: Number,
    remark: String,
    CoNumber: String,
    additionalServiceCharge: additionalServiceChargeSchema,
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
    onCallproposalstatus: { type: String, default: 'Open' },
    onCallNumber: { type: String, unique: true },
    proposalRemark: { type: String },
    // Only cnoteNumber field as you need
    cnoteNumber: { type: String, default: null },

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

// OnCall number generation if not exists
onCallSchema.pre('save', async function (next) {
    if (!this.onCallNumber) {
        try {
            const year = new Date().getFullYear();
            const latest = await this.constructor
                .findOne({ onCallNumber: { $regex: `^ONCALL-${year}-` } })
                .sort({ onCallNumber: -1 })
                .select('onCallNumber')
                .lean();
            let nextNumber = 1;
            if (latest && latest.onCallNumber) {
                const lastPart = latest.onCallNumber.split('-').pop();
                const parsed = parseInt(lastPart, 10);
                if (!isNaN(parsed)) nextNumber = parsed + 1;
            }
            this.onCallNumber = `ONCALL-${year}-${String(nextNumber).padStart(5, '0')}`;
        } catch (err) {
            return next(err);
        }
    }
    this.updatedAt = new Date();
    next();
});

// Auto update updatedAt on update
onCallSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Useful Indexes
onCallSchema.index({ 'customer.customername': 1 });
onCallSchema.index({ 'productGroups.productPartNo': 1 });
onCallSchema.index({ 'productGroups.spares.PartNumber': 1 });
onCallSchema.index({ cnoteNumber: 1 });

module.exports = mongoose.model('OnCall', onCallSchema);
