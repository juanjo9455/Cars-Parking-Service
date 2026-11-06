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

        const conSigno = v => (v < 0 ? '-' : '') + formatoPesos(Math.abs(v));

        // Lo que entró por cada carro y de qué se compone (en efectivo nunca hay propina)
        const desglose = v => Number(v.propina) > 0
            ? `<span class="adm-liq-desglose">servicio ${formatoPesos(v.valor)} + propina ${formatoPesos(v.propina)}</span>`
            : Number(v.cobrado) !== Number(v.valor)
                ? `<span class="adm-liq-desglose adm-liq-menos">servicio ${formatoPesos(v.valor)}: ${conSigno(Number(v.cobrado) - Number(v.valor))}</span>`
                : '';

        const filas = data.vehiculos.map(v => `
            <tr>
                <td><span class="ingreso-placa">${escaparTexto(v.placa)}</span></td>
                <td>${escaparTexto(v.entrega)}</td>
                <td>${escaparTexto(v.cobro)} <span class="adm-text-muted">(${escaparTexto(v.rol)})</span></td>
                <td>${escaparTexto(v.metodo)}</td>
                <td>${escaparTexto(v.ubicacion)}</td>
                <td><strong>${formatoPesos(v.cobrado)}</strong>${desglose(v)}</td>
            </tr>`).join('');

        // Las cuentas con esos carros, en el orden de la liquidación (LiquidacionReglas.Calcular)
        const esEfectivo = v => v.metodo === 'Efectivo';
        const suma = (lista, campo) => lista.reduce((s, v) => s + Number(v[campo] || 0), 0);
        const transferencias = suma(data.vehiculos.filter(v => !esEfectivo(v)), 'cobrado');
        const propinas = suma(data.vehiculos.filter(v => !esEfectivo(v)), 'propina');
        const efectivoAEntregar = suma(data.vehiculos.filter(esEfectivo), 'valor') - propinas;
        const total = suma(data.vehiculos, 'valor');
        const diferencia = transferencias + efectivoAEntregar - total;

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
                            <th>Cobrado</th>
                        </tr>
                    </thead>
                    <tbody>${filas}</tbody>
                </table>
            </div>
            <div class="adm-liq-cuentas">
                <span>1. Transferencias (QR) <strong>${formatoPesos(transferencias)}</strong></span>
                <span>2. Propinas de QR <strong>${conSigno(-propinas)}</strong></span>
                <span>3. Efectivo a entregar <strong>${conSigno(efectivoAEntregar)}</strong></span>
                <span class="adm-liq-cuentas-total">Total a liquidar (${data.vehiculos.length} vehículos) <strong>${formatoPesos(total)}</strong></span>
                ${diferencia !== 0 ? `<span class="adm-liq-menos">Diferencia <strong>${conSigno(diferencia)}</strong></span>` : ''}
            </div>`;
    }
    catch (error) {
        console.error('[LIQUIDACION] Error cargando el detalle:', error);
        contenido.innerHTML = '<p class="adm-text-muted">No se pudo cargar el detalle de la liquidación.</p>';
    }
}

function cerrarDetalleLiquidacion() {
    document.getElementById('modal-detalle-liquidacion').style.display = 'none';
}
