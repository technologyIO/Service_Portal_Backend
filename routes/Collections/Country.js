const express = require("express");
const router = express.Router();
const Country = require("../../Model/CollectionSchema/CountrySchema");
const Region = require("../../Model/AdminSchema/RegionSchema"); // Add this import
const User = require("../../Model/MasterSchema/UserSchema");

// Middleware function to get a country by ID
async function getCountry(req, res, next) {
  try {
    const country = await Country.findById(req.params.id);
    if (!country) {
      return res.status(404).json({ message: "Country not found" });
    }
    res.country = country; // Attach country object to response
    next();
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

// Create a new country
router.post("/country", async (req, res) => {
  try {
    const newCountry = new Country(req.body);
    const savedCountry = await newCountry.save();

    res.status(201).json({
      status: 201,
      message: "Country created successfully",
      data: savedCountry,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        status: 409,
        message: "Country name already exists",
      });
    }

    res.status(400).json({
      status: 400,
      message: "Error creating country",
      error: err.message,
    });
  }
});

// Get all countries
router.get("/country", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
    const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

    const skip = (page - 1) * limit; // Calculate the number of documents to skip

    const countries = await Country.find().skip(skip).limit(limit); // Fetch countries for the current page
    const totalCountries = await Country.countDocuments(); // Total number of countries

    const totalPages = Math.ceil(totalCountries / limit); // Calculate total number of pages

    res.json({
      countries,
      totalPages,
      totalCountries,
    });
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
  }
});
router.get("/allcountry", async (req, res) => {
  try {
    const countries = await Country.find(); // Fetch countries for the current page

    res.json({
      countries,
    });
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
  }
});

// Get a single country
router.get("/country/:id", getCountry, (req, res) => {
  res.json(res.country); // Return single country fetched by middleware
});

// Get all countries without pagination
router.get("/allCountries", async (req, res) => {
  try {
    const countries = await Country.find(); // Fetch all countries
    res.json(countries); // Return all countries as JSON
  } catch (err) {
    res.status(500).json({ message: err.message }); // Handle error and return JSON response
  }
});

// Update a country
router.patch("/country/:id", getCountry, async (req, res) => {
  const { name, status, geo } = req.body;

  // Special handling for status deactivation (only check users, not regions)
  if (status && status === "Inactive" && res.country.status === "Active") {
    // Check if any user has this country linked before deactivating
    const usersWithCountryInDemographics = await User.find({
      demographics: {
        $elemMatch: {
          type: "country",
          "values.name": res.country.name,
        },
      },
    });

    if (usersWithCountryInDemographics.length > 0) {
      return res.status(400).json({
        message: "Country is linked with user(s) and cannot be deactivated",
        linkedUsersCount: usersWithCountryInDemographics.length,
        linkedUsers: usersWithCountryInDemographics.map((user) => ({
          id: user._id,
          name: `${user.firstname} ${user.lastname}`,
          email: user.email,
          employeeid: user.employeeid,
        })),
      });
    }
  }

  if (name) res.country.name = name;
  if (status) res.country.status = status;
  if (geo) res.country.geo = geo;

  res.country.modifiedAt = Date.now();

  try {
    const updatedCountry = await res.country.save();
    res.status(200).json({
      status: 200,
      message: "Country updated successfully",
      data: updatedCountry,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        status: 409,
        message: "Country name already exists",
      });
    }

    res.status(400).json({
      status: 400,
      message: "Error updating country",
      error: err.message,
    });
  }
});

// Delete a country
router.delete("/country/:id", async (req, res) => {
  try {
    // First, find the country to get its name
    const country = await Country.findById(req.params.id);
    if (!country) {
      return res.status(404).json({ message: "Country Not Found" });
    }

    // Check if any user has this country linked in their demographics
    const usersWithCountryInDemographics = await User.find({
      demographics: {
        $elemMatch: {
          type: "country",
          "values.name": country.name,
        },
      },
    });

    // Check if any region has this country linked
    const linkedRegions = await Region.find({
      country: country.name, // Regions are linked by country name
    });

    // If users or regions are linked, prevent deletion
    if (usersWithCountryInDemographics.length > 0 || linkedRegions.length > 0) {
      let message = "Country cannot be deleted because it is linked with:\n";
      let details = [];

      if (usersWithCountryInDemographics.length > 0) {
        message += `• ${usersWithCountryInDemographics.length} user(s)\n`;
        details.push({
          type: "users",
          count: usersWithCountryInDemographics.length,
          items: usersWithCountryInDemographics.map((user) => ({
            id: user._id,
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            employeeid: user.employeeid,
          })),
        });
      }

      if (linkedRegions.length > 0) {
        message += `• ${linkedRegions.length} region(s)`;
        details.push({
          type: "regions",
          count: linkedRegions.length,
          items: linkedRegions.map((region) => ({
            id: region._id,
            regionName: region.regionName,
            status: region.status,
          })),
        });
      }

      return res.status(400).json({
        message: message.trim(),
        details,
        linkedUsersCount: usersWithCountryInDemographics.length,
        linkedRegionsCount: linkedRegions.length,
        // Keep backward compatibility
        linkedUsers: usersWithCountryInDemographics.map((user) => ({
          id: user._id,
          name: `${user.firstname} ${user.lastname}`,
          email: user.email,
          employeeid: user.employeeid,
        })),
        linkedRegions: linkedRegions.map((region) => ({
          id: region._id,
          regionName: region.regionName,
          status: region.status,
        })),
      });
    }

    // If no users or regions are linked, proceed with deletion
    const deletedCountry = await Country.deleteOne({ _id: req.params.id });
    if (deletedCountry.deletedCount === 0) {
      return res.status(404).json({ message: "Country not found" });
    }

    res.json({
      message: "Country Deleted Successfully",
    });
  } catch (err) {
    console.error("Error deleting country:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/searchCountry", async (req, res) => {
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
        { geo: { $regex: q, $options: "i" } },
        { status: { $regex: q, $options: "i" } },
      ],
    };

    const countries = await Country.find(query).skip(skip).limit(limit);
    const totalCountries = await Country.countDocuments(query);
    const totalPages = Math.ceil(totalCountries / limit);

    res.json({
      countries,
      totalPages,
      totalCountries,
      currentPage: page,
      isSearch: true,
    });
  } catch (err) {
    res.status(500).json({
      message: err.message,
      countries: [],
      totalPages: 1,
      totalCountries: 0,
      currentPage: 1,
    });
  }
});

module.exports = router;
