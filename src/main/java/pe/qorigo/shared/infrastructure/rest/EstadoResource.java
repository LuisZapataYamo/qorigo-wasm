package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;

import java.util.Map;

/**
 * Endpoint público mínimo para verificar que el servicio está arriba.
 */
@Path("/")
public class EstadoResource {

    @GET
    @Produces(MediaType.APPLICATION_JSON)
    public Map<String, String> estado() {
        return Map.of("servicio", "qorigo-api", "estado", "OK");
    }
}
