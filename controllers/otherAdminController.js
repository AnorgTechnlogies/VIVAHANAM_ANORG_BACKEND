// ABOUT , user fill krra hai WeedingServiceForm admin yha pr dekh rha hai and model ,
// create a Faq from admin  controller and model ,create a Blog on admin side , 
// Contactsubmission user submit krra hai form frontend se or admin uska responce dekh sakta hai ,
// contactinfo admin dynamic contact , socialmedia no , testimonial aproval and delete,
// matchmaking jo admin plan create krra hai vo, 

import mongoose from "mongoose";
import { v2 as cloudinary } from "cloudinary";
import {uploadToCloudinary,deleteFromCloudinary,} from "../utils/cloudinaryUpload.js";
import WeddingUser from "../models/WeddingUser.js";
import Faq from "../models/Faq.js";
import Blog from "../models/Blog.js";
import ContactSubmission from "../models/ContactSubmission.js";
import ContactInfo from "../models/ContactInfo.js";
import Testimonial from "../models/testimonialModel.js";
import MatchmakingPlan from "../models/MatchmakingPlan.js";


//faqController.js

export const createFaq = async (req, res) => {
  try {
    const { question, answer } = req.body;
    
    // Validate required fields
    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: "Question and answer are required",
      });
    }

    const faq = await Faq.create({ question, answer });
    
    res.status(201).json({
      success: true,
      message: "FAQ created successfully",
      data: faq,
    });
  } catch (err) {
    console.error("Create FAQ Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};

export const getFaqs = async (req, res) => {
  try {
    const faqs = await Faq.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: faqs.length,
      data: faqs,
    });
  } catch (err) {
    console.error("Get FAQs Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};

export const updateFaq = async (req, res) => {
  try {
    const { question, answer } = req.body;
    const faq = await Faq.findByIdAndUpdate(
      req.params.id, 
      { question, answer }, 
      { new: true, runValidators: true }
    );
    
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }
    
    res.status(200).json({
      success: true,
      message: "FAQ updated successfully",
      data: faq,
    });
  } catch (err) {
    console.error("Update FAQ Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};

export const deleteFaq = async (req, res) => {
  try {
    const faq = await Faq.findById(req.params.id);
    
    if (!faq) {
      return res.status(404).json({
        success: false,
        message: "FAQ not found",
      });
    }
    
    await faq.deleteOne();
    
    res.status(200).json({
      success: true,
      message: "FAQ deleted successfully",
    });
  } catch (err) {
    console.error("Delete FAQ Error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};


// Blog controllers
export const createBlog = async (req, res) => {
  try {
    console.log("📥 Received blog creation request:");
    console.log("Body:", req.body);
    console.log("Files in request:", req.files);
    console.log("File in request:", req.file);

    const { author, date, time, title, description, slug } = req.body;
    
    // Validate required fields
    if (!title || !description || !slug) {
      return res.status(400).json({
        success: false,
        message: "Title, description, and slug are required",
      });
    }

    let imageUrl;

    // Handle different image upload scenarios
    if (req.file) {
      // Multer file upload
      console.log("📸 Uploading multer file to Cloudinary");
      imageUrl = await uploadToCloudinary(req.file.buffer);
    } else if (req.body.image && typeof req.body.image === 'string') {
      // Base64 image in body
      console.log("📸 Uploading base64 image to Cloudinary");
      imageUrl = await uploadToCloudinary(req.body.image);
    } else if (req.files && req.files.image) {
      // Multiple files with multer
      console.log("📸 Uploading files array image to Cloudinary");
      imageUrl = await uploadToCloudinary(req.files.image[0].buffer);
    } else {
      console.log("❌ No image data received");
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    const blog = await Blog.create({
      author: author || "Admin",
      date: date || new Date().toISOString().split('T')[0],
      time: time || new Date().toLocaleTimeString(),
      title,
      description,
      slug,
      image: imageUrl,
    });

    console.log("✅ Blog created successfully:", blog._id);
    
    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: blog,
    });
  } catch (err) {
    console.error("❌ Blog creation error:", err);
    
    // Handle duplicate slug error
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Blog with this slug already exists",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};

export const getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: blogs.length,
      data: blogs,
    });
  } catch (err) {
    console.error("❌ Get blogs error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};

export const getBlogBySlug = async (req, res) => {
  try {
    const blog = await Blog.findOne({ slug: req.params.slug });
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }
    
    res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    console.error("❌ Get blog by slug error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};

export const updateBlog = async (req, res) => {
  try {
    const { author, date, time, title, description, slug } = req.body;
    
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    let image = blog.image;

    // Handle image update if new image provided
    if (req.file) {
      console.log("🔄 Updating blog image");
      // Delete old image from Cloudinary
      if (blog.image) {
        await deleteFromCloudinary(blog.image).catch(err => 
          console.warn("⚠️ Could not delete old image:", err.message)
        );
      }
      // Upload new image
      image = await uploadToCloudinary(req.file.buffer);
    } else if (req.body.image && typeof req.body.image === 'string') {
      console.log("🔄 Updating blog image from base64");
      // Delete old image from Cloudinary
      if (blog.image) {
        await deleteFromCloudinary(blog.image).catch(err => 
          console.warn("⚠️ Could not delete old image:", err.message)
        );
      }
      // Upload new base64 image
      image = await uploadToCloudinary(req.body.image);
    }

    const updatedBlog = await Blog.findByIdAndUpdate(
      req.params.id,
      { 
        author: author || blog.author,
        date: date || blog.date,
        time: time || blog.time,
        title: title || blog.title,
        description: description || blog.description,
        slug: slug || blog.slug,
        image 
      },
      { new: true, runValidators: true }
    );

    console.log("✅ Blog updated successfully:", updatedBlog._id);
    
    res.status(200).json({
      success: true,
      message: "Blog updated successfully",
      data: updatedBlog,
    });
  } catch (err) {
    console.error("❌ Blog update error:", err);
    
    // Handle duplicate slug error
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Blog with this slug already exists",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};

export const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({
        success: false,
        message: "Blog not found",
      });
    }

    // Delete image from Cloudinary
    if (blog.image) {
      await deleteFromCloudinary(blog.image).catch(err => 
        console.warn("⚠️ Could not delete image from Cloudinary:", err.message)
      );
    }

    await blog.deleteOne();

    console.log("✅ Blog deleted successfully:", blog._id);
    
    res.status(200).json({
      success: true,
      message: "Blog deleted successfully",
    });
  } catch (err) {
    console.error("❌ Blog deletion error:", err);
    res.status(500).json({
      success: false,
      message: "Server error: " + err.message,
    });
  }
};


// ===  CONTACT SUBMISSION congtroller  (from user form) ===
export const saveContactSubmission = async (req, res) => {
  const { name, email, phone, message } = req.body;

  try {
    const newSubmission = new ContactSubmission({
      name,
      email,
      phone: phone || "",
      message,
    });

    await newSubmission.save();

    // Optional: Send email notification to admin
    try {
      await sendEmailNotification({
        to: process.env.ADMIN_NOTIFICATION_EMAIL || "admin@example.com",
        subject: "New Contact Form Submission",
        html: `
          <h3>New Contact Inquiry</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Phone:</strong> ${phone || "—"}</p>
          <p><strong>Message:</strong><br/>${message}</p>
          <hr/>
          <small>Submitted at: ${new Date().toLocaleString()}</small>
        `,
      });
    } catch (emailErr) {
      console.warn("Email notification failed:", emailErr.message);
    }

    res.status(201).json({
      success: true,
      message: "Thank you! Your message has been sent.",
    });
  } catch (error) {
    console.error("Error saving contact submission:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message. Please try again later.",
    });
  }
};

// === GET ALL CONTACT SUBMISSIONS (Admin only) ===
export const getAllContactSubmissions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const total = await ContactSubmission.countDocuments();
    const submissions = await ContactSubmission.find()
      .sort({ submittedAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: submissions,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching submissions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch submissions.",
    });
  }
};

// === DELETE CONTACT SUBMISSION (Admin only) ===
export const deleteContactSubmission = async (req, res) => {
  const { id } = req.params;

  try {
    const submission = await ContactSubmission.findByIdAndDelete(id);
    if (!submission) {
      return res.status(404).json({
        success: false,
        message: "Submission not found.",
      });
    }

    res.status(200).json({
      success: true,
      message: "Submission deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting submission:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete submission.",
    });
  }
};



// Create contact information controller

export const createContactInfo = async (req, res) => {
  try {
    const { phone, email, office, isActive = true } = req.body;

    console.log("📝 Creating contact info:", { phone, email, office, isActive });

    // Validate required fields
    if (!phone || !email || !office) {
      return res.status(400).json({
        success: false,
        message: "Phone, email, and office are required fields",
      });
    }

    // If setting as active, deactivate all others
    if (isActive === true) {
      console.log("🔄 Deactivating all other contact info...");
      await ContactInfo.updateMany({}, { isActive: false });
    }

    const contactInfo = new ContactInfo({
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      office: office.trim(),
      isActive: isActive,
    });

    await contactInfo.save();
    console.log("✅ Contact info created successfully:", contactInfo._id);

    res.status(201).json({
      success: true,
      message: "Contact information created successfully",
      data: contactInfo,
    });
  } catch (error) {
    console.error("❌ Error creating contact info:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Contact information with these details already exists",
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error while creating contact information",
    });
  }
};

// Get contact information
export const getContactInfo = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const query = activeOnly === "true" ? { isActive: true } : {};

    console.log("📋 Fetching contact info with query:", query);

    const contactInfo = await ContactInfo.find(query)
      .sort({ isActive: -1, createdAt: -1 })
      .lean();

    console.log(`✅ Found ${contactInfo.length} contact info records`);

    // If activeOnly is true, return the first active record or null
    if (activeOnly === "true") {
      const activeInfo = contactInfo.find(info => info.isActive) || null;
      return res.status(200).json({
        success: true,
        data: activeInfo,
      });
    }

    // Return all records as array
    res.status(200).json({
      success: true,
      data: contactInfo,
      count: contactInfo.length,
    });
  } catch (error) {
    console.error("❌ Error fetching contact info:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching contact information",
    });
  }
};

// Get active contact information (public endpoint)
export const getActiveContactInfo = async (req, res) => {
  try {
    console.log("🌐 Fetching active contact info for public...");
    
    const contactInfo = await ContactInfo.findOne({ isActive: true }).lean();

    if (!contactInfo) {
      console.log("⚠️ No active contact info found, returning defaults");
      // Return default values if no active contact info exists
      return res.status(200).json({
        success: true,
        data: {
          phone: "+1 888 768 8289",
          email: "ourdivinethoughts@gmail.com",
          office: "North America",
        },
      });
    }

    console.log("✅ Active contact info found");
    res.status(200).json({
      success: true,
      data: contactInfo,
    });
  } catch (error) {
    console.error("❌ Error fetching active contact info:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching contact information",
    });
  }
};

// Update contact information
export const updateContactInfo = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    console.log("🔄 Updating contact info ID:", id);
    console.log("📝 Updates:", updates);

    // Validate ID format
    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact information ID format",
      });
    }

    // Check if document exists first with better error handling
    let existingInfo;
    try {
      existingInfo = await ContactInfo.findById(id);
    } catch (dbError) {
      console.error("❌ Database error finding contact info:", dbError);
      return res.status(500).json({
        success: false,
        message: "Database error while finding contact information",
      });
    }

    if (!existingInfo) {
      console.log("❌ Contact info not found with ID:", id);
      return res.status(404).json({
        success: false,
        message: "Contact information not found",
      });
    }

    console.log("✅ Found existing contact info:", existingInfo._id);

    // If setting as active, deactivate all others
    if (updates.isActive === true) {
      console.log("🔄 Deactivating all other contact info...");
      await ContactInfo.updateMany(
        { _id: { $ne: id } },
        { isActive: false }
      );
    }

    // Clean up the updates
    const cleanUpdates = {};
    if (updates.phone !== undefined) cleanUpdates.phone = updates.phone.trim();
    if (updates.email !== undefined) cleanUpdates.email = updates.email.trim().toLowerCase();
    if (updates.office !== undefined) cleanUpdates.office = updates.office.trim();
    if (updates.isActive !== undefined) cleanUpdates.isActive = updates.isActive;

    // Handle additional fields if provided
    if (updates.additionalPhones !== undefined) cleanUpdates.additionalPhones = updates.additionalPhones;
    if (updates.additionalEmails !== undefined) cleanUpdates.additionalEmails = updates.additionalEmails;
    if (updates.address !== undefined) cleanUpdates.address = updates.address;
    if (updates.workingHours !== undefined) cleanUpdates.workingHours = updates.workingHours;
    if (updates.socialMedia !== undefined) cleanUpdates.socialMedia = updates.socialMedia;
    if (updates.supportDetails !== undefined) cleanUpdates.supportDetails = updates.supportDetails;

    const contactInfo = await ContactInfo.findByIdAndUpdate(
      id,
      { $set: cleanUpdates },
      { new: true, runValidators: true }
    );

    console.log("✅ Contact info updated successfully:", contactInfo._id);

    res.status(200).json({
      success: true,
      message: "Contact information updated successfully",
      data: contactInfo,
    });
  } catch (error) {
    console.error("❌ Error updating contact info:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid contact information ID format",
      });
    }
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: errors.join(', '),
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error while updating contact information",
    });
  }
};

// Delete contact information
export const deleteContactInfo = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log("🗑️ Deleting contact info ID:", id);

    // Validate ID format
    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact information ID format",
      });
    }

    // Check if document exists first
    let existingInfo;
    try {
      existingInfo = await ContactInfo.findById(id);
    } catch (dbError) {
      console.error("❌ Database error finding contact info:", dbError);
      return res.status(500).json({
        success: false,
        message: "Database error while finding contact information",
      });
    }

    if (!existingInfo) {
      console.log("❌ Contact info not found with ID:", id);
      return res.status(404).json({
        success: false,
        message: "Contact information not found",
      });
    }

    const contactInfo = await ContactInfo.findByIdAndDelete(id);

    console.log("✅ Contact info deleted successfully:", id);

    res.status(200).json({
      success: true,
      message: "Contact information deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting contact info:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid contact information ID format",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error while deleting contact information",
    });
  }
};

// Set active contact information
export const setActiveContactInfo = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("⭐ Setting active contact info ID:", id);

    // Validate ID format
    if (!id || id === "undefined" || id === "null") {
      return res.status(400).json({
        success: false,
        message: "Invalid contact information ID format",
      });
    }

    // Check if document exists first with better error handling
    let existingInfo;
    try {
      existingInfo = await ContactInfo.findById(id);
      console.log("🔍 Database query result:", existingInfo);
    } catch (dbError) {
      console.error("❌ Database error finding contact info:", dbError);
      return res.status(500).json({
        success: false,
        message: "Database error while finding contact information",
      });
    }

    if (!existingInfo) {
      console.log("❌ Contact info not found with ID:", id);
      
      // Let's check what IDs actually exist in the database
      const allIds = await ContactInfo.find({}, '_id').lean();
      console.log("📋 Available IDs in database:", allIds);
      
      return res.status(404).json({
        success: false,
        message: "Contact information not found",
        debug: {
          requestedId: id,
          availableIds: allIds.map(doc => doc._id.toString())
        }
      });
    }

    console.log("✅ Found contact info to activate:", existingInfo._id);

    // Deactivate all contact info
    await ContactInfo.updateMany({}, { isActive: false });

    // Activate the selected one
    const contactInfo = await ContactInfo.findByIdAndUpdate(
      id,
      { isActive: true },
      { new: true }
    );

    console.log("✅ Contact info set as active:", contactInfo._id);

    res.status(200).json({
      success: true,
      message: "Contact information set as active",
      data: contactInfo,
    });
  } catch (error) {
    console.error("❌ Error setting active contact info:", error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: "Invalid contact information ID format",
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Internal server error while setting active contact information",
    });
  }
};

// testimonial controller
// === Testimonial Submit Testimonial controller 
export const submitTestimonial = async (req, res) => {
  try {
    const { name, weddingDate, message, rating, submittedBy, image } = req.body;

    // Validate required fields
    if (!name || !weddingDate || !message || !rating) {
      return res.status(400).json({
        success: false,
        message: "Name, wedding date, message, and rating are required",
      });
    }

    if (!image) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    // Upload base64 image to Cloudinary
    const result = await cloudinary.uploader.upload(image, {
      folder: "testimonials_pending",
      transformation: [
        { width: 800, height: 800, crop: "limit" },
        { quality: "auto" },
        { fetch_format: "auto" },
      ],
    });

    const testimonial = await Testimonial.create({
      name: name.trim(),
      weddingDate,
      message: message.trim(),
      rating: Number(rating),
      submittedBy: (submittedBy || "Guest").trim(),
      image: {
        public_id: result.public_id,
        url: result.secure_url,
      },
      isActive: false, // Pending approval
    });

    res.status(201).json({
      success: true,
      message: "Thank you! Your testimonial is under review.",
      data: {
        _id: testimonial._id,
        name: testimonial.name,
        submittedAt: testimonial.createdAt,
      },
    });
  } catch (error) {
    console.error("Submit Testimonial Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to submit testimonial. Please try again.",
    });
  }
};

// === PUBLIC: Get Approved Testimonials ===
export const getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isActive: true })
      .select("name weddingDate message rating image createdAt")
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials,
    });
  } catch (error) {
    console.error("Get Testimonials Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch testimonials",
    });
  }
};

// === ADMIN: Get All Testimonials (with status) ===
export const getAllTestimonialsAdmin = async (req, res) => {
  try {
    const testimonials = await Testimonial.find()
      .select("-__v")
      .sort({ isActive: 1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: testimonials.length,
      data: testimonials,
    });
  } catch (error) {
    console.error("Get All Admin Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch testimonials",
    });
  }
};

// === ADMIN: Approve Testimonial (IDEMPOTENT & SAFE) ===
export const approveTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const testimonial = await Testimonial.findById(id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    // If already approved → return success (idempotent)
    if (testimonial.isActive) {
      return res.status(200).json({
        success: true,
        message: "Testimonial is already approved",
        data: testimonial,
      });
    }

    let imageMoved = false;

    // Only move image if it's in pending folder
    if (testimonial.image?.public_id?.includes("testimonials_pending")) {
      const newPublicId = testimonial.image.public_id.replace(
        "testimonials_pending",
        "testimonials"
      );

      try {
        await cloudinary.uploader.rename(
          testimonial.image.public_id,
          newPublicId
        );

        testimonial.image.public_id = newPublicId;
        testimonial.image.url = testimonial.image.url.replace(
          "testimonials_pending",
          "testimonials"
        );
        imageMoved = true;
      } catch (renameErr) {
        console.warn("Cloudinary rename failed (non-critical):", renameErr.message);
      }
    }

    testimonial.isActive = true;
    await testimonial.save();

    res.status(200).json({
      success: true,
      message: imageMoved
        ? "Testimonial approved and image moved to live folder"
        : "Testimonial approved",
      data: testimonial,
    });
  } catch (error) {
    console.error("Approve Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to approve testimonial",
    });
  }
};

// === ADMIN: Create Testimonial (Direct) ===
export const createTestimonial = async (req, res) => {
  try {
    const { name, weddingDate, message, rating, image } = req.body;

    if (!name || !weddingDate || !message || !rating || !image) {
      return res.status(400).json({
        success: false,
        message: "All fields and image are required",
      });
    }

    const result = await cloudinary.uploader.upload(image, {
      folder: "testimonials",
      transformation: [
        { width: 800, height: 800, crop: "limit" },
        { quality: "auto" },
      ],
    });

    const testimonial = await Testimonial.create({
      name: name.trim(),
      weddingDate,
      message: message.trim(),
      rating: Number(rating),
      image: {
        public_id: result.public_id,
        url: result.secure_url,
      },
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: "Testimonial created",
      data: testimonial,
    });
  } catch (error) {
    console.error("Create Testimonial Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create testimonial",
    });
  }
};

// === ADMIN: Update Testimonial ===
export const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, weddingDate, message, rating, isActive, image } = req.body;

    const testimonial = await Testimonial.findById(id);
    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    let imageUpdate = testimonial.image;

    if (image) {
      // Delete old image
      if (testimonial.image?.public_id) {
        await cloudinary.uploader.destroy(testimonial.image.public_id).catch(() => {});
      }

      const targetFolder = (isActive === "true" || isActive === true || testimonial.isActive) 
        ? "testimonials" 
        : "testimonials_pending";
        
      const result = await cloudinary.uploader.upload(image, {
        folder: targetFolder,
        transformation: [
          { width: 800, height: 800, crop: "limit" },
          { quality: "auto" },
        ],
      });

      imageUpdate = {
        public_id: result.public_id,
        url: result.secure_url,
      };
    }

    // Update fields
    testimonial.name = name?.trim() || testimonial.name;
    testimonial.weddingDate = weddingDate || testimonial.weddingDate;
    testimonial.message = message?.trim() || testimonial.message;
    testimonial.rating = rating ? Number(rating) : testimonial.rating;
    testimonial.isActive = isActive !== undefined 
      ? isActive === "true" || isActive === true 
      : testimonial.isActive;
    testimonial.image = imageUpdate;

    const updated = await testimonial.save();

    res.status(200).json({
      success: true,
      message: "Testimonial updated",
      data: updated,
    });
  } catch (error) {
    console.error("Update Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update testimonial",
    });
  }
};

// === ADMIN: Delete Testimonial ===
export const deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const testimonial = await Testimonial.findById(id);

    if (!testimonial) {
      return res.status(404).json({
        success: false,
        message: "Testimonial not found",
      });
    }

    // Delete image from Cloudinary
    if (testimonial.image?.public_id) {
      await cloudinary.uploader.destroy(testimonial.image.public_id).catch(() => {
        console.warn("Failed to delete image from Cloudinary:", testimonial.image.public_id);
      });
    }

    await Testimonial.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Testimonial deleted successfully",
    });
  } catch (error) {
    console.error("Delete Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete testimonial",
    });
  }
};

// matchmaking controller (admin only)

// Create a new matchmaking plan
export const createMatchmakingPlan = async (req, res) => {
  try {
    const planData = req.body;

    // Check if planCode already exists
    const existingPlan = await MatchmakingPlan.findOne({
      planCode: planData.planCode?.toUpperCase(),
    });

    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "Plan with this code already exists",
      });
    }

    // Set profilesAllocated if not provided
    if (!planData.profilesAllocated && planData.profiles) {
      planData.profilesAllocated = planData.profiles;
    }

    // Set plan_features if not provided
    if (!planData.plan_features && planData.features) {
      planData.plan_features = planData.features;
    }

    // Ensure planCode is uppercase
    if (planData.planCode) {
      planData.planCode = planData.planCode.toUpperCase();
    }

    const plan = new MatchmakingPlan(planData);
    await plan.save();

    res.status(201).json({
      success: true,
      message: "Matchmaking plan created successfully",
      data: plan,
    });
  } catch (error) {
    console.error("Error creating matchmaking plan:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error creating matchmaking plan",
    });
  }
};

// Get all matchmaking plans
export const getMatchmakingPlans = async (req, res) => {
  try {
    const { activeOnly } = req.query;
    const query = activeOnly === "true" ? { isActive: true } : {};

    const plans = await MatchmakingPlan.find(query)
      .sort({ order: 1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: plans,
      count: plans.length,
    });
  } catch (error) {
    console.error("Error fetching matchmaking plans:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching matchmaking plans",
    });
  }
};

// Get a single matchmaking plan by ID
export const getMatchmakingPlanById = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MatchmakingPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Matchmaking plan not found",
      });
    }

    res.status(200).json({
      success: true,
      data: plan,
    });
  } catch (error) {
    console.error("Error fetching matchmaking plan:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error fetching matchmaking plan",
    });
  }
};

// Update a matchmaking plan
export const updateMatchmakingPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If planCode is being updated, check for uniqueness
    if (updates.planCode) {
      updates.planCode = updates.planCode.toUpperCase();
      const existingPlan = await MatchmakingPlan.findOne({
        planCode: updates.planCode,
        _id: { $ne: id },
      });

      if (existingPlan) {
        return res.status(400).json({
          success: false,
          message: "Plan with this code already exists",
        });
      }
    }

    // Set profilesAllocated if profiles is updated
    if (updates.profiles && !updates.profilesAllocated) {
      updates.profilesAllocated = updates.profiles;
    }

    // Set plan_features if features is updated
    if (updates.features && !updates.plan_features) {
      updates.plan_features = updates.features;
    }

    const plan = await MatchmakingPlan.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Matchmaking plan not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Matchmaking plan updated successfully",
      data: plan,
    });
  } catch (error) {
    console.error("Error updating matchmaking plan:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error updating matchmaking plan",
    });
  }
};

// Delete a matchmaking plan
export const deleteMatchmakingPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MatchmakingPlan.findByIdAndDelete(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Matchmaking plan not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Matchmaking plan deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting matchmaking plan:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error deleting matchmaking plan",
    });
  }
};

// Toggle plan active status
export const toggleMatchmakingPlanStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const plan = await MatchmakingPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Matchmaking plan not found",
      });
    }

    plan.isActive = !plan.isActive;
    await plan.save();

    res.status(200).json({
      success: true,
      message: `Plan ${plan.isActive ? "activated" : "deactivated"} successfully`,
      data: plan,
    });
  } catch (error) {
    console.error("Error toggling plan status:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error toggling plan status",
    });
  }
};

// Wedding services controller 
// . Get all wedding users (for admin)
export const getAllWeddingUsers = async (req, res) => {
  console.log("all weeding user ko dekh rha hu ",req.body)
  console.log("all weding",req.length);
  
  try {
    const users = await WeddingUser.find().sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// 2. Delete wedding user by ID (admin)
export const deleteWeddingUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await WeddingUser.findByIdAndDelete(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Wedding user not found'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting wedding user:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID format'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};