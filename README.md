# Gestor de Licitaciones IA

Proyecto para gestionar licitaciones de MercadoPúblico con Inteligencia Artificial.

## Despliegue

Ver [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) para instrucciones detalladas de cómo desplegar en Easypanel y conectar con N8N.

## Estructura del Proyecto

- **server.js**: Servidor Backend (Node.js + Express).
- **db.js**: Conexión a Base de Datos (PostgreSQL).
- **public/**: Frontend del Dashboard (HTML, CSS, JS).
- **Dockerfile**: Configuración para construir la imagen Docker (compatible con Easypanel).
- **docker-compose.yml**: Configuración para pruebas locales.
