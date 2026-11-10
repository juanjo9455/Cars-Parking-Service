// Marco de la app (rediseño): íconos Lucide y la hoja "Más" de la barra inferior (_NavInferior.cshtml).
// Va justo después del contenido de la página, antes de los demás scripts, para cambiar los íconos antes de pintar.
(function () {
    // ---------- Íconos ----------
    // Las vistas y el JS de antes escriben íconos de Font Awesome (<i class="fa-solid fa-car-side">). Aquí se cambian
    // por su equivalente de Lucide (sprite /img/iconos.svg), también los que el JS agrega o cambia después.
    // El <i> se queda (con sus clases, id y eventos): solo se le pone el dibujo adentro. Las marcas (WhatsApp) y lo
    // que no está en el mapa siguen en Font Awesome
    const SPRITE = '/img/iconos.svg?v=1';
    const MAPA = {
        'car-side': 'car', 'car': 'car', 'car-rear': 'car', 'arrow-right': 'arrow-right', 'arrow-left': 'arrow-left',
        'arrow-up': 'arrow-up', 'arrow-down': 'arrow-down', 'check': 'check', 'check-circle': 'circle-check',
        'circle-check': 'circle-check', 'square-parking': 'square-parking', 'x': 'x', 'xmark': 'x', 'camera': 'camera',
        'user': 'user', 'users': 'users', 'user-plus': 'user-plus', 'user-slash': 'user-x', 'user-shield': 'shield-check',
        'user-gear': 'user-cog', 'user-tie': 'user-round', 'user-dollar': 'badge-dollar-sign', 'user-check': 'user-check',
        'user-clock': 'user-round', 'triangle-exclamation': 'triangle-alert', 'circle-exclamation': 'circle-alert',
        'circle-info': 'info', 'info': 'info', 'circle-question': 'circle-help', 'spinner': 'loader-circle',
        'location-dot': 'map-pin', 'map-pin': 'map-pin', 'map-location-dot': 'map-pinned', 'key': 'key-round',
        'right-from-bracket': 'log-out', 'right-to-bracket': 'log-in', 'chevron-down': 'chevron-down',
        'chevron-right': 'chevron-right', 'chevron-left': 'chevron-left', 'chevron-up': 'chevron-up',
        'table-list': 'list', 'list': 'list', 'list-check': 'list-checks', 'sack-dollar': 'wallet', 'qrcode': 'qr-code',
        'house': 'house', 'filter': 'list-filter', 'filter-circle-xmark': 'filter-x', 'rotate-left': 'rotate-ccw',
        'rotate-right': 'rotate-cw', 'arrows-rotate': 'refresh-cw', 'rotate': 'refresh-cw', 'pen': 'pencil',
        'pen-to-square': 'square-pen', 'magnifying-glass': 'search', 'magnifying-glass-plus': 'zoom-in',
        'shield-check': 'shield-check', 'shield-halved': 'shield-half', 'receipt': 'receipt', 'crown': 'crown',
        'clock-rotate-left': 'history', 'clock': 'clock', 'trash': 'trash-2', 'trash-can': 'trash-2',
        'signature': 'signature', 'file-signature': 'file-signature', 'scale-unbalanced': 'scale',
        'right-left': 'arrow-left-right', 'phone': 'phone', 'gem': 'gem', 'chart-line': 'chart-line',
        'bell-concierge': 'concierge-bell', 'bell': 'bell', 'bars': 'menu', 'ban': 'ban', 'image': 'image',
        'images': 'images', 'warehouse': 'warehouse', 'garage': 'warehouse', 'video': 'video', 'truck-fast': 'truck',
        'play': 'play', 'paper-plane': 'send', 'money-bill': 'banknote', 'money-bill-1': 'banknote',
        'money-bill-wave': 'banknote', 'money-check-dollar': 'banknote', 'mobile-screen': 'smartphone', 'lock': 'lock',
        'lightbulb': 'lightbulb', 'hand-pointer': 'pointer', 'hand-holding-dollar': 'hand-coins', 'hand': 'hand',
        'gear': 'settings', 'file-pdf': 'file-text', 'file-invoice-dollar': 'file-text',
        'file-excel': 'file-spreadsheet', 'eye': 'eye', 'eye-slash': 'eye-off', 'expand': 'scan-line',
        'eraser': 'eraser', 'credit-card': 'credit-card', 'circle': 'circle', 'circle-dot': 'circle-dot',
        'cash-register': 'calculator', 'calendar-event': 'calendar', 'calendar-days': 'calendar-days',
        'calendar': 'calendar', 'building-columns': 'landmark', 'building': 'building-2', 'minus': 'minus',
        'plus': 'plus', 'hourglass-half': 'hourglass', 'stopwatch': 'timer', 'download': 'download',
        'upload': 'upload', 'copy': 'copy', 'envelope': 'mail', 'id-card': 'id-card', 'star': 'star', 'bolt': 'zap',
        'comment': 'message-circle', 'comments': 'messages-square', 'print': 'printer', 'floppy-disk': 'save',
        'ellipsis': 'ellipsis', 'ellipsis-vertical': 'ellipsis-vertical', 'square-check': 'square-check',
        'route': 'route', 'road': 'route', 'person-walking': 'footprints', 'door-open': 'door-open', 'hashtag': 'hash'
    };
    const MODOS = new Set(['fa-solid', 'fa-regular', 'fa-brands', 'fa-fw', 'fa-spin', 'fa-pulse', 'fa-lg', 'fa-xs',
        'fa-sm', 'fa-xl', 'fa-1x', 'fa-2x', 'fa-3x', 'fa-4x', 'fa-5x']);

    function nombreFa(i) {
        for (const c of i.classList) {
            if (c.startsWith('fa-') && !MODOS.has(c)) return c.slice(3);
        }
        return null;
    }

    function cambiar(i) {
        if (i.classList.contains('fa-brands')) return;
        const lucide = MAPA[nombreFa(i)];
        if (!lucide || i.dataset.lc === lucide) return;
        i.dataset.lc = lucide;
        i.classList.add('lc');
        i.innerHTML = `<svg class="ico" aria-hidden="true" focusable="false"><use href="${SPRITE}#i-${lucide}"></use></svg>`;
    }

    const SELECTOR = 'i.fa-solid, i.fa-regular, i.fas, i.far, i.fa';

    function cambiarDentro(raiz) {
        if (raiz.matches?.(SELECTOR)) cambiar(raiz);
        raiz.querySelectorAll?.(SELECTOR).forEach(cambiar);
    }

    cambiarDentro(document);

    new MutationObserver(cambios => {
        for (const c of cambios) {
            if (c.type === 'attributes') {
                if (c.target.tagName === 'I') cambiar(c.target);
            } else {
                c.addedNodes.forEach(n => { if (n.nodeType === 1) cambiarDentro(n); });
            }
        }
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });

    // ---------- Búsqueda de placa siempre a la vista (Ingresos, Vista Key) ----------
    // <input data-espejo="selector">: lo que se escribe pasa al campo Placa del filtro de la página, cuyo "input" lo
    // aplica solo (activarFiltrosAutomaticos). Desde Inicio ("Buscar placa", ?buscar=1) llega con el cursor puesto
    document.querySelectorAll('input[data-espejo]').forEach(buscar => {
        const destino = document.querySelector(buscar.dataset.espejo);
        if (!destino) return;
        buscar.addEventListener('input', () => {
            buscar.value = buscar.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
            destino.value = buscar.value;
            destino.dispatchEvent(new Event('input', { bubbles: true }));
        });
        if (new URLSearchParams(location.search).has('buscar')) buscar.focus();
    });

    // ---------- Hoja "Más" ----------
    const hoja = document.getElementById('cpsHojaMas');
    const boton = document.getElementById('cpsBotonMas');
    if (!hoja || !boton || typeof hoja.showModal !== 'function') return;

    function cerrar() {
        if (!hoja.open || hoja.classList.contains('cerrando')) return;
        const lento = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 200;
        hoja.classList.add('cerrando');
        setTimeout(() => {
            hoja.close();
            hoja.classList.remove('cerrando');
        }, lento);
    }

    boton.addEventListener('click', () => {
        hoja.showModal();
        boton.setAttribute('aria-expanded', 'true');
    });
    hoja.addEventListener('close', () => {
        boton.setAttribute('aria-expanded', 'false');
        boton.focus();
    });
    // Escape: cierre con su animación
    hoja.addEventListener('cancel', e => { e.preventDefault(); cerrar(); });
    // Tocar el fondo (fuera de la hoja) la cierra
    hoja.addEventListener('click', e => {
        if (e.target === hoja) {
            const r = hoja.getBoundingClientRect();
            const fuera = e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right;
            if (fuera) cerrar();
        }
    });
    hoja.querySelector('[data-cerrar]')?.addEventListener('click', cerrar);
})();
