let logged = false;

/* navegación SPA */
function go(id){
    document.querySelectorAll("section").forEach(s=>{
        s.classList.remove("active");
    });

    document.getElementById(id).classList.add("active");
}

/* login */
function openLogin(){
    document.getElementById("login-overlay").classList.add("visible");
}

function cerrarLogin(){
    document.getElementById("login-overlay").classList.remove("visible");
    document.getElementById("error-msg")?.remove();
}

function comprobarClave(){
    const clave = document.getElementById("clave-input").value;

    if(clave === "adri123"){
        logged = true;
        cerrarLogin();
        go("music");
        document.body.classList.add("logged");
    } else {
        document.getElementById("error-msg").textContent = "Clave incorrecta";
    }
}

/* beats */
document.getElementById("subirBeat").addEventListener("change", e=>{
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

/* 🌊 PARALLAX SUAVE (efecto pro sin romper estética) */
window.addEventListener("scroll", ()=>{
    const y = window.scrollY;
    document.body.style.backgroundPosition = `center ${y * 0.15}px`;
});
