package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import pe.qorigo.shared.domain.NoEncontradoException;

@Provider
public class NoEncontradoExceptionMapper implements ExceptionMapper<NoEncontradoException> {

    @Override
    public Response toResponse(NoEncontradoException exception) {
        return Response.status(Response.Status.NOT_FOUND)
                .entity(ApiError.de(exception.codigo(), exception.getMessage()))
                .build();
    }
}
