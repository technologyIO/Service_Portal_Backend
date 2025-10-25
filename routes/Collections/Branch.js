const express = require("express");
const router = express.Router();
const Branch = require("../../Model/CollectionSchema/BranchSchema");
const User = require("../../Model/MasterSchema/UserSchema");
const City = require("../../Model/CollectionSchema/CitySchema");
const mongoose = require('mongoose');

async function getBranch(req, res, next) {
  try {
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "Branch not found" });
    }
    res.branch = branch;
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function checkDuplicateBranch(req, res, next) {
  const { name } = req.body;
  try {
    const existingBranch = await Branch.findOne({ name });
    if (existingBranch) {
      return res
        .status(400)
        .json({ message: "Branch with this name already exists" });
    }
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
router.get('/branch/filter-options', async (req, res) => {
  try {
    const branches = await Branch.find({}, { state: 1 });

    const states = [...new Set(branches.map(b => b.state).filter(Boolean))];

    res.json({
      states: states.sort()
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET branches with filters
router.get('/branch/filter', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filters = {};

    // Status filter
    if (req.query.status) {
      filters.status = req.query.status;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filters.createdAt = {};
      if (req.query.startDate) {
        filters.createdAt.$gte = new Date(req.query.startDate);
      }
      if (req.query.endDate) {
        const endDate = new Date(req.query.endDate);
        endDate.setHours(23, 59, 59, 999);
        filters.createdAt.$lte = endDate;
      }
    }

    // State filter
    if (req.query.state) {
      filters.state = req.query.state;
    }

    const branches = await Branch.find(filters)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const totalBranches = await Branch.countDocuments(filters);
    const totalPages = Math.ceil(totalBranches / limit);

    res.json({
      branches,
      totalPages,
      totalBranches,
      currentPage: page,
      filters: req.query
    });
  } catch (err) {
    console.error('Filter error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post("/branch", checkDuplicateBranch, async (req, res) => {
  try {
    const newBranch = new Branch(req.body);
    const savedBranch = await newBranch.save();
    res.status(201).json(savedBranch);
  } catch (err) {
    if (err.code === 11000) {
      return res
        .status(400)
        .json({ message: "Duplicate branch name not allowed" });
    }
    res.status(400).json({ message: err.message });
  }
});

router.get("/branch", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
    const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

    const skip = (page - 1) * limit; // Calculate the number of documents to skip

    const branches = await Branch.find().skip(skip).limit(limit); // Fetch branches for the current page
    const totalBranches = await Branch.countDocuments(); // Total number of branches

    const totalPages = Math.ceil(totalBranches / limit); // Calculate total number of pages

    res.json({
      branches,
      totalPages,
      totalBranches,
    });
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
  }
});

// BULK DELETE Branch entries - PLACE THIS BEFORE THE /:id ROUTES
router.delete('/branch/bulk', async (req, res) => {
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

    // Delete multiple branches
    const deleteResult = await Branch.deleteMany({
      _id: { $in: validIds }
    });

    if (deleteResult.deletedCount === 0) {
      return res.status(404).json({
        message: 'No branches found to delete',
        deletedCount: 0
      });
    }

    res.json({
      message: `Successfully deleted ${deleteResult.deletedCount} branches`,
      deletedCount: deleteResult.deletedCount,
      requestedCount: validIds.length
    });

  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/allbranch", async (req, res) => {
  try {
    const branches = await Branch.find();

    res.json({
      branches,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/branch/:id", getBranch, (req, res) => {
  res.json(res.branch); // Return single branch fetched by middleware
});
router.get("/allbranch", async (req, res) => {
  try {
    const branch = await Branch.find(); // Fetch all countries
    res.json(branch); // Return all countries as JSON
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle error and return JSON response
  }
});

router.patch("/branch/:id", getBranch, async (req, res) => {
  const { name, status, city, branchShortCode, state } = req.body;

  // Special handling for status deactivation
  if (status && status === "Inactive" && res.branch.status === "Active") {
    // Check if any user has this branch linked before deactivating
    const usersWithBranchInDemographics = await User.find({
      demographics: {
        $elemMatch: {
          type: "branch",
          "values.name": res.branch.branchShortCode,
        },
      },
    });

    const usersWithBranchInLegacy = await User.find({
      branch: res.branch.branchShortCode,
    });

    const linkedUsers = [
      ...usersWithBranchInDemographics,
      ...usersWithBranchInLegacy,
    ];
    const uniqueLinkedUsers = linkedUsers.filter(
      (user, index, self) =>
        index ===
        self.findIndex((u) => u._id.toString() === user._id.toString())
    );

    if (uniqueLinkedUsers.length > 0) {
      return res.status(400).json({
        message: "Branch is linked with user(s) and cannot be deactivated",
        linkedUsersCount: uniqueLinkedUsers.length,
        linkedUsers: uniqueLinkedUsers.map((user) => ({
          id: user._id,
          name: `${user.firstname} ${user.lastname}`,
          email: user.email,
          employeeid: user.employeeid,
        })),
      });
    }
  }

  // Update branch fields if they are provided
  if (name != null) {
    res.branch.name = name;
  }
  if (status != null) {
    res.branch.status = status;
  }
  if (city != null) {
    res.branch.city = city;
  }
  if (branchShortCode != null) {
    res.branch.branchShortCode = branchShortCode;
  }
  if (state != null) {
    res.branch.state = state;
  }

  res.branch.modifiedAt = Date.now();

  try {
    const updatedBranch = await res.branch.save();
    res.json(updatedBranch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete("/branch/:id", async (req, res) => {
  try {
    console.log(req.params.id);
    const branch = await Branch.findById(req.params.id);
    if (!branch) {
      return res.status(404).json({ message: "Branch Not Found" });
    }
    console.log(branch);

    // Check if any user has this branch linked
    const usersWithBranchInDemographics = await User.find({
      demographics: {
        $elemMatch: {
          type: "branch",
          "values.name": branch.branchShortCode,
        },
      },
    });
    console.log(usersWithBranchInDemographics);

    const usersWithBranchInLegacy = await User.find({
      branch: branch.branchShortCode,
    });
    console.log(usersWithBranchInLegacy);

    const linkedUsers = [
      ...usersWithBranchInDemographics,
      ...usersWithBranchInLegacy,
    ];

    const uniqueLinkedUsers = linkedUsers.filter(
      (user, index, self) =>
        index ===
        self.findIndex((u) => u._id.toString() === user._id.toString())
    );

    // Check if any city has this branch linked
    const linkedCities = await City.find({
      branch: branch.name  // Cities are linked by branch name
    });

    // If users or cities are linked, prevent deletion
    if (uniqueLinkedUsers.length > 0 || linkedCities.length > 0) {
      let message = "Branch cannot be deleted because it is linked with:\n";
      let details = [];

      if (uniqueLinkedUsers.length > 0) {
        message += `• ${uniqueLinkedUsers.length} user(s)\n`;
        details.push({
          type: "users",
          count: uniqueLinkedUsers.length,
          items: uniqueLinkedUsers.map((user) => ({
            id: user._id,
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            employeeid: user.employeeid,
          }))
        });
      }

      if (linkedCities.length > 0) {
        message += `• ${linkedCities.length} city/cities`;
        details.push({
          type: "cities",
          count: linkedCities.length,
          items: linkedCities.map((city) => ({
            id: city._id,
            name: city.name,
            cityID: city.cityID,
            status: city.status
          }))
        });
      }

      return res.status(400).json({
        message: message.trim(),
        details,
        linkedUsersCount: uniqueLinkedUsers.length,
        linkedCitiesCount: linkedCities.length,
        // Keep backward compatibility
        linkedUsers: uniqueLinkedUsers.map((user) => ({
          id: user._id,
          name: `${user.firstname} ${user.lastname}`,
          email: user.email,
          employeeid: user.employeeid,
        })),
        linkedCities: linkedCities.map((city) => ({
          id: city._id,
          name: city.name,
          cityID: city.cityID,
          status: city.status
        }))
      });
    }

    const deletedBranch = await Branch.deleteOne({ _id: req.params.id });
    if (deletedBranch.deletedCount === 0) {
      return res.status(404).json({ message: "Branch Not Found" });
    }

    res.json({
      message: "Branch Deleted Successfully",
    });
  } catch (err) {
    console.error("Error deleting branch:", err);
    res.status(500).json({ message: err.message });
  }
});


module.exports = router;
