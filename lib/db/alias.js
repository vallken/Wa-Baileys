// models/Alias.js
const mongoose = require('mongoose');

const aliasSchema = new mongoose.Schema({
  command: { 
    type: String, 
    required: true,
    unique: true,
    index: true
  },
  response: { 
    type: String, 
    required: true 
  },
  createdBy: { 
    type: String,
    required: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

aliasSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Alias', aliasSchema);