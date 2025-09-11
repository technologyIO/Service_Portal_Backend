const express = require('express');
const router = express.Router();
const Product = require('../../Model/MasterSchema/ProductSchema');
const mongoose = require('mongoose');

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
router.get('/product/filter-options', async (req, res) => {
    try {
        const products = await Product.find({}, {
            productgroup: 1,
            subgrp: 1
        });

        const productGroups = [...new Set(products.map(p => p.productgroup).filter(Boolean))];
        const subGroups = [...new Set(products.map(p => p.subgrp).filter(Boolean))];

        res.json({
            productGroups: productGroups.sort(),
            subGroups: subGroups.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET products with filters
router.get('/product/filter', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filters = {};

        // Status filter
        if (req.query.status) {
            filters.status = req.query.status;
        }

        // Product group filter
        if (req.query.productGroup) {
            filters.productgroup = req.query.productGroup;
        }

        // Sub group filter
        if (req.query.subGroup) {
            filters.subgrp = req.query.subGroup;
        }

        // Installation checklist status filter
        if (req.query.installationChecklistStatus) {
            if (req.query.installationChecklistStatus === 'true') {
                filters.installationcheckliststatusboolean = true;
            } else if (req.query.installationChecklistStatus === 'false') {
                filters.installationcheckliststatusboolean = false;
            }
        }

        // PM checklist status filter
        if (req.query.pmChecklistStatus) {
            if (req.query.pmChecklistStatus === 'true') {
                filters.pmcheckliststatusboolean = true;
            } else if (req.query.pmChecklistStatus === 'false') {
                filters.pmcheckliststatusboolean = false;
            }
        }

        // Created date range filter
        if (req.query.startDate || req.query.endDate) {
            filters.createdAt = {};
            if (req.query.startDate) {
                filters.createdAt.$gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                const endDate = new Date(req.query.endDate);
                endDate.setHours(23, 59, 59, 999);
                filters.createdAt.$lte = endDate;
            }
        }

        // Launch date range filter
        if (req.query.launchDateStart || req.query.launchDateEnd) {
            filters.dateoflaunch = {};
            if (req.query.launchDateStart) {
                filters.dateoflaunch.$gte = new Date(req.query.launchDateStart);
            }
            if (req.query.launchDateEnd) {
                const endDate = new Date(req.query.launchDateEnd);
                endDate.setHours(23, 59, 59, 999);
                filters.dateoflaunch.$lte = endDate;
            }
        }

        // End of sale date range filter
        if (req.query.endOfSaleDateStart || req.query.endOfSaleDateEnd) {
            filters.endofsaledate = {};
            if (req.query.endOfSaleDateStart) {
                filters.endofsaledate.$gte = new Date(req.query.endOfSaleDateStart);
            }
            if (req.query.endOfSaleDateEnd) {
                const endDate = new Date(req.query.endOfSaleDateEnd);
                endDate.setHours(23, 59, 59, 999);
                filters.endofsaledate.$lte = endDate;
            }
        }

        const products = await Product.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalProducts = await Product.countDocuments(filters);
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
            products,
            totalPages,
            totalProducts,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});
// GET all products
router.get('/product', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// BULK DELETE Product entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/product/bulk', async (req, res) => {
    try {
        const { ids } = req.body;

        // Validate input
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'Please provide valid IDs array' });
        }

        // Validate ObjectIds
        const validIds = ids.filter(id => mongoose.Types.ObjectId.isValid(id));
        if (validIds.length === 0) {
            return res.status(400).json({ message: 'No valid IDs provided' });
        }

        // Delete multiple products
        const deleteResult = await Product.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No products found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} products`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

router.get('/productbypage', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const product = await Product.find().skip(skip).limit(limit); // Fetch Product Groups for the current page
        const totalProduct = await Product.countDocuments(); // Total number of Product Groups

        const totalPages = Math.ceil(totalProduct / limit); // Calculate total number of pages

        res.status(200).json({
            product,
            totalPages,
            totalProduct
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});




router.get('/skillbyproductgroup', async (req, res) => {
    try {
        const groupedProducts = await Product.aggregate([
            {
                $group: {
                    _id: '$productgroup',
                    products: { $push: '$$ROOT' }
                }
            },
            {
                $project: {
                    _id: 0,
                    productgroup: '$_id',
                    products: 1
                }
            },
            {
                $sort: { productgroup: 1 }
            }
        ]);

        res.status(200).json(groupedProducts);
    } catch (error) {
        console.error('Error fetching grouped products:', error);
        res.status(500).json({ error: 'Internal Server Error' });
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
    if (req.body.status != null) {
        res.product.status = req.body.status;
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
        const deleteProduct = await Product.deleteOne({ _id: req.params.id });

        if (deleteProduct.deletedCount === 0) {
            return res.status(404).json({ message: "Product Not Found" });
        }

        return res.json({ message: 'Deleted Product' });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});



router.get('/searchProduct', async (req, res) => {
    try {
        const { q } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const query = {
            $or: [
                { productgroup: { $regex: q, $options: 'i' } },
                { partnoid: { $regex: q, $options: 'i' } },
                { product: { $regex: q, $options: 'i' } },
                { subgrp: { $regex: q, $options: 'i' } },
                { frequency: { $regex: q, $options: 'i' } }
            ]
        };

        const products = await Product.find(query).skip(skip).limit(limit);
        const totalProducts = await Product.countDocuments(query);
        const totalPages = Math.ceil(totalProducts / limit);

        res.json({
            product: products,
            totalPages,
            totalProducts,
            currentPage: page,
            isSearch: true
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


module.exports = router;
