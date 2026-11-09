import argparse
import hmac
import json
import os
import secrets
import tempfile
from functools import wraps
from pathlib import Path
from threading import RLock

from flask import Flask, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash


BASE_DIR = Path(__file__).resolve().parent
ROLES = {
    "administrador": "Administrador",
    "encargado": "Encargado",
    "vendedor": "Vendedor",
}
_usuarios_lock = RLock()

app = Flask(__name__)
app.config.update(
    SECRET_KEY=os.environ.get("FLASK_SECRET_KEY") or secrets.token_hex(32),
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=os.environ.get("FLASK_COOKIE_SECURE", "").lower()
    in {"1", "true", "yes"},
    USERS_FILE=BASE_DIR / "data" / "usuarios.json",
)


def _read_users():
    path = Path(app.config["USERS_FILE"])
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        _write_users([])
    with path.open("r", encoding="utf-8") as file:
        users = json.load(file)
    if not isinstance(users, list) or any(not isinstance(user, dict) for user in users):
        raise ValueError(f"El archivo {path} debe contener una lista de usuarios.")
    return users


def _write_users(users):
    path = Path(app.config["USERS_FILE"])
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            delete=False,
        ) as file:
            temporary_path = Path(file.name)
            json.dump(users, file, ensure_ascii=False, indent=2, sort_keys=True)
            file.write("\n")
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()


def initialize_admin_user():
    """Replace the local user store with the initial active administrator."""
    with _usuarios_lock:
        _write_users(
            [
                {
                    "id": 1,
                    "correo": "admin@supermercado.com",
                    "contrasena": generate_password_hash("admin123"),
                    "rol": "Administrador",
                    "activo": True,
                }
            ]
        )


def _public_user(user):
    return {key: value for key, value in user.items() if key != "contrasena"}


def _normalize_role(value):
    if not isinstance(value, str):
        return None
    return ROLES.get(value.strip().casefold())


def _active_admin_count(users):
    return sum(
        user.get("activo") is True
        and _normalize_role(user.get("rol")) == "Administrador"
        for user in users
    )


def _current_user():
    user_id = session.get("user_id")
    if user_id is None:
        return None
    with _usuarios_lock:
        return next(
            (
                user
                for user in _read_users()
                if user.get("id") == user_id and user.get("activo") is True
            ),
            None,
        )


def _json_body():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return None
    return body


def _error(message, status):
    return jsonify(error=message), status


def _require_roles(*roles):
    def decorator(view):
        @wraps(view)
        def wrapped(*args, **kwargs):
            user = _current_user()
            if user is None:
                session.clear()
                return _error("Autenticación requerida.", 401)
            if _normalize_role(user.get("rol")) not in roles:
                return _error("No tienes permisos para esta operación.", 403)
            return view(*args, **kwargs)

        return wrapped

    return decorator


@app.post("/login")
def login():
    body = _json_body() or request.form
    email = body.get("correo")
    password = body.get("contrasena")
    if not isinstance(email, str) or not isinstance(password, str):
        return _error("Debes proporcionar correo y contraseña.", 400)

    with _usuarios_lock:
        users = _read_users()
        user = next(
            (
                item
                for item in users
                if isinstance(item.get("correo"), str)
                and item["correo"].casefold() == email.strip().casefold()
            ),
            None,
        )
        if user is None or user.get("activo") is not True:
            return _error("Credenciales inválidas o cuenta inactiva.", 401)

        stored_password = user.get("contrasena")
        if not isinstance(stored_password, str):
            return _error("Credenciales inválidas o cuenta inactiva.", 401)
        if stored_password.startswith(("scrypt:", "pbkdf2:")):
            password_matches = check_password_hash(stored_password, password)
        else:
            password_matches = hmac.compare_digest(stored_password, password)
            if password_matches:
                user["contrasena"] = generate_password_hash(password)
                _write_users(users)

        if not password_matches:
            return _error("Credenciales inválidas o cuenta inactiva.", 401)

        session.clear()
        session["user_id"] = user["id"]
        return jsonify(usuario=_public_user(user)), 200


@app.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify(mensaje="Sesión cerrada correctamente."), 200


@app.route("/usuarios", methods=["GET", "POST"])
def usuarios():
    if request.method == "GET":
        user = _current_user()
        if user is None:
            session.clear()
            return _error("Autenticación requerida.", 401)
        if _normalize_role(user.get("rol")) != "Administrador":
            return _error("No tienes permisos para esta operación.", 403)
        with _usuarios_lock:
            return jsonify(usuarios=[_public_user(item) for item in _read_users()])

    body = _json_body()
    if body is None:
        return _error("El cuerpo de la solicitud debe ser un objeto JSON.", 400)

    with _usuarios_lock:
        users = _read_users()
        if _active_admin_count(users) == 0:
            if _normalize_role(body.get("rol")) != "Administrador":
                return _error("El primer usuario debe tener el rol Administrador.", 400)
        else:
            user = _current_user()
            if user is None:
                session.clear()
                return _error("Autenticación requerida.", 401)
            if _normalize_role(user.get("rol")) != "Administrador":
                return _error("No tienes permisos para esta operación.", 403)

        email = body.get("correo")
        password = body.get("contrasena")
        role = _normalize_role(body.get("rol"))
        if not isinstance(email, str) or not email.strip():
            return _error("El correo es obligatorio.", 400)
        if not isinstance(password, str) or not password:
            return _error("La contraseña es obligatoria.", 400)
        if role is None:
            return _error("El rol debe ser Administrador, Encargado o Vendedor.", 400)
        normalized_email = email.strip()
        if any(
            isinstance(item.get("correo"), str)
            and item["correo"].casefold() == normalized_email.casefold()
            for item in users
        ):
            return _error("Ya existe un usuario con ese correo.", 409)

        user_id = max(
            (item.get("id", 0) for item in users if isinstance(item.get("id"), int)),
            default=0,
        ) + 1
        new_user = {
            "id": user_id,
            "correo": normalized_email,
            "contrasena": generate_password_hash(password),
            "rol": role,
            "activo": True,
        }
        users.append(new_user)
        _write_users(users)
        return jsonify(usuario=_public_user(new_user)), 201


@app.route("/usuarios/<int:user_id>", methods=["GET", "PUT", "PATCH", "DELETE"])
@_require_roles("Administrador")
def usuario_detalle(user_id):
    with _usuarios_lock:
        users = _read_users()
        user_index = next(
            (index for index, item in enumerate(users) if item.get("id") == user_id),
            None,
        )
        if user_index is None:
            return _error("Usuario no encontrado.", 404)

        target = users[user_index]
        if request.method == "GET":
            return jsonify(usuario=_public_user(target))

        if request.method == "DELETE":
            if (
                target.get("activo") is True
                and _normalize_role(target.get("rol")) == "Administrador"
                and _active_admin_count(users) <= 1
            ):
                return _error("No se puede eliminar al último administrador activo.", 409)
            users.pop(user_index)
            _write_users(users)
            return jsonify(mensaje="Usuario eliminado correctamente."), 200

        body = _json_body()
        if body is None:
            return _error("El cuerpo de la solicitud debe ser un objeto JSON.", 400)

        updated = target.copy()
        if "correo" in body:
            email = body["correo"]
            if not isinstance(email, str) or not email.strip():
                return _error("El correo no puede estar vacío.", 400)
            updated["correo"] = email.strip()
        if "contrasena" in body:
            password = body["contrasena"]
            if not isinstance(password, str) or not password:
                return _error("La contraseña no puede estar vacía.", 400)
            updated["contrasena"] = generate_password_hash(password)
        if "rol" in body:
            role = _normalize_role(body["rol"])
            if role is None:
                return _error("El rol debe ser Administrador, Encargado o Vendedor.", 400)
            updated["rol"] = role
        if "activo" in body:
            if not isinstance(body["activo"], bool):
                return _error("El estado activo debe ser booleano.", 400)
            updated["activo"] = body["activo"]

        if any(
            index != user_index
            and isinstance(item.get("correo"), str)
            and item["correo"].casefold() == updated["correo"].casefold()
            for index, item in enumerate(users)
        ):
            return _error("Ya existe un usuario con ese correo.", 409)

        removes_active_admin = (
            target.get("activo") is True
            and _normalize_role(target.get("rol")) == "Administrador"
            and not (
                updated.get("activo") is True
                and _normalize_role(updated.get("rol")) == "Administrador"
            )
        )
        if removes_active_admin and _active_admin_count(users) <= 1:
            return _error("No se puede desactivar ni degradar al último administrador activo.", 409)

        users[user_index] = updated
        _write_users(users)
        return jsonify(usuario=_public_user(updated)), 200


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--init-admin",
        action="store_true",
        help="Replace data/usuarios.json with the initial administrator account.",
    )
    arguments = parser.parse_args()
    if arguments.init_admin:
        initialize_admin_user()
        print("Usuario inicial creado: admin@supermercado.com")
    else:
        app.run(host="127.0.0.1", port=5000, debug=os.environ.get("FLASK_DEBUG") == "1")
