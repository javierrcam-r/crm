# CRM Camila Fernández

Sistema CRM/Agenda personal para gestión de clientes, visitas, pedidos y reportes de ventas.

![Next.js](https://img.shields.io/badge/Next.js-14.2-black)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Docker](https://img.shields.io/badge/Docker-Ready-blue)

## 📋 Características

### Módulos Principales

- **Dashboard**: KPIs de actividad diaria, visitas pendientes, pedidos recientes
- **Clientes y Prospectos**: Gestión completa con estados (Cliente, Prospecto, Perdido)
- **Calendario/Agenda**: Vista mensual, semanal y lista de visitas
- **Catálogo de Productos**: CRUD con categorías y precios
- **Pedidos**: Creación con ítems editables, bonificaciones y observaciones
- **Reportes**: Resúmenes diarios/por período con exportación CSV
- **Export PDF**: Descarga de pedidos en formato PDF minimalista

### Funcionalidades Clave

- ✅ Interfaz moderna y elegante (blanco + tipografía Plus Jakarta Sans)
- ✅ Export PDF por pedido con nombre personalizado
- ✅ Diseño responsivo (móvil + escritorio)
- ✅ Acciones rápidas en visitas (crear pedido, comentarios)
- ✅ Exportación de datos a CSV
- ✅ Dockerizado para fácil despliegue

---

## 🐳 Despliegue con Docker (Recomendado)

### Opción 1: Docker Compose (Más Fácil)

```bash
# 1. Clonar el proyecto
git clone <tu-repo>
cd CRM

# 2. Crear archivo .env con tus credenciales de Supabase
echo "NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co" > .env
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key" >> .env

# 3. Construir e iniciar
docker-compose up -d

# 4. ¡Listo! Abre http://localhost:3000
```

### Opción 2: Docker Manual

```bash
# Construir la imagen
docker build -t crm-camila-fernandez .

# Ejecutar el contenedor
docker run -d \
  -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key \
  --name crm-app \
  crm-camila-fernandez
```

### Comandos Docker Útiles

```bash
# Ver logs
docker-compose logs -f

# Detener
docker-compose down

# Reconstruir después de cambios
docker-compose up -d --build

# Reiniciar
docker-compose restart
```

---

## 🚀 Instalación Manual (Desarrollo)

### Prerrequisitos

- Node.js 18+ 
- npm o yarn
- Cuenta en [Supabase](https://supabase.com)

### 1. Instalar dependencias

```bash
cd CRM
npm install
```

### 2. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) e inicia sesión
2. Crea un nuevo proyecto
3. Ve a **Project Settings > API** y copia:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **anon public key**

### 3. Configurar variables de entorno

Crea el archivo `.env` en la raíz del proyecto:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

### 4. Ejecutar migraciones SQL

1. En Supabase, ve a **SQL Editor**
2. Ejecuta en orden:
   - `supabase/migrations/001_initial_schema.sql` (esquema)
   - `supabase/migrations/002_seed_data.sql` (datos de ejemplo)
   - `supabase/migrations/003_disable_rls_dev.sql` (modo desarrollo sin login)

### 5. Iniciar el servidor

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 📁 Estructura del Proyecto

```
CRM/
├── src/
│   ├── app/
│   │   ├── (dashboard)/          # Páginas principales
│   │   │   ├── page.tsx          # Dashboard
│   │   │   ├── clientes/         # Módulo clientes
│   │   │   ├── calendario/       # Módulo visitas
│   │   │   ├── productos/        # Módulo productos
│   │   │   ├── pedidos/          # Módulo pedidos
│   │   │   └── reportes/         # Módulo reportes
│   │   ├── globals.css           # Estilos globales + print styles
│   │   └── layout.tsx            # Layout raíz
│   ├── components/
│   │   ├── layout/               # Sidebar
│   │   └── ui/                   # Componentes reutilizables
│   ├── lib/
│   │   ├── services/             # Servicios de datos
│   │   ├── supabase/             # Cliente Supabase
│   │   └── utils.ts              # Utilidades
│   └── types/
│       └── database.ts           # Tipos TypeScript
├── supabase/
│   └── migrations/               # Scripts SQL
├── Dockerfile                    # Configuración Docker
├── docker-compose.yml            # Orquestación Docker
├── .dockerignore                 # Archivos a excluir en Docker
└── README.md
```

## 🗄️ Modelo de Datos

| Tabla | Descripción |
|-------|-------------|
| `customers` | Clientes y prospectos |
| `visits` | Visitas programadas y completadas |
| `products` | Catálogo de productos |
| `orders` | Pedidos con totales calculados |
| `order_items` | Ítems de cada pedido |

---

## 🌐 Despliegue en Producción

### Con Docker (VPS/Cloud)

```bash
# En tu servidor
git clone <tu-repo>
cd CRM
cp .env.example .env
# Editar .env con tus credenciales
docker-compose up -d
```

### Vercel

1. Sube el proyecto a GitHub
2. Importa en [vercel.com](https://vercel.com)
3. Configura las variables de entorno:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!

### Otros proveedores

Compatible con: Netlify, Railway, AWS Amplify, DigitalOcean App Platform

---

## 🔧 Scripts Disponibles

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de producción
npm run start    # Iniciar build de producción
npm run lint     # Verificar código
```

---

## 📝 Licencia

MIT - Libre para uso personal y comercial.

---

Desarrollado con ❤️ para Camila Fernández.
