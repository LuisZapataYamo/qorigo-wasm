package pe.qorigo.suscripcion.application;

import pe.qorigo.suscripcion.domain.MiembroSuscripcion;

import java.util.List;

public interface MiembroSuscripcionRepository {

    MiembroSuscripcion guardar(MiembroSuscripcion miembro);

    boolean existeActivo(Long idSuscripcion, Long idPersona);

    List<MiembroDetalle> listarPorSuscripcion(Long idSuscripcion);
}
