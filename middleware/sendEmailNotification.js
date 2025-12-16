import transport from "./sendMail.js";

const sendEmailNotification = async (toEmail, subject, message) => {
  try {
    // Check if message is HTML or plain text
    let mailOptions = {
      from: process.env.NODEMAILER_SENDING_EMAIL_ADDRESS,
      to: toEmail,
      subject: subject
    };

    // If message is an object with html property
    if (typeof message === 'object' && message.html) {
      mailOptions.html = message.html;
      if (message.subject) {
        mailOptions.subject = message.subject;
      }
    } else {
      // For plain text
      mailOptions.text = message;
    }

    const info = await transport.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);
    return info;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error; // Rethrow to handle in the controller
  }
};

export default sendEmailNotification;