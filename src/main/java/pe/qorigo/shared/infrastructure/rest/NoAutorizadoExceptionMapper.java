package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import pe.qorigo.shared.domain.NoAutorizadoException;

@Provider
public class NoAutorizadoExceptionMapper implements ExceptionMapper<NoAutorizadoException> {

    @Override
    public Response toResponse(NoAutorizadoException exception) {
        return Response.status(Response.Status.UNAUTHORIZED)
                .entity(ApiError.de(exception.codigo(), exception.getMessage()))
                .build();
    }
}
