package pe.qorigo.suscripcion.infrastructure.rest;

public record MiembroCreadoResponse(
        MiembroResponse miembro,
        SuscripcionResponse suscripcion
) {
}
