// Protección del ingreso de vehículos mientras se llena:
// 1. Avisa antes de salir de la página si ya hay datos, firma, video o fotos.
// 2. Guarda un borrador para recuperar el ingreso si se sale o el servidor lo rechaza.
(function () {
    const form = document.getElementById('ingresoForm');
    if (!form) return;

    let hayCambios = false;
    let enviando = false;

    // ========== AVISO AL SALIR ==========

    // Cualquier cosa que escriba o elija el usuario cuenta como cambio
    form.addEventListener('input', () => { hayCambios = true; });
    form.addEventListener('change', () => { hayCambios = true; });

    // La firma, el video y las fotos se guardan en campos ocultos (no disparan "input")
    function tieneDatos() {
        if (hayCambios) return true;
        if (document.getElementById('firmaBase64')?.value) return true;
        if (document.getElementById('videoBase64Input')?.value) return true;
        return form.querySelectorAll('input[name^="fotos["]').length > 0;
    }

    // Atrás (incluido el gesto de Android), recargar o cerrar la pestaña
    window.addEventListener('beforeunload', function (e) {
        if (enviando || !tieneDatos()) return;

        // El navegador muestra su propio mensaje ("¿Salir del sitio?"); el texto no se puede cambiar
        e.preventDefault();
        e.returnValue = '';
    });

    // ========== BORRADOR ==========
    // Solo vive en esta pestaña (sessionStorage) y se borra al cerrarla.
    // El video y las fotos no se guardan: son muy pesados.

    const CLAVE = 'ingresoBorrador';
    const VIGENCIA_MS = 2 * 60 * 60 * 1000; // 2 horas
    const CAMPOS = ['placa', 'nombre_cliente', 'telefono', 'id_valet', 'id_parqueadero', 'notas'];

    function leer() {
        try { return JSON.parse(sessionStorage.getItem(CLAVE)); }
        catch { return null; }
    }

    function escribir(borrador) {
        try { sessionStorage.setItem(CLAVE, JSON.stringify(borrador)); }
        catch (error) { console.warn('[BORRADOR] No se pudo guardar:', error); }
    }

    function borrar() {
        try { sessionStorage.removeItem(CLAVE); }
        catch { /* sin almacenamiento: no hay nada que borrar */ }
    }

    const valorDe = id => document.getElementById(id)?.value ?? '';

    function guardarBorrador() {
        if (enviando) return;

        const borrador = {
            guardado: Date.now(),
            enviado: false,
            ubicacion: valorDe('id_ubicacion'),
            sinObjetos: valorDe('sin_objetos_valor_hidden') === 'true',
            firma: valorDe('firmaBase64')
        };

        CAMPOS.forEach(campo => { borrador[campo] = valorDe(campo); });

        const vacio = !borrador.placa.trim() && !borrador.nombre_cliente.trim() &&
                      !borrador.telefono.trim() && !borrador.notas.trim() && !borrador.firma;

        if (vacio) {
            borrar();
            return;
        }

        escribir(borrador);
    }

    // Se guarda un momento después de dejar de escribir
    let temporizador = null;

    function programarGuardado() {
        clearTimeout(temporizador);
        temporizador = setTimeout(guardarBorrador, 400);
    }

    form.addEventListener('input', programarGuardado);
    form.addEventListener('change', programarGuardado);
    document.addEventListener('firma:guardada', programarGuardado);
    document.getElementById('noValuablesBtn')?.addEventListener('click', programarGuardado);

    // El submit llega a window después de las validaciones de site.js e ingreso-vehiculos.js:
    // si alguna lo canceló (faltan datos), el aviso y el borrador siguen activos
    window.addEventListener('submit', function (e) {
        if (e.target !== form || e.defaultPrevented) return;

        // Se guarda el estado final marcado como enviado: si el servidor lo rechaza, se ofrece recuperarlo
        clearTimeout(temporizador);
        guardarBorrador();

        const borrador = leer();
        if (borrador) {
            borrador.enviado = true;
            escribir(borrador);
        }

        enviando = true;
    });

    // ---------- Recuperar ----------

    function restaurar(borrador) {
        const asignar = (id, valor) => {
            const campo = document.getElementById(id);
            if (!campo || valor == null || valor === '') return;

            // En las listas, solo si la opción todavía existe
            if (campo.tagName === 'SELECT' &&
                !Array.from(campo.options).some(opcion => opcion.value === String(valor))) return;

            campo.value = valor;
        };

        asignar('placa', (borrador.placa || '').toUpperCase());
        asignar('nombre_cliente', borrador.nombre_cliente);
        asignar('telefono', borrador.telefono);
        asignar('id_valet', borrador.id_valet);
        asignar('id_parqueadero', borrador.id_parqueadero);

        // El banco tiene su ubicación de turno: cambiarla mueve el turno y exige su confirmación
        const ubicacion = document.getElementById('id_ubicacion');
        if (ubicacion && !ubicacion.dataset.actual) {
            asignar('id_ubicacion', borrador.ubicacion);
        }

        // "No hay objetos de valor" se activa con su botón, para que quede igual que al tocarlo
        const sinObjetosActivo = valorDe('sin_objetos_valor_hidden') === 'true';
        if (borrador.sinObjetos && !sinObjetosActivo) {
            document.getElementById('noValuablesBtn')?.click();
        } else if (!borrador.sinObjetos) {
            asignar('notas', borrador.notas);
        }

        if (borrador.firma && typeof window.establecerFirma === 'function') {
            window.establecerFirma(borrador.firma);
        }

        // Cuenta como cambio (activa el aviso al salir) y se vuelve a guardar sin la marca de enviado
        hayCambios = true;
        guardarBorrador();
    }

    function mostrarAviso(borrador) {
        const minutos = Math.max(1, Math.round((Date.now() - borrador.guardado) / 60000));

        const aviso = document.createElement('div');
        aviso.className = 'borrador-aviso';
        aviso.innerHTML = `
            <div class="borrador-texto">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <div>
                    <strong>Hay un ingreso sin terminar</strong>
                    <span class="borrador-detalle"></span>
                    <small>El video y las fotos se deben tomar de nuevo.</small>
                </div>
            </div>
            <div class="borrador-acciones">
                <button type="button" class="btn btn-secondary" data-accion="descartar" data-no-spinner="true">Descartar</button>
                <button type="button" class="btn btn-primary" data-accion="recuperar" data-no-spinner="true">Recuperar</button>
            </div>`;

        // Texto del usuario como texto, no como HTML
        aviso.querySelector('.borrador-detalle').textContent =
            `Placa ${borrador.placa || 'sin placa'} · hace ${minutos} min`;

        aviso.querySelector('[data-accion="recuperar"]').addEventListener('click', () => {
            restaurar(borrador);
            aviso.remove();
        });

        aviso.querySelector('[data-accion="descartar"]').addEventListener('click', () => {
            borrar();
            aviso.remove();
        });

        form.parentNode.insertBefore(aviso, form);
    }

    // ---------- Al abrir el formulario ----------

    const borrador = leer();

    if (borrador) {
        const vencido = Date.now() - (borrador.guardado || 0) > VIGENCIA_MS;
        const errorServidor = form.dataset.errorServidor === 'true';

        // Enviado y sin error del servidor: el ingreso se registró bien
        if (vencido || (borrador.enviado && !errorServidor)) {
            borrar();
        } else {
            mostrarAviso(borrador);
        }
    }
})();
