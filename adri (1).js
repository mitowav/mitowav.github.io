function go(id) {
    if (id === 'music') {
       document.getElementById('login-overlay').classList.add('visible');
            return;
        }

    document.querySelectorAll("section").forEach(sec => {
        sec.classList.remove("active");
    });

    document.getElementById(id).classList.add("active")
}

function comprobarClave() {
    const clave = document.getElementById('clave-input').value;
    if (clave === 'NOentrar') {
        document.getElementById('login-overlay').classList.remove('visible');
        document.querySelectorAll("section").forEach(sec => {
            sec.classList.remove("active");
        });
        document.getElementById('music').classList.add("active");
    
    }
    else {
        document.getElementById('error-msg').textContent = 'Clave incorrecta'
        document.getElementById('clave-input').value ='';
    }
}

const beats = [];

document.getElementById('subirBeat').addEventListener('change', function(e){
    const archivo = e.target.files[0];
    if (!archivo) return;

    const url = URL.createObjectURL(archivo);
    beats.push({nombre: archivo.name, url: url});
    mostrarBeats();
});

function mostrarBeats() {
    const lista = document.getElementById('listaBeat');
    lista.innerHTML = '';
    beats.forEach((beat, i) => {
        lista.innerHTML += `
        <div class="beat-item">
            <p>🎵 ${beat.nombre}</p>
            <audio controls src="${beat.url}"></audio>
            <button onclick="descargar(${i})">⬇️ Descargar</button>
         </div>
        `;
    });
}
function descargar(i) {
    const a = document.createElement('a');
    a.href = beats[i].url;
    a.download = beats[i].nombre;
    a.click();
}