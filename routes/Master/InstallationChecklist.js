const express = require("express");
const router = express.Router();
const InstallationChecklist = require("../../Model/MasterSchema/installationChecklistSchema");

// ✅ Create Installation Checklist
router.post("/", async (req, res) => {
    try {
        const checklist = new InstallationChecklist(req.body);
        await checklist.save();
        res.status(201).json({ message: "Installation checklist created", checklist });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ✅ Get All Checklists
router.get("/", async (req, res) => {
    try {
        const checklists = await InstallationChecklist.find({}, "_id preInstallationChecks physicalInspection installationSteps softwareAndCalibration functionalTesting finalHandover");
        res.status(200).json(checklists);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// ✅ Get Single Checklist by ID
router.get("/:id", async (req, res) => {
    try {
        const checklist = await InstallationChecklist.findById(req.params.id);
        if (!checklist) return res.status(404).json({ message: "Checklist not found" });
        res.status(200).json(checklist);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Update Checklist
router.put("/:id", async (req, res) => {
    try {
        const checklist = await InstallationChecklist.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!checklist) return res.status(404).json({ message: "Checklist not found" });
        res.status(200).json({ message: "Checklist updated", checklist });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ Delete Checklist
router.delete("/:id", async (req, res) => {
    try {
        const checklist = await InstallationChecklist.findByIdAndDelete(req.params.id);
        if (!checklist) return res.status(404).json({ message: "Checklist not found" });
        res.status(200).json({ message: "Checklist deleted" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
