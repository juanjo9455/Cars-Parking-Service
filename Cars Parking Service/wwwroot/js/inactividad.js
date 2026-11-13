// Cierre de sesión por inactividad (todos los roles): si en 2 horas nadie toca la pantalla ni escribe, se cierra la
// sesión (InactividadController.Cerrar) y se va al login con el aviso. Se mide aquí porque el servidor no distingue
// a la persona de los refrescos automáticos de las páginas (burbujas, tabla de ingresos, VistaKey).
// - La hora de la última actividad se comparte entre pestañas (localStorage): si trabaja en una, la otra no lo saca.
//   Las páginas de Auth la borran (_LayoutAuth) para que la de una sesión anterior no cuente.
// - El latido (KeepAlive) solo sale cuando hay actividad, máximo uno por minuto. Así, si se cierra la pestaña o se
//   apaga el celular, el limpiador del servidor (LimpiadorSesionesService) cierra el turno.
(() => {
    const LIMITE_MS = 2 * 60 * 60 * 1000;    // 2 horas sin actividad
    const LATIDO_MS = 60 * 1000;         // máximo un latido por minuto
    const REVISION_MS = 30 * 1000;       // cada cuánto se revisa
    const ESCRITURA_MS = 5 * 1000;       // no escribir en localStorage con cada movimiento del dedo
    const CLAVE = 'cps-ultima-actividad';

    // Si el navegador no deja usar localStorage, se lleva en esta pestaña
    let respaldo = Date.now();
    let ultimaEscritura = 0;
    let ultimoLatido = 0;
    let cerrando = false;

    function leer() {
        try {
            const hora = Number(localStorage.getItem(CLAVE));
            return hora > 0 ? hora : respaldo;
        } catch {
            return respaldo;
        }
    }

    function guardar(hora) {
        respaldo = hora;
        ultimaEscritura = hora;
        try { localStorage.setItem(CLAVE, String(hora)); } catch { }
    }

    const vencida = () => Date.now() - leer() >= LIMITE_MS;

    function cerrar() {
        if (cerrando) return;
        cerrando = true;

        // Va al login aunque falle la red: la sesión web vence sola y el limpiador cierra el turno
        fetch('/Inactividad/Cerrar', { method: 'POST', credentials: 'same-origin' })
            .catch(() => { })
            .finally(() => location.replace('/Auth/Login'));
    }

    function latir() {
        ultimoLatido = Date.now();

        fetch('/Home/KeepAlive', { method: 'POST', credentials: 'same-origin' })
            .then(respuesta => {
                // El turno ya está cerrado (p. ej. entró con el mismo usuario en otro celular) o la sesión venció
                if (respuesta.status === 401 || respuesta.redirected) {
                    cerrando = true;
                    location.replace('/Auth/Login');
                }
            })
            .catch(() => { });   // sin conexión: se intenta con la próxima actividad
    }

    function registrarActividad() {
        if (cerrando) return;

        // Volvió después de las 2 horas y la revisión no alcanzó a correr: se cierra, no se renueva
        if (vencida()) {
            cerrar();
            return;
        }

        const ahora = Date.now();

        if (ahora - ultimaEscritura >= ESCRITURA_MS) guardar(ahora);
        if (ahora - ultimoLatido >= LATIDO_MS) latir();
    }

    function revisar() {
        if (!cerrando && vencida()) cerrar();
    }

    // Recién entró (no hay hora guardada): cuenta desde ahora. Si hay una hora vencida, la revisión cierra
    try {
        if (!(Number(localStorage.getItem(CLAVE)) > 0)) guardar(Date.now());
    } catch {
        guardar(Date.now());
    }

    // Solo lo que hace la persona: tocar, hacer clic, escribir o desplazarse con el dedo o la rueda
    ['pointerdown', 'keydown', 'input', 'wheel', 'touchmove'].forEach(evento =>
        window.addEventListener(evento, registrarActividad, { capture: true, passive: true }));

    // Además de cada 30 s, al volver a la app (desbloquear el celular, cambiar de pestaña o volver atrás)
    setInterval(revisar, REVISION_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') revisar(); });
    window.addEventListener('pageshow', revisar);
    window.addEventListener('focus', revisar);
    revisar();
})();
