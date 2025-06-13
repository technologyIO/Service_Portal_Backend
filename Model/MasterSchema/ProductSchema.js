const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  productgroup: {
    type: String,
    required: true
  },
  partnoid: {
    type: String,
    required: true,
    unique: true // This ensures no duplicate partnoid in DB
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
    type: Date
  },
  endofsaledate: {
    type: Date
  },
  endofsupportdate: {
    type: Date
  },
  exsupportavlb: {
    type: Date
  },
  installationcheckliststatusboolean: {
    type: String
  },
  pmcheckliststatusboolean: {
    type: String
  }
});

module.exports = mongoose.model('Product', ProductSchema);
