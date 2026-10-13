// Firma del cliente: se dibuja en una ventana a pantalla completa y se guarda como imagen al aceptar.
// Así el teclado, el scroll o girar el celular ya no la pueden borrar del formulario.
(function () {
    const modal = document.getElementById('firmaModal');
    const canvas = document.getElementById('firmaModalCanvas');
    const inputFirma = document.getElementById('firmaBase64');

    if (!modal || !canvas || !inputFirma) return;

    const btnAbrir = document.getElementById('btnAbrirFirma');
    const btnCerrar = document.getElementById('btnCerrarFirma');
    const btnLimpiar = document.getElementById('btnLimpiarFirmaModal');
    const btnAceptar = document.getElementById('btnAceptarFirma');
    const btnRehacer = document.getElementById('btnRehacerFirma');
    const vistaPrevia = document.getElementById('firmaVistaPrevia');
    const imgPrevia = document.getElementById('firmaPreviaImg');
    const avisoCorta = document.getElementById('firmaAvisoCorta');
    const errorFirma = document.getElementById('errorFirma');

    const ctx = canvas.getContext('2d');

    // Largo mínimo del trazo (px) para no aceptar un punto o una raya suelta
    const LARGO_MINIMO = 150;

    let dibujando = false;
    let ultimo = null;
    let largoTrazo = 0;

    // ========== TAMAÑO DEL CUADRO ==========

    function estiloTrazo() {
        ctx.strokeStyle = '#1f2937';
        ctx.fillStyle = '#1f2937';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    // Ajusta el cuadro a su tamaño real; si ya hay trazo (se giró el celular) lo vuelve a dibujar
    function ajustarCanvas() {
        const rect = canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        const anchoAnterior = canvas.width / (window.devicePixelRatio || 1);
        const altoAnterior = canvas.height / (window.devicePixelRatio || 1);
        const copia = largoTrazo > 0 ? canvas.toDataURL('image/png') : null;

        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.round(rect.width * ratio);
        canvas.height = Math.round(rect.height * ratio);
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        estiloTrazo();

        if (copia) {
            // Se conserva la proporción para que la firma no se deforme
            const escala = Math.min(rect.width / anchoAnterior, rect.height / altoAnterior);
            const img = new Image();
            img.onload = () => ctx.drawImage(img, 0, 0, anchoAnterior * escala, altoAnterior * escala);
            img.src = copia;
        }
    }

    // ========== DIBUJO (mouse, dedo o lápiz) ==========

    function posicion(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        canvas.setPointerCapture(e.pointerId);
        dibujando = true;
        ultimo = posicion(e);

        // Un toque deja un punto visible
        ctx.beginPath();
        ctx.arc(ultimo.x, ultimo.y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fill();

        if (avisoCorta) avisoCorta.style.display = 'none';
    });

    canvas.addEventListener('pointermove', function (e) {
        if (!dibujando) return;
        e.preventDefault();

        const actual = posicion(e);
        ctx.beginPath();
        ctx.moveTo(ultimo.x, ultimo.y);
        ctx.lineTo(actual.x, actual.y);
        ctx.stroke();

        largoTrazo += Math.hypot(actual.x - ultimo.x, actual.y - ultimo.y);
        ultimo = actual;
    });

    function terminarTrazo() {
        dibujando = false;
        ultimo = null;
    }

    canvas.addEventListener('pointerup', terminarTrazo);
    canvas.addEventListener('pointercancel', terminarTrazo);

    // ========== VENTANA ==========

    function limpiar() {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
        largoTrazo = 0;
        if (avisoCorta) avisoCorta.style.display = 'none';
    }

    function abrir() {
        modal.classList.add('abierto');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('firma-modal-abierto');

        // Se mide cuando la ventana ya está visible
        requestAnimationFrame(() => {
            largoTrazo = 0;
            ajustarCanvas();
            limpiar();
        });
    }

    function cerrar() {
        modal.classList.remove('abierto');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('firma-modal-abierto');
        terminarTrazo();
    }

    // Deja la imagen de la firma en el formulario y muestra la miniatura
    function mostrarFirma(imagen) {
        inputFirma.value = imagen;

        if (imgPrevia) imgPrevia.src = imagen;
        if (vistaPrevia) vistaPrevia.style.display = 'flex';
        if (btnAbrir) btnAbrir.style.display = 'none';

        if (errorFirma) {
            errorFirma.style.display = 'none';
            errorFirma.classList.remove('visible');
        }
    }

    // Convierte el trazo en imagen y la deja en el formulario
    function aceptar() {
        if (largoTrazo < LARGO_MINIMO) {
            if (avisoCorta) avisoCorta.style.display = 'block';
            return;
        }

        mostrarFirma(canvas.toDataURL('image/png'));
        cerrar();

        // Avisa al borrador del ingreso (ingreso-borrador.js) que hay firma nueva
        document.dispatchEvent(new CustomEvent('firma:guardada'));
    }

    // Permite recuperar una firma guardada en el borrador (solo imágenes PNG)
    window.establecerFirma = function (imagen) {
        if (typeof imagen === 'string' && imagen.startsWith('data:image/png;base64,')) {
            mostrarFirma(imagen);
        }
    };

    if (btnAbrir) btnAbrir.addEventListener('click', abrir);
    if (btnRehacer) btnRehacer.addEventListener('click', abrir);
    if (btnCerrar) btnCerrar.addEventListener('click', cerrar);
    if (btnLimpiar) btnLimpiar.addEventListener('click', limpiar);
    if (btnAceptar) btnAceptar.addEventListener('click', aceptar);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('abierto')) cerrar();
    });

    // Girar el celular con la ventana abierta: se reajusta sin perder el trazo
    window.addEventListener('resize', function () {
        if (modal.classList.contains('abierto')) ajustarCanvas();
    });

    // La validación del formulario (site.js e ingreso-vehiculos.js) pregunta por aquí
    window.firmaValida = function () {
        return !!inputFirma.value;
    };
})();
