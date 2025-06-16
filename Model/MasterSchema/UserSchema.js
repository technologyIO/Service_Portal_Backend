const mongoose = require('mongoose');

const demographicSchema = new mongoose.Schema({
    type: { type: String, enum: ['geo', 'region', 'country', 'state', 'city', 'branch'], required: true },
    selectionType: { type: String, enum: ['single', 'multiple'], required: true },
    values: [{
        id: { type: String },
        name: { type: String }
    }]
});

const skillSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    partNumbers: [{ type: String }],
    productGroup: { type: String }
});

const UserSchema = new mongoose.Schema({
    // Basic Info
    firstname: { type: String, required: true },
    lastname: { type: String },
    email: { type: String, required: true, unique: true },
    mobilenumber: { type: String, required: true },
    status: {
        type: String,
        enum: ["Active", "Deactive"],
        default: "Active"
    },

    // Dates
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
    loginexpirydate: { type: Date },
    deviceid: { type: String },
    deviceregistereddate: { type: Date },

    // Location Info

    zipCode: { type: String },

    // Company Info
    employeeid: { type: String, unique: true },
    department: { type: String },
    manageremail: { type: String },
    profileimage: { type: String },


    // User Type
    usertype: { type: String, enum: ['dealer', 'skanray'], required: true },

    // Role/Dealer Info
    role: {
        roleName: { type: String },
        roleId: { type: String }
    },
    dealerInfo: {
        dealerName: { type: String },
        dealerId: { type: String }
    },

    // Skills
    skills: [skillSchema],
    password: { type: String },

    // Demographic Data
    demographics: [demographicSchema],

    // Legacy Fields (for backward compatibility)
    branch: [{ type: String }],
    location: [{ type: String }]
});

module.exports = mongoose.model('User', UserSchema);