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

// Lee cada imagen (con sus ajustes) hasta que `buscar` encuentre algo en el texto; null si no encuentra
async function leerFoto(intentos, buscar) {
    const Tesseract = await cargarTesseract();
    const worker = await Tesseract.createWorker('eng');
    try {
        for (const [imagen, ajustes] of intentos) {
            if (!imagen) continue;
            await worker.setParameters(ajustes);
            const hallado = buscar((await worker.recognize(imagen)).data.text || '');
            if (hallado) return hallado;
        }
        return null;
    } finally {
        await worker.terminate();
    }
}

// En la placa solo hay letras y números. 6 = un bloque de texto (el recorte); 11 = texto suelto (la foto entera)
const PLACA_LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -';
const PLACA_RECORTE = { tessedit_char_whitelist: PLACA_LETRAS, tessedit_pageseg_mode: '6' };
const PLACA_FOTO = { tessedit_char_whitelist: PLACA_LETRAS, tessedit_pageseg_mode: '11' };

const esAmarillo = (d, i) => d[i] > 120 && d[i + 1] > 90 && d[i + 2] < d[i + 1] * 0.6;

// Placa amarilla (carro particular): en la foto entera Tesseract se pierde con el carro y el fondo. Se recorta la
// zona amarilla y queda en blanco y negro (amarillo -> blanco, letras -> negro). null si casi no hay amarillo.
// shortcut: placas blancas (servicio público) o con poca luz van por la foto entera; si fallan mucho, recortar a mano
function recortarPlacaAmarilla(imagen) {
    return new Promise(resolve => {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
            const escala = Math.min(1, 800 / img.width);
            const w = Math.round(img.width * escala), h = Math.round(img.height * escala);
            const lienzo = document.createElement('canvas');
            lienzo.width = w; lienzo.height = h;
            lienzo.getContext('2d').drawImage(img, 0, 0, w, h);
            const px = lienzo.getContext('2d').getImageData(0, 0, w, h).data;

            // Cuánto amarillo hay en cada fila y columna; la placa es donde hay al menos el 20% del máximo
            const filas = new Array(h).fill(0), columnas = new Array(w).fill(0);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (esAmarillo(px, (y * w + x) * 4)) { filas[y]++; columnas[x]++; }
                }
            }
            const rango = cuentas => {
                const minimo = Math.max(...cuentas) * 0.2;
                return [cuentas.findIndex(n => n >= minimo), cuentas.length - 1 - [...cuentas].reverse().findIndex(n => n >= minimo)];
            };
            if (Math.max(...filas) < 20) return resolve(null);
            const [y0, y1] = rango(filas), [x0, x1] = rango(columnas);

            // A 300 px de alto, en blanco y negro
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
            resolve(recorte.toDataURL('image/png'));
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

// Abre la cámara y devuelve la foto reducida (compressImageToBase64, de ingreso-vehiculos-camera.js)
function tomarFotoLector() {
    return new Promise(resolve => {
        // En la página (oculto), como los demás botones de cámara: algunos celulares no abren un input suelto
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.setAttribute('capture', 'environment');
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

// Ingreso de vehículos: botón de cámara junto a la placa
async function leerPlacaDeFoto(boton) {
    const foto = await tomarFotoLector();
    if (!foto) return;

    await leyendo(boton, async () => {
        // Primero el recorte amarillo; si ahí no hay placa, la foto entera
        const placa = await leerFoto([[await recortarPlacaAmarilla(foto), PLACA_RECORTE], [foto, PLACA_FOTO]], buscarPlaca);
        const campo = document.getElementById('placa');

        if (!placa) {
            mostrarAlertaWhatsApp('No se pudo leer la placa: escríbela.', 'error');
            campo.focus();
            return;
        }

        campo.value = placa;
        campo.dispatchEvent(new Event('input', { bubbles: true }));   // mayúsculas, borrador y aviso de error
        mostrarAlertaWhatsApp(`Placa leída: ${placa}. Revísala antes de guardar.`, 'success');
    });
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
