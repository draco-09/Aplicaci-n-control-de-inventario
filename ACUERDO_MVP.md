# 📄 Acta de Acuerdo para Desarrollo de MVP
### Instrumento de Aprendizaje – Curso Tecnologías WEB

**Propósito:** Registrar el acuerdo mínimo entre Cliente (rol académico) y Fábrica de Software (equipo estudiante) sobre el MVP, basado en el DERS. Este formato es académico y se centra en: objetivo, alcance, exclusiones y cronograma.

---

## 1. Información General
* **Curso:** Tecnologías WEB
* **Proyecto / Producto (Nombre del MVP):** Gestor de Inventario para Supermercado
* **Fecha del acuerdo:** 05/11/2026
* **Versión del acta:** v1.0

---

## 2. Participantes del Acuerdo

### 2.1 Por el Cliente (Rol Académico)
* **Juan Fernando Jaimes Pérez** (Firma registrada)
* **Andrés Miguel Veloza Pinzón** (Firma registrada)
* **Jefferson Jhoan Lázaro Jaimes** (Firma registrada)
* **Angye Paola Santos Omaña** (Firma registrada)

### 2.2 Por la Fábrica (Equipo Estudiante)
* 👑 **Jhoan David Pérez Blanco** – Líder/PM y Back-end (Acceso y navegación)
* ⚙️ **Carlos Santiago Herrera Jaimes** – Back-end (Persistencia, entradas y ventas)
* 🎨 **Anderson Duvian Nuncira Martínez** – Front-end y Back-end (Catálogo, proveedores y existencias)
* 🧪 **Elkin Alonso Torres Sandoval** – QA/Pruebas y UX/UI

---

## 3. Objetivo del MVP

* **Objetivo general:** Construir una aplicación web local que permita al personal de un supermercado registrar productos, proveedores, entradas por lote y ventas, y consultar existencias y alertas, para mantener el inventario actualizado y evitar faltantes y pérdidas por vencimiento.
* **Problema o necesidad:** El supermercado necesita controlar sus existencias por lote, incluyendo fechas de vencimiento, sin depender de registros manuales dispersos. Sin este control se venden o conservan productos vencidos y no se detecta a tiempo el stock bajo.
* **Usuarios objetivo:** 
  * 👤 **Administrador:** Gestiona usuarios y consulta alertas.
  * 🔑 **Encargado de inventario:** Registra entradas y catálogos.
  * 🛒 **Vendedor:** Realiza las salidas/ventas.

---

## 4. Alcance del MVP (Lo que se construirá)

### 4.1 Funcionalidades Principales
1. **CU-01:** Iniciar sesión según el rol del usuario (administrador, encargado o vendedor).
2. **CU-02:** Gestionar usuarios y roles (registrar, modificar, asignar rol y activar/desactivar cuentas).
3. **CU-03:** Gestionar productos y categorías (código único, precio, existencia mínima, control de vencimiento).
4. **CU-10:** Gestionar proveedores (registrar, consultar, modificar, activar/desactivar).
5. **CU-04:** Registrar entrada de productos con proveedor y lotes (aumenta existencias).
6. **CU-05:** Consultar existencias registradas y disponibles para venta, con detalle por lote.
7. **CU-08:** Registrar venta con descuento automático por lote (vencimiento más cercano primero - *Estrategia FEFO*).
8. **CU-07:** Consultar alertas de stock mínimo y lotes vencidos o próximos a vencer.

### 4.2 Alcance Técnico Básico
* **Tipo de aplicación:** MPA (Multi-Page Application - Páginas generadas en el servidor).
* **Front-end:** HTML, CSS y JavaScript básico (Uso de plantillas Jinja2 integradas en Flask).
* **Back-end / API:** Python 3 con el framework ligero **Flask**.
* **Base de datos:** Archivos **JSON** locales (Persistencia nativa mediante manipulación de listas/diccionarios en Python, sin motores relacionales).
* **Autenticación:** Sesiones de Flask nativas basada en cookies seguras con validación de roles en el servidor.
* **Entorno:** Ejecución local (`localhost`) en entorno de desarrollo.
* **Navegador objetivo:** Google Chrome.

---

## 5. Fuera de Alcance del MVP (Lo que NO se incluirá)

### 5.1 Exclusiones Funcionales
* **CU-06:** No incluye registrar salidas manuales de productos por daño, pérdida o devolución.
* **CU-09:** No incluye reportes de inventario, movimientos ni ventas por período.
* **CU-11:** No incluye conteo físico, solicitudes de ajuste ni su aprobación.
* No incluye alertas automatizadas (Notificaciones push ni envíos de correos electrónicos).
* No incluye pasarelas de pago, facturación electrónica oficial ni integración con hardware externo (Lectores de código de barras).

### 5.2 Exclusiones Técnicas
* No incluye despliegue en servidores en la nube ni acceso multi-dispositivo externo.
* No incluye base de datos relacional (SQL) ni motores NoSQL comerciales (Alta concurrencia excluida).
* No incluye desarrollo de aplicación móvil nativa ni hojas de diseño adaptable (Responsive) avanzado.
* No incluye capas complejas de seguridad perimetral (Cifrado de transporte HTTPS de producción o flujos de recuperación de contraseñas).

---

## 6. Cronograma y Metodología de Trabajo
* **Fecha de entrega final:** 20/11/2026
* **Duración:** 2 semanas

### Hitos de Trabajo (Sprints Cortos)

| Hito | Fecha Límite | Resultado Esperado y Entregables |
| :--- | :---: | :--- |
| **Hito 1: Base técnica e Identidad** | 09/11 | Inicialización del repositorio, configuración del entorno Flask, persistencia base de archivos JSON leídos/escritos con éxito, sistema de login funcional y vistas de menús dinámicos mapeados según el rol del usuario asignado. |
| **Hito 2: Gestión de Catálogos** | 12/11 | Módulos CRUD completos para productos, asignación de categorías y administración de la base de proveedores activos (Crear, consultar, actualizar y cambiar estados lógicos de activación). |
| **Hito 3: Flujo Central de Inventarios** | 16/11 | Registro de transacciones de entrada vinculando proveedor y desglose detallado por lotes físicos. Implementación del algoritmo de salida automática para ventas (*First Expired, First Out*). |
| **Hito 4: Tablero de Alertas y Demo** | 20/11 | Mapeo lógico en el backend para renderizar alertas de inventario crítico debajo del stock mínimo exigido y filtrado de lotes próximos a caducar. Pruebas de integración del código y preparación del Pitch de defensa. |

---

## 7. Estructura de Datos Propuesta (`.json`)
Para garantizar que el equipo trabaje de forma unificada, los archivos JSON mantendrán el siguiente esquema estructural mínimo:

### `usuarios.json`
```json
[
  {
    "id": 1,
    "correo": "admin@supermercado.com",
    "contrasena": "admin123",
    "rol": "administrador",
    "activo": true
  }
]
```

### `inventario.json`
```json
[
  {
    "codigo_unico": "PROD-001",
    "nombre": "Leche Entera 1L",
    "categoria": "Lácteos",
    "precio": 4200,
    "existencia_minima": 20,
    "proveedor_id": 101,
    "lotes": [
      {
        "id_lote": "LOTE-A1",
        "cantidad": 15,
        "fecha_vencimiento": "2026-11-15"
      }
    ]
  }
]
```

---

## 8. Entregable Académico (Evidencia Mínima)
* **Demo funcional del MVP:** Sí.
* **Entorno:** Local (`localhost`).
* **Repositorio oficial:** `Aplicación-control-de-inventario`
* **Defensa del proyecto:** Exposición corta en formato Pitch (3 a 5 minutos).
