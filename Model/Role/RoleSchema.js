const mongoose = require('mongoose');

const featuresSchema = new mongoose.Schema({
    featuresId: { type: String, trim: true },
    component: { type: String, trim: true },
    read: { type: Boolean, default: false },
    write: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
}, { _id: false });

 

const roleSchema = new mongoose.Schema({
    roleId: { type: String, unique: true, trim: true },
    name: { type: String, required: true, unique: true, trim: true },
    features: { type: [featuresSchema], default: [] },
    states: [{ type: String }],
    cities: [{ type: String }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    parentRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' }
});

module.exports = mongoose.models.Role || mongoose.model('Role', roleSchema);
