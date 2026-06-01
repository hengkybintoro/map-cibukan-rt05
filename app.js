let houses = [];
let activeLabels = [];  // track rendered label elements

async function loadHouses() {
    try {
        const mapContainer = document.getElementById("map-container");
        if (!mapContainer) return;

        // ── 1. Build map wrapper with satellite image ──────────────────────────
        mapContainer.innerHTML = "";

        const wrapper = document.createElement("div");
        wrapper.className = "map-wrapper";

        const img = document.createElement("img");
        img.src = "assets/sample_map.png";
        img.alt = "Foto Satelit RT 05 RW 03";
        img.className = "map-image";
        // Wait for image to load before positioning labels
        img.onload = () => renderLabels(wrapper);
        img.onerror = () => console.error("Gagal memuat foto peta.");

        const overlay = document.createElement("div");
        overlay.className = "map-overlay";
        overlay.id = "map-overlay";

        wrapper.appendChild(img);
        wrapper.appendChild(overlay);
        mapContainer.appendChild(wrapper);

        // ── 2. Load house data ─────────────────────────────────────────────────
        const dataResponse = await fetch("houses.json");
        if (!dataResponse.ok) throw new Error("JSON fetch failed: " + dataResponse.statusText);
        houses = await dataResponse.json();

        // ── Filter by wilayah (if set) ─────────────────────────────────────────
        // Set WILAYAH_FILTER ke e.g. "RT05" untuk hanya tampilkan wilayah tertentu.
        // Biarkan null untuk tampilkan semua rumah yang punya map_x dan map_y.
        const WILAYAH_FILTER = null;
        if (WILAYAH_FILTER) {
            houses = houses.filter(h => (h.wilayah ?? "") === WILAYAH_FILTER);
        }

        // Jika gambar sudah selesai load sebelum data, render sekarang
        if (img.complete) renderLabels(wrapper);

    } catch (err) {
        console.error("Gagal memuat data:", err);
    }
}

// ── Render label di atas foto ──────────────────────────────────────────────────
function renderLabels(wrapper) {
    const overlay = wrapper.querySelector("#map-overlay");
    if (!overlay) return;
    overlay.innerHTML = "";
    activeLabels = [];

    houses.forEach((house) => {
        // Lewati rumah yang belum punya koordinat foto
        if (house.map_x == null || house.map_y == null ||
            house.map_x === "" || house.map_y === "") return;

        const label = document.createElement("div");
        label.className = "map-label";
        label.textContent = house.nomor;
        label.title = house.pemilik ? `No.${house.nomor} — ${house.pemilik}` : `No.${house.nomor}`;

        // Posisi berdasarkan persentase terhadap ukuran gambar
        label.style.left = `${house.map_x}%`;
        label.style.top  = `${house.map_y}%`;

        label.addEventListener("click", (e) => {
            e.stopPropagation();
            selectLabel(label);
            showHouse(house);
        });

        overlay.appendChild(label);
        activeLabels.push({ label, house });
    });

    console.debug(`Labels rendered: ${activeLabels.length} / ${houses.length} total`);
}

// ── Highlight label yang dipilih ───────────────────────────────────────────────
function selectLabel(activeEl) {
    activeLabels.forEach(({ label }) => label.classList.remove("selected"));
    activeEl.classList.add("selected");
}

// ── Show modal ─────────────────────────────────────────────────────────────────
function showHouse(house) {
    const el = (id) => document.getElementById(id);

    if (el("houseNumber"))  el("houseNumber").textContent  = house.nomor;
    if (el("houseOwner"))   el("houseOwner").textContent   = house.pemilik       || "-";
    if (el("houseAddress")) el("houseAddress").textContent = house.address        || "-";
    if (el("houseLT"))      el("houseLT").textContent      = house.luas_tanah     ? house.luas_tanah     + " m²" : "-";
    if (el("houseLB"))      el("houseLB").textContent      = house.luas_bangunan  ? house.luas_bangunan  + " m²" : "-";
    if (el("houseTipe"))    el("houseTipe").textContent    = house.tipe           || "-";
    if (el("houseStatus"))  el("houseStatus").textContent  = house.status         || "-";
    if (el("houseHarga"))   el("houseHarga").textContent   = house.harga          || "-";

    // Warna badge status
    const badge = el("houseStatus");
    if (badge) {
        badge.className = "status-badge";
        if (house.status === "Terjual")   badge.classList.add("status-sold");
        else if (house.status === "Dipesan") badge.classList.add("status-reserved");
        else badge.classList.add("status-available");
    }

    el("modal").classList.remove("hidden");
}

// ── Close modal ────────────────────────────────────────────────────────────────
document.getElementById("close").addEventListener("click", () => {
    document.getElementById("modal").classList.add("hidden");
    activeLabels.forEach(({ label }) => label.classList.remove("selected"));
});

loadHouses();
