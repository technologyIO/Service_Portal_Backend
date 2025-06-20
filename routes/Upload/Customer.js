const express = require('express');
const router = express.Router();
const Customer = require('../../Model/UploadSchema/CustomerSchema'); // Adjust the path as necessary
const nodemailer = require('nodemailer');
const User = require('../../Model/MasterSchema/UserSchema');

const transporter = nodemailer.createTransport({
    service: 'Gmail',  
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});


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
async function getCustomerByCode(req, res) {
    try {
        const customer = await Customer.findOne({ customercode: req.params.customercodeid });

        if (!customer) {
            return res.status(404).json({ message: 'Customer not found' });
        }

        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
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

router.post('/customer/send-email', async (req, res) => {
    // Extract the fields from req.body (ensure your frontend sends these)
    const {
        customername,
        hospitalname,
        street,
        city,
        postalcode,
        district,
        state,
        country,
        telephone,
        taxnumber1,
        taxnumber2,
        email,
        status,
        customertype
    } = req.body;

    // Create a nicely formatted HTML email body
    let emailContent = `
      <p style="font-size: 14px; margin-bottom: 16px;">
        <strong>Dear CIC,</strong>
      </p>
  
      <p style="font-size: 14px; margin-bottom: 16px;">
        Please update the notification details as below:
      </p>
  
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
       <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Customer Type :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${customertype || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Customer Name :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${customername || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Hospital name :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${hospitalname || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Street :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${street || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Postal Code :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${postalcode || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>District :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${district || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>City :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${city || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>State :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${state || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Country :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${country || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Telephone :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${telephone || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>PAN Number :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${taxnumber1 || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>GST Number :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${taxnumber2 || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Email :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${email || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Status :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${status || ''}</td>
        </tr>
       
      </table>
  
      <br/>
      <p style="font-size: 14px; margin-bottom: 16px;">
        Regards,<br/>
        <strong>Skanray Service Support Team</strong>
      </p>
      <p style="font-size: 12px; color: #666;">
        Please consider the environment before printing this email.
      </p>
    `;

     const cicUser = await User.findOne({
                        'role.roleName': 'CIC',
                        'role.roleId': 'C1'
                    });
    
                    if (!cicUser) {
                        console.error("CIC user not found");
                        return;
                    }

    // Email options
    const mailOptions = {
        from: 'webadmin@skanray-access.com',  
        to: cicUser.email,   
        subject: 'New Customer Creation',
        html: emailContent
    };

    try {
        // Send the email
        await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Email sent successfully' });
    } catch (error) {
        res.status(500).json({
            message: 'Failed to send email',
            error: error.toString()
        });
    }
});


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

router.get('/customer/by-code/:customercode', getCustomerByCode);

// GET customer by ID
router.get('/customer/:id', getCustomerById, (req, res) => {
    res.json(res.customer);
});

// CREATE a new customer
// Example of your backend route
router.post('/customer', checkDuplicateCustomer, async (req, res) => {
    const customer = new Customer({
        customercodeid: req.body.customercodeid,
        customername: req.body.customername,
        hospitalname: req.body.hospitalname,
        street: req.body.street,
        city: req.body.city,
        postalcode: req.body.postalcode,
        district: req.body.district,
        state: req.body.state,
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
router.put('/customer/:id', getCustomerById, async (req, res) => {
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
    if (req.body.state != null) {
        res.customer.state = req.body.state;
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
        const deleteCustomer = await Customer.deleteOne({ _id: req.params.id })
        if (deleteCustomer.deletedCount === 0) {
            res.status(404).json({ message: "Customer Not Found" })
        }
        res.json({ message: 'Deleted customer' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


router.get('/searchcustomer', async (req, res) => {
    try {
        const { q } = req.query;
        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' })
        }

        const query = {
            $or: [
                { customercodeid: { $regex: q, $options: 'i' } },
                { customername: { $regex: q, $options: 'i' } },
                { hospitalname: { $regex: q, $options: 'i' } },
                { street: { $regex: q, $options: 'i' } },
                { city: { $regex: q, $options: 'i' } },
                { postalcode: { $regex: q, $options: 'i' } },
                { district: { $regex: q, $options: 'i' } },
                { state: { $regex: q, $options: 'i' } },
                { country: { $regex: q, $options: 'i' } },
                { telephone: { $regex: q, $options: 'i' } },
                { taxnumber1: { $regex: q, $options: 'i' } },
                { taxnumber2: { $regex: q, $options: 'i' } },
                { email: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } },
                { customertype: { $regex: q, $options: 'i' } },
            ]
        }
        const customer = await Customer.find(query)

        res.json(customer);

    } catch (err) {
        res.json(500).json({ message: err.message })
    }
})

module.exports = router;
