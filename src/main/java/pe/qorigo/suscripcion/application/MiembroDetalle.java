package pe.qorigo.suscripcion.application;

import pe.qorigo.suscripcion.domain.MiembroSuscripcion;

public record MiembroDetalle(
        MiembroSuscripcion miembro,
        String nombres,
        String apellidos,
        String documento
) {
}
