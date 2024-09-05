const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
    productgroup: {
        type: String,
        required: true
    },
    partnoid: {
        type: String,
        required: true
    },
    product: {
        type: String,
        required: true
    },
    subgrp: {
        type: String,
        required: true
    },
    frequency: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    modifiedAt: {
        type: Date,
        default: Date.now
    },
    dateoflaunch: {
        type: Date,
        required: true
    },
    endofsaledate: {
        type: Date,
        required: true
    },
    endofsupportdate: {
        type: Date,
        required: true,
        unique: true // Ensure end of support date uniqueness
    },
    exsupportavlb: {
        type: Boolean,
        required: true
    },
    installationcheckliststatusboolean: {
        type: Boolean,
        required: true
    },
    pmcheckliststatusboolean: {
        type: Boolean,
        required: true
    }
});

module.exports = mongoose.model('Product', ProductSchema);
