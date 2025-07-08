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

        const users = await Product.find(query);

        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
