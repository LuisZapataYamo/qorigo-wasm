package pe.qorigo.persona;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;
import pe.qorigo.support.BaseAcceptanceTest;

import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class PersonaConsultaAcceptanceTest extends BaseAcceptanceTest {

    @Test
    void paCu0201_busquedaSinTildes() {
        admin().body(Map.of("nombres", "Angelica", "apellidos", "Zapata Yamo"))
                .when().post("/personas")
                .then().statusCode(201);

        admin().queryParam("q", "angelíca")
                .when().get("/personas")
                .then()
                .statusCode(200)
                .body("contenido", hasSize(1))
                .body("contenido.nombres", hasItem("Angelica"))
                .body("total", is(1));

        admin().queryParam("q", "ANGELICA")
                .when().get("/personas")
                .then()
                .statusCode(200)
                .body("contenido", hasSize(1))
                .body("contenido.apellidos", hasItem("Zapata Yamo"));
    }

    @Test
    void paCu0202_desactivarPersonaConMovimientosConservaDatos() {
        Long idPersona = crearPersona("Nayeli", "Zapata Yamo", "70000021");

        Long idSuscripcion = crearSuscripcionDePrueba();
        db.ejecutar("""
                        INSERT INTO miembro_suscripcion
                            (id_suscripcion, id_persona, monto_acordado, es_plaza_propia, fecha_inicio, estado)
                        VALUES (?, ?, 50.00, FALSE, DATE '2026-01-15', 'ACTIVO')
                        """,
                idSuscripcion, idPersona);
        db.ejecutar("""
                        INSERT INTO pago (id_persona, moneda, fecha_pago, monto, metodo_pago, estado)
                        VALUES (?, 'PEN', CURRENT_TIMESTAMP, 50.00, 'YAPE', 'REGISTRADO')
                        """,
                idPersona);

        admin().when().delete("/personas/" + idPersona)
                .then()
                .statusCode(409)
                .body("codigo", is("PERSONA_CON_MOVIMIENTOS"))
                .body("mensaje", containsString("Desactívala"));

        admin().body(Map.of("activo", false))
                .when().patch("/personas/" + idPersona)
                .then()
                .statusCode(200)
                .body("activo", is(false));

        Assertions.assertEquals(1, db.contar(
                "SELECT COUNT(*) FROM persona WHERE id_persona = ? AND activo = FALSE", idPersona));
        Assertions.assertEquals(1, db.contar(
                "SELECT COUNT(*) FROM miembro_suscripcion WHERE id_persona = ?", idPersona));
        Assertions.assertEquals(1, db.contar(
                "SELECT COUNT(*) FROM pago WHERE id_persona = ?", idPersona));

        admin().queryParam("estado", "INACTIVO")
                .when().get("/personas")
                .then()
                .statusCode(200)
                .body("contenido.idPersona", hasItem(idPersona.intValue()));

        admin().queryParam("estado", "ACTIVO")
                .when().get("/personas")
                .then()
                .statusCode(200)
                .body("contenido.idPersona", org.hamcrest.Matchers.not(hasItem(idPersona.intValue())));
    }

    @Test
    void paCu0203_editarDatosRegistraValorAnteriorYNuevo() {
        Long idPersona = crearPersonaConTelefono("Ernesto", "Quispe Rojas", "70000022", "999111222");

        admin().body(Map.of("telefono", "988777666", "direccion", "Av. Siempre Viva 123"))
                .when().patch("/personas/" + idPersona)
                .then()
                .statusCode(200)
                .body("telefono", is("988777666"))
                .body("direccion", is("Av. Siempre Viva 123"));

        admin().when().get("/personas/" + idPersona)
                .then()
                .statusCode(200)
                .body("telefono", is("988777666"))
                .body("nombres", is("Ernesto"));

        Map<String, Object> auditoria = db.unico("""
                SELECT accion, antes, despues
                FROM auditoria
                WHERE entidad = 'PERSONA' AND id_entidad = ?
                ORDER BY id_auditoria DESC
                LIMIT 1
                """, idPersona);

        Assertions.assertNotNull(auditoria);
        Assertions.assertEquals("ACTUALIZAR", auditoria.get("accion"));
        Assertions.assertTrue(auditoria.get("antes").toString().contains("999111222"));
        Assertions.assertTrue(auditoria.get("despues").toString().contains("988777666"));
        Assertions.assertTrue(auditoria.get("antes").toString().contains("Ernesto"));
    }

    @Test
    void fichaDePersonaResumeSuscripcionesPrestamosDeudaYPagos() {
        Long idPersona = crearPersona("Nayeli", "Zapata Yamo", "70000023");

        Long idSuscripcion = crearSuscripcionDePrueba();
        db.ejecutar("""
                        INSERT INTO miembro_suscripcion
                            (id_suscripcion, id_persona, monto_acordado, es_plaza_propia, fecha_inicio, estado)
                        VALUES (?, ?, 50.00, FALSE, DATE '2026-01-15', 'ACTIVO')
                        """,
                idSuscripcion, idPersona);
        Long idMiembro = numero(db.unico(
                "SELECT id_miembro FROM miembro_suscripcion WHERE id_persona = ?", idPersona).get("id_miembro"));

        db.ejecutar("""
                        INSERT INTO cargo_suscripcion (id_miembro, periodo, monto, fecha_vencimiento, estado)
                        VALUES (?, DATE '2026-11-01', 50.00, DATE '2026-11-15', 'PARCIAL')
                        """,
                idMiembro);
        Long idCargo = numero(db.unico(
                "SELECT id_cargo FROM cargo_suscripcion WHERE id_miembro = ?", idMiembro).get("id_cargo"));

        db.ejecutar("""
                        INSERT INTO pago (id_persona, moneda, fecha_pago, monto, metodo_pago, estado)
                        VALUES (?, 'PEN', CURRENT_TIMESTAMP, 120.00, 'YAPE', 'REGISTRADO')
                        """,
                idPersona);
        Long idPago = numero(db.unico(
                "SELECT id_pago FROM pago WHERE id_persona = ?", idPersona).get("id_pago"));

        db.ejecutar("""
                        INSERT INTO aplicacion_pago (id_pago, id_cargo, monto_aplicado)
                        VALUES (?, ?, 20.00)
                        """,
                idPago, idCargo);

        db.ejecutar("""
                        INSERT INTO prestamo
                            (id_persona, moneda, capital, tasa_mensual, plazo_meses, fecha_prestamo,
                             fecha_primer_pago, estricto_cumplimiento, estado)
                        VALUES (?, 'PEN', 1000.00, 5.0, 2, DATE '2026-09-01', DATE '2026-10-01', TRUE, 'ACTIVO')
                        """,
                idPersona);
        Long idPrestamo = numero(db.unico(
                "SELECT id_prestamo FROM prestamo WHERE id_persona = ?", idPersona).get("id_prestamo"));

        db.ejecutar("""
                        INSERT INTO cuota_prestamo
                            (id_prestamo, numero_cuota, fecha_vencimiento, capital_programado,
                             interes_programado, monto_programado, monto_original, estado)
                        VALUES (?, 1, DATE '2026-10-01', 475.00, 25.00, 500.00, 500.00, 'PARCIAL')
                        """,
                idPrestamo);
        Long idCuota = numero(db.unico(
                "SELECT id_cuota FROM cuota_prestamo WHERE id_prestamo = ?", idPrestamo).get("id_cuota"));

        db.ejecutar("""
                        INSERT INTO aplicacion_pago (id_pago, id_cuota, monto_aplicado, monto_capital, monto_interes)
                        VALUES (?, ?, 100.00, 80.00, 20.00)
                        """,
                idPago, idCuota);

        io.restassured.path.json.JsonPath ficha = admin()
                .when().get("/personas/" + idPersona + "/ficha")
                .then()
                .statusCode(200)
                .body("persona.idPersona", is(idPersona.intValue()))
                .body("suscripciones", hasSize(1))
                .body("suscripciones[0].nombre", is("YouTube Familiar"))
                .body("suscripciones[0].esPlazaPropia", is(false))
                .body("prestamos", hasSize(1))
                .body("prestamos[0].estado", is("ACTIVO"))
                .body("deudaPorMoneda", hasSize(1))
                .body("deudaPorMoneda[0].moneda", is("PEN"))
                .body("pagosRecientes", hasSize(1))
                .body("pagosRecientes[0].monto", notNullValue())
                .extract().jsonPath();

        Assertions.assertEquals(400.00, ficha.getDouble("prestamos[0].saldoPendiente"), 0.001);
        Assertions.assertEquals(430.00, ficha.getDouble("deudaPorMoneda[0].monto"), 0.001);
        Assertions.assertEquals(120.00, ficha.getDouble("pagosRecientes[0].monto"), 0.001);
    }

    private Long crearPersona(String nombres, String apellidos, String documento) {
        return numero(admin().body(Map.of(
                        "nombres", nombres,
                        "apellidos", apellidos,
                        "documento", documento))
                .when().post("/personas")
                .then().statusCode(201)
                .extract().jsonPath().get("idPersona"));
    }

    private Long crearPersonaConTelefono(String nombres, String apellidos, String documento, String telefono) {
        return numero(admin().body(Map.of(
                        "nombres", nombres,
                        "apellidos", apellidos,
                        "documento", documento,
                        "telefono", telefono))
                .when().post("/personas")
                .then().statusCode(201)
                .extract().jsonPath().get("idPersona"));
    }

    private Long crearSuscripcionDePrueba() {
        db.ejecutar("""
                INSERT INTO suscripcion
                    (id_plataforma, moneda, nombre, costo, periodicidad, capacidad, dia_cobro, fecha_inicio, estado)
                SELECT id_plataforma, 'PEN', 'YouTube Familiar', 80.00, 'MENSUAL', 5, 15, DATE '2026-01-15', 'ACTIVA'
                FROM plataforma WHERE nombre = 'YouTube'
                """);
        return numero(db.unico("SELECT id_suscripcion FROM suscripcion WHERE nombre = 'YouTube Familiar'")
                .get("id_suscripcion"));
    }

    private Long numero(Object valor) {
        return ((Number) valor).longValue();
    }
}
