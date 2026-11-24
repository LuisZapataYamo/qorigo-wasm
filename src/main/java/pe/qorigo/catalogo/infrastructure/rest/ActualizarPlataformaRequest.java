package pe.qorigo.catalogo.infrastructure.rest;

import jakarta.validation.constraints.Size;

public record ActualizarPlataformaRequest(
        @Size(max = 120) String nombre,
        @Size(max = 250) String descripcion,
        Boolean activo
) {
}
