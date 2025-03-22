const express = require('express');
const router = express.Router();
const HubStock = require('../../Model/UploadSchema/HubStockSchema');
const DealerStock = require('../../Model/UploadSchema/DealerStockSchema');

// Middleware to get a HubStock by ID
async function getHubStockById(req, res, next) {
    let hubStock;
    try {
        hubStock = await HubStock.findById(req.params.id);
        if (!hubStock) {
            return res.status(404).json({ message: 'HubStock not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.hubStock = hubStock;
    next();
}

// Middleware to check for duplicate materialcode
async function checkDuplicateMaterialCode(req, res, next) {
    let hubStock;
    try {
        hubStock = await HubStock.findOne({
            materialcode: req.body.materialcode
        });
        if (hubStock && hubStock._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate material code found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

router.get('/hubstocks', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const hubStocks = await HubStock.find().skip(skip).limit(limit);
        const totalHubStocks = await HubStock.countDocuments();
        const totalPages = Math.ceil(totalHubStocks / limit);

        res.json({
            hubStocks,
            totalPages,
            totalHubStocks
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
router.get('/hubstocks/material-list', async (req, res) => {
    try {
        const results = await HubStock.aggregate([
            {
                $group: {
                    _id: {
                        materialcode: '$materialcode',
                        materialdescription: '$materialdescription'
                    }
                }
            },
            {
                // Reshape the output to have the fields directly
                $project: {
                    _id: 0,
                    materialcode: '$_id.materialcode',
                    materialdescription: '$_id.materialdescription'
                }
            }
        ]);

        res.json(results);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Example route: /collections/hubstocks/check-material/:materialcode
router.get('/hubstocks/check-material/:materialcode', async (req, res) => {
    try {
      const { materialcode } = req.params;
  
      // 1) Fetch matching documents from HubStock
      const hubStockData = await HubStock.find(
        { materialcode },
        { storagelocation: 1, quantity: 1, _id: 0 }
      );
  
      // 2) Fetch matching documents from DealerStock
      const dealerStockData = await DealerStock.find(
        { materialcode },
        { dealercity: 1, unrestrictedquantity: 1, _id: 0 }
      );
  
      // 3) Send both results back
      res.json({ hubStockData, dealerStockData });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });
  
// GET HubStock by ID
router.get('/hubstocks/:id', getHubStockById, (req, res) => {
    res.json(res.hubStock);
});

// CREATE a new HubStock
router.post('/hubstocks', checkDuplicateMaterialCode, async (req, res) => {
    const hubStock = new HubStock({
        materialcode: req.body.materialcode,
        materialdescription: req.body.materialdescription,
        quantity: req.body.quantity,
        storagelocation: req.body.storagelocation,
        status: req.body.status
    });
    try {
        const newHubStock = await hubStock.save();
        res.status(201).json(newHubStock);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a HubStock
router.put('/hubstocks/:id', getHubStockById, checkDuplicateMaterialCode, async (req, res) => {
    if (req.body.materialcode != null) {
        res.hubStock.materialcode = req.body.materialcode;
    }
    if (req.body.materialdescription != null) {
        res.hubStock.materialdescription = req.body.materialdescription;
    }
    if (req.body.quantity != null) {
        res.hubStock.quantity = req.body.quantity;
    }
    if (req.body.storagelocation != null) {
        res.hubStock.storagelocation = req.body.storagelocation;
    }
    if (req.body.status != null) {
        res.hubStock.status = req.body.status;
    }
    res.hubStock.updatedAt = Date.now();
    try {
        const updatedHubStock = await res.hubStock.save();
        res.json(updatedHubStock);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a HubStock
router.delete('/hubstocks/:id', getHubStockById, async (req, res) => {
    try {
        const deletedHubStock = await HubStock.deleteOne({ _id: req.params.id });
        if (deletedHubStock.deletedCount === 0) {
            return res.status(404).json({ message: 'HubStock Not Found' });
        }
        res.json({ message: 'Deleted HubStock' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/hubstocksearch', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q) {
            return res.status(400).json({ message: 'Query parameter is required' });
        }

        const isNumeric = !isNaN(q); // Check if the query is a numeric value

        const query = {
            $or: [
                { materialcode: { $regex: q, $options: 'i' } },
                { materialdescription: { $regex: q, $options: 'i' } },
                ...(isNumeric ? [{ quantity: Number(q) }] : []), // Add numeric search for quantity
                { storagelocation: { $regex: q, $options: 'i' } },
                { status: { $regex: q, $options: 'i' } }
            ]
        };

        const hubstocks = await HubStock.find(query);
        res.json(hubstocks);

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


module.exports = router;
