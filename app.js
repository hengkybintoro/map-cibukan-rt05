let houses = [];

async function loadHouses() {
    try {
        // ── 1. Load SVG ────────────────────────────────────────────────────────
        const svgResponse = await fetch("assets/map.svg");
        if (!svgResponse.ok) throw new Error("SVG fetch failed: " + svgResponse.statusText);
        const svgText = await svgResponse.text();

        const mapContainer = document.getElementById("map-container");
        if (!mapContainer) return;

        // Parse and mount SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
        const svg = svgDoc.querySelector("svg");
        if (!svg) throw new Error("No <svg> element found");

        // Make SVG responsive
        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.style.width = "100%";
        svg.style.height = "auto";
        svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

        mapContainer.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.className = "svg-wrapper";
        wrapper.style.position = "relative";
        wrapper.appendChild(svg);
        mapContainer.appendChild(wrapper);

        // ── 2. Load house data ─────────────────────────────────────────────────
        const dataResponse = await fetch("houses.json");
        if (!dataResponse.ok) throw new Error("JSON fetch failed: " + dataResponse.statusText);
        houses = await dataResponse.json();
        console.debug("Houses loaded from JSON:", houses.length);

        // ── Filter by wilayah (if set) ─────────────────────────────────────────
        // To show only a specific area, set WILAYAH_FILTER to e.g. "RT05".
        // Leave as null (or "") to show all houses.
        const WILAYAH_FILTER = "RT05";
        if (WILAYAH_FILTER) {
            houses = houses.filter(h => (h.wilayah ?? "") === WILAYAH_FILTER);
        }

        console.debug("Houses after wilayah filter:", houses.length);

        // Build a quick lookup by id (only filtered houses are included)
        const houseById = {};
        houses.forEach(h => { houseById[h.id] = h; });

        // ── 3. Wire up label clicks directly on SVG elements ───────────────────
        // The SVG already has <g class="house-label" data-id="N"> elements with
        // correct cx/cy positions. We just attach click listeners to them.
        const labelGroups = svg.querySelectorAll("g.house-label");
        console.debug("House label groups found in SVG:", labelGroups.length);

        // Hide labels that are not in houseById (filtered out by wilayah)
        labelGroups.forEach(g => {
            const id = parseInt(g.getAttribute("data-id"), 10);
            if (!houseById[id]) {
                g.style.display = "none";
            }
        });

        // Remove inline onclick attributes so we fully control behaviour here
        labelGroups.forEach(g => {
            g.removeAttribute("onclick");
            const id = parseInt(g.getAttribute("data-id"), 10);
            const house = houseById[id];
            if (!house) return;

            g.style.cursor = "pointer";

            g.addEventListener("click", (e) => {
                e.stopPropagation();
                selectLabel(id, labelGroups);
                showHouse(house);
            });
        });

        // ── 4. Also wire up the underlying kavling polygons ────────────────────
        // Gray fill polygons don't have ids, so we match them spatially:
        // find the polygon whose centroid is closest to each label's cx/cy.
        const grayPaths = Array.from(
            svg.querySelectorAll('path[fill="rgb(85.098039%, 81.568627%, 78.823529%)"]')
        ).filter(p => {
            try { const b = p.getBBox(); return b.width > 2 && b.height > 2; } catch { return false; }
        });

        if (grayPaths.length > 0) {
            // For each house label, find the closest polygon and wire it up
            labelGroups.forEach(g => {
                const id = parseInt(g.getAttribute("data-id"), 10);
                const house = houseById[id];
                if (!house) return;

                const cx = house.cx;
                const cy = house.cy;

                let bestPath = null;
                let bestDist = Infinity;

                grayPaths.forEach(p => {
                    try {
                        const b = p.getBBox();
                        const pcx = b.x + b.width / 2;
                        const pcy = b.y + b.height / 2;
                        const dist = Math.hypot(pcx - cx, pcy - cy);
                        if (dist < bestDist) {
                            bestDist = dist;
                            bestPath = p;
                        }
                    } catch {}
                });

                if (bestPath && bestDist < 200) {
                    bestPath.style.cursor = "pointer";
                    bestPath.addEventListener("click", (e) => {
                        e.stopPropagation();
                        selectLabel(id, labelGroups);
                        showHouse(house);
                    });
                    // Mark so we don't double-bind
                    bestPath.dataset.houseId = String(id);
                }
            });
        }

        console.debug("Houses loaded:", houses.length);
        console.debug("Labels wired:", labelGroups.length);

    } catch (err) {
        console.error("Failed to load map or houses:", err);
    }
}

// ── Highlight selected label ───────────────────────────────────────────────────
function selectLabel(activeId, labelGroups) {
    labelGroups.forEach(g => {
        const circle = g.querySelector("circle");
        const isActive = parseInt(g.getAttribute("data-id"), 10) === activeId;
        if (circle) {
            circle.style.fill = isActive ? "#f59e0b" : "";  // amber when selected
            circle.style.fillOpacity = isActive ? "1" : "";
        }
        g.classList.toggle("selected-label", isActive);
    });
}

// ── Show modal ─────────────────────────────────────────────────────────────────
function showHouse(house) {
    const el = (id) => document.getElementById(id);

    if (el("houseNumber")) el("houseNumber").textContent = house.id;
    if (el("houseOwner"))  el("houseOwner").textContent  = house.pemilik  || "-";
    if (el("houseAddress")) el("houseAddress").textContent = house.address || "-";
    if (el("houseLT"))     el("houseLT").textContent     = house.luas_tanah    ? house.luas_tanah + " m²"    : "-";
    if (el("houseLB"))     el("houseLB").textContent     = house.luas_bangunan ? house.luas_bangunan + " m²" : "-";
    if (el("houseTipe"))   el("houseTipe").textContent   = house.tipe   || "-";
    if (el("houseStatus")) el("houseStatus").textContent = house.status || "-";
    if (el("houseHarga"))  el("houseHarga").textContent  = house.harga  || "Hubungi Marketing";

    el("modal").classList.remove("hidden");
}

// ── Close modal ────────────────────────────────────────────────────────────────
document.getElementById("close").addEventListener("click", () => {
    document.getElementById("modal").classList.add("hidden");

    // Reset all label colours back to default
    const svg = document.querySelector("#map-container svg");
    if (svg) {
        svg.querySelectorAll("g.house-label circle").forEach(circle => {
            circle.style.fill = "";
            circle.style.fillOpacity = "";
        });
        svg.querySelectorAll("g.house-label").forEach(g => g.classList.remove("selected-label"));
    }
});

loadHouses();
