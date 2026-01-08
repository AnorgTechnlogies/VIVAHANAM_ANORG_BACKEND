// is page me kaam krna hai toh payment controler jha se payment hit / sucess ho rhi(capturePayPalOrder) hai, or mail.js middliware 
// services/paymentInvoiceService.js
// change the code to 255-294 tak css or 315-338 tak html code ab line by line information show on register mail 
import PDFDocument from 'pdfkit';
import sendEmail from '../middleware/sendMail.js';

/**
 * Generate invoice PDF buffer
 */
export const generateInvoicePDF = async (invoiceData) => {
  return new Promise((resolve, reject) => {
    try {
      const pdfBuffers = [];
      const pdfDoc = new PDFDocument({ 
        margin: 40,
        size: 'A4',
        info: {
          Title: `Vivahanam Invoice - ${invoiceData.transactionId}`,
          Author: 'Vivahanam',
          Subject: 'Payment Invoice',
          CreationDate: new Date()
        }
      });

      pdfDoc.on('data', (chunk) => pdfBuffers.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(pdfBuffers)));
      pdfDoc.on('error', reject);

      // ─────────────────────────────────────────────
      // PDF Design - Professional Invoice
      // ─────────────────────────────────────────────
      
      // Header with logo
      pdfDoc
        .fillColor('#16a34a')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text('VIVAHANAM', 50, 50);
      
      pdfDoc
        .fillColor('#666666')
        .fontSize(10)
        .font('Helvetica')
        .text('Matchmaking Platform', 50, 80)
        .text('Official Payment Receipt', 50, 95);
      
      // Invoice title
      pdfDoc
        .fillColor('#000000')
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('INVOICE', 400, 50, { align: 'right' });
      
      pdfDoc
        .fillColor('#666666')
        .fontSize(10)
        .text(`#${invoiceData.invoiceNumber}`, 400, 75, { align: 'right' })
        .text(`Date: ${invoiceData.invoiceDate}`, 400, 90, { align: 'right' });

      // Separator line
      pdfDoc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(50, 120)
        .lineTo(550, 120)
        .stroke();

      // Billing Information
      const billingY = 140;
      pdfDoc
        .fillColor('#374151')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('BILLED TO:', 50, billingY);
      
      pdfDoc
        .fillColor('#111827')
        .fontSize(11)
        .font('Helvetica')
        .text(invoiceData.user.name, 50, billingY + 20)
        .text(invoiceData.user.email, 50, billingY + 35)
        .text(`VIV ID: ${invoiceData.user.vivId}`, 50, billingY + 50);

      // Payment Information
      pdfDoc
        .fillColor('#374151')
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('PAYMENT DETAILS:', 300, billingY);
      
      pdfDoc
        .fillColor('#111827')
        .fontSize(11)
        .font('Helvetica')
        .text(`Transaction ID: ${invoiceData.transactionId}`, 300, billingY + 20)
        .text(`Payment Method: ${invoiceData.paymentMethod}`, 300, billingY + 35)
        .text(`Payment ID: ${invoiceData.paymentId}`, 300, billingY + 50)
        .text(`Status: ${invoiceData.status}`, 300, billingY + 65);

      // Table Header
      const tableTop = 230;
      pdfDoc
        .fillColor('#ffffff')
        .rect(50, tableTop, 500, 25)
        .fill();
      
      pdfDoc
        .fillColor('#374151')
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('DESCRIPTION', 60, tableTop + 8)
        .text('QUANTITY', 300, tableTop + 8)
        .text('UNIT PRICE', 380, tableTop + 8)
        .text('AMOUNT', 480, tableTop + 8, { align: 'right' });

      // Table Row
      pdfDoc
        .fillColor('#f9fafb')
        .rect(50, tableTop + 25, 500, 40)
        .fill();
      
      pdfDoc
        .fillColor('#111827')
        .fontSize(11)
        .font('Helvetica')
        .text(invoiceData.plan.displayName, 60, tableTop + 40)
        .text(`${invoiceData.plan.profiles} profiles`, 300, tableTop + 40)
        .text(`${invoiceData.currency} ${invoiceData.unitPrice}`, 380, tableTop + 40)
        .text(`${invoiceData.currency} ${invoiceData.amount}`, 480, tableTop + 40, { align: 'right' });

      // Total
      const totalY = tableTop + 85;
      pdfDoc
        .fillColor('#ffffff')
        .rect(300, totalY, 250, 60)
        .fill();
      
      pdfDoc
        .fillColor('#374151')
        .fontSize(12)
        .font('Helvetica')
        .text('Subtotal:', 310, totalY + 10)
        .text('Tax:', 310, totalY + 30)
        .text('Total:', 310, totalY + 50);
      
      pdfDoc
        .font('Helvetica-Bold')
        .text(`${invoiceData.currency} ${invoiceData.amount}`, 480, totalY + 10, { align: 'right' })
        .text(`${invoiceData.currency} 0.00`, 480, totalY + 30, { align: 'right' })
        .fillColor('#16a34a')
        .text(`${invoiceData.currency} ${invoiceData.amount}`, 480, totalY + 50, { align: 'right' });

      // Footer Notes
      const notesY = totalY + 100;
      pdfDoc
        .fillColor('#6b7280')
        .fontSize(9)
        .font('Helvetica')
        .text('Notes:', 50, notesY)
        .text(`• This is a system-generated receipt for matchmaking plan purchase.`, 50, notesY + 15)
        .text(`• Invoice #${invoiceData.invoiceNumber} • ${invoiceData.invoiceDate}`, 50, notesY + 30)
        .text(`• For any queries, contact support@vivahanam.com`, 50, notesY + 45);

      // Thank you message with download link hint
      pdfDoc
        .fillColor('#16a34a')
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Thank you for your purchase!', 50, notesY + 70);
      
      pdfDoc
        .fillColor('#6b7280')
        .fontSize(10)
        .font('Helvetica')
        .text('Your invoice has been sent to your email. You can also download it anytime from your account.', 50, notesY + 95);

      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Generate email HTML template WITH DOWNLOAD BUTTON
 */
export const generateInvoiceEmailHTML = (invoiceData) => {
  const formattedDate = new Date(invoiceData.invoiceDate).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generate direct download link for the PDF
  // Agar aapke paas frontend pe API endpoint hai to use karein
  const downloadUrl = `${invoiceData.frontendUrl}/invoice/download/${invoiceData.invoiceNumber}`;
  // Ya phir static message de sakte hain
  const downloadMessage = "Your invoice PDF is attached to this email. You can download it by clicking the attachment above.";

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; margin: 0; padding: 0; }
      .wrapper { padding: 30px 0; }
      .container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
      .header { background: linear-gradient(90deg, #16a34a, #059669); padding: 28px 32px; color: #ffffff; text-align: center; }
      .header h1 { margin: 0; font-size: 28px; font-weight: 600; letter-spacing: 0.04em; }
      .header p { margin: 8px 0 0; font-size: 14px; opacity: 0.9; }
      .content { padding: 32px; }
      .greeting { font-size: 20px; margin: 0 0 8px; color: #1f2937; }
      .subtitle { margin: 0 0 24px; font-size: 14px; color: #6b7280; }
      .invoice-box { background: #f0fdf4; border-radius: 10px; padding: 24px; margin: 0 0 28px; border: 1px solid #bbf7d0; }
      .invoice-title { font-size: 18px; font-weight: 700; color: #166534; margin: 0 0 12px; }
      .invoice-details { display: flex; flex-wrap: wrap; gap: 16px; margin: 16px 0; }
      .detail-item { flex: 1 0 200px; }
      .detail-label { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
      .detail-value { font-size: 14px; color: #1f2937; font-weight: 500; }
      .table { width: 100%; border-collapse: collapse; margin: 20px 0; }
      .table th { text-align: left; font-size: 12px; padding: 12px 0; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
      .table td { font-size: 14px; padding: 12px 0; color: #374151; border-bottom: 1px solid #f3f4f6; }
      .table td:last-child { text-align: right; font-weight: 500; }
      .total-row { background: #f9fafb; }
      .total-row td { font-weight: 600; color: #111827; }
      .muted { font-size: 12px; color: #6b7280; margin-top: 24px; line-height: 1.5; }
      .footer { background: #fffbeb; padding: 20px 32px; text-align: center; }
      .footer-text { font-size: 12px; color: #78350f; margin: 0; }
      .btn { display: inline-block; margin: 8px; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none; transition: all 0.3s ease; }
      .btn-primary { background: #16a34a; color: #ffffff; }
      .btn-secondary { background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; }
      .btn:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .attachment-note { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 20px 0; }
      .attachment-note h4 { color: #0369a1; margin: 0 0 8px 0; }
      .attachment-note p { margin: 4px 0; color: #0c4a6e; }
      .icon { display: inline-block; width: 16px; height: 16px; margin-right: 8px; vertical-align: middle; }
      .pdf-icon { background: #dc2626; color: white; border-radius: 3px; font-weight: bold; text-align: center; line-height: 16px; font-size: 10px; }
      .btn-group { display: flex; flex-wrap: wrap; gap: 12px; margin: 24px 0; }
      @media (max-width: 600px) {
        .btn-group { flex-direction: column; }
        .btn { width: 100%; text-align: center; margin: 4px 0; }
        .invoice-details { flex-direction: column; }
        .detail-item { flex: 1 0 100%; }







        .invoice-details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
  margin: 16px 0;
}

.detail-group {
  background: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid #e5e7eb;
}

.detail-label {
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-value {
  font-size: 14px;
  color: #1f2937;
  font-weight: 600;
  word-break: break-word;
}

.detail-value.invoice-number {
  color: #16a34a;
}

/* For mobile responsiveness */
@media (max-width: 600px) {
  .invoice-details-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
      }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="container">
        <div class="header">
          <h1>Vivahanam</h1>
          <p>Payment Receipt & Invoice</p>
        </div>
        <div class="content">
          <h2 class="greeting">Hello ${invoiceData.user.name || 'Valued Member'},</h2>
          <p class="subtitle">
            Your payment has been successfully processed. Here's your invoice for the plan purchase.
          </p>

         



  <div class="invoice-details-grid">
  <!-- First row - Invoice Number and Date -->
  <div class="detail-group">
    <div class="detail-label">Invoice Number</div>
    <div class="detail-value invoice-number">${invoiceData.invoiceNumber}</div>
  </div>
  
  <div class="detail-group">
    <div class="detail-label">Date</div>
    <div class="detail-value">${formattedDate}</div>
  </div>
  
  <!-- Second row - Transaction ID and Payment Method -->
  <div class="detail-group">
    <div class="detail-label">Transaction ID</div>
    <div class="detail-value">${invoiceData.transactionId}</div>
  </div>
  
  <div class="detail-group">
    <div class="detail-label">Payment Method</div>
    <div class="detail-value">${invoiceData.paymentMethod}</div>
  </div>
</div>

          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>${invoiceData.plan.displayName}</td>
                <td>${invoiceData.plan.profiles} profiles</td>
                <td>${invoiceData.currency} ${invoiceData.unitPrice}</td>
                <td>${invoiceData.currency} ${invoiceData.amount}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">Total Amount:</td>
                <td><strong>${invoiceData.currency} ${invoiceData.amount}</strong></td>
              </tr>
            </tbody>
          </table>

          <div class="btn-group">
            <a class="btn btn-primary" href="${invoiceData.frontendUrl}/dashboard">
              Go to Dashboard
            </a>
            <a class="btn btn-secondary" href="#" onclick="alert('Please check the attached PDF file in this email. You can save it to your device.')">
              Download Invoice PDF
            </a>
          </div>

          <p class="muted">
            <strong>How to download the invoice:</strong><br>
            1. Look for the attachment icon in your email client<br>
            2. Click on "Vivahanam_Invoice_${invoiceData.invoiceNumber}.pdf"<br>
            3. Choose "Save" or "Download" to save it to your device<br><br>
            
            This is an official system-generated invoice for your matchmaking plan purchase.<br>
            It is not a tax invoice unless GST details are mentioned.<br>
            Please keep this receipt for your records.
          </p>

       
        </div>
        <div class="footer">
          <p class="footer-text">
            © ${new Date().getFullYear()} Vivahanam • All rights reserved<br>
            Need help? Contact support@vivahanam.com
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`;
};

/**
 * Send payment success email with invoice PDF - ASYNC VERSION
 * Yeh non-blocking hai - payment flow ko block nahi karega
 */
export const sendPaymentSuccessEmail = async ({
  user,
  transaction,
  planConfig,
  paypalCapture,
  frontendUrl
}) => {
  return new Promise(async (resolve) => {
    try {
      // Generate invoice data
      const invoiceData = {
        user: {
          name: user.name,
          email: user.email,
          vivId: user.vivId
        },
        transactionId: transaction._id.toString(),
        invoiceNumber: `INV-${transaction._id.toString().slice(-8).toUpperCase()}`,
        invoiceDate: new Date().toISOString().split('T')[0],
        plan: {
          displayName: planConfig.displayName,
          profiles: transaction.purchasedProfiles,
          validityDays: planConfig.validityDays
        },
        amount: transaction.amount,
        unitPrice: planConfig.price,
        currency: transaction.currency || 'USD',
        paymentMethod: 'PayPal',
        paymentId: paypalCapture?.id ? `PAYPAL_${paypalCapture.id}` : `TX_${transaction._id}`,
        status: 'PAID',
        frontendUrl: frontendUrl || process.env.FRONTEND_URI || 'http://localhost:5173'
      };

      // Generate PDF
      const pdfBuffer = await generateInvoicePDF(invoiceData);

      // Generate HTML email with download instructions
      const htmlContent = generateInvoiceEmailHTML(invoiceData);

      // Send email with PDF attachment (async)
      sendEmail({
        to: user.email,
        subject: `Payment Successful - ${planConfig.displayName} Plan | Vivahanam`,
        html: htmlContent,
        attachments: [
          {
            filename: `Vivahanam_Invoice_${invoiceData.invoiceNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
          }
        ]
      }).then(() => {
        console.log(`✅ Payment success email sent to ${user.email} with invoice ${invoiceData.invoiceNumber}`);
        resolve({
          success: true,
          invoiceNumber: invoiceData.invoiceNumber,
          emailSent: true,
          pdfGenerated: true
        });
      }).catch(emailError => {
        console.error(`❌ Failed to send email to ${user.email}:`, emailError.message);
        // Still resolve with partial success since PDF was generated
        resolve({
          success: false,
          error: emailError.message,
          emailSent: false,
          pdfGenerated: true,
          invoiceNumber: invoiceData.invoiceNumber
        });
      });

    } catch (error) {
      console.error('❌ Failed to generate or send payment success email:', error);
      
      // Return error but don't reject - payment should still be successful
      resolve({
        success: false,
        error: error.message,
        emailSent: false,
        pdfGenerated: false
      });
    }
  });
};

/**
 * Bonus: Generate and return PDF directly for download
 */
export const generateInvoicePDFForDownload = async (invoiceData) => {
  try {
    return await generateInvoicePDF(invoiceData);
  } catch (error) {
    console.error('❌ Failed to generate PDF for download:', error);
    throw error;
  }
};