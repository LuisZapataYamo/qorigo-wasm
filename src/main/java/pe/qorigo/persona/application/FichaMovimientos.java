package pe.qorigo.persona.application;

import java.util.List;

public record FichaMovimientos(
        List<SuscripcionDePersona> suscripciones,
        List<PrestamoDePersona> prestamos,
        List<DeudaPorMoneda> deudaPorMoneda,
        List<PagoReciente> pagosRecientes
) {
}
