const express = require('express');
const router = express.Router();
const Customer = require('../../Model/UploadSchema/CustomerSchema'); // Adjust the path as necessary
const nodemailer = require('nodemailer');
const User = require('../../Model/MasterSchema/UserSchema');
const mongoose = require('mongoose');
const NotificationSettings = require('../../Model/AdminSchema/NotificationSettingsSchema');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: 'webadmin@skanray-access.com',
        pass: 'rdzegwmzirvbjcpm'
    }
});

async function getCicRecipients() {
    try {
        const settings = await NotificationSettings.findOne();
        if (settings && Array.isArray(settings.cicRecipients)) {
            // Filter out duplicates and validate email format
            const uniqueValidEmails = [...new Set(settings.cicRecipients)].filter(email =>
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
            );
            return uniqueValidEmails;
        }
        return [];
    } catch (error) {
        console.error('Error fetching cicRecipients:', error);
        return [];
    }
}
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
router.get('/customer/filter-options', async (req, res) => {
    try {
        const customers = await Customer.find({}, {
            customercodeid: 1,
            city: 1,
            region: 1,
            country: 1
        });

        // const customerCodes = [...new Set(customers.map(c => c.customercodeid).filter(Boolean))];
        const cities = [...new Set(customers.map(c => c.city).filter(Boolean))];
        const regions = [...new Set(customers.map(c => c.region).filter(Boolean))];
        const countries = [...new Set(customers.map(c => c.country).filter(Boolean))];

        res.json({
            cities: cities.sort(),
            regions: regions.sort(),
            countries: countries.sort()
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET customers with filters
router.get('/customer/filter', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Build filter object
        const filters = {};

        // Customer Code filter
        if (req.query.customercodeid) {
            filters.customercodeid = req.query.customercodeid;
        }

        // Customer Name filter
        if (req.query.customername) {
            filters.customername = { $regex: req.query.customername, $options: 'i' };
        }

        // Hospital Name filter
        if (req.query.hospitalname) {
            filters.hospitalname = { $regex: req.query.hospitalname, $options: 'i' };
        }

        // Street filter
        if (req.query.street) {
            filters.street = { $regex: req.query.street, $options: 'i' };
        }

        // City filter
        if (req.query.city) {
            filters.city = req.query.city;
        }

        // Postal Code filter
        if (req.query.postalcode) {
            filters.postalcode = { $regex: req.query.postalcode, $options: 'i' };
        }

        // District filter
        if (req.query.district) {
            filters.district = { $regex: req.query.district, $options: 'i' };
        }

        // Region filter
        if (req.query.region) {
            filters.region = req.query.region;
        }

        // Country filter
        if (req.query.country) {
            filters.country = req.query.country;
        }

        // Telephone filter
        if (req.query.telephone) {
            filters.telephone = { $regex: req.query.telephone, $options: 'i' };
        }

        // Tax Number filters
        if (req.query.taxnumber1) {
            filters.taxnumber1 = { $regex: req.query.taxnumber1, $options: 'i' };
        }

        if (req.query.taxnumber2) {
            filters.taxnumber2 = { $regex: req.query.taxnumber2, $options: 'i' };
        }

        // Email filter
        if (req.query.email) {
            filters.email = { $regex: req.query.email, $options: 'i' };
        }

        // Status filter
        if (req.query.status) {
            filters.status = req.query.status;
        }

        // Customer Type filter
        if (req.query.customertype) {
            filters.customertype = req.query.customertype;
        }

        // Created date range filter
        if (req.query.createdStartDate || req.query.createdEndDate) {
            filters.createdAt = {};
            if (req.query.createdStartDate) {
                filters.createdAt.$gte = new Date(req.query.createdStartDate);
            }
            if (req.query.createdEndDate) {
                const endDate = new Date(req.query.createdEndDate);
                endDate.setHours(23, 59, 59, 999);
                filters.createdAt.$lte = endDate;
            }
        }

        // Modified date range filter
        if (req.query.modifiedStartDate || req.query.modifiedEndDate) {
            filters.modifiedAt = {};
            if (req.query.modifiedStartDate) {
                filters.modifiedAt.$gte = new Date(req.query.modifiedStartDate);
            }
            if (req.query.modifiedEndDate) {
                const endDate = new Date(req.query.modifiedEndDate);
                endDate.setHours(23, 59, 59, 999);
                filters.modifiedAt.$lte = endDate;
            }
        }

        const totalCustomers = await Customer.countDocuments(filters);
        const customers = await Customer.find(filters)
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: -1 });

        const totalPages = Math.ceil(totalCustomers / limit);

        res.json({
            customers,
            totalCustomers,
            totalPages,
            currentPage: page,
            filters: req.query
        });
    } catch (err) {
        console.error('Filter error:', err);
        res.status(500).json({ message: err.message });
    }
});
// BULK DELETE Customer entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/customer/bulk', async (req, res) => {
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

        // Delete multiple customers
        const deleteResult = await Customer.deleteMany({
            _id: { $in: validIds }
        });

        if (deleteResult.deletedCount === 0) {
            return res.status(404).json({
                message: 'No customers found to delete',
                deletedCount: 0
            });
        }

        res.json({
            message: `Successfully deleted ${deleteResult.deletedCount} customers`,
            deletedCount: deleteResult.deletedCount,
            requestedCount: validIds.length
        });

    } catch (err) {
        console.error('Bulk delete error:', err);
        res.status(500).json({ message: err.message });
    }
});

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
        region,
        country,
        telephone,
        taxnumber1,
        taxnumber2,
        email,
        status,
        customertype,
        serviceEngineer
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
          <td style="padding: 4px; vertical-align: top;"><strong>Region :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${region || ''}</td>
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

      ${serviceEngineer ? `
      <br/>
      <h3 style="font-size: 16px; margin-top: 20px; margin-bottom: 10px; color: #333;">Service Engineer Information:</h3>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Engineer ID :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${serviceEngineer.employeeid || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Engineer Name :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${serviceEngineer.firstname || ''} ${serviceEngineer.lastname || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Engineer Email :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${serviceEngineer.email || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Engineer Mobile :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${serviceEngineer.mobilenumber || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Department :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${serviceEngineer.department || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>User Type :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${serviceEngineer.usertype || ''}</td>
        </tr>
        ${serviceEngineer.dealerName ? `
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Dealer Name :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${serviceEngineer.dealerName || ''}</td>
        </tr>
        <tr>
          <td style="padding: 4px; vertical-align: top;"><strong>Dealer Code :</strong></td>
          <td style="padding: 4px; vertical-align: top;">${serviceEngineer.dealerCode || ''}</td>
        </tr>
        ` : ''}
      </table>
      ` : ''}
  
      <br/>
      <p style="font-size: 14px; margin-bottom: 16px;">
        Regards,<br/>
        <strong>Skanray Service Support Team</strong>
      </p>
      <p style="font-size: 12px; color: #666;">
        Please consider the environment before printing this email.
      </p>
    `;

    try {
        // Get CIC recipients from database
        const cicRecipients = await getCicRecipients();

        // Start with CIC recipients (always included)
        let recipients = [...cicRecipients];

        // Add recipients based on service engineer user type
        if (serviceEngineer) {
            const userType = serviceEngineer.usertype?.toLowerCase();

            if (userType === 'skanray') {
                // For Skanray user type: add service engineer email and manager emails
                if (serviceEngineer.email) {
                    recipients.push(serviceEngineer.email);
                }

                // Add manager emails if available
                if (serviceEngineer.manageremail && Array.isArray(serviceEngineer.manageremail)) {
                    recipients.push(...serviceEngineer.manageremail);
                }
            }
            else if (userType === 'dealer') {
                // For Dealer user type: add dealer email, service engineer email, and manager emails
                if (serviceEngineer.dealerEmail) {
                    recipients.push(serviceEngineer.dealerEmail);
                }

                if (serviceEngineer.email) {
                    recipients.push(serviceEngineer.email);
                }

                // Add manager emails if available
                if (serviceEngineer.manageremail && Array.isArray(serviceEngineer.manageremail)) {
                    recipients.push(...serviceEngineer.manageremail);
                }
            }
        }

        // Remove duplicates and filter out empty emails
        const finalRecipients = [...new Set(recipients)].filter(email =>
            email && email.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
        );

        // Email options
        const mailOptions = {
            from: 'webladmin@skanray-access.com',
            to: finalRecipients.join(', '),
            subject: 'New Customer Creation',
            html: emailContent
        };

        // Send the email
        await transporter.sendMail(mailOptions);

        res.status(200).json({
            message: 'Email sent successfully',
            recipients: finalRecipients,
            recipientCount: finalRecipients.length,
            emailBreakdown: {
                cicRecipientsFromDB: cicRecipients.length,
                serviceEngineerEmail: serviceEngineer?.email || 'N/A',
                managerEmails: serviceEngineer?.manageremail?.length || 0,
                dealerEmail: serviceEngineer?.dealerEmail || 'N/A',
                userType: serviceEngineer?.usertype || 'N/A'
            },
            emailDetails: {
                subject: 'New Customer Creation',
                from: 'webladmin@skanray-access.com',
                sentAt: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({
            message: 'Failed to send email',
            error: error.toString(),
            serviceEngineerUserType: serviceEngineer?.usertype || 'N/A'
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
router.get('/customerphone', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        // ✅ exclude inactive customers
        const query = { status: { $ne: "Inactive" } };

        const customers = await Customer.find(query)
            .skip(skip)
            .limit(limit);

        const totalCustomers = await Customer.countDocuments(query);
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


router.get("/customer/by-code/:customercode", async (req, res) => {
    const { customercode } = req.params;

    try {
        const customer = await Customer.findOne({
            customercodeid: customercode,
            status: { $ne: "Inactive" } // exclude string "Inactive"
        });

        if (!customer) {
            return res.status(404).json({ message: "Customer not found or inactive" });
        }

        res.status(200).json(customer);
    } catch (error) {
        console.error("Error fetching customer:", error);
        res.status(500).json({ message: "Server error" });
    }
});


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
        region: req.body.region,
        country: req.body.country,
        telephone: req.body.telephone,
        taxnumber1: req.body.taxnumber1,
        taxnumber2: req.body.taxnumber2,
        email: req.body.email,
        status: req.body.status,
        customertype: req.body.customertype,
        createdAt: new Date(),
        modifiedAt: new Date()
    });

    try {
        const newCustomer = await customer.save();
        res.status(201).json({
            message: 'Customer created successfully',
            data: newCustomer
        });
    } catch (err) {
        // Duplicate key error
        if (err.code === 11000) {
            const field = Object.keys(err.keyValue)[0];
            return res.status(400).json({
                message: `Duplicate value for "${field}": "${err.keyValue[field]}" already exists.`,
                error: err.message
            });
        }

        // Validation error
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation failed',
                error: Object.values(err.errors).map(e => e.message).join(', ')
            });
        }

        // Unknown error
        res.status(500).json({
            message: 'Failed to create customer',
            error: err.message
        });
    }
});


// UPDATE a customer
router.put('/customer/:id', getCustomerById, async (req, res) => {
    const fields = [
        'customercodeid', 'customername', 'hospitalname', 'street', 'city', 'postalcode',
        'district', 'state', 'region', 'country', 'telephone', 'taxnumber1', 'taxnumber2',
        'email', 'status', 'customertype'
    ];

    // Dynamically update only non-null fields
    fields.forEach(field => {
        if (req.body[field] != null) {
            res.customer[field] = req.body[field];
        }
    });

    // Update modifiedAt
    res.customer.modifiedAt = new Date();

    try {
        const updatedCustomer = await res.customer.save();
        res.json({ message: 'Customer updated successfully', data: updatedCustomer });
    } catch (err) {
        // Check for duplicate key error (MongoDB error code 11000)
        if (err.code === 11000) {
            const duplicateKey = Object.keys(err.keyValue)[0];
            return res.status(400).json({
                message: `Duplicate value for "${duplicateKey}": "${err.keyValue[duplicateKey]}" already exists.`,
                error: err.message
            });
        }

        // Validation error handling
        if (err.name === 'ValidationError') {
            return res.status(400).json({
                message: 'Validation failed',
                error: Object.values(err.errors).map(e => e.message).join(', ')
            });
        }

        // Other unknown errors
        res.status(500).json({
            message: 'Failed to update customer',
            error: err.message
        });
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
        const { q = '', page = 1, limit = 10 } = req.query;
        const searchTerm = q.trim();

        // Pagination math
        const pageInt = Math.max(1, parseInt(page, 10) || 1);
        const limitInt = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageInt - 1) * limitInt;

        // ✅ Base query (no inactive filter now)
        let query = {};

        // Build search query only if search term exists
        if (searchTerm) {
            // Escape regex meta-characters
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            query.$or = [
                { customercodeid: { $regex: escaped, $options: 'i' } },
                { customername: { $regex: escaped, $options: 'i' } },
                { hospitalname: { $regex: escaped, $options: 'i' } },
                { street: { $regex: escaped, $options: 'i' } },
                { city: { $regex: escaped, $options: 'i' } },
                { postalcode: { $regex: escaped, $options: 'i' } },
                { district: { $regex: escaped, $options: 'i' } },
                { state: { $regex: escaped, $options: 'i' } },
                { region: { $regex: escaped, $options: 'i' } },
                { country: { $regex: escaped, $options: 'i' } },
                { telephone: { $regex: escaped, $options: 'i' } },
                { taxnumber1: { $regex: escaped, $options: 'i' } },
                { taxnumber2: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { status: { $regex: escaped, $options: 'i' } }, // ✅ can now search by status too
                { customertype: { $regex: escaped, $options: 'i' } },
            ];
        }

        // Get total count and paginated results
        const totalCustomers = await Customer.countDocuments(query);
        const customers = await Customer.find(query)
            .skip(skip)
            .limit(limitInt)
            .sort({ _id: -1 });

        const totalPages = Math.ceil(totalCustomers / limitInt);

        res.json({
            customers,
            totalPages: totalPages || 1,
            totalCustomers,
            currentPage: pageInt,
            hasNextPage: pageInt < totalPages,
            hasPrevPage: pageInt > 1
        });

    } catch (err) {
        console.error('Search customer error:', err);
        res.status(500).json({
            message: err.message || 'Internal server error',
            customers: [],
            totalPages: 1,
            totalCustomers: 0,
            currentPage: 1,
            hasNextPage: false,
            hasPrevPage: false
        });
    }
});

router.get('/searchcustomerphone', async (req, res) => {
    try {
        const { q = '', page = 1, limit = 10 } = req.query;
        const searchTerm = q.trim();

        // Pagination math
        const pageInt = Math.max(1, parseInt(page, 10) || 1);
        const limitInt = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageInt - 1) * limitInt;

        // ✅ Base filter: exclude Inactive
        let query = { status: { $ne: "Inactive" } };

        // Build search query only if search term exists
        if (searchTerm) {
            // Escape regex meta-characters
            const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            query.$or = [
                { customercodeid: { $regex: escaped, $options: 'i' } },
                { customername: { $regex: escaped, $options: 'i' } },
                { hospitalname: { $regex: escaped, $options: 'i' } },
                { street: { $regex: escaped, $options: 'i' } },
                { city: { $regex: escaped, $options: 'i' } },
                { postalcode: { $regex: escaped, $options: 'i' } },
                { district: { $regex: escaped, $options: 'i' } },
                { state: { $regex: escaped, $options: 'i' } },
                { region: { $regex: escaped, $options: 'i' } },
                { country: { $regex: escaped, $options: 'i' } },
                { telephone: { $regex: escaped, $options: 'i' } },
                { taxnumber1: { $regex: escaped, $options: 'i' } },
                { taxnumber2: { $regex: escaped, $options: 'i' } },
                { email: { $regex: escaped, $options: 'i' } },
                { customertype: { $regex: escaped, $options: 'i' } },
            ];
        }

        // Get total count and paginated results
        const totalCustomers = await Customer.countDocuments(query);
        const customers = await Customer.find(query)
            .skip(skip)
            .limit(limitInt)
            .sort({ _id: -1 });

        const totalPages = Math.ceil(totalCustomers / limitInt);

        res.json({
            customers,
            totalPages: totalPages || 1,
            totalCustomers,
            currentPage: pageInt,
            hasNextPage: pageInt < totalPages,
            hasPrevPage: pageInt > 1
        });

    } catch (err) {
        console.error('Search customer error:', err);
        res.status(500).json({
            message: err.message || 'Internal server error',
            customers: [],
            totalPages: 1,
            totalCustomers: 0,
            currentPage: 1,
            hasNextPage: false,
            hasPrevPage: false
        });
    }
});



module.exports = router;
