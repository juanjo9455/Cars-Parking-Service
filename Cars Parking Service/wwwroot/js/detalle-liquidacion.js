// Vehículos de una liquidación en una ventana (_ModalDetalleLiquidacion). La usan Estado de turnos y
// Liquidaciones: el botón lleva data-id, data-usuario y data-fecha. Los datos salen de DetalleLiquidacion

const formatoPesos = v => '$' + Number(v || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });

// Texto del servidor escrito como texto, no como HTML
const escaparTexto = t => String(t ?? '—')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function verDetalleLiquidacion(btn) {
    const modal = document.getElementById('modal-detalle-liquidacion');
    const titulo = document.getElementById('detalle-liquidacion-titulo');
    const contenido = document.getElementById('detalle-liquidacion-contenido');

    titulo.textContent = `Liquidación de ${btn.dataset.usuario} · ${btn.dataset.fecha}`;
    contenido.innerHTML = '<p class="adm-text-muted">Cargando vehículos...</p>';
    modal.style.display = 'flex';

    try {
        const respuesta = await fetch(`/Home/DetalleLiquidacion?id=${encodeURIComponent(btn.dataset.id)}`, { cache: 'no-store' });
        const data = await respuesta.json();

        if (!data.success) {
            contenido.innerHTML = `<p class="adm-text-muted">${escaparTexto(data.message)}</p>`;
            return;
        }

        if (data.vehiculos.length === 0) {
            contenido.innerHTML = '<p class="adm-text-muted">Esta liquidación no tiene vehículos asociados.</p>';
            return;
        }

        const filas = data.vehiculos.map(v => `
            <tr>
                <td><span class="ingreso-placa">${escaparTexto(v.placa)}</span></td>
                <td>${escaparTexto(v.entrega)}</td>
                <td>${escaparTexto(v.cobro)} <span class="adm-text-muted">(${escaparTexto(v.rol)})</span></td>
                <td>${escaparTexto(v.metodo)}</td>
                <td>${escaparTexto(v.ubicacion)}</td>
                <td>${formatoPesos(v.valor)}</td>
            </tr>`).join('');

        const total = data.vehiculos.reduce((suma, v) => suma + Number(v.valor || 0), 0);

        contenido.innerHTML = `
            <div class="adm-table-scroll">
                <table class="adm-table">
                    <thead>
                        <tr>
                            <th>Placa</th>
                            <th>Entrega</th>
                            <th>Cobró</th>
                            <th>Método</th>
                            <th>Ubicación</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
            <p class="adm-liq-modal-total">
                ${data.vehiculos.length} vehículos · Total <strong>${formatoPesos(total)}</strong>
            </p>`;
    }
    catch (error) {
        console.error('[LIQUIDACION] Error cargando el detalle:', error);
        contenido.innerHTML = '<p class="adm-text-muted">No se pudo cargar el detalle de la liquidación.</p>';
    }
}

function cerrarDetalleLiquidacion() {
    document.getElementById('modal-detalle-liquidacion').style.display = 'none';
}
