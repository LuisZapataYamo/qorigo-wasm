package pe.qorigo.shared.application;

import java.util.List;

public record Pagina<T>(
        List<T> contenido,
        int pagina,
        int tamano,
        long total,
        int totalPaginas
) {
    public static <T> Pagina<T> de(List<T> contenido, int pagina, int tamano, long total) {
        int totalPaginas = tamano == 0 ? 0 : (int) Math.ceil((double) total / tamano);
        return new Pagina<>(contenido, pagina, tamano, total, totalPaginas);
    }
}
