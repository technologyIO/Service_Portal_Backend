const express = require('express');
const router = express.Router();
const PMDocMaster = require('../../Model/MasterSchema/pmDocMasterSchema');
const mongoose = require('mongoose');
router.get('/filter-options', async (req, res) => {
  try {
    const pmDocMasters = await PMDocMaster.find({}, {
      productGroup: 1,
      chlNo: 1,
      type: 1
    });

    const productGroups = [...new Set(pmDocMasters.map(pm => pm.productGroup).filter(Boolean))];
    const chlNos = [...new Set(pmDocMasters.map(pm => pm.chlNo).filter(Boolean))];
    const types = [...new Set(pmDocMasters.map(pm => pm.type).filter(Boolean))];

    res.json({
      productGroups: productGroups.sort(),
      chlNos: chlNos.sort(),
      types: types.sort()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET PM doc masters with filters
router.get('/filter', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filters = {};

    // Product Group filter
    if (req.query.productGroup) {
      filters.productGroup = req.query.productGroup;
    }

    // CHL No filter
    if (req.query.chlNo) {
      filters.chlNo = req.query.chlNo;
    }

    // Rev No filter
    if (req.query.revNo) {
      filters.revNo = req.query.revNo;
    }

    // Type filter
    if (req.query.type) {
      filters.type = req.query.type;
    }

    // Status filter
    if (req.query.status) {
      filters.status = req.query.status;
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

    const totalRecords = await PMDocMaster.countDocuments(filters);
    const docs = await PMDocMaster.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalPages = Math.ceil(totalRecords / limit);

    res.json({
      success: true,
      data: docs,
      totalRecords,
      totalPages,
      currentPage: page,
      filters: req.query
    });
  } catch (err) {
    console.error('Filter error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});
// 🔹 CREATE
router.post('/', async (req, res) => {
  try {
    const newDoc = new PMDocMaster(req.body);
    await newDoc.save();
    res.status(201).json({ success: true, data: newDoc });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 🔹 READ ALL (with pagination)
router.get('/all', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await PMDocMaster.countDocuments();
    const docs = await PMDocMaster.find().skip(skip).limit(limit).sort({ createdAt: -1 });

    res.json({
      success: true,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalRecords: total,
      data: docs,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 🔍 SEARCH Endpoint
router.get('/search-pmdocmaster', async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ message: 'Query parameter "q" is required and must be a string' });
    }

    const query = {
      $or: [
        { productGroup: { $regex: q, $options: 'i' } },
        { chlNo: { $regex: q, $options: 'i' } },
        { revNo: { $regex: q, $options: 'i' } },
        { type: { $regex: q, $options: 'i' } },
        { status: { $regex: q, $options: 'i' } },
      ],
    };

    const results = await PMDocMaster.find(query).skip(skip).limit(limit).sort({ createdAt: -1 });
    const totalPMDocMasters = await PMDocMaster.countDocuments(query);
    const totalPages = Math.ceil(totalPMDocMasters / limit);

    res.json({
      success: true,
      count: results.length,
      data: results,
      totalPages,
      totalPMDocMasters,
      currentPage: page,
      isSearch: true
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// BULK DELETE - CORRECTED ROUTE (removed /pm-doc-master/ prefix)
router.delete('/bulk', async (req, res) => {
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

    // Delete multiple PM doc masters
    const deleteResult = await PMDocMaster.deleteMany({
      _id: { $in: validIds }
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        message: 'No PM doc masters found to delete',
        deletedCount: 0
      });
    }

    res.json({
      message: `Successfully deleted ${deleteResult.deletedCount} PM doc masters`,
      deletedCount: deleteResult.deletedCount,
      requestedCount: validIds.length
    });

  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

// 🔹 READ ONE BY ID - PLACE AFTER BULK DELETE
router.get('/:id', async (req, res) => {
  try {
    const doc = await PMDocMaster.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 🔹 UPDATE BY ID
router.put('/:id', async (req, res) => {
  try {
    req.body.modifiedAt = new Date(); // Update timestamp
    const updated = await PMDocMaster.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// 🔹 DELETE BY ID
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await PMDocMaster.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
