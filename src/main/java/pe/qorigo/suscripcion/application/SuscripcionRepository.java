package pe.qorigo.suscripcion.application;

import pe.qorigo.shared.application.Pagina;
import pe.qorigo.suscripcion.domain.Suscripcion;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;

public interface SuscripcionRepository {

    Suscripcion guardar(Suscripcion suscripcion);

    Optional<Suscripcion> buscarPorId(Long idSuscripcion);

    /**
     * Bloquea la fila de la suscripción hasta el fin de la transacción. Se usa
     * para validar la capacidad de forma segura ante altas concurrentes.
     */
    Optional<Suscripcion> bloquearPorId(Long idSuscripcion);

    Pagina<Suscripcion> buscar(FiltroSuscripciones filtro);

    ResumenMiembros resumenMiembros(Long idSuscripcion);

    Map<Long, ResumenMiembros> resumenMiembros(Collection<Long> idsSuscripcion);
}
