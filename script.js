function go(id) {

    // Bloquear acceso a music
    if (id === 'music') {
        document.getElementById('login-overlay').classList.add('visible');
        return;
    }

    cambiarSeccion(id);
}

function cambiarSeccion(id){
    document.querySelectorAll("section").forEach(sec => {
        sec.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}

function comprobarClave() {
    const clave = document.getElementById('clave-input').value;

    if (clave === 'adri123') { // cámbiala por algo decente
        document.getElementById('login-overlay').classList.remove('visible');
        cambiarSeccion('music');
        document.getElementById('error-msg').textContent = '';
    } else {
        document.getElementById('error-msg').textContent = 'Clave incorrecta';
        document.getElementById('clave-input').value = '';
    }
}

// 🎧 BEATS
let beats = [];

document.getElementById('subirBeat').addEventListener('change', function(e){
    const archivo = e.target.files[0];
    if (!archivo) return;

    const url = URL.createObjectURL(archivo);

    beats.push({
        nombre: archivo.name,
        url: url
    });

    mostrarBeats();
});

function mostrarBeats() {
    const lista = document.getElementById('listaBeat');
    lista.innerHTML = '';

    beats.forEach((beat, i) => {
        const div = document.createElement('div');
        div.className = 'beat-item';

        div.innerHTML = `
            <p>🎵 ${beat.nombre}</p>
            <audio controls src="${beat.url}"></audio>
            <button onclick="descargar(${i})">⬇️ Descargar</button>
        `;

        lista.appendChild(div);
    });
}

function descargar(i) {
    const a = document.createElement('a');
    a.href = beats[i].url;
    a.download = beats[i].nombre;
    a.click();
}
