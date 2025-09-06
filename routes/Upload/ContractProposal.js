const express = require('express');
const router = express.Router();

const Equipment = require('../../Model/MasterSchema/EquipmentSchema');
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const Product = require('../../Model/MasterSchema/ProductSchema');
const Customer = require('../../Model/UploadSchema/CustomerSchema');

const buildSearchCondition = (searchTerm) => {
  if (!searchTerm || searchTerm.trim() === '') return {};

  const searchRegex = new RegExp(searchTerm, 'i');

  return {
    $or: [
      { materialdescription: searchRegex },
      { serialnumber: searchRegex },
      { materialcode: searchRegex },
      { equipmentid: searchRegex },
      { currentcustomer: searchRegex },
      { dealer: searchRegex }
    ]
  };
};

router.get('/contract-proposals', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;
    const search = req.query.search || '';

    // ─── DATE BOUNDS ─────────────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const oneEightyDaysLater = new Date(today);
    oneEightyDaysLater.setDate(oneEightyDaysLater.getDate() + 180);

    // Build search condition
    const searchCondition = buildSearchCondition(search);

    // ─── EQUIPMENT QUERY CONDITIONS ──────────────────────────────────────────────
    const equipmentQuery = {
      custWarrantyenddate: { $lte: oneMonthLater },
      status: { $ne: 'Inactive' },
      ...searchCondition,
    };

    // ─── FETCH ALL MATCHING EQUIPMENT (without pagination first) ─────────────────
    const allMatchingEquipments = await Equipment.find(equipmentQuery)
      .lean()
      .sort({ createdAt: -1 });

    if (allMatchingEquipments.length === 0) {
      return res.json({
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          hasNextPage: false,
          hasPrevPage: false,
          itemsPerPage: limit
        }
      });
    }

    // ─── BULK FETCH ALL RELATED DATA ────────────────────────────────────────────
    const allSerialNumbers = allMatchingEquipments.map(eq => String(eq.serialnumber));
    const allMaterialCodes = allMatchingEquipments.map(eq => String(eq.materialcode));
    const allCustomerIds = [...new Set(allMatchingEquipments.map(eq => String(eq.currentcustomer)))];

    const [allAMCContracts, allProducts, allCustomers] = await Promise.all([
      AMCContract.find({ serialnumber: { $in: allSerialNumbers } }).lean(),
      Product.find({ partnoid: { $in: allMaterialCodes } }).lean(),
      Customer.find({ customercodeid: { $in: allCustomerIds } }).lean()
    ]);

    // ─── CREATE LOOKUP MAPS ──────────────────────────────────────────────────────
    const amcMap = new Map();
    allAMCContracts.forEach(amc => {
      const serial = String(amc.serialnumber);
      const existing = amcMap.get(serial);
      if (!existing || new Date(amc.enddate) > new Date(existing.enddate)) {
        amcMap.set(serial, amc);
      }
    });

    const productMap = new Map(
      allProducts.map(prod => [String(prod.partnoid), prod])
    );

    const customerMap = new Map(
      allCustomers.map(cust => [String(cust.customercodeid), cust])
    );

    // ─── APPLY BUSINESS LOGIC FILTERS TO ALL EQUIPMENT ──────────────────────────
    const allValidEquipments = [];

    for (const eq of allMatchingEquipments) {
      if (eq.status === 'Inactive') continue;
      // 1. AMC validity check
      const latestAMC = amcMap.get(String(eq.serialnumber));
      if (latestAMC && new Date(latestAMC.enddate) > oneMonthLater) continue;

      // 2. Product support check
      const prod = productMap.get(String(eq.materialcode));
      if (!prod) continue;

      const supportEnd = new Date(prod.endofsupportdate);
      supportEnd.setHours(0, 0, 0, 0);
      if (supportEnd <= oneEightyDaysLater) continue;

      // 3. Customer lookup
      const matchedCustomer = customerMap.get(String(eq.currentcustomer)) || null;

      // 4. Add to valid equipment list
      allValidEquipments.push({
        equipment: eq,
        amcContract: latestAMC || null,
        customer: matchedCustomer
      });
    }

    // ─── NOW APPLY PAGINATION TO FILTERED RESULTS ───────────────────────────────
    const totalValidItems = allValidEquipments.length;
    const paginatedValidEquipments = allValidEquipments.slice(skip, skip + limit);

    // ─── PAGINATION METADATA ────────────────────────────────────────────────────
    const totalPages = Math.ceil(totalValidItems / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return res.json({
      data: paginatedValidEquipments,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalValidItems, // This should be the filtered count, not raw equipment count
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        itemsPerPage: limit,
        itemsOnCurrentPage: paginatedValidEquipments.length
      },
      filters: {
        search: search,
        warrantyEndDateLimit: oneMonthLater.toISOString().split('T')[0],
        supportEndDateLimit: oneEightyDaysLater.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Error fetching contract proposals:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});

// ─── SEARCH API WITH SAME FIX ────────────────────────────────────────────────────
router.get('/contract-proposals/search', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const {
      search = '',
      equipmentSearch = '',
      customerSearch = '',
      serialNumber = '',
      materialCode = '',
      warrantyStartDate = '',
      warrantyEndDate = '',
      city = '',
      region = '',
      dealer = '',
      status = 'Active'
    } = req.query;

    // ─── DATE BOUNDS ─────────────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const oneEightyDaysLater = new Date(today);
    oneEightyDaysLater.setDate(oneEightyDaysLater.getDate() + 180);

    // ─── BUILD SEARCH CONDITIONS ────────────────────────────────────────────────
    const equipmentConditions = {
      custWarrantyenddate: { $lte: oneMonthLater },

      ...(status ? { status } : { status: { $ne: 'Inactive' } }),
    };

    if (status) equipmentConditions.status = status;

    if (search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      equipmentConditions.$or = [
        { materialdescription: searchRegex },
        { serialnumber: searchRegex },
        { materialcode: searchRegex },
        { equipmentid: searchRegex },
        { currentcustomer: searchRegex },
        { dealer: searchRegex }
      ];
    }

    if (equipmentSearch.trim()) {
      const equipmentRegex = new RegExp(equipmentSearch.trim(), 'i');
      equipmentConditions.$and = equipmentConditions.$and || [];
      equipmentConditions.$and.push({
        $or: [
          { materialdescription: equipmentRegex },
          { equipmentid: equipmentRegex }
        ]
      });
    }

    if (serialNumber.trim()) {
      equipmentConditions.serialnumber = new RegExp(serialNumber.trim(), 'i');
    }

    if (materialCode.trim()) {
      equipmentConditions.materialcode = new RegExp(materialCode.trim(), 'i');
    }

    if (dealer.trim()) {
      equipmentConditions.dealer = new RegExp(dealer.trim(), 'i');
    }

    if (warrantyStartDate) {
      equipmentConditions.custWarrantystartdate = equipmentConditions.custWarrantystartdate || {};
      equipmentConditions.custWarrantystartdate.$gte = new Date(warrantyStartDate);
    }

    if (warrantyEndDate) {
      equipmentConditions.custWarrantyenddate = {
        ...equipmentConditions.custWarrantyenddate,
        $lte: new Date(warrantyEndDate)
      };
    }

    // ─── FETCH ALL MATCHING EQUIPMENT (no pagination yet) ───────────────────────
    const allMatchingEquipments = await Equipment.find(equipmentConditions)
      .lean()
      .sort({ createdAt: -1, serialnumber: 1 });

    if (allMatchingEquipments.length === 0) {
      return res.json({
        data: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          hasNextPage: false,
          hasPrevPage: false,
          itemsPerPage: limit
        },
        searchCriteria: req.query
      });
    }

    // ─── FETCH ALL RELATED DATA ─────────────────────────────────────────────────
    const allSerialNumbers = allMatchingEquipments.map(eq => String(eq.serialnumber));
    const allMaterialCodes = allMatchingEquipments.map(eq => String(eq.materialcode));
    const allCustomerIds = [...new Set(allMatchingEquipments.map(eq => String(eq.currentcustomer)))];

    const [allAMCContracts, allProducts, allCustomers] = await Promise.all([
      AMCContract.find({ serialnumber: { $in: allSerialNumbers } }).lean(),
      Product.find({ partnoid: { $in: allMaterialCodes } }).lean(),
      Customer.find({ customercodeid: { $in: allCustomerIds } }).lean()
    ]);

    // ─── APPLY CUSTOMER FILTERS ─────────────────────────────────────────────────
    let filteredCustomers = allCustomers;

    if (customerSearch.trim()) {
      const customerRegex = new RegExp(customerSearch.trim(), 'i');
      filteredCustomers = allCustomers.filter(customer =>
        customerRegex.test(customer.customername) ||
        customerRegex.test(customer.hospitalname) ||
        customerRegex.test(customer.email) ||
        customerRegex.test(customer.telephone)
      );
    }

    if (city.trim()) {
      const cityRegex = new RegExp(city.trim(), 'i');
      filteredCustomers = filteredCustomers.filter(customer =>
        cityRegex.test(customer.city)
      );
    }

    if (region.trim()) {
      filteredCustomers = filteredCustomers.filter(customer =>
        customer.region && customer.region.toLowerCase() === region.toLowerCase()
      );
    }

    // ─── CREATE LOOKUP MAPS ─────────────────────────────────────────────────────
    const amcMap = new Map();
    allAMCContracts.forEach(amc => {
      const serial = String(amc.serialnumber);
      const existing = amcMap.get(serial);
      if (!existing || new Date(amc.enddate) > new Date(existing.enddate)) {
        amcMap.set(serial, amc);
      }
    });

    const productMap = new Map(
      allProducts.map(prod => [String(prod.partnoid), prod])
    );

    const customerMap = new Map(
      filteredCustomers.map(cust => [String(cust.customercodeid), cust])
    );

    // ─── APPLY ALL FILTERS TO CREATE VALID EQUIPMENT LIST ───────────────────────
    const allValidEquipments = [];

    for (const eq of allMatchingEquipments) {
      if (eq.status === 'Inactive') continue;
      // Customer filter check
      const matchedCustomer = customerMap.get(String(eq.currentcustomer));
      if (!matchedCustomer && (customerSearch.trim() || city.trim() || region.trim())) {
        continue;
      }

      // AMC validity check
      const latestAMC = amcMap.get(String(eq.serialnumber));
      if (latestAMC && new Date(latestAMC.enddate) > oneMonthLater) continue;

      // Product support check
      const prod = productMap.get(String(eq.materialcode));
      if (!prod) continue;

      const supportEnd = new Date(prod.endofsupportdate);
      supportEnd.setHours(0, 0, 0, 0);
      if (supportEnd <= oneEightyDaysLater) continue;

      allValidEquipments.push({
        equipment: eq,
        amcContract: latestAMC || null,
        customer: matchedCustomer || null
      });
    }

    // ─── APPLY PAGINATION TO FILTERED RESULTS ───────────────────────────────────
    const totalValidItems = allValidEquipments.length;
    const paginatedValidEquipments = allValidEquipments.slice(skip, skip + limit);

    const totalPages = Math.ceil(totalValidItems / limit);

    return res.json({
      data: paginatedValidEquipments,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalValidItems, // Fixed: Use filtered count
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
        itemsPerPage: limit,
        itemsOnCurrentPage: paginatedValidEquipments.length,
        filteredItems: totalValidItems
      },
      searchCriteria: {
        search, equipmentSearch, customerSearch, serialNumber, materialCode,
        warrantyStartDate, warrantyEndDate, city, region, dealer, status
      },
      filters: {
        warrantyEndDateLimit: oneMonthLater.toISOString().split('T')[0],
        supportEndDateLimit: oneEightyDaysLater.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Error in advanced search:', error);
    return res.status(500).json({
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
  }
});
router.get('/contract-proposals/filters/cities', async (req, res) => {
  try {
    // ─── DATE BOUNDS (same as main contract proposals logic) ─────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const oneEightyDaysLater = new Date(today);
    oneEightyDaysLater.setDate(oneEightyDaysLater.getDate() + 180);

    // ─── EQUIPMENT QUERY CONDITIONS (same filters as main API) ───────────────
    const equipmentQuery = {
      custWarrantyenddate: { $lte: oneMonthLater },
      status: { $ne: 'Inactive' },
    };

    // ─── FETCH ALL MATCHING EQUIPMENT ───────────────────────────────────────
    const allMatchingEquipments = await Equipment.find(equipmentQuery).lean();

    if (allMatchingEquipments.length === 0) {
      return res.json({
        cities: [],
        totalCount: 0,
        message: "No contract proposals found"
      });
    }

    // ─── GET ALL CUSTOMER IDs FROM MATCHING EQUIPMENT ───────────────────────
    const allCustomerIds = [...new Set(allMatchingEquipments.map(eq => String(eq.currentcustomer)))];

    // ─── FETCH RELATED DATA FOR FULL VALIDATION ─────────────────────────────
    const [allAMCContracts, allProducts, allCustomers] = await Promise.all([
      AMCContract.find({
        serialnumber: { $in: allMatchingEquipments.map(eq => String(eq.serialnumber)) }
      }).lean(),
      Product.find({
        partnoid: { $in: allMatchingEquipments.map(eq => String(eq.materialcode)) }
      }).lean(),
      Customer.find({ customercodeid: { $in: allCustomerIds } }).lean()
    ]);

    // ─── CREATE LOOKUP MAPS ─────────────────────────────────────────────────
    const amcMap = new Map();
    allAMCContracts.forEach(amc => {
      const serial = String(amc.serialnumber);
      const existing = amcMap.get(serial);
      if (!existing || new Date(amc.enddate) > new Date(existing.enddate)) {
        amcMap.set(serial, amc);
      }
    });

    const productMap = new Map(
      allProducts.map(prod => [String(prod.partnoid), prod])
    );

    const customerMap = new Map(
      allCustomers.map(cust => [String(cust.customercodeid), cust])
    );

    // ─── APPLY BUSINESS LOGIC FILTERS ───────────────────────────────────────
    const validCustomerIds = new Set();

    for (const eq of allMatchingEquipments) {
      // AMC validity check
      if (eq.status === 'Inactive') continue;
      const latestAMC = amcMap.get(String(eq.serialnumber));
      if (latestAMC && new Date(latestAMC.enddate) > oneMonthLater) continue;

      // Product support check
      const prod = productMap.get(String(eq.materialcode));
      if (!prod) continue;

      const supportEnd = new Date(prod.endofsupportdate);
      supportEnd.setHours(0, 0, 0, 0);
      if (supportEnd <= oneEightyDaysLater) continue;

      // Add valid customer ID
      validCustomerIds.add(String(eq.currentcustomer));
    }

    // ─── GET UNIQUE CITIES FROM VALID CUSTOMERS ─────────────────────────────
    const validCities = new Set();

    for (const customerId of validCustomerIds) {
      const customer = customerMap.get(customerId);
      if (customer && customer.city && customer.city.trim()) {
        validCities.add(customer.city.trim());
      }
    }

    // ─── SORT CITIES ALPHABETICALLY ─────────────────────────────────────────
    const sortedCities = Array.from(validCities).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    return res.json({
      cities: sortedCities,
      totalCount: sortedCities.length,
      message: `Found ${sortedCities.length} unique cities in contract proposals`
    });

  } catch (error) {
    console.error('Error fetching cities for contract proposals:', error);
    return res.status(500).json({
      cities: [],
      totalCount: 0,
      error: 'Failed to fetch cities',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// ─── GET ALL REGIONS FROM CONTRACT PROPOSALS ─────────────────────────────────
router.get('/contract-proposals/filters/regions', async (req, res) => {
  try {
    // ─── DATE BOUNDS (same as main contract proposals logic) ─────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const oneEightyDaysLater = new Date(today);
    oneEightyDaysLater.setDate(oneEightyDaysLater.getDate() + 180);

    // ─── EQUIPMENT QUERY CONDITIONS (same filters as main API) ───────────────
    const equipmentQuery = {
      custWarrantyenddate: { $lte: oneMonthLater },
      status: { $ne: 'Inactive' },
    };

    // ─── FETCH ALL MATCHING EQUIPMENT ───────────────────────────────────────
    const allMatchingEquipments = await Equipment.find(equipmentQuery).lean();

    if (allMatchingEquipments.length === 0) {
      return res.json({
        regions: [],
        totalCount: 0,
        message: "No contract proposals found"
      });
    }

    // ─── GET ALL CUSTOMER IDs FROM MATCHING EQUIPMENT ───────────────────────
    const allCustomerIds = [...new Set(allMatchingEquipments.map(eq => String(eq.currentcustomer)))];

    // ─── FETCH RELATED DATA FOR FULL VALIDATION ─────────────────────────────
    const [allAMCContracts, allProducts, allCustomers] = await Promise.all([
      AMCContract.find({
        serialnumber: { $in: allMatchingEquipments.map(eq => String(eq.serialnumber)) }
      }).lean(),
      Product.find({
        partnoid: { $in: allMatchingEquipments.map(eq => String(eq.materialcode)) }
      }).lean(),
      Customer.find({ customercodeid: { $in: allCustomerIds } }).lean()
    ]);

    // ─── CREATE LOOKUP MAPS ─────────────────────────────────────────────────
    const amcMap = new Map();
    allAMCContracts.forEach(amc => {
      const serial = String(amc.serialnumber);
      const existing = amcMap.get(serial);
      if (!existing || new Date(amc.enddate) > new Date(existing.enddate)) {
        amcMap.set(serial, amc);
      }
    });

    const productMap = new Map(
      allProducts.map(prod => [String(prod.partnoid), prod])
    );

    const customerMap = new Map(
      allCustomers.map(cust => [String(cust.customercodeid), cust])
    );

    // ─── APPLY BUSINESS LOGIC FILTERS ───────────────────────────────────────
    const validCustomerIds = new Set();

    for (const eq of allMatchingEquipments) {
      if (eq.status === 'Inactive') continue;
      // AMC validity check
      const latestAMC = amcMap.get(String(eq.serialnumber));
      if (latestAMC && new Date(latestAMC.enddate) > oneMonthLater) continue;

      // Product support check
      const prod = productMap.get(String(eq.materialcode));
      if (!prod) continue;

      const supportEnd = new Date(prod.endofsupportdate);
      supportEnd.setHours(0, 0, 0, 0);
      if (supportEnd <= oneEightyDaysLater) continue;

      // Add valid customer ID
      validCustomerIds.add(String(eq.currentcustomer));
    }

    // ─── GET UNIQUE REGIONS FROM VALID CUSTOMERS ────────────────────────────
    const validRegions = new Set();

    for (const customerId of validCustomerIds) {
      const customer = customerMap.get(customerId);
      if (customer && customer.region && customer.region.trim()) {
        validRegions.add(customer.region.trim());
      }
    }

    // ─── SORT REGIONS ALPHABETICALLY ────────────────────────────────────────
    const sortedRegions = Array.from(validRegions).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    return res.json({
      regions: sortedRegions,
      totalCount: sortedRegions.length,
      message: `Found ${sortedRegions.length} unique regions in contract proposals`
    });

  } catch (error) {
    console.error('Error fetching regions for contract proposals:', error);
    return res.status(500).json({
      regions: [],
      totalCount: 0,
      error: 'Failed to fetch regions',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
