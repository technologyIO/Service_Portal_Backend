const express = require("express");
const router = express.Router();
const SpareMaster = require("../../Model/MasterSchema/SpareMasterSchema");
const Product = require("../../Model/MasterSchema/ProductSchema");

// Endpoint 1: Get SpareMaster data based on product part number
router.get("/search/:partno", async (req, res) => { 
  try {
    const partNo = req.params.partno;
    // Find the product by its part number
    const productData = await Product.findOne({ partnoid: partNo });
    if (!productData) {
      return res.status(404).json({ message: "Product not found with given part number" });
    }

    // Extract the subgroup from the product
    const subgrp = productData.subgrp;

    // Search SpareMaster records matching the subgroup
    const spareMasters = await SpareMaster.find({ Sub_grp: subgrp });
    if (spareMasters.length === 0) {
      return res.status(404).json({ message: `No SpareMaster records found for subgroup: ${subgrp}` });
    }

    // Map the result to return only PartNumber and Description
    const result = spareMasters.map(record => ({
      PartNumber: record.PartNumber,
      Description: record.Description,
      Image: record.spareiamegUrl
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

module.exports = router;
