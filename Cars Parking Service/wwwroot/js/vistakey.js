// vistakey.js

/**
 * Función sencilla para mostrar algo de información del vehículo 
 * (Si tienes un modal de bootstrap, lo puedes implementar aquí)
 */
function verInfoExtra(placa, notas) {
    // Para simplificar y no agregar HTML extra, usamos un alert simple.
    // En un futuro puedes mapear esto para abrir un <dialog> de HTML nativo o de Bootstrap con fotos.
    alert(`Vehículo: ${placa}\n\nNotas/Objetos de valor:\n${document.createElement('textarea').innerHTML = notas || 'No hay notas registradas.'}`);
}

// Opcional: auto-refrescar la página cada cierto tiempo (ej: 60 segundos)
// para que el Key vea las nuevas "colas/solicitudes" sin recargar manual.
setInterval(function () {
    // Recarga solo si el usuario no tiene la pantalla a medias (búsqueda compleja)
    const currentUrl = new URL(window.location.href);
    if (!currentUrl.searchParams.get('placa')) {
        window.location.reload();
    }
}, 60000); 