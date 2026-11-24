package pe.qorigo.suscripcion.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.shared.application.Pagina;
import pe.qorigo.shared.domain.ValidacionException;
import pe.qorigo.suscripcion.domain.EstadoSuscripcion;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.util.List;
import java.util.Locale;
import java.util.Map;

@ApplicationScoped
public class ListarSuscripcionesUseCase {

    private static final int TAMANO_MAXIMO = 100;

    @Inject
    SuscripcionRepository suscripciones;

    @Transactional
    public Pagina<SuscripcionDetalle> ejecutar(String q, String estado, Long idPlataforma, int pagina, int tamano) {
        if (pagina < 1) {
            throw new ValidacionException("pagina", "La página debe ser mayor o igual a 1");
        }
        if (tamano < 1 || tamano > TAMANO_MAXIMO) {
            throw new ValidacionException("tamano", "El tamaño debe estar entre 1 y " + TAMANO_MAXIMO);
        }

        String texto = q == null || q.isBlank() ? null : q.trim();
        EstadoSuscripcion estadoFiltro = interpretarEstado(estado);
        Pagina<Suscripcion> resultado = suscripciones.buscar(
                new FiltroSuscripciones(texto, estadoFiltro, idPlataforma, pagina, tamano));

        Map<Long, ResumenMiembros> resumenes = suscripciones.resumenMiembros(
                resultado.contenido().stream().map(Suscripcion::idSuscripcion).toList());
        List<SuscripcionDetalle> detalles = resultado.contenido().stream()
                .map(suscripcion -> SuscripcionDetalle.de(suscripcion,
                        resumenes.getOrDefault(suscripcion.idSuscripcion(), ResumenMiembros.vacio())))
                .toList();
        return Pagina.de(detalles, resultado.pagina(), resultado.tamano(), resultado.total());
    }

    private EstadoSuscripcion interpretarEstado(String estado) {
        if (estado == null || estado.isBlank() || "TODOS".equalsIgnoreCase(estado)) {
            return null;
        }
        return switch (estado.trim().toUpperCase(Locale.ROOT)) {
            case "ACTIVA", "ACTIVAS" -> EstadoSuscripcion.ACTIVA;
            case "SUSPENDIDA", "SUSPENDIDAS" -> EstadoSuscripcion.SUSPENDIDA;
            case "CANCELADA", "CANCELADAS" -> EstadoSuscripcion.CANCELADA;
            default -> throw new ValidacionException("estado",
                    "El estado debe ser ACTIVA, SUSPENDIDA, CANCELADA o TODOS");
        };
    }
}
