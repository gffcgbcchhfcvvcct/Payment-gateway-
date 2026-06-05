/**
 * SwiftPay — Page Transition System
 * Makes separate HTML pages feel like a single native app.
 * Include this script in every HTML page.
 */
(function () {
  'use strict';

  /* ─── Config ─── */
  var DURATION = 320; // ms — how long each transition half takes
  var EASE = 'cubic-bezier(0.4,0,0.2,1)';

  /* ─── Inject shared transition styles ─── */
  var style = document.createElement('style');
  style.textContent = [
    '/* SwiftPay page transitions */',
    'html { overflow-x: hidden; }',

    /* Entry: page slides in from the right */
    '@keyframes swpt-enter {',
    '  from { opacity: 0; transform: translateX(40px); }',
    '  to   { opacity: 1; transform: translateX(0); }',
    '}',

    /* Exit: page slides out to the left */
    '@keyframes swpt-exit {',
    '  from { opacity: 1; transform: translateX(0); }',
    '  to   { opacity: 0; transform: translateX(-40px); }',
    '}',

    /* Back entry: page slides in from the left */
    '@keyframes swpt-enter-back {',
    '  from { opacity: 0; transform: translateX(-40px); }',
    '  to   { opacity: 1; transform: translateX(0); }',
    '}',

    /* Back exit: page slides out to the right */
    '@keyframes swpt-exit-back {',
    '  from { opacity: 1; transform: translateX(0); }',
    '  to   { opacity: 0; transform: translateX(40px); }',
    '}',

    'body.swpt-entering {',
    '  animation: swpt-enter ' + DURATION + 'ms ' + EASE + ' both;',
    '}',
    'body.swpt-entering-back {',
    '  animation: swpt-enter-back ' + DURATION + 'ms ' + EASE + ' both;',
    '}',
    'body.swpt-exiting {',
    '  animation: swpt-exit ' + DURATION + 'ms ' + EASE + ' both;',
    '  pointer-events: none;',
    '}',
    'body.swpt-exiting-back {',
    '  animation: swpt-exit-back ' + DURATION + 'ms ' + EASE + ' both;',
    '  pointer-events: none;',
    '}',

    /* Subtle loading bar at top during navigation */
    '#swpt-bar {',
    '  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 99999;',
    '  background: linear-gradient(90deg, #3b5bdb, #748ffc);',
    '  transform-origin: left; transform: scaleX(0);',
    '  transition: transform 0.3s ease, opacity 0.3s ease;',
    '  pointer-events: none;',
    '}',
    '#swpt-bar.swpt-bar-active { transform: scaleX(0.85); }',
    '#swpt-bar.swpt-bar-done  { transform: scaleX(1); opacity: 0; }',
  ].join('\n');
  document.head.appendChild(style);

  /* ─── Loading bar element ─── */
  var bar = document.createElement('div');
  bar.id = 'swpt-bar';
  document.body.appendChild(bar);

  /* ─── Helper: strip all transition classes from body ─── */
  function clearTransitionClasses() {
    document.body.classList.remove(
      'swpt-entering', 'swpt-entering-back',
      'swpt-exiting', 'swpt-exiting-back'
    );
  }

  /* ─── Play entry animation on fresh page load ─── */
  var direction = sessionStorage.getItem('swpt-dir') || 'forward';
  sessionStorage.removeItem('swpt-dir');
  document.body.classList.add(direction === 'back' ? 'swpt-entering-back' : 'swpt-entering');
  setTimeout(function () {
    clearTransitionClasses();
  }, DURATION);

  /* ─── Fix bfcache: pageshow fires when browser restores a cached page ─── */
  /* Without this, the body is frozen invisible (opacity 0) from the exit   */
  /* animation that was playing right before we navigated away.             */
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      // Page was restored from bfcache — strip any leftover exit classes
      // and replay the entering animation so the page is visible again.
      clearTransitionClasses();
      document.body.classList.add('swpt-entering-back');
      setTimeout(function () {
        clearTransitionClasses();
      }, DURATION);
    }
  });

  /* ─── Helper: is this an internal link we should transition? ─── */
  function isInternal(href) {
    if (!href) return false;
    // Skip anchor-only links (#section) — handle scroll instead
    if (href.startsWith('#')) return false;
    // Skip mailto / tel / external
    if (/^(mailto|tel|http|https|javascript)/.test(href)) return false;
    // Skip if it opens in a new tab
    return true;
  }

  /* ─── Navigate with transition ─── */
  function navigate(url, dir) {
    dir = dir || 'forward';
    sessionStorage.setItem('swpt-dir', dir);

    // Show loading bar
    bar.classList.add('swpt-bar-active');

    // Play exit animation
    var exitClass = dir === 'back' ? 'swpt-exiting-back' : 'swpt-exiting';
    document.body.classList.add(exitClass);

    setTimeout(function () {
      bar.classList.remove('swpt-bar-active');
      bar.classList.add('swpt-bar-done');
      window.location.href = url;
    }, DURATION);
  }

  /* ─── Intercept link clicks ─── */
  document.addEventListener('click', function (e) {
    var target = e.target.closest('a[href]');
    if (!target) return;

    var href = target.getAttribute('href');

    // Anchor scroll links — handle smoothly
    if (href && href.startsWith('#')) {
      var id = href.slice(1);
      var el = document.getElementById(id);
      if (el) {
        e.preventDefault();
        var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h') || '68');
        var top = el.getBoundingClientRect().top + window.scrollY - navH - 16;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
      return;
    }

    if (!isInternal(href)) return;
    if (target.target === '_blank') return;

    // Don't intercept if there's an onclick that calls spinThen (avoid double navigation)
    var onclickAttr = target.getAttribute('onclick') || '';
    if (onclickAttr.includes('spinThen')) return;

    e.preventDefault();
    navigate(href, 'forward');
  }, true);

  /* ─── Browser back/forward (hash changes / history API — not bfcache) ─── */
  window.addEventListener('popstate', function () {
    clearTransitionClasses();
    document.body.classList.add('swpt-entering-back');
    setTimeout(function () {
      clearTransitionClasses();
    }, DURATION);
  });

  /* ─── Expose globally so spinThen can use it ─── */
  window.SwiftPayNav = {
    go: navigate,
    back: function (url) { navigate(url, 'back'); }
  };
})();
