package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import pe.qorigo.shared.domain.ConflictoException;

@Provider
public class ConflictoExceptionMapper implements ExceptionMapper<ConflictoException> {

    @Override
    public Response toResponse(ConflictoException exception) {
        return Response.status(Response.Status.CONFLICT)
                .entity(ApiError.de(exception.codigo(), exception.getMessage()))
                .build();
    }
}
