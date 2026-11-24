package pe.qorigo.shared.infrastructure.rest;

import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import pe.qorigo.shared.domain.LimiteIntentosException;

@Provider
public class LimiteIntentosExceptionMapper implements ExceptionMapper<LimiteIntentosException> {

    @Override
    public Response toResponse(LimiteIntentosException exception) {
        return Response.status(429)
                .entity(ApiError.de(exception.codigo(), exception.getMessage()))
                .build();
    }
}
