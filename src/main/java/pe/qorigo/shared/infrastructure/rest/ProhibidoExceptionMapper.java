package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import pe.qorigo.shared.domain.ProhibidoException;

@Provider
public class ProhibidoExceptionMapper implements ExceptionMapper<ProhibidoException> {

    @Override
    public Response toResponse(ProhibidoException exception) {
        return Response.status(Response.Status.FORBIDDEN)
                .entity(ApiError.de(exception.codigo(), exception.getMessage()))
                .build();
    }
}
