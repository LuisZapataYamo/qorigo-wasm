package pe.qorigo.support;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;
import jakarta.inject.Inject;
import org.junit.jupiter.api.BeforeEach;
import pe.qorigo.auth.application.LoginAttemptService;
import pe.qorigo.auth.infrastructure.security.TokenBlacklist;

import java.time.LocalDate;
import java.util.Map;

import static io.restassured.RestAssured.given;

@QuarkusTest
public abstract class BaseAcceptanceTest {

    @Inject
    protected TestDb db;

    @Inject
    LoginAttemptService intentosLogin;

    @Inject
    TokenBlacklist tokenBlacklist;

    protected String adminToken;

    @BeforeEach
    void prepararBase() {
        RelojFijo.fijar(LocalDate.of(2026, 11, 24));
        intentosLogin.limpiar();
        tokenBlacklist.limpiar();
        db.reiniciar();
        adminToken = login(TestDb.ADMIN_EMAIL, TestDb.ADMIN_PASSWORD);
    }

    protected String login(String email, String password) {
        return given()
                .contentType(ContentType.JSON)
                .body(Map.of("email", email, "password", password))
                .when().post("/auth/login")
                .then().statusCode(200)
                .extract().path("token");
    }

    protected RequestSpecification admin() {
        return given()
                .contentType(ContentType.JSON)
                .auth().oauth2(adminToken);
    }

    protected RequestSpecification autenticado(String token) {
        return given()
                .contentType(ContentType.JSON)
                .auth().oauth2(token);
    }

    protected String crearUsuarioParaPersona(Long idPersona, String email, String password, String rol) {
        admin().body(Map.of(
                        "email", email,
                        "password", password,
                        "rol", rol))
                .when().post("/personas/" + idPersona + "/usuario")
                .then().statusCode(201);
        return login(email, password);
    }

    protected void limpiarBloqueos() {
        intentosLogin.limpiar();
        tokenBlacklist.limpiar();
    }
}
