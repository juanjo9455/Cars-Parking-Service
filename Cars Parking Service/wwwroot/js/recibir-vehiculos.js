// Banco de turno: vehículos sin cobrar de un banco cuyo turno ya terminó (Database/turnos.sql). Mientras haya,
// sale el botón redondo de arriba con la cantidad. La ventana para recibirlos solo se abre al tocarlo (nunca sola:
// así nadie los recibe por error); salen todos marcados y cada banco desmarca los que no le tocan.
// Usa de site.js: escaparHtml y mostrarAlertaWhatsApp
(() => {
    const modal = document.getElementById('recibir-vehiculos');
    const aviso = document.getElementById('recibir-aviso');
    if (!modal || !aviso) return;

    let vehiculos = [];

    const plural = (n, palabra) => `${n} ${palabra}${n === 1 ? '' : 's'}`;

    function pintar() {
        const n = vehiculos.length;
        const anteriores = [...new Set(vehiculos.map(v => `${v.turno || 'sin turno'} (banco: ${v.banco || '—'})`))];

        document.getElementById('recibir-texto').innerHTML =
            `Hay <strong>${plural(n, 'vehículo')}</strong> del turno anterior pendiente${n === 1 ? '' : 's'} por cobrar: ` +
            `${escaparHtml(anteriores.join(', '))}. ¿Deseas recibirlo${n === 1 ? '' : 's'} y quedar a cargo de su cobro?`;

        document.getElementById('recibir-lista').innerHTML = vehiculos.map(v => `
            <label class="recibir-item">
                <input type="checkbox" value="${Number(v.id)}" checked>
                <span class="ingreso-placa">${escaparHtml(v.placa ?? '')}</span>
                <span class="recibir-detalle">${escaparHtml(v.estado ?? '')} · ${escaparHtml(v.ubicacion ?? '')}</span>
            </label>`).join('');

        // Botón de arriba: la cantidad en la insignia y el texto para quien no ve el ícono
        const texto = `${plural(n, 'vehículo')} del turno anterior por recibir`;
        aviso.querySelector('.bubble-count').textContent = n || '';
        aviso.setAttribute('aria-label', texto);
        aviso.title = texto;
        aviso.hidden = n === 0;
    }

    // Trae los vehículos y actualiza el botón de arriba. La ventana no se abre aquí
    async function cargar() {
        try {
            const respuesta = await fetch('/Home/VehiculosPorRecibir', { cache: 'no-store' });
            vehiculos = (await respuesta.json()).vehiculos || [];
        } catch {
            vehiculos = [];
        }

        pintar();
    }

    // "Ahora no": la cierra; el botón de arriba sigue para recibirlos después
    document.getElementById('recibir-ahora-no').addEventListener('click', () => {
        modal.hidden = true;
    });

    aviso.addEventListener('click', () => { modal.hidden = false; });

    document.getElementById('recibir-aceptar').addEventListener('click', async e => {
        const ids = [...modal.querySelectorAll('.recibir-lista input:checked')].map(c => c.value);

        if (ids.length === 0) {
            mostrarAlertaWhatsApp('Marca los vehículos que vas a recibir.', 'error');
            return;
        }

        const boton = e.currentTarget;
        boton.disabled = true;

        const datos = new FormData();
        ids.forEach(id => datos.append('ids', id));
        datos.append('__RequestVerificationToken', modal.querySelector('input[name="__RequestVerificationToken"]')?.value ?? '');

        try {
            const data = await (await fetch('/Home/RecibirVehiculos', { method: 'POST', body: datos })).json();
            mostrarAlertaWhatsApp(data.mensaje, data.success ? 'success' : 'error');
            modal.hidden = true;

            // Recibidos: la tabla se recarga para mostrarlos. Si otro banco los recibió primero, se actualiza la lista
            if (data.success) {
                setTimeout(() => location.reload(), 1500);
            } else {
                cargar();
            }
        } catch {
            mostrarAlertaWhatsApp('No se pudieron recibir los vehículos. Revisa la conexión e intenta de nuevo.', 'error');
        } finally {
            boton.disabled = false;
        }
    });

    cargar();
})();
