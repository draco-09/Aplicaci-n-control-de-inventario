/* Gestor de Inventario – validaciones y comportamiento del front (JS básico, sin librerías) */
(function () {
  "use strict";

  // ------------------------------------------------------------ utilidades
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const moneda = (v) => "$ " + Math.round(Number(v) || 0).toLocaleString("es-CO");
  const fechaEs = (iso) => (iso ? iso.split("-").reverse().join("/") : "No aplica");
  const ROLES = { Administrador: "Administrador", Encargado: "Encargado de inventario", Vendedor: "Vendedor" };

  async function api(url, metodo = "GET", cuerpo) {
    try {
      const r = await fetch(url, {
        method: metodo,
        headers: cuerpo ? { "Content-Type": "application/json" } : {},
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        credentials: "same-origin",
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 && !url.endsWith("/login")) { location.href = "/"; }
      return { ok: r.ok, status: r.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: "No se pudo conectar con el servidor." } };
    }
  }

  function abrir(id) {
    const ov = typeof id === "string" ? document.getElementById(id) : id;
    ov.hidden = false;
    const f = $("input:not([disabled]):not([readonly]), select", ov);
    if (f) setTimeout(() => f.focus(), 30);
  }
  function cerrar(ov) { ov.hidden = true; limpiar(ov); }
  function limpiar(ov) {
    $$(".campo.error", ov).forEach((c) => c.classList.remove("error"));
    $$(".err", ov).forEach((e) => (e.textContent = ""));
    $$(".banner[role=alert]", ov).forEach((b) => (b.hidden = true));
  }
  function errorCampo(input, msg) {
    const c = input.closest(".campo");
    c.classList.add("error");
    const e = $(".err", c);
    if (e) e.textContent = msg;
  }
  function bannerError(id, msg) { const b = document.getElementById(id); b.textContent = msg; b.hidden = false; }

  document.addEventListener("click", (ev) => {
    const cierre = ev.target.closest("[data-cerrar]");
    if (cierre) { cerrar(cierre.closest(".overlay")); return; }
    if (ev.target.classList.contains("overlay") && !ev.target.classList.contains("overlay-modal")) cerrar(ev.target);
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape") return;
    const ov = $$(".overlay").filter((o) => !o.hidden).pop();
    if (ov && ov.classList.contains("overlay-modal")) ov.querySelector("[data-v='']")?.click();
    else if (ov) cerrar(ov);
  });

  // Modal genérico (confirmaciones, avisos y resultados). Devuelve el índice del botón pulsado o null.
  function modal({ titulo, sub = "", banner, cuerpo = "", botones }) {
    return new Promise((resolver) => {
      const ov = document.createElement("div");
      ov.className = "overlay overlay-modal centrado";
      ov.innerHTML =
        `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">` +
        `<button type="button" class="cerrar" data-v="" aria-label="Cerrar">×</button><h2>${esc(titulo)}</h2>` +
        (sub ? `<p class="sub">${sub}</p>` : "") +
        (banner ? `<div class="banner ${banner.tipo}">${banner.texto}</div>` : "") +
        `<div class="modal-cuerpo">${cuerpo}</div><div class="modal-acciones">` +
        botones.map((b, i) => `<button type="button" class="btn ${b.clase || "btn-sec"}" data-v="${i}">${esc(b.texto)}</button>`).join("") +
        `</div></div>`;
      document.body.appendChild(ov);
      ov.addEventListener("click", (e) => {
        const b = e.target.closest("[data-v]");
        if (!b) return;
        ov.remove();
        resolver(b.dataset.v === "" ? null : Number(b.dataset.v));
      });
      const ultimo = $$(".btn", ov).pop();
      if (ultimo) ultimo.focus();
    });
  }
  const aviso = (titulo, texto, tipo = "crit", sub = "") =>
    modal({ titulo, sub, banner: { tipo, texto: esc(texto) }, botones: [{ texto: "Entendido", clase: "btn-pri" }] });

  // Filtros de tabla del lado del cliente: inputs con data-f="q|est|cat|desde|hasta"
  function filtroTabla(cuerpoId, pieId, etiqueta) {
    const cuerpo = document.getElementById(cuerpoId);
    const entradas = $$("[data-f]", document.getElementById(cuerpoId).closest("section"));
    function aplicar() {
      let n = 0;
      const total = $$("tr[data-q]", cuerpo).length;
      $$("tr[data-q]", cuerpo).forEach((tr) => {
        let ok = true;
        entradas.forEach((i) => {
          const v = i.value.trim().toLowerCase(), k = i.dataset.f;
          if (!v) return;
          if (k === "q") ok = ok && tr.dataset.q.includes(v);
          else if (k === "desde") ok = ok && tr.dataset.fecha >= i.value;
          else if (k === "hasta") ok = ok && tr.dataset.fecha <= i.value;
          else ok = ok && String(tr.dataset[k]).toLowerCase() === v;
        });
        tr.hidden = !ok;
        if (ok) n++;
      });
      const pie = document.getElementById(pieId);
      if (pie) pie.textContent = n ? `Mostrando ${n} ${etiqueta}` : `No hay ${etiqueta} que coincidan con la búsqueda.`;
    }
    entradas.forEach((i) => i.addEventListener("input", aplicar));
    aplicar();
  }

  // Cierre de sesión (todas las páginas con barra lateral)
  $$("[data-logout]").forEach((b) => b.addEventListener("click", async () => { await api("/logout", "POST"); location.href = "/"; }));

  const pagina = document.body.dataset.pagina;
  const inicio = { login, usuarios, productos, proveedores, entradas, ventas, existencias, alertas }[pagina];
  if (pagina === "entradas" && window.ENTRADA) entradaNueva(); else if (inicio) inicio();

  // ------------------------------------------------------------------ CU-01
  function login() {
    const form = $("#form-login"), err = $("#login-error"), btn = $("#login-btn");
    $("[data-ver-pass]").addEventListener("click", () => { const i = $("#contrasena"); i.type = i.type === "password" ? "text" : "password"; });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      err.hidden = true;
      limpiar(form);
      const correo = form.correo.value.trim(), contrasena = form.contrasena.value;
      if (!correo || !/^\S+@\S+\.\S+$/.test(correo)) return mostrar("Ingresa un correo electrónico válido.");
      if (!contrasena) return mostrar("Ingresa tu contraseña.");
      btn.disabled = true;
      const r = await api("/login", "POST", { correo, contrasena });
      btn.disabled = false;
      if (r.ok) { location.href = "/panel"; return; }
      mostrar(r.data.error || "No se pudo iniciar sesión.");
    });
    function mostrar(t) { err.textContent = t; err.hidden = false; }
  }

  // ------------------------------------------------------------------ CU-02
  function usuarios() {
    const cuerpo = $("#tabla-usuarios"), drawer = $("#drawer-usuario"), form = $("#form-usuario");
    let lista = [], editando = null;

    const nombreDe = (u) => [u.nombre, u.apellido].filter(Boolean).join(" ") || u.correo.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    async function cargar() {
      const r = await api("/usuarios");
      if (!r.ok) { cuerpo.innerHTML = `<tr><td colspan="5" class="vacio">${esc(r.data.error || "No se pudieron cargar los usuarios.")}</td></tr>`; return; }
      lista = r.data.usuarios;
      $("#st-total").textContent = lista.length;
      $("#st-activos").textContent = lista.filter((u) => u.activo).length;
      pintar();
    }
    function pintar() {
      const q = $("#f-q").value.trim().toLowerCase(), rol = $("#f-rol").value, est = $("#f-estado").value;
      const vis = lista.filter((u) =>
        (!q || (nombreDe(u) + " " + u.correo).toLowerCase().includes(q)) && (!rol || u.rol === rol) && (!est || String(u.activo ? 1 : 0) === est));
      cuerpo.innerHTML = vis.length
        ? vis.map((u) => `<tr data-id="${u.id}"><td><strong>${esc(nombreDe(u))}</strong></td><td>${esc(u.correo)}</td><td>${esc(ROLES[u.rol] || u.rol)}</td>` +
            `<td><span class="badge ${u.activo ? "ok" : "off"}">${u.activo ? "Activo" : "Inactivo"}</span></td>` +
            `<td><button class="btn-link" data-a="editar">Editar</button><button class="btn-link" data-a="estado">${u.activo ? "Desactivar" : "Activar"}</button></td></tr>`).join("")
        : `<tr><td colspan="5" class="vacio">No existen usuarios que cumplan los criterios.</td></tr>`;
      $("#pie-usuarios").textContent = `Mostrando ${vis.length} usuario${vis.length === 1 ? "" : "s"}`;
    }
    ["#f-q", "#f-rol", "#f-estado"].forEach((s) => $(s).addEventListener("input", pintar));

    function modo(nuevo) {
      $$("[data-solo='nuevo']", drawer).forEach((e) => (e.hidden = !nuevo));
      $$("[data-solo='editar']", drawer).forEach((e) => (e.hidden = nuevo));
      $("#u-titulo").textContent = nuevo ? "Nuevo usuario" : "Editar usuario";
      $("#u-guardar").textContent = nuevo ? "Registrar usuario" : "Guardar cambios";
    }
    $("#btn-nuevo-usuario").addEventListener("click", () => { editando = null; form.reset(); limpiar(drawer); modo(true); $("#u-sub").textContent = "Crea una cuenta y asigna su rol de acceso."; abrir(drawer); });

    cuerpo.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-a]");
      if (!b) return;
      const u = lista.find((x) => x.id === Number(b.closest("tr").dataset.id));
      if (b.dataset.a === "editar") {
        editando = u; form.reset(); limpiar(drawer); modo(false);
        $("#u-sub").textContent = `Actualiza los datos de ${nombreDe(u)}.`;
        $("#u-nombre").value = u.nombre || ""; $("#u-apellido").value = u.apellido || ""; $("#u-correo").value = u.correo;
        $("#u-rol-actual").value = ROLES[u.rol] || u.rol;
        abrir(drawer);
      } else if (u.activo) {
        const r = await modal({
          titulo: "Desactivar usuario", sub: `${esc(nombreDe(u))} · ${esc(u.correo)}`,
          banner: { tipo: "adv", texto: "La cuenta dejará de tener acceso al sistema." },
          cuerpo: "<p>Se cerrarán sus sesiones activas.</p><p class='nota'>Sus ventas y demás operaciones conservarán su responsable.</p>",
          botones: [{ texto: "Cancelar" }, { texto: "Desactivar usuario", clase: "btn-peligro" }],
        });
        if (r === 1) cambiar(u, { activo: false }, "No se puede desactivar la cuenta");
      } else cambiar(u, { activo: true }, "No se pudo activar la cuenta");
    });

    async function cambiar(u, datos, titulo) {
      const r = await api(`/usuarios/${u.id}`, "PATCH", datos);
      if (!r.ok) {
        await aviso(titulo, r.data.error || "No se pudo completar la operación.", "crit", `${esc(nombreDe(u))} · ${esc(ROLES[u.rol] || u.rol)}`);
        return false;
      }
      await cargar();
      return true;
    }

    $("#btn-cambiar-rol").addEventListener("click", async () => {
      const opciones = Object.entries(ROLES).map(([v, t]) => `<option value="${v}" ${v === editando.rol ? "selected" : ""}>${t}</option>`).join("");
      const cuerpoHtml = `<div class="campo"><label for="nuevo-rol">Nuevo rol</label><select id="nuevo-rol">${opciones}</select></div>`;
      const p = modal({
        titulo: "Cambiar rol", sub: esc(editando.correo),
        banner: { tipo: "adv", texto: `La sesión actual de ${esc(nombreDe(editando).split(" ")[0])} se cerrará al confirmar.` },
        cuerpo: cuerpoHtml + "<p class='nota'>El usuario tendrá únicamente los permisos del nuevo rol.</p>",
        botones: [{ texto: "Cancelar" }, { texto: "Confirmar cambio", clase: "btn-pri" }],
      });
      let elegido = editando.rol;
      document.getElementById("nuevo-rol").addEventListener("change", (e) => { elegido = e.target.value; });
      if ((await p) === 1 && elegido !== editando.rol) {
        if (await cambiar(editando, { rol: elegido }, "No se puede cambiar el rol")) { cerrar(drawer); }
      }
    });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      limpiar(drawer);
      let ok = true;
      const req = (i, m) => { if (!i.value.trim()) { errorCampo(i, m); ok = false; } };
      req(form.nombre, "Ingresa el nombre."); req(form.apellido, "Ingresa el apellido.");
      if (!/^\S+@\S+\.\S+$/.test(form.correo.value.trim())) { errorCampo(form.correo, "Ingresa un correo válido."); ok = false; }
      if (!editando) {
        if (form.contrasena.value.length < 6) { errorCampo(form.contrasena, "La contraseña debe tener al menos 6 caracteres."); ok = false; }
        if (!form.rol.value) { errorCampo(form.rol, "Selecciona un rol."); ok = false; }
      }
      if (!ok) return;
      const base = { nombre: form.nombre.value.trim(), apellido: form.apellido.value.trim(), correo: form.correo.value.trim() };
      const r = editando
        ? await api(`/usuarios/${editando.id}`, "PATCH", base)
        : await api("/usuarios", "POST", { ...base, contrasena: form.contrasena.value, rol: form.rol.value });
      if (!r.ok) {
        if (r.status === 409) errorCampo(form.correo, "Este correo ya pertenece a otro usuario.");
        else bannerError("u-error", r.data.error || "No se pudo guardar el usuario.");
        return;
      }
      if (!editando && form.activo.value === "false") await api(`/usuarios/${r.data.usuario.id}`, "PATCH", { activo: false });
      cerrar(drawer);
      cargar();
    });
    cargar();
  }

  // ------------------------------------------------------------------ CU-03
  function productos() {
    const tabs = $$("[data-tab]");
    tabs.forEach((t) => t.addEventListener("click", () => {
      tabs.forEach((x) => x.setAttribute("aria-selected", String(x === t)));
      $("#tab-productos").hidden = t.dataset.tab !== "productos";
      $("#tab-categorias").hidden = t.dataset.tab !== "categorias";
    }));
    $$("#fp-q, #fp-cat, #fp-est").forEach((i, n) => (i.dataset.f = ["q", "cat", "est"][n]));
    $$("#fc-q, #fc-est").forEach((i, n) => (i.dataset.f = ["q", "est"][n]));
    filtroTabla("filas-productos", "pie-productos", "productos");
    filtroTabla("filas-categorias", "pie-categorias", "categorías");

    const dp = $("#drawer-producto"), fp = $("#form-producto"), dc = $("#drawer-categoria"), fc = $("#form-categoria");
    let prodEdit = null, catEdit = null;
    const datos = (tr) => JSON.parse(tr.dataset.json);

    $("#btn-nuevo-prod").addEventListener("click", () => {
      prodEdit = null; fp.reset(); limpiar(dp);
      $("#p-titulo").textContent = "Nuevo producto"; $("#p-sub").textContent = "Completa los datos antes de registrar el producto.";
      $("#p-guardar").textContent = "Registrar producto"; $("#p-nota").hidden = false; $("#p-bloqueo").hidden = true;
      ["unidad", "vencimiento"].forEach((n) => (fp[n].disabled = false));
      abrir(dp);
    });
    $("#btn-nueva-cat").addEventListener("click", () => {
      catEdit = null; fc.reset(); limpiar(dc);
      $("#c-titulo").textContent = "Nueva categoría"; $("#c-guardar").textContent = "Registrar categoría";
      $("#c-nota").textContent = "La categoría se registrará activa y podrá asignarse a productos.";
      abrir(dc);
    });

    document.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-accion]");
      if (!b) return;
      const tr = b.closest("tr");
      if (b.dataset.accion === "editar-prod") {
        const p = datos(tr); prodEdit = p; fp.reset(); limpiar(dp);
        fp.codigo.value = p.codigo; fp.nombre.value = p.nombre; fp.descripcion.value = p.descripcion; fp.categoria.value = p.categoria;
        fp.presentacion.value = p.presentacion; fp.unidad.value = p.unidad; fp.precio.value = p.precio; fp.minimo.value = p.minimo;
        fp.vencimiento.value = String(p.vencimiento);
        const bloqueado = p.lotes.length > 0;
        fp.unidad.disabled = fp.vencimiento.disabled = bloqueado;
        $("#p-bloqueo").hidden = !bloqueado; $("#p-nota").hidden = true;
        $("#p-titulo").textContent = "Editar producto"; $("#p-sub").textContent = "Actualiza los datos del catálogo."; $("#p-guardar").textContent = "Guardar cambios";
        abrir(dp);
      } else if (b.dataset.accion === "estado-prod") {
        const p = datos(tr), sub = `${esc(p.codigo)} · ${esc(p.nombre)}`;
        if (!p.activo) return cambiarProd(p, true);
        if (p.registradas > 0) return aviso("No se puede desactivar el producto", `El producto tiene ${p.registradas} unidades registradas en sus lotes.`, "crit", sub)
          .then(() => null);
        const r = await modal({
          titulo: "Desactivar producto", sub, banner: { tipo: "info", texto: "Existencias registradas: 0 unidades." },
          cuerpo: "<p>El producto dejará de estar disponible para nuevas entradas y ventas.</p><p class='nota'>Los movimientos anteriores se conservarán.</p><p class='nota'>El sistema comprobará nuevamente el saldo al confirmar.</p>",
          botones: [{ texto: "Cancelar" }, { texto: "Desactivar producto", clase: "btn-peligro" }],
        });
        if (r === 1) cambiarProd(p, false);
      } else if (b.dataset.accion === "editar-cat") {
        const c = datos(tr); catEdit = c; fc.reset(); limpiar(dc);
        fc.nombre.value = c.nombre; fc.descripcion.value = c.descripcion;
        $("#c-titulo").textContent = "Editar categoría"; $("#c-guardar").textContent = "Guardar cambios";
        $("#c-nota").textContent = "Los cambios mantienen los productos asociados a la categoría.";
        abrir(dc);
      } else if (b.dataset.accion === "estado-cat") {
        const c = datos(tr);
        const r = await api(`/api/categorias/${c.id}`, "PATCH", { activo: !c.activo });
        if (!r.ok) {
          await modal({ titulo: "No se puede desactivar la categoría", sub: esc(c.nombre), banner: { tipo: "crit", texto: esc(r.data.error) },
            cuerpo: "<p><strong>Reasigna los productos a otra categoría activa o desactívalos cuando las reglas de inventario lo permitan.</strong></p><p class='nota'>La categoría y sus asociaciones se conservan.</p>",
            botones: [{ texto: "Entendido", clase: "btn-pri" }] });
        } else location.reload();
      }
    });

    async function cambiarProd(p, activo) {
      const r = await api(`/api/productos/${encodeURIComponent(p.codigo)}`, "PATCH", { activo });
      if (!r.ok) await aviso("No se pudo cambiar el estado", r.data.error);
      else location.reload();
    }

    fp.addEventListener("submit", async (ev) => {
      ev.preventDefault(); limpiar(dp);
      let ok = true;
      const req = (i, m) => { if (!String(i.value).trim()) { errorCampo(i, m); ok = false; } };
      req(fp.codigo, "El código es obligatorio."); req(fp.nombre, "El nombre es obligatorio."); req(fp.categoria, "Selecciona una categoría.");
      req(fp.presentacion, "La presentación es obligatoria."); req(fp.vencimiento, "Indica si controla vencimiento.");
      if (!(Number(fp.precio.value) > 0)) { errorCampo(fp.precio, "El precio debe ser mayor que cero."); ok = false; }
      if (fp.minimo.value === "" || Number(fp.minimo.value) < 0 || !Number.isInteger(Number(fp.minimo.value))) { errorCampo(fp.minimo, "Ingresa un entero igual o mayor que cero."); ok = false; }
      if (!ok) return;
      const cuerpoReq = {
        codigo: fp.codigo.value.trim(), nombre: fp.nombre.value.trim(), descripcion: fp.descripcion.value.trim(), categoria: fp.categoria.value,
        presentacion: fp.presentacion.value.trim(), unidad: fp.unidad.value, precio: Number(fp.precio.value), minimo: Number(fp.minimo.value),
        vencimiento: fp.vencimiento.value === "true",
      };
      const r = prodEdit ? await api(`/api/productos/${encodeURIComponent(prodEdit.codigo)}`, "PATCH", cuerpoReq) : await api("/api/productos", "POST", cuerpoReq);
      if (r.ok) { location.reload(); return; }
      if (r.status === 409 && /código/i.test(r.data.error)) errorCampo(fp.codigo, r.data.error);
      else bannerError("p-error", r.data.error || "No se pudo guardar el producto.");
    });

    fc.addEventListener("submit", async (ev) => {
      ev.preventDefault(); limpiar(dc);
      if (!fc.nombre.value.trim()) { errorCampo(fc.nombre, "El nombre es obligatorio."); return; }
      const cuerpoReq = { nombre: fc.nombre.value.trim(), descripcion: fc.descripcion.value.trim() };
      const r = catEdit ? await api(`/api/categorias/${catEdit.id}`, "PATCH", cuerpoReq) : await api("/api/categorias", "POST", cuerpoReq);
      if (r.ok) location.reload();
      else if (r.status === 409) errorCampo(fc.nombre, r.data.error);
      else bannerError("c-error", r.data.error || "No se pudo guardar la categoría.");
    });
  }

  // ------------------------------------------------------------------ CU-10
  function proveedores() {
    $$("#fv-q, #fv-est").forEach((i, n) => (i.dataset.f = ["q", "est"][n]));
    filtroTabla("filas-proveedores", "pie-proveedores", "proveedores");
    const dv = $("#drawer-proveedor"), fv = $("#form-proveedor");
    let edit = null;
    $("#btn-nuevo-prov").addEventListener("click", () => {
      edit = null; fv.reset(); limpiar(dv); $("#v-titulo").textContent = "Nuevo proveedor"; $("#v-guardar").textContent = "Registrar proveedor"; abrir(dv);
    });
    document.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-accion]");
      if (!b) return;
      const p = JSON.parse(b.closest("tr").dataset.json);
      if (b.dataset.accion === "editar-prov") {
        edit = p; fv.reset(); limpiar(dv);
        ["tipo_id", "numero_id", "nombre", "telefono", "correo", "direccion"].forEach((k) => (fv[k].value = p[k]));
        $("#v-titulo").textContent = "Editar proveedor"; $("#v-guardar").textContent = "Guardar cambios"; abrir(dv);
      } else if (b.dataset.accion === "estado-prov") {
        if (p.activo) {
          const r = await modal({ titulo: "Desactivar proveedor", sub: esc(p.nombre), banner: { tipo: "adv", texto: "No podrá seleccionarse en nuevas entradas." },
            cuerpo: "<p class='nota'>Seguirá vinculado a las operaciones históricas.</p>", botones: [{ texto: "Cancelar" }, { texto: "Desactivar proveedor", clase: "btn-peligro" }] });
          if (r !== 1) return;
        }
        const r = await api(`/api/proveedores/${p.id}`, "PATCH", { activo: !p.activo });
        if (r.ok) location.reload(); else aviso("No se pudo cambiar el estado", r.data.error);
      }
    });
    fv.addEventListener("submit", async (ev) => {
      ev.preventDefault(); limpiar(dv);
      let ok = true;
      if (!fv.numero_id.value.trim()) { errorCampo(fv.numero_id, "La identificación es obligatoria."); ok = false; }
      if (!fv.nombre.value.trim()) { errorCampo(fv.nombre, "El nombre es obligatorio."); ok = false; }
      if (fv.correo.value && !/^\S+@\S+\.\S+$/.test(fv.correo.value.trim())) { errorCampo(fv.correo, "Correo no válido."); ok = false; }
      if (!ok) return;
      const cuerpoReq = Object.fromEntries(new FormData(fv).entries());
      const r = edit ? await api(`/api/proveedores/${edit.id}`, "PATCH", cuerpoReq) : await api("/api/proveedores", "POST", cuerpoReq);
      if (r.ok) location.reload();
      else if (r.status === 409) errorCampo(fv.numero_id, r.data.error);
      else bannerError("v-error", r.data.error || "No se pudo guardar el proveedor.");
    });
  }

  // ------------------------------------------------------------------ CU-04 (listado)
  function entradas() {
    $$("#fe-q, #fe-desde, #fe-hasta").forEach((i, n) => (i.dataset.f = ["q", "desde", "hasta"][n]));
    filtroTabla("filas-entradas", "pie-entradas", "entradas confirmadas");
  }

  // ------------------------------------------------------------------ CU-04 (nueva entrada)
  function entradaNueva() {
    const D = window.ENTRADA;
    const lineas = [];
    let proveedor = null, editIdx = null;
    const dl = $("#drawer-linea"), fl = $("#form-linea"), ds = $("#drawer-proveedor-sel");
    const prodDe = (c) => D.productos.find((p) => p.codigo === c);

    // --- selector de proveedor
    function pintarProv() {
      const q = $("#sp-q").value.trim().toLowerCase();
      const v = D.proveedores.filter((p) => !q || (p.numero_id + " " + p.nombre).toLowerCase().includes(q));
      $("#sp-lista").innerHTML = v.length ? v.map((p) =>
        `<div class="prov-item"><div><strong>${esc(p.nombre)}</strong><small>${esc(p.tipo_id)} ${esc(p.numero_id)}</small><span class="badge ok">Activo</span></div>` +
        `<button type="button" class="btn btn-sec" data-prov="${p.id}">Seleccionar</button></div>`).join("") : "<p class='vacio'>No hay proveedores activos que coincidan.</p>";
    }
    $("#e-prov-txt").addEventListener("click", () => { pintarProv(); abrir(ds); });
    $("#sp-q").addEventListener("input", pintarProv);
    $("#sp-lista").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-prov]");
      if (!b) return;
      proveedor = D.proveedores.find((p) => p.id === Number(b.dataset.prov));
      $("#e-prov-txt").value = proveedor.nombre;
      const c = $("#e-prov-txt").closest(".campo"); c.classList.remove("error"); $(".err", c).textContent = "";
      cerrar(ds);
    });

    // --- tabla de líneas
    function pintar() {
      $("#lineas").innerHTML = lineas.length ? lineas.map((l, i) =>
        `<tr><td>${esc(l.nombre)}</td><td>${l.lote ? esc(l.lote) : "<em>Interno (al confirmar)</em>"}</td><td>${fechaEs(l.vencimiento)}</td><td class="num">${l.cantidad} ${esc(l.unidad)}s</td>` +
        `<td class="num">${moneda(l.costo)}</td><td class="num">${moneda(l.cantidad * l.costo)}</td>` +
        `<td><button type="button" class="btn-link" data-i="${i}" data-a="e">Editar</button><button type="button" class="btn-link" data-i="${i}" data-a="q">Quitar</button></td></tr>`).join("")
        : `<tr><td colspan="7" class="vacio">Aún no hay productos. Usa «Agregar producto» para registrar lotes.</td></tr>`;
      $("#resumen-lineas").textContent = `${new Set(lineas.map((l) => l.codigo)).size} productos · ${lineas.length} lotes`;
      $("#total-compra").textContent = moneda(lineas.reduce((s, l) => s + l.cantidad * l.costo, 0));
    }
    $("#lineas").addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-i]");
      if (!b) return;
      const i = Number(b.dataset.i);
      if (b.dataset.a === "q") { lineas.splice(i, 1); pintar(); } else abrirLinea(i);
    });

    // --- drawer de línea
    $("#l-prod").innerHTML = D.productos.map((p) => `<option value="${p.codigo}">${esc(p.codigo)} · ${esc(p.nombre)} ${esc(p.presentacion)}</option>`).join("");
    function ajustarProducto() {
      const p = prodDe($("#l-prod").value);
      $("#l-venc").disabled = !p.vencimiento;
      if (!p.vencimiento) $("#l-venc").value = "";
      $("#l-unidad").textContent = `Unidad: ${p.unidad}`;
      info();
    }
    function info() {
      const p = prodDe($("#l-prod").value), lote = $("#l-lote").value.trim(), cant = Number($("#l-cant").value) || 0;
      const box = $("#l-info"), ex = lote ? p.lotes.find((l) => l.id_lote === lote) : null;
      if (ex) { box.hidden = false; box.textContent = `Lote existente: ${ex.cantidad} unidades. Saldo previsto al confirmar: ${ex.cantidad + cant}.`; } else box.hidden = true;
      $("#l-sub").value = moneda(cant * (Number($("#l-costo").value) || 0));
    }
    ["#l-lote", "#l-cant", "#l-costo"].forEach((s) => $(s).addEventListener("input", info));
    $("#l-prod").addEventListener("change", ajustarProducto);
    $("#btn-agregar").addEventListener("click", () => abrirLinea(null));
    function abrirLinea(i) {
      editIdx = i; fl.reset(); limpiar(dl);
      const l = i === null ? null : lineas[i];
      if (l) { $("#l-prod").value = l.codigo; $("#l-lote").value = l.lote; $("#l-venc").value = l.vencimiento || ""; $("#l-cant").value = l.cantidad; $("#l-costo").value = l.costo; }
      $("#l-guardar").textContent = "Agregar a la entrada";
      ajustarProducto(); abrir(dl);
    }
    fl.addEventListener("submit", (ev) => {
      ev.preventDefault(); limpiar(dl);
      const p = prodDe($("#l-prod").value);
      const lote = $("#l-lote").value.trim(), venc = $("#l-venc").value, cant = Number($("#l-cant").value), costo = Number($("#l-costo").value);
      let ok = true, banner = "";
      if (!(Number.isInteger(cant) && cant > 0)) { errorCampo($("#l-cant"), "Ingresa una cantidad entera positiva."); ok = false; }
      if ($("#l-costo").value === "" || costo < 0) { errorCampo($("#l-costo"), "Ingresa un costo no negativo."); ok = false; }
      if (p.vencimiento) {
        if (!venc) { errorCampo($("#l-venc"), "La fecha de vencimiento es obligatoria."); ok = false; }
        else if (venc <= D.hoy) { errorCampo($("#l-venc"), "El lote ya está vencido."); banner = "No se admite recibir un lote vencido en la fecha de recepción."; ok = false; }
      }
      const ex = lote ? p.lotes.find((l) => l.id_lote === lote) : null;
      if (ex && p.vencimiento && venc && ex.fecha_vencimiento && ex.fecha_vencimiento !== venc) {
        banner = `El lote existente tiene vencimiento ${fechaEs(ex.fecha_vencimiento)}. Revisa la fecha.`; ok = false;
      }
      if (!ok) { if (banner) bannerError("l-error", banner); $("#l-guardar").textContent = "Corregir datos"; return; }
      const linea = { codigo: p.codigo, nombre: p.nombre, unidad: p.unidad, lote, vencimiento: p.vencimiento ? venc : null, cantidad: cant, costo };
      if (editIdx === null) lineas.push(linea); else lineas[editIdx] = linea;
      cerrar(dl); pintar();
    });

    // --- revisar, confirmar, cancelar
    $("#btn-revisar").addEventListener("click", async () => {
      if (!proveedor) { const c = $("#e-prov-txt").closest(".campo"); c.classList.add("error"); $(".err", c).textContent = "Selecciona un proveedor."; $("#e-prov-txt").focus(); return; }
      if (!lineas.length) { await aviso("Falta agregar productos", "Agrega al menos un producto con su lote antes de revisar la entrada.", "adv"); return; }
      const resumen = lineas.map((l) => `<div class="resumen-linea"><strong>${esc(l.nombre)}</strong><small>${esc(l.lote || "Lote interno")} · ${l.cantidad} unidades · ${l.vencimiento ? "Vence " + fechaEs(l.vencimiento) : "Sin vencimiento"}</small></div>`).join("");
      const total = lineas.reduce((s, l) => s + l.cantidad * l.costo, 0);
      const r = await modal({
        titulo: "Confirmar entrada", sub: `${esc(proveedor.nombre)} · Documento ${esc($("#e-doc").value.trim() || "sin referencia")}`,
        cuerpo: `<div class="resumen-linea">Fecha de recepción <strong style="float:right">${fechaEs(D.hoy)}</strong></div>${resumen}<div class="total-linea">Total de compra <b>${moneda(total)}</b></div>`,
        banner: { tipo: "adv", texto: "Al confirmar se guardará la entrada y aumentarán los saldos." },
        botones: [{ texto: "Volver" }, { texto: "Confirmar entrada", clase: "btn-pri" }],
      });
      if (r === 1) confirmar();
    });

    async function confirmar() {
      const r = await api("/api/entradas", "POST", {
        proveedor_id: proveedor.id, documento: $("#e-doc").value.trim(), observacion: $("#e-obs").value.trim(),
        lineas: lineas.map((l) => ({ codigo: l.codigo, lote: l.lote, vencimiento: l.vencimiento, cantidad: l.cantidad, costo: l.costo })),
      });
      if (!r.ok) {
        await modal({
          titulo: "No se pudo registrar la entrada", sub: "La operación no fue confirmada.",
          banner: { tipo: "crit", texto: "No se guardaron movimientos ni se modificaron existencias." },
          cuerpo: `<p>${esc(r.data.error || "Error desconocido.")}</p><p>Tus datos siguen disponibles para revisar la recepción.</p><p class="nota">La misma recepción no debe registrarse dos veces.</p>`,
          botones: [{ texto: "Volver a la entrada", clase: "btn-pri" }],
        });
        return;
      }
      const e = r.data.entrada;
      const saldos = r.data.saldos.map((s) => `<div>${esc(s.producto)} · ${esc(s.lote)}: ${s.antes} + ${s.despues - s.antes} = ${s.despues} unidades</div>`).join("");
      const op = await modal({
        titulo: "Entrada registrada correctamente", sub: `${esc(e.codigo)} · ${fechaEs(e.fecha)}`,
        banner: { tipo: "ok", texto: "La entrada y sus detalles se guardaron correctamente." },
        cuerpo: `<strong>Saldos actualizados</strong>${saldos}<p><strong>Total de compra: ${moneda(e.total)}</strong></p>`,
        botones: [{ texto: "Ver detalle" }, { texto: "Ir a entradas", clase: "btn-pri" }],
      });
      location.href = op === 0 ? `${D.urlEntradas}/${e.codigo}` : D.urlEntradas;
    }

    $("#btn-cancelar").addEventListener("click", async () => {
      if (!lineas.length && !proveedor) { location.href = D.urlEntradas; return; }
      const r = await modal({
        titulo: "Descartar la entrada", sub: "La recepción todavía no está confirmada.",
        banner: { tipo: "adv", texto: "Se perderán los datos ingresados en esta recepción." },
        cuerpo: "<p>No se registrará la entrada ni se modificarán existencias.</p>",
        botones: [{ texto: "Seguir editando" }, { texto: "Descartar entrada", clase: "btn-peligro" }],
      });
      if (r === 1) location.href = D.urlEntradas;
    });
    pintar();
  }

  // ------------------------------------------------------------------ CU-08
  function ventas() {
    const P = window.VENTA.productos, lineas = [];
    const prod = (c) => P.find((p) => p.codigo === c);
    const lotesHtml = (d) => d.map((x) => `<div class="resumen-linea"><strong>${esc(x.producto)}</strong><small>Lote ${esc(x.lote)} · ${x.cantidad} u · ${x.vencimiento ? "Vence " + fechaEs(x.vencimiento) : "Sin vencimiento"} · ${moneda(x.subtotal)}</small></div>`).join("");

    function pintar() {
      $("#v-lineas").innerHTML = lineas.length ? lineas.map((l, i) => {
        const p = prod(l.codigo);
        return `<tr><td>${esc(p.nombre)} ${esc(p.presentacion)}</td><td class="num">${l.cantidad}</td><td class="num">${moneda(p.precio)}</td><td class="num">${moneda(l.cantidad * p.precio)}</td><td><button type="button" class="btn-link" data-q="${i}">Quitar</button></td></tr>`;
      }).join("") : `<tr><td colspan="5" class="vacio">Aún no hay productos. Selecciona uno y usa «Agregar».</td></tr>`;
      $("#v-total").textContent = moneda(lineas.reduce((s, l) => s + l.cantidad * prod(l.codigo).precio, 0));
    }
    $("#v-agregar").addEventListener("click", () => {
      const c = $("#v-cant"), p = prod($("#v-prod").value), n = Number(c.value);
      c.closest(".campo").classList.remove("error"); $(".err", c.closest(".campo")).textContent = "";
      const ya = lineas.find((l) => l.codigo === p.codigo), total = n + (ya ? ya.cantidad : 0);
      if (!Number.isInteger(n) || n <= 0) return errorCampo(c, "Ingresa una cantidad entera positiva.");
      if (total > p.disponibles) return errorCampo(c, `Solo hay ${p.disponibles} disponibles.`);
      if (ya) ya.cantidad = total; else lineas.push({ codigo: p.codigo, cantidad: n });
      c.value = 1; pintar();
    });
    $("#v-lineas").addEventListener("click", (ev) => { const b = ev.target.closest("[data-q]"); if (b) { lineas.splice(Number(b.dataset.q), 1); pintar(); } });
    $("#v-limpiar").addEventListener("click", () => { lineas.length = 0; pintar(); });

    $("#v-revisar").addEventListener("click", async () => {
      if (!lineas.length) return aviso("Falta agregar productos", "Agrega al menos un producto a la venta.", "adv");
      const items = lineas.map((l) => ({ codigo: l.codigo, cantidad: l.cantidad }));
      const r = await api("/api/ventas/revisar", "POST", { items });
      if (!r.ok) return aviso("No se puede continuar", r.data.error || "No se pudo revisar la venta.", "crit");
      const op = await modal({
        titulo: "Confirmar venta", sub: "Lotes asignados: vence primero, sale primero.",
        cuerpo: `${lotesHtml(r.data.detalle)}<div class="total-linea">Total <b>${moneda(r.data.total)}</b></div>`,
        banner: { tipo: "adv", texto: "Al confirmar se guardará la venta y se descontarán las existencias." },
        botones: [{ texto: "Volver" }, { texto: "Confirmar venta", clase: "btn-pri" }],
      });
      if (op !== 1) return;
      const c = await api("/api/ventas", "POST", { items, total_revisado: r.data.total });
      if (!c.ok) return aviso("No se pudo registrar la venta", c.data.error || "Error desconocido.", "crit", "No se descontaron existencias.");
      await modal({ titulo: "Venta registrada", sub: `${esc(c.data.venta.codigo)} · ${fechaEs(c.data.venta.fecha)}`, banner: { tipo: "ok", texto: "La venta y el descuento de existencias se guardaron." },
        cuerpo: `${lotesHtml(c.data.venta.detalle)}<div class="total-linea">Total <b>${moneda(c.data.venta.total)}</b></div>`, botones: [{ texto: "Aceptar", clase: "btn-pri" }] });
      location.reload();
    });
    document.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-accion='detalle-venta']");
      if (!b) return;
      const v = JSON.parse(b.dataset.json);
      modal({ titulo: v.codigo, sub: fechaEs(v.fecha), cuerpo: `${lotesHtml(v.detalle)}<div class="total-linea">Total <b>${moneda(v.total)}</b></div>`, botones: [{ texto: "Cerrar", clase: "btn-pri" }] });
    });
    pintar();
  }

  // ------------------------------------------------------------------ CU-05 / CU-07
  function existencias() {
    $("#fx-q").dataset.f = "q";
    filtroTabla("filas-existencias", "pie-existencias", "productos");
    document.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-accion='lotes']");
      if (!b) return;
      const fila = b.closest("tr").nextElementSibling;
      fila.hidden = !fila.hidden;
      b.setAttribute("aria-expanded", String(!fila.hidden));
      b.textContent = fila.hidden ? "Ver lotes" : "Ocultar lotes";
    });
  }
  function alertas() {
    document.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-accion='detalle-alerta']");
      if (!b) return;
      const a = JSON.parse(b.dataset.json);
      modal({
        titulo: a.tipo, sub: esc(a.producto), banner: { tipo: a.nivel === "critico" ? "crit" : "adv", texto: esc(a.condicion) },
        cuerpo: `<div>Lote: <strong>${esc(a.lote)}</strong></div><div>Cantidad: <strong>${a.cantidad}</strong></div>${a.fecha ? `<div>Vencimiento: <strong>${fechaEs(a.fecha)}</strong></div>` : ""}`,
        botones: [{ texto: "Cerrar", clase: "btn-pri" }],
      });
    });
  }
})();
