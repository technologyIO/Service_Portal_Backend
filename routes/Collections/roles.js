const express = require('express');
const roleSchema = require('../../Model/CollectionSchema/roleSchema ');
const router = express.Router();
// Middleware to get a role by ID
async function getRole(req, res, next) {
    let role;
    try {
        role = await roleSchema.findById(req.params.id);
        if (role == null) {
            return res.status(404).json({ message: 'Cannot find role' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
    res.role = role;
    next();
}


function setFeatureCrudAccess(featureCrudAccess) {
    if (featureCrudAccess.all) {
        featureCrudAccess.read = true;
        featureCrudAccess.write = true;
        featureCrudAccess.delete = true;
    } else {
        if (featureCrudAccess.read || featureCrudAccess.write || featureCrudAccess.delete) {
            featureCrudAccess.all = false;
        }
    }
    return featureCrudAccess;
}

// Get all roles
router.get('/role', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Current page number, defaulting to 1
        const limit = parseInt(req.query.limit) || 10; // Number of documents per page, defaulting to 10

        const skip = (page - 1) * limit; // Calculate the number of documents to skip

        const roles = await roleSchema.find().skip(skip).limit(limit); // Fetch roles for the current page
        const totalRoles = await roleSchema.countDocuments(); // Total number of roles

        const totalPages = Math.ceil(totalRoles / limit); // Calculate total number of pages

        res.json({
            roles,
            totalPages,
            totalRoles
        });
    } catch (err) {
        res.status(500).json({ message: err.message }); // Handle error and return JSON response with status 500 (Internal Server Error)
    }
});

// Get one role
router.get('/role/:id', getRole, (req, res) => {
    res.json(res.role);
});

// Create a role
router.post('/role', async (req, res) => {
    const { name, parentRole, featureName, featureCrudAccess, status, roleId } = req.body;

    // Check for duplicates
    try {
        const existingRole = await roleSchema.findOne({ roleId });
        if (existingRole) {
            return res.status(400).json({ message: 'Role with this roleId already exists' });
        }
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }

    const updatedFeatureCrudAccess = setFeatureCrudAccess(featureCrudAccess);

    const role = new roleSchema({
        name,
        parentRole,
        featureName,
        featureCrudAccess: updatedFeatureCrudAccess,
        status,
        roleId
    });

    try {
        const newRole = await role.save();
        res.status(201).json(newRole);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Update a role
router.patch('/role/:id', getRole, async (req, res) => {
    const { name, parentRole, featureName, featureCrudAccess, status } = req.body;

    if (name != null) res.role.name = name;
    if (parentRole != null) res.role.parentRole = parentRole;
    if (featureName != null) res.role.featureName = featureName;
    if (featureCrudAccess != null) {
        res.role.featureCrudAccess = setFeatureCrudAccess(featureCrudAccess);
    }
    if (status != null) res.role.status = status;

    try {
        const updatedRole = await res.role.save();
        res.json(updatedRole);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a role
router.delete('/role/:id', async (req, res) => {
    try {
        const deletedRole = await roleSchema.deleteOne({ _id: req.params.id });
        if (deletedRole.deletedCount === 0) {
            return res.status(404).json({ message: 'Role not found' });
        }
        res.json({ message: 'Deleted Role' }); // Return success message
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
