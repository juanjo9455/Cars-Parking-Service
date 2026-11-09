// Dashboard del administrador (Views/Dashboard/Index.cshtml). Lee los filtros, los deja en la URL para compartir la
// vista y llena cada tablero con su endpoint de DashboardController (SPs de Database/dashboard.sql).
// Fechas: días operativos, de 6 am a 6 am (lo de la madrugada es del día en que empezó el turno)
(function () {
    const form = document.getElementById('dshFiltros');
    if (!form || typeof Chart === 'undefined') return;

    const XLSX_URL = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const HORAS = [...Array(24).keys()].map(h => (h + 6) % 24);   // la jornada empieza a las 6 am
    const COLOR = { marca: '#c62828', oscuro: '#8e1b1b', efectivo: '#2e7d32', transferencia: '#1565c0', reja: '#eceff1' };
    const PALETA = ['#c62828', '#1565c0', '#2e7d32', '#ef6c00', '#6a1b9a', '#00838f', '#9e9d24', '#5d4037'];

    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    Chart.defaults.color = '#455a64';
    Chart.defaults.maintainAspectRatio = false;

    // ---------- Formatos ----------
    const pesos = v => (v < 0 ? '-$' : '$') + Math.round(Math.abs(Number(v) || 0)).toLocaleString('es-CO');
    const pesosCorto = v => Math.abs(v) >= 1e6 ? `$${(v / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`
        : Math.abs(v) >= 1e3 ? `$${Math.round(v / 1e3).toLocaleString('es-CO')} mil` : pesos(v);
    const numero = v => (Number(v) || 0).toLocaleString('es-CO');
    const minutos = v => {
        if (v == null) return '—';
        const m = Math.round(v);
        return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
    };
    const escapar = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fechaHora = s => s ? new Date(s).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

    // ---------- Fechas (yyyy-mm-dd, hora local) ----------
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const masDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
    const hoyOperativo = () => {
        const d = new Date(Date.now() - 6 * 3600 * 1000);
        return new Date(d.getFullYear(), d.getMonth(), d.getDate());
    };

    function rango(nombre) {
        const h = hoyOperativo();
        switch (nombre) {
            case 'ayer': return [masDias(h, -1), masDias(h, -1)];
            case '7d': return [masDias(h, -6), h];
            case 'mes': return [new Date(h.getFullYear(), h.getMonth(), 1), h];
            case 'mesant': return [new Date(h.getFullYear(), h.getMonth() - 1, 1), new Date(h.getFullYear(), h.getMonth(), 0)];
            case 'anio': return [new Date(h.getFullYear(), 0, 1), h];
            default: return [h, h];
        }
    }

    const campo = nombre => form.elements.namedItem(nombre);

    function ponerRango(nombre) {
        const [desde, hasta] = rango(nombre).map(iso);
        campo('desde').value = desde;
        campo('hasta').value = hasta;
    }

    // ---------- Filtros <-> URL ----------
    function leerUrl() {
        const q = new URLSearchParams(location.search);
        for (const c of form.elements) {
            if (!c.name) continue;
            const valores = q.getAll(c.name);
            if (c.type === 'checkbox') c.checked = valores.includes(c.value);
            else if (c.type === 'radio') c.checked = (valores[0] || 'dia') === c.value;
            else if (valores.length) c.value = valores[0];
        }
        if (!campo('desde').value || !campo('hasta').value) ponerRango('hoy');
    }

    function consulta() {
        const q = new URLSearchParams();
        for (const [k, v] of new FormData(form)) if (v !== '') q.append(k, v);
        return q;
    }

    // Lugar en cascada: solo los de las zonas escogidas (los que no tienen zona salen siempre)
    function filtrarLugares() {
        const zonas = [...form.querySelectorAll('input[name="zona"]:checked')].map(c => c.value);
        form.querySelectorAll('#dshLugares label').forEach(l => {
            const visible = !zonas.length || !l.dataset.zona || zonas.includes(l.dataset.zona);
            l.hidden = !visible;
            if (!visible) l.querySelector('input').checked = false;
        });
    }

    function resumirMultis() {
        form.querySelectorAll('.dsh-multi').forEach(m => {
            const marcados = [...m.querySelectorAll('input:checked')].map(c => c.parentElement.textContent.trim());
            m.querySelector('summary span').textContent = !marcados.length ? m.dataset.todos
                : marcados.length <= 2 ? marcados.join(', ') : `${marcados.length} escogidos`;
            m.classList.toggle('dsh-activo', marcados.length > 0);
        });
    }

    function marcarRango() {
        const d = campo('desde').value, h = campo('hasta').value;
        let nombre = '';
        form.querySelectorAll('[data-rango]').forEach(b => {
            const [a, z] = rango(b.dataset.rango).map(iso);
            const es = a === d && z === h;
            b.setAttribute('aria-pressed', es);
            if (es) nombre = b.textContent + ' · ';
        });
        const f = s => new Date(s + 'T00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
        document.getElementById('dshRangoTexto').textContent =
            `${nombre}${d === h ? f(d) : `${f(d)} – ${f(h)}`} · días de 6 a. m. a 6 a. m.`;
    }

    // ---------- Carga de cada tablero ----------
    // Cada tablero lleva su número de pedido: si cambian los filtros antes de que llegue, la respuesta vieja se ignora
    const pedidos = {};

    async function cargar(endpoint, q, tarjeta, pintar) {
        const mio = pedidos[tarjeta.id] = (pedidos[tarjeta.id] || 0) + 1;
        tarjeta.classList.add('dsh-carga');
        try {
            const r = await fetch(`/Dashboard/${endpoint}?${q}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
            if (r.status === 401) { location.href = '/Auth/Login'; return; }
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            const datos = await r.json();
            if (mio === pedidos[tarjeta.id]) pintar(datos);
        } catch (error) {
            if (mio !== pedidos[tarjeta.id]) return;
            console.error(endpoint, error);
            vacio(tarjeta, 'No se pudo cargar. Intenta de nuevo.');
        } finally {
            if (mio === pedidos[tarjeta.id]) tarjeta.classList.remove('dsh-carga');
        }
    }

    // Mensaje en el centro del tablero ("Sin datos..."); null lo quita
    function vacio(tarjeta, texto = 'Sin datos para los filtros seleccionados') {
        const cuerpo = tarjeta.querySelector('.dsh-cuerpo') || tarjeta;
        let aviso = cuerpo.querySelector(':scope > .dsh-vacio');
        if (!texto) { aviso?.remove(); return; }
        if (!aviso) {
            aviso = document.createElement('p');
            aviso.className = 'dsh-vacio';
            cuerpo.appendChild(aviso);
        }
        aviso.textContent = texto;
    }

    function dibujar(canvas, config) {
        Chart.getChart(canvas)?.destroy();
        if (config) new Chart(canvas, config);
    }

    const $ = id => document.getElementById(id);
    const datos = {};

    function actualizar() {
        if (campo('hasta').value && campo('desde').value > campo('hasta').value) {
            [campo('desde').value, campo('hasta').value] = [campo('hasta').value, campo('desde').value];
        }
        filtrarLugares();
        resumirMultis();
        marcarRango();

        const q = consulta();
        history.replaceState(null, '', `${location.pathname}?${q}`);
        pagina = 1;

        cargar('GetKpis', q, $('dshKpis'), pintarKpis);
        cargar('GetIngresosPorZona', q, $('tabZona'), d => { datos.zona = d; pintarBarras('zona'); });
        cargar('GetIngresosPorLugar', q, $('tabLugar'), d => { datos.lugar = d; pintarBarras('lugar'); });
        cargar('GetLiquidacionesPorFecha', q, $('tabFechas'), pintarFechas);
        cargar('GetHorasPico', q, $('tabHoras'), pintarHoras);
        cargar('GetRendimientoValets', q, $('tabValets'), pintarValets);
        cargar('GetDistribucion', q, $('tabDonas'), pintarDonas);
        cargarDetalle();
    }

    // ---------- KPIs ----------
    // mejor: 1 = subir es bueno (verde), -1 = subir es malo (rojo), 0 = sin color
    const KPIS = [
        { t: 'Total recaudado', i: 'fa-sack-dollar', v: r => r.recaudado, f: pesos, mejor: 1 },
        { t: 'Efectivo', i: 'fa-money-bill-wave', v: r => r.efectivo, f: pesos, mejor: 1 },
        { t: 'Transferencias', i: 'fa-building-columns', v: r => r.transferencias, f: pesos, mejor: 1 },
        { t: 'Vehículos atendidos', i: 'fa-car', v: r => r.atendidos, f: numero, mejor: 1 },
        { t: 'Ticket promedio', i: 'fa-receipt', v: r => r.liquidados ? r.recaudado / r.liquidados : 0, f: pesos, mejor: 1 },
        {
            t: 'Pendientes de pago / sin liquidar', i: 'fa-hourglass-half', v: r => r.pendientes_pago + r.sin_liquidar,
            f: (_, r) => `${numero(r.pendientes_pago)} <small>/</small> ${numero(r.sin_liquidar)}`, mejor: -1
        },
        { t: 'Deuda con banco', i: 'fa-hand-holding-dollar', v: r => r.deuda_banco, f: pesos, mejor: -1 },
        { t: 'Estadía promedio', i: 'fa-clock', v: r => r.estadia_min, f: minutos, mejor: 0 },
        { t: 'Despacho promedio', s: 'solicitado → despachado', i: 'fa-stopwatch', v: r => r.despacho_min, f: minutos, mejor: -1 },
        { t: 'Cancelados', i: 'fa-ban', v: r => r.cancelados, f: numero, mejor: -1 }
    ];

    function variacion(a, b, mejor) {
        if (a == null || b == null) return '<span class="dsh-var">— <span>vs. período anterior</span></span>';
        if (b === 0) return `<span class="dsh-var">${a === 0 ? 'Igual' : 'Sin datos antes'} <span>vs. período anterior</span></span>`;
        const pct = (a - b) / Math.abs(b) * 100;
        const quieto = Math.abs(pct) < 0.5;
        const clase = quieto || !mejor ? '' : (pct > 0) === (mejor > 0) ? 'dsh-bien' : 'dsh-mal';
        const flecha = quieto ? 'fa-minus' : pct > 0 ? 'fa-arrow-up' : 'fa-arrow-down';
        const texto = Math.abs(pct).toLocaleString('es-CO', { maximumFractionDigits: Math.abs(pct) < 10 ? 1 : 0 });
        return `<span class="dsh-var ${clase}"><i class="fa-solid ${flecha}" aria-hidden="true"></i> ${texto}% <span>vs. período anterior</span></span>`;
    }

    function pintarKpis(filas) {
        const actual = filas.find(f => f.periodo === 'actual') || {};
        const anterior = filas.find(f => f.periodo === 'anterior') || {};
        $('dshKpis').innerHTML = KPIS.map(k => `
            <article class="dsh-kpi">
                <span class="dsh-kpi-icono"><i class="fa-solid ${k.i}" aria-hidden="true"></i></span>
                <h3>${k.t}${k.s ? ` <small>${k.s}</small>` : ''}</h3>
                <strong>${k.f(k.v(actual), actual)}</strong>
                ${variacion(k.v(actual), k.v(anterior), k.mejor)}
            </article>`).join('');
    }

    // ---------- Barras por zona y por restaurante ----------
    function pintarBarras(cual) {
        const tarjeta = $(cual === 'zona' ? 'tabZona' : 'tabLugar');
        const ver = tarjeta.querySelector('[aria-pressed="true"]').dataset.ver;
        const enPesos = ver === 'recaudado';
        let filas = (datos[cual] || []).filter(f => f[ver] > 0).sort((a, b) => b[ver] - a[ver]);
        if (cual === 'lugar') filas = filas.slice(0, 15);

        const canvas = tarjeta.querySelector('canvas');
        canvas.parentElement.style.height = `${Math.max(220, filas.length * 30 + 50)}px`;
        vacio(tarjeta, filas.length ? null : undefined);

        dibujar(canvas, filas.length && {
            type: 'bar',
            data: {
                labels: filas.map(f => f.nombre),
                datasets: [{ data: filas.map(f => f[ver]), backgroundColor: cual === 'zona' ? COLOR.marca : COLOR.oscuro, borderRadius: 6, maxBarThickness: 22 }]
            },
            options: {
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: c => enPesos ? pesos(c.raw) : `${numero(c.raw)} vehículos` } }
                },
                scales: {
                    x: { beginAtZero: true, grid: { color: COLOR.reja }, ticks: { callback: v => enPesos ? pesosCorto(v) : numero(v) } },
                    y: { grid: { display: false } }
                },
                // Restaurante: un clic deja el dashboard solo con ese lugar
                onClick: cual === 'lugar' ? (_, el) => el.length && filtrarLugar(filas[el[0].index].id) : undefined,
                onHover: cual === 'lugar' ? (e, el) => { e.native.target.style.cursor = el.length ? 'pointer' : 'default'; } : undefined
            }
        });
    }

    function filtrarLugar(id) {
        if (!id) return;   // "Sin lugar"
        form.querySelectorAll('input[name="lugar"]').forEach(c => { c.checked = c.value === String(id); });
        actualizar();
    }

    // ---------- Liquidaciones por fecha ----------
    function pintarFechas(filas) {
        const tarjeta = $('tabFechas');
        const agrupacion = campo('agrupacion').value;
        const etiqueta = s => {
            const d = new Date(s);
            return agrupacion === 'anio' ? String(d.getFullYear())
                : agrupacion === 'mes' ? d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
                : d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
        };
        vacio(tarjeta, filas.length ? null : undefined);

        dibujar(tarjeta.querySelector('canvas'), filas.length && {
            type: 'bar',
            data: {
                labels: filas.map(f => etiqueta(f.periodo)),
                datasets: [
                    { label: 'Efectivo', data: filas.map(f => f.efectivo), backgroundColor: COLOR.efectivo, borderRadius: 4, maxBarThickness: 48 },
                    { label: 'Transferencias', data: filas.map(f => f.transferencias), backgroundColor: COLOR.transferencia, borderRadius: 4, maxBarThickness: 48 }
                ]
            },
            options: {
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'bottom' },
                    tooltip: {
                        callbacks: {
                            label: c => `${c.dataset.label}: ${pesos(c.raw)}`,
                            footer: items => `Total liquidado: ${pesos(filas[items[0].dataIndex].total)} · ${numero(filas[items[0].dataIndex].vehiculos)} vehículos`
                        }
                    }
                },
                scales: {
                    x: { stacked: true, grid: { display: false } },
                    y: { stacked: true, grid: { color: COLOR.reja }, ticks: { callback: pesosCorto } }
                }
            }
        });
    }

    // ---------- Horas pico (mapa de calor día × hora) ----------
    function pintarHoras(filas) {
        const tarjeta = $('tabHoras');
        const caja = tarjeta.querySelector('.dsh-calor');
        vacio(tarjeta, filas.length ? null : undefined);
        if (!filas.length) { caja.innerHTML = ''; return; }

        const mapa = new Map(filas.map(f => [`${f.dia_semana}-${f.hora}`, f.vehiculos]));
        const max = Math.max(...filas.map(f => f.vehiculos));
        let html = '<span></span>' + HORAS.map(h => `<span class="dsh-calor-hora">${h}</span>`).join('');
        DIAS.forEach((dia, i) => {
            html += `<span class="dsh-calor-dia">${dia}</span>`;
            for (const h of HORAS) {
                const n = mapa.get(`${i + 1}-${h}`) || 0;
                const alfa = n ? 0.15 + 0.85 * n / max : 0;
                html += `<span class="dsh-calor-celda${alfa > 0.55 ? ' dsh-fuerte' : ''}" style="--alfa:${alfa.toFixed(2)}"
                          title="${dia} ${String(h).padStart(2, '0')}:00 · ${n} vehículo${n === 1 ? '' : 's'}">${n || ''}</span>`;
            }
        });
        caja.innerHTML = html;
    }

    // ---------- Rendimiento por valet ----------
    function pintarValets(filas) {
        const tarjeta = $('tabValets');
        tarjeta.querySelector('tbody').innerHTML = filas.map(f => `
            <tr>
                <td>${escapar(f.nombre || '—')}</td>
                <td>${numero(f.recibidos)}</td>
                <td>${numero(f.despachados)}</td>
                <td>${pesos(f.recaudo)}</td>
                <td>${minutos(f.despacho_min)}</td>
            </tr>`).join('');
        vacio(tarjeta, filas.length ? null : undefined);
    }

    // ---------- Donas: turno y método de pago ----------
    function pintarDonas(filas) {
        const tarjeta = $('tabDonas');
        const turnos = filas.filter(f => f.grupo === 'turno');
        const metodos = filas.filter(f => f.grupo === 'metodo');
        vacio(tarjeta, filas.length ? null : undefined);

        const dona = (canvas, grupo, colores) => dibujar(canvas, grupo.length && {
            type: 'doughnut',
            data: { labels: grupo.map(f => f.etiqueta), datasets: [{ data: grupo.map(f => f.vehiculos), backgroundColor: colores, borderWidth: 2 }] },
            options: {
                cutout: '62%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12 } },
                    tooltip: { callbacks: { label: c => `${c.label}: ${numero(c.raw)} vehículos · ${pesos(grupo[c.dataIndex].valor)}` } }
                }
            }
        });

        dona($('donaTurno'), turnos, PALETA);
        dona($('donaMetodo'), metodos, metodos.map(f => f.etiqueta === 'Efectivo' ? COLOR.efectivo : COLOR.transferencia));
    }

    // ---------- Detalle de liquidaciones (paginado) ----------
    const TAMANO = 10;
    let pagina = 1;

    function cargarDetalle() {
        const q = consulta();
        q.set('pagina', pagina);
        q.set('tamano', TAMANO);
        cargar('GetDetalleLiquidaciones', q, $('tabDetalle'), pintarDetalle);
    }

    function pintarDetalle(filas) {
        const tarjeta = $('tabDetalle');
        const total = filas[0]?.total_filas || 0;
        const paginas = Math.max(1, Math.ceil(total / TAMANO));
        tarjeta.querySelector('tbody').innerHTML = filas.map(f => `
            <tr>
                <td>${fechaHora(f.fecha)}</td>
                <td>${escapar(f.funcionario)}</td>
                <td>${numero(f.vehiculos)}</td>
                <td>${pesos(f.efectivo)}</td>
                <td>${pesos(f.transferencias)}</td>
                <td><strong>${pesos(f.total)}</strong></td>
            </tr>`).join('');
        tarjeta.querySelector('.dsh-paginas span').textContent = total ? `Página ${pagina} de ${paginas} · ${numero(total)} liquidaciones` : '';
        tarjeta.querySelector('[data-pagina="-1"]').disabled = pagina <= 1;
        tarjeta.querySelector('[data-pagina="1"]').disabled = pagina >= paginas;
        vacio(tarjeta, filas.length ? null : undefined);
    }

    // ---------- Exportar ----------
    let cargaXlsx = null;
    function cargarXlsx() {
        cargaXlsx ??= new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = XLSX_URL;
            s.onload = () => resolve(window.XLSX);
            s.onerror = () => { cargaXlsx = null; reject(new Error('No se pudo cargar el exportador de Excel')); };
            document.head.appendChild(s);
        });
        return cargaXlsx;
    }

    // Todas las liquidaciones de los filtros (no solo la página), con una fila de total
    async function exportarExcel(boton) {
        const antes = boton.innerHTML;
        boton.disabled = true;
        boton.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Preparando...';
        try {
            const q = consulta();
            q.set('pagina', 1);
            q.set('tamano', 100000);
            const [respuesta, XLSX] = await Promise.all([fetch(`/Dashboard/GetDetalleLiquidaciones?${q}`, { cache: 'no-store' }), cargarXlsx()]);
            if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
            const filas = await respuesta.json();

            const suma = k => filas.reduce((s, f) => s + f[k], 0);
            const hoja = XLSX.utils.json_to_sheet([
                ...filas.map(f => ({
                    'Fecha y hora': fechaHora(f.fecha), 'Liquidó': f.funcionario, 'Vehículos': f.vehiculos,
                    'Efectivo': f.efectivo, 'Transferencias': f.transferencias, 'Total': f.total
                })),
                { 'Fecha y hora': 'Total', 'Liquidó': '', 'Vehículos': suma('vehiculos'), 'Efectivo': suma('efectivo'), 'Transferencias': suma('transferencias'), 'Total': suma('total') }
            ]);

            // Pesos sin decimales en Efectivo, Transferencias y Total
            const area = XLSX.utils.decode_range(hoja['!ref']);
            for (let r = 1; r <= area.e.r; r++) {
                for (const c of [3, 4, 5]) {
                    const celda = hoja[XLSX.utils.encode_cell({ r, c })];
                    if (celda) celda.z = '"$"#,##0';
                }
            }
            hoja['!cols'] = [{ wch: 18 }, { wch: 26 }, { wch: 10 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];

            const libro = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(libro, hoja, 'Liquidaciones');
            XLSX.writeFile(libro, `liquidaciones_${campo('desde').value}_a_${campo('hasta').value}.xlsx`);
        } catch (error) {
            console.error(error);
            alert('No se pudo exportar a Excel. Revisa la conexión e intenta de nuevo.');
        } finally {
            boton.disabled = false;
            boton.innerHTML = antes;
        }
    }

    // PDF: la ventana de imprimir del navegador ("Guardar como PDF"); las gráficas se ajustan al papel
    window.addEventListener('beforeprint', () => Object.values(Chart.instances).forEach(c => c.resize()));
    window.addEventListener('afterprint', () => Object.values(Chart.instances).forEach(c => c.resize()));

    // ---------- Eventos ----------
    form.addEventListener('change', e => {
        if (e.target.type === 'date' && !e.target.value) return;   // fecha a medio escribir
        if (e.target.name === 'agrupacion') {
            history.replaceState(null, '', `${location.pathname}?${consulta()}`);
            cargar('GetLiquidacionesPorFecha', consulta(), $('tabFechas'), pintarFechas);
            return;
        }
        actualizar();
    });

    form.querySelectorAll('[data-rango]').forEach(b => b.addEventListener('click', () => {
        ponerRango(b.dataset.rango);
        actualizar();
    }));

    $('dshLimpiar').addEventListener('click', () => {
        form.reset();
        ponerRango('hoy');
        actualizar();
    });

    document.querySelectorAll('.dsh-alternar button').forEach(b => b.addEventListener('click', () => {
        b.parentElement.querySelectorAll('button').forEach(o => o.setAttribute('aria-pressed', o === b));
        pintarBarras(b.closest('#tabZona') ? 'zona' : 'lugar');
    }));

    $('tabDetalle').querySelectorAll('[data-pagina]').forEach(b => b.addEventListener('click', () => {
        pagina += Number(b.dataset.pagina);
        cargarDetalle();
    }));

    $('dshExcel').addEventListener('click', e => exportarExcel(e.currentTarget));
    $('dshPdf').addEventListener('click', () => window.print());

    // Las listas de Zona y Lugar se cierran al tocar fuera
    document.addEventListener('click', e => {
        form.querySelectorAll('.dsh-multi[open]').forEach(m => { if (!m.contains(e.target)) m.removeAttribute('open'); });
    });

    leerUrl();
    actualizar();
})();
