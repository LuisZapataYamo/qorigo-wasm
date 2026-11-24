package pe.qorigo.catalogo.infrastructure.rest;

public record MonedaResponse(
        String codigo,
        String nombre,
        int decimales
) {
}
