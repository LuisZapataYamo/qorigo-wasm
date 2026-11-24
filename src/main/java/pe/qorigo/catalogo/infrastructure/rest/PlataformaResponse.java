package pe.qorigo.catalogo.infrastructure.rest;

public record PlataformaResponse(
        Long idPlataforma,
        String nombre,
        String descripcion,
        boolean activo
) {
}
