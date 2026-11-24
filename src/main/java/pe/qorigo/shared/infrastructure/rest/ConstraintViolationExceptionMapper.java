package pe.qorigo.shared.infrastructure.rest;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.ConstraintViolationException;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

import java.util.LinkedHashMap;
import java.util.Map;

@Provider
public class ConstraintViolationExceptionMapper implements ExceptionMapper<ConstraintViolationException> {

    @Override
    public Response toResponse(ConstraintViolationException exception) {
        Map<String, String> detalles = new LinkedHashMap<>();
        for (ConstraintViolation<?> violation : exception.getConstraintViolations()) {
            String campo = violation.getPropertyPath() == null ? "general" : violation.getPropertyPath().toString();
            detalles.put(campo, violation.getMessage());
        }
        return Response.status(Response.Status.BAD_REQUEST)
                .entity(ApiError.de("VALIDACION", "Datos inválidos", detalles))
                .build();
    }
}
