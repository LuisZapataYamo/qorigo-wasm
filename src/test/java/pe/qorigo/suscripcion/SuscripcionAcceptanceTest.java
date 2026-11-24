package pe.qorigo.suscripcion;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import pe.qorigo.support.BaseAcceptanceTest;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class SuscripcionAcceptanceTest extends BaseAcceptanceTest {

    @Test
    void paCu0301_crearSuscripcionActivaConMetricas() {
        JsonPath creada = admin().body(peticion(53.90, "PEN", 6, 15))
                .when().post("/suscripciones")
                .then()
                .statusCode(201)
                .header("Location", containsString("/suscripciones/"))
                .body("estado", is("ACTIVA"))
                .body("plazasOcupadas", is(0))
                .body("plazasLibres", is(6))
                .body("alertaDeficit", is(false))
                .body("periodicidad", is("MENSUAL"))
                .extract().jsonPath();

        Long id = creada.getLong("idSuscripcion");
        Assertions.assertEquals(8.98, creada.getDouble("costoPorPlaza"), 0.001);
        Assertions.assertEquals(0.00, creada.getDouble("cobertura"), 0.001);

        Map<String, Object> fila = db.unico("SELECT costo, capacidad, estado FROM suscripcion WHERE id_suscripcion = ?", id);
        Assertions.assertNotNull(fila);
        Assertions.assertEquals(0, new BigDecimal("53.90").compareTo((BigDecimal) fila.get("costo")));
        Assertions.assertEquals(6, ((Number) fila.get("capacidad")).intValue());
        Assertions.assertEquals("ACTIVA", fila.get("estado"));

        Map<String, Object> auditoria = db.unico(
                "SELECT accion FROM auditoria WHERE entidad = 'SUSCRIPCION' AND id_entidad = ?", id);
        Assertions.assertNotNull(auditoria);
        Assertions.assertEquals("CREAR", auditoria.get("accion"));

        admin().when().get("/suscripciones/" + id)
                .then()
                .statusCode(200)
                .body("idSuscripcion", is(id.intValue()))
                .body("plazasLibres", is(6))
                .body("costoPorPlaza", notNullValue());
    }

    @Test
    void paCu0302_costoInvalidoSeRechazaIndicandoElCampo() {
        admin().body(peticion(0, "PEN", 6, 15))
                .when().post("/suscripciones")
                .then()
                .statusCode(400)
                .body("codigo", is("VALIDACION"))
                .body("detalles.costo", notNullValue());

        admin().body(peticion(-5, "PEN", 6, 15))
                .when().post("/suscripciones")
                .then()
                .statusCode(400)
                .body("codigo", is("VALIDACION"))
                .body("detalles.costo", notNullValue());

        Assertions.assertEquals(0, db.contar("SELECT COUNT(*) FROM suscripcion"));
    }

    @Test
    void paCu0303_capacidadInvalidaSeRechaza() {
        admin().body(peticion(53.90, "PEN", 0, 15))
                .when().post("/suscripciones")
                .then()
                .statusCode(400)
                .body("codigo", is("VALIDACION"))
                .body("detalles.capacidad", notNullValue());

        Assertions.assertEquals(0, db.contar("SELECT COUNT(*) FROM suscripcion"));
    }

    @Test
    void paCu0304_cambioDeCostoConservaElPeriodoYaGenerado() {
        Long id = crearSuscripcion(53.90, "PEN", 6, 15);
        db.ejecutar("""
                        INSERT INTO costo_suscripcion_periodo (id_suscripcion, periodo, monto)
                        VALUES (?, DATE '2026-11-01', 53.90)
                        """,
                id);

        admin().body(Map.of("costo", new BigDecimal("57.90")))
                .when().patch("/suscripciones/" + id)
                .then()
                .statusCode(200)
                .body("costo", notNullValue())
                .body("estado", is("ACTIVA"));

        Map<String, Object> costoNoviembre = db.unico(
                "SELECT monto FROM costo_suscripcion_periodo WHERE id_suscripcion = ? AND periodo = DATE '2026-11-01'",
                id);
        Assertions.assertNotNull(costoNoviembre);
        Assertions.assertEquals(0, new BigDecimal("53.90").compareTo((BigDecimal) costoNoviembre.get("monto")));

        Map<String, Object> suscripcion = db.unico("SELECT costo FROM suscripcion WHERE id_suscripcion = ?", id);
        Assertions.assertEquals(0, new BigDecimal("57.90").compareTo((BigDecimal) suscripcion.get("costo")));

        Map<String, Object> auditoria = db.unico("""
                SELECT accion, antes, despues
                FROM auditoria
                WHERE entidad = 'SUSCRIPCION' AND id_entidad = ?
                ORDER BY id_auditoria DESC
                LIMIT 1
                """, id);
        Assertions.assertNotNull(auditoria);
        Assertions.assertEquals("ACTUALIZAR_COSTO", auditoria.get("accion"));
        Assertions.assertTrue(auditoria.get("antes").toString().contains("53.9"));
        Assertions.assertTrue(auditoria.get("despues").toString().contains("57.9"));
    }

    @Test
    void paCu0305_suspenderSuscripcion() {
        Long id = crearSuscripcion(53.90, "PEN", 6, 15);

        admin().body(Map.of("estado", "SUSPENDIDA"))
                .when().patch("/suscripciones/" + id)
                .then()
                .statusCode(200)
                .body("estado", is("SUSPENDIDA"));

        admin().queryParam("estado", "SUSPENDIDA")
                .when().get("/suscripciones")
                .then()
                .statusCode(200)
                .body("contenido.idSuscripcion", hasItem(id.intValue()));

        admin().queryParam("estado", "ACTIVA")
                .when().get("/suscripciones")
                .then()
                .statusCode(200)
                .body("contenido.idSuscripcion", org.hamcrest.Matchers.not(hasItem(id.intValue())));

        Map<String, Object> auditoria = db.unico("""
                SELECT accion FROM auditoria
                WHERE entidad = 'SUSCRIPCION' AND id_entidad = ?
                ORDER BY id_auditoria DESC LIMIT 1
                """, id);
        Assertions.assertEquals("CAMBIAR_ESTADO", auditoria.get("accion"));
    }

    private Map<String, Object> peticion(double costo, String moneda, int capacidad, int diaCobro) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("idPlataforma", idPlataforma("YouTube"));
        body.put("nombre", "YouTube Familiar");
        body.put("costo", new BigDecimal(String.valueOf(costo)));
        body.put("moneda", moneda);
        body.put("capacidad", capacidad);
        body.put("diaCobro", diaCobro);
        body.put("fechaInicio", "2026-01-15");
        return body;
    }

    private Long crearSuscripcion(double costo, String moneda, int capacidad, int diaCobro) {
        return admin().body(peticion(costo, moneda, capacidad, diaCobro))
                .when().post("/suscripciones")
                .then().statusCode(201)
                .extract().jsonPath().getLong("idSuscripcion");
    }

    private Long idPlataforma(String nombre) {
        return ((Number) db.unico("SELECT id_plataforma FROM plataforma WHERE nombre = ?", nombre)
                .get("id_plataforma")).longValue();
    }
}
