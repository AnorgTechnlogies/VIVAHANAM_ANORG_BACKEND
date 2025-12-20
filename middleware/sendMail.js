// middleware/sendMail.js - UPDATED WITH ATTACHMENTS SUPPORT
import nodemailer from 'nodemailer';
import { config } from 'dotenv';
config({ path: './config/config.env' });

let transporter = null;

const createTransport = async () => {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.NODEMAILER_SENDING_EMAIL_ADDRESS,
      pass: process.env.NODEMAILER_SENDING_EMAIL_PASSWORD,
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  return transporter;
};

// Verification Email Template
const verificationTemplate = ({ name, verificationCode }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden; }
    .header { background: linear-gradient(to right, #b45309, #dc2626); padding: 20px; text-align: center; }
    .content { padding: 25px; }
    .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #dc2626; background: #fef3c7; padding: 15px 20px; border-radius: 8px; text-align: center; display: inline-block; margin: 20px 0; }
    .footer { background: #fef3c7; padding: 15px; text-align: center; font-size: 12px; color: #78350f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: white; margin: 0;">Vedic Indian Vivah</h1>
    </div>
    <div class="content">
      <h2 style="color: #b45309;">Hello ${name},</h2>
      <p>Complete your registration with this verification code:</p>
      <div style="text-align: center;">
        <div class="code">${verificationCode}</div>
      </div>
      <p><strong>Expires in 10 minutes.</strong></p>
      <p>If you didn't sign up for Vedic Indian Vivah, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>© 2025 Vedic Indian Vivah. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// Registration Success Template
const registrationSuccessTemplate = ({ name }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden; }
    .header { background: linear-gradient(to right, #b45309, #dc2626); padding: 20px; text-align: center; }
    .content { padding: 25px; }
    .success-box { background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0369a1; }
    .next-steps { background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .footer { background: #fef3c7; padding: 15px; text-align: center; font-size: 12px; color: #78350f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: white; margin: 0;">Vedic Indian Vivah</h1>
    </div>
    <div class="content">
      <h2 style="color: #b45309;">Congratulations ${name}!</h2>
      
      <div class="success-box">
        <h3 style="color: #0369a1; margin-top: 0;">🎉 Registration Successful!</h3>
        <p style="color: #0c4a6e; font-size: 16px;">
          <strong>Your email has been verified and your account is now active!</strong>
        </p>
        <p>Welcome to our community dedicated to fostering meaningful Vedic alliances.</p>
      </div>

      <div class="next-steps">
        <h3 style="color: #78350f; margin-top: 0;">What's Next?</h3>
        <ul style="color: #78350f; padding-left: 20px;">
          <li>Your profile is now complete and active</li>
          <li>Start exploring compatible matches</li>
          <li>Connect with like-minded families</li>
          <li>Receive personalized match suggestions</li>
          <li>Update your preferences anytime</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <p style="font-size: 16px; color: #065f46;">
          <strong>Your journey to find your life partner begins now!</strong>
        </p>
      </div>

      <p>If you have any questions or need assistance, feel free to contact our support team.</p>
      
      <p>Wishing you a blessed journey on this sacred path,<br>
        <strong>The Vedic Indian Vivah Team</strong>
      </p>
    </div>
    <div class="footer">
      <p>© 2025 Vedic Indian Vivah. Fostering holy alliances in North America.</p>
    </div>
  </div>
</body>
</html>
`;

// Welcome Email Template (for after verification)
const welcomeTemplate = ({ name }) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 10px; overflow: hidden; }
    .header { background: linear-gradient(to right, #b45309, #dc2626); padding: 20px; text-align: center; }
    .content { padding: 25px; }
    .cta-button { background: #dc2626; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; }
    .footer { background: #fef3c7; padding: 15px; text-align: center; font-size: 12px; color: #78350f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="color: white; margin: 0;">Vedic Indian Vivah</h1>
    </div>
    <div class="content">
      <h2 style="color: #b45309;">Welcome, ${name}!</h2>
      <p>You're now part of our sacred journey to find meaningful Vedic alliances.</p>
      
      <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #78350f; margin-top: 0;">Next Steps:</h3>
        <ul style="color: #78350f; padding-left: 20px;">
          <li>Complete your profile (if not already done)</li>
          <li>Browse compatible matches</li>
          <li>Connect with families</li>
          <li>Set your partner preferences</li>
        </ul>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URI || 'http://localhost:3000'}/dashboard" class="cta-button">
          Explore Your Dashboard
        </a>
      </div>

      <p>Wishing you a blessed journey,<br>
        <strong>The Vedic Indian Vivah Team</strong>
      </p>
    </div>
    <div class="footer">
      <p>© 2025 Vedic Indian Vivah. Fostering holy alliances in North America.</p>
    </div>
  </div>
</body>
</html>
`;

// MAIN SEND EMAIL FUNCTION WITH ATTACHMENTS SUPPORT
export const sendEmail = async ({ 
  to, 
  subject, 
  text, 
  html, 
  template, 
  templateData, 
  attachments = []  // NEW: Attachments parameter
}) => {
  try {
    const transport = await createTransport();

    const mailOptions = {
      from: process.env.NODEMAILER_SENDING_EMAIL_ADDRESS,
      to,
      subject: subject || 'Vedic Indian Vivah',
    };

    if (text) mailOptions.text = text;
    if (html) mailOptions.html = html;

    // ADD ATTACHMENTS IF PROVIDED
    if (attachments && attachments.length > 0) {
      console.log(`📎 Preparing ${attachments.length} attachment(s) for email`);
      mailOptions.attachments = attachments.map(attachment => {
        console.log(`📎 Attachment: ${attachment.filename}, size: ${attachment.content?.length || 0} bytes`);
        return {
          filename: attachment.filename,
          content: attachment.content, // Should be Buffer
          contentType: attachment.contentType || 'application/pdf',
          encoding: 'base64' // Important for binary files
        };
      });
    }

    // Template-based emails
    if (template === 'verification') {
      mailOptions.subject = subject || 'Verify Your Email - Vedic Indian Vivah';
      mailOptions.html = verificationTemplate(templateData);
    }
    
    if (template === 'registration-success') {
      mailOptions.subject = subject || 'Registration Successful - Welcome to Vedic Indian Vivah!';
      mailOptions.html = registrationSuccessTemplate(templateData);
    }
    
    if (template === 'welcome') {
      mailOptions.subject = subject || 'Welcome to Vedic Indian Vivah!';
      mailOptions.html = welcomeTemplate(templateData);
    }

    console.log('📧 Sending email with options:', {
      to,
      subject: mailOptions.subject,
      attachments: mailOptions.attachments?.length || 0
    });

    const info = await transport.sendMail(mailOptions);
    console.log('✅ Email sent →', info.messageId, 'to:', to);
    console.log('✅ Attachments sent:', attachments.length);
    return info;
  } catch (err) {
    console.error('❌ Email send failed →', err);
    console.error('❌ Error details:', {
      message: err.message,
      code: err.code,
      attachments: attachments?.length || 0
    });
    throw err;
  }
};

// Direct export for common email types
export const sendVerificationEmail = async (to, name, verificationCode) => {
  return sendEmail({
    to,
    template: 'verification',
    templateData: { name, verificationCode }
  });
};

export const sendRegistrationSuccessEmail = async (to, name) => {
  return sendEmail({
    to,
    template: 'registration-success', 
    templateData: { name }
  });
};

export const sendWelcomeEmail = async (to, name) => {
  return sendEmail({
    to,
    template: 'welcome',
    templateData: { name }
  });
};

// NEW: Send invoice email with PDF attachment
export const sendInvoiceEmail = async ({ to, subject, html, attachments }) => {
  console.log('📧 Sending invoice email with attachments');
  return sendEmail({
    to,
    subject,
    html,
    attachments
  });
};

export default sendEmail;