(function () {
  'use strict';

  var blob = document.getElementById('variants');
  if (!blob) return;

  var variants;
  try {
    variants = JSON.parse(blob.textContent);
  } catch (err) {
    console.error('variant blob parse failed', err);
    return;
  }

  function applyVariant(name) {
    var data = variants[name];
    if (!data) return false;
    Object.keys(data).forEach(function (section) {
      var el = document.querySelector('[data-section="' + section + '"]');
      if (el) el.innerHTML = data[section];
    });
    document.documentElement.setAttribute('data-variant', name);
    document.title = (data._title || document.title);
    var pdf = document.getElementById('pdf-link');
    if (pdf) pdf.href = (name === 'default') ? 'resume.pdf' : 'resume-' + name + '.pdf';
    return true;
  }

  // On load: honor ?variant=... if present.
  var params = new URLSearchParams(window.location.search);
  var requested = params.get('variant');
  if (requested && requested !== 'default') {
    applyVariant(requested);
  } else {
    requested = 'default';
  }

  // Reveal the variant/download picker only in debug mode.
  if (params.get('debug') === 'true') {
    var picker = document.querySelector('.variant-picker');
    if (picker) picker.setAttribute('data-visible', 'true');
  }

  // Wire the picker.
  var select = document.getElementById('variant-select');
  if (select) {
    select.value = requested;
    select.addEventListener('change', function () {
      var next = select.value;
      var url = new URL(window.location.href);
      if (next === 'default') {
        url.searchParams.delete('variant');
      } else {
        url.searchParams.set('variant', next);
      }
      window.history.replaceState({}, '', url.toString());
      if (next === 'default') {
        applyVariant('default');
      } else {
        applyVariant(next);
      }
    });
  }
})();
