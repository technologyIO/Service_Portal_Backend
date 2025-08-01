// routes/installation.js
const express = require('express');
const router = express.Router();
const Installation = require('../../Model/PhoneShema/EquipInstallationSchema');

router.post('/', async (req, res) => {
    try {
        const installation = new Installation(req.body);
        await installation.save();
        res.status(201).json(installation);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ message: error.message, errors: error.errors });
        }
        res.status(500).json({ message: 'Internal Server Error' });
    }
});
router.post('/abort-installation', async (req, res) => {
    const {
        products,
        userId,
        userName,
        branchOrDealerCode,
        branchOrDealerName,
        city,
    } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
        return res.status(400).send({ error: 'Products list is required' });
    }

    if (!userId || !userName || !branchOrDealerCode || !branchOrDealerName || !city) {
        return res.status(400).send({ error: 'User and branch/dealer details are required' });
    }

    let productListText = '';
    products.forEach((product, index) => {
        productListText += `${index + 1}  ${product.name}  ${product.slno}\n`;
    });

    const mailOptions = {
        from: '"Installation Team" <your-email@example.com>',  // sender address
        to: 'CIC@skanray.com, dinsha.kp@skanray.com',         // list of receivers
        subject: 'Aborted Installation',
        text: `Dear Team,

Installation aborted for below products
No     Product                              Slno
${productListText}
by (User id & Name) ${userId} - ${userName}
Skanray branch or Dealer code, Name, City: ${branchOrDealerCode}, ${branchOrDealerName}, ${city}
`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.send({ message: 'Aborted installation email sent successfully' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send({ error: 'Failed to send email' });
    }
});
router.get('/serial/:serialNumber', async (req, res) => {
    try {
        const { serialNumber } = req.params;
        const installations = await Installation.find({ serialNumber });

        if (installations.length === 0) {
            return res.status(404).json({ message: 'No installations found for the provided serial number' });
        }

        res.status(200).json(installations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get all equipment IDs
router.get('/equipment-ids', async (req, res) => {
    try {
        // Find all documents and only return the equipmentId field
        const equipmentIds = await Installation.find({}, 'equipmentId');

        // Check if there are any equipment IDs found
        if (!equipmentIds.length) {
            return res.status(404).json({ message: 'No equipment IDs found' });
        }

        // Send the array of equipment IDs
        res.status(200).json(equipmentIds);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});

// Get data by equipment ID
router.get('/:equipmentId', async (req, res) => {
    const { equipmentId } = req.params;
    try {
        // Find the installation document by equipmentId
        const installation = await Installation.findOne({ equipmentId });

        // If no matching document is found, return a 404 error
        if (!installation) {
            return res.status(404).json({ message: 'No data found for the given equipment ID' });
        }

        // Send the found installation data
        res.status(200).json(installation);
    } catch (error) {
        res.status(500).json({ message: 'Internal Server Error' });
    }
});



// Get all installations
router.get('/', async (req, res) => {
    try {
        const installations = await Installation.find();
        res.status(200).json(installations);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get an installation by ID
router.get('/:id', async (req, res) => {
    try {
        const installation = await Installation.findById(req.params.id);
        if (!installation) return res.status(404).json({ message: 'Installation not found' });
        res.status(200).json(installation);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update an installation by ID
router.put('/:id', async (req, res) => {
    try {
        const installation = await Installation.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!installation) return res.status(404).json({ message: 'Installation not found' });
        res.status(200).json(installation);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Delete an installation by ID
router.delete('/:id', async (req, res) => {
    try {
        const installation = await Installation.findByIdAndDelete(req.params.id);
        if (!installation) return res.status(404).json({ message: 'Installation not found' });
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
