package pe.qorigo.persona.domain;

import java.time.Instant;

public record Persona(
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
    public String nombreCompleto() {
        return nombres + " " + apellidos;
    }
}
