const mongoose = require("mongoose");

const checklistItemSchema = new mongoose.Schema({
    name: { type: String, required: true } // ✅ ID MongoDB automatically generate karega
}, { _id: true }); // ✅ Ensuring each item gets an auto-generated _id

const installationChecklistSchema = new mongoose.Schema(
    {
        preInstallationChecks: [checklistItemSchema],
        physicalInspection: [checklistItemSchema],
        installationSteps: [checklistItemSchema],
        softwareAndCalibration: [checklistItemSchema],
        functionalTesting: [checklistItemSchema],
        finalHandover: [checklistItemSchema]
    },
    { timestamps: true }
);

const InstallationChecklist = mongoose.model("InstallationChecklist", installationChecklistSchema);
module.exports = InstallationChecklist;
