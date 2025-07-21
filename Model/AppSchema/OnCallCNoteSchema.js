// models/OnCallCNote.js
const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
});

const spareItemSchema = new mongoose.Schema({
    PartNumber: String,
    Description: String,
    Type: String,
    Rate: Number,
    DP: Number,
    Charges: String,
    Image: String,
    productPartNo: String,
    subgroup: String
});

const revisionSchema = new mongoose.Schema({
    changes: {
        discountPercentage: Number,
        discountAmount: Number,
        afterDiscount: Number,
        tdsAmount: Number,
        afterTds: Number,
        gstAmount: Number,
        finalAmount: Number,
        remark: String,
    },
    revisionNumber: Number,
    status: String,
    revisionDate: Date,
    approvalHistory: [{
        status: String,
        changedAt: Date,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvalType: String,
        remark: String,
    }],
});

const OnCallCNoteSchema = new mongoose.Schema({
    cnoteNumber: {
        type: String,
        required: true,
        unique: true
    },
    onCallNumber: {
        type: String,
        required: true
    },
    customer: {
        customercodeid: String,
        customername: String,
        city: String,
        postalcode: String,
        taxnumber1: String,
        taxnumber2: String,
        telephone: String,
        email: String,
    },
    complaint: {
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
    },
    spares: [spareItemSchema],
    additionalServiceCharge: {
        totalAmount: Number,
        location: String,
        gstAmount: Number,
        enteredCharge: Number
    },
    RSHApproval: approvalSchema,
    NSHApproval: approvalSchema,
    tdsPercentage: Number,
    discountPercentage: Number,
    gstPercentage: Number,
    remark: String,
    grandSubTotal: Number,
    discountAmount: Number,
    afterDiscount: Number,
    tdsAmount: Number,
    afterTds: Number,
    gstAmount: Number,
    finalAmount: Number,
    status: {
        type: String,
        enum: ['draft', 'issued', 'cancelled'],
        default: 'draft'
    },
    revisions: [revisionSchema],
    currentRevision: Number,
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    issuedAt: Date,
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

// Auto-generate OnCall CNote number before saving
OnCallCNoteSchema.pre('save', async function (next) {
    if (!this.cnoteNumber) {
        const year = new Date().getFullYear();
        const count = await this.constructor.countDocuments({});
        this.cnoteNumber = `OCN-${year}-${(count + 1).toString().padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('OnCallCNote', OnCallCNoteSchema);
