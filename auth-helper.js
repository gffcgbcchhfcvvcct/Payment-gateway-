/**
 * auth-helper.js — Reusable Supabase Auth Session Helper
 * --------------------------------------------------------
 * Include this script on any page that needs auth-guarding.
 *
 * Usage — on PROTECTED pages (e.g. dashboard.html):
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
 *   <script src="auth-helper.js"></script>
 *   <script>
 *     AuthHelper.requireAuth();           // redirects to auth.html if not logged in
 *   </script>
 *
 * Usage — on PUBLIC pages (e.g. landing page):
 *   <script src="auth-helper.js"></script>
 *   <script>
 *     AuthHelper.redirectIfAuthed();      // redirects to dashboard.html if already logged in
 *   </script>
 *
 * Logout button:
 *   <button onclick="AuthHelper.logout()">Sign Out</button>
 *
 * Get current user from localStorage (sync, instant):
 *   var user = AuthHelper.getUser();
 */

(function (global) {
  'use strict';

  var SUPABASE_URL = 'https://yfmflzasmxpjtrmolgwc.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_iP6r-OFajYXqy-xjInpfEA_s-RcEDud';
  var USER_KEY     = 'swiftpay_current_user';
  var AUTH_PAGE    = 'auth.html';
  var DASH_PAGE    = 'dashboard.html';

  // Lazy-init Supabase client (requires supabase-js to be loaded first)
  var _client = null;
  function getClient() {
    if (!_client) {
      if (!global.supabase) {
        console.error('[AuthHelper] @supabase/supabase-js must be loaded before auth-helper.js');
        return null;
      }
      _client = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    return _client;
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  function saveUser(user, provider) {
    var profile = {
      id:       user.id,
      name:     (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || '',
      email:    user.email || '',
      avatar:   (user.user_metadata && user.user_metadata.avatar_url) || '',
      provider: provider || 'email'
    };
    localStorage.setItem(USER_KEY, JSON.stringify(profile));
    return profile;
  }

  function clearUser() {
    localStorage.removeItem(USER_KEY);
  }

  function redirect(page) {
    window.location.href = page;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  var AuthHelper = {};

  /**
   * getUser() — Returns the stored user profile from localStorage.
   * Synchronous — safe to call immediately on page load.
   * Returns null if not logged in.
   */
  AuthHelper.getUser = function () {
    try {
      var raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  /**
   * requireAuth() — Call on protected pages.
   * - Checks for a live Supabase session.
   * - If valid: refreshes localStorage user and stays on page.
   * - If invalid: clears localStorage and redirects to auth.html.
   */
  AuthHelper.requireAuth = function () {
    var client = getClient();
    if (!client) { redirect(AUTH_PAGE); return; }

    client.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (!session) {
        clearUser();
        redirect(AUTH_PAGE);
        return;
      }
      var u = session.user;
      var provider = (u.app_metadata && u.app_metadata.provider) || 'email';
      saveUser(u, provider);

      // Keep session fresh — listen for token refresh & sign-out events
      client.auth.onAuthStateChange(function (event, newSession) {
        if (event === 'SIGNED_OUT') {
          clearUser();
          redirect(AUTH_PAGE);
        } else if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') && newSession) {
          var nu = newSession.user;
          var np = (nu.app_metadata && nu.app_metadata.provider) || 'email';
          saveUser(nu, np);
        }
      });
    });
  };

  /**
   * redirectIfAuthed() — Call on public / landing pages.
   * If user already has a valid session, sends them to dashboard.html.
   * Skips redirect when the user navigated back/forward to this page so
   * the browser back button never produces a blank screen.
   */
  AuthHelper.redirectIfAuthed = function () {
    // Detect back/forward navigation — if so, do not auto-redirect.
    // This prevents the blank page when the user presses the back button
    // from dashboard.html back to auth.html on a fresh page load.
    try {
      var navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0 && navEntries[0].type === 'back_forward') {
        return;
      }
    } catch (e) { /* ignore if API unavailable */ }

    var client = getClient();
    if (!client) return;

    client.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (session) {
        var u = session.user;
        var provider = (u.app_metadata && u.app_metadata.provider) || 'email';
        saveUser(u, provider);
        redirect(DASH_PAGE);
      }
    });
  };

  /**
   * logout() — Signs out from Supabase, clears localStorage, redirects to auth.html.
   * Safe to call from any button onclick.
   */
  AuthHelper.logout = function () {
    var client = getClient();

    function finish() {
      clearUser();
      redirect(AUTH_PAGE);
    }

    if (!client) { finish(); return; }

    client.auth.signOut().then(function () {
      finish();
    }).catch(function () {
      // Sign out locally even if network call fails
      finish();
    });
  };

  /**
   * refreshUser() — Re-fetches the current session from Supabase and
   * updates localStorage. Returns a Promise resolving to the user profile or null.
   */
  AuthHelper.refreshUser = function () {
    var client = getClient();
    if (!client) return Promise.resolve(null);

    return client.auth.getSession().then(function (result) {
      var session = result.data && result.data.session;
      if (!session) { clearUser(); return null; }
      var u = session.user;
      var provider = (u.app_metadata && u.app_metadata.provider) || 'email';
      return saveUser(u, provider);
    });
  };

  // Export
  global.AuthHelper = AuthHelper;

})(window);
