const mongoose = require('mongoose');

// Define the schema for a Role
const roleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    parentRole: {
        type: String,
        required: true
    },
    featureName: {
        type: String,
        required: true
    },
    featureCrudAccess: {
        all: {
            type: Boolean,
            default: false
        },
        read: {
            type: Boolean,
            default: false
        },
        write: {
            type: Boolean,
            default: false
        },
        delete: {
            type: Boolean,
            default: false
        }
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    modifiedAt: {
        type: Date,
        default: Date.now
    },
    roleId: {
        type: String,
        required: true,
        unique: true
    }
});

// Middleware to update modifiedAt field before each save
roleSchema.pre('save', function (next) {
    this.modifiedAt = Date.now();
    next();
});

module.exports = mongoose.model('Role', roleSchema);
