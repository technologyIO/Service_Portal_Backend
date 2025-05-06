const express = require('express');
const router = express.Router();

const Equipment   = require('../../Model/MasterSchema/EquipmentSchema');
const AMCContract = require('../../Model/UploadSchema/AMCContractSchema');
const Product     = require('../../Model/MasterSchema/ProductSchema');
const Customer    = require('../../Model/UploadSchema/CustomerSchema');

router.get('/contract-proposals', async (req, res) => {
  try {
    // ─── DATE BOUNDS ─────────────────────────────────────────────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

    const oneEightyDaysLater = new Date(today);
    oneEightyDaysLater.setDate(oneEightyDaysLater.getDate() + 180);

    // ─── BULK FETCH ──────────────────────────────────────────────────────────────
    const [allEquipments, allAMCContracts, allProducts, allCustomers] = await Promise.all([
      Equipment.find().lean(),
      AMCContract.find().lean(),
      Product.find().lean(),
      Customer.find().lean()
    ]);

    // ─── MAPS FOR O(1) LOOKUP ────────────────────────────────────────────────────
    // 1. Latest AMC per serialNumber
    const amcMap = new Map();
    allAMCContracts.forEach(amc => {
      const serial = String(amc.serialnumber);
      const existing = amcMap.get(serial);
      if (
        !existing ||
        new Date(amc.enddate) > new Date(existing.enddate)
      ) {
        amcMap.set(serial, amc);
      }
    });

    // 2. Product by partNoId
    const productMap = new Map(
      allProducts.map(prod => [String(prod.partnoid), prod])
    );

    // 3. Customer by customercodeid  ←─── FIXED
    const customerMap = new Map(
      allCustomers.map(cust => [String(cust.customercodeid), cust])
    );

    const validEquipments = [];

    for (const eq of allEquipments) {
      // 1. Warranty end date check
      const warrantyEnd = new Date(eq.custWarrantyenddate);
      warrantyEnd.setHours(0, 0, 0, 0);
      if (warrantyEnd > oneMonthLater) continue;

      // 2. AMC validity check
      const amcKey   = String(eq.serialnumber);
      const latestAMC = amcMap.get(amcKey);
      if (latestAMC && new Date(latestAMC.enddate) > oneMonthLater) continue;

      // 3. Product support check
      const prod = productMap.get(String(eq.materialcode));
      if (!prod) continue;
      const supportEnd = new Date(prod.endofsupportdate);
      supportEnd.setHours(0, 0, 0, 0);
      if (supportEnd <= oneEightyDaysLater) continue;

      // 4. Customer lookup  ←─── FIXED
      const custKey = String(eq.currentcustomer);
      const matchedCustomer = customerMap.get(custKey) || null;

      // (Optional) DEBUG LOGS — uncomment to verify your keys!
      // console.log('Equipment.currentcustomer =', custKey);
      // console.log('CustomerMap keys =', [...customerMap.keys()]);
      // console.log('matchedCustomer =', matchedCustomer);

      // 5. Push result
      validEquipments.push({
        equipment:   eq,
        amcContract: latestAMC || null,
        customer:    matchedCustomer
      });
    }

    return res.json(validEquipments);
  } catch (error) {
    console.error('Error fetching contract proposals:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
