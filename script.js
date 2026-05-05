function go(id){
    document.querySelectorAll("section").forEach(sec=>{
        sec.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}

/* 🔓 ABRIR LOGIN */
function openLogin(){
    const login = document.getElementById("login-overlay");
    if(login){
        login.classList.add("visible");
    }
}

/* ❌ CERRAR LOGIN */
function cerrarLogin(){
    const login = document.getElementById("login-overlay");
    if(login){
        login.classList.remove("visible");
    }

    const err = document.getElementById("error-msg");
    if(err) err.textContent = "";
}

/* 🔑 LOGIN */
function comprobarClave(){
    const input = document.getElementById("clave-input");
    const error = document.getElementById("error-msg");

    if(input.value === "adri123"){
        cerrarLogin();
        go("music");
    } else {
        if(error) error.textContent = "Clave incorrecta";
    }
}

/* 🎧 BEATS */
window.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("subirBeat");

    if(input){
        input.addEventListener("change", e=>{
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
    }
});
