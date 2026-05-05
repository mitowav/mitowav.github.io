function go(id){
    document.querySelectorAll(".page").forEach(sec=>{
        sec.classList.remove("active");
    });

    const target = document.getElementById(id);
    if(target) target.classList.add("active");
}

/* LOGIN */
function openLogin(){
    document.getElementById("login-overlay").classList.add("visible");
}

function cerrarLogin(){
    document.getElementById("login-overlay").classList.remove("visible");
    const err = document.getElementById("error-msg");
    if(err) err.textContent = "";
}

/* 🔑 CLAVE FIJA */
function comprobarClave(){
    const input = document.getElementById("clave-input");
    const error = document.getElementById("error-msg");

    if(!input) return;

    const clave = input.value;

    if(clave === "1234"){
        cerrarLogin();
        go("secret");   // página nueva
    } else {
        if(error) error.textContent = "Clave incorrecta";
    }
}

/* BEATS (VERSIÓN SIMPLE Y SEGURA) */
window.addEventListener("DOMContentLoaded", () => {
    const subir = document.getElementById("subirBeat");

    if(subir){
        subir.addEventListener("change", (e)=>{
            const file = e.target.files[0];
            if(!file) return;

            const url = URL.createObjectURL(file);

            const div = document.createElement("div");
            div.className = "beat-item";

            div.innerHTML = `
                <p>🎵 ${file.name}</p>
                <audio controls src="${url}"></audio>
            `;

            const lista = document.getElementById("listaBeat");
            if(lista) lista.appendChild(div);
        });
    }
});
