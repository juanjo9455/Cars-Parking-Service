// Buscador de listas del ingreso (valet, parqueadero y ubicación): en vez de la lista del celular, la lupa abre
// una ventana con todas las opciones y un campo que las filtra mientras se escribe. El <select> sigue siendo el
// campo del formulario, así que la validación (ingreso-vehiculos.js) y el borrador (ingreso-borrador.js) no cambian
(function () {
    const campos = document.querySelectorAll('.campo-buscador');
    if (campos.length === 0) return;

    // La ventana va fuera del formulario: lo que se escribe en el buscador no cuenta como cambio del borrador
    const fondo = document.createElement('div');
    fondo.className = 'buscador-fondo';
    fondo.hidden = true;
    fondo.innerHTML = `
        <div class="buscador-ventana" role="dialog" aria-modal="true" aria-labelledby="buscadorTitulo">
            <div class="buscador-cabecera">
                <h2 id="buscadorTitulo"></h2>
                <button type="button" class="buscador-cerrar" aria-label="Cerrar">
                    <i class="fa-solid fa-x"></i>
                </button>
            </div>
            <div class="buscador-campo">
                <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
                <input type="search" id="buscadorTexto" placeholder="Buscar por nombre" aria-label="Buscar por nombre" autocomplete="off">
            </div>
            <ul class="buscador-lista"></ul>
            <p class="buscador-vacio" hidden>No hay resultados con ese nombre</p>
        </div>`;
    document.body.appendChild(fondo);

    const titulo = fondo.querySelector('#buscadorTitulo');
    const texto = fondo.querySelector('#buscadorTexto');
    const lista = fondo.querySelector('.buscador-lista');
    const vacio = fondo.querySelector('.buscador-vacio');

    let selectActual = null;
    let botonActual = null;

    // Sin tildes ni mayúsculas: "maria" encuentra a "María"
    const normalizar = valor => valor.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

    // Las opciones salen del <select> (ya vienen filtradas por la zona); la de "Selecciona..." (valor vacío) no va
    function pintar() {
        const buscado = normalizar(texto.value);
        lista.innerHTML = '';

        Array.from(selectActual.options)
            .filter(opcion => opcion.value !== '' && normalizar(opcion.text).includes(buscado))
            .forEach(opcion => {
                const boton = document.createElement('button');
                boton.type = 'button';
                boton.className = 'buscador-opcion';
                boton.textContent = opcion.text;

                if (opcion.value === selectActual.value) {
                    boton.classList.add('elegida');
                    boton.setAttribute('aria-current', 'true');
                }

                boton.addEventListener('click', () => elegir(opcion.value));

                const item = document.createElement('li');
                item.appendChild(boton);
                lista.appendChild(item);
            });

        vacio.hidden = lista.children.length > 0;
    }

    function abrir(select, boton) {
        selectActual = select;
        botonActual = boton;
        titulo.textContent = boton.dataset.titulo;
        texto.value = '';
        pintar();
        fondo.hidden = false;
        lista.scrollTop = 0;

        // En el celular el teclado no se abre de una vez: taparía la lista. En el computador sí queda listo para escribir
        if (window.matchMedia('(pointer: fine)').matches) texto.focus();
    }

    function cerrar() {
        fondo.hidden = true;
        botonActual?.focus();
        selectActual = null;
    }

    function elegir(valor) {
        selectActual.value = valor;

        // Igual que al elegir en la lista: quita el aviso de campo faltante y guarda el borrador
        selectActual.dispatchEvent(new Event('change', { bubbles: true }));
        cerrar();
    }

    texto.addEventListener('input', pintar);
    fondo.querySelector('.buscador-cerrar').addEventListener('click', cerrar);
    fondo.addEventListener('click', e => { if (e.target === fondo) cerrar(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !fondo.hidden) cerrar(); });

    // La lupa o cualquier parte del campo abre el buscador
    campos.forEach(campo => {
        const select = campo.querySelector('select');
        const boton = campo.querySelector('.btn-buscador');
        campo.addEventListener('click', () => abrir(select, boton));
    });
})();
