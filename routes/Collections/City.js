const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const City = require("../../Model/CollectionSchema/CitySchema");
const Branch = require("../../Model/CollectionSchema/BranchSchema");
const State = require("../../Model/CollectionSchema/StateSchema");
const User = require("../../Model/MasterSchema/UserSchema");
// Middleware: Get City by ID
async function getCity(req, res, next) {
  try {
    const city = await City.findById(req.params.id);
    if (!city) {
      return res.status(404).json({ message: "City Not Found" });
    }
    res.city = city;
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// Middleware: Check Duplicate City
// async function checkDuplicateCity(req, res, next) {
//     const { name, branch, cityID } = req.body;
//     try {
//         const existingCity = await City.findOne({ $or: [{ name, branch }, { cityID }] });
//         if (existingCity) {
//             return res.status(400).json({ message: 'City with the same name/branch or cityID already exists' });
//         }
//         next();
//     } catch (err) {
//         return res.status(500).json({ message: err.message });
//     }
// }

router.get("/allcitybystate", async (req, res) => {
  try {
    const cities = await City.aggregate([
      {
        $lookup: {
          from: "branches",
          localField: "branch",
          foreignField: "name",
          as: "branchData",
        },
      },
      {
        $unwind: {
          path: "$branchData",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $lookup: {
          from: "states",
          localField: "branchData.state",
          foreignField: "name", // match State.name, NOT stateId
          as: "stateData",
        },
      },
      {
        $unwind: {
          path: "$stateData",
          preserveNullAndEmptyArrays: false,
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          status: 1,
          cityID: 1,
          createdAt: 1,
          modifiedAt: 1,
          branch: 1,
          state: "$stateData.name", // Include state name
          region: "$stateData.region", // Include region from state
        },
      },
    ]);

    res.json(cities);
  } catch (err) {
    console.error("Error fetching city-state-region data:", err);
    res.status(500).json({ message: err.message });
  }
});

// Create City
router.post("/city", async (req, res) => {
  try {
    const { name } = req.body;

    // Check for duplicate city name
    const existingCity = await City.findOne({ name });
    if (existingCity) {
      return res.status(400).json({
        message: "City with this name already exists",
      });
    }

    // Check for duplicate cityID if provided
    if (req.body.cityID) {
      const cityWithSameID = await City.findOne({ cityID: req.body.cityID });
      if (cityWithSameID) {
        return res.status(400).json({
          message: "cityID must be unique",
        });
      }
    }

    const newCity = new City(req.body);
    const savedCity = await newCity.save();
    res.status(201).json(savedCity);
  } catch (err) {
    if (err.code === 11000) {
      // Handle duplicate key errors
      if (err.keyPattern.name) {
        return res.status(400).json({
          message: "City name must be unique",
        });
      }
      if (err.keyPattern.cityID) {
        return res.status(400).json({
          message: "cityID must be unique",
        });
      }
    }
    res.status(400).json({ message: err.message });
  }
});

// Get All Cities with Pagination
router.get("/city", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    const skip = (page - 1) * limit;
    const city = await City.find().skip(skip).limit(limit);
    const totalcity = await City.countDocuments();
    const totalpages = Math.ceil(totalcity / limit);
    res.json({
      city,
      totalpages,
      totalcity,
    }); // Return all branchs
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get City by ID
router.get("/city/:id", getCity, (req, res) => {
  res.json(res.city);
});

router.get("/allcity", async (req, res) => {
  try {
    const city = await City.find(); // Fetch all countries
    res.json(city); // Return all countries as JSON
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle error and return JSON response
  }
});
router.get("/allcitybystates", async (req, res) => {
  try {
    const city = await City.find(); // Fetch all countries
    res.json(city); // Return all countries as JSON
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle error and return JSON response
  }
});

// Update City
router.patch("/city/:id", getCity, async (req, res) => {
  const { name, status, branch, cityID } = req.body;

  // Special handling for status deactivation
  if (status && status === "Inactive" && res.city.status === "Active") {
    // Check if any user has this city linked before deactivating
    const usersWithCityInDemographics = await User.find({
      demographics: {
        $elemMatch: {
          type: "city",
          "values.name": res.city.name,
        },
      },
    });

    if (usersWithCityInDemographics.length > 0) {
      return res.status(400).json({
        message: "City is linked with user(s) and cannot be deactivated",
        linkedUsersCount: usersWithCityInDemographics.length,
        linkedUsers: usersWithCityInDemographics.map((user) => ({
          id: user._id,
          name: `${user.firstname} ${user.lastname}`,
          email: user.email,
          employeeid: user.employeeid,
        })),
      });
    }
  }

  // Check if name is being changed to an existing one
  if (name && name !== res.city.name) {
    const existingCity = await City.findOne({ name });
    if (existingCity) {
      return res.status(400).json({
        message: "City with this name already exists",
      });
    }
  }

  // Check for duplicate cityID if changing
  if (cityID && cityID !== res.city.cityID) {
    const cityWithSameID = await City.findOne({ cityID });
    if (cityWithSameID) {
      return res.status(400).json({
        message: "cityID must be unique",
      });
    }
  }

  // Update fields
  if (name != null) res.city.name = name;
  if (status != null) res.city.status = status;
  if (branch != null) res.city.branch = branch;
  if (cityID != null) res.city.cityID = cityID;
  res.city.modifiedAt = Date.now();

  try {
    const updatedCity = await res.city.save();
    res.json(updatedCity);
  } catch (err) {
    if (err.code === 11000) {
      if (err.keyPattern.name) {
        return res.status(400).json({
          message: "City name must be unique",
        });
      }
      if (err.keyPattern.cityID) {
        return res.status(400).json({
          message: "cityID must be unique",
        });
      }
    }
    res.status(400).json({ message: err.message });
  }
});

// Delete City
router.delete("/city/:id", async (req, res) => {
  try {
    // First, find the city to get its name
    const city = await City.findById(req.params.id);
    if (!city) {
      return res.status(404).json({ message: "City Not Found" });
    }

    // Check if any user has this city linked in their demographics
    const usersWithCityInDemographics = await User.find({
      demographics: {
        $elemMatch: {
          type: "city",
          "values.name": city.name,
        },
      },
    });
    console.log(usersWithCityInDemographics);

    if (usersWithCityInDemographics.length > 0) {
      return res.status(400).json({
        message: "City is linked with user(s) and cannot be deleted",
        linkedUsersCount: usersWithCityInDemographics.length,
        linkedUsers: usersWithCityInDemographics.map((user) => ({
          id: user._id,
          name: `${user.firstname} ${user.lastname}`,
          email: user.email,
          employeeid: user.employeeid,
        })),
      });
    }

    // If no users are linked, proceed with deletion
    const deletedCity = await City.deleteOne({ _id: req.params.id });
    if (deletedCity.deletedCount === 0) {
      return res.status(404).json({ message: "City not found" });
    }

    res.json({
      message: "City Deleted Successfully",
      deletedCity: {
        id: city._id,
        name: city.name,
      },
    });
  } catch (err) {
    console.error("Error deleting city:", err);
    res.status(500).json({ message: err.message });
  }
});

// Search City
router.get("/searchCity", async (req, res) => {
  try {
    const { q } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!q) {
      return res.status(400).json({ message: "Query parameter is required" });
    }

    const query = {
      $or: [
        { name: { $regex: q, $options: "i" } },
        { status: { $regex: q, $options: "i" } },
        { branch: { $regex: q, $options: "i" } },
        { cityID: { $regex: q, $options: "i" } },
      ],
    };

    const cities = await City.find(query).skip(skip).limit(limit);
    const totalCities = await City.countDocuments(query);
    const totalPages = Math.ceil(totalCities / limit);

    res.json({
      cities,
      totalPages,
      totalCities,
      currentPage: page,
      isSearch: true,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
      cities: [],
      totalPages: 1,
      totalCities: 0,
      currentPage: 1,
    });
  }
});

module.exports = router;
