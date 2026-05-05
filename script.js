function go(id){
    document.querySelectorAll("section").forEach(sec => {
        sec.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}

function openLogin(){
    document.getElementById("login-overlay").classList.add("visible");
}

function cerrarLogin(){
    document.getElementById("login-overlay").classList.remove("visible");
    document.getElementById("error-msg").textContent = "";
    document.getElementById("clave-input").value = "";
}

function comprobarClave(){
    const clave = document.getElementById("clave-input").value;

    if(clave === "adri123"){
        cerrarLogin();
        go("music");
    } else {
        document.getElementById("error-msg").textContent = "Clave incorrecta";
    }
}

document.getElementById("subirBeat").addEventListener("change", e => {
    const file = e.target.files[0];
    if(!file) return;

    const url = URL.createObjectURL(file);

    const div = document.createElement("div");
    div.className = "beat-item";

    div.innerHTML = `
        <p>🎵 ${file.name}</p>
        <audio controls src="${url}"></audio>
    `;

    document.getElementById("listaBeat").appendChild(div);
});

// Cerrar también tocando fuera de la caja
document.getElementById("login-overlay").addEventListener("click", e => {
    if(e.target.id === "login-overlay"){
        cerrarLogin();
    }
});
