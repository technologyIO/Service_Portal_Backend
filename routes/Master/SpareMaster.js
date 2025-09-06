const express = require("express");
const router = express.Router();
const SpareMaster = require("../../Model/MasterSchema/SpareMasterSchema");
const Product = require("../../Model/MasterSchema/ProductSchema");
const mongoose = require('mongoose');


router.get("/spare-by-partno/:partno", async (req, res) => {
  try {
    const { partno } = req.params;

    // Step 1: Find product using partnoid
    const product = await Product.findOne({ partnoid: partno });

    if (!product) {
      return res.status(404).json({ message: "Product not found with this part number" });
    }

    // 🔒 Step 1.5: Check if the product is beyond end of support
    const today = new Date();
    if (product.endofsupportdate && product.endofsupportdate < today) {
      return res.status(410).json({
        message: `This product has reached end of support on ${product.endofsupportdate.toDateString()}`,
        endofsupport: true
      });
    }

    const subgrp = product.subgrp;

    // Step 2: Find SpareMasters with matching Sub_grp
    const spares = await SpareMaster.find({ Sub_grp: subgrp });

    if (spares.length === 0) {
      return res.status(404).json({ message: `No spares found for subgroup: ${subgrp}` });
    }

    // Step 3: Return required fields
    const result = spares.map(spare => ({
      PartNumber: spare.PartNumber,
      Description: spare.Description,
      Type: spare.Type,
      Rate: spare.Rate,
      DP: spare.DP,
      Charges: spare.Charges,
      Image: spare.spareiamegUrl
    }));

    res.status(200).json({
      productPartNo: partno,
      subgroup: subgrp,
      totalSpares: result.length,
      spares: result
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


// Endpoint 1: Get SpareMaster data based on product part number
router.get("/search/:partno", async (req, res) => {
  try {
    const partNo = req.params.partno;

    // Find the product by its part number
    const productData = await Product.findOne({ partnoid: partNo, status: { $ne: "Inactive" } });
    if (!productData) {
      return res.status(404).json({ message: "Product not found or inactive" });
    }

    // Extract the subgroup from the product
    const subgrp = productData.subgrp;

    // Search SpareMaster records matching the subgroup (exclude inactive)
    const spareMasters = await SpareMaster.find({ Sub_grp: subgrp, status: { $ne: "Inactive" } });
    if (spareMasters.length === 0) {
      return res.status(404).json({ message: `No active SpareMaster records found for subgroup: ${subgrp}` });
    }

    // Map the result to return only PartNumber, Description, and Image
    const result = spareMasters.map(record => ({
      PartNumber: record.PartNumber,
      Description: record.Description,
      Image: record.spareImageUrl // corrected field name
    }));

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get paginated SpareMaster data
router.get("/addsparemaster/paginated", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Default page = 1
    const limit = parseInt(req.query.limit) || 10; // Default limit = 10
    const skip = (page - 1) * limit;

    const spareMasters = await SpareMaster.find().skip(skip).limit(limit);
    const totalSpareMasters = await SpareMaster.countDocuments();
    const totalPages = Math.ceil(totalSpareMasters / limit);

    res.status(200).json({
      spareMasters,
      totalPages,
      totalSpareMasters
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// BULK DELETE Spare Master entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/addsparemaster/bulk', async (req, res) => {
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

    // Delete multiple spare masters
    const deleteResult = await SpareMaster.deleteMany({
      _id: { $in: validIds }
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        message: 'No spare masters found to delete',
        deletedCount: 0
      });
    }

    res.json({
      message: `Successfully deleted ${deleteResult.deletedCount} spare masters`,
      deletedCount: deleteResult.deletedCount,
      requestedCount: validIds.length
    });

  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

// Create a new SpareMaster
router.post("/addsparemaster", async (req, res) => {
  try {
    const newSpareMaster = new SpareMaster(req.body); // Use a different variable name
    await newSpareMaster.save();
    res.status(201).json(newSpareMaster);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get all SpareMasters
router.get("/addsparemaster", async (req, res) => {
  try {
    const spareMasters = await SpareMaster.find();
    res.status(200).json(spareMasters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get a single SpareMaster by ID
router.get("/addsparemaster/:id", async (req, res) => {
  try {
    const spareMaster = await SpareMaster.findById(req.params.id);
    if (!spareMaster) return res.status(404).json({ message: "SpareMaster not found" });
    res.status(200).json(spareMaster);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a SpareMaster by ID
router.put("/addsparemaster/:id", async (req, res) => {
  try {
    const updatedSpareMaster = await SpareMaster.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!updatedSpareMaster) return res.status(404).json({ message: "SpareMaster not found" });
    res.status(200).json(updatedSpareMaster);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete a SpareMaster by ID
router.delete("/spare/:id", async (req, res) => {
  try {
    const deletedSpareMaster = await SpareMaster.findByIdAndDelete(req.params.id);
    if (!deletedSpareMaster) return res.status(404).json({ message: "SpareMaster not found" });
    res.status(200).json({ message: "SpareMaster deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.get('/searched/spare', async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!q || q.trim() === '') {
      return res.status(400).json({ message: 'Query is required' });
    }

    const query = {
      $or: [
        { Sub_grp: { $regex: q, $options: 'i' } },
        { PartNumber: { $regex: q, $options: 'i' } },
        { Description: { $regex: q, $options: 'i' } },
        { Type: { $regex: q, $options: 'i' } },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$Rate" },
              regex: q,
              options: "i"
            }
          }
        },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$DP" },
              regex: q,
              options: "i"
            }
          }
        },
        {
          $expr: {
            $regexMatch: {
              input: { $toString: "$Charges" },
              regex: q,
              options: "i"
            }
          }
        }
      ]
    };

    const spareMasters = await SpareMaster.find(query).skip(skip).limit(limit);
    const totalSpareMasters = await SpareMaster.countDocuments(query);
    const totalPages = Math.ceil(totalSpareMasters / limit);

    res.status(200).json({
      spareMasters,
      totalPages,
      totalSpareMasters,
      currentPage: page,
      isSearch: true
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});




module.exports = router;
