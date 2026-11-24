package pe.qorigo.shared.infrastructure.rest;

import pe.qorigo.shared.application.Pagina;

import java.util.List;
import java.util.function.Function;

public record PaginaResponse<T>(
        List<T> contenido,
        int pagina,
        int tamano,
        long total,
        int totalPaginas
) {
    public static <D, R> PaginaResponse<R> de(Pagina<D> pagina, Function<D, R> mapper) {
        return new PaginaResponse<>(
                pagina.contenido().stream().map(mapper).toList(),
                pagina.pagina(),
                pagina.tamano(),
                pagina.total(),
                pagina.totalPaginas());
    }
}
