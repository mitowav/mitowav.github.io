document.addEventListener("DOMContentLoaded", () => {

    /* ================= SUPABASE ================= */

    const supabaseUrl = "TU_URL_DE_SUPABASE";
    const supabaseKey = "TU_ANON_KEY";

    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    /* ================= NAV ================= */

    function go(id){

        document.querySelectorAll("section").forEach(sec=>{
            sec.classList.remove("active");
        });

        const el = document.getElementById(id);
        if(el) el.classList.add("active");

        if(id === "music") cargarBeats();
    }

    window.go = go;

    /* ================= LOGIN ================= */

    function openLogin(){
        document.getElementById("login-overlay").classList.add("visible");
    }

    function cerrarLogin(){
        document.getElementById("login-overlay").classList.remove("visible");
    }

    function comprobarClave(){

        const input = document.getElementById("clave-input");
        const error = document.getElementById("error-msg");

        if(input.value === "1234"){
            cerrarLogin();
            go("secret");
        } else {
            error.textContent = "Clave incorrecta";
        }
    }

    window.openLogin = openLogin;
    window.cerrarLogin = cerrarLogin;
    window.comprobarClave = comprobarClave;

    /* ================= SUBIR BEAT ================= */

    window.subirBeat = async function(){

        const title = document.getElementById("title").value;
        const genre = document.getElementById("genre").value;
        const file = document.getElementById("audio").files[0];

        if(!file){
            alert("Selecciona un audio");
            return;
        }

        const fileName = Date.now() + "-" + file.name;

        // subir a storage
        const { error: uploadError } = await supabase
            .storage
            .from("beats")
            .upload(fileName, file);

        if(uploadError){
            console.log(uploadError);
            return;
        }

        const url = supabase
            .storage
            .from("beats")
            .getPublicUrl(fileName).data.publicUrl;

        // guardar en base de datos
        await supabase.from("beats").insert([
            {
                title: title || "Sin título",
                genre: genre || "Unknown",
                audio_url: url
            }
        ]);

        alert("Beat subido 🔥");

        cargarBeats();
    }

    /* ================= CARGAR BEATS ================= */

    async function cargarBeats(){

        const cont = document.getElementById("beats-list");
        if(!cont) return;

        const { data, error } = await supabase
            .from("beats")
            .select("*")
            .order("id", { ascending:false });

        if(error){
            console.log(error);
            return;
        }

        cont.innerHTML = "";

        data.forEach(beat=>{
            cont.innerHTML += `
            <div class="card">
                <h3>${beat.title}</h3>
                <p>${beat.genre}</p>
                <audio controls src="${beat.audio_url}"></audio>
            </div>
            `;
        });
    }

    /* ================= INIT ================= */

    go("home");

});
