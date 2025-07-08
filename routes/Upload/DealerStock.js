const express = require('express');
const router = express.Router();
const DealerStock = require('../../Model/UploadSchema/DealerStockSchema');

// Middleware to get a DealerStock by ID
async function getDealerStockById(req, res, next) {
    let dealerStock;
    try {
        dealerStock = await DealerStock.findById(req.params.id);
        if (!dealerStock) {
            return res.status(404).json({ message: 'DealerStock not found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.dealerStock = dealerStock;
    next();
}

// Middleware to check for duplicate materialcode
async function checkDuplicateMaterialCode(req, res, next) {
    let dealerStock;
    try {
        dealerStock = await DealerStock.findOne({
            materialcode: req.body.materialcode
        });
        if (dealerStock && dealerStock._id.toString() !== req.params.id) {
            return res.status(400).json({ message: 'Duplicate material code found' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    next();
}

// GET all DealerStocks
router.get('/dealerstocks', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;

        const skip = (page - 1) * limit;

        const dealerStocks = await DealerStock.find().skip(skip).limit(limit);
        const totalDealerStocks = await DealerStock.countDocuments();
        const totalPages = Math.ceil(totalDealerStocks / limit);

        res.json({
            dealerStocks,
            totalPages,
            totalDealerStocks
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET all DealerStock IDs
router.get('/dealerstocks/ids', async (req, res) => {
    try {
        // Using distinct() to get unique dealercodeid
        const dealerStockIds = await DealerStock.distinct('dealercodeid');
        res.json(dealerStockIds);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET dealer stock count by dealercodeid and group by dealercity
router.get('/dealerstocks/count/:dealercodeid', async (req, res) => {
    const { dealercodeid } = req.params;

    try {
        const dealerStocks = await DealerStock.aggregate([
            {
                // Filter records by the provided `dealercodeid`
                $match: {
                    dealercodeid: dealercodeid
                }
            },
            {
                // Group by `dealercity` and count the stocks in each city for the given `dealercodeid`
                $group: {
                    _id: "$dealercity",
                    stockCount: { $sum: 1 }
                }
            },
            {
                // Project the fields as per the desired output
                $project: {
                    _id: 0,
                    dealercity: "$_id",
                    stockCount: 1
                }
            }
        ]);

        res.json(dealerStocks);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/dealerstocks/materials/:dealercodeid', async (req, res) => {
    try {
      const { dealercodeid } = req.params;
  
      // Query DealerStock where dealercodeid matches
      // Only return materialcode, materialdescription, and unrestrictedquantity
      const results = await DealerStock.find(
        { dealercodeid },
        {
          materialcode: 1,
          materialdescription: 1,
          unrestrictedquantity: 1,
          _id: 0
        }
      );
  
      res.json(results);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });


// GET DealerStock by ID
router.get('/dealerstocks/:id', getDealerStockById, (req, res) => {
    res.json(res.dealerStock);
});

// CREATE a new DealerStock
router.post('/dealerstocks', checkDuplicateMaterialCode, async (req, res) => {
    const dealerStock = new DealerStock({
        dealercodeid: req.body.dealercodeid,
        dealername: req.body.dealername,
        dealercity: req.body.dealercity,
        materialcode: req.body.materialcode,
        materialdescription: req.body.materialdescription,
        plant: req.body.plant,
        unrestrictedquantity: req.body.unrestrictedquantity,
        status: req.body.status
    });
    try {
        const newDealerStock = await dealerStock.save();
        res.status(201).json(newDealerStock);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// UPDATE a DealerStock
router.put('/dealerstocks/:id', getDealerStockById, checkDuplicateMaterialCode, async (req, res) => {
    if (req.body.dealercodeid != null) {
        res.dealerStock.dealercodeid = req.body.dealercodeid;
    }
    if (req.body.dealername != null) {
        res.dealerStock.dealername = req.body.dealername;
    }
    if (req.body.dealercity != null) {
        res.dealerStock.dealercity = req.body.dealercity;
    }
    if (req.body.materialcode != null) {
        res.dealerStock.materialcode = req.body.materialcode;
    }
    if (req.body.materialdescription != null) {
        res.dealerStock.materialdescription = req.body.materialdescription;
    }
    if (req.body.plant != null) {
        res.dealerStock.plant = req.body.plant;
    }
    if (req.body.unrestrictedquantity != null) {
        res.dealerStock.unrestrictedquantity = req.body.unrestrictedquantity;
    }
    if (req.body.status != null) {
        res.dealerStock.status = req.body.status;
    }
    try {
        const updatedDealerStock = await res.dealerStock.save();
        res.json(updatedDealerStock);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE a DealerStock
router.delete('/dealerstocks/:id', getDealerStockById, async (req, res) => {
    try {
        const deletedDealerStock = await DealerStock.deleteOne({ _id: req.params.id });
        if (deletedDealerStock.deletedCount === 0) {
            return res.status(404).json({ message: 'DealerStock Not Found' });
        }
        res.json({ message: 'Deleted DealerStock' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/dealerstocksearch', async (req, res) => {
    try {
        const { q } = req.query;

        // Check if query parameter 'q' exists
        if (!q || q.trim() === '') {
            return res.status(400).json({ message: 'The "q" query parameter is required and cannot be empty.' });
        }

        // Parse 'q' to a number if it's numeric
        const numericQuery = !isNaN(q) ? Number(q) : null;

        // Build the query
        const query = {
            $or: [
                { dealercodeid: { $regex: q, $options: 'i' } },
                { dealername: { $regex: q, $options: 'i' } },
                { dealercity: { $regex: q, $options: 'i' } },
                { materialcode: { $regex: q, $options: 'i' } },
                { materialdescription: { $regex: q, $options: 'i' } },
                { plant: { $regex: q, $options: 'i' } },
                ...(numericQuery !== null ? [{ unrestrictedquantity: numericQuery }] : []),  
                { status: { $regex: q, $options: 'i' } },
            ]
        };

        // Fetch the matching dealer stocks
        const dealerstocks = await DealerStock.find(query);

        // Respond with the fetched data
        res.json(dealerstocks);
    } catch (err) {
        console.error(err); // Log the error for debugging
        res.status(500).json({ message: 'An error occurred while processing your request.', error: err.message });
    }
});



module.exports = router;
