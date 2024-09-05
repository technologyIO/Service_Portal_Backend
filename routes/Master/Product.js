const express = require('express');
const router = express.Router();
const Product = require('../../Model/MasterSchema/ProductSchema');

// Middleware to get product by ID
async function getProductById(req, res, next) {
    let product;
    try {
        product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.product = product;
    next();
}

// Middleware to check for duplicate part number ID
async function checkDuplicatePartNoId(req, res, next) {
    let product;
    try {
        product = await Product.findOne({ partnoid: req.body.partnoid });
        if (product && product._id != req.params.id) {
            return res.status(400).json({ message: 'Part number ID already exists' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all products
router.get('/product', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET product by ID
router.get('/product/:id', getProductById, (req, res) => {
    res.json(res.product);
});

// CREATE new product
router.post('/product', checkDuplicatePartNoId, async (req, res) => {
    const product = new Product({
        productgroup: req.body.productgroup,
        partnoid: req.body.partnoid,
        product: req.body.product,
        subgrp: req.body.subgrp,
        frequency: req.body.frequency,
        dateoflaunch: req.body.dateoflaunch,
        endofsaledate: req.body.endofsaledate,
        endofsupportdate: req.body.endofsupportdate,
        exsupportavlb: req.body.exsupportavlb,
        installationcheckliststatusboolean: req.body.installationcheckliststatusboolean,
        pmcheckliststatusboolean: req.body.pmcheckliststatusboolean
    });
    try {
        const newProduct = await product.save();
        res.status(201).json(newProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE product
router.put('/product/:id', getProductById, checkDuplicatePartNoId, async (req, res) => {
    if (req.body.productgroup != null) {
        res.product.productgroup = req.body.productgroup;
    }
    if (req.body.partnoid != null) {
        res.product.partnoid = req.body.partnoid;
    }
    if (req.body.product != null) {
        res.product.product = req.body.product;
    }
    if (req.body.subgrp != null) {
        res.product.subgrp = req.body.subgrp;
    }
    if (req.body.frequency != null) {
        res.product.frequency = req.body.frequency;
    }
    if (req.body.dateoflaunch != null) {
        res.product.dateoflaunch = req.body.dateoflaunch;
    }
    if (req.body.endofsaledate != null) {
        res.product.endofsaledate = req.body.endofsaledate;
    }
    if (req.body.endofsupportdate != null) {
        res.product.endofsupportdate = req.body.endofsupportdate;
    }
    if (req.body.exsupportavlb != null) {
        res.product.exsupportavlb = req.body.exsupportavlb;
    }
    if (req.body.installationcheckliststatusboolean != null) {
        res.product.installationcheckliststatusboolean = req.body.installationcheckliststatusboolean;
    }
    if (req.body.pmcheckliststatusboolean != null) {
        res.product.pmcheckliststatusboolean = req.body.pmcheckliststatusboolean;
    }

    try {
        const updatedProduct = await res.product.save();
        res.json(updatedProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE product
router.delete('/product/:id', async (req, res) => {
    try {
        const deleteProduct = await Product.deleteOne({ _id: req.params.id })
        if (deleteProduct.deletedCount === 0) {
            res.status(404).json({ message: "Product Not Found" })
        }
        res.json({ message: 'Deleted Product' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
