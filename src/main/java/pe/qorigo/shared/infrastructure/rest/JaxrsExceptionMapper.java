package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import org.jboss.logging.Logger;

@Provider
public class JaxrsExceptionMapper implements ExceptionMapper<RuntimeException> {

    private static final Logger LOG = Logger.getLogger(JaxrsExceptionMapper.class);

    @Override
    public Response toResponse(RuntimeException exception) {
        if (exception instanceof NotFoundException) {
            return Response.status(Response.Status.NOT_FOUND)
                    .entity(ApiError.de("NO_ENCONTRADO", "Recurso no encontrado"))
                    .build();
        }
        if (exception instanceof BadRequestException) {
            return Response.status(Response.Status.BAD_REQUEST)
                    .entity(ApiError.de("SOLICITUD_INVALIDA", "Solicitud inválida"))
                    .build();
        }
        if (exception instanceof jakarta.ws.rs.NotAuthorizedException) {
            return Response.status(Response.Status.UNAUTHORIZED)
                    .entity(ApiError.de("NO_AUTORIZADO", "Credenciales inválidas o sesión expirada"))
                    .build();
        }
        if (exception instanceof jakarta.ws.rs.ForbiddenException) {
            return Response.status(Response.Status.FORBIDDEN)
                    .entity(ApiError.de("PROHIBIDO", "No tienes permiso para esta operación"))
                    .build();
        }
        LOG.error("Error no controlado", exception);
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .entity(ApiError.de("ERROR_INTERNO", "Ocurrió un error inesperado"))
                .build();
    }
}
