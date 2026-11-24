package pe.qorigo.persona.infrastructure.rest;

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
import pe.qorigo.persona.application.ActualizarPersonaUseCase;
import pe.qorigo.persona.application.ConsultarFichaPersonaUseCase;
import pe.qorigo.persona.application.EliminarPersonaUseCase;
import pe.qorigo.persona.application.FichaPersona;
import pe.qorigo.persona.application.ListarPersonasUseCase;
import pe.qorigo.persona.application.ObtenerPersonaUseCase;
import pe.qorigo.persona.application.RegistrarPersonaUseCase;
import pe.qorigo.persona.domain.Persona;
import pe.qorigo.shared.application.Pagina;
import pe.qorigo.shared.infrastructure.rest.PaginaResponse;

@Path("/personas")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
@RolesAllowed("ADMIN")
public class PersonaResource {

    @Inject
    RegistrarPersonaUseCase registrarPersona;

    @Inject
    ListarPersonasUseCase listarPersonas;

    @Inject
    ObtenerPersonaUseCase obtenerPersona;

    @Inject
    ActualizarPersonaUseCase actualizarPersona;

    @Inject
    EliminarPersonaUseCase eliminarPersona;

    @Inject
    ConsultarFichaPersonaUseCase consultarFicha;

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

    @GET
    public PaginaResponse<PersonaResponse> listar(
            @QueryParam("q") String q,
            @QueryParam("estado") String estado,
            @QueryParam("pagina") @DefaultValue("1") int pagina,
            @QueryParam("tamano") @DefaultValue("20") int tamano) {
        Pagina<Persona> resultado = listarPersonas.ejecutar(q, estado, pagina, tamano);
        return mapper.aPagina(resultado);
    }

    @GET
    @Path("/{id}")
    public PersonaResponse obtener(@PathParam("id") Long id) {
        return mapper.aResponse(obtenerPersona.ejecutar(id));
    }

    @PATCH
    @Path("/{id}")
    public PersonaResponse actualizar(@PathParam("id") Long id, @Valid ActualizarPersonaRequest request) {
        return mapper.aResponse(actualizarPersona.ejecutar(id, mapper.aCommand(request)));
    }

    @DELETE
    @Path("/{id}")
    public Response eliminar(@PathParam("id") Long id) {
        eliminarPersona.ejecutar(id);
        return Response.noContent().build();
    }

    @GET
    @Path("/{id}/ficha")
    public FichaPersonaResponse ficha(@PathParam("id") Long id) {
        FichaPersona ficha = consultarFicha.ejecutar(id);
        return mapper.aResponse(ficha);
    }
}
