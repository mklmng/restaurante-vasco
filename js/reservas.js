/*!
 * reservas.js · Oihan Sukaldea (restaurante ficticio, datos provisionales)
 *
 * Validación e interacción del formulario de solicitud de mesa (contacto.html).
 *
 * IMPORTANTE: este sitio no tiene servidor. Este script NO envía nada: valida los
 * datos en el navegador y muestra un resumen con el aviso de que la solicitud no
 * es una reserva confirmada. Si algún día existe un servicio de recepción, el
 * punto donde conectarlo es showResult().
 *
 * Mejora progresiva:
 *   - El botón de envío permanece desactivado hasta que la validación propia
 *     está lista. Sin JavaScript no se puede comprobar la fecha dinámica ni
 *     preparar el resumen, así que el formulario explica esa limitación.
 *     Los campos no llevan atributo name a propósito: así no viajan datos
 *     personales en la URL.
 *   - Con JavaScript se desactiva la validación nativa (novalidate) para mostrar
 *     mensajes propios, comprensibles y asociados a cada campo.
 *
 * Accesibilidad:
 *   - Errores: texto visible "Error: ...", aria-invalid y aria-describedby.
 *   - Resumen de errores enlazado a cada campo; recibe el foco al enviar.
 *   - Al corregir un campo su error desaparece y el resumen se actualiza.
 *   - Al mostrar el resultado el foco pasa a su contenedor.
 */
(function () {
  'use strict';

  /* Configuración provisional: debe coincidir con los horarios que muestran
     las páginas (martes a sábado, comida y cena; domingo solo comida; lunes cerrado). */
  var CONFIG = {
    maxGuests: 8,
    minDaysAhead: 1,
    maxMonthsAhead: 6,
    maxNotesLength: 500,
    closedWeekday: 1,   // Date.getDay(): 0 domingo, 1 lunes...
    lunchOnlyWeekday: 0,
    dinnerFrom: '20:00',
    times: ['13:30', '14:00', '14:30', '15:00', '20:30', '21:00', '21:30', '22:00']
  };

  /* Validación (funciones puras: no tocan el DOM) ---------------------------- */

  function parseISODate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) { return null; }
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);
    // Rechaza fechas que el constructor "corrige" (p. ej. 31 de febrero).
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      return null;
    }
    return date;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  }

  function addMonths(date, months) {
    var day = date.getDate();
    var result = new Date(date.getFullYear(), date.getMonth() + months, 1);
    var lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(day, lastDay));
    return result;
  }

  function toISODate(date) {
    var month = String(date.getMonth() + 1);
    var day = String(date.getDate());
    return date.getFullYear() + '-' + (month.length < 2 ? '0' : '') + month + '-' + (day.length < 2 ? '0' : '') + day;
  }

  var rules = {
    nombre: function (value) {
      var text = value.trim();
      if (!text) { return 'Escribe tu nombre.'; }
      if (text.length < 2) { return 'El nombre debe tener al menos 2 caracteres.'; }
      return '';
    },

    email: function (value) {
      var text = value.trim();
      if (!text) { return 'Escribe tu correo electrónico.'; }
      var parts = text.split('@');
      if (parts.length !== 2) {
        return 'El correo no parece válido. Debe tener una forma como nombre@ejemplo.com.';
      }
      var local = parts[0];
      var domain = parts[1];
      var labels = domain.split('.');
      if (
        !local ||
        local.charAt(0) === '.' ||
        local.charAt(local.length - 1) === '.' ||
        local.indexOf('..') !== -1 ||
        !/^[^\s@]+$/.test(local) ||
        labels.length < 2 ||
        labels.some(function (label) {
          return !/^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/.test(label);
        })
      ) {
        return 'El correo no parece válido. Debe tener una forma como nombre@ejemplo.com.';
      }
      return '';
    },

    // Opcional: solo se valida si se escribe algo.
    telefono: function (value) {
      var text = value.trim();
      if (!text) { return ''; }
      var digits = text.replace(/\D/g, '');
      if (!/^[+()\d\s.-]+$/.test(text) || digits.length < 9 || digits.length > 15) {
        return 'Escribe un teléfono válido, con entre 9 y 15 cifras. Puedes usar espacios, guiones o el prefijo +. Por ejemplo: 600 000 000.';
      }
      return '';
    },

    fecha: function (value, context) {
      var text = value.trim();
      if (!text) { return 'Elige una fecha.'; }
      var date = parseISODate(text);
      if (!date) { return 'Escribe la fecha con el formato aaaa-mm-dd, por ejemplo 2026-11-14.'; }
      var today = startOfDay(context.today);
      if (date < addDays(today, CONFIG.minDaysAhead)) {
        return 'Elige una fecha a partir de mañana. Necesitamos tiempo para responder.';
      }
      if (date > addMonths(today, CONFIG.maxMonthsAhead)) {
        return 'Solo aceptamos solicitudes con un máximo de 6 meses naturales de antelación.';
      }
      if (date.getDay() === CONFIG.closedWeekday) {
        return 'Los lunes el restaurante está cerrado. Elige otro día.';
      }
      return '';
    },

    hora: function (value, context) {
      if (!value) { return 'Elige una hora.'; }
      if (CONFIG.times.indexOf(value) === -1) { return 'Elige una hora de la lista.'; }
      var date = context.fecha;
      if (date && date.getDay() === CONFIG.lunchOnlyWeekday && value >= CONFIG.dinnerFrom) {
        return 'Los domingos solo abrimos al mediodía. Elige una hora entre las 13:30 y las 15:00.';
      }
      return '';
    },

    comensales: function (value) {
      var text = value.trim();
      if (!text) { return 'Indica cuántas personas sois.'; }
      var number = Number(text);
      if (!/^\d+$/.test(text) || number < 1 || number > CONFIG.maxGuests) {
        return 'El número de comensales debe ser un número entero entre 1 y ' + CONFIG.maxGuests + '.';
      }
      return '';
    },

    observaciones: function (value) {
      if (value.length > CONFIG.maxNotesLength) {
        return 'Las observaciones no pueden superar los ' + CONFIG.maxNotesLength + ' caracteres.';
      }
      return '';
    }
  };

  function validateValue(id, value, context) {
    return rules[id] ? rules[id](value, context) : '';
  }

  /* Exportación para pruebas en Node; en el navegador no existe "module". */
  if (typeof module === 'object' && module && module.exports) {
    module.exports = {
      CONFIG: CONFIG,
      addMonths: addMonths,
      parseISODate: parseISODate,
      validateValue: validateValue
    };
  }

  if (typeof document === 'undefined') { return; }

  /* Interacción con el DOM --------------------------------------------------- */

  var form = document.getElementById('form-reserva');
  if (!form) { return; }

  var FIELD_IDS = ['nombre', 'email', 'telefono', 'fecha', 'hora', 'comensales', 'observaciones'];
  var summary = document.getElementById('resumen-errores');
  var summaryList = summary ? summary.querySelector('.error-summary__list') : null;
  var result = document.getElementById('resultado');
  var resultData = document.getElementById('resultado-datos');
  var resultDataBox = document.getElementById('resultado-datos-caja');
  var editButton = document.getElementById('resultado-modificar');
  var resetButton = document.getElementById('resultado-reiniciar');
  var submitButton = form.querySelector('[type="submit"]');
  var jsRequiredNote = document.getElementById('form-js-required');
  var attempted = false;

  function field(id) { return document.getElementById(id); }

  function labelText(control) {
    var label = form.querySelector('label[for="' + control.id + '"]');
    if (!label) { return control.id; }
    var clone = label.cloneNode(true);
    var flags = clone.querySelectorAll('.field__flag');
    Array.prototype.forEach.call(flags, function (flag) { flag.parentNode.removeChild(flag); });
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function context() {
    return { today: new Date(), fecha: parseISODate(field('fecha').value.trim()) };
  }

  function showError(control, message) {
    var box = document.getElementById(control.id + '-error');
    control.setAttribute('aria-invalid', 'true');
    if (box) {
      box.textContent = 'Error: ' + message;
      box.hidden = false;
    }
  }

  function clearError(control) {
    var box = document.getElementById(control.id + '-error');
    control.removeAttribute('aria-invalid');
    if (box) {
      box.textContent = '';
      box.hidden = true;
    }
  }

  // Valida un campo, muestra o limpia su error y devuelve el mensaje.
  function validateField(control, ctx) {
    var message = validateValue(control.id, control.value, ctx || context());
    if (message) { showError(control, message); } else { clearError(control); }
    return message;
  }

  function collectErrors() {
    var ctx = context();
    var errors = [];
    FIELD_IDS.forEach(function (id) {
      var control = field(id);
      var message = validateField(control, ctx);
      if (message) { errors.push({ control: control, message: message }); }
    });
    return errors;
  }

  // Errores que están ahora mismo visibles (para actualizar el resumen).
  function currentErrors() {
    var errors = [];
    FIELD_IDS.forEach(function (id) {
      var control = field(id);
      var box = document.getElementById(id + '-error');
      if (control.getAttribute('aria-invalid') === 'true' && box) {
        errors.push({ control: control, message: box.textContent.replace(/^Error:\s*/, '') });
      }
    });
    return errors;
  }

  function renderSummary(errors) {
    if (!summary || !summaryList) { return; }
    while (summaryList.firstChild) { summaryList.removeChild(summaryList.firstChild); }
    if (!errors.length) { summary.hidden = true; return; }

    errors.forEach(function (error) {
      var item = document.createElement('li');
      var link = document.createElement('a');
      link.className = 'error-summary__link';
      link.href = '#' + error.control.id;
      link.textContent = labelText(error.control) + ': ' + error.message;
      link.addEventListener('click', function (event) {
        event.preventDefault();
        error.control.focus();
      });
      item.appendChild(link);
      summaryList.appendChild(item);
    });
    summary.hidden = false;
  }

  function appendRow(list, term, description) {
    var row = document.createElement('div');
    var dt = document.createElement('dt');
    var dd = document.createElement('dd');
    row.className = 'facts__row';
    dt.className = 'facts__term';
    dd.className = 'facts__desc';
    dt.textContent = term;
    dd.textContent = description; // textContent: los datos del usuario nunca se interpretan como HTML
    row.appendChild(dt);
    row.appendChild(dd);
    list.appendChild(row);
  }

  function formatDate(value) {
    var date = parseISODate(value);
    if (!date) { return value; }
    try {
      return new Intl.DateTimeFormat('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).format(date);
    } catch (error) {
      return value;
    }
  }

  function buildSummary() {
    if (!resultData) { return; }
    while (resultData.firstChild) { resultData.removeChild(resultData.firstChild); }
    var guests = Number(field('comensales').value);
    appendRow(resultData, 'Nombre', field('nombre').value.trim());
    appendRow(resultData, 'Correo electrónico', field('email').value.trim());
    appendRow(resultData, 'Teléfono', field('telefono').value.trim() || 'No indicado');
    appendRow(resultData, 'Fecha', formatDate(field('fecha').value.trim()));
    appendRow(resultData, 'Hora', field('hora').value);
    appendRow(resultData, 'Comensales', guests === 1 ? '1 persona' : guests + ' personas');
    appendRow(resultData, 'Observaciones', field('observaciones').value.trim() || 'Sin observaciones');
    if (resultDataBox) { resultDataBox.hidden = false; }
  }

  function clearHash() {
    if (window.location.hash === '#resultado' && window.history && window.history.replaceState) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  // Punto de conexión con un futuro servicio de recepción: hoy solo muestra el resumen.
  function showResult() {
    buildSummary();
    form.hidden = true;
    if (summary) { summary.hidden = true; }
    if (editButton) { editButton.hidden = false; }
    if (resetButton) { resetButton.hidden = false; }
    if (result) {
      result.setAttribute('data-visible', 'true');
      result.focus();
    }
  }

  function hideResult() {
    if (result) { result.removeAttribute('data-visible'); }
    if (editButton) { editButton.hidden = true; }
    if (resetButton) { resetButton.hidden = true; }
    if (resultDataBox) { resultDataBox.hidden = true; }
    clearHash();
    form.hidden = false;
  }

  function init() {
    if (!submitButton || !jsRequiredNote) {
      throw new Error('Falta el botón de envío o el aviso de JavaScript del formulario.');
    }

    // Fechas permitidas en el selector nativo (la validación propia es la que manda).
    var today = startOfDay(new Date());
    var dateField = field('fecha');
    dateField.setAttribute('min', toISODate(addDays(today, CONFIG.minDaysAhead)));
    dateField.setAttribute('max', toISODate(addMonths(today, CONFIG.maxMonthsAhead)));

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      attempted = true;
      var errors = collectErrors();
      if (errors.length) {
        renderSummary(errors);
        summary.focus();
        return;
      }
      renderSummary([]);
      showResult();
    });

    // Tras el primer intento, cada cambio revalida y mantiene el resumen al día.
    function revalidate(event) {
      if (!attempted) { return; }
      var target = event.target;
      if (FIELD_IDS.indexOf(target.id) === -1) { return; }
      var ctx = context();
      validateField(target, ctx);
      // La hora depende de la fecha (domingo solo comida) y viceversa.
      if (target.id === 'fecha' && field('hora').value) { validateField(field('hora'), ctx); }
      if (target.id === 'hora' && field('fecha').value) { validateField(field('fecha'), ctx); }
      renderSummary(currentErrors());
    }
    form.addEventListener('input', revalidate);
    form.addEventListener('change', revalidate);

    if (editButton) {
      editButton.addEventListener('click', function () {
        hideResult();
        field('nombre').focus();
      });
    }

    if (resetButton) {
      resetButton.addEventListener('click', function () {
        form.reset();
        attempted = false;
        FIELD_IDS.forEach(function (id) { clearError(field(id)); });
        renderSummary([]);
        hideResult();
        field('nombre').focus();
      });
    }

    // Validación propia solo cuando todo lo anterior se ha enlazado sin errores.
    form.noValidate = true;
    jsRequiredNote.hidden = true;
    submitButton.disabled = false;
  }

  try {
    init();
  } catch (error) {
    form.noValidate = false; // vuelve la validación nativa
    if (window.console && window.console.error) { window.console.error(error); }
  }
})();
