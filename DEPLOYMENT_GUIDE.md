# Guía de Despliegue: Gestor de Licitaciones IA

Esta guía te llevará paso a paso para desplegar tu aplicación en **Easypanel** y conectarla con **N8N**.

## 1. Preparación (GitHub)
1.  Sube todos los archivos creados a un nuevo repositorio en tu GitHub (ej: `licitaciones-ia`).
    *   Asegúrate de incluir el `Dockerfile`, `package.json`, `server.js`, `db.js` y la carpeta `public`.

## 2. Despliegue en Easypanel
1.  Entra a tu Easypanel.
2.  Crea un nuevo **Project** (ej: "Licitaciones").
3.  **Crear Base de Datos**:
    *   Haz clic en "+ Service" -> "Database" -> "PostgreSQL".
    *   Dale un nombre (ej: `db`).
    *   Espera a que se cree y copia la **Internal Connection URL** (se ve algo como `postgres://postgres:password@db:5432/postgres`).
4.  **Crear la Aplicación**:
    *   Haz clic en "+ Service" -> "App".
    *   **Source**: Selecciona tu repositorio de GitHub.
    *   **Build Method**: Dockerfile.
    *   **Environment Variables**:
        *   `DATABASE_URL`: Pega la URL de la base de datos que copiaste.
        *   `API_KEY`: Inventa una clave segura (ej: `mi-super-clave-secreta-2025`).
        *   `PORT`: `3000`.
    *   Haz clic en **Create & Deploy**.

¡Listo! Easypanel construirá tu app y te dará una URL (ej: `https://licitaciones.tu-dominio.com`).

## 3. Integración con N8N
Ahora configuraremos N8N para que envíe las licitaciones a tu nueva app.

1.  En tu flujo de N8N, después del nodo de IA que analiza el PDF, agrega un nodo **HTTP Request**.
2.  **Configuración del Nodo**:
    *   **Method**: `POST`
    *   **URL**: `https://licitaciones.tu-dominio.com/api/webhooks/tenders` (Usa la URL real de tu app).
    *   **Authentication**: Generic Credential Type -> Header Auth.
        *   Name: `x-api-key`
        *   Value: `mi-super-clave-secreta-2025` (La misma que pusiste en Easypanel).
    *   **Body Parameters** (JSON):
        ```json
        {
          "code": "{{ $json.codigo_licitacion }}",
          "title": "{{ $json.titulo }}",
          "description": "{{ $json.descripcion }}",
          "deadline": "{{ $json.fecha_cierre }}",
          "ai_summary": "{{ $json.resumen_ia }}",
          "ai_score": {{ $json.puntaje }}
        }
        ```
        *(Asegúrate de mapear los campos correctos de tu nodo anterior)*.

## 4. Prueba Final
1.  Ejecuta el flujo de N8N manualmente.
2.  Ve a tu Dashboard (`https://licitaciones.tu-dominio.com`).
3.  ¡Deberías ver aparecer la licitación mágicamente!
