// Banco de turno: vehículos sin cobrar de un banco cuyo turno ya terminó (Database/turnos.sql). Al entrar sale la
// ventana para recibirlos, todos marcados: si entraron varios bancos, se ponen de acuerdo y cada uno desmarca los
// que no le tocan. "Ahora no" la cierra y deja el aviso flotante para recibirlos después.
// Usa de site.js: escaparHtml y mostrarAlertaWhatsApp
(() => {
    const modal = document.getElementById('recibir-vehiculos');
    const aviso = document.getElementById('recibir-aviso');
    if (!modal || !aviso) return;

    // "Ahora no": en esta sesión del navegador no vuelve a abrirse sola con los mismos vehículos
    const CLAVE = 'cps-recibir-visto';
    let vehiculos = [];

    const firma = () => vehiculos.map(v => v.id).join(',');
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

        aviso.innerHTML = `<i class="fa-solid fa-right-left"></i> ${plural(n, 'vehículo')} del turno anterior por recibir`;
        aviso.hidden = n === 0;
    }

    async function cargar(abrir) {
        try {
            const respuesta = await fetch('/Home/VehiculosPorRecibir', { cache: 'no-store' });
            vehiculos = (await respuesta.json()).vehiculos || [];
        } catch {
            vehiculos = [];
        }

        pintar();

        let visto = null;
        try { visto = sessionStorage.getItem(CLAVE); } catch { }

        if (abrir && vehiculos.length > 0 && visto !== firma()) {
            modal.hidden = false;
        }
    }

    document.getElementById('recibir-ahora-no').addEventListener('click', () => {
        modal.hidden = true;
        try { sessionStorage.setItem(CLAVE, firma()); } catch { }
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
                cargar(false);
            }
        } catch {
            mostrarAlertaWhatsApp('No se pudieron recibir los vehículos. Revisa la conexión e intenta de nuevo.', 'error');
        } finally {
            boton.disabled = false;
        }
    });

    cargar(true);
})();
