package pe.qorigo.catalogo.infrastructure.rest;

import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import pe.qorigo.catalogo.application.ActualizarPlataformaUseCase;
import pe.qorigo.catalogo.application.CrearPlataformaUseCase;
import pe.qorigo.catalogo.application.ListarPlataformasUseCase;
import pe.qorigo.catalogo.domain.Plataforma;

import java.util.List;

@Path("/plataformas")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
@RolesAllowed("ADMIN")
public class PlataformaResource {

    @Inject
    ListarPlataformasUseCase listar;

    @Inject
    CrearPlataformaUseCase crear;

    @Inject
    ActualizarPlataformaUseCase actualizar;

    @Inject
    CatalogoRestMapper mapper;

    @GET
    public List<PlataformaResponse> listar(@QueryParam("incluirInactivas") @DefaultValue("false") boolean incluirInactivas) {
        return mapper.aPlataformaResponses(listar.ejecutar(incluirInactivas));
    }

    @POST
    public Response crear(@Valid CrearPlataformaRequest request) {
        Plataforma plataforma = crear.ejecutar(request.nombre(), request.descripcion());
        return Response.status(Response.Status.CREATED)
                .header("Location", "/plataformas/" + plataforma.idPlataforma())
                .entity(mapper.aResponse(plataforma))
                .build();
    }

    @PATCH
    @Path("/{id}")
    public PlataformaResponse actualizar(@PathParam("id") Long id, @Valid ActualizarPlataformaRequest request) {
        return mapper.aResponse(actualizar.ejecutar(id, request.nombre(), request.descripcion(), request.activo()));
    }

    @DELETE
    @Path("/{id}")
    public Response desactivar(@PathParam("id") Long id) {
        actualizar.ejecutar(id, null, null, false);
        return Response.noContent().build();
    }
}
