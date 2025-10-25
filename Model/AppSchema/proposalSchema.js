const mongoose = require('mongoose');

// Counter Schema (inline)
const counterSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    value: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

// Equipment Schema
const equipmentSchema = new mongoose.Schema({
    name: String,
    materialcode: String,
    materialdescription: String,
    dealer: String,
    serialnumber: String,
    status: { type: String, default: 'Pending' }
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

// Item Selection Schema
const itemSelectionSchema = new mongoose.Schema({
    equipment: equipmentSchema,
    warrantyType: { type: String, enum: ['CMC', 'NCMC', 'None'] },
    years: Number,
    pricePerYear: Number,
    subtotal: { type: Number, min: [0, 'Subtotal cannot be negative'] },
    RSHApproval: {
        approved: { type: Boolean, default: false },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: Date
    },
    NSHApproval: {
        approved: { type: Boolean, default: false },
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: Date
    }
}, { _id: true });

// Revision Schema
const revisionSchema = new mongoose.Schema({
    revisionNumber: { type: Number, required: true },
    revisionDate: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
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

// Proposal Schema
const proposalSchema = new mongoose.Schema({
    customer: customerSchema,
    items: [itemSelectionSchema],
    tdsPercentage: Number,
    discountPercentage: Number,
    gstPercentage: Number,
    remark: String,
    CoNumber: String,
    serialNumber: String,
    cnoteNumber: { type: String, default: null },
    pdfUrl: { type: String, default: null },
    pdfFileName: { type: String, default: null },

    grandSubTotal: { type: Number, min: [0, 'Subtotal cannot be negative'] },
    discountAmount: { type: Number, min: [0, 'Discount cannot be negative'] },
    afterDiscount: { type: Number, min: [0, 'Value cannot be negative'] },
    tdsAmount: { type: Number, min: [0, 'TDS cannot be negative'] },
    afterTds: { type: Number, min: [0, 'Value cannot be negative'] },
    gstAmount: { type: Number, min: [0, 'GST cannot be negative'] },
    finalAmount: { type: Number, min: [0, 'Final Amount cannot be negative'] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['draft', 'submitted', 'approved', 'completed', 'rejected', 'revised'],
        default: 'draft'
    },
    Cmcncmcsostatus: {
        type: String,
        default: 'Open'
    },
    proposalRemark: { type: String },
    proposalNumber: { type: String, unique: true },
    currentRevision: { type: Number, default: 0 },
    revisions: [revisionSchema],
    createdBy: { type: String },
    updatedBy: { type: String },
    statusHistory: [{
        status: String,
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }]
});

// Approval status auto-update
proposalSchema.pre('save', function (next) {
    if (this.isModified('items') || this.isModified('discountPercentage')) {
        const requiresNSHApproval = this.discountPercentage > 10;
        let allApproved = true;

        for (const item of this.items) {
            if (requiresNSHApproval) {
                if (!item.RSHApproval.approved || !item.NSHApproval.approved) {
                    allApproved = false;
                    break;
                }
            } else {
                if (!item.RSHApproval.approved) {
                    allApproved = false;
                    break;
                }
            }
        }

        this.approvalProposalStatus = allApproved ? 'Approved' : 'InProgress';
    }
    next();
});

// Unique proposal number generator with transaction support
proposalSchema.pre('save', async function (next) {
    if (!this.proposalNumber) {
        const maxRetries = 3;
        let attempts = 0;
        let success = false;
        let lastError = null;

        while (attempts < maxRetries && !success) {
            attempts++;
            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {
                    // Get and increment counter atomically
                    const counter = await Counter.findOneAndUpdate(
                        { name: 'proposalNumber' },
                        { $inc: { value: 1 } },
                        { new: true, upsert: true, session }
                    );

                    // Generate new proposal number
                    const year = new Date().getFullYear();
                    const paddedNumber = counter.value.toString().padStart(5, '0');
                    const newProposalNumber = `PROP-${year}-${paddedNumber}`;

                    // Verify uniqueness within the transaction
                    const exists = await this.constructor.findOne(
                        { proposalNumber: newProposalNumber },
                        { session }
                    ).lean();

                    if (exists) {
                        throw new Error('Duplicate proposal number detected');
                    }

                    // Only assign if everything checks out
                    this.proposalNumber = newProposalNumber;
                    success = true;
                });
            } catch (error) {
                lastError = error;
                // If it's not a duplicate error, break the loop
                if (error.message !== 'Duplicate proposal number detected') {
                    break;
                }
            } finally {
                session.endSession();
            }

            // Small delay between retries
            if (!success && attempts < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        // If all retries failed, use a fallback method
        if (!success) {
            try {
                // Find the highest existing proposal number
                const lastProposal = await this.constructor.findOne()
                    .sort({ proposalNumber: -1 })
                    .select('proposalNumber')
                    .lean();

                let nextNumber = 1;
                if (lastProposal) {
                    const lastNumber = parseInt(lastProposal.proposalNumber.split('-').pop(), 10);
                    nextNumber = lastNumber + 1;
                }

                // Update counter to match
                await Counter.findOneAndUpdate(
                    { name: 'proposalNumber' },
                    { $set: { value: nextNumber } },
                    { upsert: true }
                );

                const year = new Date().getFullYear();
                this.proposalNumber = `PROP-${year}-${nextNumber.toString().padStart(5, '0')}`;
            } catch (fallbackError) {
                return next(fallbackError);
            }
        } else if (lastError) {
            return next(lastError);
        }
    }
    next();
});

// Auto update 'updatedAt'
proposalSchema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
});

// Index for search optimization
proposalSchema.index({ 'customer.customername': 1 });

module.exports = mongoose.model('Proposal', proposalSchema);