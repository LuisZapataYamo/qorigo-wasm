package pe.qorigo.shared.infrastructure.rest;

import java.time.Instant;
import java.util.Map;

public record ApiError(
        String codigo,
        String mensaje,
        Map<String, String> detalles,
        Instant timestamp
) {
    public static ApiError de(String codigo, String mensaje) {
        return new ApiError(codigo, mensaje, Map.of(), Instant.now());
    }

    public static ApiError de(String codigo, String mensaje, Map<String, String> detalles) {
        return new ApiError(codigo, mensaje, detalles == null ? Map.of() : detalles, Instant.now());
    }
}
