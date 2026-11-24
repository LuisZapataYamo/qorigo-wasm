package pe.qorigo.catalogo.infrastructure.rest;

import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import pe.qorigo.catalogo.application.ActualizarConfiguracionUseCase;
import pe.qorigo.catalogo.application.ObtenerConfiguracionUseCase;

import java.util.Map;

@Path("/configuracion")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
@RolesAllowed("ADMIN")
public class ConfiguracionResource {

    @Inject
    ObtenerConfiguracionUseCase obtener;

    @Inject
    ActualizarConfiguracionUseCase actualizar;

    @GET
    public Map<String, String> obtener() {
        return obtener.ejecutar();
    }

    @PATCH
    public Map<String, String> actualizar(Map<String, String> cambios) {
        return actualizar.ejecutar(cambios);
    }
}
