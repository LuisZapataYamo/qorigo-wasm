package pe.qorigo.suscripcion.application;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;
import pe.qorigo.shared.domain.NoEncontradoException;

import java.util.List;

@ApplicationScoped
public class ListarMiembrosUseCase {

    @Inject
    SuscripcionRepository suscripciones;

    @Inject
    MiembroSuscripcionRepository miembros;

    @Transactional
    public List<MiembroDetalle> ejecutar(Long idSuscripcion) {
        suscripciones.buscarPorId(idSuscripcion)
                .orElseThrow(() -> new NoEncontradoException("Suscripción", idSuscripcion));
        return miembros.listarPorSuscripcion(idSuscripcion);
    }
}
