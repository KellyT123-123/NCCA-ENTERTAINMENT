/*
 * NCCA site analytics: custom GA4 events.
 * Loaded on every public page after the page's own scripts.
 *
 *   cta_click         Request / Discuss / Send Message / contact links   cta_text, project, page
 *   project_view      Passport page load, or a Quick Look modal opening   project_slug, source
 *   filter_applied    Slate filter dropdown or preset change              platform, format, genre, status
 *   search_performed  Enter in the search overlay                         query
 *   generate_lead     Successful contact form send (fired in contact.html)
 */
(function () {
  function send(name, params) {
    if (typeof window.gtag === 'function') window.gtag('event', name, params || {});
  }
  window.nccaTrack = send;

  function slugFromHref(href) {
    var m = /projects\/([^\/?#]+)\.html/.exec(href || '');
    return m ? m[1] : '';
  }
  function projectFromQuery(href) {
    try { return new URL(href, location.href).searchParams.get('project') || ''; } catch (e) { return ''; }
  }

  // Passport page view (skips hidden titles that redirect away).
  var passport = /\/projects\/([^\/?#]+)\.html$/.exec(location.pathname);
  if (passport && !document.querySelector('meta[http-equiv="refresh"]')) {
    send('project_view', { project_slug: passport[1], source: 'passport' });
  }

  // Quick Look modal opens (home and Slate both expose a global openModal).
  if (typeof window.openModal === 'function') {
    var original = window.openModal;
    window.openModal = function (arg) {
      var slug = '';
      if (typeof arg === 'string') {
        slug = arg;
      } else if (arg && arg.closest) {
        var card = arg.closest('[data-title]');
        var link = card && card.querySelector('a[href*="projects/"]');
        slug = slugFromHref(link && link.getAttribute('href')) || (card && card.getAttribute('data-title')) || '';
      }
      send('project_view', { project_slug: slug || '(unknown)', source: 'modal' });
      return original.apply(this, arguments);
    };
  }

  // Calls to action.
  var CTA_TEXT = /^(request|discuss|send message|start a conversation|get in touch|contact us)/i;
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('a, button');
    if (!el) return;
    var text = (el.textContent || '').replace(/\s+/g, ' ').trim();
    var href = el.getAttribute('href') || '';
    if (!(/contact\.html/.test(href) || el.id === 'cf-submit' || CTA_TEXT.test(text))) return;
    var card = el.closest('[data-title]');
    var projectSelect = el.id === 'cf-submit' ? document.getElementById('cf-project') : null;
    var project = projectFromQuery(href)
      || (projectSelect && projectSelect.value)
      || (card && card.getAttribute('data-title'))
      || (passport && passport[1])
      || '(none)';
    send('cta_click', { cta_text: text.slice(0, 60), project: project, page: location.pathname });
  }, true);

  // Slate filters and presets.
  var ids = ['filter-platform', 'filter-format', 'filter-genre', 'filter-status'];
  function val(id) { var el = document.getElementById(id); return (el && el.value) || '(any)'; }
  function filterEvent() {
    send('filter_applied', { platform: val('filter-platform'), format: val('filter-format'), genre: val('filter-genre'), status: val('filter-status') });
  }
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('change', filterEvent);
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('.preset-chip')) setTimeout(filterEvent, 0);
  });

  // Search overlay.
  var search = document.getElementById('search-input');
  if (search) {
    search.addEventListener('keydown', function (e) {
      var q = search.value.trim();
      if (e.key === 'Enter' && q) send('search_performed', { query: q.slice(0, 100) });
    }, true);
  }
})();
