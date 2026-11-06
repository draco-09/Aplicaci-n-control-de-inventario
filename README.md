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
   Abrir Google Chrome e ingresar a la URL: `http://127.0.0`
