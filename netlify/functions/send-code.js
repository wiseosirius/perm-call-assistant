/**
 * Netlify Function: Send Verification Code
 * 
 * This function:
 * 1. Validates email against whitelist
 * 2. Generates a 5-digit code
 * 3. Stores code in Supabase (expires in 10 minutes)
 * 4. Sends code via Resend email service
 */

const { createClient } = require('@supabase/supabase-js');
const { Resend } = require('resend');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse request body
    const { email } = JSON.parse(event.body);

    if (!email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email is required' })
      };
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid email format' })
      };
    }

    // Check whitelist
    const approvedEmails = process.env.APPROVED_RECRUITER_EMAILS?.split(',').map(e => e.trim().toLowerCase()) || [];
    
    if (!approvedEmails.includes(normalizedEmail)) {
      console.log('Unauthorized email attempt:', normalizedEmail);
      return {
        statusCode: 403,
        body: JSON.stringify({ 
          error: 'Your email is not authorized to access this portal. Please contact your administrator.' 
        })
      };
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Generate 5-digit code
    const code = Math.floor(10000 + Math.random() * 90000).toString();

    // Set expiration (10 minutes from now)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Store code in Supabase
    const { error: dbError } = await supabase
      .from('verification_codes')
      .insert({
        email: normalizedEmail,
        code: code,
        expires_at: expiresAt.toISOString(),
        used: false
      });

    if (dbError) {
      console.error('Database error:', dbError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to generate verification code' })
      };
    }

    // Send email via Resend
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
        to: normalizedEmail,
        subject: 'Your Pacific Companies Login Code',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verification Code</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f8fafc;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 0;">
                  <table role="presentation" style="width: 600px; border-collapse: collapse; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 24px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                        <div style="width: 64px; height: 64px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                          <svg style="width: 32px; height: 32px; color: white;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                          </svg>
                        </div>
                        <h1 style="margin: 0; color: white; font-size: 28px; font-weight: bold;">
                          Pacific Companies
                        </h1>
                        <p style="margin: 8px 0 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px;">
                          Recruiter Training Portal
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Verification Code -->
                    <tr>
                      <td style="padding: 40px;">
                        <p style="margin: 0 0 24px 0; color: #1f2937; font-size: 16px; line-height: 1.5;">
                          Your verification code is:
                        </p>
                        <div style="background: #f3f4f6; border: 2px dashed #d1d5db; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
                          <div style="font-size: 42px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                            ${code}
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    <!-- Instructions -->
                    <tr>
                      <td style="padding: 0 40px 40px 40px;">
                        <p style="margin: 0 0 16px 0; color: #475569; font-size: 14px; line-height: 1.6;">
                          Enter this code on the login page to access the Pacific Companies Recruiter Training Portal.
                        </p>
                        <p style="margin: 0; color: #94a3b8; font-size: 13px;">
                          This code will expire in <strong>10 minutes</strong>. If you didn't request this code, please ignore this email.
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 24px 40px; background: #f8fafc; border-top: 1px solid #e2e8f0; border-radius: 0 0 12px 12px;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-align: center;">
                          © ${new Date().getFullYear()} Pacific Companies. All rights reserved.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `
      });

      console.log('Email sent successfully to:', normalizedEmail);

      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          message: 'Verification code sent to your email'
        })
      };

    } catch (emailError) {
      console.error('Email sending error:', emailError);
      
      // Code is saved in DB, so return success with warning
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          success: true,
          warning: 'Code saved but email delivery may be delayed. Please check your spam folder or try again in a moment.'
        })
      };
    }

  } catch (error) {
    console.error('Error in send-code function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to process request',
        details: error.message 
      })
    };
  }
};
