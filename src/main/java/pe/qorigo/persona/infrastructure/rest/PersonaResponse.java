package pe.qorigo.persona.infrastructure.rest;

import java.time.Instant;

public record PersonaResponse(
        Long idPersona,
        String nombres,
        String apellidos,
        String nombreNormalizado,
        String documento,
        String telefono,
        String email,
        String direccion,
        boolean activo,
        Instant creadoEn
) {
}
