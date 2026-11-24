package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import pe.qorigo.shared.domain.ReglaNegocioException;

@Provider
public class ReglaNegocioExceptionMapper implements ExceptionMapper<ReglaNegocioException> {

    @Override
    public Response toResponse(ReglaNegocioException exception) {
        return Response.status(422)
                .entity(ApiError.de(exception.codigo(), exception.getMessage()))
                .build();
    }
}
