package pe.qorigo.suscripcion.infrastructure.rest;

import io.smallrye.common.annotation.RunOnVirtualThread;
import jakarta.annotation.security.RolesAllowed;
import jakarta.inject.Inject;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
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
import pe.qorigo.shared.application.Pagina;
import pe.qorigo.shared.infrastructure.rest.PaginaResponse;
import pe.qorigo.suscripcion.application.ActualizarSuscripcionCommand;
import pe.qorigo.suscripcion.application.ActualizarSuscripcionUseCase;
import pe.qorigo.suscripcion.application.CrearSuscripcionCommand;
import pe.qorigo.suscripcion.application.CrearSuscripcionUseCase;
import pe.qorigo.suscripcion.application.ListarSuscripcionesUseCase;
import pe.qorigo.suscripcion.application.ObtenerSuscripcionUseCase;
import pe.qorigo.suscripcion.application.SuscripcionDetalle;

@Path("/suscripciones")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType.APPLICATION_JSON)
@RunOnVirtualThread
@RolesAllowed("ADMIN")
public class SuscripcionResource {

    @Inject
    CrearSuscripcionUseCase crear;

    @Inject
    ListarSuscripcionesUseCase listar;

    @Inject
    ObtenerSuscripcionUseCase obtener;

    @Inject
    ActualizarSuscripcionUseCase actualizar;

    @Inject
    SuscripcionRestMapper mapper;

    @POST
    public Response crear(@Valid CrearSuscripcionRequest request) {
        SuscripcionDetalle detalle = crear.ejecutar(new CrearSuscripcionCommand(
                request.idPlataforma(),
                request.nombre(),
                request.costo(),
                request.moneda(),
                request.capacidad(),
                request.diaCobro(),
                request.fechaInicio()));
        return Response.status(Response.Status.CREATED)
                .header("Location", "/suscripciones/" + detalle.suscripcion().idSuscripcion())
                .entity(mapper.aResponse(detalle))
                .build();
    }

    @GET
    public PaginaResponse<SuscripcionResponse> listar(
            @QueryParam("q") String q,
            @QueryParam("estado") String estado,
            @QueryParam("idPlataforma") Long idPlataforma,
            @QueryParam("pagina") @DefaultValue("1") int pagina,
            @QueryParam("tamano") @DefaultValue("20") int tamano) {
        Pagina<SuscripcionDetalle> resultado = listar.ejecutar(q, estado, idPlataforma, pagina, tamano);
        return mapper.aPagina(resultado);
    }

    @GET
    @Path("/{id}")
    public SuscripcionResponse obtener(@PathParam("id") Long id) {
        return mapper.aResponse(obtener.ejecutar(id));
    }

    @PATCH
    @Path("/{id}")
    public SuscripcionResponse actualizar(@PathParam("id") Long id, @Valid ActualizarSuscripcionRequest request) {
        SuscripcionDetalle detalle = actualizar.ejecutar(id, new ActualizarSuscripcionCommand(
                request.nombre(),
                request.costo(),
                request.capacidad(),
                request.diaCobro(),
                request.estado()));
        return mapper.aResponse(detalle);
    }
}
