package pe.qorigo.catalogo.domain;

public record Moneda(
        String codigo,
        String nombre,
        int decimales
) {
}
