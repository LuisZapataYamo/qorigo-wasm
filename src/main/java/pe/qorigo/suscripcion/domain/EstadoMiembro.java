package pe.qorigo.suscripcion.domain;

public enum EstadoMiembro {
    ACTIVO,
    INACTIVO;

    public boolean activo() {
        return this == ACTIVO;
    }
}
