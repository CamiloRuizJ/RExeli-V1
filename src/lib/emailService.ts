/**
 * Email Service
 *
 * Handles sending email notifications for:
 * - Low credits warnings
 * - Out of credits notifications
 * - Subscription renewal reminders
 * - Welcome emails
 *
 * TODO: Integrate with email provider (SendGrid, Resend, AWS SES, etc.)
 * For now, this logs to console. Replace with actual email provider in production.
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send email notification
 * @param options Email options (to, subject, html, text)
 * @returns Promise<boolean> Success status
 */
export async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    // TODO: Replace with actual email service integration
    // Example integrations:
    // - Resend: https://resend.com/docs/send-with-nodejs
    // - SendGrid: https://docs.sendgrid.com/for-developers/sending-email/v3-nodejs-code-example
    // - AWS SES: https://docs.aws.amazon.com/ses/latest/dg/send-email-sdk-nodejs.html

    console.log('[EMAIL SERVICE] Sending email:');
    console.log(`  To: ${options.to}`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  Body: ${options.text || options.html.substring(0, 100)}...`);

    // Simulate email sending
    return true;
  } catch (error) {
    console.error('[EMAIL SERVICE] Error sending email:', error);
    return false;
  }
}

/**
 * Send low credits warning email
 * @param userEmail User's email address
 * @param userName User's name
 * @param remainingCredits Number of credits remaining
 * @param subscriptionType User's subscription type
 */
export async function sendLowCreditsEmail(
  userEmail: string,
  userName: string,
  remainingCredits: number,
  subscriptionType: string
): Promise<boolean> {
  const subject = 'Low Credits Warning - RExeli';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin-bottom: 20px; }
        .content { margin-bottom: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #2563EB; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0; color: #92400E;">⚠️ Low Credits Warning</h2>
        </div>

        <div class="content">
          <p>Hi ${userName},</p>

          <p>This is a friendly reminder that you're running low on credits.</p>

          <p><strong>Current Balance: ${remainingCredits} credits</strong></p>

          <p>Your current plan: <strong>${subscriptionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong></p>

          <p>To avoid interruptions in your document processing, we recommend upgrading your plan or purchasing additional credits.</p>

          <a href="https://www.rexeli.com/pricing" class="button">View Pricing Plans</a>
        </div>

        <div class="footer">
          <p>This is an automated notification from RExeli.<br>
          If you have questions, contact us at support@rexeli.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${userName},

This is a friendly reminder that you're running low on credits.

Current Balance: ${remainingCredits} credits
Your current plan: ${subscriptionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

To avoid interruptions in your document processing, we recommend upgrading your plan or purchasing additional credits.

Visit https://www.rexeli.com/pricing to view our plans.

This is an automated notification from RExeli.`;

  return sendEmail({ to: userEmail, subject, html, text });
}

/**
 * Send out of credits notification email
 * @param userEmail User's email address
 * @param userName User's name
 * @param subscriptionType User's subscription type
 */
export async function sendOutOfCreditsEmail(
  userEmail: string,
  userName: string,
  subscriptionType: string
): Promise<boolean> {
  const subject = 'Out of Credits - Action Required - RExeli';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #FEE2E2; border-left: 4px solid #DC2626; padding: 15px; margin-bottom: 20px; }
        .content { margin-bottom: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #DC2626; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0; color: #991B1B;">🚨 Out of Credits</h2>
        </div>

        <div class="content">
          <p>Hi ${userName},</p>

          <p>Your RExeli account has run out of credits. You won't be able to process any more documents until you upgrade your plan or purchase additional credits.</p>

          <p><strong>Current Balance: 0 credits</strong></p>

          <p>Your current plan: <strong>${subscriptionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong></p>

          <p>Don't miss out on processing important documents. Upgrade now to continue using RExeli.</p>

          <a href="https://www.rexeli.com/pricing" class="button">Upgrade Now</a>
        </div>

        <div class="footer">
          <p>This is an automated notification from RExeli.<br>
          If you have questions, contact us at support@rexeli.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${userName},

Your RExeli account has run out of credits. You won't be able to process any more documents until you upgrade your plan or purchase additional credits.

Current Balance: 0 credits
Your current plan: ${subscriptionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

Don't miss out on processing important documents. Upgrade now to continue using RExeli.

Visit https://www.rexeli.com/pricing to upgrade.

This is an automated notification from RExeli.`;

  return sendEmail({ to: userEmail, subject, html, text });
}

/**
 * Send subscription renewal reminder email
 * @param userEmail User's email address
 * @param userName User's name
 * @param subscriptionType User's subscription type
 * @param renewalDate Date when subscription renews
 */
export async function sendRenewalReminderEmail(
  userEmail: string,
  userName: string,
  subscriptionType: string,
  renewalDate: Date
): Promise<boolean> {
  const subject = 'Subscription Renewal Reminder - RExeli';

  const formattedDate = renewalDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #DBEAFE; border-left: 4px solid #2563EB; padding: 15px; margin-bottom: 20px; }
        .content { margin-bottom: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #2563EB; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0; color: #1E40AF;">📅 Subscription Renewal Reminder</h2>
        </div>

        <div class="content">
          <p>Hi ${userName},</p>

          <p>This is a reminder that your RExeli subscription will renew soon.</p>

          <p><strong>Renewal Date: ${formattedDate}</strong></p>

          <p>Your plan: <strong>${subscriptionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</strong></p>

          <p>Your credits will be reset and your subscription will automatically renew. No action is needed on your part.</p>

          <p>If you'd like to change your plan or cancel your subscription, you can manage it in your dashboard.</p>

          <a href="https://www.rexeli.com/dashboard" class="button">View Dashboard</a>
        </div>

        <div class="footer">
          <p>This is an automated notification from RExeli.<br>
          If you have questions, contact us at support@rexeli.com</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${userName},

This is a reminder that your RExeli subscription will renew soon.

Renewal Date: ${formattedDate}
Your plan: ${subscriptionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}

Your credits will be reset and your subscription will automatically renew. No action is needed on your part.

If you'd like to change your plan or cancel your subscription, you can manage it in your dashboard at https://www.rexeli.com/dashboard

This is an automated notification from RExeli.`;

  return sendEmail({ to: userEmail, subject, html, text });
}

/**
 * Send welcome email to new users
 * @param userEmail User's email address
 * @param userName User's name
 * @param freeCredits Number of free trial credits
 */
export async function sendWelcomeEmail(
  userEmail: string,
  userName: string,
  freeCredits: number
): Promise<boolean> {
  const subject = 'Welcome to RExeli! 🎉';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin-bottom: 20px; }
        .content { margin-bottom: 20px; }
        .button { display: inline-block; padding: 12px 24px; background: #10B981; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0; color: #065F46;">🎉 Welcome to RExeli!</h2>
        </div>

        <div class="content">
          <p>Hi ${userName},</p>

          <p>Welcome to RExeli! We're excited to have you on board.</p>

          <p>To help you get started, we've added <strong>${freeCredits} free trial credits</strong> to your account. That's enough to process approximately 5 documents!</p>

          <p><strong>Here's what you can do with RExeli:</strong></p>
          <ul>
            <li>Extract data from rent rolls, budgets, and financial statements</li>
            <li>Process broker comparables and listings</li>
            <li>Convert documents to structured Excel spreadsheets</li>
            <li>Save hours of manual data entry</li>
          </ul>

          <p>Ready to process your first document?</p>

          <a href="https://www.rexeli.com/tool" class="button">Process Your First Document</a>
        </div>

        <div class="footer">
          <p>Need help? Check out our guides or contact us at support@rexeli.com<br>
          We're here to help!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Hi ${userName},

Welcome to RExeli! We're excited to have you on board.

To help you get started, we've added ${freeCredits} free trial credits to your account. That's enough to process approximately 5 documents!

Here's what you can do with RExeli:
- Extract data from rent rolls, budgets, and financial statements
- Process broker comparables and listings
- Convert documents to structured Excel spreadsheets
- Save hours of manual data entry

Ready to process your first document? Visit https://www.rexeli.com/tool

Need help? Check out our guides or contact us at support@rexeli.com

This is an automated notification from RExeli.`;

  return sendEmail({ to: userEmail, subject, html, text });
}
