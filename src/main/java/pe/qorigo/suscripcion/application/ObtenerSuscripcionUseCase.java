package pe.qorigo.suscripcion.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.shared.domain.NoEncontradoException;
import pe.qorigo.suscripcion.domain.Suscripcion;

@ApplicationScoped
public class ObtenerSuscripcionUseCase {

    @Inject
    SuscripcionRepository suscripciones;

    @Transactional
    public SuscripcionDetalle ejecutar(Long idSuscripcion) {
        Suscripcion suscripcion = suscripciones.buscarPorId(idSuscripcion)
                .orElseThrow(() -> new NoEncontradoException("Suscripción", idSuscripcion));
        return SuscripcionDetalle.de(suscripcion, suscripciones.resumenMiembros(idSuscripcion));
    }
}
