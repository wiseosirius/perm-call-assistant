/**
 * Netlify Function: Check Session
 * 
 * This function:
 * 1. Validates the session ID
 * 2. Checks if session is expired
 * 3. Returns session validity
 */

const { createClient } = require('@supabase/supabase-js');

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
    const { sessionId } = JSON.parse(event.body);

    if (!sessionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Session ID is required' })
      };
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Find the session
    const { data: sessionData, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (fetchError || !sessionData) {
      console.log('Session not found:', sessionId);
      return {
        statusCode: 200,
        body: JSON.stringify({ valid: false, reason: 'Session not found' })
      };
    }

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(sessionData.expires_at);

    if (now > expiresAt) {
      console.log('Session expired:', sessionId);
      
      // Delete expired session
      await supabase
        .from('sessions')
        .delete()
        .eq('session_id', sessionId);

      return {
        statusCode: 200,
        body: JSON.stringify({ valid: false, reason: 'Session expired' })
      };
    }

    // Update last_accessed timestamp
    await supabase
      .from('sessions')
      .update({ last_accessed: new Date().toISOString() })
      .eq('session_id', sessionId);

    console.log('Valid session accessed:', sessionData.email);

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        valid: true,
        email: sessionData.email,
        expiresAt: sessionData.expires_at
      })
    };

  } catch (error) {
    console.error('Error in check-session function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Failed to check session',
        details: error.message 
      })
    };
  }
};
