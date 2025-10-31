/**
 * Netlify Function: Verify Code
 * 
 * This function:
 * 1. Validates the verification code
 * 2. Checks if code is expired or already used
 * 3. Creates a session in Supabase
 * 4. Returns session ID for cookie
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

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
    const { email, code } = JSON.parse(event.body);

    if (!email || !code) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Email and code are required' })
      };
    }

    // Normalize email
    const normalizedEmail = email.trim().toLowerCase();

    // Validate code format (5 digits)
    if (!/^\d{5}$/.test(code)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Invalid code format' })
      };
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find the verification code
    const { data: verificationData, error: fetchError } = await supabase
      .from('verification_codes')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('code', code)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !verificationData) {
      console.log('Code not found or already used:', normalizedEmail, code);
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Invalid verification code' })
      };
    }

    // Check if code is expired
    const now = new Date();
    const expiresAt = new Date(verificationData.expires_at);

    if (now > expiresAt) {
      console.log('Code expired:', normalizedEmail, code);
      
      // Mark as used to prevent reuse
      await supabase
        .from('verification_codes')
        .update({ used: true })
        .eq('id', verificationData.id);

      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Verification code has expired. Please request a new one.' })
      };
    }

    // Mark code as used
    const { error: updateError } = await supabase
      .from('verification_codes')
      .update({ used: true, used_at: new Date().toISOString() })
      .eq('id', verificationData.id);

    if (updateError) {
      console.error('Error marking code as used:', updateError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to verify code' })
      };
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Set session expiration (24 hours from now)
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setHours(sessionExpiresAt.getHours() + 24);

    // Create session in database
    const { error: sessionError } = await supabase
      .from('sessions')
      .insert({
        session_id: sessionId,
        email: normalizedEmail,
        expires_at: sessionExpiresAt.toISOString()
      });

    if (sessionError) {
      console.error('Error creating session:', sessionError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Failed to create session' })
      };
    }

    console.log('Session created successfully for:', normalizedEmail);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        success: true,
        sessionId: sessionId,
        expiresAt: sessionExpiresAt.toISOString()
      })
    };

  } catch (error) {
    console.error('Error in verify-code function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to process request',
        details: error.message 
      })
    };
  }
};
