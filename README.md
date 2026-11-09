# 🛒 Gestor de Inventario para Supermercado - MVP
### 🚀 Fábrica de Software - Evidencia de Desarrollo Académico

Este repositorio contiene el Producto Mínimo Viable (MVP) para la gestión y control automatizado de inventarios por lotes y fechas de vencimiento, desarrollado para el curso **Tecnologías WEB**. 

El sistema sigue una arquitectura **MPA (Multi-Page Application)** basada en **Python con Flask**, utilizando **archivos JSON** como mecanismo de persistencia local.

---

## Arquitectura de Carpetas del Proyecto

De acuerdo con el modelo de despliegue y navegación del DERS, el proyecto se estructura bajo el siguiente estándar limpio de Flask:

```text
Aplicación-control-de-inventario/
│
├── app.py                  # Servidor central y enrutamiento de controladores
├── ACUERDO_MVP.md          # Acta de acuerdo formal firmada con el Cliente
├── README.md               # Guía técnica de instalación y ejecución
│
├── data/                   # Capa de persistencia (Base de Datos Local JSON)
│   ├── usuarios.json       # Credenciales, roles y estados de cuenta
│   ├── productos.json      # Catálogo de artículos y existencias mínimas
│   ├── proveedores.json    # Registro y contacto de proveedores activos
│   └── movimientos.json    # Historial unificado de Entradas, Ventas y Alertas
│
├── static/                 # Recursos estáticos de la interfaz web
│   ├── css/
│   │   └── estilos.css     # Estilos globales y paleta de colores DERS
│   └── js/
│       └── validaciones.js # Validaciones de formularios del lado del cliente
│
└── templates/              # Vistas HTML (Renderizadas con Jinja2 en el servidor)
    ├── base.html           # Plantilla madre (Navbar común y sidebar por rol)
    ├── login.html          # Vista del CU-01 (Inicio de sesión)
    ├── panel.html          # Dashboard principal con accesos restringidos por rol
    ├── usuarios.html       # Vista del CU-02 (Gestión de usuarios y roles)
    ├── productos.html      # Vista del CU-03 (Catálogo de productos y categorías)
    ├── proveedores.html    # Vista del CU-10 (Catálogo de proveedores)
    ├── entradas.html       # Vista del CU-04 (Registro de lotes ingresados)
    ├── existencias.html    # Vista del CU-05 (Consulta de saldos comerciales/lotes)
    └── alertas.html        # Vista del CU-07 (Tablero de stock mínimo y vencimientos)
```

---

## Especificaciones de Diseño Visual (Paleta DERS)

La interfaz visual del sistema respeta estrictamente los códigos de diseño acordados en la documentación técnica:

### 1. Colores Generales (Identidad)
* **Azul petróleo (`#234E52`):** Encabezados de tablas, barras superiores y botones principales.
* **Verde petróleo (`#3F7771`):** Menús laterales activos y componentes secundarios.
* **Gris verdoso claro (`#F4F6F5`):** Fondo general de la aplicación.
* **Carbón verdoso (`#263533`):** Tipografía principal y títulos destacados.
* **Gris suave (`#DCE5E2`):** Bordes de contenedores y campos de texto de formularios.

### 2. Colores Semánticos (Estados)
* **Correcto (`#237447` | Fondo: `#E4F3EA`):** Confirmaciones de transacciones exitosas (Ej: Entrada o Venta registrada).
* **Advertencia (`#8A5A00` | Fondo: `#FFF1D6`):** Alertas locales de stock próximo al mínimo.
* **Crítico (`#B42318` | Fondo: `#FCE8E6`):** Lotes vencidos detectados o errores de validación de credenciales.
* **Informativo (`#315896` | Fondo: `#E8EEF8`):** Textos de ayuda y guías de orientación al usuario en menús.

---

##  Requisitos e Instalación Local

### Prerrequisitos
* Python 3.10 o superior instalado en el sistema.
* Navegador Google Chrome (Entorno objetivo probado).

### Instrucciones de Despliegue en Localhost
1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com
   cd Aplicación-control-de-inventario
   ```
2. **Crear y activar el entorno virtual (Recomendado):**
   ```bash
   python -m venv .venv
   # En Windows (CMD/PowerShell):
   .venv\Scripts\activate
   # En Linux/macOS:
   source .venv/bin/activate
   ```
3. **Instalar dependencias necesarias:**
   ```bash
   pip install flask
   ```
4. **Ejecutar el servidor local:**
   ```bash
   python app.py
   ```
5. **Acceder desde el navegador:**
   Abrir Google Chrome e ingresar a la URL: `http://127.0.0.1:5000`.

### Backend de usuarios

El backend expone rutas JSON para autenticación y administración de usuarios. El archivo `data/usuarios.json` se crea automáticamente si no existe. En una instalación nueva, crea el primer administrador con `POST /usuarios`; ese alta inicial es la única operación de usuarios permitida sin sesión. Después, solo un administrador autenticado puede gestionar usuarios.

Para restablecer el archivo local con un único administrador inicial, ejecuta `python app.py --init-admin`. Este comando reemplaza `data/usuarios.json` atómicamente y crea `admin@supermercado.com` con la contraseña inicial `admin123`; úsala solo para inicializar o restablecer datos de desarrollo. Después, ejecuta `python app.py` para iniciar el servidor.

Como alternativa, para crear el primer administrador desde la aplicación sin borrar datos, envía JSON con los campos `correo`, `contrasena` y `rol`:

```json
{
  "correo": "admin@supermercado.com",
  "contrasena": "cambia-esta-contrasena",
  "rol": "Administrador"
}
```

La contraseña se guarda con hash. Se aceptan los roles `Administrador`, `Encargado` y `Vendedor` (sin distinguir mayúsculas/minúsculas). Los usuarios existentes con contraseñas en texto plano se convierten a hash al iniciar sesión correctamente.

| Método | Ruta | Acceso | Función |
| :--- | :--- | :--- | :--- |
| `POST` | `/login` | Público | Inicia sesión con `correo` y `contrasena`. |
| `POST` | `/logout` | Público | Cierra la sesión actual. |
| `GET` | `/usuarios` | Administrador | Lista los usuarios. |
| `POST` | `/usuarios` | Administrador (excepto alta inicial) | Crea un usuario. |
| `GET` | `/usuarios/<id>` | Administrador | Consulta un usuario. |
| `PUT`, `PATCH` | `/usuarios/<id>` | Administrador | Actualiza correo, contraseña, rol o estado `activo`. |
| `DELETE` | `/usuarios/<id>` | Administrador | Elimina un usuario. |

Las rutas de sesión aceptan y devuelven JSON; el navegador conserva la sesión mediante una cookie. Todas las respuestas de usuario omiten la contraseña. La aplicación impide desactivar, degradar o eliminar al último administrador activo.

Define `FLASK_SECRET_KEY` con un valor secreto estable antes de ejecutar el servidor si necesitas conservar sesiones entre reinicios. En desarrollo local, si no se define, se genera una clave aleatoria al iniciar la aplicación.
