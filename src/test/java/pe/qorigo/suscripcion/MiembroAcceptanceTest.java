package pe.qorigo.suscripcion;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.path.json.JsonPath;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import pe.qorigo.support.BaseAcceptanceTest;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class MiembroAcceptanceTest extends BaseAcceptanceTest {

    @Test
    void paCu0401_agregarMiembroExistenteRecalculaCobertura() {
        Long idSuscripcion = crearSuscripcion("YouTube Familiar", 53.90, 6, "YouTube");
        Long nayeli = crearPersona("Nayeli", "Zapata Yamo");

        JsonPath respuesta = agregarMiembro(idSuscripcion, cuerpoMiembro(nayeli, 15.00))
                .then()
                .statusCode(201)
                .body("miembro.estado", is("ACTIVO"))
                .body("miembro.idPersona", is(nayeli.intValue()))
                .body("miembro.montoAcordado", notNullValue())
                .body("suscripcion.plazasOcupadas", is(1))
                .body("suscripcion.plazasLibres", is(5))
                .body("suscripcion.alertaDeficit", is(true))
                .body("suscripcion.miembros", hasSize(1))
                .extract().jsonPath();

        Assertions.assertEquals(-38.90, respuesta.getDouble("suscripcion.cobertura"), 0.001);

        admin().when().get("/suscripciones/" + idSuscripcion)
                .then()
                .statusCode(200)
                .body("miembros", hasSize(1))
                .body("miembros[0].nombres", is("Nayeli"))
                .body("miembros[0].apellidos", is("Zapata Yamo"))
                .body("plazasLibres", is(5));

        Assertions.assertEquals(1, db.contar(
                "SELECT COUNT(*) FROM miembro_suscripcion WHERE id_suscripcion = ? AND estado = 'ACTIVO'",
                idSuscripcion));
    }

    @Test
    void paCu0402_personaInexistenteSeCreaAlVuelo() {
        Long idSuscripcion = crearSuscripcion("YouTube Familiar", 53.90, 6, "YouTube");

        Map<String, Object> persona = new LinkedHashMap<>();
        persona.put("nombres", "Kassandra");
        persona.put("apellidos", "Cisneros Zapata");
        persona.put("documento", "71000001");

        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("persona", persona);
        cuerpo.put("montoAcordado", new BigDecimal("15.00"));
        cuerpo.put("fechaInicio", "2026-11-24");

        Long idPersona = agregarMiembro(idSuscripcion, cuerpo)
                .then()
                .statusCode(201)
                .body("miembro.nombres", is("Kassandra"))
                .body("miembro.apellidos", is("Cisneros Zapata"))
                .body("miembro.idPersona", notNullValue())
                .extract().jsonPath().getLong("miembro.idPersona");

        admin().queryParam("q", "kassandra")
                .when().get("/personas")
                .then()
                .statusCode(200)
                .body("contenido.idPersona", org.hamcrest.Matchers.hasItem(idPersona.intValue()));

        Assertions.assertEquals(1, db.contar(
                "SELECT COUNT(*) FROM miembro_suscripcion WHERE id_persona = ? AND id_suscripcion = ?",
                idPersona, idSuscripcion));
    }

    @Test
    void paCu0403_sinPlazasLibresSeRechaza() {
        Long idSuscripcion = crearSuscripcion("Obsidian Personal", 18.00, 1, "Obsidian");
        Long titular = crearPersona("Titular", "Obsidian");
        Long otra = crearPersona("Otra", "Persona");

        agregarMiembro(idSuscripcion, cuerpoMiembro(titular, 18.00))
                .then().statusCode(201);

        agregarMiembro(idSuscripcion, cuerpoMiembro(otra, 18.00))
                .then()
                .statusCode(409)
                .body("codigo", is("SIN_PLAZAS"))
                .body("mensaje", notNullValue());

        Assertions.assertEquals(1, db.contar(
                "SELECT COUNT(*) FROM miembro_suscripcion WHERE id_suscripcion = ?", idSuscripcion));
    }

    @Test
    void paCu0404_membresiaDuplicadaSeRechaza() {
        Long idSuscripcion = crearSuscripcion("YouTube Familiar", 53.90, 6, "YouTube");
        Long nayeli = crearPersona("Nayeli", "Zapata Yamo");

        agregarMiembro(idSuscripcion, cuerpoMiembro(nayeli, 15.00))
                .then().statusCode(201);
        agregarMiembro(idSuscripcion, cuerpoMiembro(nayeli, 15.00))
                .then()
                .statusCode(409)
                .body("codigo", is("MIEMBRO_DUPLICADO"));

        Assertions.assertEquals(1, db.contar(
                "SELECT COUNT(*) FROM miembro_suscripcion WHERE id_suscripcion = ? AND id_persona = ?",
                idSuscripcion, nayeli));
    }

    @Test
    void paCu0405_plazaPropiaQuedaEnMontoCero() {
        Long idSuscripcion = crearSuscripcion("Obsidian Personal", 18.00, 1, "Obsidian");
        Long titular = crearPersona("Titular", "Obsidian");

        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("idPersona", titular);
        cuerpo.put("esPlazaPropia", true);
        cuerpo.put("fechaInicio", "2026-11-24");

        JsonPath respuesta = agregarMiembro(idSuscripcion, cuerpo)
                .then()
                .statusCode(201)
                .body("miembro.esPlazaPropia", is(true))
                .body("suscripcion.plazasLibres", is(0))
                .extract().jsonPath();

        Assertions.assertEquals(0.00, respuesta.getDouble("miembro.montoAcordado"), 0.001);

        Map<String, Object> fila = db.unico(
                "SELECT monto_acordado, es_plaza_propia FROM miembro_suscripcion WHERE id_persona = ?", titular);
        Assertions.assertEquals(0, BigDecimal.ZERO.compareTo((BigDecimal) fila.get("monto_acordado")));
        Assertions.assertEquals(Boolean.TRUE, fila.get("es_plaza_propia"));
    }

    @Test
    void paCu0406_plazaPropiaConMontoSeRechaza() {
        Long idSuscripcion = crearSuscripcion("Obsidian Personal", 18.00, 1, "Obsidian");
        Long titular = crearPersona("Titular", "Obsidian");

        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("idPersona", titular);
        cuerpo.put("esPlazaPropia", true);
        cuerpo.put("montoAcordado", new BigDecimal("5.00"));
        cuerpo.put("fechaInicio", "2026-11-24");

        agregarMiembro(idSuscripcion, cuerpo)
                .then()
                .statusCode(400)
                .body("codigo", is("VALIDACION"))
                .body("detalles.montoAcordado", notNullValue());

        Assertions.assertEquals(0, db.contar(
                "SELECT COUNT(*) FROM miembro_suscripcion WHERE id_suscripcion = ?", idSuscripcion));
    }

    @Test
    void paCu0407_alertaDeDeficitNoBloqueaElAlta() {
        Long idSuscripcion = crearSuscripcion("YouTube Familiar", 53.90, 6, "YouTube");
        Long nayeli = crearPersona("Nayeli", "Zapata Yamo");
        Long ernesto = crearPersona("Ernesto", "Quispe Rojas");
        Long angelica = crearPersona("Angelica", "Cisneros Zapata");

        agregarMiembro(idSuscripcion, cuerpoMiembro(nayeli, 15.00)).then().statusCode(201);
        agregarMiembro(idSuscripcion, cuerpoMiembro(ernesto, 15.00)).then().statusCode(201);

        JsonPath respuesta = agregarMiembro(idSuscripcion, cuerpoMiembro(angelica, 14.00))
                .then()
                .statusCode(201)
                .body("suscripcion.alertaDeficit", is(true))
                .body("suscripcion.plazasLibres", is(3))
                .extract().jsonPath();

        Assertions.assertEquals(-9.90, respuesta.getDouble("suscripcion.cobertura"), 0.001);
        Assertions.assertEquals(3, db.contar(
                "SELECT COUNT(*) FROM miembro_suscripcion WHERE id_suscripcion = ? AND estado = 'ACTIVO'",
                idSuscripcion));
    }

    @Test
    void paCu0408_sinDeficitCuandoLosAportesCubrenElCosto() {
        Long idSuscripcion = crearSuscripcion("Plan Compartido", 30.00, 5, "Microsoft");
        double[] montos = {10.00, 5.00, 5.00, 5.00, 5.00};

        JsonPath ultima = null;
        for (int i = 0; i < montos.length; i++) {
            Long persona = crearPersona("Persona" + (i + 1), "Plan Compartido");
            ultima = agregarMiembro(idSuscripcion, cuerpoMiembro(persona, montos[i]))
                    .then()
                    .statusCode(201)
                    .extract().jsonPath();
        }

        Assertions.assertNotNull(ultima);
        Assertions.assertEquals(0.00, ultima.getDouble("suscripcion.cobertura"), 0.001);
        Assertions.assertFalse(ultima.getBoolean("suscripcion.alertaDeficit"));
        Assertions.assertEquals(0, ultima.getInt("suscripcion.plazasLibres"));
    }

    @Test
    void paCu0409_concurrenciaRespetaLaCapacidad() throws Exception {
        Long idSuscripcion = crearSuscripcion("Plaza Unica", 10.00, 1, "Microsoft");
        Long personaA = crearPersona("Concurrente", "Alfa");
        Long personaB = crearPersona("Concurrente", "Beta");

        Map<String, Object> cuerpoA = cuerpoMiembro(personaA, 10.00);
        Map<String, Object> cuerpoB = cuerpoMiembro(personaB, 10.00);

        CountDownLatch listo = new CountDownLatch(2);
        CountDownLatch salida = new CountDownLatch(1);
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            Future<Integer> primera = executor.submit(() -> {
                listo.countDown();
                salida.await();
                return agregarMiembro(idSuscripcion, cuerpoA).then().extract().statusCode();
            });
            Future<Integer> segunda = executor.submit(() -> {
                listo.countDown();
                salida.await();
                return agregarMiembro(idSuscripcion, cuerpoB).then().extract().statusCode();
            });
            Assertions.assertTrue(listo.await(5, TimeUnit.SECONDS));
            salida.countDown();

            int estadoA = primera.get(30, TimeUnit.SECONDS);
            int estadoB = segunda.get(30, TimeUnit.SECONDS);
            Assertions.assertEquals(Set.of(201, 409), Set.of(estadoA, estadoB));
        }

        Assertions.assertEquals(1, db.contar(
                "SELECT COUNT(*) FROM miembro_suscripcion WHERE id_suscripcion = ? AND estado = 'ACTIVO'",
                idSuscripcion));
    }

    private io.restassured.response.Response agregarMiembro(Long idSuscripcion, Map<String, Object> cuerpo) {
        return admin().body(cuerpo)
                .when().post("/suscripciones/" + idSuscripcion + "/miembros")
                .then().extract().response();
    }

    private Map<String, Object> cuerpoMiembro(Long idPersona, double monto) {
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("idPersona", idPersona);
        cuerpo.put("montoAcordado", BigDecimal.valueOf(monto));
        cuerpo.put("fechaInicio", "2026-11-24");
        return cuerpo;
    }

    private Long crearSuscripcion(String nombre, double costo, int capacidad, String plataforma) {
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("idPlataforma", idPlataforma(plataforma));
        cuerpo.put("nombre", nombre);
        cuerpo.put("costo", BigDecimal.valueOf(costo));
        cuerpo.put("moneda", "PEN");
        cuerpo.put("capacidad", capacidad);
        cuerpo.put("diaCobro", 15);
        cuerpo.put("fechaInicio", "2026-01-15");
        return admin().body(cuerpo)
                .when().post("/suscripciones")
                .then().statusCode(201)
                .extract().jsonPath().getLong("idSuscripcion");
    }

    private Long crearPersona(String nombres, String apellidos) {
        return admin().body(Map.of("nombres", nombres, "apellidos", apellidos))
                .when().post("/personas")
                .then().statusCode(201)
                .extract().jsonPath().getLong("idPersona");
    }

    private Long idPlataforma(String nombre) {
        return ((Number) db.unico("SELECT id_plataforma FROM plataforma WHERE nombre = ?", nombre)
                .get("id_plataforma")).longValue();
    }
}
