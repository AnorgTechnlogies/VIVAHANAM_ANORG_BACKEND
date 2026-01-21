// controllers/dynamicFormController.js
import { FormField, Datalist } from '../models/AdminRegistrationDynamicModel.js';
import Admin from '../models/adminModel.js'; 
import User from "../models/userModel.js";


// ==================== FORM FIELD MANAGEMENT =============

// Get all form fields with filtering
export const getFormFields = async (req, res) => {
  try {
    const { section, isActive } = req.query;
    let filter = {};
    
    if (section) filter.section = section;
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const fields = await FormField.find(filter)
      .sort({ sectionOrder: 1, fieldOrder: 1 })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      success: true,
      data: fields,
      count: fields.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching form fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form fields',
      error: error.message
    });
  }
};

// Get active form fields for registration form (Public endpoint)
export const getActiveFormFields = async (req, res) => {
  try {
    const fields = await FormField.find({ isActive: true })
      .sort({ sectionOrder: 1, fieldOrder: 1 })
      .select('-createdBy -updatedBy -createdAt -updatedAt')
      .lean();

    // Group fields by section for easier frontend consumption
    const sections = {};
    fields.forEach(field => {
      if (!sections[field.section]) {
        sections[field.section] = {
          sectionTitle: field.sectionTitle,
          sectionOrder: field.sectionOrder,
          fields: []
        };
      }
      sections[field.section].fields.push(field);
    });

    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.json({
      success: true,
      fields: fields,
      sections: sections,
      count: fields.length
    });
  } catch (error) {
    console.error('Error fetching active form fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form configuration',
      error: error.message
    });
  }
};

// Get single form field
export const getFormField = async (req, res) => {
  try {
    const field = await FormField.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');
    
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Form field not found'
      });
    }
    
    res.json({
      success: true,
      data: field
    });
  } catch (error) {
    console.error('Error fetching form field:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form field',
      error: error.message
    });
  }
};

// Create new form field
export const createFormField = async (req, res) => {
  try {
    console.log('📝 Creating form field with data:', req.body);
    console.log('👤 Request user:', req.user);
    console.log('👤 Request admin:', req.admin);
    
    // Check both req.admin and req.user for flexibility
    const adminId = req.admin?._id || req.admin?.id || req.user?._id || req.user?.id;
    
    if (!adminId) {
      console.log('❌ No admin/user ID found in request');
      console.log('Request headers:', req.headers);
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Please log in again.'
      });
    }

    console.log('✅ Admin ID:', adminId);

    const fieldData = {
      ...req.body,
      createdBy: adminId,
      updatedBy: adminId
    };

    // Auto-generate sectionTitle if not provided
    if (!fieldData.sectionTitle) {
      const sectionTitles = {
        'general_basic_info': 'General & Basic Info',
        'religion_cultural': 'Religion & Cultural',
        'location_education': 'Present Location & Education',
        'address_details': 'Address Details',
        'profile_personal': 'Profile & Personal',
        'partner_preferences': 'Partner Preferences',
        'privacy_settings': 'Privacy Settings'
      };
      fieldData.sectionTitle = sectionTitles[fieldData.section] || fieldData.section;
    }

    // Clean up empty options
    if (fieldData.options && Array.isArray(fieldData.options)) {
      fieldData.options = fieldData.options.filter(opt => 
        opt && opt.label && opt.value && opt.label.trim() !== '' && opt.value.trim() !== ''
      );
    }

    // Clean validation
    if (fieldData.validation) {
      const validation = fieldData.validation;
      if (!validation.minLength || validation.minLength === '') delete validation.minLength;
      if (!validation.maxLength || validation.maxLength === '') delete validation.maxLength;
      if (!validation.pattern || validation.pattern === '') delete validation.pattern;
      if (!validation.patternMessage || validation.patternMessage === '') delete validation.patternMessage;
      if (!validation.message || validation.message === '') delete validation.message;
    }

    // Convert to numbers
    fieldData.sectionOrder = parseInt(fieldData.sectionOrder) || 0;
    fieldData.fieldOrder = parseInt(fieldData.fieldOrder) || 0;
    if (fieldData.validation?.minLength) fieldData.validation.minLength = parseInt(fieldData.validation.minLength);
    if (fieldData.validation?.maxLength) fieldData.validation.maxLength = parseInt(fieldData.validation.maxLength);

    const field = new FormField(fieldData);
    await field.save();

    await field.populate('createdBy', 'name email');

    console.log('✅ Form field created successfully:', field._id);
    
    res.status(201).json({
      success: true,
      message: 'Form field created successfully',
      data: field
    });
  } catch (error) {
    console.error('❌ Error creating form field:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Field name already exists'
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating form field',
      error: error.message
    });
  }
};

// Update form field
export const updateFormField = async (req, res) => {
  try {
    // Check both req.admin and req.user
    const adminId = req.admin?._id || req.admin?.id || req.user?._id || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in again.'
      });
    }

    const field = await FormField.findById(req.params.id);
    
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Form field not found'
      });
    }

    const updateData = {
      ...req.body,
      updatedBy: adminId,
      updatedAt: Date.now()
    };

    // Clean up options array
    if (updateData.options && Array.isArray(updateData.options)) {
      updateData.options = updateData.options.filter(opt => 
        opt && opt.label && opt.value && opt.label.trim() !== '' && opt.value.trim() !== ''
      );
    }

    // Convert string numbers to actual numbers
    if (updateData.sectionOrder) updateData.sectionOrder = parseInt(updateData.sectionOrder);
    if (updateData.fieldOrder) updateData.fieldOrder = parseInt(updateData.fieldOrder);
    if (updateData.validation?.minLength) updateData.validation.minLength = parseInt(updateData.validation.minLength);
    if (updateData.validation?.maxLength) updateData.validation.maxLength = parseInt(updateData.validation.maxLength);

    const updatedField = await FormField.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('updatedBy', 'name email');

    res.json({
      success: true,
      message: 'Form field updated successfully',
      data: updatedField
    });
  } catch (error) {
    console.error('Error updating form field:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Field name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating form field',
      error: error.message
    });
  }
};

// Delete form field
export const deleteFormField = async (req, res) => {
  try {
    const field = await FormField.findById(req.params.id);
    
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Form field not found'
      });
    }

    await FormField.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Form field deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting form field:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting form field',
      error: error.message
    });
  }
};

// Toggle field status
export const toggleFieldStatus = async (req, res) => {
  try {
    // Check both req.admin and req.user
    const adminId = req.admin?._id || req.admin?.id || req.user?._id || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in again.'
      });
    }

    const field = await FormField.findById(req.params.id);
    
    if (!field) {
      return res.status(404).json({
        success: false,
        message: 'Form field not found'
      });
    }

    field.isActive = !field.isActive;
    field.updatedBy = adminId;
    await field.save();

    res.json({
      success: true,
      message: `Field ${field.isActive ? 'activated' : 'deactivated'} successfully`,
      data: field
    });
  } catch (error) {
    console.error('Error toggling field status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling field status',
      error: error.message
    });
  }
};

// Reorder fields
export const reorderFields = async (req, res) => {
  try {
    // Check both req.admin and req.user
    const adminId = req.admin?._id || req.admin?.id || req.user?._id || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in again.'
      });
    }

    const { orders } = req.body; // [{fieldId, sectionOrder, fieldOrder}]
    
    const bulkOps = orders.map(order => ({
      updateOne: {
        filter: { _id: order.fieldId },
        update: { 
          sectionOrder: order.sectionOrder,
          fieldOrder: order.fieldOrder,
          updatedBy: adminId
        }
      }
    }));

    await FormField.bulkWrite(bulkOps);

    res.json({
      success: true,
      message: 'Fields reordered successfully'
    });
  } catch (error) {
    console.error('Error reordering fields:', error);
    res.status(500).json({
      success: false,
      message: 'Error reordering fields',
      error: error.message
    });
  }
};

// ==================== DATALIST MANAGEMENT ====================

// Get all datalists
export const getDatalists = async (req, res) => {
  try {
    const { isActive } = req.query;
    let filter = {};
    
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const datalists = await Datalist.find(filter)
      .sort({ name: 1 });
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      success: true,
      data: datalists,
      count: datalists.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Error fetching datalists:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching datalists',
      error: error.message
    });
  }
};

// Create datalist
export const createDatalist = async (req, res) => {
  try {
    console.log('Creating datalist with data:', req.body);
    
    // Clean up options array
    const datalistData = { ...req.body };
    if (datalistData.options && Array.isArray(datalistData.options)) {
      datalistData.options = datalistData.options.filter(opt => 
        opt && opt.label && opt.value && opt.label.trim() !== '' && opt.value.trim() !== ''
      );
    }

    const datalist = new Datalist(datalistData);
    await datalist.save();

    console.log('✅ Datalist created successfully:', datalist._id);

    res.status(201).json({
      success: true,
      message: 'Datalist created successfully',
      data: datalist
    });
  } catch (error) {
    console.error('❌ Error creating datalist:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Datalist name already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating datalist',
      error: error.message
    });
  }
};

// Update datalist
export const updateDatalist = async (req, res) => {
  try {
    const datalist = await Datalist.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!datalist) {
      return res.status(404).json({
        success: false,
        message: 'Datalist not found'
      });
    }

    res.json({
      success: true,
      message: 'Datalist updated successfully',
      data: datalist
    });
  } catch (error) {
    console.error('Error updating datalist:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating datalist',
      error: error.message
    });
  }
};

// Delete datalist
export const deleteDatalist = async (req, res) => {
  try {
    const datalist = await Datalist.findById(req.params.id);
    
    if (!datalist) {
      return res.status(404).json({
        success: false,
        message: 'Datalist not found'
      });
    }

    // Check if any field is using this datalist
    const fieldsUsingDatalist = await FormField.findOne({ datalistId: datalist.name });
    if (fieldsUsingDatalist) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete datalist. It is being used by form fields.'
      });
    }

    await Datalist.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Datalist deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting datalist:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting datalist',
      error: error.message
    });
  }
};

// Add option to datalist
export const addDatalistOption = async (req, res) => {
  try {
    const { label, value } = req.body;
    const datalist = await Datalist.findById(req.params.id);
    
    if (!datalist) {
      return res.status(404).json({
        success: false,
        message: 'Datalist not found'
      });
    }

    // Check if option already exists
    const existingOption = datalist.options.find(
      opt => opt.value === value || opt.label === label
    );
    
    if (existingOption) {
      return res.status(400).json({
        success: false,
        message: 'Option with this label or value already exists'
      });
    }

    datalist.options.push({ label, value, isActive: true });
    await datalist.save();

    res.json({
      success: true,
      message: 'Option added successfully',
      data: datalist
    });
  } catch (error) {
    console.error('Error adding option:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding option',
      error: error.message
    });
  }
};

// Remove option from datalist
export const removeDatalistOption = async (req, res) => {
  try {
    const { optionId } = req.params;
    const datalist = await Datalist.findById(req.params.id);
    
    if (!datalist) {
      return res.status(404).json({
        success: false,
        message: 'Datalist not found'
      });
    }

    datalist.options = datalist.options.filter(opt => opt._id.toString() !== optionId);
    await datalist.save();

    res.json({
      success: true,
      message: 'Option removed successfully',
      data: datalist
    });
  } catch (error) {
    console.error('Error removing option:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing option',
      error: error.message
    });
  }
};

// Toggle datalist option status
export const toggleDatalistOption = async (req, res) => {
  try {
    const { optionId } = req.params;
    const datalist = await Datalist.findById(req.params.id);
    
    if (!datalist) {
      return res.status(404).json({
        success: false,
        message: 'Datalist not found'
      });
    }

    const option = datalist.options.id(optionId);
    if (!option) {
      return res.status(404).json({
        success: false,
        message: 'Option not found'
      });
    }

    option.isActive = !option.isActive;
    await datalist.save();

    res.json({
      success: true,
      message: `Option ${option.isActive ? 'activated' : 'deactivated'} successfully`,
      data: datalist
    });
  } catch (error) {
    console.error('Error toggling option status:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling option status',
      error: error.message
    });
  }
};

// ==================== FORM CONFIGURATION FOR FRONTEND ====================

// Get complete form configuration for frontend (Public endpoint)
export const getFormConfiguration = async (req, res) => {
  try {
    const fields = await FormField.find({ isActive: true })
      .sort({ sectionOrder: 1, fieldOrder: 1 })
      .select('-createdBy -updatedBy -createdAt -updatedAt')
      .lean();

    // Group fields by section
    const sections = {};
    fields.forEach(field => {
      if (!sections[field.section]) {
        sections[field.section] = {
          title: field.sectionTitle,
          order: field.sectionOrder,
          fields: []
        };
      }
      sections[field.section].fields.push(field);
    });

    // Get all active datalists
    const datalists = await Datalist.find({ isActive: true })
      .select('name options')
      .lean();
    
    const datalistMap = {};
    datalists.forEach(dl => {
      datalistMap[dl.name] = dl.options.filter(opt => opt.isActive);
    });

    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      data: {
        sections,
        datalists: datalistMap,
        lastUpdated: Date.now()
      }
    });
  } catch (error) {
    console.error('Error fetching form configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching form configuration',
      error: error.message
    });
  }
};

// Export form configuration as JSON
export const exportFormConfiguration = async (req, res) => {
  try {
    const fields = await FormField.find({})
      .sort({ sectionOrder: 1, fieldOrder: 1 })
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    const datalists = await Datalist.find({}).lean();

    const configuration = {
      exportDate: new Date().toISOString(),
      formFields: fields,
      datalists: datalists,
      metadata: {
        totalFields: fields.length,
        totalDatalists: datalists.length,
        activeFields: fields.filter(f => f.isActive).length,
        activeDatalists: datalists.filter(d => d.isActive).length
      }
    };

    res.setHeader('Content-Disposition', 'attachment; filename=form-configuration.json');
    res.setHeader('Content-Type', 'application/json');
    
    res.send(JSON.stringify(configuration, null, 2));
  } catch (error) {
    console.error('Error exporting form configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting form configuration',
      error: error.message
    });
  }
};

// Import form configuration
export const importFormConfiguration = async (req, res) => {
  try {
    // Check both req.admin and req.user
    const adminId = req.admin?._id || req.admin?.id || req.user?._id || req.user?.id;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { formFields, datalists } = req.body;

    if (!formFields || !Array.isArray(formFields)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid configuration format'
      });
    }

    // Clear existing data
    await FormField.deleteMany({});
    await Datalist.deleteMany({});

    // Import form fields
    const fieldPromises = formFields.map(fieldData => {
      const field = new FormField({
        ...fieldData,
        createdBy: adminId,
        updatedBy: adminId
      });
      return field.save();
    });

    // Import datalists
    const datalistPromises = datalists.map(datalistData => {
      const datalist = new Datalist(datalistData);
      return datalist.save();
    });

    await Promise.all([...fieldPromises, ...datalistPromises]);

    res.json({
      success: true,
      message: 'Form configuration imported successfully',
      imported: {
        fields: formFields.length,
        datalists: datalists.length
      }
    });
  } catch (error) {
    console.error('Error importing form configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Error importing form configuration',
      error: error.message
    });
  }
};


// userController.js में नया function (अंत में add करें)

// Field Type Migration Controller
export const migrateFieldType = async (req, res) => {
  try {
    const { fieldId } = req.params;
    const { newType, oldType, fieldName } = req.body;

    console.log(`🔄 Starting field type migration for: ${fieldName} (${oldType} → ${newType})`);

    // Step 1: Field update in FormField collection
    const updatedField = await FormField.findByIdAndUpdate(
      fieldId,
      { type: newType, updatedAt: Date.now() },
      { new: true }
    );

    if (!updatedField) {
      return res.status(404).json({
        success: false,
        message: 'Field not found in FormField collection'
      });
    }

    // Step 2: Migrate ALL users' data for this field
    const migrationResult = await migrateUserDataForField(fieldName, oldType, newType);

    // Step 3: Clear cache
    clearFormCache();

    res.json({
      success: true,
      message: `✅ Field type updated to ${newType}. ${migrationResult.migrated} users migrated, ${migrationResult.failed} failed.`,
      data: {
        field: updatedField,
        migration: migrationResult
      }
    });

  } catch (error) {
    console.error('❌ Field type migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Migration failed: ' + error.message
    });
  }
};

// Helper: Migrate user data
async function migrateUserDataForField(fieldName, oldType, newType) {
  try {
    console.log(`📊 Looking for users with field: ${fieldName}`);
    
    // Find users who have this field in their formData
    const users = await User.find({
      [`formData.${fieldName}`]: { $exists: true }
    });

    console.log(`👥 Found ${users.length} users with field ${fieldName}`);

    let migrated = 0;
    let failed = 0;
    const migrationLog = [];

    for (const user of users) {
      try {
        const oldValue = user.formData.get(fieldName);
        
        if (oldValue !== undefined && oldValue !== null) {
          // Convert the value based on type change
          const newValue = convertDataType(oldValue, oldType, newType, fieldName);
          
          // Update user's formData
          user.formData.set(fieldName, newValue);
          await user.save();
          
          migrated++;
          migrationLog.push({
            userId: user._id,
            vivId: user.vivId,
            oldValue,
            newValue,
            success: true
          });
          
          if (migrated % 100 === 0) {
            console.log(`✅ Migrated ${migrated}/${users.length} users...`);
          }
        }
      } catch (userError) {
        console.error(`❌ Failed to migrate user ${user.vivId}:`, userError.message);
        failed++;
        migrationLog.push({
          userId: user._id,
          vivId: user.vivId,
          error: userError.message,
          success: false
        });
      }
    }

    console.log(`🎉 Migration complete: ${migrated} successful, ${failed} failed`);
    
    return {
      totalUsers: users.length,
      migrated,
      failed,
      log: migrationLog.slice(0, 10) // First 10 entries only
    };

  } catch (error) {
    console.error('❌ Migration helper error:', error);
    throw error;
  }
}

// Helper: Convert data types
function convertDataType(value, fromType, toType, fieldName) {
  // If value is already null/undefined, return empty based on type
  if (value === null || value === undefined) {
    switch (toType) {
      case 'text': return '';
      case 'number': return 0;
      case 'checkbox': return false;
      case 'select': 
      case 'radio': 
      case 'datalist': return '';
      case 'date': return '';
      default: return '';
    }
  }

  const stringValue = String(value).trim();

  // Common conversions
  switch (fromType) {
    case 'text':
      switch (toType) {
        case 'number':
          const num = Number(stringValue);
          return isNaN(num) ? 0 : num;
        case 'checkbox':
          return stringValue.toLowerCase() === 'true' || 
                 stringValue === '1' || 
                 stringValue.toLowerCase() === 'yes';
        case 'select':
        case 'radio':
        case 'datalist':
          // Return as is, will be validated by frontend
          return stringValue;
        case 'date':
          // Try to parse date
          const date = new Date(stringValue);
          return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
        default:
          return stringValue;
      }

    case 'number':
      switch (toType) {
        case 'text':
          return stringValue;
        case 'checkbox':
          return Number(value) !== 0;
        case 'select':
        case 'radio':
          return stringValue;
        default:
          return value;
      }

    case 'select':
    case 'radio':
      switch (toType) {
        case 'text':
          return stringValue;
        case 'checkbox':
          return stringValue !== '' && stringValue !== '0' && stringValue.toLowerCase() !== 'false';
        case 'number':
          const num = Number(stringValue);
          return isNaN(num) ? 0 : num;
        default:
          return value;
      }

    case 'checkbox':
      const boolValue = Boolean(value);
      switch (toType) {
        case 'text':
          return boolValue ? 'Yes' : 'No';
        case 'number':
          return boolValue ? 1 : 0;
        case 'select':
        case 'radio':
          return boolValue ? 'true' : 'false';
        default:
          return value;
      }

    case 'date':
      switch (toType) {
        case 'text':
          return stringValue;
        case 'number':
          const date = new Date(stringValue);
          return isNaN(date.getTime()) ? 0 : date.getTime();
        default:
          return value;
      }

    default:
      // For any other type or same type
      return value;
  }
}

// Clear form cache
function clearFormCache() {
  // Add your cache clearing logic here
  console.log('🧹 Form cache cleared');
}