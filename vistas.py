"""Capa de vistas (MPA) del Gestor de Inventario.

Se registra desde app.py con `registrar_vistas(app, _current_user, _normalize_role)`.

IMPORTANTE para el equipo Back-end:
  Los datos de CATEGORIAS, PRODUCTOS, PROVEEDORES y ENTRADAS viven en memoria
  (se pierden al reiniciar) para que el front sea demostrable hoy. Cada función
  marcada con `# TODO(persistencia)` debe reemplazarse por lectura/escritura de
  data/*.json. Las plantillas y el JS no cambian: solo consumen estas rutas.
"""
import json
import os
import tempfile
from datetime import date, timedelta
from functools import wraps
from pathlib import Path

from flask import Blueprint, g, jsonify, redirect, render_template, request, session, url_for
from markupsafe import Markup

# ---------------------------------------------------------------- iconos / menú
_ICONOS = {
    "panel": '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    "usuarios": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .7 3.5 2.6 3.5 5.5"/>',
    "productos": '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    "proveedores": '<path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
    "entradas": '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
    "ventas": '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h11L21 7H6"/>',
    "existencias": '<circle cx="12" cy="7" r="3.5"/><circle cx="7" cy="16" r="3.5"/><circle cx="17" cy="16" r="3.5"/>',
    "alertas": '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    "lock": '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    "logout": '<path d="M9 21H5V3h4M16 8l4 4-4 4M20 12H9"/>',
    "eye": '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    "cubos": '<path d="M12 2l5 3v6l-5 3-5-3V5zM7 11l5 3M17 11l-5 3M12 14v6M7 14l-5 3v5l5 3 5-3M17 14l5 3v5l-5 3-5-3" transform="scale(.85) translate(2 0)"/>',
}

# clave, título, endpoint, icono, roles con acceso, descripción, texto botón
MENU = [
    ("panel", "Panel principal", "vistas.panel", "panel", {"Administrador", "Encargado", "Vendedor"}, "", ""),
    ("usuarios", "Usuarios y roles", "vistas.usuarios", "usuarios", {"Administrador"}, "Administra cuentas y permisos.", "Ver usuarios"),
    ("productos", "Productos y categorías", "vistas.productos", "productos", {"Encargado"}, "Mantén el catálogo organizado.", "Ver productos"),
    ("proveedores", "Proveedores", "vistas.proveedores", "proveedores", {"Encargado"}, "Consulta y registra proveedores.", "Ver proveedores"),
    ("entradas", "Entradas", "vistas.entradas", "entradas", {"Encargado"}, "Registra productos recibidos por lote.", "Ver entradas"),
    ("ventas", "Ventas", "vistas.ventas", "ventas", {"Vendedor"}, "Registra ventas con lotes disponibles.", "Ver ventas"),
    ("existencias", "Existencias", "vistas.existencias", "existencias", {"Administrador", "Encargado", "Vendedor"}, "Consulta saldos y disponibilidad por lote.", "Ver existencias"),
    ("alertas", "Alertas", "vistas.alertas", "alertas", {"Administrador", "Encargado"}, "Revisa vencimientos y existencias mínimas.", "Consultar alertas"),
]
PERMISOS = {m[0]: m[4] for m in MENU}
ROL_ETIQUETA = {"Administrador": "Administrador", "Encargado": "Encargado de inventario", "Vendedor": "Vendedor"}

# ------------------------------------------------------- datos en memoria (demo)
# TODO(persistencia): reemplazar por data/productos.json, proveedores.json, movimientos.json
CATEGORIAS = [
    {"id": 1, "nombre": "Aseo", "descripcion": "Productos para limpieza del hogar", "activo": True},
    {"id": 2, "nombre": "Lácteos", "descripcion": "Leche y productos derivados", "activo": True},
    {"id": 3, "nombre": "Abarrotes", "descripcion": "Alimentos básicos y productos secos", "activo": True},
    {"id": 4, "nombre": "Bebidas", "descripcion": "Bebidas envasadas", "activo": False},
]
_hoy = date.today()
PRODUCTOS = [
    {"codigo": "ASE-001", "nombre": "Detergente", "descripcion": "Detergente en polvo", "categoria": "Aseo",
     "presentacion": "Bolsa de 1 kg", "unidad": "Unidad", "precio": 8500, "minimo": 18, "vencimiento": False,
     "activo": True, "lotes": []},
    {"codigo": "LAC-014", "nombre": "Leche entera", "descripcion": "Leche entera pasteurizada", "categoria": "Lácteos",
     "presentacion": "Envase de 1 L", "unidad": "Unidad", "precio": 4200, "minimo": 24, "vencimiento": True,
     "activo": True, "lotes": [{"id_lote": "LAC-231026-01", "cantidad": 12, "fecha_vencimiento": (_hoy + timedelta(days=5)).isoformat()}]},
    {"codigo": "ABA-032", "nombre": "Arroz 500 g", "descripcion": "Arroz blanco", "categoria": "Abarrotes",
     "presentacion": "Bolsa de 500 g", "unidad": "Unidad", "precio": 3100, "minimo": 30, "vencimiento": False,
     "activo": True, "lotes": [{"id_lote": "ABA-190926-01", "cantidad": 40, "fecha_vencimiento": None}]},
    {"codigo": "ASE-007", "nombre": "Jabón de baño", "descripcion": "", "categoria": "Aseo",
     "presentacion": "Barra de 100 g", "unidad": "Unidad", "precio": 2500, "minimo": 20, "vencimiento": False,
     "activo": False, "lotes": []},
]
PROVEEDORES = [
    {"id": 1, "tipo_id": "NIT", "numero_id": "900123456-9", "nombre": "Distribuidora Norte", "telefono": "6075551234", "correo": "ventas@dnorte.co", "direccion": "", "activo": True},
    {"id": 2, "tipo_id": "NIT", "numero_id": "901234567-8", "nombre": "Comercializadora Central", "telefono": "6075559876", "correo": "", "direccion": "Av. 5 # 10-20", "activo": True},
    {"id": 3, "tipo_id": "NIT", "numero_id": "900345678-1", "nombre": "Suministros del Hogar", "telefono": "", "correo": "info@suhogar.co", "direccion": "", "activo": True},
]
ENTRADAS = [
    {"codigo": "ENT-00012", "fecha": "2026-10-23", "proveedor_id": 1, "documento": "FAC-1039", "total": 38400, "usuario": "Laura Gómez", "observacion": "",
     "detalle": [{"producto": "Leche entera 1 L", "lote": "LAC-231023-01", "vencimiento": "2026-11-20", "cantidad": 12, "costo": 3200, "subtotal": 38400}]},
    {"codigo": "ENT-00011", "fecha": "2026-10-20", "proveedor_id": 2, "documento": "REM-282", "total": 96000, "usuario": "Laura Gómez", "observacion": "",
     "detalle": [{"producto": "Arroz 500 g", "lote": "ABA-190926-01", "vencimiento": None, "cantidad": 40, "costo": 2400, "subtotal": 96000}]},
    {"codigo": "ENT-00010", "fecha": "2026-10-17", "proveedor_id": 3, "documento": "FAC-774", "total": 125000, "usuario": "Laura Gómez", "observacion": "",
     "detalle": [{"producto": "Detergente", "lote": "ASE-171026-01", "vencimiento": None, "cantidad": 25, "costo": 5000, "subtotal": 125000}]},
]


# ------------------------------------------------------------ persistencia JSON
# Cada lista de arriba se guarda en un archivo de data/. Si el archivo no existe,
# se crea con los datos de ejemplo. Después de cada cambio se reescribe (atómico).
_DATA_DIR = None
def _prod_a_acta(p):
    """Formato de disco = esquema del ACUERDO_MVP (sección 7): codigo_unico, existencia_minima, proveedor_id, lotes."""
    d = {"codigo_unico": p["codigo"]}
    d.update({k: v for k, v in p.items() if k not in ("codigo", "minimo")})
    d["existencia_minima"] = p["minimo"]
    d.setdefault("proveedor_id", None)
    return d


def _prod_de_acta(d):
    p = {k: v for k, v in d.items() if k not in ("codigo_unico", "existencia_minima")}
    p["codigo"] = d["codigo_unico"]
    p["minimo"] = d["existencia_minima"]
    return p


# archivo -> (lista en memoria, conversión a disco, conversión desde disco)
_ARCHIVOS = {
    "categorias.json": (CATEGORIAS, None, None),
    "inventario.json": (PRODUCTOS, _prod_a_acta, _prod_de_acta),   # productos + lotes (acta §7)
    "proveedores.json": (PROVEEDORES, None, None),
    "movimientos.json": (ENTRADAS, None, None),   # historial: entradas (tipo "entrada") y ventas (tipo "venta")
}


def _escribir(ruta, datos):
    tmp = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=ruta.parent, delete=False) as f:
            tmp = Path(f.name)
            json.dump(datos, f, ensure_ascii=False, indent=2)
            f.write("\n")
        os.replace(tmp, ruta)
    finally:
        if tmp is not None and tmp.exists():
            tmp.unlink()


def _iniciar_datos(carpeta):
    global _DATA_DIR
    _DATA_DIR = Path(carpeta)
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    for nombre, (lista, a_disco, de_disco) in _ARCHIVOS.items():
        ruta = _DATA_DIR / nombre
        if ruta.exists():
            with ruta.open("r", encoding="utf-8") as f:
                datos = json.load(f)
            if not isinstance(datos, list):
                raise ValueError(f"El archivo {ruta} debe contener una lista.")
            lista[:] = [de_disco(x) for x in datos] if de_disco else datos
        else:
            _escribir(ruta, [a_disco(x) for x in lista] if a_disco else lista)


def _guardar_todo():
    for nombre, (lista, a_disco, _) in _ARCHIVOS.items():
        _escribir(_DATA_DIR / nombre, [a_disco(x) for x in lista] if a_disco else lista)


# ------------------------------------------------------------------ cálculos
def _hoy_iso():
    return date.today().isoformat()


def _existencias(p):
    """(registradas, disponibles para venta). Disponible excluye lotes vencidos y productos inactivos."""
    reg = sum(l["cantidad"] for l in p["lotes"])
    if not p["activo"]:
        return reg, 0
    hoy = _hoy_iso()
    disp = sum(l["cantidad"] for l in p["lotes"] if not l["fecha_vencimiento"] or l["fecha_vencimiento"] > hoy)
    return reg, disp


def _con_existencias(p):
    reg, disp = _existencias(p)
    return {**p, "registradas": reg, "disponibles": disp}


def _alertas():
    hoy = date.today()
    limite = (hoy + timedelta(days=7)).isoformat()
    out = []
    for p in PRODUCTOS:
        if not p["activo"]:
            continue
        for l in p["lotes"]:
            v = l["fecha_vencimiento"]
            if l["cantidad"] <= 0 or not v:
                continue
            base = {"producto": f'{p["codigo"]} · {p["nombre"]}', "lote": l["id_lote"], "cantidad": l["cantidad"], "fecha": v}
            if v <= hoy.isoformat():
                out.append({**base, "tipo": "Lote vencido", "nivel": "critico", "prioridad": 0,
                            "condicion": "La fecha de vencimiento es igual o anterior a hoy."})
            elif v <= limite:
                out.append({**base, "tipo": "Próximo a vencer", "nivel": "advertencia", "prioridad": 1,
                            "condicion": "Vence dentro de los próximos 7 días."})
        reg, disp = _existencias(p)
        if disp <= p["minimo"]:
            out.append({"producto": f'{p["codigo"]} · {p["nombre"]}', "lote": "—", "cantidad": disp, "fecha": "",
                        "tipo": "Stock mínimo", "nivel": "advertencia", "prioridad": 2,
                        "condicion": f'Disponible ({disp}) igual o inferior al mínimo ({p["minimo"]}).'})
    return sorted(out, key=lambda a: a["prioridad"])


def _entradas():
    return [e for e in ENTRADAS if e.get("tipo", "entrada") == "entrada"]


def _ventas():
    return [e for e in ENTRADAS if e.get("tipo") == "venta"]


def _siguiente(prefijo, lista):
    nums = [int(e["codigo"].split("-")[1]) for e in lista if e["codigo"].startswith(prefijo + "-")]
    return f"{prefijo}-{(max(nums) + 1 if nums else 1):05d}"


def _producto(codigo):
    return next((p for p in PRODUCTOS if p["codigo"] == codigo), None)


def _fecha_es(iso):
    return f"{iso[8:10]}/{iso[5:7]}/{iso[:4]}" if iso else ""


def _moneda(v):
    return "$ " + f"{int(round(v)):,}".replace(",", ".")


# ------------------------------------------------------------------ blueprint
def registrar_vistas(app, get_user, normalize_role):
    _iniciar_datos(Path(app.config["USERS_FILE"]).parent)
    bp = Blueprint("vistas", __name__)

    app.jinja_env.globals["icono"] = lambda n: Markup(
        f'<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" '
        f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{_ICONOS[n]}</svg>'
    )
    app.jinja_env.filters["fecha"] = _fecha_es
    app.jinja_env.filters["moneda"] = _moneda

    @app.context_processor
    def contexto():
        u = getattr(g, "usuario", None)
        if u is None:
            return {}
        rol = g.rol
        correo = u.get("correo", "")
        nombre = " ".join(x for x in ((u.get("nombre") or "").strip(), (u.get("apellido") or "").strip()) if x) or correo.split("@")[0].replace(".", " ").title()
        menu = [
            {"clave": m[0], "titulo": m[1], "url": url_for(m[2]), "icono": m[3], "permitido": rol in m[4]}
            for m in MENU
        ]
        return {"menu": menu, "nombre_usuario": nombre, "rol": rol, "rol_etiqueta": ROL_ETIQUETA.get(rol, rol)}

    def _auth(clave, api):
        def deco(view):
            @wraps(view)
            def w(*a, **k):
                u = get_user()
                if u is None:
                    session.clear()
                    if api:
                        return jsonify(error="Autenticación requerida."), 401
                    return redirect(url_for("vistas.login"))
                rol = normalize_role(u.get("rol"))
                if rol not in PERMISOS[clave]:
                    if api:
                        return jsonify(error="No tienes permisos para esta operación."), 403
                    return redirect(url_for("vistas.panel", denegado=1))
                g.usuario, g.rol = u, rol
                return view(*a, **k)
            return w
        return deco

    def pagina(clave):
        return _auth(clave, False)

    def api(clave):
        return _auth(clave, True)

    def err(msg, code=400):
        return jsonify(error=msg), code

    # ------------------------------------------------------------- páginas
    @bp.get("/")
    def login():
        if get_user() is not None:
            return redirect(url_for("vistas.panel"))
        return render_template("login.html")

    @bp.get("/panel")
    @pagina("panel")
    def panel():
        accesos = [m for m in MENU if m[0] != "panel" and g.rol in m[4]]
        return render_template("panel.html", accesos=accesos, denegado=request.args.get("denegado"))

    @bp.get("/gestion/usuarios")
    @pagina("usuarios")
    def usuarios():
        return render_template("usuarios.html")

    @bp.get("/productos")
    @pagina("productos")
    def productos():
        return render_template("productos.html", productos=[_con_existencias(p) for p in PRODUCTOS], categorias=CATEGORIAS)

    @bp.get("/proveedores")
    @pagina("proveedores")
    def proveedores():
        return render_template("proveedores.html", proveedores=PROVEEDORES)

    @bp.get("/entradas")
    @pagina("entradas")
    def entradas():
        nombres = {p["id"]: p["nombre"] for p in PROVEEDORES}
        return render_template("entradas.html", entradas=sorted(_entradas(), key=lambda e: e["codigo"], reverse=True), nombres=nombres)

    @bp.get("/entradas/nueva")
    @pagina("entradas")
    def entrada_nueva():
        provs = [p for p in PROVEEDORES if p["activo"]]
        prods = [{"codigo": p["codigo"], "nombre": p["nombre"], "presentacion": p["presentacion"],
                  "unidad": p["unidad"].lower(), "vencimiento": p["vencimiento"], "lotes": p["lotes"]}
                 for p in PRODUCTOS if p["activo"]]
        return render_template("entrada_nueva.html", proveedores=provs, productos=prods, hoy=_hoy_iso())

    @bp.get("/entradas/<codigo>")
    @pagina("entradas")
    def entrada_detalle(codigo):
        e = next((x for x in _entradas() if x["codigo"] == codigo), None)
        if e is None:
            return redirect(url_for("vistas.entradas"))
        prov = next((p for p in PROVEEDORES if p["id"] == e["proveedor_id"]), {"nombre": "—"})
        return render_template("entrada_detalle.html", e=e, proveedor=prov["nombre"])

    @bp.get("/existencias")
    @pagina("existencias")
    def existencias():
        return render_template("existencias.html", productos=[_con_existencias(p) for p in PRODUCTOS], hoy=_hoy_iso())

    @bp.get("/alertas")
    @pagina("alertas")
    def alertas():
        return render_template("alertas.html", alertas=_alertas())

    @bp.get("/ventas")
    @pagina("ventas")
    def ventas():
        prods = [{"codigo": p["codigo"], "nombre": p["nombre"], "presentacion": p["presentacion"], "precio": p["precio"],
                  "unidad": p["unidad"].lower(), "disponibles": _existencias(p)[1]}
                 for p in PRODUCTOS if p["activo"] and _existencias(p)[1] > 0]
        recientes = sorted(_ventas(), key=lambda v: v["codigo"], reverse=True)[:15]
        return render_template("ventas.html", productos=prods, ventas=recientes)

    # --------------------------------------------------- API demo (catálogos)
    # TODO(persistencia): leer/escribir data/*.json en lugar de las listas en memoria.
    @bp.post("/api/categorias")
    @api("productos")
    def cat_crear():
        b = request.get_json(silent=True) or {}
        nombre = str(b.get("nombre", "")).strip()
        if not nombre:
            return err("El nombre de la categoría es obligatorio.")
        if any(c["nombre"].casefold() == nombre.casefold() for c in CATEGORIAS):
            return err("Ya existe una categoría con ese nombre.", 409)
        c = {"id": max([x["id"] for x in CATEGORIAS], default=0) + 1, "nombre": nombre,
             "descripcion": str(b.get("descripcion", "")).strip(), "activo": True}
        CATEGORIAS.append(c)
        _guardar_todo()
        return jsonify(categoria=c), 201

    @bp.patch("/api/categorias/<int:cid>")
    @api("productos")
    def cat_editar(cid):
        c = next((x for x in CATEGORIAS if x["id"] == cid), None)
        if c is None:
            return err("Categoría no encontrada.", 404)
        b = request.get_json(silent=True) or {}
        if "activo" in b and b["activo"] is False and any(p["activo"] and p["categoria"] == c["nombre"] for p in PRODUCTOS):
            return err("La categoría tiene productos activos asociados.", 409)
        if "nombre" in b:
            nombre = str(b["nombre"]).strip()
            if not nombre:
                return err("El nombre de la categoría es obligatorio.")
            if any(x["id"] != cid and x["nombre"].casefold() == nombre.casefold() for x in CATEGORIAS):
                return err("Ya existe una categoría con ese nombre.", 409)
            for p in PRODUCTOS:
                if p["categoria"] == c["nombre"]:
                    p["categoria"] = nombre
            c["nombre"] = nombre
        if "descripcion" in b:
            c["descripcion"] = str(b["descripcion"]).strip()
        if "activo" in b:
            c["activo"] = bool(b["activo"])
        _guardar_todo()
        return jsonify(categoria=c)

    def _validar_producto(b, actual=None):
        codigo = str(b.get("codigo", "")).strip().upper()
        nombre = str(b.get("nombre", "")).strip()
        if not codigo or not nombre:
            return None, "Código y nombre son obligatorios."
        if any(p["codigo"] == codigo and p is not actual for p in PRODUCTOS):
            return None, "Este código ya está registrado."
        cat = next((c for c in CATEGORIAS if c["nombre"] == b.get("categoria") and c["activo"]), None)
        if cat is None:
            return None, "Selecciona una categoría activa."
        try:
            precio, minimo = float(b.get("precio")), int(b.get("minimo"))
        except (TypeError, ValueError):
            return None, "Precio y existencia mínima deben ser numéricos."
        if precio <= 0 or minimo < 0:
            return None, "El precio debe ser positivo y la existencia mínima no puede ser negativa."
        if not str(b.get("presentacion", "")).strip():
            return None, "La presentación es obligatoria."
        return {"codigo": codigo, "nombre": nombre, "descripcion": str(b.get("descripcion", "")).strip(),
                "categoria": cat["nombre"], "presentacion": str(b["presentacion"]).strip(),
                "unidad": str(b.get("unidad") or "Unidad"), "precio": precio, "minimo": minimo,
                "vencimiento": bool(b.get("vencimiento"))}, None

    @bp.post("/api/productos")
    @api("productos")
    def prod_crear():
        datos, e = _validar_producto(request.get_json(silent=True) or {})
        if e:
            return err(e, 409 if "código" in e else 400)
        PRODUCTOS.append({**datos, "activo": True, "lotes": []})
        _guardar_todo()
        return jsonify(producto=datos), 201

    @bp.patch("/api/productos/<codigo>")
    @api("productos")
    def prod_editar(codigo):
        p = _producto(codigo)
        if p is None:
            return err("Producto no encontrado.", 404)
        b = request.get_json(silent=True) or {}
        if set(b) == {"activo"}:
            if b["activo"] is False and sum(l["cantidad"] for l in p["lotes"]) > 0:
                return err("Resuelve primero las existencias mediante las operaciones de inventario.", 409)
            p["activo"] = bool(b["activo"])
            _guardar_todo()
            return jsonify(producto=p)
        datos, e = _validar_producto({**p, **b}, actual=p)
        if e:
            return err(e, 409 if "código" in e else 400)
        if p["lotes"] and (datos["unidad"] != p["unidad"] or datos["vencimiento"] != p["vencimiento"]):
            return err("Unidad y control de vencimiento bloqueados: existen movimientos.", 409)
        p.update(datos)
        _guardar_todo()
        return jsonify(producto=p)

    # ------------------------------------------------- API demo (proveedores)
    def _validar_proveedor(b, actual=None):
        numero, nombre = str(b.get("numero_id", "")).strip(), str(b.get("nombre", "")).strip()
        if not numero or not nombre:
            return None, "Identificación y nombre son obligatorios."
        if any(x["numero_id"] == numero and x is not actual for x in PROVEEDORES):
            return None, "Esa identificación pertenece a otro proveedor."
        tel, cor, dire = (str(b.get(k, "")).strip() for k in ("telefono", "correo", "direccion"))
        if not (tel or cor or dire):
            return None, "Ingresa al menos un medio de contacto válido."
        return {"tipo_id": str(b.get("tipo_id") or "NIT"), "numero_id": numero, "nombre": nombre,
                "telefono": tel, "correo": cor, "direccion": dire}, None

    @bp.post("/api/proveedores")
    @api("proveedores")
    def prov_crear():
        datos, e = _validar_proveedor(request.get_json(silent=True) or {})
        if e:
            return err(e, 409 if "pertenece" in e else 400)
        p = {"id": max([x["id"] for x in PROVEEDORES], default=0) + 1, **datos, "activo": True}
        PROVEEDORES.append(p)
        _guardar_todo()
        return jsonify(proveedor=p), 201

    @bp.patch("/api/proveedores/<int:pid>")
    @api("proveedores")
    def prov_editar(pid):
        p = next((x for x in PROVEEDORES if x["id"] == pid), None)
        if p is None:
            return err("Proveedor no encontrado.", 404)
        b = request.get_json(silent=True) or {}
        if set(b) == {"activo"}:
            p["activo"] = bool(b["activo"])
            _guardar_todo()
            return jsonify(proveedor=p)
        datos, e = _validar_proveedor({**p, **b}, actual=p)
        if e:
            return err(e, 409 if "pertenece" in e else 400)
        p.update(datos)
        _guardar_todo()
        return jsonify(proveedor=p)

    # ------------------------------------------------------- API ventas (CU-08)
    def _asignar_lotes(items):
        """FEFO: vence primero, sale primero. Sin vencimiento: FIFO por fecha de ingreso. Devuelve (detalle, total, error)."""
        if not isinstance(items, list) or not items:
            return None, None, "Agrega al menos un producto a la venta."
        hoy, detalle, vistos = _hoy_iso(), [], set()
        for it in items:
            prod = _producto(it.get("codigo"))
            if prod is None or not prod["activo"]:
                return None, None, "Hay un producto inválido o inactivo en la venta."
            try:
                cant = int(it.get("cantidad"))
            except (TypeError, ValueError):
                return None, None, "Las cantidades deben ser números enteros."
            if cant <= 0:
                return None, None, f'La cantidad de {prod["nombre"]} debe ser positiva.'
            if prod["codigo"] in vistos:
                return None, None, f'{prod["nombre"]} está repetido. Suma las cantidades en una sola línea.'
            vistos.add(prod["codigo"])
            lotes = [l for l in prod["lotes"] if l["cantidad"] > 0 and (not l["fecha_vencimiento"] or l["fecha_vencimiento"] > hoy)]
            lotes.sort(key=lambda l: (l["fecha_vencimiento"] or "9999-12-31", l.get("fecha_ingreso", ""), l["id_lote"]))
            disp = sum(l["cantidad"] for l in lotes)
            if cant > disp:
                return None, None, f'No hay cantidad suficiente de {prod["nombre"]}: disponibles {disp}.'
            resto = cant
            for l in lotes:
                if resto == 0:
                    break
                t = min(resto, l["cantidad"])
                resto -= t
                detalle.append({"codigo": prod["codigo"], "producto": f'{prod["nombre"]} {prod["presentacion"]}', "lote": l["id_lote"],
                                "vencimiento": l["fecha_vencimiento"], "cantidad": t, "precio": prod["precio"], "subtotal": t * prod["precio"]})
        return detalle, sum(d["subtotal"] for d in detalle), None

    @bp.post("/api/ventas/revisar")
    @api("ventas")
    def venta_revisar():
        detalle, total, e = _asignar_lotes((request.get_json(silent=True) or {}).get("items"))
        if e:
            return err(e)
        return jsonify(detalle=detalle, total=total)

    @bp.post("/api/ventas")
    @api("ventas")
    def venta_confirmar():
        b = request.get_json(silent=True) or {}
        detalle, total, e = _asignar_lotes(b.get("items"))   # se revalida todo al confirmar
        if e:
            return err(e, 409)
        if b.get("total_revisado") is not None and b["total_revisado"] != total:
            return err("Los precios o la disponibilidad cambiaron. Revisa la venta nuevamente.", 409)
        for d in detalle:
            prod = _producto(d["codigo"])
            next(l for l in prod["lotes"] if l["id_lote"] == d["lote"])["cantidad"] -= d["cantidad"]
        venta = {"tipo": "venta", "codigo": _siguiente("VEN", _ventas()), "fecha": _hoy_iso(), "usuario": g.usuario.get("correo", ""),
                 "total": total, "detalle": detalle}
        ENTRADAS.append(venta)
        _guardar_todo()
        return jsonify(venta=venta), 201

    # ----------------------------------------------------- API demo (entradas)
    @bp.post("/api/entradas")
    @api("entradas")
    def entrada_crear():
        b = request.get_json(silent=True) or {}
        prov = next((p for p in PROVEEDORES if p["id"] == b.get("proveedor_id") and p["activo"]), None)
        if prov is None:
            return err("Selecciona un proveedor activo.")
        lineas = b.get("lineas")
        if not isinstance(lineas, list) or not lineas:
            return err("Agrega al menos un producto a la entrada.")
        hoy = _hoy_iso()
        ok = []
        for l in lineas:
            prod = _producto(l.get("codigo"))
            if prod is None or not prod["activo"]:
                return err("Hay un producto inválido o inactivo en la entrada.")
            try:
                cant, costo = int(l.get("cantidad")), float(l.get("costo"))
            except (TypeError, ValueError):
                return err("Cantidad y costo deben ser numéricos.")
            lote = str(l.get("lote", "")).strip()   # vacío = se asigna un lote interno al confirmar
            if cant <= 0 or costo < 0:
                return err("La cantidad debe ser positiva y el costo no puede ser negativo.")
            venc = l.get("vencimiento") or None
            if prod["vencimiento"]:
                if not venc:
                    return err(f'{prod["nombre"]}: la fecha de vencimiento es obligatoria.')
                if venc <= hoy:
                    return err("No se admite recibir un lote vencido en la fecha de recepción.")
            else:
                venc = None
            ex = next((x for x in prod["lotes"] if x["id_lote"] == lote), None) if lote else None
            if ex and ex["fecha_vencimiento"] != venc:
                return err(f'El lote existente tiene vencimiento {_fecha_es(ex["fecha_vencimiento"])}. Revisa la fecha.')
            ok.append((prod, lote, venc, cant, costo))
        detalle, saldos = [], []
        for prod, lote, venc, cant, costo in ok:
            if not lote:
                n = 1
                while any(x["id_lote"] == f"INT-{prod['codigo']}-{hoy.replace('-', '')[2:]}-{n}" for x in prod["lotes"]):
                    n += 1
                lote = f"INT-{prod['codigo']}-{hoy.replace('-', '')[2:]}-{n}"
            ex = next((x for x in prod["lotes"] if x["id_lote"] == lote), None)
            antes = ex["cantidad"] if ex else 0
            if ex:
                ex["cantidad"] += cant
            else:
                prod["lotes"].append({"id_lote": lote, "cantidad": cant, "fecha_vencimiento": venc, "fecha_ingreso": hoy})
            prod["proveedor_id"] = prov["id"]
            detalle.append({"producto": f'{prod["nombre"]} {prod["presentacion"]}', "lote": lote, "vencimiento": venc,
                            "cantidad": cant, "costo": costo, "subtotal": cant * costo})
            saldos.append({"producto": prod["nombre"], "lote": lote, "antes": antes, "despues": antes + cant})
        entrada = {"tipo": "entrada", "codigo": _siguiente("ENT", _entradas()), "fecha": hoy, "proveedor_id": prov["id"], "documento": str(b.get("documento", "")).strip() or "—",
                   "total": sum(d["subtotal"] for d in detalle), "usuario": g.usuario.get("correo", ""),
                   "observacion": str(b.get("observacion", "")).strip(), "detalle": detalle}
        ENTRADAS.append(entrada)
        _guardar_todo()
        return jsonify(entrada=entrada, saldos=saldos), 201

    app.register_blueprint(bp)
