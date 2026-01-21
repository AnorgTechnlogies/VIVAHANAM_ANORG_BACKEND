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
  isActive: { type: Boolean, default: true },
  _id: { type: mongoose.Schema.Types.ObjectId, auto: true }
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
      'radio', 'checkbox', 'textarea', 'file', 'datalist', 'multiselect'
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
  
  // MULTI-SELECT SUPPORT for checkbox groups
  isMultiple: { type: Boolean, default: false },
  
  // Options for select/radio/datalist/multiselect
  options: [optionSchema],
  datalistId: { type: String },
  
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

// Pre-save middleware to ensure options have _id
formFieldSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Ensure all options have _id
  if (this.options && Array.isArray(this.options)) {
    this.options = this.options.map(option => {
      if (!option._id) {
        option._id = new mongoose.Types.ObjectId();
      }
      return option;
    });
  }
  
  next();
});

datalistSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Ensure all options have _id
  if (this.options && Array.isArray(this.options)) {
    this.options = this.options.map(option => {
      if (!option._id) {
        option._id = new mongoose.Types.ObjectId();
      }
      return option;
    });
  }
  
  next();
});

const FormField = mongoose.model('FormField', formFieldSchema);
const Datalist = mongoose.model('Datalist', datalistSchema);

export { FormField, Datalist };