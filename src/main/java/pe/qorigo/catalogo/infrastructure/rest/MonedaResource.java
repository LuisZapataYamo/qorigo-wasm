package pe.qorigo.catalogo.infrastructure.rest;

import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import pe.qorigo.catalogo.application.ListarMonedasUseCase;

import java.util.List;

@Path("/monedas")
@Produces(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
@RolesAllowed("ADMIN")
public class MonedaResource {

    @Inject
    ListarMonedasUseCase listar;

    @Inject
    CatalogoRestMapper mapper;

    @GET
    public List<MonedaResponse> listar() {
        return mapper.aMonedaResponses(listar.ejecutar());
    }
}
