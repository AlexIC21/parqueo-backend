# Login (Auth) — Especificacion para Frontend

## Endpoint
- Metodo: POST
- Ruta: /api/v1/auth/login
- Descripcion: Inicia sesion con correo institucional y devuelve un accessToken JWT y datos basicos del usuario.

## Request
### Headers
- Content-Type: application/json

### Body (JSON)
```json
{
  "email": "usuario@ucb.edu.bo",
  "password": "tu_password"
}
```

## Validaciones
- email es obligatorio, debe ser un correo valido y debe terminar en @ucb.edu.bo.
- password es obligatorio (string no vacio).

## Logica principal
- Busca el usuario por email en la tabla users (comparando en minusculas).
- Rechaza si el usuario no existe o esta inactivo (is_active = false).
- La contrasena se valida asi:
  - Si el valor en DB parece un hash bcrypt ($2a/$2b/$2y), compara con bcrypt.
  - Si no, compara texto plano.

## Respuesta exitosa
- Status: 200 OK
- Body:
```json
{
  "message": "Inicio de sesion exitoso",
  "accessToken": "jwt_token",
  "user": {
    "id": 1,
    "email": "usuario@ucb.edu.bo",
    "name": "Nombre Apellido",
    "role": "admin"
  }
}
```

## Campos de respuesta
- accessToken: JWT firmado con el secret configurado en el backend.
- user.id: ID numerico del usuario.
- user.email: correo del usuario.
- user.name: se arma como full_name o, si no existe, nickname, o vacio.
- user.role: rol del usuario.

## Errores comunes
### 400 Bad Request
- Si el correo no es @ucb.edu.bo.
- Mensaje: El correo debe pertenecer al dominio @ucb.edu.bo

### 401 Unauthorized
- Si el correo o contrasena no coinciden.
- Si el usuario esta inactivo.
- Mensaje: Correo o contrasena incorrectos

## Uso del token en rutas protegidas
- Enviar en header:
```
Authorization: Bearer <accessToken>
```
- El backend valida el token y que el usuario siga activo.

## Notas
- El JWT se firma con la variable de entorno JWT_SECRET.
- El login busca la contrasena en la columna password_hash o password (segun exista en la tabla users).
