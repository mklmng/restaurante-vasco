/*!
 * main.js · Oihan Sukaldea (restaurante ficticio, datos provisionales)
 *
 * Comportamiento global, sin dependencias. Se carga con "defer" en todas las páginas.
 *
 * Mejora progresiva:
 *   - Sin JavaScript el menú es una lista de enlaces siempre visible (el HTML
 *     parte con class="no-js" y un script en <head> la cambia a "js").
 *   - Si este archivo no se carga o falla, se devuelve la clase "no-js" para que
 *     el menú vuelva a mostrarse entero. Nunca debe quedar un menú cerrado sin
 *     forma de abrirlo.
 *
 * Contrato con el HTML y el CSS:
 *   .site-nav__toggle[aria-expanded][aria-controls]  botón "Menú"
 *   #menu-principal (.site-nav__list)                lista que el botón controla
 *   El CSS decide cuándo el botón es visible y cuándo la lista se pliega
 *   (solo en pantalla estrecha); aquí no se repite ese punto de corte.
 */
(function () {
  'use strict';

  var root = document.documentElement;

  /* Menú móvil ------------------------------------------------------------ */
  function initMobileMenu() {
    var toggle = document.querySelector('.site-nav__toggle');
    var header = document.querySelector('.site-header');
    if (!toggle || !header) { return; }

    var list = document.getElementById(toggle.getAttribute('aria-controls'));
    if (!list) { return; }

    function isOpen() {
      return toggle.getAttribute('aria-expanded') === 'true';
    }

    function setOpen(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    // El botón está oculto (display: none) cuando el menú es la barra horizontal.
    function toggleIsVisible() {
      return window.getComputedStyle(toggle).display !== 'none';
    }

    setOpen(false);

    toggle.addEventListener('click', function () {
      setOpen(!isOpen());
    });

    // Escape cierra el menú y, si el foco estaba dentro, lo devuelve al botón.
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' && event.key !== 'Esc') { return; }
      if (!isOpen() || !toggleIsVisible()) { return; }
      var focusWasInside = header.contains(document.activeElement);
      setOpen(false);
      if (focusWasInside) { toggle.focus(); }
    });

    // Un clic fuera de la cabecera cierra el menú sin mover el foco.
    document.addEventListener('click', function (event) {
      if (isOpen() && !header.contains(event.target)) { setOpen(false); }
    });

    // Si el foco sale de la cabecera (p. ej. al tabular más allá del último
    // enlace), el panel no debe quedarse tapando el contenido que recibe el foco.
    document.addEventListener('focusin', function (event) {
      if (isOpen() && !header.contains(event.target)) { setOpen(false); }
    });

    // Tras elegir un enlace del menú se cierra (útil con enlaces a anclas).
    list.addEventListener('click', function (event) {
      var target = event.target;
      if (target && target.closest && target.closest('a')) { setOpen(false); }
    });

    // Al pasar a escritorio no debe quedar un estado "abierto" oculto.
    var resizeQueued = false;
    window.addEventListener('resize', function () {
      if (resizeQueued) { return; }
      resizeQueued = true;
      window.requestAnimationFrame(function () {
        resizeQueued = false;
        if (isOpen() && !toggleIsVisible()) { setOpen(false); }
      });
    });
  }

  /* Enlace "Saltar al contenido" ------------------------------------------- */
  // Algunos navegadores mueven el scroll pero no el foco al destino de un ancla.
  function initSkipLink() {
    var skip = document.querySelector('.skip-link');
    if (!skip) { return; }

    skip.addEventListener('click', function () {
      var id = skip.getAttribute('href').slice(1);
      var target = document.getElementById(id);
      if (target) { target.focus({ preventScroll: true }); }
    });
  }

  /* Página actual ---------------------------------------------------------- */
  // Respaldo: cada página ya marca su enlace con aria-current="page" en el HTML.
  // Si alguna página lo omitiera, se deduce de la ruta (nunca se sobrescribe).
  function markCurrentPage() {
    var links = document.querySelectorAll('.site-nav__link, .site-footer__link');
    if (!links.length) { return; }
    if (document.querySelector('.site-nav__link[aria-current]')) { return; }

    var current = window.location.pathname.split('/').pop() || 'index.html';

    Array.prototype.forEach.call(links, function (link) {
      var file = (link.getAttribute('href') || '').split('#')[0].split('?')[0];
      if (file === current) { link.setAttribute('aria-current', 'page'); }
    });
  }

  /* Arranque --------------------------------------------------------------- */
  function init() {
    try {
      initMobileMenu();
      initSkipLink();
      markCurrentPage();
    } catch (error) {
      root.classList.remove('js');
      root.classList.add('no-js');
      if (window.console && window.console.error) { window.console.error(error); }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
