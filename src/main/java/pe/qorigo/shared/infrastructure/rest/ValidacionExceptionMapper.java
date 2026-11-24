package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import pe.qorigo.shared.domain.ValidacionException;

@Provider
public class ValidacionExceptionMapper implements ExceptionMapper<ValidacionException> {

    @Override
    public Response toResponse(ValidacionException exception) {
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(ApiError.de(exception.codigo(), exception.getMessage(), exception.detalles()))
                .build();
    }
}
