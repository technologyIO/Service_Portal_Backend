// models/CNote.js
const mongoose = require('mongoose');

const approvalSchema = new mongoose.Schema({
    approved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
});

const equipmentItemSchema = new mongoose.Schema({
    RSHApproval: approvalSchema,
    NSHApproval: approvalSchema,
    equipment: {
        name: String,
        materialcode: String,
        materialdescription: String,
        dealer: String,
        serialnumber: String,
        status: String,
    },
    warrantyType: String,
    years: Number,
    pricePerYear: Number,
    subtotal: Number,
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

const CNoteSchema = new mongoose.Schema({
    cnoteNumber: {
        type: String,
        required: true,
        unique: true
    }
    ,
    proposalNumber: {
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
    items: [equipmentItemSchema],
    tdsPercentage: Number,
    discountPercentage: Number,
    gstPercentage: Number,
    remark: String,
    serialNumber: String,
    grandSubTotal: Number,
    discountAmount: Number,
    afterDiscount: Number,
    tdsAmount: Number,
    afterTds: Number,
    gstAmount: Number,
    finalAmount: Number,
    pdfUrl: {
        type: String,
        default: null
    },
    pdfFileName: {
        type: String,
        default: null
    },
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
    createdBy: {
        type: String
    },
    issuedAt: Date,
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

// Auto-generate CNote number before saving
CNoteSchema.pre('save', async function (next) {
    if (!this.cnoteNumber) {
        const year = new Date().getFullYear();
        const count = await this.constructor.countDocuments({});
        this.cnoteNumber = `CN-${year}-${(count + 1).toString().padStart(5, '0')}`;
    }
    next();
});

module.exports = mongoose.model('CNote', CNoteSchema);