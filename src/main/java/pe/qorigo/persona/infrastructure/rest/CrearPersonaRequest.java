package pe.qorigo.persona.infrastructure.rest;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CrearPersonaRequest(
        @NotBlank @Size(max = 120) String nombres,
        @NotBlank @Size(max = 120) String apellidos,
        @Size(max = 30) String documento,
        @Size(max = 30) String telefono,
        @Email @Size(max = 150) String email,
        @Size(max = 250) String direccion,
        Boolean confirmarDuplicado
) {
    public boolean confirmaDuplicado() {
        return Boolean.TRUE.equals(confirmarDuplicado);
    }
}
