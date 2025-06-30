const express = require('express');
const router = express.Router();
const Role = require('../../Model/Role/RoleSchema');
const Component = require('../../Model/Role/ComponentSchema');
const City = require("../../Model/CollectionSchema/CitySchema");

async function generateRoleId(name) {
    const firstLetter = name.charAt(0).toUpperCase();

    // Find all roles starting with the first letter and followed by digits
    const existingRoles = await Role.find({ roleId: new RegExp(`^${firstLetter}\\d+$`) });

    let maxNum = 0;

    for (const role of existingRoles) {
        const match = role.roleId.match(new RegExp(`^${firstLetter}(\\d+)$`));
        if (match) {
            const num = parseInt(match[1]);
            if (num > maxNum) {
                maxNum = num;
            }
        }
    }

    // Generate the next roleId
    return `${firstLetter}${maxNum + 1}`;
}

router.get('/by-roleid/:roleId', async (req, res) => {
    try {
        const role = await Role.findOne({ roleId: req.params.roleId })
            .populate('parentRole', 'name')
            .lean(); // plain object

        if (!role) return res.status(404).json({ error: 'Role not found' });

        res.status(200).json(role);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/roles
router.post('/', async (req, res) => {
    try {
        const { name, features, mobileComponents, reports, demographicSelections, parentRole, roleType } = req.body;

        const roleId = await generateRoleId(name);

        const role = new Role({
            roleId,
            name,
            features,
            mobileComponents,
            reports,
            demographicSelections,
            parentRole,
            roleType
        });

        await role.save();
        res.status(201).json(role);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get All Roles
router.get('/', async (req, res) => {
    try {
        const roles = await Role.find()
            .populate('parentRole', 'name')
            .populate('demographicSelections'); // Adjust if you need to populate other fields

        res.status(200).json(roles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get Role by ID
router.get('/:id', async (req, res) => {
    try {
        const role = await Role.findById(req.params.id)
            .populate('parentRole', 'name')
            .populate('demographicSelections'); // Adjust if you need to populate other fields

        if (!role) return res.status(404).json({ error: 'Role not found' });
        res.status(200).json(role);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Role
router.put('/:id', async (req, res) => {
    try {
        const updatedRole = await Role.findByIdAndUpdate(
            req.params.id,
            { ...req.body, updatedAt: Date.now() },
            { new: true, runValidators: true }
        );

        if (!updatedRole) return res.status(404).json({ error: 'Role not found' });
        res.status(200).json(updatedRole);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete Role
router.delete('/:id', async (req, res) => {
    try {
        const deletedRole = await Role.findByIdAndDelete(req.params.id);
        if (!deletedRole) return res.status(404).json({ error: 'Role not found' });

        res.status(200).json({ message: 'Role deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;