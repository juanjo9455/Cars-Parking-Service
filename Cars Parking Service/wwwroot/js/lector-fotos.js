// Lector de fotos con Tesseract.js: lee en el mismo celular, gratis y sin servidor. Lee la placa en el ingreso y
// el valor del comprobante en el cobro. Solo escribe en el campo; quien registra lo revisa y lo corrige a mano.
// La librería y el idioma (unos MB) se bajan la primera vez que se usa y luego quedan en la caché del navegador
const TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let cargaTesseract = null;

// Foto del comprobante que se tomó en el Pago, por ingreso: Finalizar la trae cargada (abrirModalFinalizacion)
window.comprobantesTomados = window.comprobantesTomados || {};

function cargarTesseract() {
    cargaTesseract ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = TESSERACT_URL;
        script.onload = () => resolve(window.Tesseract);
        script.onerror = () => {
            cargaTesseract = null;   // sin internet: se puede intentar otra vez
            reject(new Error('No se pudo cargar el lector de fotos'));
        };
        document.head.appendChild(script);
    });
    return cargaTesseract;
}

// Lee cada imagen (con sus ajustes) hasta que `buscar` encuentre algo en el texto; null si no encuentra.
// Con `worker` usa ese (el del escáner, que sigue abierto); si no, abre uno y lo cierra al terminar
async function leerFoto(intentos, buscar, worker = null) {
    const propio = !worker;
    if (propio) worker = await (await cargarTesseract()).createWorker('eng');
    try {
        for (const [imagen, ajustes] of intentos) {
            if (!imagen) continue;
            await worker.setParameters(ajustes);
            const hallado = buscar((await worker.recognize(imagen)).data.text || '');
            if (hallado) return hallado;
        }
        return null;
    } finally {
        if (propio) await worker.terminate();
    }
}

// En la placa solo hay letras y números. 6 = un bloque de texto (el recorte); 11 = texto suelto (la foto entera)
const PLACA_LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -';
const PLACA_RECORTE = { tessedit_char_whitelist: PLACA_LETRAS, tessedit_pageseg_mode: '6' };
const PLACA_FOTO = { tessedit_char_whitelist: PLACA_LETRAS, tessedit_pageseg_mode: '11' };

const esAmarillo = (d, i) => d[i] > 120 && d[i + 1] > 90 && d[i + 2] < d[i + 1] * 0.6;

// Placa amarilla (carro particular): Tesseract se pierde con el carro y el fondo. Se recorta la zona amarilla del
// lienzo y queda en blanco y negro (amarillo -> blanco, letras -> negro), a 300 px de alto. null si casi no hay amarillo.
// shortcut: placas blancas (servicio público) o con poca luz van sin recortar; si fallan mucho, escribirla a mano
function recortarAmarillo(lienzo) {
    const w = lienzo.width, h = lienzo.height;
    const px = lienzo.getContext('2d').getImageData(0, 0, w, h).data;

    // Cuánto amarillo hay en cada fila y columna; la placa es donde hay al menos el 20% del máximo
    const filas = new Array(h).fill(0), columnas = new Array(w).fill(0);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (esAmarillo(px, (y * w + x) * 4)) { filas[y]++; columnas[x]++; }
        }
    }
    if (Math.max(...filas) < 20) return null;
    const rango = cuentas => {
        const minimo = Math.max(...cuentas) * 0.2;
        return [cuentas.findIndex(n => n >= minimo), cuentas.length - 1 - [...cuentas].reverse().findIndex(n => n >= minimo)];
    };
    const [y0, y1] = rango(filas), [x0, x1] = rango(columnas);

    const ancho = x1 - x0 + 1, alto = y1 - y0 + 1;
    const recorte = document.createElement('canvas');
    recorte.width = Math.round(ancho * 300 / alto); recorte.height = 300;
    const g = recorte.getContext('2d');
    g.drawImage(lienzo, x0, y0, ancho, alto, 0, 0, recorte.width, recorte.height);
    const datos = g.getImageData(0, 0, recorte.width, recorte.height);
    for (let i = 0; i < datos.data.length; i += 4) {
        datos.data[i] = datos.data[i + 1] = datos.data[i + 2] = esAmarillo(datos.data, i) ? 255 : 0;
    }
    g.putImageData(datos, 0, 0);
    return recorte;
}

// Lo mismo para una foto (data URL), reducida a 800 px de ancho
function recortarPlacaAmarilla(imagen) {
    return new Promise(resolve => {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
            const escala = Math.min(1, 800 / img.width);
            const lienzo = document.createElement('canvas');
            lienzo.width = Math.round(img.width * escala);
            lienzo.height = Math.round(img.height * escala);
            lienzo.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, lienzo.width, lienzo.height);
            resolve(recortarAmarillo(lienzo));
        };
        img.src = imagen;
    });
}

// Confusiones típicas al leer: un número donde va letra y al revés
const A_LETRA = { '0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '6': 'G', '8': 'B' };
const A_NUMERO = { 'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'Z': '2', 'A': '4', 'S': '5', 'G': '6', 'T': '7', 'B': '8' };

// Placa ABC123 (el formato que acepta el campo): 3 + 3 caracteres sueltos o juntos ("ABC 123", "ABC-123", "ABC123").
// Primero busca una exacta; si no hay, arregla las confusiones típicas. '' si no encuentra
function buscarPlaca(texto) {
    const lineas = String(texto).toUpperCase().split('\n').map(l => l.replace(/[^A-Z0-9]+/g, ' ').trim());
    const candidatas = lineas.flatMap(l => [...l.matchAll(/(?<![A-Z0-9])([A-Z0-9]{3}) ?([A-Z0-9]{3})(?![A-Z0-9])/g)]);

    for (const corregir of [false, true]) {
        for (const [, letras, numeros] of candidatas) {
            const l = corregir ? [...letras].map(c => A_LETRA[c] ?? c).join('') : letras;
            const n = corregir ? [...numeros].map(c => A_NUMERO[c] ?? c).join('') : numeros;
            if (/^[A-Z]{3}$/.test(l) && /^\d{3}$/.test(n)) return l + n;
        }
    }
    return '';
}

// "45.000" / "45.000,00" / "45,000.00" / "45000" -> 45000 (dos dígitos al final después de coma o punto son centavos)
function aPesos(texto) {
    return Number(texto.replace(/[.,]\d{2}$/, '').replace(/[.,]/g, '')) || 0;
}

// Valor del comprobante (Nequi, Bancolombia, Daviplata...): los montos con $. Gana el que está en la línea de
// "valor / cuánto / monto / total" o en la siguiente; si no, el mayor. Sin $ (a veces lo lee como S), los números
// con punto de miles. Menos de $1.000 no cuenta (el costo de $0 de la transferencia). null si no encuentra
function buscarValor(texto) {
    const lineas = String(texto).split('\n');
    const buscar = regex => lineas.flatMap((linea, n) =>
        [...linea.matchAll(regex)].map(m => ({ valor: aPesos(m[1]), n })).filter(m => m.valor >= 1000));

    const montos = buscar(/\$\s*(\d[\d.,]*\d|\d)/g);
    const candidatos = montos.length ? montos : buscar(/(?<![\d.,])(\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?)(?![\d.,])/g);
    if (!candidatos.length) return null;

    const clave = /valor|cu[aá]nto|monto|total|pagaste|enviaste|transferiste/i;
    const conClave = candidatos.find(m => clave.test(lineas[m.n]) || (m.n > 0 && clave.test(lineas[m.n - 1])));
    return (conClave ?? candidatos.reduce((a, b) => (b.valor > a.valor ? b : a))).valor;
}

// Abre la cámara (o la galería, con conCamara = false) y devuelve la foto reducida (compressImageToBase64, de
// ingreso-vehiculos-camera.js)
function tomarFotoLector(conCamara = true) {
    return new Promise(resolve => {
        // En la página (oculto), como los demás botones de cámara: algunos celulares no abren un input suelto
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        if (conCamara) input.setAttribute('capture', 'environment');
        input.hidden = true;
        input.onchange = async () => {
            const archivo = input.files?.[0];
            input.remove();
            resolve(archivo && archivo.type.startsWith('image/') ? await compressImageToBase64(archivo) : null);
        };
        document.body.appendChild(input);
        input.click();
    });
}

// Mientras lee, el botón queda en "Leyendo..." y no se puede volver a tocar
async function leyendo(boton, trabajo) {
    const antes = boton.innerHTML;
    boton.disabled = true;
    boton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Leyendo...';
    try {
        await trabajo();
    } catch (error) {
        console.error(error);
        mostrarAlertaWhatsApp('No se pudo leer la foto. Escríbelo a mano.', 'error');
    } finally {
        boton.disabled = false;
        boton.innerHTML = antes;
    }
}

// =========================== Escáner de placa (ingreso de vehículos) ===========================
// El botón de cámara junto a la placa abre la cámara en vivo con un marco del tamaño de una placa. Se lee lo que
// queda dentro del marco, cuadro tras cuadro, sin tomar foto. La placa se da por leída cuando sale igual dos veces
// seguidas (así no se queda con una lectura suelta equivocada). Debajo está el campo para corregirla o escribirla.
// La cámara en vivo necesita HTTPS (o localhost); sin cámara quedan el campo y "Desde una foto"

const TEXTOS_ESCANER = {
    preparando: 'Preparando el lector…',
    buscando: 'Buscando placa: encuádrala dentro del marco',
    casi: 'Leyendo… mantén el celular quieto',
    listo: '¡Placa encontrada! Revísala y úsala',
    pausa: 'Lectura en pausa mientras escribes',
    foto: 'Leyendo la foto…',
    'sin-placa': 'No se encontró la placa en la foto: escríbela',
    'sin-camara': 'No se pudo abrir la cámara. Escribe la placa o léela desde una foto'
};

let escaner = null;

function abrirEscanerPlaca() {
    if (escaner) return;

    const capa = document.createElement('div');
    capa.className = 'escaner';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-labelledby', 'escanerTitulo');
    capa.innerHTML = `
        <header class="escaner-barra">
            <h2 id="escanerTitulo"><i class="fa-solid fa-expand" aria-hidden="true"></i> Escanear placa</h2>
            <button type="button" class="escaner-cerrar" data-no-spinner="true" aria-label="Cerrar">&times;</button>
        </header>
        <div class="escaner-camara">
            <video playsinline muted autoplay></video>
            <div class="escaner-marco" aria-hidden="true"><span class="escaner-linea"></span><i class="fa-solid fa-check escaner-ok"></i></div>
            <p class="escaner-pista" aria-live="polite"></p>
        </div>
        <div class="escaner-hoja">
            <label for="escanerPlaca">Placa</label>
            <input type="text" id="escanerPlaca" class="escaner-placa-campo" maxlength="6" autocomplete="off"
                   autocapitalize="characters" spellcheck="false" placeholder="ABC123">
            <small>Se llena sola al leerla. Tócala para corregir o escribirla.</small>
            <button type="button" class="escaner-usar" data-no-spinner="true"><i class="fa-solid fa-check" aria-hidden="true"></i> Usar esta placa</button>
            <div class="escaner-acciones">
                <button type="button" class="escaner-otra" data-no-spinner="true"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Leer de nuevo</button>
                <button type="button" class="escaner-foto" data-no-spinner="true"><i class="fa-regular fa-image" aria-hidden="true"></i> Desde una foto</button>
            </div>
        </div>`;
    document.body.appendChild(capa);
    document.body.classList.add('escaner-abierto');

    const e = escaner = {
        capa,
        video: capa.querySelector('video'),
        campo: capa.querySelector('#escanerPlaca'),
        activo: false, ultima: '', flujo: null, worker: null, temporizador: null
    };

    // La que ya estaba escrita en el formulario
    e.campo.value = document.getElementById('placa')?.value || '';

    capa.querySelector('.escaner-cerrar').onclick = cerrarEscanerPlaca;
    capa.querySelector('.escaner-usar').onclick = usarPlacaEscaner;
    // Sin cámara (no dio permiso o se cayó) vuelve a pedirla
    capa.querySelector('.escaner-otra').onclick = () => {
        e.campo.value = '';
        if (e.worker && e.flujo) reanudarEscaner(e);
        else { estadoEscaner(e, 'preparando'); iniciarCamaraEscaner(e); }
    };
    capa.querySelector('.escaner-foto').onclick = () => leerPlacaDesdeFoto(e);
    e.campo.addEventListener('input', () => {
        e.campo.value = e.campo.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        e.campo.classList.remove('escaner-error');
        // Mientras escribe, la cámara no le cambia lo que está escribiendo
        if (e.activo) { e.activo = false; estadoEscaner(e, 'pausa'); }
    });
    e.campo.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); usarPlacaEscaner(); } });
    capa.addEventListener('keydown', ev => { if (ev.key === 'Escape') cerrarEscanerPlaca(); });

    estadoEscaner(e, 'preparando');
    capa.querySelector('.escaner-cerrar').focus();
    iniciarCamaraEscaner(e);
}

async function iniciarCamaraEscaner(e) {
    try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Sin cámara en vivo (¿HTTP?)');
        detenerFlujo(e);
        e.flujo = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false
        });
        if (escaner !== e) return detenerFlujo(e);   // la cerraron mientras pedía permiso
        e.video.srcObject = e.flujo;
        await e.video.play();

        e.worker ??= await (await cargarTesseract()).createWorker('eng');
        if (escaner !== e) return e.worker.terminate();
        reanudarEscaner(e);
    } catch (error) {
        console.warn('Escáner de placa:', error);
        if (escaner === e) estadoEscaner(e, 'sin-camara');
    }
}

function reanudarEscaner(e) {
    if (escaner !== e || !e.worker) return;
    e.ultima = '';
    e.activo = true;
    estadoEscaner(e, 'buscando');
    clearTimeout(e.temporizador);
    leerCuadroEscaner(e);
}

// Lee lo que hay dentro del marco y vuelve a leer al terminar (no se amontonan lecturas en celulares lentos)
async function leerCuadroEscaner(e) {
    if (escaner !== e || !e.activo) return;
    try {
        const cuadro = cuadroDelMarco(e);
        if (cuadro) {
            const imagen = recortarAmarillo(cuadro) || cuadro;   // placa blanca o poca luz: el cuadro tal cual
            const placa = await leerFoto([[imagen, PLACA_RECORTE]], buscarPlaca, e.worker);
            if (escaner !== e || !e.activo) return;

            if (placa && placa === e.ultima) {
                e.activo = false;
                e.campo.value = placa;
                estadoEscaner(e, 'listo');
                navigator.vibrate?.(60);
                return;
            }
            e.ultima = placa || '';
            estadoEscaner(e, placa ? 'casi' : 'buscando');
        }
    } catch (error) {
        console.warn('Escáner de placa:', error);
    }
    if (escaner === e && e.activo) e.temporizador = setTimeout(() => leerCuadroEscaner(e), 150);
}

// El pedazo del video que se ve dentro del marco (el video llena la pantalla con object-fit: cover, así que se
// pasa de la pantalla a los pixeles del video). Un poco más grande que el marco por si la placa se sale
function cuadroDelMarco(e) {
    const v = e.video;
    if (v.readyState < 2 || !v.videoWidth) return null;

    const caja = v.getBoundingClientRect();
    const marco = e.capa.querySelector('.escaner-marco').getBoundingClientRect();
    const escala = Math.max(caja.width / v.videoWidth, caja.height / v.videoHeight);
    const sobraX = (v.videoWidth * escala - caja.width) / 2;
    const sobraY = (v.videoHeight * escala - caja.height) / 2;
    const margen = 0.08;

    let sx = (marco.left - caja.left + sobraX) / escala - marco.width * margen / escala;
    let sy = (marco.top - caja.top + sobraY) / escala - marco.height * margen / escala;
    let sw = marco.width * (1 + 2 * margen) / escala;
    let sh = marco.height * (1 + 2 * margen) / escala;
    sx = Math.max(0, sx); sy = Math.max(0, sy);
    sw = Math.min(v.videoWidth - sx, sw); sh = Math.min(v.videoHeight - sy, sh);

    const lienzo = document.createElement('canvas');
    lienzo.width = 640;
    lienzo.height = Math.round(640 * sh / sw);
    lienzo.getContext('2d', { willReadFrequently: true }).drawImage(v, sx, sy, sw, sh, 0, 0, lienzo.width, lienzo.height);
    return lienzo;
}

// "Desde una foto": de la galería o la cámara del celular, con el lector de fotos de siempre
async function leerPlacaDesdeFoto(e) {
    e.activo = false;
    clearTimeout(e.temporizador);
    // Si cancela la galería queda en pausa: "Leer de nuevo" vuelve a la cámara
    estadoEscaner(e, e.worker ? 'pausa' : 'sin-camara');
    const foto = await tomarFotoLector(false);
    if (escaner !== e || !foto) return;

    estadoEscaner(e, 'foto');
    try {
        const placa = await leerFoto([[await recortarPlacaAmarilla(foto), PLACA_RECORTE], [foto, PLACA_FOTO]], buscarPlaca, e.worker);
        if (escaner !== e) return;
        if (placa) {
            e.campo.value = placa;
            estadoEscaner(e, 'listo');
        } else {
            estadoEscaner(e, 'sin-placa');
            e.campo.focus();
        }
    } catch (error) {
        console.warn('Escáner de placa:', error);
        if (escaner === e) estadoEscaner(e, 'sin-placa');
    }
}

function estadoEscaner(e, estado) {
    e.capa.dataset.estado = estado;
    e.capa.querySelector('.escaner-pista').textContent = TEXTOS_ESCANER[estado] || '';
}

// Pasa la placa al formulario (mismo formato que valida el ingreso: ABC123) y cierra
function usarPlacaEscaner() {
    const e = escaner;
    if (!e) return;
    const placa = e.campo.value.trim().toUpperCase();

    if (!/^[A-Z]{3}[0-9]{3}$/.test(placa)) {
        e.campo.classList.add('escaner-error');
        e.campo.focus();
        mostrarAlertaWhatsApp('La placa debe tener 3 letras y 3 números (ABC123).', 'error');
        return;
    }

    const campo = document.getElementById('placa');
    campo.value = placa;
    campo.dispatchEvent(new Event('input', { bubbles: true }));   // mayúsculas, borrador y aviso de error
    cerrarEscanerPlaca();
    document.getElementById('nombre_cliente')?.focus();
}

function detenerFlujo(e) {
    e.flujo?.getTracks().forEach(t => t.stop());
    e.flujo = null;
}

// Apaga la cámara y el lector y quita la ventana
function cerrarEscanerPlaca() {
    const e = escaner;
    if (!e) return;
    escaner = null;
    e.activo = false;
    clearTimeout(e.temporizador);
    detenerFlujo(e);
    e.worker?.terminate();
    e.capa.remove();
    document.body.classList.remove('escaner-abierto');
    document.querySelector('.placa-foto-btn')?.focus();
}

// Pago: "Leer comprobante" junto a "Cambiar valor total". Escribe el valor (se puede cambiar) y la foto sale
// cargada en Finalizar. Con el código ya generado el valor no cambia (el botón no se ve)
async function leerValorComprobante(idIngreso, boton) {
    const input = document.getElementById(`valor-cobrado-${idIngreso}`);
    if (!input || input.readOnly) return;

    const foto = await tomarFotoLector();
    if (!foto) return;
    window.comprobantesTomados[idIngreso] = foto;

    await leyendo(boton, async () => {
        const valor = await leerFoto([[foto, {}]], buscarValor);
        editarValorCobro(idIngreso);

        if (!valor) {
            mostrarAlertaWhatsApp('No se pudo leer el valor: escríbelo. La foto sí queda para Finalizar.', 'error');
            return;
        }

        input.value = valor;
        mostrarPesos(input);
        mostrarAlertaWhatsApp(`Valor leído: ${PESOS.format(valor)}. Revísalo antes de generar el código.`, 'success');
    });
}

// Desde Inicio ("Nuevo ingreso" con el botón de escanear, ?escanear=1): el escáner sale abierto
if (document.getElementById("placa") && new URLSearchParams(location.search).has("escanear")) abrirEscanerPlaca();
