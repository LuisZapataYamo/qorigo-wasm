package pe.qorigo.auth;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import pe.qorigo.support.BaseAcceptanceTest;

import java.util.Map;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;

@QuarkusTest
class AuthAcceptanceTest extends BaseAcceptanceTest {

    @Test
    void paCu2301_loginCorrecto() {
        admin().when().get("/mi/perfil")
                .then()
                .statusCode(200)
                .body("rol", is("ADMIN"))
                .body("email", is("admin@qorigo.local"))
                .body("idPersona", notNullValue());

        given().contentType("application/json")
                .body(Map.of("email", "admin@qorigo.local", "password", "Admin123!"))
                .when().post("/auth/login")
                .then()
                .statusCode(200)
                .body("token", notNullValue())
                .body("usuario.rol", is("ADMIN"))
                .body("usuario.nombres", is("Administrador"));
    }

    @Test
    void paCu2302_passwordIncorrectaMensajeGenerico() {
        given().contentType("application/json")
                .body(Map.of("email", "admin@qorigo.local", "password", "incorrecta"))
                .when().post("/auth/login")
                .then()
                .statusCode(401)
                .body("codigo", is("NO_AUTORIZADO"))
                .body("mensaje", is("Credenciales inválidas"))
                .body(not(containsString("admin@qorigo.local")));
    }

    @Test
    void paCu2303_limiteDeIntentosBloqueaTemporalmente() {
        for (int i = 0; i < 5; i++) {
            given().contentType("application/json")
                    .body(Map.of("email", "admin@qorigo.local", "password", "mala-" + i))
                    .when().post("/auth/login")
                    .then().statusCode(401);
        }
        given().contentType("application/json")
                .body(Map.of("email", "admin@qorigo.local", "password", "mala-final"))
                .when().post("/auth/login")
                .then()
                .statusCode(429)
                .body("codigo", is("DEMASIADOS_INTENTOS"));

        given().contentType("application/json")
                .body(Map.of("email", "admin@qorigo.local", "password", "Admin123!"))
                .when().post("/auth/login")
                .then().statusCode(429);

        limpiarBloqueos();
    }

    @Test
    void paCu2304_usuarioInactivoNoPuedeIniciarSesion() {
        Long idPersona = db.crearPersona("Inactivo", "Prueba", "70000001", "inactivo@qorigo.local");
        crearUsuarioParaPersona(idPersona, "inactivo@qorigo.local", "Secreto123!", "MEMBER");
        db.ejecutar("UPDATE usuario SET activo = FALSE WHERE email_login = ?", "inactivo@qorigo.local");

        given().contentType("application/json")
                .body(Map.of("email", "inactivo@qorigo.local", "password", "Secreto123!"))
                .when().post("/auth/login")
                .then()
                .statusCode(401)
                .body("mensaje", is("Credenciales inválidas"));
    }

    @Test
    void paCu2305_identidadSaleDeLaSesionYNoDelCliente() {
        Long idPersona = db.crearPersona("Nayeli", "Zapata Yamo", "70000002", "nayeli@qorigo.local");
        String token = crearUsuarioParaPersona(idPersona, "nayeli@qorigo.local", "Secreto123!", "MEMBER");

        autenticado(token)
                .queryParam("idPersona", db.idAdmin())
                .when().get("/mi/perfil")
                .then()
                .statusCode(200)
                .body("idPersona", is(idPersona.intValue()))
                .body("rol", is("MEMBER"))
                .body("email", is("nayeli@qorigo.local"));
    }

    @Test
    void paCu2306_crearAccesoParaUnaPersona() {
        Long idPersona = db.crearPersona("Nayeli", "Zapata Yamo", "70000003", "nayeli2@qorigo.local");

        admin().body(Map.of(
                        "email", "nayeli2@qorigo.local",
                        "password", "Secreto123!",
                        "rol", "MEMBER"))
                .when().post("/personas/" + idPersona + "/usuario")
                .then()
                .statusCode(201)
                .body("idPersona", is(idPersona.intValue()))
                .body("rol", is("MEMBER"));

        String token = login("nayeli2@qorigo.local", "Secreto123!");
        autenticado(token).when().get("/mi/perfil")
                .then()
                .statusCode(200)
                .body("idPersona", is(idPersona.intValue()));
    }

    @Test
    void paCu2307_recuperacionConTokenDeUnSoloUso() {
        Long idPersona = db.crearPersona("Recupera", "Password", "70000004", "recupera@qorigo.local");
        crearUsuarioParaPersona(idPersona, "recupera@qorigo.local", "Secreto123!", "MEMBER");

        String token = given().contentType("application/json")
                .body(Map.of("email", "recupera@qorigo.local"))
                .when().post("/auth/recuperar")
                .then()
                .statusCode(202)
                .body("mensaje", notNullValue())
                .body("token", notNullValue())
                .extract().path("token");

        given().contentType("application/json")
                .body(Map.of("token", token, "nuevaPassword", "NuevaClave123!"))
                .when().post("/auth/restablecer")
                .then().statusCode(204);

        login("recupera@qorigo.local", "NuevaClave123!");

        given().contentType("application/json")
                .body(Map.of("token", token, "nuevaPassword", "OtraClave123!"))
                .when().post("/auth/restablecer")
                .then()
                .statusCode(400)
                .body("codigo", is("TOKEN_INVALIDO"));

        String segundoToken = given().contentType("application/json")
                .body(Map.of("email", "recupera@qorigo.local"))
                .when().post("/auth/recuperar")
                .then().statusCode(202)
                .extract().path("token");

        db.ejecutar("UPDATE recuperacion_password SET expira_en = CURRENT_TIMESTAMP - INTERVAL '1' DAY");
        given().contentType("application/json")
                .body(Map.of("token", segundoToken, "nuevaPassword", "OtraClave123!"))
                .when().post("/auth/restablecer")
                .then()
                .statusCode(400)
                .body("codigo", is("TOKEN_INVALIDO"));
    }

    @Test
    void cierreDeSesionInvalidaElToken() {
        String token = login("admin@qorigo.local", "Admin123!");
        autenticado(token).when().post("/auth/logout").then().statusCode(204);
        autenticado(token).when().get("/mi/perfil").then().statusCode(401);
    }
}
