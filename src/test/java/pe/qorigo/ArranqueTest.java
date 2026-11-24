package pe.qorigo;

import io.quarkus.test.junit.QuarkusTest;
import io.restassured.RestAssured;
import org.junit.jupiter.api.Test;

import static org.hamcrest.Matchers.is;

@QuarkusTest
class ArranqueTest {

    @Test
    void laAplicacionArrancaConElEsquemaMigrado() {
        RestAssured.given()
                .when().get("/")
                .then()
                .statusCode(200)
                .body("estado", is("OK"));
    }
}
