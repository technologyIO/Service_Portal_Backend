const express = require('express');
const router = express.Router();
const PM = require('../../Model/UploadSchema/PMSchema'); // Adjust path based on your folder structure
const Product = require('../../Model/MasterSchema/ProductSchema');
const User = require('../../Model/MasterSchema/UserSchema');
const CheckList = require('../../Model/CollectionSchema/ChecklistSchema');
const Branch = require('../../Model/CollectionSchema/BranchSchema');
const State = require('../../Model/CollectionSchema/StateSchema');
const nodemailer = require('nodemailer');
const Customer = require('../../Model/UploadSchema/CustomerSchema');
const PMDocMaster = require('../../Model/MasterSchema/pmDocMasterSchema');
const pdf = require('html-pdf');
const { getChecklistHTMLPM } = require("./checklistTemplatepm"); // DO NOT change its design
const FormatMaster = require("../../Model/MasterSchema/FormatMasterSchema");

const mongoose = require('mongoose');


const pdfStore = {};
const otpStore = {};
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'webadmin@skanray-access.com',
    pass: 'rdzegwmzirvbjcpm'
  }
});
router.get('/pms/search', async (req, res) => {
  try {
    const {
      q = '',
      page = 1,
      limit = 10,
      pmType,
      region,
      city,
      pmStatus
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    let searchQuery = {}; // REMOVE status filter from default query

    // General search in multiple fields
    if (q && q.trim()) {
      searchQuery.$or = [
        { pmNumber: new RegExp(q, 'i') },
        { serialNumber: new RegExp(q, 'i') },
        { materialDescription: new RegExp(q, 'i') },
        { customerCode: new RegExp(q, 'i') },
        { pmVendorCode: new RegExp(q, 'i') },
        { pmEngineerCode: new RegExp(q, 'i') },
        { partNumber: new RegExp(q, 'i') },
        { documentnumber: new RegExp(q, 'i') },
        { region: new RegExp(q, 'i') },      // Add region to search
        { city: new RegExp(q, 'i') },        // Add city to search
        { pmType: new RegExp(q, 'i') },      // Add pmType to search
        { pmStatus: new RegExp(q, 'i') }     // Add pmStatus to search
      ];
    }

    // Apply filters
    if (pmType) searchQuery.pmType = pmType;
    if (region) searchQuery.region = region;
    if (city) searchQuery.city = city;
    if (pmStatus) searchQuery.pmStatus = pmStatus;

    // Execute search
    const [results, totalCount] = await Promise.all([
      PM.find(searchQuery)
        .lean()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      PM.countDocuments(searchQuery)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      success: true,
      pms: results,
      totalPages: totalPages,
      totalPms: totalCount,
      currentPage: parseInt(page),
      hasNext: parseInt(page) < totalPages,
      hasPrev: parseInt(page) > 1
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: error.message
    });
  }
});

// Middleware to get a PM by ID
async function getPMById(req, res, next) {
  let pm;
  try {
    pm = await PM.findById(req.params.id);
    if (!pm) {
      return res.status(404).json({ message: 'PM record not found' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  res.pm = pm;
  next();
}

// Middleware to check for duplicate pmNumber
async function checkDuplicatePMNumber(req, res, next) {
  let pm;
  try {
    pm = await PM.findOne({ pmNumber: req.body.pmNumber });
    if (pm && pm._id.toString() !== req.params.id) {
      return res.status(400).json({ message: 'Duplicate PM number found' });
    }
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
  next();
}

router.get('/pms/filter', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      dateFrom,
      dateTo,
      pmStatus,
      region
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Build aggregation pipeline
    const pipeline = [];

    // Stage 1: Convert pmDoneDate string to Date for filtering
    pipeline.push({
      $addFields: {
        pmDoneDateConverted: {
          $cond: {
            if: { $and: [{ $ne: ["$pmDoneDate", null] }, { $ne: ["$pmDoneDate", ""] }] },
            then: {
              $dateFromString: {
                dateString: "$pmDoneDate",
                format: "%d/%m/%Y",
                onError: null
              }
            },
            else: null
          }
        }
      }
    });

    // Stage 2: Build match conditions
    const matchConditions = {};

    // Date range filter
    if (dateFrom || dateTo) {
      matchConditions.pmDoneDateConverted = {};
      if (dateFrom) {
        const startDate = new Date(dateFrom);
        startDate.setHours(0, 0, 0, 0);
        matchConditions.pmDoneDateConverted.$gte = startDate;
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        matchConditions.pmDoneDateConverted.$lte = endDate;
      }
    }

    // Status filter
    if (pmStatus && pmStatus !== 'all') {
      matchConditions.pmStatus = { $regex: pmStatus, $options: 'i' };
    }

    // Region filter
    if (region && region !== 'all') {
      matchConditions.region = { $regex: region, $options: 'i' };
    }

    // Add match stage if there are conditions
    if (Object.keys(matchConditions).length > 0) {
      pipeline.push({ $match: matchConditions });
    }

    // Stage 3: Sort
    pipeline.push({ $sort: { createdAt: -1 } });

    // Execute aggregation for total count
    const totalCountPipeline = [...pipeline, { $count: "total" }];
    const totalCountResult = await PM.aggregate(totalCountPipeline);
    const totalCount = totalCountResult.length > 0 ? totalCountResult[0].total : 0;

    // Execute aggregation for paginated data
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNumber });

    const pms = await PM.aggregate(pipeline);

    // Remove the converted field from results
    const cleanedPMs = pms.map(pm => {
      const { pmDoneDateConverted, ...rest } = pm;
      return rest;
    });

    // Enrich with customer data (existing code)
    const customerCodes = [...new Set(cleanedPMs.map(pm => pm.customerCode).filter(Boolean))];
    const customers = await Customer.find({ customercodeid: { $in: customerCodes } })
      .select('customercodeid customername hospitalname street city region email')
      .lean();

    const customerMap = customers.reduce((map, customer) => {
      map[customer.customercodeid] = customer;
      return map;
    }, {});

    const enrichedPMs = cleanedPMs.map(pm => {
      const customer = customerMap[pm.customerCode];
      if (customer) {
        return {
          ...pm,
          email: customer.email?.trim() || null,
          customercodeid: customer.customercodeid,
          customername: customer.customername,
          hospitalname: customer.hospitalname,
          street: customer.street,
          city: customer.city,
          customerRegion: customer.region
        };
      }
      return pm;
    });

    const totalPages = Math.ceil(totalCount / limitNumber);

    res.json({
      success: true,
      data: enrichedPMs,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalRecords: totalCount,
        recordsPerPage: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
        recordsOnCurrentPage: enrichedPMs.length
      },
      filters: {
        applied: Object.keys(matchConditions).length > 0,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        pmStatus: pmStatus || null,
        region: region || null
      }
    });

  } catch (err) {
    console.error('Filter API error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch filtered PM records',
      error: err.message
    });
  }
});


// GET available regions for autocomplete
router.get('/pms/regions', async (req, res) => {
  try {
    const regions = await PM.distinct('region');
    const validRegions = regions.filter(region => region && region.trim() !== '');

    res.json({
      success: true,
      regions: validRegions.sort()
    });
  } catch (err) {
    console.error('Regions API error:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch regions',
      error: err.message
    });
  }
});

// BULK DELETE PM entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/pms/bulk', async (req, res) => {
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

    // Delete multiple PM records
    const deleteResult = await PM.deleteMany({
      _id: { $in: validIds }
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        message: 'No PM records found to delete',
        deletedCount: 0
      });
    }

    res.json({
      message: `Successfully deleted ${deleteResult.deletedCount} PM records`,
      deletedCount: deleteResult.deletedCount,
      requestedCount: validIds.length
    });

  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/allpms/:employeeid?', async (req, res) => {
  try {
    const { employeeid } = req.params;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    // Precompute allowed months
    const thisMonth = `${(currentMonth + 1).toString().padStart(2, '0')}/${currentYear}`;
    const nextMonth = `${(currentMonth + 2).toString().padStart(2, '0')}/${currentYear}`;
    const allowedDueMonths = [thisMonth, nextMonth];

    if (employeeid) {
      // Optimized user data retrieval
      const user = await User.findOne({ employeeid })
        .select('demographics skills')
        .lean();

      if (!user) return res.status(404).json({ message: 'User not found' });

      // Extract branch codes efficiently
      const branchDemographic = user.demographics.find(d => d.type === 'branch');
      let userBranchShortCodes = [];

      if (branchDemographic) {
        const values = branchDemographic.values;
        if (values.some(v => v.branchShortCode)) {
          userBranchShortCodes = values.map(v => v.branchShortCode).filter(Boolean);
        } else {
          const branchIds = values.filter(v => v.id).map(v => v.id);
          const branchNames = values.filter(v => v.name && !v.id).map(v => v.name);

          const branchQueries = [];
          if (branchIds.length) branchQueries.push({ _id: { $in: branchIds } });
          if (branchNames.length) branchQueries.push({ name: { $in: branchNames } });

          if (branchQueries.length) {
            const branches = await Branch.find({ $or: branchQueries })
              .select('branchShortCode')
              .lean();
            userBranchShortCodes = branches.map(b => b.branchShortCode);
          }
        }
      }

      if (!userBranchShortCodes.length) {
        return res.json({ pms: [], count: 0, filteredByEmployee: true });
      }

      // Get part numbers
      const partNumbers = user.skills.flatMap(skill =>
        (skill.partNumbers || []).filter(Boolean)
      );

      if (!partNumbers.length) {
        return res.json({ pms: [], count: 0, filteredByEmployee: true });
      }

      // Single optimized query for PM data
      const pms = await PM.find({
        partNumber: { $in: partNumbers },
        $or: [
          { pmStatus: "Overdue" },
          {
            pmStatus: "Due",
            pmDueMonth: { $in: allowedDueMonths } // Now includes current + next month
          }
        ]
      }).lean();

      if (!pms.length) {
        return res.json({ pms: [], count: 0, filteredByEmployee: true });
      }

      // Batch process customer data
      const customerCodes = [...new Set(pms.map(pm => pm.customerCode).filter(Boolean))];
      const customers = await Customer.find({ customercodeid: { $in: customerCodes } })
        .select('customercodeid customername hospitalname street city region email')
        .lean();

      const customerMap = customers.reduce((map, customer) => {
        map[customer.customercodeid] = customer;
        return map;
      }, {});

      // Batch process region data
      const customerRegions = [...new Set(customers.map(c => c.region).filter(Boolean))];
      const states = await State.find({ stateId: { $in: customerRegions } }).lean();
      const stateMap = states.reduce((map, state) => {
        map[state.stateId] = state.name;
        return map;
      }, {});

      // Batch process branch data
      const stateNames = [...new Set(Object.values(stateMap).filter(Boolean))];
      const branches = await Branch.find({ state: { $in: stateNames } })
        .select('branchShortCode state')
        .lean();

      const allowedBranches = branches.filter(b =>
        userBranchShortCodes.includes(b.branchShortCode)
      );
      const allowedStates = [...new Set(allowedBranches.map(b => b.state))];

      // Final filtering and mapping
      const finalPMs = pms.reduce((result, pm) => {
        const customer = customerMap[pm.customerCode];
        if (!customer) return result;

        const stateName = stateMap[customer.region];
        if (!stateName || !allowedStates.includes(stateName)) return result;

        const pmObj = {
          ...pm,
          email: customer.email?.trim() || null,
          customername: customer.customername,
          hospitalname: customer.hospitalname,
          street: customer.street,
          city: customer.city,
          region: customer.region
        };

        result.push(pmObj);
        return result;
      }, []);

      return res.json({
        pms: finalPMs,
        count: finalPMs.length,
        filteredByEmployee: true
      });
    }

    // Non-employee path optimization
    const pms = await PM.find({
      $or: [
        { pmStatus: "Overdue" },
        { pmStatus: "Due", pmDueMonth: { $in: allowedDueMonths } }
      ]
    }).lean();

    const customerCodes = [...new Set(pms.map(pm => pm.customerCode).filter(Boolean))];
    const customers = await Customer.find({ customercodeid: { $in: customerCodes } })
      .select('customercodeid customername hospitalname street city region email')
      .lean();

    const customerMap = customers.reduce((map, customer) => {
      map[customer.customercodeid] = customer;
      return map;
    }, {});

    const enrichedAll = pms.map(pm => {
      const customer = customerMap[pm.customerCode];
      return customer ? {
        ...pm,
        email: customer.email?.trim() || null,
        customercodeid: customer.customercodeid,
        customername: customer.customername,
        hospitalname: customer.hospitalname,
        street: customer.street,
        city: customer.city,
        region: customer.region
      } : pm;
    });

    return res.json({
      pms: enrichedAll,
      count: enrichedAll.length,
      filteredByEmployee: false
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


// GET all PM records with pagination
router.get('/allpms', async (req, res) => {
  try {


    const pms = await PM.find();


    res.json({
      pms,

    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});
router.get('/pms', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pms = await PM.find().skip(skip).limit(limit);
    const totalPms = await PM.countDocuments();
    const totalPages = Math.ceil(totalPms / limit);

    res.json({
      pms,
      totalPages,
      totalPms
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET PM record by ID
router.get('/pms/:id', getPMById, (req, res) => {
  res.json(res.pm);
});

// CREATE a new PM record
router.post('/pms', checkDuplicatePMNumber, async (req, res) => {
  const pm = new PM({
    pmType: req.body.pmType,
    pmNumber: req.body.pmNumber,
    materialDescription: req.body.materialDescription,
    serialNumber: req.body.serialNumber,
    customerCode: req.body.customerCode,
    region: req.body.region,
    branch: req.body.branch,
    city: req.body.city,
    pmDueMonth: req.body.pmDueMonth,
    pmDoneDate: req.body.pmDoneDate,
    pmVendorCode: req.body.pmVendorCode,
    pmEngineerCode: req.body.pmEngineerCode,
    pmStatus: req.body.pmStatus
  });
  try {
    const newPM = await pm.save();
    res.status(201).json(newPM);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// UPDATE a PM record
router.put('/pms/:id', getPMById, async (req, res) => {
  const updates = [
    'pmType',
    'pmNumber',
    'materialDescription',
    'serialNumber',
    'customerCode',
    'region',
    'branch',
    'city',
    'pmDueMonth',
    'pmDoneDate',
    'pmVendorCode',
    'pmEngineerCode',
    'pmStatus',
    'partNumber',
    'status' // Added status to the update list
  ];

  updates.forEach(field => {
    if (req.body[field] != null) {
      res.pm[field] = req.body[field];
    }
  });

  try {
    const updatedPM = await res.pm.save();
    res.json(updatedPM);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});



// DELETE a PM record
router.delete('/pms/:id', getPMById, async (req, res) => {
  try {
    const deletedPM = await PM.deleteOne({ _id: req.params.id });
    if (deletedPM.deletedCount === 0) {
      return res.status(404).json({ message: 'PM record not found' });
    }
    res.json({ message: 'Deleted PM record' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get('/pmsearch', async (req, res) => {
  try {
    const { q, page = 1, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Current and next month values
    const now = new Date();
    const thisMonth = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
    const next = new Date(now);
    next.setMonth(now.getMonth() + 1);
    const nextMonth = `${(next.getMonth() + 1).toString().padStart(2, '0')}/${next.getFullYear()}`;
    const allowedDueMonths = new Set([thisMonth, nextMonth]);

    const isAllowedPM = pm =>
      (pm.pmStatus === "Overdue") ||
      (pm.pmStatus === "Due" && allowedDueMonths.has((pm.pmDueMonth || "").trim()));

    // First get customer matches
    const matchingCustomers = await Customer.find({
      $or: [
        { customername: { $regex: q, $options: 'i' } },
        { hospitalname: { $regex: q, $options: 'i' } },
        { customercodeid: { $regex: q, $options: 'i' } }
      ]
    }).select('customercodeid');

    const matchingCustomerCodes = matchingCustomers.map(c => c.customercodeid);

    // Build OR query
    const query = {
      $or: [
        { pmType: { $regex: q, $options: 'i' } },
        { pmNumber: { $regex: q, $options: 'i' } },
        { materialDescription: { $regex: q, $options: 'i' } },
        { serialNumber: { $regex: q, $options: 'i' } },
        { customerCode: { $regex: q, $options: 'i' } },
        { region: { $regex: q, $options: 'i' } },
        { branch: { $regex: q, $options: 'i' } },
        { city: { $regex: q, $options: 'i' } },
        { pmVendorCode: { $regex: q, $options: 'i' } },
        { pmEngineerCode: { $regex: q, $options: 'i' } },
        { pmStatus: { $regex: q, $options: 'i' } }
      ]
    };

    if (matchingCustomerCodes.length > 0) {
      query.$or.push({ customerCode: { $in: matchingCustomerCodes } });
    }

    // First fetch ALL matches
    const allMatchingPMs = await PM.find(query).sort({ createdAt: -1 });

    // Apply Due/Overdue filter in-memory
    const filteredPMs = allMatchingPMs.filter(isAllowedPM);

    const totalRecords = filteredPMs.length;
    const totalPages = Math.ceil(totalRecords / limitNumber);
    const paginatedPMs = filteredPMs.slice(skip, skip + limitNumber);

    const customerCodes = [...new Set(paginatedPMs.map(pm => pm.customerCode).filter(Boolean))];
    const customers = await Customer.find({ customercodeid: { $in: customerCodes } })
      .select('customercodeid customername hospitalname street city region email');

    const customerMap = {};
    customers.forEach(c => customerMap[c.customercodeid] = c);

    const enrichedPMs = paginatedPMs.map(pm => {
      const customer = customerMap[pm.customerCode];
      const pmObj = pm.toObject();

      if (customer) {
        pmObj.email = customer.email?.trim();
        pmObj.customercodeid = customer.customercodeid;
        pmObj.customername = customer.customername;
        pmObj.hospitalname = customer.hospitalname;
        pmObj.street = customer.street;
        pmObj.city = customer.city;
        pmObj.region = customer.region;
      }

      return pmObj;
    });

    res.json({
      pms: enrichedPMs,
      totalPages,
      currentPage: pageNumber,
      totalRecords,
      hasNextPage: pageNumber < totalPages,
      hasPrevPage: pageNumber > 1
    });

  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: err.message });
  }
});







router.get('/checklist/by-part/:partnoid', async (req, res) => {
  try {
    const partnoid = req.params.partnoid;

    // Find the product using the provided partnoid
    const product = await Product.findOne({ partnoid });
    if (!product) {
      return res.status(404).json({ message: 'Product not found for the provided part number' });
    }

    // Get the product group from the found product
    const productGroup = product.productgroup;

    // Find checklists where prodGroup matches the product group
    const checklists = await CheckList.find({ prodGroup: productGroup })
      .select('checklisttype checkpointtype checkpoint prodGroup result status createdAt modifiedAt resulttype endVoltage startVoltage');

    res.json({
      productGroup,
      checklists
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/docs/by-part/:partnoid', async (req, res) => {
  try {
    const partnoid = req.params.partnoid;

    // Step 1: Find the product using partnoid
    const product = await Product.findOne({ partnoid });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found for the provided part number'
      });
    }

    // Step 2: Extract product group
    const productGroup = product.productgroup;

    // Step 3: Find documents from PMDocMaster (PM type) and FormatMaster
    const [pmDocs, formatDocs] = await Promise.all([
      // PM Documents from PMDocMaster
      PMDocMaster.find({
        productGroup: productGroup,
        type: 'PM'
      }).select('chlNo revNo type status createdAt modifiedAt'),

      // Format Documents from FormatMaster
      FormatMaster.find({
        productGroup: productGroup,
        type: 'PM'
      }).select('chlNo revNo type status createdAt updatedAt')
    ]);

    res.json({
      success: true,
      productGroup,
      // PM Documents from PMDocMaster in 'documents' array
      documents: pmDocs.map(doc => ({
        chlNo: doc.chlNo,
        revNo: doc.revNo,
      })),
      // Format Documents from FormatMaster in 'formats' array
      formats: formatDocs.map(doc => ({
        chlNo: doc.chlNo,
        revNo: doc.revNo,

      }))
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});



router.post("/otp/send", async (req, res) => {
  try {
    const { customerCode } = req.body;
    if (!customerCode) {
      return res.status(400).json({ message: "Customer code is required" });
    }

    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer) {
      return res.status(404).json({
        message: "Customer not found for the given customer code"
      });
    }

    const email = customer.email;
    if (!email) {
      return res
        .status(404)
        .json({ message: "No email found for this customer" });
    }

    // 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in memory with expiration (5 minutes = 300000 milliseconds)
    global.otpStore = global.otpStore || {};
    global.otpStore[customerCode] = {
      otp,
      timestamp: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000) // 5 minutes from now
    };

    // Send via nodemailer
    await transporter.sendMail({
      from: "webadmin@skanray-access.com",
      to: email,
      subject: "Your OTP Code - Valid for 5 Minutes",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">OTP Verification</h2>
          <p>Your OTP code is:</p>
          <div style="background-color: #f0f0f0; padding: 20px; text-align: center; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 8px;">${otp}</span>
          </div>
          <p style="color: #dc3545; font-weight: bold;">⚠️ This OTP will expire in 5 minutes.</p>
          <p style="color: #666; font-size: 14px;">If you didn't request this OTP, please ignore this email.</p>
        </div>
      `
    });

    res.json({
      message: "OTP sent successfully to " + email,
      expiresIn: "5 minutes"
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post("/otp/verify", async (req, res) => {
  try {
    const { customerCode, otp } = req.body;

    if (!customerCode || !otp) {
      return res.status(400).json({
        message: "Customer code and OTP are required"
      });
    }

    // Initialize OTP store if it doesn't exist
    global.otpStore = global.otpStore || {};
    const record = global.otpStore[customerCode];

    // Check if OTP record exists
    if (!record) {
      return res.status(400).json({
        message: "No OTP found for this customer. Please request a new OTP."
      });
    }

    // Check if OTP has expired (5 minutes = 300000 milliseconds)
    const currentTime = Date.now();
    const otpAge = currentTime - record.timestamp;
    const EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (otpAge > EXPIRY_TIME) {
      // Remove expired OTP from store
      delete global.otpStore[customerCode];

      // Calculate how long ago it expired
      const expiredMinutes = Math.floor((otpAge - EXPIRY_TIME) / (60 * 1000));
      const expiredSeconds = Math.floor(((otpAge - EXPIRY_TIME) % (60 * 1000)) / 1000);

      return res.status(400).json({
        message: `OTP has expired ${expiredMinutes > 0 ? expiredMinutes + ' minutes and ' : ''}${expiredSeconds} seconds ago. Please request a new OTP.`
      });
    }

    // Check if OTP matches
    if (record.otp !== otp) {
      return res.status(400).json({
        message: "Invalid OTP. Please check and try again."
      });
    }

    // Remove from store after successful verification (one-time use)
    delete global.otpStore[customerCode];

    // Double-check the customer exists
    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer || !customer.email) {
      return res.status(404).json({
        message: "Customer or customer email not found"
      });
    }

    // Calculate remaining time for logging purposes
    const remainingTime = EXPIRY_TIME - otpAge;
    const remainingMinutes = Math.floor(remainingTime / (60 * 1000));
    const remainingSeconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

    console.log(`OTP verified for customer ${customerCode} with ${remainingMinutes}:${remainingSeconds.toString().padStart(2, '0')} remaining`);

    res.json({
      message: "OTP verified successfully",
      customerCode: customerCode,
      verifiedAt: new Date().toISOString(),
      customerEmail: customer.email
    });

  } catch (err) {
    console.error("OTP verification error:", err);
    res.status(500).json({
      message: "Internal server error during OTP verification"
    });
  }
});


// ==========================
// (B) ONE-BY-ONE PM Processing Route
// ==========================
//
// You call this from the frontend for each PM after OTP is verified.
// This route does two things:
//   1) Updates the PM record in Mongo with new partNumber, doneDate, etc.
//   2) Generates a PDF with your custom design (embedding the PM & checklist data).
//   3) Stores the PDF buffer into pdfStore[customerCode] so that we can later
//      attach them all in the final email route.
//
// GET filtered PM records with advanced filtering and pagination
// GET filtered PM records - Simple 3 filters only



router.post("/reportAndUpdate", async (req, res) => {
  try {
    const { pmData, checklistData, customerCode, globalRemark, userInfo } = req.body;

    // ✅ Add debugging logs
    console.log("=== REPORT AND UPDATE API CALLED ===");
    console.log("pmData:", JSON.stringify(pmData, null, 2));
    console.log("checklistData:", JSON.stringify(checklistData, null, 2));
    console.log("customerCode:", customerCode);
    console.log("globalRemark:", globalRemark);
    console.log("userInfo:", JSON.stringify(userInfo, null, 2));

    if (!pmData || !customerCode) {
      return res.status(400).json({ message: "PM data and customer code are required" });
    }

    const existingPm = await PM.findById(pmData._id);
    if (!existingPm) {
      return res.status(404).json({ message: "PM record not found" });
    }

    console.log("existingPm found:", existingPm.pmNumber);

    // Generate and assign new pmNumber if not present
    if (!existingPm.pmNumber) {
      try {
        // Find all existing PM numbers sorted numerically
        const allPMs = await PM.find({ pmNumber: { $regex: /^PM\d+$/ } })
          .sort({ pmNumber: 1 });

        let nextNumber = 1; // Default starting number

        if (allPMs.length > 0) {
          // Extract all existing numbers
          const existingNumbers = allPMs.map(pm => {
            const numStr = pm.pmNumber.replace('PM', '');
            return parseInt(numStr, 10);
          }).filter(num => !isNaN(num));

          // Find the first gap in numbering or the next number
          for (let i = 0; i < existingNumbers.length; i++) {
            if (existingNumbers[i] !== i + 1) {
              nextNumber = i + 1;
              break;
            }
          }

          // If no gaps found, use next number after highest
          if (nextNumber === 1 && existingNumbers.length > 0) {
            nextNumber = Math.max(...existingNumbers) + 1;
          }
        }

        // Format with leading zeros (minimum 4 digits, but can be more)
        const newPmNumber = "PM" + nextNumber.toString().padStart(4, "0");

        // Final check for uniqueness
        const exists = await PM.findOne({ pmNumber: newPmNumber });
        if (exists) {
          // If by some chance it exists, find next available
          let tempNumber = nextNumber + 1;
          while (true) {
            const tempPmNumber = "PM" + tempNumber.toString().padStart(4, "0");
            const tempExists = await PM.findOne({ pmNumber: tempPmNumber });
            if (!tempExists) {
              existingPm.pmNumber = tempPmNumber;
              break;
            }
            tempNumber++;
          }
        } else {
          existingPm.pmNumber = newPmNumber;
        }

        console.log("Generated new PM number:", existingPm.pmNumber);
      } catch (err) {
        console.error("Error generating PM number:", err);
        // Fallback to timestamp-based number if something goes wrong
        const timestamp = Date.now();
        existingPm.pmNumber = "PM" + timestamp.toString().slice(-6); // Use last 6 digits
      }
    }

    // Update necessary fields
    existingPm.pmDoneDate = pmData.pmDoneDate || existingPm.pmDoneDate;
    existingPm.pmEngineerCode = userInfo.employeeId || existingPm.pmEngineerCode;
    existingPm.pmStatus = pmData.pmStatus || existingPm.pmStatus;

    await existingPm.save();
    console.log("PM record updated successfully");

    // Fetch customer data
    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer) {
      console.log("Customer not found for code:", customerCode);
      return res.status(404).json({ message: "Customer not found" });
    }

    console.log("Customer found:", customer.hospitalname);

    // ✅ Process checklist data with proper validation
    const processedChecklistItems = [];
    if (checklistData && Array.isArray(checklistData)) {
      console.log("Processing checklist items:", checklistData.length);

      checklistData.forEach((item, index) => {
        console.log(`Checklist item ${index}:`, JSON.stringify(item, null, 2));
        processedChecklistItems.push({
          checkpoint: item.checkpoint || item.description || `Checkpoint ${index + 1}`,
          result: item.result || item.status || "N/A",
          remark: item.remark || item.remarks || item.comment || ""
        });
      });
    } else {
      console.log("No valid checklist data found, using empty array");
    }

    console.log("Processed checklist items:", processedChecklistItems.length);

    // ✅ Prepare parameters for HTML generation
    const htmlParams = {
      reportNo: existingPm.pmNumber || "N/A",
      date: existingPm.pmDoneDate || new Date().toLocaleDateString(),
      customer: customer,
      machine: {
        partNumber: existingPm.partNumber || pmData.partNumber || "N/A",
        modelDescription: existingPm.materialDescription || pmData.materialDescription || "N/A",
        serialNumber: existingPm.serialNumber || pmData.serialNumber || "N/A",
        machineId: existingPm._id,
      },
      checklistItems: processedChecklistItems,
      serviceEngineer: existingPm.pmEngineerCode || "N/A",
      remarkglobal: globalRemark || "N/A",

      documentChlNo: pmData.documentChlNo || "N/A",
      documentRevNo: pmData.documentRevNo || "N/A",
      formatChlNo: pmData.formatChlNo || "N/A",
      formatRevNo: pmData.formatRevNo || "N/A",
      userInfo: userInfo, // Add userInfo parameter for service engineer details
    };


    console.log("HTML generation parameters:", JSON.stringify(htmlParams, null, 2));
    console.log("REVCHAL", pmData.formatChlNo, pmData.documentChlNo, pmData.documentRevNo, pmData.formatRevNo)
    // Prepare checklist HTML with updated parameters
    const checklistHtml = getChecklistHTMLPM(htmlParams);

    console.log("HTML generated, creating PDF...");

    // Generate PDF from HTML
    const pdfOptions = {
      format: "A4",
      childProcessOptions: { env: { OPENSSL_CONF: "/dev/null" } },
    };

    pdf.create(checklistHtml, pdfOptions).toBuffer((err, pdfBuffer) => {
      if (err) {
        console.error("Error generating Checklist PDF:", err);
        return res.status(500).json({ message: "Failed to create Checklist PDF" });
      }

      console.log("PDF generated successfully, size:", pdfBuffer.length);

      // Store in pdfStore
      if (!pdfStore[customerCode]) {
        pdfStore[customerCode] = [];
      }

      pdfStore[customerCode].push({
        filename: `Checklist_${existingPm.pmNumber}.pdf`,
        buffer: pdfBuffer,
      });

      console.log("PDF stored in pdfStore for customer:", customerCode);

      res.json({
        message: "PM updated & PDF generated successfully",
        pmNumber: existingPm.pmNumber
      });
    });
  } catch (err) {
    console.error("Server error in reportAndUpdate:", err);
    res.status(500).json({ message: err.message });
  }
});



// ==========================
// (C) Final Email Route
// ==========================
//
// After all PMs are processed in the frontend loop, call this route to
// send all PDFs for this customer as separate attachments in one email.
//
router.post("/sendAllPdfs", async (req, res) => {
  try {
    const {
      customerCode,
      email,            // Service engineer email
      manageremail,     // Array of manager emails
      dealerEmail       // Optional dealer email
    } = req.body;

    if (!customerCode) {
      return res
        .status(400)
        .json({ message: "Customer code is required to send PDFs" });
    }

    const customer = await Customer.findOne({ customercodeid: customerCode });
    if (!customer || !customer.email) {
      return res
        .status(404)
        .json({ message: "Customer or customer email not found" });
    }

    if (!pdfStore[customerCode] || pdfStore[customerCode].length === 0) {
      return res
        .status(400)
        .json({ message: "No PDFs available for this customer" });
    }

    const attachments = pdfStore[customerCode].map((f) => ({
      filename: f.filename,
      content: f.buffer,
      contentType: "application/pdf"
    }));

    // Build recipient list:
    const recipients = [customer.email]; // always send to customer
    if (email) recipients.push(email); // service engineer
    if (Array.isArray(manageremail)) recipients.push(...manageremail); // all managers
    if (dealerEmail) recipients.push(dealerEmail); // optional dealer

    const mailOptions = {
      from: "webadmin@skanray-access.com",
      to: recipients, // will include all valid emails
      subject: "Skanray - Your Checklist PDFs",
      text: "Please find attached the completed checklist PDFs for your PMs.",
      attachments
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending final email:", error);
        return res
          .status(500)
          .json({ message: "Failed to send final email" });
      }
      delete pdfStore[customerCode]; // Clear the stored PDFs
      return res.json({ message: "All PDF attachments sent successfully" });
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
