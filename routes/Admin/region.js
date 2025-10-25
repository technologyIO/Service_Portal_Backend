const express = require("express");
const router = express.Router();
const Region = require("../../Model/AdminSchema/RegionSchema");
const State = require("../../Model/CollectionSchema/StateSchema");
const User = require("../../Model/MasterSchema/UserSchema");

router.get("/api/region", async (req, res) => {
  try {
    const regions = await Region.find().lean();
    const states = await State.find().lean();

    const enrichedRegions = regions.map((region) => {
      // Match the FULL region name, not just the prefix
      const matchingState = states.find(
        (state) => state.region && state.region === region.regionName
      );

      // console.log(`Looking for regionName: "${region.regionName}"`);
      // console.log(
      //   `Match found:`,
      //   matchingState
      //     ? { stateId: matchingState.stateId, region: matchingState.region }
      //     : "No match"
      // );

      return {
        ...region,
        stateId: matchingState ? matchingState.stateId : null,
      };
    });

    res.status(200).json({
      status: 200,
      data: {
        regionDropdown: enrichedRegions,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Server error",
      error: err.message,
    });
  }
});

router.get("/api/allregion", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // ✅ Use different variable name here
    const regions = await Region.find().skip(skip).limit(limit);
    const totalRegion = await Region.countDocuments();
    const totalPages = Math.ceil(totalRegion / limit);

    res.json({
      regions,
      totalPages,
      totalRegion,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get single region by ID
router.get("/api/region/:id", async (req, res) => {
  try {
    const region = await Region.findById(req.params.id);

    if (!region) {
      return res.status(404).json({
        status: 404,
        message: "Region not found",
      });
    }

    res.status(200).json({
      status: 200,
      data: {
        region: region,
      },
    });
  } catch (err) {
    res.status(500).json({
      status: 500,
      message: "Server error",
      error: err.message,
    });
  }
});

// Create new region
router.post("/api/region", async (req, res) => {
  try {
    const { regionName, country } = req.body; // ✅ include country

    if (!regionName) {
      return res.status(400).json({
        status: 400,
        message: "regionName is required",
      });
    }

    if (!country) {
      return res.status(400).json({
        status: 400,
        message: "country is required",
      });
    }

    // Check for duplicate region
    const existingRegion = await Region.findOne({ regionName });
    if (existingRegion) {
      return res.status(409).json({
        status: 409,
        message: "Region with this name already exists",
      });
    }

    const newRegion = await Region.create({
      regionName,
      country,
    });

    res.status(201).json({
      status: 201,
      message: "Region created successfully",
      data: {
        region: newRegion,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 400,
      message: "Error creating region",
      error: err.message,
    });
  }
});

// Update region
router.put("/api/region/:id", async (req, res) => {
  try {
    const { regionName, country, status } = req.body;

    // Special handling for status deactivation (only check users, not states)
    if (status && status === "Inactive") {
      // Get the current region to check its name
      const currentRegion = await Region.findById(req.params.id);
      if (!currentRegion) {
        return res.status(404).json({
          status: 404,
          message: "Region not found",
        });
      }

      // Only check if we're changing from Active to Inactive
      if (currentRegion.status === "Active") {
        // Check if any user has this region linked before deactivating
        const usersWithRegionInDemographics = await User.find({
          demographics: {
            $elemMatch: {
              type: "region",
              "values.name": currentRegion.regionName,
            },
          },
        });

        if (usersWithRegionInDemographics.length > 0) {
          return res.status(400).json({
            status: 400,
            message: "Region is linked with user(s) and cannot be deactivated",
            linkedUsersCount: usersWithRegionInDemographics.length,
            linkedUsers: usersWithRegionInDemographics.map((user) => ({
              id: user._id,
              name: `${user.firstname} ${user.lastname}`,
              email: user.email,
              employeeid: user.employeeid,
            })),
          });
        }
      }
    }

    // If only status is being updated, fetch existing data
    let updateFields = {};

    if (status && !regionName) {
      // Status-only update - fetch existing record
      const existingRegion = await Region.findById(req.params.id);
      if (!existingRegion) {
        return res.status(404).json({
          status: 404,
          message: "Region not found",
        });
      }
      updateFields = {
        regionName: existingRegion.regionName, // Keep existing regionName
        country: existingRegion.country, // Keep existing country
        status,
      };
    } else {
      // Full update
      if (!regionName) {
        return res.status(400).json({
          status: 400,
          message: "regionName is required",
        });
      }

      // Check if another region with the same name exists (excluding current one)
      const existingRegion = await Region.findOne({
        regionName,
        _id: { $ne: req.params.id },
      });

      if (existingRegion) {
        return res.status(409).json({
          status: 409,
          message: "Region with this name already exists",
        });
      }

      updateFields = {
        regionName,
        country: country || "", // Changed from [] to "" (empty string)
      };
      if (status) updateFields.status = status;
    }

    const updatedRegion = await Region.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    );

    if (!updatedRegion) {
      return res.status(404).json({
        status: 404,
        message: "Region not found",
      });
    }

    res.status(200).json({
      status: 200,
      message: "Region updated successfully",
      data: {
        region: updatedRegion,
      },
    });
  } catch (err) {
    res.status(400).json({
      status: 400,
      message: "Error updating region",
      error: err.message,
    });
  }
});

// Delete region
router.delete("/api/region/:id", async (req, res) => {
  try {
    // First, find the region to get its name
    const region = await Region.findById(req.params.id);
    if (!region) {
      return res.status(404).json({
        status: 404,
        message: "Region Not Found",
      });
    }

    // Check if any user has this region linked in their demographics
    const usersWithRegionInDemographics = await User.find({
      demographics: {
        $elemMatch: {
          type: "region",
          "values.name": region.regionName,
        },
      },
    });

    // Check if any state has this region linked
    const linkedStates = await State.find({
      region: region.regionName, // States are linked by region name
    });

    // If users or states are linked, prevent deletion
    if (usersWithRegionInDemographics.length > 0 || linkedStates.length > 0) {
      let message = "Region cannot be deleted because it is linked with:\n";
      let details = [];

      if (usersWithRegionInDemographics.length > 0) {
        message += `• ${usersWithRegionInDemographics.length} user(s)\n`;
        details.push({
          type: "users",
          count: usersWithRegionInDemographics.length,
          items: usersWithRegionInDemographics.map((user) => ({
            id: user._id,
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            employeeid: user.employeeid,
          })),
        });
      }

      if (linkedStates.length > 0) {
        message += `• ${linkedStates.length} state(s)`;
        details.push({
          type: "states",
          count: linkedStates.length,
          items: linkedStates.map((state) => ({
            id: state._id,
            name: state.name,
            stateId: state.stateId,
            status: state.status,
          })),
        });
      }

      return res.status(400).json({
        status: 400,
        message: message.trim(),
        details,
        linkedUsersCount: usersWithRegionInDemographics.length,
        linkedStatesCount: linkedStates.length,
        // Keep backward compatibility
        linkedUsers: usersWithRegionInDemographics.map((user) => ({
          id: user._id,
          name: `${user.firstname} ${user.lastname}`,
          email: user.email,
          employeeid: user.employeeid,
        })),
        linkedStates: linkedStates.map((state) => ({
          id: state._id,
          name: state.name,
          stateId: state.stateId,
          status: state.status,
        })),
      });
    }

    // If no users or states are linked, proceed with deletion
    const deletedRegion = await Region.findByIdAndDelete(req.params.id);

    if (!deletedRegion) {
      return res.status(404).json({
        status: 404,
        message: "Region not found",
      });
    }

    res.status(200).json({
      status: 200,
      message: "Region deleted successfully",
      data: {
        region: deletedRegion,
      },
    });
  } catch (err) {
    console.error("Error deleting region:", err);
    res.status(500).json({
      status: 500,
      message: "Server error",
      error: err.message,
    });
  }
});

router.get("/searchregion", async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Check if the query parameter is missing
    if (!q) {
      return res
        .status(400)
        .json({ message: 'Query parameter "q" is required' });
    }

    const query = {
      $or: [
        { regionName: { $regex: q, $options: "i" } },
        { country: { $regex: q, $options: "i" } },
        { status: { $regex: q, $options: "i" } },
      ],
    };

    // Fetch the results from the database with pagination
    const regions = await Region.find(query).skip(skip).limit(limit);
    const totalRegions = await Region.countDocuments(query);
    const totalPages = Math.ceil(totalRegions / limit);

    // Return the found data with pagination info
    res.json({
      regions,
      totalPages,
      totalRegions,
      currentPage: page,
      isSearch: true,
    });
  } catch (err) {
    // Handle unexpected errors and send a detailed message
    res.status(500).json({
      message: "Server error: " + err.message,
      regions: [],
      totalPages: 1,
      totalRegions: 0,
      currentPage: 1,
    });
  }
});

module.exports = router;
