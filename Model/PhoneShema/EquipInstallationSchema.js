const mongoose = require('mongoose');

const installationSchema = new mongoose.Schema({
    serialNumber: { type: String, required: true },
    description: { type: String },
    name: { type: String },
    city: { type: String },
    postalCode: { type: String },
    street: { type: String },
    district: { type: String },
    region: { type: String },
    country: { type: String },
    telephone: { type: String },
    invoiceno: { type: String },
    abnormalSiteCondition: { type: String },
    equipmentId: { type: String, unique: true },  
    enterVoltage: {
        lNry: { type: String },
        lgYb: { type: String },
        ngBr: { type: String }
    },
    customer: {
        customerCodeId: { type: String },
        customerName: { type: String },
        email: { type: String },
        postalCode: { type: String },
        street: { type: String },
        city: { type: String },
        hospital: { type: String },
        telephone: { type: String }
    }
}, {
    timestamps: true
});

// Function to generate a random 5-character alphanumeric ID
function generateEquipmentId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let id = '';
    for (let i = 0; i < 5; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

// Pre-save middleware to check uniqueness of equipmentId
installationSchema.pre('save', async function(next) {
    if (this.isNew) { // Only generate for new documents
        let unique = false;
        while (!unique) {
            this.equipmentId = generateEquipmentId();
            const existing = await mongoose.model('Installation').findOne({ equipmentId: this.equipmentId });
            if (!existing) {
                unique = true;
            }
        }
    }
    next();
});

module.exports = mongoose.model('Installation', installationSchema);
