package pe.qorigo.catalogo;

import io.quarkus.test.junit.QuarkusTest;
import org.junit.jupiter.api.Test;
import pe.qorigo.support.BaseAcceptanceTest;

import java.util.Map;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;

@QuarkusTest
class CatalogoAcceptanceTest extends BaseAcceptanceTest {

    @Test
    void monedasDisponibles() {
        admin().when().get("/monedas")
                .then()
                .statusCode(200)
                .body("codigo", hasItem("PEN"))
                .body("codigo", hasItem("USD"))
                .body("size()", is(3));
    }

    @Test
    void crearYDesactivarPlataforma() {
        Integer id = admin().body(Map.of("nombre", "Netflix", "descripcion", "Streaming"))
                .when().post("/plataformas")
                .then()
                .statusCode(201)
                .body("nombre", is("Netflix"))
                .body("activo", is(true))
                .extract().jsonPath().getInt("idPlataforma");

        admin().body(Map.of("nombre", "netflix"))
                .when().post("/plataformas")
                .then()
                .statusCode(409)
                .body("codigo", is("PLATAFORMA_DUPLICADA"));

        admin().when().get("/plataformas")
                .then()
                .statusCode(200)
                .body("nombre", hasItem("Netflix"));

        admin().when().delete("/plataformas/" + id)
                .then().statusCode(204);

        admin().when().get("/plataformas")
                .then()
                .statusCode(200)
                .body("nombre", org.hamcrest.Matchers.not(hasItem("Netflix")));

        admin().queryParam("incluirInactivas", true)
                .when().get("/plataformas")
                .then()
                .statusCode(200)
                .body("nombre", hasItem("Netflix"));
    }

    @Test
    void configuracionSeConsultaYActualiza() {
        admin().when().get("/configuracion")
                .then()
                .statusCode(200)
                .body("imagen_ancho", is("100"))
                .body("metodos_con_comprobante", is("YAPE,PLIN,TRANSFERENCIA"));

        admin().body(Map.of("imagen_ancho", "120", "umbral_riesgo_dias", "45"))
                .when().patch("/configuracion")
                .then()
                .statusCode(200)
                .body("imagen_ancho", is("120"))
                .body("umbral_riesgo_dias", is("45"));

        admin().when().get("/configuracion")
                .then()
                .statusCode(200)
                .body("imagen_ancho", is("120"));
    }
}
