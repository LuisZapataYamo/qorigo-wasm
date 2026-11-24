package pe.qorigo.catalogo.domain;

public record Plataforma(
        Long idPlataforma,
        String nombre,
        String descripcion,
        boolean activo
) {
}
