const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UseradminSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  roleName: {
    type: String,
    required: true,
    enum: ['Super Admin', 'Admin', 'Manager'], // Valid roles
  },
  roleNumber: {
    type: Number,
    required: true,
    enum: [0, 1, 2], // Valid role numbers
  },
});

// Hash password before saving
UseradminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
UseradminSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const AdminUser = mongoose.models.AdminUser || mongoose.model('adminuser', UseradminSchema);

module.exports = AdminUser;
