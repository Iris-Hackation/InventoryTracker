/* ============================================================
   SCIENCE LAB INVENTORY SYSTEM
   MAIN JAVASCRIPT
   ------------------------------------------------------------
   Supabase-backed application logic.
   ============================================================ */

const APP = {
    authEmail: "labassistant@labinventory.local",
    labs: ["physics", "chemistry", "biology"]
};

const DB = {
    materials: [],
    transactions: [],
    orders: [],
    initialized: false
};

const DEFAULT_MATERIALS = [
    {id:"PHY-001",name:"Vernier Caliper",lab:"physics",category:"Measuring Instruments",type:"reusable",unit:"pieces",quantity:12,totalQuantity:12,availableQuantity:12,issuedQuantity:0,damagedQuantity:0,minimumStock:4,expiryDate:null,status:"active"},
    {id:"PHY-002",name:"Digital Multimeter",lab:"physics",category:"Electrical Instruments",type:"reusable",unit:"pieces",quantity:8,totalQuantity:8,availableQuantity:8,issuedQuantity:0,damagedQuantity:0,minimumStock:3,expiryDate:null,status:"active"},
    {id:"PHY-003",name:"Convex Lens Set",lab:"physics",category:"Optics",type:"reusable",unit:"sets",quantity:6,totalQuantity:6,availableQuantity:6,issuedQuantity:0,damagedQuantity:0,minimumStock:2,expiryDate:null,status:"active"},
    {id:"CHE-001",name:"Hydrochloric Acid",lab:"chemistry",category:"Acids",type:"consumable",unit:"litres",quantity:5,totalQuantity:5,availableQuantity:5,issuedQuantity:0,damagedQuantity:0,minimumStock:2,expiryDate:"2027-03-15",batches:[{batchId:"CHE-001-B01",dateAdded:"2026-09-01",quantityAdded:5,quantityRemaining:5,expiryDate:"2027-03-15"}],status:"active"},
    {id:"CHE-002",name:"Sodium Hydroxide",lab:"chemistry",category:"Bases",type:"consumable",unit:"kg",quantity:3,totalQuantity:3,availableQuantity:3,issuedQuantity:0,damagedQuantity:0,minimumStock:1,expiryDate:"2027-06-20",batches:[{batchId:"CHE-002-B01",dateAdded:"2026-09-01",quantityAdded:3,quantityRemaining:3,expiryDate:"2027-06-20"}],status:"active"},
    {id:"CHE-003",name:"Copper Sulphate",lab:"chemistry",category:"Salts",type:"consumable",unit:"kg",quantity:0.8,totalQuantity:0.8,availableQuantity:0.8,issuedQuantity:0,damagedQuantity:0,minimumStock:1,expiryDate:"2027-01-10",batches:[{batchId:"CHE-003-B01",dateAdded:"2026-09-01",quantityAdded:0.8,quantityRemaining:0.8,expiryDate:"2027-01-10"}],status:"active"},
    {id:"BIO-001",name:"Compound Microscope",lab:"biology",category:"Microscopes",type:"reusable",unit:"pieces",quantity:10,totalQuantity:10,availableQuantity:10,issuedQuantity:0,damagedQuantity:0,minimumStock:3,expiryDate:null,status:"active"},
    {id:"BIO-002",name:"Glass Microscope Slides",lab:"biology",category:"Microscopy",type:"reusable",unit:"boxes",quantity:6,totalQuantity:6,availableQuantity:6,issuedQuantity:0,damagedQuantity:0,minimumStock:2,expiryDate:null,status:"active"},
    {id:"BIO-003",name:"Dissection Kit",lab:"biology",category:"Dissection Equipment",type:"reusable",unit:"sets",quantity:7,totalQuantity:7,availableQuantity:7,issuedQuantity:0,damagedQuantity:0,minimumStock:2,expiryDate:null,status:"active"}
];

function getCurrentPage() {
    const raw = (window.location.pathname || "/").replace(/\\/g, "/");
    let page = raw.split("/").filter(Boolean).pop() || "index";
    page = page.split("?")[0].split("#")[0];
    if (page.endsWith(".html")) return page;

    const routes = {
        index: "index.html",
        dashboard: "dashboard.html",
        inventory: "inventory.html",
        material: "material.html",
        reports: "reports.html",
        orders: "orders.html",
        notifications: "notifications.html"
    };

    return routes[page.toLowerCase()] || "index.html";
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const allowed = await protectPages();
        if (!allowed) return;

        bindGlobalEvents();

        const page = getCurrentPage();
        if (page === "index.html") return;

        const loaded = await initializeData();
        if (!loaded) return;

        await setCurrentUsername();
        setActiveNavigation();
        await initializePage();
    } catch (error) {
        console.error("Application initialization failed:", error);
    }
});

/* ============================================================
   LOGIN / SESSION
   ============================================================ */

async function isLoggedIn() {
    try {
        const {data, error} = await supabaseClient.auth.getSession();
        if (error) {
            console.error("Session error:", error);
            return false;
        }
        return !!data?.session;
    } catch (error) {
        console.error("Session check failed:", error);
        return false;
    }
}

async function protectPages() {
    const page = getCurrentPage();
    const protectedPages = [
        "dashboard.html",
        "inventory.html",
        "material.html",
        "reports.html",
        "orders.html",
        "notifications.html"
    ];

    const loggedIn = await isLoggedIn();

    if (protectedPages.includes(page) && !loggedIn) {
        window.location.href = "index.html";
        return false;
    }

    if (page === "index.html" && loggedIn) {
        window.location.href = "dashboard.html";
        return false;
    }

    return true;
}

function bindGlobalEvents() {
    const loginForm = document.getElementById("loginForm");
    if (loginForm && !loginForm.dataset.bound) {
        loginForm.addEventListener("submit", handleLogin);
        loginForm.dataset.bound = "true";
    }

    if (!document.body.dataset.globalEventsBound) {
        document.addEventListener("click", handleGlobalClick);
        document.addEventListener("keydown", handleGlobalKeydown);
        document.body.dataset.globalEventsBound = "true";
    }
}

function handleGlobalClick(event) {
    const overlay = event.target.closest(".modal-overlay");
    if (overlay && event.target === overlay) {
        overlay.classList.add("hidden");
        return;
    }

    const card = event.target.closest(".material-card-clickable");
    if (card && !event.defaultPrevented && !event.target.closest("a,button,input,select,textarea,label")) {
        const href = card.dataset.href;
        if (href) window.location.href = href;
    }
}

function handleGlobalKeydown(event) {
    if (event.key === "Escape") {
        document.querySelectorAll(".modal-overlay").forEach(modal => modal.classList.add("hidden"));
    }

    const card = event.target.closest?.(".material-card-clickable");
    if (card && (event.key === "Enter" || event.key === " ")) {
        if (event.target === card) {
            event.preventDefault();
            const href = card.dataset.href;
            if (href) window.location.href = href;
        }
    }
}

async function handleLogin(event) {
    event.preventDefault();

    const username = document.getElementById("username")?.value.trim();
    const password = document.getElementById("password")?.value || "";
    const error = document.getElementById("loginError");
    const button = event.submitter || document.querySelector("#loginForm button[type='submit']");

    clearError(error);
    if (button) {
        button.disabled = true;
        button.textContent = "Signing in…";
    }

    const email = username?.includes("@") ? username : APP.authEmail;
    const {error: authError} = await supabaseClient.auth.signInWithPassword({email, password});

    if (authError) {
        showError(error, "Incorrect username or password.");
        if (button) {
            button.disabled = false;
            button.textContent = "Login";
        }
        return;
    }

    window.location.href = "dashboard.html";
}

async function logout() {
    await supabaseClient.auth.signOut();
    DB.materials = [];
    DB.transactions = [];
    DB.orders = [];
    DB.initialized = false;
    window.location.href = "index.html";
}

async function setCurrentUsername() {
    const {data} = await supabaseClient.auth.getUser();
    const username = data?.user?.user_metadata?.username || "labassistant";
    document.querySelectorAll("#currentUsername").forEach(el => {
        el.textContent = username;
    });
}

/* ============================================================
   SUPABASE DATA
   ============================================================ */

async function initializeData(force = false) {
    if (DB.initialized && !force) return true;

    const page = getCurrentPage();
    const needsMaterials = ["dashboard.html", "inventory.html", "material.html", "reports.html", "orders.html", "notifications.html"].includes(page);
    const editRequested = page === "inventory.html" && new URLSearchParams(location.search).has("edit");
    const needsTransactions = ["dashboard.html", "inventory.html", "material.html", "reports.html", "notifications.html"].includes(page) || editRequested;
    const needsOrders = ["dashboard.html", "orders.html", "notifications.html"].includes(page);

    const requests = {};
    if (needsMaterials) requests.materials = supabaseClient.from("materials").select("*").order("id");
    if (needsTransactions) requests.transactions = supabaseClient.from("transactions").select("*").order("created_at", {ascending: true});
    if (needsOrders) requests.orders = supabaseClient.from("orders").select("*").order("created_at", {ascending: true});

    const results = await Promise.all(Object.entries(requests).map(async ([key, promise]) => [key, await promise]));
    const responseMap = Object.fromEntries(results);

    for (const [key, response] of Object.entries(responseMap)) {
        if (response.error) {
            console.error(`Supabase ${key} load error:`, response.error);
            alert("The app could not load its Supabase data. Check the SQL setup and RLS policies, then reload.");
            return false;
        }
    }

    if (needsMaterials) DB.materials = normalizeMaterials(responseMap.materials?.data || []);
    else DB.materials = [];
    if (needsTransactions) DB.transactions = (responseMap.transactions?.data || []).map(fromDbTransaction);
    else DB.transactions = [];
    if (needsOrders) DB.orders = (responseMap.orders?.data || []).map(fromDbOrder);
    else DB.orders = [];

    // Repair any reusable-material counters that were left stale by an
    // earlier app version. Open issue quantities come from the issue
    // transactions, while damage totals come from damage transactions.
    if (needsMaterials && needsTransactions) {
        await reconcileReusableMaterialCounts();
    }

    if (needsMaterials) {
        const existingIds = new Set(DB.materials.map(m => m.id));
        const missing = DEFAULT_MATERIALS.filter(m => !existingIds.has(m.id)).map(clone);
        if (missing.length) {
            const seeded = await saveMaterials([...DB.materials, ...missing], {replaceCacheOnSuccess: true});
            if (!seeded) {
                console.warn("Some default materials could not be seeded.");
            }
        }
    }

    DB.initialized = true;
    return true;
}

async function reconcileReusableMaterialCounts() {
    const transactionMap = new Map();

    for (const transaction of DB.transactions) {
        if (!transaction.materialId) continue;
        if (!transactionMap.has(transaction.materialId)) transactionMap.set(transaction.materialId, []);
        transactionMap.get(transaction.materialId).push(transaction);
    }

    for (const material of DB.materials) {
        if (material.status === "deleted" || material.type !== "reusable") continue;

        const history = transactionMap.get(material.id) || [];
        const openIssued = history
            .filter(t => t.type === "issue" && t.status === "Not Returned" && finiteNumber(t.quantity, 0) > 0)
            .reduce((sum, t) => sum + finiteNumber(t.quantity, 0), 0);
        const historyDamaged = history
            .filter(t => t.type === "damage" && finiteNumber(t.quantity, 0) > 0)
            .reduce((sum, t) => sum + finiteNumber(t.quantity, 0), 0);

        const previousTotal = finiteNumber(material.totalQuantity, 0);
        const previousParts =
            finiteNumber(material.availableQuantity, 0) +
            finiteNumber(material.issuedQuantity, 0) +
            finiteNumber(material.damagedQuantity, 0);

        const damaged = Math.max(finiteNumber(material.damagedQuantity, 0), historyDamaged);
        const total = Math.max(previousTotal, previousParts, openIssued + damaged);
        const available = Math.max(0, total - openIssued - damaged);

        const changed =
            available !== finiteNumber(material.availableQuantity, 0) ||
            openIssued !== finiteNumber(material.issuedQuantity, 0) ||
            damaged !== finiteNumber(material.damagedQuantity, 0) ||
            total !== finiteNumber(material.totalQuantity, 0);

        if (!changed) continue;

        material.availableQuantity = available;
        material.issuedQuantity = openIssued;
        material.damagedQuantity = damaged;
        material.totalQuantity = total;
        material.quantity = available;

        const saved = await saveMaterialRecord(material);
        if (!saved) {
            console.warn(`Could not reconcile counters for ${material.id}.`);
        }
    }
}

function normalizeMaterials(items) {
    return (items || []).map(item => {
        const m = {...item};
        m.type = String(m.type || "reusable").toLowerCase() === "consumable" ? "consumable" : "reusable";
        m.id = String(m.id || "");
        m.name = String(m.name || "");
        m.lab = String(m.lab || "");
        m.category = String(m.category || "");
        m.unit = String(m.unit || "pieces");
        m.minimumStock = finiteNumber(m.minimum_stock ?? m.minimumStock, 0);
        m.quantity = finiteNumber(m.quantity, 0);
        m.totalQuantity = finiteNumber(m.total_quantity ?? m.totalQuantity, m.quantity);
        m.availableQuantity = finiteNumber(m.available_quantity ?? m.availableQuantity, m.quantity);
        m.issuedQuantity = finiteNumber(m.issued_quantity ?? m.issuedQuantity, 0);
        m.damagedQuantity = finiteNumber(m.damaged_quantity ?? m.damagedQuantity, 0);
        m.expiryDate = m.expiry_date ?? m.expiryDate ?? null;
        m.status = m.status || "active";

        if (typeof m.batches === "string") {
            try { m.batches = JSON.parse(m.batches); } catch { m.batches = []; }
        }
        m.batches = Array.isArray(m.batches) ? m.batches : [];

        if (m.type === "reusable") {
            m.availableQuantity = Math.max(0, m.availableQuantity);
            m.issuedQuantity = Math.max(0, m.issuedQuantity);
            m.damagedQuantity = Math.max(0, m.damagedQuantity);
            m.totalQuantity = Math.max(0, m.availableQuantity + m.issuedQuantity + m.damagedQuantity);
            m.quantity = m.availableQuantity;
            m.expiryDate = null;
            m.batches = [];
        } else {
            m.quantity = Math.max(0, m.quantity);
            m.availableQuantity = m.quantity;
            m.totalQuantity = m.quantity;
            m.issuedQuantity = 0;
            m.batches = m.batches.map(batch => ({
                batchId: String(batch.batchId || ""),
                dateAdded: batch.dateAdded || null,
                quantityAdded: finiteNumber(batch.quantityAdded, 0),
                quantityRemaining: Math.max(0, finiteNumber(batch.quantityRemaining, 0)),
                expiryDate: batch.expiryDate || null
            })).filter(batch => batch.quantityRemaining > 0 || batch.quantityAdded > 0);
            m.expiryDate = earliestExpiry(m.batches) || m.expiryDate || null;
        }

        return m;
    });
}

function toDbMaterial(m) {
    return {
        id: m.id,
        name: m.name,
        lab: m.lab,
        category: m.category,
        type: m.type,
        unit: m.unit,
        quantity: finiteNumber(m.quantity, 0),
        total_quantity: finiteNumber(m.totalQuantity, 0),
        available_quantity: finiteNumber(m.availableQuantity, 0),
        issued_quantity: finiteNumber(m.issuedQuantity, 0),
        damaged_quantity: finiteNumber(m.damagedQuantity, 0),
        minimum_stock: finiteNumber(m.minimumStock, 0),
        expiry_date: m.expiryDate || null,
        batches: Array.isArray(m.batches) ? m.batches : [],
        status: m.status || "active"
    };
}

async function saveMaterials(materials, options = {}) {
    const normalized = normalizeMaterials(materials);
    const {error} = await supabaseClient.from("materials").upsert(
        normalized.map(toDbMaterial),
        {onConflict: "id"}
    );

    if (error) {
        console.error("Supabase material save error:", error);
        return false;
    }

    if (options.replaceCacheOnSuccess !== false) DB.materials = normalized;
    return true;
}

async function saveMaterialRecord(material) {
    const normalized = normalizeMaterials([material])[0];
    if (!normalized?.id) return false;

    // Use an explicit UPDATE for existing materials.  Upsert was allowing
    // the edit form to look successful while the browser cache could retain
    // the previous row.  Returning the updated row also guarantees that the
    // local state is replaced with exactly what Supabase stored.
    const {data: existing, error: lookupError} = await supabaseClient
        .from("materials")
        .select("id")
        .eq("id", normalized.id)
        .maybeSingle();

    if (lookupError) {
        console.error("Supabase material lookup error:", lookupError);
        return false;
    }

    let data;
    let error;

    if (existing?.id) {
        const result = await supabaseClient
            .from("materials")
            .update(toDbMaterial(normalized))
            .eq("id", normalized.id)
            .select("*")
            .single();
        data = result.data;
        error = result.error;
    } else {
        const result = await supabaseClient
            .from("materials")
            .insert(toDbMaterial(normalized))
            .select("*")
            .single();
        data = result.data;
        error = result.error;
    }

    if (error || !data) {
        console.error("Supabase material save error:", error || "No material row returned.");
        return false;
    }

    const fresh = normalizeMaterials([data])[0];
    const index = DB.materials.findIndex(item => item.id === fresh.id);
    if (index >= 0) DB.materials[index] = fresh;
    else DB.materials.push(fresh);
    return true;
}

async function refreshMaterialRecord(materialId) {
    if (!materialId) return null;

    const {data, error} = await supabaseClient
        .from("materials")
        .select("*")
        .eq("id", materialId)
        .single();

    if (error || !data) {
        console.error("Supabase material refresh error:", error || "Material not found.");
        return null;
    }

    const fresh = normalizeMaterials([data])[0];
    const index = DB.materials.findIndex(item => item.id === fresh.id);
    if (index >= 0) DB.materials[index] = fresh;
    else DB.materials.push(fresh);
    return fresh;
}

async function refreshMaterialTransactions(materialId) {
    if (!materialId) return false;

    const {data, error} = await supabaseClient
        .from("transactions")
        .select("*")
        .eq("material_id", materialId)
        .order("created_at", {ascending: true});

    if (error) {
        console.error("Supabase transaction refresh error:", error);
        return false;
    }

    const others = DB.transactions.filter(t => t.materialId !== materialId);
    DB.transactions = [...others, ...(data || []).map(fromDbTransaction)]
        .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
    return true;
}

function getMaterials() {
    const materials = normalizeMaterials(DB.materials);

    // Reusable-equipment availability is derived from the transaction
    // history as well as the material row. This is important because older
    // versions of the app could successfully save an Issue transaction
    // while leaving available_quantity / issued_quantity stale.
    // Transaction history is the source of truth for what is currently out.
    const transactions = DB.transactions || [];
    const byMaterial = new Map();

    for (const transaction of transactions) {
        if (!transaction.materialId) continue;
        if (!byMaterial.has(transaction.materialId)) {
            byMaterial.set(transaction.materialId, []);
        }
        byMaterial.get(transaction.materialId).push(transaction);
    }

    for (const material of materials) {
        if (material.type !== "reusable" || material.status === "deleted") continue;

        const history = byMaterial.get(material.id) || [];

        const issuedFromHistory = history
            .filter(t =>
                t.type === "issue" &&
                t.status === "Not Returned" &&
                finiteNumber(t.quantity, 0) > 0
            )
            .reduce((sum, t) => sum + finiteNumber(t.quantity, 0), 0);

        const damagedFromHistory = history
            .filter(t =>
                t.type === "damage" &&
                finiteNumber(t.quantity, 0) > 0
            )
            .reduce((sum, t) => sum + finiteNumber(t.quantity, 0), 0);

        // Preserve the material's configured total, but repair it if the
        // stored counters are obviously incomplete.
        const storedTotal = finiteNumber(material.totalQuantity, 0);
        const storedParts =
            finiteNumber(material.availableQuantity, 0) +
            finiteNumber(material.issuedQuantity, 0) +
            finiteNumber(material.damagedQuantity, 0);

        const total = Math.max(
            storedTotal,
            storedParts,
            issuedFromHistory + damagedFromHistory
        );

        material.issuedQuantity = issuedFromHistory;
        material.damagedQuantity = Math.max(
            finiteNumber(material.damagedQuantity, 0),
            damagedFromHistory
        );
        material.totalQuantity = total;
        material.availableQuantity = Math.max(
            0,
            total - material.issuedQuantity - material.damagedQuantity
        );
        material.quantity = material.availableQuantity;
    }

    return materials;
}

function toDbTransaction(t) {
    return {
        id: t.id,
        material_id: t.materialId || null,
        lab: t.lab || null,
        type: t.type || null,
        date: t.date || null,
        time: t.time || null,
        teacher: t.teacher || null,
        quantity: finiteNumber(t.quantity, 0),
        status: t.status || null,
        remarks: t.remarks || null,
        expected_return_date: t.expectedReturnDate || null,
        actual_return_date: t.actualReturnDate || null,
        issued_to: t.issuedTo || null,
        created_at: t.createdAt || new Date().toISOString()
    };
}

function fromDbTransaction(t) {
    return {
        id: t.id,
        materialId: t.material_id,
        lab: t.lab,
        type: t.type,
        date: t.date,
        time: t.time,
        teacher: t.teacher,
        quantity: finiteNumber(t.quantity, 0),
        status: t.status,
        remarks: t.remarks,
        expectedReturnDate: t.expected_return_date,
        actualReturnDate: t.actual_return_date,
        issuedTo: t.issued_to,
        createdAt: t.created_at
    };
}

function getTransactions() {
    return DB.transactions.slice();
}

async function saveTransactions(items) {
    const normalized = items.map(item => ({...item}));
    const {error} = await supabaseClient.from("transactions").upsert(
        normalized.map(toDbTransaction),
        {onConflict: "id"}
    );
    if (error) {
        console.error("Supabase transaction save error:", error);
        return false;
    }
    DB.transactions = normalized;
    return true;
}

async function insertTransaction(transaction) {
    const row = {
        ...transaction,
        id: transaction.id || generateId("TX"),
        createdAt: transaction.createdAt || new Date().toISOString()
    };

    const {error} = await supabaseClient.from("transactions").insert(toDbTransaction(row));
    if (error) {
        console.error("Supabase transaction insert error:", error);
        return false;
    }

    DB.transactions.push(row);
    return true;
}

async function updateTransaction(transaction) {
    const {error} = await supabaseClient
        .from("transactions")
        .update(toDbTransaction(transaction))
        .eq("id", transaction.id);

    if (error) {
        console.error("Supabase transaction update error:", error);
        return false;
    }

    const index = DB.transactions.findIndex(item => item.id === transaction.id);
    if (index >= 0) DB.transactions[index] = {...transaction};
    return true;
}

function toDbOrder(o) {
    return {
        id: o.id,
        material_id: o.materialId,
        quantity: finiteNumber(o.quantity, 0),
        order_date: o.orderDate,
        status: o.status,
        received_qty: finiteNumber(o.receivedQty, 0),
        received_date: o.receivedDate || null,
        created_at: o.createdAt || new Date().toISOString()
    };
}

function fromDbOrder(o) {
    return {
        id: o.id,
        materialId: o.material_id,
        quantity: finiteNumber(o.quantity, 0),
        orderDate: o.order_date,
        status: o.status,
        receivedQty: finiteNumber(o.received_qty, 0),
        receivedDate: o.received_date,
        createdAt: o.created_at
    };
}

function getOrders() {
    return DB.orders.slice();
}

async function saveOrders(items) {
    const normalized = items.map(item => ({...item}));
    const {error} = await supabaseClient.from("orders").upsert(
        normalized.map(toDbOrder),
        {onConflict: "id"}
    );
    if (error) {
        console.error("Supabase order save error:", error);
        return false;
    }
    DB.orders = normalized;
    return true;
}

async function insertOrder(order) {
    const row = {
        ...order,
        id: order.id || generateId("ORD"),
        createdAt: order.createdAt || new Date().toISOString()
    };

    const {error} = await supabaseClient.from("orders").insert(toDbOrder(row));
    if (error) {
        console.error("Supabase order insert error:", error);
        return false;
    }

    DB.orders.push(row);
    return true;
}

async function updateOrder(order) {
    const {error} = await supabaseClient
        .from("orders")
        .update(toDbOrder(order))
        .eq("id", order.id);

    if (error) {
        console.error("Supabase order update error:", error);
        return false;
    }

    const index = DB.orders.findIndex(item => item.id === order.id);
    if (index >= 0) DB.orders[index] = {...order};
    return true;
}

function generateId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function finiteNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function todayISO() {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function timeNow() {
    const date = new Date();
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function addDays(dateString, days) {
    const date = new Date(`${dateString}T00:00:00`);
    date.setDate(date.getDate() + days);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString("en-IN", {day:"2-digit", month:"short", year:"numeric"});
}

function number(value) {
    const n = Math.round(finiteNumber(value, 0) * 100) / 100;
    if (Number.isInteger(n)) return String(n);
    return n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function unitLabel(quantity, unit) {
    const raw = String(unit || "").trim();
    if (!raw) return "";
    if (Math.abs(finiteNumber(quantity, 0)) !== 1) return raw;

    const singular = {
        pieces: "piece",
        piece: "piece",
        sets: "set",
        set: "set",
        boxes: "box",
        box: "box",
        bottles: "bottle",
        bottle: "bottle",
        packets: "packet",
        packet: "packet",
        litres: "litre",
        liters: "liter",
        metres: "metre",
        meters: "meter",
        grams: "gram",
        millilitres: "millilitre",
        milliliters: "milliliter",
        items: "item",
        rolls: "roll",
        roll: "roll"
    };

    const key = raw.toLowerCase();
    if (singular[key]) return singular[key];
    if (key.endsWith("ies")) return `${raw.slice(0, -3)}y`;
    if (key.endsWith("s") && !key.endsWith("ss")) return raw.slice(0, -1);
    return raw;
}

function quantityHTML(quantity, unit) {
    return `${number(quantity)} ${escapeHTML(unitLabel(quantity, unit))}`;
}

function labName(lab) {
    return lab ? lab.charAt(0).toUpperCase() + lab.slice(1) : "—";
}

function typeName(type) {
    return type === "consumable" ? "Consumable / Perishable" : "Reusable";
}

function getReusableStats(material) {
    if (!material || material.type !== "reusable") return null;
    const history = (DB.transactions || []).filter(t => t.materialId === material.id);
    const issued = history
        .filter(t => t.type === "issue" && t.status === "Not Returned" && finiteNumber(t.quantity, 0) > 0)
        .reduce((sum, t) => sum + finiteNumber(t.quantity, 0), 0);
    const historyDamaged = history
        .filter(t => t.type === "damage" && finiteNumber(t.quantity, 0) > 0)
        .reduce((sum, t) => sum + finiteNumber(t.quantity, 0), 0);
    const damaged = Math.max(finiteNumber(material.damagedQuantity, 0), historyDamaged);
    const total = Math.max(0, finiteNumber(material.totalQuantity, 0), issued + damaged);
    const available = Math.max(0, total - issued - damaged);
    return {total, available, issued, damaged};
}

function stockValue(material) {
    if (material?.type === "reusable") return getReusableStats(material)?.available ?? 0;
    return finiteNumber(material?.quantity, 0);
}

function isLowStock(material) {
    return stockValue(material) <= finiteNumber(material.minimumStock, 0);
}

function daysUntil(dateString) {
    if (!dateString) return null;
    const today = new Date(`${todayISO()}T00:00:00`);
    const target = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(target.getTime())) return null;
    return Math.ceil((target - today) / 86400000);
}

function expiryText(dateString) {
    return dateString ? formatDate(dateString) : "Indefinite";
}

function expirySortValue(dateString) {
    return dateString ? String(dateString) : "9999-12-31";
}

function earliestExpiry(batches) {
    const active = (batches || []).filter(batch => Number(batch.quantityRemaining) > 0 && batch.expiryDate);
    active.sort((a, b) => expirySortValue(a.expiryDate).localeCompare(expirySortValue(b.expiryDate)));
    return active[0]?.expiryDate || null;
}

function sortBatches(batches) {
    return batches.sort((a, b) =>
        expirySortValue(a.expiryDate).localeCompare(expirySortValue(b.expiryDate)) ||
        String(a.dateAdded || "").localeCompare(String(b.dateAdded || ""))
    );
}

function parseExpiryInput(value) {
    const trimmed = String(value || "").trim();
    if (/^indefinite$/i.test(trimmed) || /^none$/i.test(trimmed) || /^no expiry$/i.test(trimmed)) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
    const date = new Date(`${trimmed}T00:00:00`);
    return Number.isNaN(date.getTime()) ? undefined : trimmed;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

/* ============================================================
   NAVIGATION / PAGE INIT
   ============================================================ */

function openLab(lab) {
    if (!APP.labs.includes(lab)) return;
    window.location.href = `inventory.html?lab=${encodeURIComponent(lab)}`;
}

async function initializePage() {
    const page = getCurrentPage();
    setActiveNavigation();
    if (page === "dashboard.html") initDashboard();
    if (page === "inventory.html") initInventory();
    if (page === "material.html") await initMaterial();
    if (page === "reports.html") initReports();
    if (page === "orders.html") initOrders();
    if (page === "notifications.html") initNotifications();
}

// Always refresh protected pages when they become visible again.
// This is important when navigating back from a material detail page:
// browsers can restore the inventory page from memory without firing
// DOMContentLoaded, which previously left the old Available/Issued counts
// visible even though Supabase had the new values.
let pageRefreshInProgress = false;

async function refreshCurrentPageFromServer() {
    if (pageRefreshInProgress || getCurrentPage() === "index.html") return;

    pageRefreshInProgress = true;
    try {
        const loggedIn = await isLoggedIn();
        if (!loggedIn) return;

        await initializeData(true);
        await setCurrentUsername();
        setActiveNavigation();
        await initializePage();
    } catch (error) {
        console.error("Page refresh failed:", error);
    } finally {
        pageRefreshInProgress = false;
    }
}

window.addEventListener("pageshow", () => {
    refreshCurrentPageFromServer();
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        refreshCurrentPageFromServer();
    }
});


function setActiveNavigation() {
    const navLinks = document.querySelectorAll(".sidebar-nav a");
    if (!navLinks.length) return;

    navLinks.forEach(link => link.classList.remove("active"));
    const page = getCurrentPage();
    const params = new URLSearchParams(location.search);
    let selector = null;

    if (page === "dashboard.html") selector = 'a[href="dashboard.html"]';
    if (page === "reports.html") selector = 'a[href="reports.html"]';
    if (page === "orders.html") selector = 'a[href="orders.html"]';
    if (page === "notifications.html") selector = 'a[href="notifications.html"]';

    if (page === "inventory.html" || page === "material.html") {
        const materialLab = page === "inventory.html" ? params.get("lab") : currentMaterial()?.lab;
        if (materialLab) selector = `a[href="inventory.html?lab=${materialLab}"]`;
    }

    if (selector) document.querySelector(selector)?.classList.add("active");
}

/* ============================================================
   DASHBOARD
   ============================================================ */

function initDashboard() {
    const materials = getMaterials().filter(m => m.status !== "deleted");
    const notifications = buildNotifications();

    setText("totalMaterials", materials.length);
    setText("lowStockMaterials", materials.filter(isLowStock).length);
    setText("reusableMaterials", materials.filter(m => m.type === "reusable").length);
    setText("consumableMaterials", materials.filter(m => m.type === "consumable").length);

    const alertBar = document.getElementById("dashboardAlertBar");
    const alertCount = document.getElementById("dashboardAlertCount");
    const alertText = document.getElementById("dashboardAlertText");
    const alertIcon = document.getElementById("dashboardAlertIcon");

    if (alertBar && alertCount && alertText && alertIcon) {
        alertBar.classList.toggle("is-clear", notifications.length === 0);
        alertIcon.textContent = notifications.length ? "🔔" : "✓";
        alertCount.textContent = notifications.length
            ? `${notifications.length} active alert${notifications.length === 1 ? "" : "s"}`
            : "All systems clear";
        alertText.textContent = notifications.length
            ? "Review low stock, expiry, overdue equipment and order updates."
            : "Your current inventory has no generated alerts.";
    }

    const container = document.getElementById("dashboardNotifications");
    if (container) {
        container.innerHTML = notifications.length
            ? notifications.slice(0, 5).map(notificationHTML).join("")
            : emptyNotificationHTML();
    }
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/* ============================================================
   INVENTORY
   ============================================================ */

function initInventory() {
    const params = new URLSearchParams(location.search);
    const lab = params.get("lab");

    if (!APP.labs.includes(lab)) {
        setText("labTitle", "Select a Laboratory");
        renderInventory([]);
        return;
    }

    document.title = `${labName(lab)} Inventory - Lab Inventory`;
    setText("labTitle", `${labName(lab)} Laboratory`);

    const labSelect = document.getElementById("newMaterialLab");
    if (labSelect) labSelect.value = lab;

    bindFormOnce("inventorySearch", "input", renderCurrentInventory);
    bindFormOnce("inventoryTypeFilter", "change", renderCurrentInventory);
    bindFormOnce("addMaterialForm", "submit", saveMaterialFromForm);
    bindFormOnce("newMaterialType", "change", updateExpiryVisibility);
    bindFormOnce("newMaterialExpiryIndefinite", "change", updateExpiryVisibility);
    bindFormOnce("newMaterialLab", "change", updateExpiryVisibility);

    updateExpiryVisibility();
    renderCurrentInventory();

    const editId = params.get("edit");
    if (editId) {
        requestAnimationFrame(() => openAddMaterialForm(editId));
    }
}

function renderCurrentInventory() {
    const params = new URLSearchParams(location.search);
    const lab = params.get("lab");
    const search = (document.getElementById("inventorySearch")?.value || "").trim().toLowerCase();
    const type = document.getElementById("inventoryTypeFilter")?.value || "all";

    let materials = getMaterials().filter(m => m.lab === lab && m.status !== "deleted");
    if (type !== "all") materials = materials.filter(m => m.type === type);
    if (search) {
        materials = materials.filter(m =>
            [m.name, m.category, m.unit, m.id].some(value => String(value || "").toLowerCase().includes(search))
        );
    }

    renderInventory(materials);
}

function renderInventory(materials) {
    const container = document.getElementById("inventoryContainer");
    if (!container) return;

    if (!materials.length) {
        container.innerHTML = `<div class="empty-state full-width"><div class="empty-state-icon">📦</div><h3>No materials found</h3><p>Try another search or add a new material.</p></div>`;
        return;
    }

    container.innerHTML = materials.map(materialCardHTML).join("");
}

function materialCardHTML(m) {
    const reusableStats = m.type === "reusable" ? getReusableStats(m) : null;
    const stock = reusableStats ? reusableStats.available : stockValue(m);
    const low = isLowStock(m);
    const href = `material.html?id=${encodeURIComponent(m.id)}`;
    const expiry = m.type === "consumable" ? expiryStatus(m.expiryDate) : null;

    return `
        <article class="material-card material-card-clickable" data-href="${escapeHTML(href)}" tabindex="0" role="link" aria-label="View ${escapeHTML(m.name)} details">
            <div class="material-card-top">
                <span class="type-badge">${escapeHTML(typeName(m.type))}</span>
                <span class="stock-badge ${low ? "stock-low" : "stock-ok"}">${low ? "Low Stock" : "In Stock"}</span>
            </div>
            <h3>${escapeHTML(m.name)}</h3>
            <p class="material-category">${escapeHTML(m.category)}</p>
            <div class="material-card-stats">
                <div><span>Available</span><strong>${quantityHTML(stock, m.unit)}</strong></div>
                <div><span>Minimum</span><strong>${quantityHTML(m.minimumStock, m.unit)}</strong></div>
            </div>
            ${m.type === "reusable"
                ? `<p class="small-muted">Total: ${quantityHTML(m.totalQuantity, m.unit)} · Issued: ${quantityHTML(m.issuedQuantity, m.unit)} · Damaged: ${quantityHTML(m.damagedQuantity, m.unit)}</p>`
                : `<p class="expiry-line ${expiry?.class || ""}">Expiry: ${escapeHTML(expiryText(m.expiryDate))}${expiry?.label ? ` · ${escapeHTML(expiry.label)}` : ""}</p>`}
            <a class="card-action" href="${escapeHTML(href)}">View Details →</a>
        </article>
    `;
}

function expiryStatus(date) {
    if (!date) return {class:"expiry-ok", label:"Indefinite"};
    const days = daysUntil(date);
    if (days === null) return {class:"expiry-warning", label:"Check date"};
    if (days < 0) return {class:"expiry-danger", label:"Expired"};
    if (days <= 30) return {class:"expiry-warning", label:`${days} day${days === 1 ? "" : "s"} left`};
    return {class:"expiry-ok", label:"Valid"};
}

/* ============================================================
   ADD / EDIT / DELETE MATERIAL
   ============================================================ */

function openAddMaterialForm(materialId = null) {
    const modal = document.getElementById("addMaterialModal");
    const form = document.getElementById("addMaterialForm");
    if (!modal || !form) return;

    form.reset();
    setText("materialFormTitle", materialId ? "Edit Material" : "Add New Material");
    const editing = document.getElementById("editingMaterialId");
    if (editing) editing.value = materialId || "";

    const params = new URLSearchParams(location.search);
    const defaultLab = params.get("lab");
    const labSelect = document.getElementById("newMaterialLab");
    if (labSelect) labSelect.value = APP.labs.includes(defaultLab) ? defaultLab : "physics";

    const indefinite = document.getElementById("newMaterialExpiryIndefinite");
    const expiry = document.getElementById("newMaterialExpiry");

    if (materialId) {
        const m = getMaterials().find(item => item.id === materialId && item.status !== "deleted");
        if (!m) {
            showError(document.getElementById("materialFormError"), "Material could not be found.");
            return;
        }

        document.getElementById("newMaterialLab").value = m.lab;
        document.getElementById("newMaterialName").value = m.name;
        document.getElementById("newMaterialCategory").value = m.category;
        document.getElementById("newMaterialType").value = m.type;
        document.getElementById("newMaterialUnit").value = m.unit;
        document.getElementById("newMaterialQuantity").value = number(stockValue(m));
        document.getElementById("newMaterialMinimum").value = number(m.minimumStock);
        if (expiry) expiry.value = m.expiryDate || "";
        if (indefinite) indefinite.checked = m.type === "consumable" && !m.expiryDate;
    } else if (indefinite) {
        indefinite.checked = false;
    }

    updateExpiryVisibility();
    clearError(document.getElementById("materialFormError"));
    modal.classList.remove("hidden");
}

function closeAddMaterialForm() {
    document.getElementById("addMaterialModal")?.classList.add("hidden");
}

function updateExpiryVisibility() {
    const type = document.getElementById("newMaterialType")?.value;
    const lab = document.getElementById("newMaterialLab")?.value;
    const group = document.getElementById("newExpiryGroup");
    const input = document.getElementById("newMaterialExpiry");
    const indefinite = document.getElementById("newMaterialExpiryIndefinite");
    if (!group || !input) return;

    const show = type === "consumable";
    group.classList.toggle("hidden", !show);
    input.required = show && !(indefinite?.checked);
    input.disabled = !!indefinite?.checked || !show;

    if (show && lab && lab !== "chemistry") {
        const error = document.getElementById("materialFormError");
        showError(error, "Consumable/perishable materials can only be added to the Chemistry laboratory.");
    } else if (document.getElementById("materialFormError")?.textContent?.includes("Consumable/perishable")) {
        clearError(document.getElementById("materialFormError"));
    }
}

async function saveMaterialFromForm(event) {
    event.preventDefault();

    const id = document.getElementById("editingMaterialId")?.value?.trim() || "";
    const lab = document.getElementById("newMaterialLab")?.value;
    const type = document.getElementById("newMaterialType")?.value;
    const name = document.getElementById("newMaterialName")?.value.trim();
    const category = document.getElementById("newMaterialCategory")?.value.trim();
    const unit = document.getElementById("newMaterialUnit")?.value.trim();
    const quantity = Number(document.getElementById("newMaterialQuantity")?.value);
    const minimum = Number(document.getElementById("newMaterialMinimum")?.value);
    const indefinite = !!document.getElementById("newMaterialExpiryIndefinite")?.checked;
    const expiry = indefinite ? null : (document.getElementById("newMaterialExpiry")?.value || null);
    const error = document.getElementById("materialFormError");
    const button = document.querySelector("#addMaterialForm button[type='submit']");

    clearError(error);
    if (!id) return showError(error, "No material selected for editing.");
    if (!name || !category || !unit) return showError(error, "Complete all material details.");
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(minimum) || minimum < 0) {
        return showError(error, "Quantity values must be valid non-negative numbers.");
    }
    if (!APP.labs.includes(lab)) return showError(error, "Please select a valid laboratory.");
    if (type === "consumable" && lab !== "chemistry") return showError(error, "Consumable/perishable materials can only be in Chemistry.");
    if (type === "consumable" && !indefinite && !expiry) return showError(error, "Choose an expiry date or select indefinite expiry.");

    const target = DB.materials.find(m => m.id === id && m.status !== "deleted");
    if (!target) return showError(error, "Material could not be found.");

    const oldAvailable = Number(target.availableQuantity || 0);
    const issued = Number(target.issuedQuantity || 0);
    const damaged = Number(target.damagedQuantity || 0);
    const oldTotal = Number(target.totalQuantity || (oldAvailable + issued + damaged));

    if (button) { button.disabled = true; button.textContent = "Saving…"; }

    try {
        // IMPORTANT: update the database row directly. Do not run normalize/reconciliation
        // before the update, because that was overwriting legitimate edits with stale counters.
        const payload = {
            name,
            lab,
            category,
            type,
            unit,
            minimum_stock: minimum,
            status: target.status || "active"
        };

        if (type === "reusable") {
            payload.quantity = quantity;
            payload.available_quantity = quantity;
            payload.issued_quantity = issued;
            payload.damaged_quantity = damaged;
            payload.total_quantity = quantity + issued + damaged;
            payload.expiry_date = null;
            payload.batches = [];
        } else {
            payload.quantity = quantity;
            payload.available_quantity = quantity;
            payload.issued_quantity = 0;
            payload.damaged_quantity = damaged;
            payload.total_quantity = quantity;
            payload.expiry_date = expiry;
            payload.batches = Array.isArray(target.batches) ? target.batches : [];
        }

        const { data, error: dbError } = await supabaseClient
            .from("materials")
            .update(payload)
            .eq("id", id)
            .select("*")
            .single();

        if (dbError || !data) {
            console.error("EDIT SAVE FAILED:", dbError);
            return showError(error, `Save failed: ${dbError?.message || "Supabase did not return the updated material."}`);
        }

        // Replace the browser copy with exactly what Supabase returned.
        const fresh = normalizeMaterials([data])[0];
        const index = DB.materials.findIndex(m => m.id === id);
        if (index >= 0) DB.materials[index] = fresh;
        else DB.materials.push(fresh);

        const delta = type === "reusable" ? quantity - oldAvailable : quantity - oldAvailable;
        if (delta !== 0) {
            await insertTransaction({
                id: generateId("TX"),
                createdAt: new Date().toISOString(),
                type: "stock_adjustment",
                materialId: id,
                lab,
                date: todayISO(),
                time: timeNow(),
                teacher: "Lab Assistant",
                quantity: delta,
                status: "Adjusted",
                remarks: "Manual stock adjustment while editing material"
            });
        }

        closeAddMaterialForm();
        renderCurrentInventory();

        // If editing from Material Details, go straight back there.
        const returnTo = new URLSearchParams(location.search).get("returnTo");
        if (returnTo) {
            window.location.href = returnTo;
            return;
        }

        // Force the inventory list to use the newly saved DB state.
        await initializeData(true);
        renderCurrentInventory();
    } catch (e) {
        console.error("EDIT SAVE EXCEPTION:", e);
        showError(error, `Save failed: ${e.message || e}`);
    } finally {
        if (button) { button.disabled = false; button.textContent = "Save Material"; }
    }
}

function editMaterial(id) {
    openAddMaterialForm(id);
}

async function deleteMaterial(id) {
    const material = getMaterials().find(m => m.id === id && m.status !== "deleted");
    if (!material) return;

    const confirmed = confirm(
        `Permanently delete "${material.name}"?\n\nThis removes the material, its orders, and its transaction history from the database.`
    );
    if (!confirmed) return;

    const relatedTransactions = getTransactions().filter(t => t.materialId === id);
    let relatedOrders = getOrders().filter(o => o.materialId === id);

    if (!relatedOrders.length) {
        const {data: orderRows, error: orderLoadError} = await supabaseClient
            .from("orders")
            .select("*")
            .eq("material_id", id);
        if (orderLoadError) {
            console.error("Could not load related orders before deletion:", orderLoadError);
            alert("The material was not deleted because its related orders could not be checked.");
            return;
        }
        relatedOrders = (orderRows || []).map(fromDbOrder);
    }

    const transactionDelete = await supabaseClient.from("transactions").delete().eq("material_id", id);
    if (transactionDelete.error) {
        console.error("Transaction deletion failed:", transactionDelete.error);
        alert("The material was not deleted because its transaction history could not be removed.");
        return;
    }

    const orderDelete = await supabaseClient.from("orders").delete().eq("material_id", id);
    if (orderDelete.error) {
        console.error("Order deletion failed:", orderDelete.error);
        await restoreDeletedRows("transactions", relatedTransactions.map(toDbTransaction), "id");
        alert("The material was not deleted because its order records could not be removed.");
        return;
    }

    const materialDelete = await supabaseClient.from("materials").delete().eq("id", id);
    if (materialDelete.error) {
        console.error("Material deletion failed:", materialDelete.error);
        await restoreDeletedRows("transactions", relatedTransactions.map(toDbTransaction), "id");
        await restoreDeletedRows("orders", relatedOrders.map(toDbOrder), "id");
        alert("The material could not be deleted. Your existing records were restored where possible.");
        return;
    }

    DB.materials = DB.materials.filter(m => m.id !== id);
    DB.transactions = DB.transactions.filter(t => t.materialId !== id);
    DB.orders = DB.orders.filter(o => o.materialId !== id);

    if (getCurrentPage() === "material.html") {
        const lab = material.lab;
        window.location.href = `inventory.html?lab=${encodeURIComponent(lab)}`;
    } else {
        renderCurrentInventory();
        initDashboard();
    }
}

async function restoreDeletedRows(table, rows, key) {
    if (!rows.length) return true;
    const {error} = await supabaseClient.from(table).upsert(rows, {onConflict: key});
    if (error) console.error(`Could not restore ${table}:`, error);
    return !error;
}

/* ============================================================
   MATERIAL DETAILS
   ============================================================ */

async function initMaterial() {
    const id = new URLSearchParams(location.search).get("id");
    await refreshMaterialRecord(id);
    await refreshMaterialTransactions(id);

    // IMPORTANT: never render the raw material row here. For reusable
    // equipment, getMaterials() reconciles Available / Issued / Damaged
    // from the actual transaction history. Rendering the raw Supabase row
    // was the reason Physics/Biology could show 12 available / 0 issued
    // even though the History table showed an Issue transaction.
    await reconcileReusableMaterialCounts();
    const material = getMaterials().find(
        item => item.id === id && item.status !== "deleted"
    );

    const container = document.getElementById("materialDetailsContainer");

    if (!material) {
        if (container) container.innerHTML = `<div class="empty-state"><h3>Material not found</h3><p>The requested material does not exist.</p><a class="card-action" href="dashboard.html">Return to Dashboard</a></div>`;
        return;
    }

    document.title = `${material.name} - Lab Inventory`;
    setText("materialPageTitle", material.name);
    const back = document.getElementById("backToInventory");
    if (back) back.href = `inventory.html?lab=${encodeURIComponent(material.lab)}`;

    setupMaterialForms(material);
    renderMaterialDetails(material);
}

function renderMaterialDetails(material) {
    const container = document.getElementById("materialDetailsContainer");
    if (!container) return;

    const reusableStats = material.type === "reusable" ? getReusableStats(material) : null;
    const stock = reusableStats ? reusableStats.available : stockValue(material);
    const low = isLowStock(material);
    const transactions = getTransactions()
        .filter(t => t.materialId === material.id)
        .slice(-12)
        .reverse();

    const openIssues = material.type === "reusable" ? getOpenIssueTransactions(material.id) : [];

    const actionButtons = material.type === "reusable"
        ? `
            <button class="primary-button" onclick="openIssueModal()">Issue / Usage</button>
            <button class="secondary-button" onclick="openReturnModal()" ${openIssues.length ? "" : ""}>Return Equipment</button>
            <button class="danger-button" onclick="openDamageModal()">Damage Report</button>
        `
        : `
            <button class="primary-button" onclick="openUsageModal()">Usage Report</button>
            <button class="secondary-button" onclick="openAddStockModal()">Add Quantity</button>
            <button class="secondary-button" onclick="openOrderForMaterial()">Create Order</button>
            <button class="danger-button" onclick="openDamageModal()">Damage Report</button>
        `;

    const batchRows = material.batches
        .filter(batch => Number(batch.quantityRemaining) > 0)
        .map(batch => `<tr><td>${escapeHTML(batch.batchId)}</td><td>${formatDate(batch.dateAdded)}</td><td>${quantityHTML(batch.quantityRemaining, material.unit)}</td><td>${escapeHTML(expiryText(batch.expiryDate))}</td></tr>`)
        .join("");

    const batchHTML = material.type === "consumable"
        ? `<div class="panel mt-20"><div class="section-heading"><p>Stock Batches</p><h2>Expiry Tracking</h2></div><div class="table-container"><table><thead><tr><th>Batch</th><th>Added</th><th>Remaining</th><th>Expiry</th></tr></thead><tbody>${batchRows || `<tr><td colspan="4">No active batches.</td></tr>`}</tbody></table></div></div>`
        : "";

    container.innerHTML = `
        <section class="material-details-card">
            <div class="detail-header">
                <div>
                    <span class="type-badge">${escapeHTML(typeName(material.type))}</span>
                    <h2>${escapeHTML(material.name)}</h2>
                    <p>${escapeHTML(material.category)} · ${escapeHTML(labName(material.lab))}</p>
                </div>
                <div class="detail-header-actions">
                    <button class="secondary-button" onclick="editMaterialFromDetails()">Edit</button>
                    <button class="danger-outline-button" onclick="deleteMaterial('${escapeHTML(material.id)}')">Delete</button>
                </div>
            </div>

            <div class="details-grid">
                <div class="detail-item"><span>Material ID</span><strong>${escapeHTML(material.id)}</strong></div>
                <div class="detail-item"><span>Unit</span><strong>${escapeHTML(material.unit)}</strong></div>
                <div class="detail-item"><span>Available</span><strong>${quantityHTML(stock, material.unit)}</strong></div>
                <div class="detail-item"><span>Minimum Stock</span><strong>${quantityHTML(material.minimumStock, material.unit)}</strong></div>
                <div class="detail-item"><span>Stock Status</span><strong class="${low ? "text-danger" : "text-success"}">${low ? "Low Stock" : "Healthy"}</strong></div>
                ${material.type === "reusable" ? `
                    <div class="detail-item"><span>Total Quantity</span><strong>${quantityHTML(reusableStats.total, material.unit)}</strong></div>
                    <div class="detail-item"><span>Currently Issued</span><strong>${quantityHTML(reusableStats.issued, material.unit)}</strong></div>
                    <div class="detail-item"><span>Damaged</span><strong>${quantityHTML(reusableStats.damaged, material.unit)}</strong></div>
                ` : `
                    <div class="detail-item"><span>Expiry</span><strong>${escapeHTML(expiryText(material.expiryDate))}</strong></div>
                `}
            </div>

            <div class="material-actions">${actionButtons}</div>
        </section>

        ${batchHTML}

        <section class="panel mt-20">
            <div class="section-heading"><p>History</p><h2>Recent Activity</h2></div>
            <div class="table-container"><table><thead><tr><th>Date</th><th>Activity</th><th>Qty</th><th>Teacher</th><th>Status</th><th>Remarks</th></tr></thead><tbody>
                ${transactions.length ? transactions.map(t => `<tr><td>${formatDate(t.date)} ${escapeHTML(t.time || "")}</td><td>${escapeHTML(activityLabel(t.type))}</td><td>${quantityHTML(t.quantity, material.unit)}</td><td>${escapeHTML(t.teacher || "—")}</td><td>${escapeHTML(transactionStatusLabel(t, material.id))}</td><td>${escapeHTML(t.remarks || "—")}</td></tr>`).join("") : `<tr><td colspan="6">No activity recorded yet.</td></tr>`}
            </tbody></table></div>
        </section>
    `;
}

function currentMaterial() {
    const id = new URLSearchParams(location.search).get("id");
    return getMaterials().find(m => m.id === id && m.status !== "deleted");
}

function editMaterialFromDetails() {
    const m = currentMaterial();
    if (!m) return;

    // Open the existing, fully wired edit form on the inventory page, but
    // remember where the user came from so a successful save returns directly
    // to this material's details page.
    const returnTo = `material.html?id=${encodeURIComponent(m.id)}`;
    window.location.href = `inventory.html?lab=${encodeURIComponent(m.lab)}&edit=${encodeURIComponent(m.id)}&returnTo=${encodeURIComponent(returnTo)}`;
}

/* ============================================================
   MATERIAL MODALS
   ============================================================ */

function setupMaterialForms() {
    ["issueDate", "returnDate", "usageDate", "stockAddDate", "damageDate"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = todayISO();
    });

    ["issueTime", "returnTime", "damageTime"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = timeNow();
    });

    const expected = document.getElementById("expectedReturnDate");
    if (expected) expected.value = addDays(todayISO(), 3);

    bindFormOnce("issueForm", "submit", submitIssue);
    bindFormOnce("returnForm", "submit", submitReturn);
    bindFormOnce("returnIssueSelect", "change", handleReturnIssueChange);
    bindFormOnce("damageForm", "submit", submitDamage);
    bindFormOnce("damageIssueSelect", "change", handleDamageIssueChange);
    bindFormOnce("usageForm", "submit", submitUsage);
    bindFormOnce("addStockForm", "submit", submitAddStock);
    bindFormOnce("stockExpiryIndefinite", "change", updateStockExpiryVisibility);
    populateDamageIssueDropdown();
}

function bindFormOnce(id, eventName, handler) {
    const el = document.getElementById(id);
    if (!el || el.dataset[`bound_${eventName}`] === "true") return;
    el.addEventListener(eventName, handler);
    el.dataset[`bound_${eventName}`] = "true";
}

function openModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
}

function closeModal(id) {
    document.getElementById(id)?.classList.add("hidden");
}

function openIssueModal() {
    const m = currentMaterial();
    clearError(document.getElementById("issueError"));
    const quantity = document.getElementById("issueQuantity");
    if (quantity) quantity.max = String(Math.floor(stockValue(m || {type:"reusable", availableQuantity:0})));
    openModal("issueModal");
}

function getOpenIssueTransactions(materialId) {
    return getTransactions()
        .filter(t => t.materialId === materialId && t.type === "issue" && t.status === "Not Returned" && finiteNumber(t.quantity, 0) > 0)
        .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")) || String(a.time || "").localeCompare(String(b.time || "")));
}

function populateReturnIssueDropdown() {
    const select = document.getElementById("returnIssueSelect");
    const teacher = document.getElementById("returnTeacher");
    const quantity = document.getElementById("returnQuantity");
    const error = document.getElementById("returnError");
    const m = currentMaterial();
    if (!select || !m) return;

    const issues = getOpenIssueTransactions(m.id);
    select.innerHTML = issues.length
        ? `<option value="">Select an issued equipment record</option>${issues.map(t => `<option value="${escapeHTML(t.id)}" data-teacher="${escapeHTML(t.teacher || "")}" data-quantity="${finiteNumber(t.quantity, 0)}">${escapeHTML(t.teacher || "Unknown teacher")} — ${quantityHTML(t.quantity, m.unit)} — issued ${formatDate(t.date)}</option>`).join("")}`
        : `<option value="">No equipment is currently issued</option>`;

    if (teacher) teacher.value = "";
    if (quantity) {
        quantity.value = issues.length ? "1" : "";
        quantity.max = issues.length ? String(finiteNumber(issues[0].quantity, 0)) : "";
        quantity.disabled = !issues.length;
    }

    if (!issues.length) showError(error, "There are no outstanding equipment issues to return.");
    else clearError(error);
}

function handleReturnIssueChange() {
    const select = document.getElementById("returnIssueSelect");
    const teacher = document.getElementById("returnTeacher");
    const quantity = document.getElementById("returnQuantity");
    const error = document.getElementById("returnError");
    const option = select?.selectedOptions?.[0];

    if (!option?.value) {
        if (teacher) teacher.value = "";
        if (quantity) {
            quantity.value = "";
            quantity.removeAttribute("max");
            quantity.disabled = true;
        }
        return;
    }

    const issuedQty = finiteNumber(option.dataset.quantity, 0);
    if (teacher) teacher.value = option.dataset.teacher || "";
    if (quantity) {
        quantity.max = String(issuedQty);
        quantity.value = issuedQty > 0 ? "1" : "";
        quantity.disabled = false;
    }
    clearError(error);
}

function openReturnModal() {
    populateReturnIssueDropdown();
    openModal("returnModal");
}

function populateDamageIssueDropdown() {
    const select = document.getElementById("damageIssueSelect");
    const group = document.getElementById("damageIssueGroup");
    const teacher = document.getElementById("damageTeacher");
    const quantity = document.getElementById("damageQuantity");
    const m = currentMaterial();
    if (!select || !m) return;

    const reusable = m.type === "reusable";
    const issues = reusable ? getOpenIssueTransactions(m.id) : [];

    if (!reusable) {
        if (group) group.classList.add("hidden");
        if (teacher) teacher.readOnly = false;
        if (quantity) quantity.max = String(stockValue(m));
        return;
    }

    if (group) group.classList.remove("hidden");
    select.innerHTML = `<option value="">From available stock</option>${issues.map(t => `<option value="${escapeHTML(t.id)}" data-teacher="${escapeHTML(t.teacher || "")}" data-quantity="${finiteNumber(t.quantity, 0)}">${escapeHTML(t.teacher || "Unknown teacher")} — ${quantityHTML(t.quantity, m.unit)} — issued ${formatDate(t.date)}</option>`).join("")}`;
    if (teacher) teacher.readOnly = false;
    if (quantity) {
        quantity.max = String(Math.max(0, Math.floor(stockValue(m))));
        quantity.value = "1";
    }
}

function handleDamageIssueChange() {
    const select = document.getElementById("damageIssueSelect");
    const teacher = document.getElementById("damageTeacher");
    const quantity = document.getElementById("damageQuantity");
    const option = select?.selectedOptions?.[0];

    if (!option?.value) {
        if (teacher) {
            teacher.value = "";
            teacher.readOnly = false;
        }
        const m = currentMaterial();
        if (quantity) quantity.max = String(m ? Math.floor(stockValue(m)) : 0);
        return;
    }

    const issuedQty = finiteNumber(option.dataset.quantity, 0);
    if (teacher) {
        teacher.value = option.dataset.teacher || "";
        teacher.readOnly = true;
    }
    if (quantity) {
        quantity.max = String(Math.floor(issuedQty));
        quantity.value = issuedQty > 0 ? "1" : "";
    }
}

function openDamageModal() {
    clearError(document.getElementById("damageError"));
    populateDamageIssueDropdown();
    openModal("damageModal");
}

function openUsageModal() {
    clearError(document.getElementById("usageError"));
    openModal("usageModal");
}

function openAddStockModal() {
    clearError(document.getElementById("stockAddError"));
    const date = document.getElementById("stockAddDate");
    if (date) date.value = todayISO();
    const indefinite = document.getElementById("stockExpiryIndefinite");
    if (indefinite) indefinite.checked = false;
    updateStockExpiryVisibility();
    openModal("addStockModal");
}

function updateStockExpiryVisibility() {
    const input = document.getElementById("stockExpiry");
    const indefinite = document.getElementById("stockExpiryIndefinite")?.checked;
    if (!input) return;
    input.required = !indefinite;
    input.disabled = !!indefinite;
}

async function submitIssue(event) {
    event.preventDefault();
    const m = currentMaterial();
    if (!m || m.type !== "reusable") return;

    const qty = finiteNumber(document.getElementById("issueQuantity")?.value, NaN);
    const teacher = document.getElementById("issueTeacher")?.value.trim();
    const available = stockValue(m);
    const error = document.getElementById("issueError");

    if (!teacher) return showError(error, "Enter the teacher's name.");
    if (!Number.isInteger(qty) || qty <= 0 || qty > available) return showError(error, `Only ${quantityHTML(available, m.unit)} are available.`);

    const materials = getMaterials();
    const target = materials.find(item => item.id === m.id);
    const original = clone(target);

    target.availableQuantity -= qty;
    target.issuedQuantity += qty;
    target.totalQuantity = target.availableQuantity + target.issuedQuantity + target.damagedQuantity;
    target.quantity = target.availableQuantity;

    if (!await saveMaterialRecord(target)) {
        return showError(error, "The equipment could not be issued. Please try again.");
    }

    const issue = {
        id: generateId("TX"),
        createdAt: new Date().toISOString(),
        type: "issue",
        materialId: target.id,
        lab: target.lab,
        date: document.getElementById("issueDate").value,
        time: document.getElementById("issueTime").value,
        teacher,
        quantity: qty,
        expectedReturnDate: document.getElementById("expectedReturnDate").value,
        status: "Not Returned",
        remarks: document.getElementById("issueRemarks").value.trim()
    };

    if (!await insertTransaction(issue)) {
        await saveMaterialRecord(original);
        return showError(error, "The issue record could not be saved. The stock change was rolled back.");
    }

    // Re-read both tables after an issue. This makes the database the
    // source of truth and guarantees the Available/Issued figures shown
    // on the detail page and inventory cards are the values actually
    // persisted in Supabase.
    await refreshMaterialRecord(target.id);
    await refreshMaterialTransactions(target.id);
    await reconcileReusableMaterialCounts();

    closeModal("issueModal");
    await initMaterial();
}

async function submitReturn(event) {
    event.preventDefault();
    const m = currentMaterial();
    if (!m || m.type !== "reusable") return;

    const issueId = document.getElementById("returnIssueSelect")?.value;
    const qty = finiteNumber(document.getElementById("returnQuantity")?.value, NaN);
    const error = document.getElementById("returnError");
    const transactions = getTransactions();
    const issue = transactions.find(t => t.id === issueId && t.materialId === m.id && t.type === "issue" && t.status === "Not Returned" && finiteNumber(t.quantity, 0) > 0);

    if (!issue) return showError(error, "Select an equipment issue to return.");

    const outstanding = finiteNumber(issue.quantity, 0);
    if (!Number.isInteger(qty) || qty <= 0 || qty > outstanding) {
        return showError(error, `This issue has ${quantityHTML(outstanding, m.unit)} outstanding.`);
    }

    const materials = getMaterials();
    const target = materials.find(item => item.id === m.id);
    const originalMaterial = clone(target);
    const originalIssue = clone(issue);

    target.availableQuantity += qty;
    target.issuedQuantity = Math.max(0, target.issuedQuantity - qty);
    target.totalQuantity = target.availableQuantity + target.issuedQuantity + target.damagedQuantity;
    target.quantity = target.availableQuantity;

    issue.quantity = Math.max(0, outstanding - qty);
    if (issue.quantity === 0) {
        issue.status = "Returned";
        issue.actualReturnDate = document.getElementById("returnDate").value;
    }

    if (!await saveMaterialRecord(target)) return showError(error, "The equipment return could not be saved. Please try again.");
    if (!await updateTransaction(issue)) {
        await saveMaterialRecord(originalMaterial);
        return showError(error, "The return could not update the original issue record. The change was rolled back.");
    }

    const returnTransaction = {
        id: generateId("TX"),
        createdAt: new Date().toISOString(),
        type: "return",
        materialId: m.id,
        lab: m.lab,
        date: document.getElementById("returnDate").value,
        time: document.getElementById("returnTime").value,
        teacher: issue.teacher || document.getElementById("returnTeacher").value.trim(),
        quantity: qty,
        status: "Returned",
        issuedTo: issue.id,
        remarks: document.getElementById("returnRemarks").value.trim()
    };

    if (!await insertTransaction(returnTransaction)) {
        await updateTransaction(originalIssue);
        await saveMaterialRecord(originalMaterial);
        return showError(error, "The return record could not be saved. The change was rolled back.");
    }

    closeModal("returnModal");
    await initMaterial();
}

async function submitDamage(event) {
    event.preventDefault();
    const m = currentMaterial();
    if (!m) return;

    const qty = finiteNumber(document.getElementById("damageQuantity")?.value, NaN);
    const error = document.getElementById("damageError");
    const issueId = document.getElementById("damageIssueSelect")?.value || "";
    const transactions = getTransactions();
    const issue = issueId
        ? transactions.find(t => t.id === issueId && t.materialId === m.id && t.type === "issue" && t.status === "Not Returned" && finiteNumber(t.quantity, 0) > 0)
        : null;

    const damageLimit = issue ? finiteNumber(issue.quantity, 0) : stockValue(m);
    const integerRequired = m.type === "reusable";

    if (integerRequired && (!Number.isInteger(qty) || qty <= 0)) return showError(error, "Reusable equipment damage must be a whole number.");
    if (!integerRequired && (qty <= 0 || !Number.isFinite(qty))) return showError(error, "Enter a valid damage quantity.");
    if (qty > damageLimit) return showError(error, `Only ${quantityHTML(damageLimit, m.unit)} can be reported as damaged from this source.`);
    if (issueId && !issue) return showError(error, "The selected issued equipment record is no longer available.");

    const teacherInput = document.getElementById("damageTeacher")?.value.trim() || "";
    if (!teacherInput && !issue) return showError(error, "Enter the teacher's name.");

    const materials = getMaterials();
    const target = materials.find(item => item.id === m.id);
    const originalMaterial = clone(target);
    const originalIssue = issue ? clone(issue) : null;

    if (target.type === "reusable") {
        if (issue) {
            target.issuedQuantity = Math.max(0, target.issuedQuantity - qty);
            target.damagedQuantity += qty;
            target.totalQuantity = target.availableQuantity + target.issuedQuantity + target.damagedQuantity;
            target.quantity = target.availableQuantity;
            issue.quantity = Math.max(0, issue.quantity - qty);
            if (issue.quantity === 0) {
                issue.status = "Damaged";
                issue.actualReturnDate = document.getElementById("damageDate").value;
            }
        } else {
            target.availableQuantity = Math.max(0, target.availableQuantity - qty);
            target.damagedQuantity += qty;
            target.totalQuantity = target.availableQuantity + target.issuedQuantity + target.damagedQuantity;
            target.quantity = target.availableQuantity;
        }
    } else {
        target.quantity = Math.max(0, target.quantity - qty);
        target.availableQuantity = target.quantity;
        target.totalQuantity = target.quantity;
        target.damagedQuantity += qty;
        reduceBatches(target, qty);
    }

    if (!await saveMaterialRecord(target)) return showError(error, "The damage report could not be saved. Please try again.");

    if (issue && !await updateTransaction(issue)) {
        await saveMaterialRecord(originalMaterial);
        return showError(error, "The related issue record could not be updated. The damage change was rolled back.");
    }

    const damage = {
        id: generateId("TX"),
        createdAt: new Date().toISOString(),
        type: "damage",
        materialId: target.id,
        lab: target.lab,
        date: document.getElementById("damageDate").value,
        time: document.getElementById("damageTime").value,
        teacher: teacherInput || issue?.teacher || "",
        quantity: qty,
        status: "Damaged",
        issuedTo: issue?.id || null,
        remarks: document.getElementById("damageRemarks").value.trim()
    };

    if (!damage.teacher) {
        if (issue) damage.teacher = issue.teacher || "";
        if (!damage.teacher) {
            await saveMaterialRecord(originalMaterial);
            if (originalIssue) await updateTransaction(originalIssue);
            return showError(error, "Enter the teacher's name.");
        }
    }

    if (!await insertTransaction(damage)) {
        await saveMaterialRecord(originalMaterial);
        if (originalIssue) await updateTransaction(originalIssue);
        return showError(error, "The damage report could not be saved. The change was rolled back.");
    }

    closeModal("damageModal");
    await initMaterial();
}

async function submitUsage(event) {
    event.preventDefault();
    const m = currentMaterial();
    if (!m || m.type !== "consumable") return;

    const qty = finiteNumber(document.getElementById("usageQuantity")?.value, NaN);
    const error = document.getElementById("usageError");
    const teacher = document.getElementById("usageTeacher")?.value.trim();
    const available = stockValue(m);

    if (!teacher) return showError(error, "Enter the teacher's name.");
    if (!(qty > 0) || qty > available) return showError(error, `Available: ${quantityHTML(available, m.unit)}.`);

    const materials = getMaterials();
    const target = materials.find(item => item.id === m.id);
    const original = clone(target);

    target.quantity = Math.max(0, target.quantity - qty);
    target.availableQuantity = target.quantity;
    target.totalQuantity = target.quantity;
    reduceBatches(target, qty);

    if (!await saveMaterialRecord(target)) return showError(error, "The usage could not be saved. Please try again.");

    const usage = {
        id: generateId("TX"),
        createdAt: new Date().toISOString(),
        type: "usage",
        materialId: target.id,
        lab: target.lab,
        date: document.getElementById("usageDate").value,
        time: timeNow(),
        teacher,
        quantity: qty,
        status: "Used",
        remarks: document.getElementById("usageRemarks").value.trim()
    };

    if (!await insertTransaction(usage)) {
        await saveMaterialRecord(original);
        return showError(error, "The usage record could not be saved. The stock change was rolled back.");
    }

    closeModal("usageModal");
    await initMaterial();
}

async function submitAddStock(event) {
    event.preventDefault();
    const m = currentMaterial();
    if (!m || m.type !== "consumable") return;

    const qty = finiteNumber(document.getElementById("stockAddQuantity")?.value, NaN);
    const date = document.getElementById("stockAddDate")?.value || todayISO();
    const indefinite = document.getElementById("stockExpiryIndefinite")?.checked;
    const expiry = indefinite ? null : (document.getElementById("stockExpiry")?.value || null);
    const remarks = document.getElementById("stockRemarks")?.value.trim() || "";
    const error = document.getElementById("stockAddError");

    if (!(qty > 0)) return showError(error, "Enter a valid quantity.");
    if (!indefinite && !expiry) return showError(error, "Choose an expiry date or select indefinite expiry.");

    const materials = getMaterials();
    const target = materials.find(item => item.id === m.id);
    const original = clone(target);
    target.quantity += qty;
    target.availableQuantity = target.quantity;
    target.totalQuantity = target.quantity;
    target.batches = Array.isArray(target.batches) ? target.batches : [];
    target.batches.push({
        batchId: `${target.id}-B${String(target.batches.length + 1).padStart(2, "0")}`,
        dateAdded: date,
        quantityAdded: qty,
        quantityRemaining: qty,
        expiryDate: expiry
    });
    sortBatches(target.batches);
    target.expiryDate = earliestExpiry(target.batches) || null;

    if (!await saveMaterialRecord(target)) return showError(error, "The new stock could not be saved. Please try again.");

    const stockTransaction = {
        id: generateId("TX"),
        createdAt: new Date().toISOString(),
        type: "add_stock",
        materialId: target.id,
        lab: target.lab,
        date,
        time: timeNow(),
        teacher: "Lab Assistant",
        quantity: qty,
        status: "Added",
        remarks
    };

    if (!await insertTransaction(stockTransaction)) {
        await saveMaterialRecord(original);
        return showError(error, "The stock was saved but its activity record failed. The change was rolled back.");
    }

    closeModal("addStockModal");
    await initMaterial();
}

function reduceBatches(material, quantity) {
    if (!Array.isArray(material.batches)) return;

    let remaining = quantity;
    sortBatches(material.batches);

    for (const batch of material.batches) {
        if (remaining <= 0) break;
        const take = Math.min(finiteNumber(batch.quantityRemaining, 0), remaining);
        batch.quantityRemaining = Math.max(0, finiteNumber(batch.quantityRemaining, 0) - take);
        remaining -= take;
    }

    material.batches = material.batches.filter(batch => finiteNumber(batch.quantityRemaining, 0) > 0);
    material.expiryDate = earliestExpiry(material.batches);
}

/* ============================================================
   TRANSACTION HELPERS
   ============================================================ */

async function addTransaction(transaction) {
    return insertTransaction({
        id: transaction.id || generateId("TX"),
        createdAt: transaction.createdAt || new Date().toISOString(),
        ...transaction
    });
}

function activityLabel(type) {
    const labels = {
        usage: "Consumable Used",
        issue: "Equipment Issued",
        return: "Equipment Returned",
        damage: "Damage Report",
        add_stock: "Stock Added",
        stock_adjustment: "Stock Adjusted"
    };
    return labels[type] || type;
}

function transactionStatusLabel(transaction) {
    if (transaction.type === "issue" && transaction.status === "Not Returned") return "Not Returned";
    if (transaction.type === "issue" && transaction.status === "Returned") return "Returned";
    return transaction.status || "Completed";
}

/* ============================================================
   ORDERS
   ============================================================ */

function initOrders() {
    const date = document.getElementById("orderDate");
    if (date && !date.value) date.value = todayISO();

    populateOrderMaterials();
    renderOrders();

    const requestedMaterial = new URLSearchParams(location.search).get("material");
    if (requestedMaterial) {
        const select = document.getElementById("orderMaterial");
        if (select) select.value = requestedMaterial;
    }
}

function populateOrderMaterials() {
    const select = document.getElementById("orderMaterial");
    if (!select) return;

    const consumables = getMaterials().filter(m => m.type === "consumable" && m.status !== "deleted");
    select.innerHTML = consumables.length
        ? `<option value="">Select material</option>${consumables.map(m => `<option value="${escapeHTML(m.id)}">${escapeHTML(m.name)} (${escapeHTML(labName(m.lab))})</option>`).join("")}`
        : `<option value="">No consumable materials</option>`;
}

async function createOrder() {
    const materialId = document.getElementById("orderMaterial")?.value;
    const quantity = finiteNumber(document.getElementById("orderQuantity")?.value, NaN);
    const date = document.getElementById("orderDate")?.value || todayISO();
    const error = document.getElementById("orderFormError");

    clearError(error);
    if (!materialId || !(quantity > 0) || !Number.isFinite(quantity)) return showError(error, "Select a material and enter a valid quantity.");

    const material = getMaterials().find(m => m.id === materialId && m.status !== "deleted");
    if (!material) return showError(error, "Material not found.");

    const order = {
        id: generateId("ORD"),
        materialId,
        quantity,
        orderDate: date,
        status: "To be ordered",
        receivedQty: 0,
        receivedDate: null,
        createdAt: new Date().toISOString()
    };

    if (!await insertOrder(order)) return showError(error, "The order could not be saved. Please try again.");

    document.getElementById("orderQuantity").value = "";
    renderOrders();
}

function renderOrders() {
    const body = document.getElementById("ordersTableBody");
    if (!body) return;

    const materials = getMaterials();
    const orders = getOrders().slice().reverse();

    body.innerHTML = orders.length
        ? orders.map(order => {
            const material = materials.find(m => m.id === order.materialId);
            const statusClass = String(order.status || "").toLowerCase().replace(/[^a-z]+/g, "-");
            return `
                <tr>
                    <td>${escapeHTML(order.id)}</td>
                    <td>${escapeHTML(material?.name || "Deleted material")}</td>
                    <td>${quantityHTML(order.quantity, material?.unit || "")}</td>
                    <td>${formatDate(order.orderDate)}</td>
                    <td><span class="order-status status-${escapeHTML(statusClass)}">${escapeHTML(order.status)}</span></td>
                    <td>${order.receivedDate ? formatDate(order.receivedDate) : "—"}</td>
                    <td>${order.status !== "Received"
                        ? `<select class="status-select" onchange="changeOrderStatus('${escapeHTML(order.id)}', this.value)"><option value="To be ordered" ${order.status === "To be ordered" ? "selected" : ""}>To be ordered</option><option value="Ordered" ${order.status === "Ordered" ? "selected" : ""}>Ordered</option><option value="Received" ${order.status === "Received" ? "selected" : ""}>Received</option></select>`
                        : `<span class="text-success">Completed</span>`}</td>
                </tr>
            `;
        }).join("")
        : `<tr><td colspan="7">No orders recorded.</td></tr>`;
}

async function changeOrderStatus(orderId, status) {
    const orders = getOrders();
    const order = orders.find(item => item.id === orderId);
    if (!order || order.status === "Received") return;

    if (status === "Received") {
        await receiveOrder(order);
        return;
    }

    const original = clone(order);
    order.status = status;
    if (!await updateOrder(order)) {
        alert("The order status could not be saved.");
        const select = document.querySelector(`select.status-select[onchange*="${orderId}"]`);
        if (select) select.value = original.status;
        return;
    }
    renderOrders();
}

async function receiveOrder(order) {
    const materials = getMaterials();
    const material = materials.find(m => m.id === order.materialId && m.status !== "deleted");
    if (!material) {
        alert("The material for this order no longer exists.");
        return;
    }

    const input = prompt(
        `Enter expiry date for the received batch for ${material.name}.\n\nUse YYYY-MM-DD, or type INDEFINITE for no expiry.`,
        material.expiryDate || ""
    );
    if (input === null) return;

    const expiry = parseExpiryInput(input);
    if (expiry === undefined) {
        alert("Invalid expiry. Use YYYY-MM-DD or INDEFINITE.");
        return;
    }

    const originalMaterial = clone(material);
    const originalOrder = clone(order);
    const qty = finiteNumber(order.quantity, 0);

    material.quantity += qty;
    material.availableQuantity = material.quantity;
    material.totalQuantity = material.quantity;
    material.batches = Array.isArray(material.batches) ? material.batches : [];
    material.batches.push({
        batchId: `${material.id}-B${String(material.batches.length + 1).padStart(2, "0")}`,
        dateAdded: todayISO(),
        quantityAdded: qty,
        quantityRemaining: qty,
        expiryDate: expiry
    });
    sortBatches(material.batches);
    material.expiryDate = earliestExpiry(material.batches) || null;

    order.status = "Received";
    order.receivedQty = qty;
    order.receivedDate = todayISO();

    if (!await saveMaterialRecord(material)) {
        alert("The received stock could not be saved.");
        return;
    }

    if (!await updateOrder(order)) {
        await saveMaterialRecord(originalMaterial);
        alert("The order status could not be saved. The stock change was rolled back.");
        return;
    }

    const transaction = {
        id: generateId("TX"),
        createdAt: new Date().toISOString(),
        type: "add_stock",
        materialId: material.id,
        lab: material.lab,
        date: todayISO(),
        time: timeNow(),
        teacher: "Lab Assistant",
        quantity: qty,
        status: "Order Received",
        remarks: `Received order ${order.id}`
    };

    if (!await insertTransaction(transaction)) {
        await saveMaterialRecord(originalMaterial);
        await updateOrder(originalOrder);
        alert("The order was not fully recorded. The stock change was rolled back.");
        return;
    }

    renderOrders();
}

function openOrderForMaterial() {
    const m = currentMaterial();
    if (!m) return;
    window.location.href = `orders.html?material=${encodeURIComponent(m.id)}`;
}

/* ============================================================
   REPORTS
   ============================================================ */

function initReports() {
    bindFormOnce("reportLabFilter", "change", renderReports);
    bindFormOnce("reportTypeFilter", "change", renderReports);
    renderReports();
}

function renderReports() {
    const body = document.getElementById("reportsTableBody");
    if (!body) return;

    const labFilter = document.getElementById("reportLabFilter")?.value || "all";
    const typeFilter = document.getElementById("reportTypeFilter")?.value || "all";
    const materials = getMaterials();
    let transactions = getTransactions().slice().reverse();

    if (labFilter !== "all") transactions = transactions.filter(t => t.lab === labFilter);
    if (typeFilter !== "all") transactions = transactions.filter(t => t.type === typeFilter);

    const usageCount = transactions.filter(t => t.type === "usage").length;
    const damageCount = transactions.filter(t => t.type === "damage").length;
    const issueCount = transactions.filter(t => t.type === "issue").length;

    setText("reportTransactionCount", transactions.length);
    setText("reportUsageCount", usageCount);
    setText("reportDamageCount", damageCount);
    setText("reportIssueCount", issueCount);

    body.innerHTML = transactions.length
        ? transactions.map(t => {
            const m = materials.find(x => x.id === t.materialId);
            return `<tr>
                <td>${formatDate(t.date)} ${escapeHTML(t.time || "")}</td>
                <td>${escapeHTML(m?.name || t.materialId || "Deleted material")}</td>
                <td>${escapeHTML(labName(t.lab))}</td>
                <td>${escapeHTML(activityLabel(t.type))}</td>
                <td>${quantityHTML(t.quantity, m?.unit || "")}</td>
                <td>${escapeHTML(t.teacher || "—")}</td>
                <td>${escapeHTML(t.remarks || "—")}</td>
            </tr>`;
        }).join("")
        : `<tr><td colspan="7">No transactions match the selected filters.</td></tr>`;
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */

function buildNotifications() {
    const materials = getMaterials().filter(m => m.status !== "deleted");
    const transactions = getTransactions();
    const orders = getOrders();
    const notifications = [];

    materials.forEach(m => {
        if (isLowStock(m)) {
            notifications.push({
                level: "warning",
                icon: "⚠️",
                title: "Low stock",
                text: `${m.name} has ${quantityText(stockValue(m), m.unit)} available; minimum is ${quantityText(m.minimumStock, m.unit)}.`
            });
        }

        if (m.type === "consumable" && m.expiryDate) {
            const days = daysUntil(m.expiryDate);
            if (days < 0) {
                notifications.push({
                    level: "danger",
                    icon: "🔴",
                    title: "Expired chemical/material",
                    text: `${m.name} expired on ${formatDate(m.expiryDate)}.`
                });
            } else if (days <= 30) {
                notifications.push({
                    level: "warning",
                    icon: "⏳",
                    title: "Expiry approaching",
                    text: `${m.name} expires on ${formatDate(m.expiryDate)}.`
                });
            }
        }
    });

    transactions
        .filter(t => t.type === "issue" && t.status === "Not Returned" && finiteNumber(t.quantity, 0) > 0)
        .forEach(t => {
            if (t.expectedReturnDate && t.expectedReturnDate < todayISO()) {
                const m = materials.find(x => x.id === t.materialId);
                notifications.push({
                    level: "danger",
                    icon: "🚨",
                    title: "Equipment overdue",
                    text: `${m?.name || t.materialId}: ${quantityText(t.quantity, m?.unit || "")} issued to ${t.teacher || "teacher"} was due back on ${formatDate(t.expectedReturnDate)}.`
                });
            }
        });

    orders
        .filter(o => o.status === "Ordered")
        .forEach(o => {
            const m = materials.find(x => x.id === o.materialId);
            notifications.push({
                level: "info",
                icon: "📦",
                title: "Order awaiting receipt",
                text: `${quantityText(o.quantity, m?.unit || "")} of ${m?.name || o.materialId} is ordered but not yet received.`
            });
        });

    const recentCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);
    transactions
        .filter(t => t.type === "add_stock" && t.status === "Order Received" && Date.parse(t.createdAt || "") >= recentCutoff)
        .slice(-3)
        .reverse()
        .forEach(t => {
            const m = materials.find(x => x.id === t.materialId);
            notifications.push({
                level: "info",
                icon: "✅",
                title: "Order received",
                text: `${quantityText(t.quantity, m?.unit || "")} of ${m?.name || t.materialId} was received on ${formatDate(t.date)}.`
            });
        });

    return notifications;
}

function quantityText(quantity, unit) {
    return `${number(quantity)} ${unitLabel(quantity, unit)}`.trim();
}

function initNotifications() {
    renderNotifications();
}

function renderNotifications() {
    const container = document.getElementById("notificationsContainer");
    if (!container) return;

    const notifications = buildNotifications();
    container.innerHTML = notifications.length
        ? notifications.map(notificationHTML).join("")
        : emptyNotificationHTML();
}

function notificationHTML(n) {
    return `<article class="notification-item notification-${escapeHTML(n.level)}">
        <div class="notification-icon">${n.icon}</div>
        <div><strong>${escapeHTML(n.title)}</strong><p>${escapeHTML(n.text)}</p></div>
    </article>`;
}

function emptyNotificationHTML() {
    return `<div class="empty-state"><div class="empty-state-icon">✓</div><h3>No active notifications</h3><p>Your inventory currently has no generated alerts.</p></div>`;
}

/* ============================================================
   HELPERS
   ============================================================ */

function showError(element, message) {
    if (!element) return;
    element.textContent = message;
    element.classList.remove("hidden");
}

function clearError(idOrElement) {
    const element = typeof idOrElement === "string" ? document.getElementById(idOrElement) : idOrElement;
    if (!element) return;
    element.textContent = "";
    element.classList.add("hidden");
}

