package pe.qorigo.persona.infrastructure.rest;

import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import pe.qorigo.persona.application.RegistrarPersonaUseCase;
import pe.qorigo.persona.domain.Persona;

@Path("/personas")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
@RolesAllowed("ADMIN")
public class PersonaResource {

    @Inject
    RegistrarPersonaUseCase registrarPersona;

    @Inject
    PersonaRestMapper mapper;

    @POST
    public Response crear(@Valid CrearPersonaRequest request) {
        Persona persona = registrarPersona.ejecutar(mapper.aCommand(request));
        return Response.status(Response.Status.CREATED)
                .header("Location", "/personas/" + persona.idPersona())
                .entity(mapper.aResponse(persona))
                .build();
    }
}
