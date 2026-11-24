package pe.qorigo.auth.infrastructure.rest;

import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import pe.qorigo.auth.application.CrearAccesoPersonaUseCase;
import pe.qorigo.auth.application.UsuarioSesion;

@Path("/personas/{idPersona}/usuario")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
public class UsuarioAdminResource {

    @Inject
    CrearAccesoPersonaUseCase crearAcceso;

    @Inject
    AuthRestMapper mapper;

    @POST
    @RolesAllowed("ADMIN")
    public Response crear(@PathParam("idPersona") Long idPersona, @Valid CrearUsuarioRequest request) {
        UsuarioSesion usuario = crearAcceso.ejecutar(idPersona, request.email(), request.password(), request.rol());
        return Response.status(Response.Status.CREATED).entity(mapper.aResponse(usuario)).build();
    }
}
