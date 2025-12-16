// models/AdminRegistrationDynamicModel.js
import mongoose from 'mongoose';

const validationSchema = new mongoose.Schema({
  required: { type: Boolean, default: false },
  minLength: { type: Number },
  maxLength: { type: Number },
  pattern: { type: String },
  patternMessage: { type: String },
  customValidation: { type: String },
  message: { type: String }
});

const optionSchema = new mongoose.Schema({
  label: { type: String, required: true },
  value: { type: String, required: true },
  isActive: { type: Boolean, default: true }
});

const datalistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  options: [optionSchema],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

const formFieldSchema = new mongoose.Schema({
  // Basic identification
  name: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true,
    lowercase: true
  },
  label: { type: String, required: true },
  type: { 
    type: String, 
    required: true,
    enum: [
      'text', 'email', 'mobileNo', 'number', 'date', 'select', 
      'radio', 'checkbox', 'textarea', 'file', 'datalist'
    ]
  },
  
  // Section and grouping
  section: { 
    type: String, 
    required: true,
    enum: [
      'general_basic_info',
      'religion_cultural', 
      'location_education',
      'address_details',
      'profile_personal',
      'partner_preferences',
      'privacy_settings'
    ]
  },
  sectionTitle: { type: String, required: true },
  sectionOrder: { type: Number, default: 0 },
  fieldOrder: { type: Number, default: 0 },
  
  // Field configuration
  placeholder: { type: String },
  helpText: { type: String },
  defaultValue: { type: mongoose.Schema.Types.Mixed },
  isActive: { type: Boolean, default: true },
  isRequired: { type: Boolean, default: false },
  
  // Options for select/radio/datalist
  options: [optionSchema],
  datalistId: { type: String },
  isMultiple: { type: Boolean, default: false },
  
  // Validation rules
  validation: validationSchema,
  
  // Conditional logic
  dependsOn: { type: String },
  dependsValue: { type: mongoose.Schema.Types.Mixed },
  showCondition: { type: String },
  
  // Admin metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'admin' },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
formFieldSchema.index({ section: 1, fieldOrder: 1 });
formFieldSchema.index({ isActive: 1 });
formFieldSchema.index({ section: 1, isActive: 1 });

// Pre-save middleware
formFieldSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

datalistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const FormField = mongoose.model('FormField', formFieldSchema);
const Datalist = mongoose.model('Datalist', datalistSchema);

export { FormField, Datalist };