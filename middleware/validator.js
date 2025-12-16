// validationSchema.js
import Joi from "joi";

// ------------------------------
// 🔹 REGISTER SCHEMAS
// ------------------------------
const registerSchema = Joi.object({
  email: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({ tlds: { allow: ["com", "net"] } }),
  password: Joi.string().required(),
});

const registerSchemaForAdmin = Joi.object({
  adminEmailId: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({ tlds: { allow: ["com", "net", "in"] } }),

  adminPassword: Joi.string()
    .min(8)
    .max(30)
    .required()
    .pattern(new RegExp("^[a-zA-Z0-9!@#$%^&*()]{8,30}$"))
    .messages({
      "string.pattern.base":
        "Password must contain only alphanumeric and special characters",
      "string.min": "Password must be at least 8 characters long",
      "string.max": "Password cannot exceed 30 characters",
    }),

  adminName: Joi.string()
    .min(2)
    .max(50)
    .required()
    .pattern(new RegExp("^[a-zA-Z ]+$"))
    .messages({
      "string.pattern.base": "Name must contain only letters and spaces",
    }),




});

// ------------------------------
// 🔹 LOGIN SCHEMAS
// ------------------------------
const loginSchema = Joi.object({
  staffEmail: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({ tlds: { allow: ["com", "net"] } }),
  staffPassword: Joi.string().required(),
});

const loginSchemaForAdmin = Joi.object({
  adminEmailId: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({ tlds: { allow: ["com", "net", "in"] } }),
  adminPassword: Joi.string().required(),
});

// ------------------------------
// 🔹 DOCUMENT SCHEMA
// ------------------------------
const uploadDocumentSchema = Joi.object({
  title: Joi.string().required().trim().min(3).max(100).messages({
    "string.empty": "Document title is required",
    "string.min": "Document title must be at least 3 characters long",
    "string.max": "Document title cannot exceed 100 characters",
    "any.required": "Document title is required",
  }),

  description: Joi.string().required().trim().min(10).max(500).messages({
    "string.empty": "Document description is required",
    "string.min": "Document description must be at least 10 characters long",
    "string.max": "Document description cannot exceed 500 characters",
    "any.required": "Document description is required",
  }),

  pdfFile: Joi.string().required().messages({
    "string.empty": "PDF file is required",
    "any.required": "PDF file is required",
  }),
});

// ------------------------------
// 🔹 VERIFICATION & PASSWORD
// ------------------------------
const sendVerificationCodeSchema = Joi.object({
  email: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({ tlds: { allow: ["com", "net"] } }),
});

const acceptCodeSchema = Joi.object({
  email: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({ tlds: { allow: ["com", "net"] } }),
  providedCode: Joi.string().min(6).max(6).required(),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().min(8).max(20),
  newPassword: Joi.string().required().min(8).max(20),
});

const sendForgotPasswordCodeSchema = Joi.object({
  adminEmailId: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({ tlds: { allow: ["com", "net"] } }),
});

const sendForgotPasswordCodeForAdminSchema = Joi.object({
  adminEmailId: Joi.string()
    .min(6)
    .max(60)
    .required()
    .email({ tlds: { allow: ["com", "net"] } }),
});

// ✅ NEWLY MERGED SCHEMA
const acceptFPCodeForAdminSchema = Joi.object({
  adminEmailId: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  providedCode: Joi.string().required().messages({
    "any.required": "Verification code is required",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "any.required": "New password is required",
  }),
});

// ------------------------------
// 🔹 PLAN SCHEMAS
// ------------------------------
const createPlanSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .required()
    .pattern(new RegExp("^[a-zA-Z ]+$"))
    .messages({
      "string.pattern.base": "Plan name must contain only letters and spaces",
      "string.min": "Plan name must be at least 2 characters long",
      "string.max": "Plan name cannot exceed 50 characters",
    }),
  billingCycle: Joi.string()
    .valid("monthly", "yearly")
    .required()
    .messages({
      "any.only": "Billing cycle must be either 'monthly' or 'yearly'",
    }),
  price: Joi.string()
    .min(1)
    .max(20)
    .required()
    .pattern(new RegExp("^\\$?\\d+(\\.\\d{2})?$"))
    .messages({
      "string.pattern.base":
        "Price must be a valid currency format (e.g., '$25' or '25')",
    }),
  description: Joi.string().min(10).max(200).required().messages({
    "string.min": "Description must be at least 10 characters long",
    "string.max": "Description cannot exceed 200 characters",
  }),
  features: Joi.array()
    .min(1)
    .max(20)
    .required()
    .items(
      Joi.object({
        text: Joi.string().min(3).max(100).required().trim(),
        included: Joi.boolean().required(),
      })
    ),
  highlight: Joi.boolean(),
  icon: Joi.string().min(1).max(50).required(),
});

const updatePlanSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .optional()
    .pattern(new RegExp("^[a-zA-Z ]+$")),
  billingCycle: Joi.string().valid("monthly", "yearly").optional(),
  price: Joi.string()
    .min(1)
    .max(20)
    .optional()
    .pattern(new RegExp("^\\$?\\d+(\\.\\d{2})?$")),
  description: Joi.string().min(10).max(200).optional(),
  features: Joi.array()
    .min(1)
    .max(20)
    .optional()
    .items(
      Joi.object({
        text: Joi.string().min(3).max(100).optional().trim(),
        included: Joi.boolean().optional(),
      })
    ),
  highlight: Joi.boolean().optional(),
  icon: Joi.string().min(1).max(50).optional(),
});

// ------------------------------
// ✅ EXPORT ALL SCHEMAS
// ------------------------------
export {
  registerSchema,
  registerSchemaForAdmin,
  loginSchema,
  loginSchemaForAdmin,
  uploadDocumentSchema,
  sendVerificationCodeSchema,
  acceptCodeSchema,
  changePasswordSchema,
  sendForgotPasswordCodeSchema,
  sendForgotPasswordCodeForAdminSchema,
  acceptFPCodeForAdminSchema,
  createPlanSchema,
  updatePlanSchema,
};
