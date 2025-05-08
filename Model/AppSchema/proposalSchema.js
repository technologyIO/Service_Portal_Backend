const mongoose = require('mongoose');

// Equipment Schema
const equipmentSchema = new mongoose.Schema({
  name: String,
  materialcode: String,
  materialdescription: String,
  dealer: String
}, { _id: false });

// Customer Schema
const customerSchema = new mongoose.Schema({
  customercodeid: String,
  customername: String,
  city: String,
  postalcode: String,
  taxnumber1: String, // PAN
  taxnumber2: String, // GST
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
}, { _id: false });

// Revision Schema
const revisionSchema = new mongoose.Schema({
  revisionNumber: { type: Number, required: true },
  revisionDate: { type: Date, default: Date.now },
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

// Main Proposal Schema
const proposalSchema = new mongoose.Schema({
  customer: customerSchema,
  items: [itemSelectionSchema],
  tdsPercentage: Number,
  discountPercentage: Number,
  gstPercentage: Number,
  remark: String,
  CoNumber: String,
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
    enum: ['draft', 'submitted', 'approved','completed', 'rejected', 'revised'],
    default: 'draft'
  },
  proposalNumber: { type: String, unique: true },
  currentRevision: { type: Number, default: 0 },
  revisions: [revisionSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
  }]
});

// Generate unique proposal number before saving
proposalSchema.pre('save', async function (next) {
  if (!this.proposalNumber) {
    const count = await this.constructor.countDocuments();
    this.proposalNumber = `PROP-${new Date().getFullYear()}-${(count + 1).toString().padStart(5, '0')}`;
  }
  next();
});

// Auto update 'updatedAt' before findOneAndUpdate
proposalSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Indexes for optimized queries
proposalSchema.index({ 'customer.customername': 1 });

module.exports = mongoose.model('Proposal', proposalSchema);
