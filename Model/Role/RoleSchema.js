const mongoose = require('mongoose');

const featuresSchema = new mongoose.Schema({
    featuresId: { type: String, trim: true },
    component: { type: String, trim: true },
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
}, { _id: false });

const mobileComponentSchema = new mongoose.Schema({
    componentId: { type: String, required: true },
    name: { type: String, required: true },
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
}, { _id: false });

const reportSchema = new mongoose.Schema({
    reportId: { type: String, required: true },
    name: { type: String, required: true },
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
}, { _id: false });

const demographicSelectionSchema = new mongoose.Schema({
    name: { type: String, required: true }, // e.g., State, City, Region
    isEnabled: { type: Boolean, default: true },
    selectionType: {
        type: String,
        enum: ['single', 'multi'],
        default: 'single'
    }
}, { _id: false });

const roleSchema = new mongoose.Schema({
    roleId: { type: String, unique: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    roleType: { type: String, required: true, },
    features: { type: [featuresSchema], default: [] },
    mobileComponents: { type: [mobileComponentSchema], default: [] },
    reports: { type: [reportSchema], default: [] },
    demographicSelections: { type: [demographicSelectionSchema], default: [] },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    parentRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' }
});

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
