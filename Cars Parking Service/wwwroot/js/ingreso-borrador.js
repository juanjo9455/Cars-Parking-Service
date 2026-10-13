// Protección del ingreso de vehículos mientras se llena:
// avisa antes de salir de la página si ya hay datos, firma, video o fotos.
(function () {
    const form = document.getElementById('ingresoForm');
    if (!form) return;

    let hayCambios = false;
    let enviando = false;

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

    // El submit llega a window después de las validaciones de site.js e ingreso-vehiculos.js:
    // si alguna lo canceló (faltan datos), el aviso sigue activo
    window.addEventListener('submit', function (e) {
        if (e.target === form && !e.defaultPrevented) {
            enviando = true;
        }
    });

    // Atrás (incluido el gesto de Android), recargar o cerrar la pestaña
    window.addEventListener('beforeunload', function (e) {
        if (enviando || !tieneDatos()) return;

        // El navegador muestra su propio mensaje ("¿Salir del sitio?"); el texto no se puede cambiar
        e.preventDefault();
        e.returnValue = '';
    });
})();
