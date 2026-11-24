package pe.qorigo.catalogo.infrastructure.rest;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CrearPlataformaRequest(
        @NotBlank @Size(max = 120) String nombre,
        @Size(max = 250) String descripcion
) {
}
