package pe.qorigo.persona;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import pe.qorigo.support.BaseAcceptanceTest;

import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.nullValue;

@QuarkusTest
class PersonaAcceptanceTest extends BaseAcceptanceTest {

    @Test
    void paCu0101_altaMinimaConAuditoria() {
        long id = admin().body(Map.of("nombres", "Kassandra", "apellidos", "Cisneros Zapata"))
                .when().post("/personas")
                .then()
                .statusCode(201)
                .body("idPersona", notNullValue())
                .body("activo", is(true))
                .body("nombreNormalizado", is("kassandra cisneros zapata"))
                .extract().jsonPath().getLong("idPersona");

        Map<String, Object> auditoria = db.unico(
                "SELECT id_usuario, accion, antes, despues FROM auditoria WHERE entidad = 'PERSONA' AND id_entidad = ?",
                id);
        org.junit.jupiter.api.Assertions.assertNotNull(auditoria);
        org.junit.jupiter.api.Assertions.assertEquals(db.idAdmin().longValue(),
                ((Number) auditoria.get("id_usuario")).longValue());
        org.junit.jupiter.api.Assertions.assertEquals("CREAR", auditoria.get("accion"));
        org.junit.jupiter.api.Assertions.assertNull(auditoria.get("antes"));
        org.junit.jupiter.api.Assertions.assertTrue(auditoria.get("despues").toString().contains("Kassandra"));
    }

    @Test
    void paCu0102_documentoDuplicadoSeRechazaYDevuelveLaPersonaExistente() {
        long existente = admin()
                .body(Map.of("nombres", "Nayeli", "apellidos", "Zapata Yamo", "documento", "12345678"))
                .when().post("/personas")
                .then().statusCode(201)
                .extract().jsonPath().getLong("idPersona");

        admin().body(Map.of("nombres", "Otra", "apellidos", "Persona", "documento", "12345678"))
                .when().post("/personas")
                .then()
                .statusCode(409)
                .body("codigo", is("DOCUMENTO_DUPLICADO"))
                .body("detalles.idPersonaExistente", is(String.valueOf(existente)));

        org.junit.jupiter.api.Assertions.assertEquals(2,
                db.contar("SELECT COUNT(*) FROM persona"));
    }

    @Test
    void paCu0103_nombreSimilarUsarExistenteNoCreaNada() {
        admin().body(Map.of("nombres", "Nayeli", "apellidos", "Zapata Yamo"))
                .when().post("/personas")
                .then().statusCode(201);

        admin().body(Map.of("nombres", "nayelí", "apellidos", "zapata yamo"))
                .when().post("/personas")
                .then()
                .statusCode(409)
                .body("codigo", is("POSIBLE_DUPLICADO"))
                .body("detalles.idsPersonasSimilares", notNullValue());

        org.junit.jupiter.api.Assertions.assertEquals(2,
                db.contar("SELECT COUNT(*) FROM persona"));
    }

    @Test
    void paCu0104_nombreSimilarCrearDeTodosModos() {
        admin().body(Map.of("nombres", "Nayeli", "apellidos", "Zapata Yamo"))
                .when().post("/personas")
                .then().statusCode(201);

        admin().body(Map.of(
                        "nombres", "nayelí",
                        "apellidos", "zapata yamo",
                        "confirmarDuplicado", true))
                .when().post("/personas")
                .then()
                .statusCode(201)
                .body("nombreNormalizado", is("nayeli zapata yamo"));

        org.junit.jupiter.api.Assertions.assertEquals(3,
                db.contar("SELECT COUNT(*) FROM persona"));
    }

    @Test
    void paCu0105_datosObligatorios() {
        admin().body(Map.of("nombres", "SoloNombre"))
                .when().post("/personas")
                .then()
                .statusCode(400)
                .body("codigo", is("VALIDACION"));

        org.junit.jupiter.api.Assertions.assertEquals(1,
                db.contar("SELECT COUNT(*) FROM persona"));
    }

    @Test
    void creacionAlVueloDevuelveLaPersonaCreada() {
        admin().body(Map.of("nombres", "Ernesto", "apellidos", "Quispe Rojas", "telefono", "999111222"))
                .when().post("/personas")
                .then()
                .statusCode(201)
                .body("nombres", is("Ernesto"))
                .body("telefono", is("999111222"))
                .body("documento", nullValue());
    }
}
