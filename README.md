# QoriGo API

API REST para la gestión de suscripciones, préstamos, pagos, comprobantes e informes descrita en `docs/plan_v2.md`.

## Stack

- **Java 25** (virtual threads por petición con `@RunOnVirtualThread`)
- **Quarkus 3.40** (REST, Hibernate ORM, Flyway, SmallRye JWT, Scheduler)
- **Jakarta EE** (JAX-RS, CDI, Bean Validation, Persistence, Transaction)
- **MapStruct** para el mapeo entre dominio, persistencia y DTOs
- **Arquitectura hexagonal**: dominio puro, puertos de aplicación y adaptadores de entrada/salida
- **PostgreSQL** como base de datos de producción; H2 en modo PostgreSQL para desarrollo y pruebas locales
- **BCrypt** para contraseñas, JWT firmado con RSA

## Estructura

```
src/main/java/pe/qorigo
├── shared/            # errores, dinero, reloj, identidad, auditoría
├── auth/              # CU-23
├── persona/           # CU-01, CU-02
├── catalogo/          # plataformas, monedas, configuración
├── suscripcion/       # CU-03 a CU-06
├── prestamo/          # CU-07 a CU-11
├── pago/              # CU-12 a CU-16
├── reporte/           # CU-17 a CU-21
└── portal/            # CU-22
```

Cada módulo se divide en `domain` (modelo y reglas), `application` (casos de uso y puertos) e `infrastructure` (adaptadores REST, JPA y servicios técnicos).

## Ejecución

```bash
# desarrollo (H2 en memoria)
mvn quarkus:dev

# pruebas
mvn test

# producción (PostgreSQL)
docker compose up -d
mvn package
java -jar target/quarkus-app/quarkus-run.jar
```

Variables de producción: `DB_URL`, `DB_USER`, `DB_PASSWORD`, `SEED_ADMIN`.

## Notas del entorno

- El JDK 25 instalado en esta máquina no incluía `extnet.dll`; se copió desde el JDK 21 para poder ejecutar Maven. En un JDK 25 estándar no hace falta.
- Las pruebas de aceptación se ejecutan sobre H2 en modo PostgreSQL para que el proyecto sea autocontenido. El perfil `prod` usa PostgreSQL real y las migraciones son compatibles con ambos motores.
