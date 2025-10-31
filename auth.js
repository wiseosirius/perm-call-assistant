/**
 * Pacific Companies Recruiter Portal - Authentication Helper
 * 
 * This file handles client-side session validation and redirects.
 * Include this at the top of any protected page.
 */

// Check if user has valid session
async function checkAuth() {
  // Get session cookie
  const sessionCookie = document.cookie
    .split('; ')
    .find(row => row.startsWith('recruiter_session='));
  
  if (!sessionCookie) {
    // No session cookie - redirect to login
    redirectToLogin();
    return false;
  }

  const sessionId = sessionCookie.split('=')[1];

  try {
    // Verify session with backend
    const response = await fetch('/.netlify/functions/check-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });

    const data = await response.json();

    if (!response.ok || !data.valid) {
      // Invalid or expired session - clear cookie and redirect
      clearSession();
      redirectToLogin();
      return false;
    }

    // Session is valid
    return true;

  } catch (error) {
    console.error('Auth check failed:', error);
    clearSession();
    redirectToLogin();
    return false;
  }
}

// Redirect to login page
function redirectToLogin() {
  // Only redirect if not already on login page
  if (!window.location.pathname.includes('login.html')) {
    window.location.href = '/login.html';
  }
}

// Clear session cookie
function clearSession() {
  document.cookie = 'recruiter_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
}

// Logout function
function logout() {
  clearSession();
  redirectToLogin();
}

// Add logout button functionality if present
document.addEventListener('DOMContentLoaded', () => {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
});

// Run auth check on page load (will redirect if not authenticated)
// Show loading state while checking
document.addEventListener('DOMContentLoaded', async () => {
  // Only check auth on non-login pages
  if (!window.location.pathname.includes('login.html')) {
    // Show loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'auth-loading';
    loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
    `;
    loadingOverlay.innerHTML = `
      <div style="text-align: center;">
        <div style="
          border: 4px solid #f3f3f3;
          border-top: 4px solid #667eea;
          border-radius: 50%;
          width: 50px;
          height: 50px;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        "></div>
        <p style="color: #666; font-size: 14px;">Verifying access...</p>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    document.body.appendChild(loadingOverlay);

    // Check authentication
    const isAuthenticated = await checkAuth();

    // Remove loading overlay
    if (isAuthenticated) {
      loadingOverlay.remove();
    }
  }
});

// Export for use in other scripts if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { checkAuth, logout, clearSession };
}
