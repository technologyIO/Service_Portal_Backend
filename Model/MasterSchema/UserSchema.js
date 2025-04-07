// Model: UserSchema.js
const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    mobilenumber: { type: String, required: true },
    status: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now },
    branch: [{ type: String, required: true }], // now an array
    loginexpirydate: { type: Date, required: true },
    employeeid: { type: String, required: true },
    country: { type: String, required: true },
    state: { type: String, required: true },
    city: { type: String, required: true },
    department: { type: String, required: true },
    password: { type: String, required: true },
    manageremail: { type: String, required: true },
    skills: { type: String, required: true },
    profileimage: { type: String, required: true },
    deviceid: { type: String, required: true },
    deviceregistereddate: { type: Date, default: Date.now },
    usertype: { type: String, enum: ['dealer', 'skanray'], required: true },
    // For skanray type users, we save the role details.
    role: {
         roleName: { 
             type: String, 
             enum: ['Super Admin', 'admin', 'cic', 'Support', 'Manager', 'Service Engineer'] 
         },
         roleId: { type: String }
    },
    // For dealer type users, we save the dealer info.
    dealerInfo: {
         dealerName: { type: String },
         dealerId: { type: String }
    },
    location: [{ type: String, required: true }] // new field as an array
});

module.exports = mongoose.model('User', UserSchema);
