package pe.qorigo.suscripcion.domain;

import pe.qorigo.shared.domain.ValidacionException;

public enum EstadoSuscripcion {
    ACTIVA,
    SUSPENDIDA,
    CANCELADA;

    public static EstadoSuscripcion desde(String valor) {
        if (valor == null || valor.isBlank()) {
            throw new ValidacionException("estado", "El estado es obligatorio");
        }
        try {
            return EstadoSuscripcion.valueOf(valor.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new ValidacionException("estado", "El estado debe ser ACTIVA, SUSPENDIDA o CANCELADA");
        }
    }

    public boolean activa() {
        return this == ACTIVA;
    }
}
