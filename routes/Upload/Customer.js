const express = require('express');
const router = express.Router();
const Customer = require('../../Model/UploadSchema/CustomerSchema'); // Adjust the path as necessary

// Middleware to get a customer by ID
async function getCustomerById(req, res, next) {
    let customer;
    try {
        customer = await Customer.findById(req.params.id);
        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.customer = customer;
    next();
}

// Middleware to check for duplicate customer code or email
async function checkDuplicateCustomer(req, res, next) {
    let customer;
    try {
        customer = await Customer.findOne({
            $or: [
                { customercodeid: req.body.customercodeid },
                { email: req.body.email }
            ]
        });
        if (customer && customer._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate customer code or email found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

router.get('/customer', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const customers = await Customer.find().skip(skip).limit(limit);
        const totalCustomers = await Customer.countDocuments();
        const totalPages = Math.ceil(totalCustomers / limit);

        res.json({
            customers,
            totalPages,
            totalCustomers
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


// GET customer by ID
router.get('/customer/:id', getCustomerById, (req, res) => {
    res.json(res.customer);
});

// CREATE a new customer
router.post('/customer', checkDuplicateCustomer, async (req, res) => {
    const customer = new Customer({
        customercodeid: req.body.customercodeid,
        customername: req.body.customername,
        hospitalname: req.body.hospitalname,
        street: req.body.street,
        city: req.body.city,
        postalcode: req.body.postalcode,
        district: req.body.district,
        region: req.body.region,
        country: req.body.country,
        telephone: req.body.telephone,
        taxnumber1: req.body.taxnumber1,
        taxnumber2: req.body.taxnumber2,
        email: req.body.email,
        status: req.body.status,
        customertype: req.body.customertype
    });

    try {
        const newCustomer = await customer.save();
        res.status(201).json(newCustomer);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a customer
router.put('/customer/:id', getCustomerById, checkDuplicateCustomer, async (req, res) => {
    if (req.body.customercodeid != null) {
        res.customer.customercodeid = req.body.customercodeid;
    }
    if (req.body.customername != null) {
        res.customer.customername = req.body.customername;
    }
    if (req.body.hospitalname != null) {
        res.customer.hospitalname = req.body.hospitalname;
    }
    if (req.body.street != null) {
        res.customer.street = req.body.street;
    }
    if (req.body.city != null) {
        res.customer.city = req.body.city;
    }
    if (req.body.postalcode != null) {
        res.customer.postalcode = req.body.postalcode;
    }
    if (req.body.district != null) {
        res.customer.district = req.body.district;
    }
    if (req.body.region != null) {
        res.customer.region = req.body.region;
    }
    if (req.body.country != null) {
        res.customer.country = req.body.country;
    }
    if (req.body.telephone != null) {
        res.customer.telephone = req.body.telephone;
    }
    if (req.body.taxnumber1 != null) {
        res.customer.taxnumber1 = req.body.taxnumber1;
    }
    if (req.body.taxnumber2 != null) {
        res.customer.taxnumber2 = req.body.taxnumber2;
    }
    if (req.body.email != null) {
        res.customer.email = req.body.email;
    }
    if (req.body.status != null) {
        res.customer.status = req.body.status;
    }
    if (req.body.customertype != null) {
        res.customer.customertype = req.body.customertype;
    }

    try {
        const updatedCustomer = await res.customer.save();
        res.json(updatedCustomer);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a customer
router.delete('/customer/:id', async (req, res) => {
    try {
        const deleteCustomer = await Customer.deleteOne({_id:req.params.id})
        if(deleteCustomer.deletedCount===0){
            res.status(404).json({message:"Customer Not Found"})
        }
        res.json({ message: 'Deleted customer' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
