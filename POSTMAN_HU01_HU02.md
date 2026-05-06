# Pruebas Postman - HU01-BE y HU02-BE

Base URL local:
- http://localhost:3000

Nota: Todos los endpoints usan versionado /api/v1.

## Variables recomendadas en Postman
- baseUrl = http://localhost:3000
- token = <JWT_VALIDO>

Ejemplo de payload JWT esperado (solo referencia):
{
  "sub": 1,
  "email": "usuario.demo@ucb.edu.bo",
  "role": "USUARIO"
}

Header para endpoints protegidos:
- Authorization: Bearer {{token}}

## HU01-BE - Disponibilidad publica

### 1) GET /api/v1/parking/availability (publico)
URL:
- {{baseUrl}}/api/v1/parking/availability

Headers:
- No requiere Authorization

Respuesta esperada (ejemplo):
{
  "parkingLotId": 1,
  "parkingLotName": "Parqueo UCB-CBBA Tupuraya 1",
  "autosCapacity": 20,
  "autosOccupied": 1,
  "autosAvailable": 19,
  "motosCapacity": 10,
  "motosOccupied": 0,
  "motosAvailable": 10,
  "totalCapacity": 30,
  "totalOccupied": 1,
  "totalOccupancyPercent": 3.33,
  "status": "DISPONIBLE"
}

Posibles errores:
- 404 Not Found
  - {"message":"No existe disponibilidad registrada.","error":"Not Found","statusCode":404}

## HU02-BE - Proteccion JWT y roles

### 2) GET /api/v1/parking/map/status (protegido)
URL:
- {{baseUrl}}/api/v1/parking/map/status

Headers:
- Authorization: Bearer {{token}}

Respuesta esperada (ejemplo):
{
  "spaces": [
    {
      "spaceCode": "A1",
      "svgElementId": "A1",
      "vehicleType": "AUTO",
      "status": "OCUPADO"
    }
  ]
}

Sin token:
- 401
- {"statusCode":401,"message":"Debe iniciar sesion para acceder a esta funcion.","redirectTo":"/login"}

Token invalido:
- 401
- {"statusCode":401,"message":"Sesion invalida o expirada."}

### 3) GET /api/v1/schedules (protegido, rol USUARIO)
URL:
- {{baseUrl}}/api/v1/schedules

Headers:
- Authorization: Bearer {{token}}

Respuesta esperada (ejemplo):
{
  "schedules": [
    {
      "id": 10,
      "dayOfWeek": 1,
      "startTime": "08:00:00",
      "endTime": "09:00:00",
      "subject": "Base de Datos",
      "classroom": "Aula 3",
      "isActive": true
    }
  ]
}

Sin token:
- 401
- {"statusCode":401,"message":"Debe iniciar sesion para acceder a esta funcion.","redirectTo":"/login"}

Token invalido:
- 401
- {"statusCode":401,"message":"Sesion invalida o expirada."}

Rol no permitido:
- 403
- {"statusCode":403,"message":"No tiene permisos para acceder a esta funcion.","error":"Forbidden"}

### 4) POST /api/v1/schedules (protegido, rol USUARIO)
URL:
- {{baseUrl}}/api/v1/schedules

Headers:
- Authorization: Bearer {{token}}
- Content-Type: application/json

Body (raw JSON):
{
  "dayOfWeek": 1,
  "startTime": "08:00",
  "endTime": "09:00",
  "subject": "Base de Datos",
  "classroom": "Aula 3"
}

Respuesta esperada (ejemplo):
{
  "id": 21,
  "dayOfWeek": 1,
  "startTime": "08:00:00",
  "endTime": "09:00:00",
  "subject": "Base de Datos",
  "classroom": "Aula 3",
  "isActive": true
}

Errores comunes:
- 400 endTime <= startTime
- 400 validaciones de DTO (dayOfWeek fuera de 1-7, formato de hora invalido)
- 401/403 como en endpoints protegidos
